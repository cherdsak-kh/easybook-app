/**
 * The clock and the calendar behind `สร้างคำจองสถานที่` — everything that turns four selects and a
 * pair of date fields into the `slots[]` the contract takes.
 *
 * It is a `.ts` beside `booking-summary.ts` and `booking-detail.ts` for the same reason those two
 * are split: one module answers one question. `booking-summary` collapses a saved slot array into a
 * table cell, `booking-detail` introduces a saved record inside a dialog, and this one BUILDS spans
 * that do not exist yet. Nothing here reads a `BookingRequest`.
 *
 * ── 🔴 THE CLOCK IS FOUR SELECTS, AND `type="time"` IS DELIBERATELY ABSENT ──
 * A native time input renders in the BROWSER's locale, not the page's. On a Thai school's Windows
 * machine set to en-US that is a 12-hour field with an AM/PM segment, and `8:30 PM` typed for a
 * morning assembly is a booking eleven and a half hours out that no validation can catch — because
 * it is a perfectly well-formed time. Thailand writes a 24-hour clock; these options cannot express
 * anything else.
 *
 * ⚠️ HOURS RUN `00`–`24`, NOT `00`–`23`. `24:00` is how "to the end of the day" is written and it is
 * the one value the upper bound needs that a 23-hour list cannot say. It is legal ONLY on the hour —
 * see `pinsMinutes`, which is why the form can never offer `24:30`, a time that sorts after midnight
 * and means nothing downstream.
 *
 * ⚠️ MINUTES RUN `00`–`59`, ONE AT A TIME (`MIN_STEP = 1`), which DIVERGES from the prototype's
 * `MIN_STEP = 5` on the Stage C brief's explicit instruction. The prototype anticipated exactly this
 * change and left the step as a single constant so tightening it would be a one-line edit; this is
 * that edit, and the hint under the fields no longer promises five-minute steps.
 *
 * ── 🔴 STRING COMPARISON IS TIME COMPARISON HERE ──
 * `HH:MM` is zero-padded and fixed width, so lexicographic order IS chronological order, and `24:00`
 * sorts above `23:59` exactly as it should. Nothing in this file parses a clock value into a number
 * to compare it.
 */

import { thaiDate } from '../../lib/thai-date'
import type { BookingSlotInput } from '@/lib/api-client'

/** The minute granularity the four selects offer. See the file header for why it is 1 and not 5. */
export const MIN_STEP = 1

/**
 * `BOOKING_SLOTS_MAX` on the server. One slot is one day, so this is also the longest span the form
 * may build.
 *
 * ⚠️ IT REPLACES THE PROTOTYPE'S 92-DAY CEILING, and that is a bug fix rather than a preference: a
 * 92-day span is 92 slots, and the server's `@ArrayMaxSize(60)` answers 400 to every one of them. A
 * form whose own limit is looser than the contract's is a form that lets an operator finish typing
 * before it refuses them.
 */
export const SLOTS_MAX = 60

/**
 * The multi-date list's own ceiling, and it is the PROTOTYPE's (a month of dates), not the
 * contract's. It is under `SLOTS_MAX`, so it never reaches the server's refusal — it exists because
 * "every Friday this term" is a different shape from "sixty scattered days", and the second one is a
 * form somebody has mis-clicked.
 */
export const MULTI_DAYS_MAX = 31

const pad2 = (n: number) => String(n).padStart(2, '0')

/** `'00' … '24'`. Twenty-five options, and the last one is a boundary rather than an hour. */
export const HOUR_OPTIONS: readonly string[] = Array.from({ length: 25 }, (_, h) => pad2(h))

/** `'00' … '59'`. */
export const MINUTE_OPTIONS: readonly string[] = Array.from(
  { length: Math.ceil(60 / MIN_STEP) },
  (_, i) => pad2(i * MIN_STEP),
)

/**
 * Does this hour pin the minutes to `00`?
 *
 * `24` is a boundary, not an hour: the caller disables the minute select and shows a visible `00`,
 * rather than leaving it live and rejecting the result later. A disabled control that reads `00`
 * says WHY it cannot be changed; an enabled one that silently refuses to save does not.
 */
export const pinsMinutes = (hour: string) => hour === '24'

/** `HH:MM` from the two halves, with `24` already collapsed to `24:00`. */
export function clockValue(hour: string, minute: string): string {
  return `${hour}:${pinsMinutes(hour) ? '00' : minute}`
}

/* ── The calendar half ──────────────────────────────────────────────────────────────────────────
   Everything below speaks `YYYY-MM-DD`, which is what `<input type="date">` reads and writes, and
   ⚠️ NEVER an ISO instant. `new Date('2026-09-10')` parses as UTC MIDNIGHT — west of Greenwich that
   is the 9th, and the whole form would be a day out on machines nobody here would think to test. */

