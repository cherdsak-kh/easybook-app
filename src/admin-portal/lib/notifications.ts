/**
 * The notification shape and the two derivations of its count, split out of `NotifRow.tsx` so
 * that file exports components only (Fast Refresh — same reason as `use-busy.ts`).
 *
 * ⚠️ THE UNREAD COUNT HAS EXACTLY ONE SOURCE — the rows. The bell's badge and its
 * `aria-label` are two renderings of the same number, and the fastest way to ship a lie is to
 * let them be updated independently. Both helpers below read from the same array; nothing
 * anywhere may keep its own tally.
 */

import type { ReactNode } from 'react'

export type NotifTone = 'emerald' | 'amber' | 'sky' | 'rose' | 'slate'

export interface Notification {
  id: string
  tone: NotifTone
  icon: ReactNode
  title: string
  detail?: string
  /** Already formatted for display — this layer does no date maths. */
  time: string
  read: boolean
}

/** The one place a count comes from. */
export const unreadCount = (items: Notification[]): number =>
  items.reduce((n, i) => (i.read ? n : n + 1), 0)

/**
 * The bell's accessible name. One sentence, not "การแจ้งเตือน (3)" — a screen reader reading
 * a bare number after a noun leaves the listener to guess what was counted.
 */
export const bellLabel = (count: number): string =>
  count === 0
    ? 'การแจ้งเตือน ไม่มีรายการที่ยังไม่อ่าน'
    : `การแจ้งเตือน ${count} รายการที่ยังไม่อ่าน`
