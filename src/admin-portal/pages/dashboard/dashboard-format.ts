/**
 * Pure formatters for ภาพรวมระบบ (Hub 7) — the header date/time, the D-6 relative queue badge, the
 * D-3 free-room headline, and the busy card's "เหลืออีก …" / slot-range copy.
 *
 * ⚠️ EVERYTHING HERE FORMATS A FIELD THE SERVER ALREADY COMPUTED AT ITS OWN `serverTime` (D-2) — it
 * never calls `new Date()` for "now". `elapsedPercent`/`remainingMinutes` on `DashboardCurrentSlotDto`
 * and `dayOffset` on `DashboardPendingItemDto` are the server's own arithmetic; this file only turns
 * them into the copy strings D-3/D-6/AC-D7/AC-D8/AC-D11 specify. A wrong device clock therefore never
 * changes what a room or a queue badge says — only how a *timestamp* prints (see the next note).
 *
 * ⚠️ TIMESTAMPS ARE READ IN THE BROWSER'S LOCAL TIME, the same as every other screen in this portal
 * (`admin-portal/lib/thai-date.ts`, which this module builds on) — the back office is assumed to run
 * from Asia/Bangkok. A fixed-offset formatter would be a change to `thai-date.ts` itself (used by
 * every booking screen already shipped), which is out of scope for this port.
 *
 * These are PURE functions — no I/O, no DOM — so they are the one place in this feature unit-tested
 * per the repo's testing policy (`tests/unit/admin-portal/pages/dashboard/dashboard-format.test.ts`).
 */

import type { DashboardFreeWindow, DashboardNextSlotDto, SystemHealth } from '@/lib/api-client'
import { thaiTime } from '../../lib/thai-date'

/** `HealthServicesDto`'s three keys, Thai names — D-7's "or the names of the failing services". */
const HEALTH_SERVICE_NAME: Record<keyof SystemHealth['services'], string> = {
  database: 'ฐานข้อมูล',
  line: 'LINE OA',
  storage: 'Cloudflare R2',
}

/** Card 4's desc line (D-7/AC-D4): the happy sentence when OK, or which services are DOWN. */
export function healthCardDesc(health: SystemHealth, apiLatencyMs: number): string {
  const down = (Object.keys(health.services) as (keyof SystemHealth['services'])[]).filter(
    (k) => health.services[k].status === 'DOWN',
  )
  if (down.length === 0) return `API ${apiLatencyMs}ms · DB & LINE เชื่อมต่อปกติ`
  return `${down.map((k) => HEALTH_SERVICE_NAME[k]).join(' · ')} ขัดข้อง`
}

const TH_DAY_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'] as const
const TH_DAY_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'] as const
const TH_MON_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
] as const

