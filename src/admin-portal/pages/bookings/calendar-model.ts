/**
 * The pure half of `ปฏิทินการจอง`: Bangkok calendar dates, the month grid, the fetch window, the
 * tallies and clashes the page draws from one flat list of slots, and the day timeline's geometry
 * (rows, lanes, bar boxes) and words (clash, tooltip, accessible name).
 *
 * ⚠️ DATES ARE `YYYY-MM-DD` STRINGS, AND THE ARITHMETIC IS UTC. That is the prototype's own rule.
 * `Date.UTC` has no DST, so adding seven days always lands seven calendar days later, and two ISO
 * strings compare correctly with `<`. The strings name BANGKOK calendar days. The API sends `date`
 * that way already, so nothing here re-derives a day from an instant.
 *
 * ⚠️ "TODAY" IS BANGKOK'S, NOT THE BROWSER'S. The prototype's `todayIso()` read the local clock, which
 * is right only on a machine set to UTC+7. An operator's laptop on UTC would open the calendar on the
 * wrong day for the first seven hours of every Bangkok day. `bangkokToday` shifts the instant by +7
 * hours and reads its UTC parts. Thailand has no DST, so the offset is a constant.
 */

import { BOOKING_STATUS_LABEL } from '../../labels'
import type { CalendarBookingSlot, CalendarBookingStatus } from '@/lib/api-client'

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000

const TH_MONTHS_LONG = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
] as const

const TH_DAYS_LONG = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'] as const

/** The weekday row, Sunday first, the way a Thai wall calendar reads. */
export const TH_DAYS_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] as const

const pad = (n: number) => String(n).padStart(2, '0')

