/**
 * `วัน-เวลาใช้งาน` — one booking's slot array collapsed into the two lines a table row can hold.
 *
 * ⚠️ IT SUMMARISES, AND THAT IS THE POINT (prototype, `spanText`). One request is ONE row however
 * many days it spans: a twelve-day booking enumerated in its own cell would be a twelve-line row,
 * and the fixed 92px row height is what makes the whole table scannable. The per-slot truth — which
 * Wednesday was dropped, and why — belongs to `#rq-detail-modal`, which is where the decision is
 * actually taken.
 *
 * ⚠️ THE THIRD SHAPE HAS TO SAY `ไม่ต่อเนื่อง` OUT LOUD, or a weekly meeting on the 8th, 15th and
 * 22nd reads as a two-week block booking of the same room. That is the one line of copy in this
 * file that is load-bearing rather than cosmetic.
 *
 * ⚠️ CANCELLED SLOTS ARE INCLUDED, and this is the one place the real schema and the prototype's
 * model differ. There, cancelling part of a booking SPLIT the record, so a row's `slots` only ever
 * held live spans; here `AdminBookingSlotDto.isCancelled` keeps them on the same request, because
 * the detail dialog has to be able to show that Wednesday was dropped. Summarising only the
 * survivors would make this cell read `—` for every row on the ยกเลิก tab — a column of dashes on a
 * tab whose whole content is cancelled bookings — and would answer a question the row is not being
 * asked. The cell answers "which days is this request about"; the dialog answers "which of them
 * survived".
 */

import {
  dayNumber,
  thaiDateShort,
  thaiMonthYearShort,
  thaiTime,
  NO_VALUE,
} from '../../lib/thai-date'

/** Only the two fields these functions read, so a caller may pass a list item or a detail slot. */
export interface SlotSpan {
  startAt: string
  endAt: string
}

/**
 * The distinct calendar days a booking touches, ascending, as `{ key, startAt }` pairs.
 *
 * Keyed by `dayNumber` — the LOCAL calendar day, computed once — rather than by the raw timestamp:
 * two slots on the same day at different hours are ONE day, and that is the whole question this
 * answers. A slot whose timestamp will not parse is dropped rather than sorted as `NaN`.
 */
function distinctDays(slots: readonly SlotSpan[]): { n: number; at: string }[] {
  const seen = new Map<number, string>()
  for (const s of slots) {
    const n = dayNumber(s.startAt)
    if (n === null || seen.has(n)) continue
    seen.set(n, s.startAt)
  }
  return [...seen.entries()]
    .map(([n, at]) => ({ n, at }))
    .sort((a, b) => a.n - b.n)
}

/**
 * `10 ก.ย. 69` · `10–12 ก.ย. 69 (3 วัน)` · `8 ก.ย. – 22 ก.ย. 69 (3 วัน, ไม่ต่อเนื่อง)`
 *
 * The middle shape prints the month and year ONCE when the run stays inside one month —
 * "10 ก.ย. 69–12 ก.ย. 69" is the same fact spelled twice in the widest cell of the row.
 */
export function spanSummary(slots: readonly SlotSpan[]): string {
  const days = distinctDays(slots)
  if (days.length === 0) return NO_VALUE
  if (days.length === 1) return thaiDateShort(days[0]!.at)

  const first = days[0]!
  const last = days[days.length - 1]!
  // A RUN is "as many calendar days between the ends as there are days in the list". Comparing
  // count to span is what distinguishes 10/11/12 from 8/15/22 without walking the list again.
  const contiguous = last.n - first.n + 1 === days.length

  if (!contiguous) {
    return `${thaiDateShort(first.at)} – ${thaiDateShort(last.at)} (${days.length} วัน, ไม่ต่อเนื่อง)`
  }

  const a = new Date(first.at)
  const b = new Date(last.at)
  const sameMonth = a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
  if (sameMonth) {
    return `${a.getDate()}–${b.getDate()} ${thaiMonthYearShort(first.at)} (${days.length} วัน)`
  }
  return `${thaiDateShort(first.at)}–${thaiDateShort(last.at)} (${days.length} วัน)`
}

/**
 * `08:30–12:00 น.` when every slot shares one range, otherwise `เวลาต่างกันในแต่ละวัน`.
 *
 * ⚠️ NEVER `slots[0]`'s hours alone. That is a summary that is WRONG rather than short: a booking
 * that runs 08:00–12:00 on Monday and 13:00–16:00 on Tuesday would advertise the morning and hide
 * the afternoon, and nothing downstream would contradict it.
 */
export function timeSummary(slots: readonly SlotSpan[]): string {
  const first = slots[0]
  if (!first) return NO_VALUE
  const start = thaiTime(first.startAt)
  const end = thaiTime(first.endAt)
  const uniform = slots.every(
    (s) => thaiTime(s.startAt) === start && thaiTime(s.endAt) === end,
  )
  return uniform ? `${start}–${end} น.` : 'เวลาต่างกันในแต่ละวัน'
}
