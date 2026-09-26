/**
 * The bell row's view-model, and the pure helpers both notification surfaces share — split out of
 * `NotifRow.tsx` so that file exports components only (Fast Refresh — same reason as `use-busy.ts`).
 *
 * ⚠️ THE UNREAD COUNT HAS EXACTLY ONE SOURCE — `GET /notifications/unread-count` (D-10), held by
 * `NotificationsProvider`. The bell's badge, its `N ใหม่` chip, its `aria-label`, the page's <h1> pill
 * and the five tab pills are six renderings of that one answer. Nothing counts rows any more: the bell
 * holds only the newest five, so a count of its rows would under-report the moment a sixth arrived.
 * `unreadCount` below survives for the Showcase's static fixture ONLY; no live surface may call it.
 */

import type { ReactNode } from 'react'
import { ADMIN_PORTAL_ROUTES, BACKEND_BASE, type AdminRouteLabel } from '../routes'
import type { NotificationTone } from './notifications-api'
import { NO_VALUE, dayNumber, thaiTime } from './thai-date'

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

/** Showcase-only (see the header). A live surface reads `unread.total` from the provider. */
export const unreadCount = (items: Notification[]): number =>
  items.reduce((n, i) => (i.read ? n : n + 1), 0)

/**
 * The bell's accessible name. One sentence, not "การแจ้งเตือน (3)" — a screen reader reading a bare
 * number after a noun leaves the listener to guess what was counted. `null` is "not loaded yet", and
 * says only the control's name rather than a zero nobody has measured.
 */
export const bellLabel = (count: number | null): string =>
  count === null
    ? 'การแจ้งเตือน'
    : count === 0
      ? 'การแจ้งเตือน ไม่มีรายการที่ยังไม่อ่าน'
      : `การแจ้งเตือน ${count} รายการที่ยังไม่อ่าน`

/**
 * The badge's text (D-16): the exact number for 1–9, `9+` above. The CALLER hides it at 0.
 *
 * 9+, not 99+: the badge is an 18px circle beside a bell, three glyphs in it are unreadable at 12px,
 * and "you have a lot" is all a badge can carry. The exact number is the panel's `N ใหม่` chip.
 */
export const badgeText = (n: number): string => (n > 9 ? '9+' : String(n))

/**
 * API tone → the `.notif-tone-*` suffix. A `Record` over the generated enum, so a sixth tone fails
 * the build here; callers still write `TONE_KEY[tone] ?? 'slate'` so an unexpected string at RUNTIME
 * draws a neutral tile rather than an unstyled one.
 */
export const TONE_KEY: Record<NotificationTone, NotifTone> = {
  SKY: 'sky',
  AMBER: 'amber',
  ROSE: 'rose',
  EMERALD: 'emerald',
  SLATE: 'slate',
}

/**
 * `createdAt` in the prototype's relative vocabulary (D-17):
 * `เมื่อสักครู่` · `N นาทีที่แล้ว` · `N ชั่วโมงที่แล้ว` · `เมื่อวาน HH:mm` · `N วันที่แล้ว`.
 *
 * Pure — `now` is a parameter. There is NO clock tick: the label is computed at render and refreshed
 * whenever the data is re-read, and nothing asked for a timer.
 *
 * ⚠️ "Same day" and "yesterday" are CALENDAR days (`dayNumber`, local parts), not 24-hour spans: a
 * row from 23:30 read at 00:40 is `เมื่อวาน 23:30`, not `1 ชั่วโมงที่แล้ว`. A negative age (the
 * server's clock a little ahead of this one) reads `เมื่อสักครู่` rather than a nonsense number. There
 * is no month unit — the prototype prints `68 วันที่แล้ว`, and so does this.
 */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return NO_VALUE
  const ms = now.getTime() - t.getTime()
  if (ms < 60_000) return 'เมื่อสักครู่'
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`
  const days = (dayNumber(now) ?? 0) - (dayNumber(t) ?? 0)
  if (days <= 0) return `${Math.floor(minutes / 60)} ชั่วโมงที่แล้ว`
  if (days === 1) return `เมื่อวาน ${thaiTime(t)}`
  return `${days} วันที่แล้ว`
}

/**
 * Where a notification's CTA may go for THIS role — or `null` for "no CTA" (D-14).
 *
 * `actionUrl` is a router path already (`BrowserRouter` has no basename and `App` routes
 * `/backend/*`), so a reachable one is returned WHOLE — query and hash ride along. The `/backend/`
 * strip below exists only to look the route up for the ACL check, the same exact-path match
 * `BackendLayout`'s own redirect uses, so the two can never disagree.
 *
 * · null / empty                           → null (no CTA; the bell just marks read)
 * · not `/backend/…`, or `//`, or `\`       → null — defence in depth; the server already refuses
 *   these (Phase 1 §7), and navigation is SPA-only either way
 * · resolves to a route the role is denied  → null — HIDDEN, not disabled: a disabled button promises
 *   it might enable later, and for this account it never will
 * · resolves to nothing                     → returned; the router answers (the in-shell 404)
 *
 * ⚠️ DOT SEGMENTS ARE RESOLVED FIRST (QA ADV-1). `history.pushState` normalises `.`/`..` (and `%2e`)
 * the way the URL parser does, so a raw-string check would judge one path while the router lands on
 * another: `/backend/x/../settings/integrations` matched no route here, showed a VIEWER the CTA, and
 * then bounced them off the screen it really is; `/backend/../` left the back-office entirely. So the
 * path is resolved with the platform's own parser, the prefix and the ACL are checked on the RESOLVED
 * path, and the resolved path is what gets navigated to — query and hash kept.
 */
export function actionTarget(
  url: string | null,
  can: (label: AdminRouteLabel) => boolean,
): string | null {
  if (!url) return null
  if (!url.startsWith(`${BACKEND_BASE}/`) || url.includes('//') || url.includes('\\')) return null
  const resolved = new URL(url, 'http://x')
  const path = resolved.pathname
  if (!path.startsWith(`${BACKEND_BASE}/`)) return null
  const slug = path.slice(BACKEND_BASE.length + 1).replace(/\/+$/, '')
  const route = ADMIN_PORTAL_ROUTES.find((r) => r.path === slug)
  if (route && !can(route.label)) return null
  return `${path}${resolved.search}${resolved.hash}`
}