/** `YYYY-MM-DD` from parts. `m` is 0-based and may overflow either way, and `Date.UTC` normalises it. */
export function isoDay(y: number, m: number, d: number): string {
  const t = new Date(Date.UTC(y, m, d))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/** `m` comes back 0-based, to pair with `isoDay`. */
export function parseDay(day: string): { y: number; m: number; d: number } {
  const [y, m, d] = day.split('-').map(Number)
  return { y, m: m - 1, d }
}

/** 0 = Sunday. */
export function weekday(day: string): number {
  const p = parseDay(day)
  return new Date(Date.UTC(p.y, p.m, p.d)).getUTCDay()
}

export function addDays(day: string, n: number): string {
  const p = parseDay(day)
  return isoDay(p.y, p.m, p.d + n)
}

/** How many days month `m` (0-based) of `y` has. */
function monthLength(y: number, m: number): number {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
}

/** Today's Bangkok date. `now` is injectable so the boundary is checkable without a fake clock. */
export function bangkokToday(now: number = Date.now()): string {
  const t = new Date(now + BANGKOK_OFFSET_MS)
  return isoDay(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())
}

/** The instant 00:00 Bangkok begins `day`, as the `…Z` string the API expects. */
export function bangkokMidnight(day: string): string {
  const p = parseDay(day)
  return new Date(Date.UTC(p.y, p.m, p.d) - BANGKOK_OFFSET_MS).toISOString()
}

/** `วันศุกร์ที่ 18 กันยายน 2569`. The agenda heading, the live region and every cell's name. */
export function thaiDayLong(day: string): string {
  const p = parseDay(day)
  return `วัน${TH_DAYS_LONG[weekday(day)]}ที่ ${p.d} ${TH_MONTHS_LONG[p.m]} ${p.y + 543}`
}

/** `กันยายน 2569`. The month card's label. */
export function thaiMonthLong(y: number, m: number): string {
  return `${TH_MONTHS_LONG[m]} ${y + 543}`
}

export interface MonthView {
  y: number
  /** 0-based. */
  m: number
}

export function monthOf(day: string): MonthView {
  const p = parseDay(day)
  return { y: p.y, m: p.m }
}

/** `‹` / `›`: the month `n` away, across year ends. */
export function shiftMonth(view: MonthView, n: number): MonthView {
  return monthOf(isoDay(view.y, view.m + n, 1))
}

/**
 * PageUp / PageDown: the same day number a month away, clamped to that month's length. 31 ม.ค. goes
 * to 28 or 29 ก.พ., never to 3 มี.ค.
 */
export function shiftMonthClamped(day: string, n: number): string {
  const p = parseDay(day)
  const target = monthOf(isoDay(p.y, p.m + n, 1))
  return isoDay(target.y, target.m, Math.min(p.d, monthLength(target.y, target.m)))
}

export interface MonthGrid {
  /** The 1st of the viewed month. */
  first: string
  /** The first cell (a Sunday, possibly last month's) and the last cell (a Saturday). */
  start: string
  last: string
  cells: string[]
}

/**
 * The cells the grid draws: whole weeks from the Sunday on or before the 1st, and AS MANY WEEKS AS
 * THE MONTH NEEDS (4–6), not a fixed six. A trailing row of next month's days is a row the operator
 * scrolls past for nothing (prototype, #ISSUE-05).
 */
export function monthGrid(view: MonthView): MonthGrid {
  const first = isoDay(view.y, view.m, 1)
  const lead = weekday(first)
  const start = addDays(first, -lead)
  const count = Math.ceil((lead + monthLength(view.y, view.m)) / 7) * 7
  const cells = Array.from({ length: count }, (_, i) => addDays(start, i))
  return { first, start, last: cells[count - 1], cells }
}

export interface DayWindow {
  /** Identifies the window, so a response for a previous one is recognisable as stale. */
  key: string
  from: string
  to: string
}

/**
 * `[00:00 Bangkok on firstDay, 00:00 Bangkok on the day after lastDay)`. This is the half-open window
 * the endpoint reads, and it covers every cell from `firstDay` to `lastDay` in full.
 */
export function dayWindow(firstDay: string, lastDay: string): DayWindow {
  return {
    key: `${firstDay}/${lastDay}`,
    from: bangkokMidnight(firstDay),
    to: bangkokMidnight(addDays(lastDay, 1)),
  }
}

export interface Tally {
  approved: number
  pending: number
}

export function tally(list: readonly CalendarBookingSlot[]): Tally {
  const t: Tally = { approved: 0, pending: 0 }
  for (const s of list) {
    if (s.status === 'APPROVED') t.approved++
    else t.pending++
  }
  return t
}

/**
 * Slots grouped by their Bangkok `date`, in the order the server sent them (`startAt`, then APPROVED
 * before PENDING, then `code`). Grouping keeps that order, so nothing here re-sorts.
 */
export function byDate(list: readonly CalendarBookingSlot[]): Map<string, CalendarBookingSlot[]> {
  const m = new Map<string, CalendarBookingSlot[]>()
  for (const s of list) {
    const day = m.get(s.date)
    if (day) day.push(s)
    else m.set(s.date, [s])
  }
  return m
}

/** The page's two filters. `''` is "off" for both. */
export interface CalendarFilter {
  venueId: string
  status: '' | CalendarBookingStatus
}

export function matchesFilter(slot: CalendarBookingSlot, f: CalendarFilter): boolean {
  return (!f.venueId || slot.venueId === f.venueId) && (!f.status || slot.status === f.status)
}

/**
 * The other slots that hold `slot`'s room at the same time: a DIFFERENT request, the same venue and
 * the same `date`, with a half-open overlap. An end at 12:00 and a start at 12:00 do not clash.
 *
 * ⚠️ `pool` MUST BE UNFILTERED. A clash is a fact about the room. Hiding the approved booking with the
 * status filter does not make the pending request beside it any less of a conflict. That is the
 * prototype's `entries().all`, and it is why the page never sends `status` to the server.
 *
 * ⚠️ IT COMPARES INSTANTS, NOT `HH:mm`. `24:00` sorts correctly as a string, but a slot that crossed
 * midnight (`22:00`–`02:00`, not creatable today, handled defensively) would not. The same-`date`
 * test keeps a slot ending at `24:00` from clashing with one starting at `00:00` the next day, and
 * the half-open instants would keep them apart anyway.
 */
export function clashesOf(
  slot: CalendarBookingSlot,
  pool: readonly CalendarBookingSlot[],
): CalendarBookingSlot[] {
  const start = Date.parse(slot.startAt)
  const end = Date.parse(slot.endAt)
  return pool.filter(
    (o) =>
      o.bookingRequestId !== slot.bookingRequestId &&
      o.venueId === slot.venueId &&
      o.date === slot.date &&
      Date.parse(o.startAt) < end &&
      start < Date.parse(o.endAt),
  )
}

/**
 * What a slot's clash warning says, or `null` for no warning. ONE helper for the agenda card and
 * the timeline bar, so the two views never word one clash two ways (prototype `clashText`).
 *
 * 🔴 AN APPROVED SLOT IS NEVER FLAGGED (PO). An approval is authoritative, and requests filed against
 * it do not put it in doubt. So `APPROVED` returns `null` whatever `clashes` holds: no banner, no red
 * ring, no chip, no red bubble, no clash text in the accessible name. Only a PENDING request is
 * flagged. It is "blocked by" an approval when any overlap is approved, and otherwise overlaps other
 * requests.
 *
 * `clashes` is `clashesOf(slot, pool)` over the UNFILTERED day (see there).
 */
export function clashLabel(
  slot: CalendarBookingSlot,
  clashes: readonly CalendarBookingSlot[],
): string | null {
  if (slot.status === 'APPROVED' || clashes.length === 0) return null
  return clashes.some((o) => o.status === 'APPROVED')
    ? 'ช่วงเวลาทับซ้อนกับการจองที่อนุมัติแล้ว'
    : `ช่วงเวลาทับซ้อนกับคำขออื่น ${clashes.length} รายการ`
}

/* ── The day timeline (prototype `paintTimeline`, `venueRow`, `bar`) ─────────────────────────────── */

/** One hour of track, in px. The whole day is `24 * HOUR_WIDTH` = 1680px. */
export const HOUR_WIDTH = 70
/** px. A 15-minute booking is still a tap target. */
export const BAR_MIN = 44
/** px. From here a bar has room for `start–end · purpose`. Below it, `start` alone. */
export const BAR_WIDE = 110
/** One lane is a 32px bar, lanes are 8px apart, and a row keeps 12px above the first and below the last. */
export const LANE_H = 32
export const LANE_GAP = 8
export const ROW_PAD = 12
/**
 * The initial `scrollLeft`: 08:00, with 20px of 07:xx showing (prototype `LAND_AT`, `8 * 70 - 20`).
 * The school day starts there, and midnight to 07:00 is almost always empty.
 */
export const LAND_AT = 8 * HOUR_WIDTH - 20

/** Minutes since midnight from `HH:mm`. `24:00` is 1440, the end of the day. */
export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/**
 * A slot's `[start, end)` on its own day, in minutes.
 *
 * ⚠️ AN END AT OR BEFORE THE START IS CLIPPED TO 24:00. The server lists a slot on its START date only,
 * and a slot that crosses midnight (`22:00`–`02:00`, not creatable today, handled defensively) sends
 * its Bangkok wall-clock end. Taken literally it would draw a negative width. The rest of it belongs to
 * the next day, which does not list it.
 */
export function slotMinutes(slot: Pick<CalendarBookingSlot, 'start' | 'end'>): {
  start: number
  end: number
} {
  const start = minutesOf(slot.start)
  const end = minutesOf(slot.end)
  return { start, end: end > start ? end : 24 * 60 }
}

/** Where a bar is drawn on its track, in px: `left = start / 60 * 70`, `width = max(44, duration / 60 * 70)`. */
export function barBox(start: number, end: number): { left: number; width: number } {
  return {
    left: (start / 60) * HOUR_WIDTH,
    width: Math.max(BAR_MIN, ((end - start) / 60) * HOUR_WIDTH),
  }
}

export interface PlacedSlot {
  slot: CalendarBookingSlot
  /** Minutes, see `slotMinutes`. */
  start: number
  end: number
  /** 0-based. */
  lane: number
}

/**
 * Greedy lanes: each bar takes the first lane that is free by its start, in the order given (the
 * server's: `startAt`, then APPROVED before PENDING, then `code`).
 *
 * ⚠️ A LANE IS FREED AT THE BAR'S DRAWN END, NOT ITS BOOKED END. A 15-minute booking is drawn 44px
 * (≈38 minutes) wide, and the booking after it must not be drawn on top of it.
 */
export function packLanes(slots: readonly CalendarBookingSlot[]): {
  placed: PlacedSlot[]
  lanes: number
} {
  const drawnMin = (BAR_MIN / HOUR_WIDTH) * 60
  const laneEnd: number[] = []
  const placed = slots.map((slot) => {
    const { start, end } = slotMinutes(slot)
    let lane = 0
    while (lane < laneEnd.length && laneEnd[lane] > start) lane++
    laneEnd[lane] = start + Math.max(end - start, drawnMin)
    return { slot, start, end, lane }
  })
  return { placed, lanes: Math.max(1, laneEnd.length) }
}

/** A row's height, in px: 56 with one lane, 96 with two, 136 with three. The row grows; bars never overlap. */
export function rowHeight(lanes: number): number {
  return ROW_PAD * 2 + lanes * LANE_H + (lanes - 1) * LANE_GAP
}

/** The px `top` of a bar in `lane`, inside its row. */
export function laneTop(lane: number): number {
  return ROW_PAD + lane * (LANE_H + LANE_GAP)
}

export interface TimelineRow {
  venueId: string
  name: string
  slots: CalendarBookingSlot[]
}

/** What the timeline calls a venue it cannot name. The prototype's words. */
export const UNKNOWN_VENUE = 'ไม่พบสถานที่'

/**
 * The timeline's rows: ONLY the venues with a shown slot today, in the venue list's order (PO: a
 * school with 15–20 rooms and 2–3 in use should not scroll past empty rows). Then one trailing row
 * per venue that has a slot but is not in the list, so a booking never vanishes. A day with no shown
 * slot yields `[]`, and the page shows its empty state instead of a timeline.
 *
 * ⚠️ A TRAILING ROW IS NAMED BY THE SLOT'S OWN `venueName`, and `ไม่พบสถานที่` only when that is empty.
 * The prototype names every such row `ไม่พบสถานที่` because its records carried no name. Here the server
 * sends one with every slot and never sends a slot on a deleted venue. So a slot missing from the list
 * means the list failed to load, or a venue was created after it loaded, and calling that room "not
 * found" would be false. Rows are keyed by `venueId` either way, as in the prototype. Two unknown
 * rooms are never merged into one row, whose lanes would then read as a clash.
 *
 * `slots` is the day's SHOWN slots (both filters applied), in server order.
 */
export function timelineRows(
  venues: readonly { id: string; name: string }[] | null,
  slots: readonly CalendarBookingSlot[],
  venueId: string,
): TimelineRow[] {
  const rows: TimelineRow[] = []
  const byVenue = new Map<string, TimelineRow>()
  for (const v of venues ?? []) {
    if (venueId && v.id !== venueId) continue
    const row: TimelineRow = { venueId: v.id, name: v.name, slots: [] }
    rows.push(row)
    byVenue.set(v.id, row)
  }
  for (const s of slots) {
    let row = byVenue.get(s.venueId)
    if (!row) {
      row = { venueId: s.venueId, name: s.venueName || UNKNOWN_VENUE, slots: [] }
      rows.push(row)
      byVenue.set(s.venueId, row)
    }
    row.slots.push(s)
  }
  return rows.filter((r) => r.slots.length > 0)
}

/**
 * A bar's tooltip (`data-tip`): the whole booking, because the visible text is cut to fit the bar.
 * `⚠️ clash · ` leads when there is one. `(requester)` is dropped when there is none, rather than
 * printing `()`. `venueName` is the ROW's name, so the bubble names the room its row does.
 */
export function barTip(slot: CalendarBookingSlot, venueName: string, clash: string | null): string {
  return (
    (clash ? `⚠️ ${clash} · ` : '') +
    `🕒 ${slot.start}–${slot.end} น. · ${venueName} · ${slot.purpose}` +
    (slot.requesterName ? ` (${slot.requesterName})` : '') +
    ` · ${BOOKING_STATUS_LABEL[slot.status]}`
  )
}

/**
 * A bar's accessible name. It starts like the agenda card's chevron (`ดูรายละเอียด <code>[ ช่วงที่ n
 * จาก m]`), since both open the same record. It then carries everything the tooltip does, because a
 * screen reader never sees the tooltip. No requester means no requester segment, not a `—` read aloud.
 */
export function barLabel(slot: CalendarBookingSlot, venueName: string, clash: string | null): string {
  return (
    `ดูรายละเอียด ${slot.code}` +
    (slot.slotCount > 1 ? ` ช่วงที่ ${slot.slotIndex} จาก ${slot.slotCount}` : '') +
    ` · ${slot.start}–${slot.end} น. · ${venueName} · ${slot.purpose}` +
    (slot.requesterName ? ` · ${slot.requesterName}` : '') +
    ` · ${BOOKING_STATUS_LABEL[slot.status]}` +
    (clash ? ` · ${clash}` : '')
  )
}
