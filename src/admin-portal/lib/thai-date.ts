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
