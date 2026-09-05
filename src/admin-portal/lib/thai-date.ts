/**
 * Dates in the words the school reads: `8 ก.ค. 2569`, Buddhist year, abbreviated month.
 *
 * ⚠️ HAND-ROLLED RATHER THAN `Intl.DateTimeFormat('th-TH')`, and the reason is the year. `th-TH`'s
 * output varies by engine and by ICU build, and a fallback to an `en-US` locale emits a GREGORIAN
 * year — silently, and looking perfectly formatted. On a profile page that is a joining date two
 * digits wrong; in the version screen's diagnostic block it is the one number in a support ticket
 * that must not be ambiguous.
 *
 * It lives in its own module because two screens now print dates. Left where it started —
 * `lib/version.ts` — the profile page would either import from a module about version numbers or
 * grow its own month table, and two month tables is how `มี.ค.` ends up spelled two ways.
 *
 * Both functions take what the API actually hands over (an ISO string, sometimes `null`) as well as
 * a `Date`, and answer `—` for anything unusable. `lastLoginAt` is nullable for an account that has
 * never signed in, and "nobody has" is a fact worth printing; an empty cell reads as a bug.
 */

const TH_MONTHS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
] as const

const two = (n: number) => String(n).padStart(2, '0')

/** What every caller gets for `null`, an empty string, or an unparseable date. */
export const NO_VALUE = '—'

function parse(value: Date | string | null | undefined): Date | null {
  if (value == null || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** `8 ก.ค. 2569` */
export function thaiDate(value: Date | string | null | undefined): string {
  const d = parse(value)
  if (!d) return NO_VALUE
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
}

/** `8 ก.ค. 2569 10:00` — 24-hour, because a school timetable is written that way. */
export function thaiDateTime(value: Date | string | null | undefined): string {
  const d = parse(value)
  if (!d) return NO_VALUE
  return `${thaiDate(d)} ${two(d.getHours())}:${two(d.getMinutes())}`
}

/**
 * `10 ก.ย. 69` — the same date with a TWO-DIGIT Buddhist year.
 *
 * ⚠️ IT EXISTS FOR ONE COLUMN, and the reason is width rather than taste. คำขอจองสถานที่'s
 * `วัน-เวลาใช้งาน` cell can hold a RANGE (`8 ก.ย. – 22 ก.ย. 69 (3 วัน, ไม่ต่อเนื่อง)`), which
 * prints the year twice; at four digits that cell was the widest in an eight-column table already
 * measured 196px over its card. Two digits are unambiguous in a school calendar that never reaches
 * back a century.
 *
 * ⚠️ `.slice(-2)` on the BE year, never `% 100`: they agree for 2569 and disagree for any year
 * under 100, where `%` yields a bare digit and the slice yields the string the eye expects.
 */
export function thaiDateShort(value: Date | string | null | undefined): string {
  const d = parse(value)
  if (!d) return NO_VALUE
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${String(d.getFullYear() + 543).slice(-2)}`
}

/**
 * `ก.ย. 69` — the tail of `thaiDateShort`, for a same-month range that prints the month once
 * (`10–12 ก.ย. 69`). Spelling it out on both ends is the same fact written twice in the widest
 * cell of the table.
 */
export function thaiMonthYearShort(value: Date | string | null | undefined): string {
  const d = parse(value)
  if (!d) return NO_VALUE
  return `${TH_MONTHS[d.getMonth()]} ${String(d.getFullYear() + 543).slice(-2)}`
}

/** `08:30` — 24-hour, zero-padded, no date. The clock half of `thaiDateTime`, on its own. */
export function thaiTime(value: Date | string | null | undefined): string {
  const d = parse(value)
  if (!d) return NO_VALUE
  return `${two(d.getHours())}:${two(d.getMinutes())}`
}

/**
 * Which calendar day a timestamp falls on, as an integer, so "are these two days adjacent" is a
 * subtraction.
 *
 * ⚠️ LOCAL PARTS, ASSEMBLED WITH `Date.UTC`. The parts have to be local — the API sends UTC and
 * the school reads Bangkok time, so a 20:00 slot is the same day as its 08:00 one only in local
 * terms. The ARITHMETIC has to be UTC — building `new Date(y, m, d)` twice and subtracting puts a
 * DST transition between two midnights and returns 0.958 days, which rounds a run of dates into a
 * gap. Both halves are needed and neither is interchangeable.
 *
 * Returns `null` for anything unparseable, so a caller cannot silently compare against `NaN`.
 */
export function dayNumber(value: Date | string | null | undefined): number | null {
  const d = parse(value)
  if (!d) return null
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000)
}
