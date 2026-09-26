/**
 * The shell's notification CONTEXT — what the bell and the notification centre read. The provider
 * that fills it is `NotificationsProvider.tsx`; the wire calls are `notifications-api.ts`.
 *
 * ⚠️ SPLIT FROM THE PROVIDER FOR FAST REFRESH, the `realtime-context.ts` reason: a module exporting a
 * component AND a hook reloads the whole shell on every edit (oxlint `only-export-components`).
 *
 * ⚠️ ONE SOURCE FOR TWO SURFACES (D-9, D-10). The bell and the page never tell each other a number;
 * they read the same three server answers from here, and every write on either surface ends in
 * `invalidate()`, which re-reads all three AND bumps `version` so the page's own list re-reads too.
 * That is what keeps the badge, the bell list, the <h1> pill and the tab pills in agreement without a
 * reload — and without a second counter anywhere.
 *
 * ⚠️ `null` MEANS "NEVER LOADED", NOT ZERO. While a slot is `null` the badge and chip are hidden, the
 * pills print `—` and both read-all buttons are disabled. A failed refetch KEEPS the last value — a
 * network blip must never announce an empty queue.
 */

import { createContext, useContext } from 'react'
import type { AdminNotification, DismissTarget, NotificationUnreadCount } from './notifications-api'

export interface NotificationsValue {
  /** `GET /unread-count`. The ONE source of every unread number (D-10). */
  unread: NotificationUnreadCount | null
  /** `GET ?limit=5` — the bell's newest five, read AND unread (D-2). */
  bell: AdminNotification[] | null
  /** `GET ?isRead=true&limit=1` → `meta.total`. Enables the purge button and counts its confirm. */
  readTotal: number | null
  /** Bumped by every `invalidate()`; the page's list effect depends on it. */
  version: number
  /** Re-read the three slots AND bump `version`. */
  invalidate: () => void
  /** The four writes. Each returns the server's answer or throws its `ApiError`, and invalidates in
   *  `finally` — success OR failure, because a failure may mean state moved. They toast nothing. */
  markRead: (id: string) => Promise<AdminNotification>
  markUnread: (id: string) => Promise<AdminNotification>
  /** `updated`. No ids = every visible unread row. */
  markManyRead: (ids?: string[]) => Promise<number>
  /** `deleted`. */
  dismiss: (target: DismissTarget) => Promise<number>
}

export const NotificationsContext = createContext<NotificationsValue | null>(null)

/**
 * Throws outside the provider rather than answering an empty feed: a bell that silently read nothing
 * would look exactly like a quiet day.
 */
export function useNotifications(): NotificationsValue {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationsProvider>')
  return ctx
}
