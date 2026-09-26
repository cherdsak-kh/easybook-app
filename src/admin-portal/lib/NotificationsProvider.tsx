/**
 * The one notification source the whole shell shares. WHY it is one source, and what `null` means, is
 * in `notifications-context.ts`; this file is the component alone, so Fast Refresh keeps working.
 *
 * ── Refresh policy (D-9) — NO POLLING, NO TIMER ──
 * There is no `setInterval` and no `setTimeout` anywhere in here. The three slots are re-read on:
 *   · mount, and every `pathname` change   → `refresh()` (the `usePendingBookings` precedent). NOT
 *     `invalidate()`: arriving ON the notification page mounts it, the mount fetches its list, and a
 *     version bump would fire that GET a second time;
 *   · window `focus` / `visibilitychange` → visible, coalesced by TIMESTAMP (500 ms, the
 *     `master-sync.ts` rule — the two fire as a pair on an ordinary tab switch) → `invalidate()`;
 *   · the bell opening (`Topbar`)          → `invalidate()`;
 *   · every write, success or failure      → `invalidate()` in `finally`.
 * Phase 4 (`NOTIF-RT-1`) adds a push on top of this; it does not replace it.
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

/** Focus and visibility fire as a pair a few ms apart on a tab switch — one burst, not two. */
const RETURN_COALESCE_MS = 500

/** The bell's window: the newest five, read or unread (D-2). */
const BELL_LIMIT = 5

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const [unread, setUnread] = useState<NotificationUnreadCount | null>(null)
  const [bell, setBell] = useState<AdminNotification[] | null>(null)
  const [readTotal, setReadTotal] = useState<number | null>(null)
  const [version, setVersion] = useState(0)

  const inFlight = useRef(false)
  const again = useRef(false)
  const mounted = useRef(true)

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
