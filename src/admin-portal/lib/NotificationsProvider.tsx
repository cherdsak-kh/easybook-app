/**
 * The one notification source the whole shell shares. WHY it is one source, and what `null` means, is
 * in `notifications-context.ts`; this file is the component alone, so Fast Refresh keeps working.
 *
 * ── NO POLLING ── There is no `setInterval`. There is exactly ONE `setTimeout`: the 400 ms push
 * coalescer (NOTIF-RT-1). The three slots are re-read on:
 *   · mount, and every `pathname` change   → `refresh()` (the `usePendingBookings` precedent). NOT
 *     `invalidate()`: arriving ON the notification page mounts it, the mount fetches its list, and a
 *     version bump would fire that GET a second time;
 *   · window `focus` / `visibilitychange` → visible, coalesced by TIMESTAMP (500 ms, the
 *     `master-sync.ts` rule — the two fire as a pair on an ordinary tab switch) → `invalidate()`;
 *   · the bell opening (`Topbar`)          → `invalidate()`;
 *   · every write, success or failure      → `invalidate()` in `finally`;
 *   · `adminNotification.created` (role-filtered) and socket re-connect → coalesced 400 ms →
 *     `invalidate()` (NOTIF-RT-1). This is a push ON TOP of the above; it does not replace it.
 *
 * ── Coalescing ──
 * At most ONE refresh in flight. A call landing while one runs sets `again`, and exactly one more runs
 * when it settles — so a write that lands mid-refresh always ends with a post-write read, and two sets
 * of the three GETs never race each other into state.
 *
 * ── Failure ──
 * `Promise.allSettled`, and each slot is set ONLY on its own success. A rejected slot keeps its last
 * value (a failed count refetch never zeroes the badge, AC-20), and nothing here renders an error: a
 * 401 is already the session-expired dialog's, raised by the watcher on `api`.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from './auth-context'
import { isNotificationVisibleToRole } from './notifications'
import {
  dismissNotifications,
  getUnreadCount,
  listNotifications,
  markNotificationRead,
  markNotificationUnread,
  markNotificationsRead,
  type AdminNotification,
  type DismissTarget,
  type NotificationUnreadCount,
} from './notifications-api'
import { NotificationsContext, type NotificationsValue } from './notifications-context'
import { useRealtimeEvents } from './realtime-context'

/** Focus and visibility fire as a pair a few ms apart on a tab switch — one burst, not two. */
const RETURN_COALESCE_MS = 500

/** The bell's window: the newest five, read or unread (D-2). */
const BELL_LIMIT = 5

/**
 * NOTIF-RT-1's coalescer — the EXACT value `use-pending-bookings.ts` / `use-pending-registrations.ts`
 * use: long enough to swallow a burst of pulses, short enough that nobody notices the lag.
 */
const PUSH_COALESCE_MS = 400

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const role = useAuth().user?.role ?? null
  const [unread, setUnread] = useState<NotificationUnreadCount | null>(null)
  const [bell, setBell] = useState<AdminNotification[] | null>(null)
  const [readTotal, setReadTotal] = useState<number | null>(null)
  const [version, setVersion] = useState(0)

  const inFlight = useRef(false)
  const again = useRef(false)
  const mounted = useRef(true)
  const pushTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    if (inFlight.current) {
      again.current = true
      return
    }
    inFlight.current = true
    try {
      do {
        again.current = false
        const [count, newest, probe] = await Promise.allSettled([
          getUnreadCount(),
          listNotifications({ limit: BELL_LIMIT }),
          listNotifications({ isRead: true, limit: 1 }),
        ])
        if (!mounted.current) return
        if (count.status === 'fulfilled') setUnread(count.value)
        if (newest.status === 'fulfilled') setBell(newest.value.data)
        if (probe.status === 'fulfilled') setReadTotal(probe.value.meta.total)
      } while (again.current)
    } finally {
      inFlight.current = false
    }
  }, [])

  const invalidate = useCallback(() => {
    setVersion((v) => v + 1)
    void refresh()
  }, [refresh])

  /**
   * NOTIF-RT-1 — the push coalescer. Copied EXACTLY from `use-pending-bookings.ts`'s `schedule`:
   * clear, then `setTimeout`. A burst of N pulses inside 400 ms collapses into one `invalidate()`.
   */
  const schedulePush = useCallback(() => {
    clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(() => invalidate(), PUSH_COALESCE_MS)
  }, [invalidate])

  useEffect(() => () => clearTimeout(pushTimer.current), [])

  // Mount, and every navigation — cheap, bounded, and the only refresh nobody has to ask for.
  useEffect(() => {
    void refresh()
  }, [refresh, pathname])

  useEffect(() => {
    let lastReturn = 0
    const onReturn = () => {
      const now = Date.now()
      if (now - lastReturn < RETURN_COALESCE_MS) return
      lastReturn = now
      invalidate()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onReturn()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onReturn)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onReturn)
    }
  }, [invalidate])

  /**
   * NOTIF-RT-1 — the push subscription. `onAdminNotificationCreated` is DEFENCE IN DEPTH only: the
   * server already withholds a SUPER_ADMIN pulse from an ADMIN socket by room (D-1), so this filter
   * exists for the rare case a future audience bug ever lets one through. `onResync` goes through
   * the SAME coalescer (not a bare `invalidate()`) — a reconnect often lands together with pulses
   * emitted just after it, and they should collapse into one refresh (AC-6).
   *
   * A VIEWER never opens a socket (`RealtimeProvider enabled={acl.write}`), so this subscription
   * registers but nothing ever fans out to it — no error, no loop, and Phase 2's focus/route/bell
   * refresh keeps working for that role unchanged.
   */
  useRealtimeEvents({
    onAdminNotificationCreated: (payload) => {
      if (isNotificationVisibleToRole(payload.targetRole, role)) schedulePush()
    },
    onResync: schedulePush,
  })

  /**
   * Every write: await the server, hand back its answer (or throw its `ApiError`), and revalidate in
   * `finally`. Nothing is optimistic (design A-4) — the surfaces re-render from the server's truth.
   */
  const write = useCallback(
    async <T,>(task: () => Promise<T>): Promise<T> => {
      try {
        return await task()
      } finally {
        invalidate()
      }
    },
    [invalidate],
  )

  const value = useMemo<NotificationsValue>(
    () => ({
      unread,
      bell,
      readTotal,
      version,
      invalidate,
      markRead: (id) => write(() => markNotificationRead(id)),
      markUnread: (id) => write(() => markNotificationUnread(id)),
      markManyRead: (ids) => write(() => markNotificationsRead(ids)),
      dismiss: (target: DismissTarget) => write(() => dismissNotifications(target)),
    }),
    [unread, bell, readTotal, version, invalidate, write],
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}