function parse(iso: string): Date | null {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/** `วันจันทร์ที่ 28 ก.ย. 2569` — the header's date line, from `serverTime` (AC-D5). */
export function serverDateHeading(serverTimeIso: string): string {
  const d = parse(serverTimeIso)
  if (!d) return '—'
  return `วัน${TH_DAY_FULL[d.getDay()]}ที่ ${d.getDate()} ${TH_MON_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`
}

/** `อัปเดต HH:MM น.` — also from `serverTime`, never the device clock (AC-D5). */
export function updatedAtLine(serverTimeIso: string): string {
  return `อัปเดต ${thaiTime(serverTimeIso)} น.`
}

/** `จ. 28 ก.ย. 2569` — the queue's per-item date (AC-D12). */
export function thaiDayShortDate(iso: string): string {
  const d = parse(iso)
  if (!d) return '—'
  return `${TH_DAY_SHORT[d.getDay()]} ${d.getDate()} ${TH_MON_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`
}

/** `HH:MM–HH:MM น.` for the queue's first slot. */
export function slotSpanText(startAtIso: string, endAtIso: string): string {
  return `${thaiTime(startAtIso)}–${thaiTime(endAtIso)} น.`
}

/** `HH:MM – HH:MM น.` for the busy room card — wider dashes, matching the prototype's own spacing. */
export function busySlotRangeText(
  startAtIso: string,
  endAtIso: string,
  startsBeforeToday: boolean,
  endsAfterToday: boolean,
): string {
  const start = (startsBeforeToday ? 'เมื่อวาน ' : '') + thaiTime(startAtIso)
  const end = thaiTime(endAtIso) + (endsAfterToday ? ' พรุ่งนี้' : '')
  return `${start} – ${end} น.`
}

/** `เหลืออีก 1 ชม. 50 นาที` (or just one unit when the other is zero) — AC-D7. */
export function remainingText(remainingMinutes: number): string {
  const h = Math.floor(remainingMinutes / 60)
  const m = remainingMinutes % 60
  const parts: string[] = []
  if (h > 0) parts.push(`${h} ชม.`)
  if (m > 0 || parts.length === 0) parts.push(`${m} นาที`)
  return `เหลืออีก ${parts.join(' ')}`
}

/** D-6's relative badge — the daisyUI colour class AND the copy, from `dayOffset` + the first slot. */
export interface DayOffsetBadge {
  badgeClass: 'badge-error' | 'badge-warning' | 'badge-info' | 'badge-neutral'
  text: string
}

export function dayOffsetBadge(dayOffset: number, firstSlotStartAtIso: string): DayOffsetBadge {
  if (dayOffset < 0) {
    return { badgeClass: 'badge-error', text: `เลยวันใช้งานมาแล้ว ${-dayOffset} วัน` }
  }
  const time = thaiTime(firstSlotStartAtIso)
  if (dayOffset === 0) return { badgeClass: 'badge-warning', text: `ใช้งานวันนี้ ${time} น.` }
  if (dayOffset === 1) return { badgeClass: 'badge-warning', text: `ใช้งานพรุ่งนี้ ${time} น.` }
  if (dayOffset <= 7) return { badgeClass: 'badge-info', text: `ใช้งานอีก ${dayOffset} วัน` }
  return { badgeClass: 'badge-neutral', text: `ใช้งานอีก ${dayOffset} วัน` }
}

/** D-3's free-room headline, from the server's `freeWindow` + `freeUntil`. */
export function freeWindowHeadline(
  freeWindow: DashboardFreeWindow | null,
  freeUntil: string | null,
): string {
  switch (freeWindow) {
    case 'UNTIL_NEXT':
      return freeUntil ? `ว่างจนถึง ${thaiTime(freeUntil)} น.` : 'ว่าง'
    case 'ALL_DAY':
      return 'ว่างตลอดทั้งวัน'
    case 'AFTERNOON':
      return 'ว่างตลอดช่วงบ่าย'
    case 'REST_OF_DAY':
      return 'ว่างจนถึงสิ้นวัน'
    default:
      return 'ว่าง'
  }
}

/** AC-D8's "ถัดไป …" line, or the no-more-bookings fallback. */
export function nextSlotText(next: DashboardNextSlotDto | null): string {
  if (!next) return 'ไม่มีการจองต่อจากนี้ในวันนี้'
  return `ถัดไป ${thaiTime(next.startAt)} – ${thaiTime(next.endAt)} น. · ${next.purpose}`
}

/** AC-D11's meta line: capacity plus today's slot count, or the OFF/empty variants. */
export function roomMetaText(
  capacity: number,
  todaySlotCount: number,
  isOff: boolean,
): string {
  const tail = isOff
    ? 'ไม่รับจองชั่วคราว'
    : todaySlotCount > 0
      ? `จองวันนี้ ${todaySlotCount} ช่วง`
      : 'ไม่มีการจองวันนี้'
  return `ความจุ ${capacity.toLocaleString('th-TH')} คน · ${tail}`
}

/** Card 3's description (D-4/AC-D3). */
export function todayActivityDesc(inUseNow: number): string {
  return inUseNow > 0 ? `กำลังใช้งานอยู่ ${inUseNow} ห้อง` : 'ขณะนี้ไม่มีห้องที่กำลังใช้งาน'
}

/** The room grid's subtitle — D-3's in-hours vs. off-hours copy. */
export function roomsSubtitle(withinOperatingHours: boolean, serverTimeIso: string): string {
  const at = `เวลา ${thaiTime(serverTimeIso)} น.`
  return withinOperatingHours
    ? `สถานะ ณ ${at} · อัปเดตทุก 1 นาที`
    : `นอกเวลาทำการ · สถานะ ณ ${at}`
}