/** Today, in the operator's own timezone. */
export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** `YYYY-MM-DD` + n days, through a LOCAL `Date` so month and year ends carry correctly. */
export function plusDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const at = new Date(y, m - 1, d + n)
  return `${at.getFullYear()}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())}`
}

/** How many days a span covers, both ends included. `10 → 12` is 3. */
export function dayCount(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number)
  const [ty, tm, td] = toIso.split('-').map(Number)
  // UTC arithmetic on LOCAL parts — the same pairing `dayNumber` documents: building two local
  // midnights and subtracting puts a DST transition between them and returns 0.958 days.
  const a = Date.UTC(fy, fm - 1, fd)
  const b = Date.UTC(ty, tm - 1, td)
  return Math.round((b - a) / 86_400_000) + 1
}

/**
 * `10 ก.ย. 2569` from a `YYYY-MM-DD`.
 *
 * ⚠️ IT BUILDS A LOCAL `Date` AND HANDS IT TO `thaiDate`, rather than growing a second month table.
 * `มี.ค.` must have exactly one spelling in this app, and two tables is how it gets two.
 */
export function thaiDayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return thaiDate(new Date(y, m - 1, d))
}

/** One local wall-clock moment as the ISO instant the contract takes. Hour `24` rolls to the next
 *  day's `00:00`, which is exactly what "to the end of the day" means. */
function instantOf(dayIso: string, hour: string, minute: string): string {
  const [y, m, d] = dayIso.split('-').map(Number)
  return new Date(y, m - 1, d, Number(hour), Number(minute), 0, 0).toISOString()
}

export interface WhenState {
  mode: 'span' | 'multi'
  from: string
  to: string
  /** Sorted `YYYY-MM-DD` list, multi mode only. */
  days: readonly string[]
  startH: string
  startM: string
  endH: string
  endM: string
}

/** The dates the form currently describes, or `[]` when the answer would be a guess. */
function datesOf(when: WhenState): string[] {
  if (when.mode === 'multi') return [...when.days]
  if (!when.from || !when.to) return []
  if (when.to < when.from) return []
  const n = dayCount(when.from, when.to)
  // The `whenError` message refuses this properly; this only has to stop the loop, because a range
  // typed as 1 ม.ค. → 31 ธ.ค. is 365 iterations and a hung tab.
  if (n > SLOTS_MAX) return []
  return Array.from({ length: n }, (_, i) => plusDaysIso(when.from, i))
}

/**
 * The spans this form currently describes.
 *
 * ⚠️ IT RETURNS `[]` WHENEVER THE ANSWER WOULD BE A GUESS. An incomplete form must not resolve to
 * "no conflicts" — the banner says "not enough filled in to check yet" instead, which is a different
 * claim from "these hours are free".
 *
 * ⚠️ ONE TIME RANGE ACROSS EVERY DAY, in both modes. A per-day time is a real requirement and it is
 * deliberately NOT in this form: it turns a six-field dialog into a table editor, and an operator
 * who needs it can raise two bookings. Weighed, not missed.
 */
export function buildSlots(when: WhenState): BookingSlotInput[] {
  const start = clockValue(when.startH, when.startM)
  const end = clockValue(when.endH, when.endM)
  if (start >= end) return []
  return datesOf(when).map((day) => ({
    startAt: instantOf(day, when.startH, pinsMinutes(when.startH) ? '00' : when.startM),
    endAt: instantOf(day, when.endH, pinsMinutes(when.endH) ? '00' : when.endM),
  }))
}

/**
 * The one message วัน-เวลา is allowed to show, or `''`.
 *
 * ⚠️ IT NAMES WHICH CONTROL IS WRONG. This is one error slot over two dates, four selects and a
 * mode, so "ตรวจสอบวันและเวลา" would be true and useless. The order is the order the answers are
 * useful in: the clock first, because it is wrong in both modes, then whichever date shape is on.
 */
export function whenError(when: WhenState): string {
  if (clockValue(when.startH, when.startM) >= clockValue(when.endH, when.endM)) {
    return 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม (นาฬิกา 24 ชั่วโมง)'
  }
  if (when.mode === 'span') {
    if (!when.from || !when.to) return 'ระบุวันเริ่มต้นและวันสิ้นสุด'
    if (when.to < when.from) return 'วันสิ้นสุดต้องไม่อยู่ก่อนวันเริ่มต้น'
    if (dayCount(when.from, when.to) > SLOTS_MAX) {
      return `ช่วงวันยาวเกินไป — จองได้ครั้งละไม่เกิน ${SLOTS_MAX} วัน`
    }
    return ''
  }
  if (when.days.length === 0) return 'เพิ่มอย่างน้อยหนึ่งวัน'
  return ''
}
