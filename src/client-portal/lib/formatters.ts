/**
 * Thai date and time formatting for the client portal.
 *
 * Ported from `client_portal_prototype.html` lines 3478–3526, 4483 and 5121–5127.
 *
 * ── Buddhist Era, everywhere, with no exceptions ──
 * Every year printed by this module is `getFullYear() + 543`. The whole portal is in Thai and
 * its readers are teachers in a Thai state school; a Gregorian year in a Thai sentence reads
 * as a bug, not as a locale preference. There is no CE code path and none should be added.
 *
 * ── Why hand-written and not `Intl.DateTimeFormat('th-TH-u-ca-buddhist')` ──
 * Intl gets the era right but not the SHAPE: the prototype's abbreviations (`ม.ค.` with the
 * full stops, `จ`/`อ`/`พ` as single characters for the calendar header) and the 24:00 rule
 * below are ours, and every screenshot the PO reviewed was measured against these strings.
 * Swapping in Intl would move the text under the layout without anything failing.
 *
 * ── These are pure functions and may be unit-tested ──
 * `CONVENTIONS.md` §2 forbids specs for React COMPONENTS. A spec for a function in this file is
 * explicitly "not forbidden, but not required" — if one is ever written it must test the
 * function, never the rendering.
 */

/** Abbreviated Thai months, for `fmtD` / `fmtDShort`. Index = `Date#getMonth()`. */
export const TH_MON = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
] as const

/** Single-character Thai weekdays, for calendar column headers. Index = `Date#getDay()`. */
export const TH_DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] as const

/** Full Thai weekday names, for the `fmtDLong` greeting line. Index = `Date#getDay()`. */
export const TH_DOW_FULL = [
  'อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์',
] as const

/** Full Thai month names, for `fmtDLong`. Index = `Date#getMonth()`. */
export const TH_MON_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
] as const

/** Zero-pad to two digits. The prototype's `two()`. */
function two(n: number): string {
  return (n < 10 ? '0' : '') + n
}

/** Local midnight at the start of `dt`'s day. Not exported as a formatter — `fmtSlot` needs it. */
export function midnight(dt: Date): Date {
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
}

/** `2 ก.ย. 2569` — the default date form. */
export function fmtD(dt: Date): string {
  return `${dt.getDate()} ${TH_MON[dt.getMonth()]} ${dt.getFullYear() + 543}`
}

/** `2 ก.ย.` — no year, for the two halves of a cross-midnight range. */
export function fmtDShort(dt: Date): string {
  return `${dt.getDate()} ${TH_MON[dt.getMonth()]}`
}

/** `08:30` — a START time, or a timestamp. */
export function fmtT(dt: Date): string {
  return `${two(dt.getHours())}:${two(dt.getMinutes())}`
}

/**
 * `08:30`, but exactly midnight becomes `24:00`.
 *
 * ⚠️ END TIMES HAVE THEIR OWN FORMATTER, and this is the whole reason. Midnight *as an ending*
 * is `24:00` of the day that just finished, not `00:00` of the new one. Slots that end at
 * midnight are already folded back onto the previous day for display, but printing `00:00`
 * there yields `08:00–00:00`, which reads either as a zero-length span or as an end that comes
 * before its start.
 *
 * ⚠️ END POSITIONS ONLY. `fmtT` stays correct for start times and for stamped moments (the
 * instant a cancellation was made, say), where midnight really does mean `00:00`.
 */
export function fmtTe(dt: Date): string {
  return dt.getHours() === 0 && dt.getMinutes() === 0 ? '24:00' : fmtT(dt)
}

/**
 * One booking slot as a single line.
 *
 * Same-day:   `2 ก.ย. 2569 · 08:00–12:00`
 * Cross-day:  `2 ก.ย. 22:00 → 3 ก.ย. 02:00`
 *
 * ⚠️ A span ending exactly at midnight belongs to the PREVIOUS day, or `08:00–24:00` would be
 * printed as if it ran into the next one. The cross-day branch uses that same folded-back day
 * as the date it prints, too — otherwise a span ending at midnight renders as `3 ก.ย. 24:00`,
 * a date-and-time pair that does not exist.
 *
 * Takes two `Date`s rather than a slot object on purpose: this module is domain-free, and the
 * shape of a booking slot is the API's business, not this file's.
 */
export function fmtSlot(start: Date, end: Date): string {
  const endDay = midnight(new Date(end.getTime() - 1))
  return midnight(start).getTime() === endDay.getTime()
    ? `${fmtD(start)} · ${fmtT(start)}–${fmtTe(end)}`
    : `${fmtDShort(start)} ${fmtT(start)} → ${fmtDShort(endDay)} ${fmtTe(end)}`
}

/**
 * `วันพุธที่ 2 กันยายน 2569` — full words, for the one-line greeting on `#/home`.
 *
 * ⚠️ Deliberately NOT the abbreviated form. Abbreviations belong in tables, cards and list rows,
 * which are scanned; this sits in a greeting sentence that is read word by word, and an
 * abbreviation there reads as system output rather than as a greeting.
 */
export function fmtDLong(dt: Date): string {
  return `วัน${TH_DOW_FULL[dt.getDay()]}ที่ ${dt.getDate()} ${TH_MON_FULL[dt.getMonth()]} ${dt.getFullYear() + 543}`
}

/** `พ. 2 ก.ย. 2569` — the abbreviated weekday prefixed to the abbreviated date. */
export function fmtDDow(dt: Date): string {
  return `${TH_DOW[dt.getDay()]}. ${fmtD(dt)}`
}

/**
 * How long a span lasts, in Thai. Prototype 5180 (`hmDur`).
 *
 * `3 ชม.` · `1.5 ชม.` · `1 วัน 8 ชม.` · `2 วัน`
 *
 * 🔴 IT SWITCHES TO DAYS AT 24 HOURS, and that is the rule this file exists to keep in one place.
 * The prototype says so at the one caller that reworded it: a span over a day must read as
 * `1 วัน 8 ชั่วโมง`, never `32 ชั่วโมง`. Writing a second formula at a second screen is how the
 * request summary and the booking detail start reporting different durations for the same row on
 * the day somebody edits one of them.
 *
 * ⚠️ ROUNDED TO ONE DECIMAL, so a 90-minute span is `1.5 ชม.` rather than `1.4999999999 ชม.`, and
 * a whole number prints without a trailing `.0` because JavaScript drops it.
 *
 * ⚠️ THE UNIT IS ABBREVIATED. One screen wants the full word (`ชั่วโมง`) and swaps it itself —
 * `#/sent/:id`, which is a receipt with room to spare, unlike the cards and calendar rows every
 * other caller lives in.
 */
export function hmDur(start: Date, end: Date): string {
  const hours = (end.getTime() - start.getTime()) / 3_600_000
  if (hours < 24) return `${Math.round(hours * 10) / 10} ชม.`
  const days = Math.floor(hours / 24)
  const rest = Math.round((hours - days * 24) * 10) / 10
  return `${days} วัน${rest ? ` ${rest} ชม.` : ''}`
}
