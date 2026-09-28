/**
 * ภาพรวมสถิติ (Hub 1)'s pure client-side helpers: the three preset families (AC-R1), the range
 * validator (AC-R2/D-14), the echo line (AC-R3), the previous-period range the occupancy Δ badge
 * compares against (D-10), and the trend chart's per-bucket labels (AC-R9).
 *
 * ⚠️ NONE OF THIS CROSSES THE WIRE. The API is date-only by design (D-13/AC-R4) — every preset here
 * only ever produces a `{ from, to }` the page sends as plain `startDate`/`endDate`. Ported from the
 * prototype's `termOf`/`termRange`/`termPresets`/`buckets` (module ~L23916–24300), which is why the
 * date arithmetic below is byte-for-byte the same shape.
 *
 * ⚠️ DATES ARE BANGKOK CALENDAR DATES, `YYYY-MM-DD`, arithmetic done on the STRING plus `Date.UTC` —
 * never `new Date(iso).getDate()`, which reads the browser's local time zone and would shift a
 * date-only string by a day west of Bangkok. This mirrors `report-calendar.ts` on the backend.
 */

const TH_MONTH_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
] as const
const TH_MONTH_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
] as const

const DAY_MS = 86_400_000

/** A `YYYY-MM-DD` string to the UTC midnight instant it names, for pure day arithmetic. */
function ms(dateIso: string): number {
  const [y, m, d] = dateIso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** The inverse of {@link ms} — the `YYYY-MM-DD` string for a UTC-midnight instant. */
function iso(t: number): string {
  const d = new Date(t)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** Inclusive day count between two `YYYY-MM-DD` dates. Negative if `to < from`. */
export function inclusiveDays(from: string, to: string): number {
  return Math.round((ms(to) - ms(from)) / DAY_MS) + 1
}

/** `28 ก.ย. 2569` — Buddhist-era, from a `YYYY-MM-DD` string. */
export function thaiDateOf(dateIso: string): string {
  const [y, m, d] = dateIso.split('-').map(Number)
  return `${d} ${TH_MONTH_SHORT[m - 1]} ${y + 543}`
}

/** `กันยายน 2569`, or the abbreviated `ก.ย. 2569` when `short`. */
export function thaiMonthOf(dateIso: string, short = false): string {
  const [y, m] = dateIso.split('-').map(Number)
  const names = short ? TH_MONTH_SHORT : TH_MONTH_FULL
  return `${names[m - 1]} ${y + 543}`
}

// ── ภาคเรียน ─────────────────────────────────────────────────────────────────

export interface Term {
  n: 1 | 2
  /** Buddhist-era year the term is LABELLED with (the year it started in). */
  be: number
}

/**
 * Which term a Bangkok calendar date falls in — `null` during the 1 เม.ย.–15 พ.ค. break, when there
 * is no "current" term (AC-R1).
 */
export function termOf(dateIso: string): Term | null {
  const md = dateIso.slice(5)
  const be = Number(dateIso.slice(0, 4)) + 543
  if (md >= '05-16' && md <= '10-31') return { n: 1, be }
  if (md >= '11-01') return { n: 2, be }
  if (md <= '03-31') return { n: 2, be: be - 1 }
  return null
}

export function termRange(t: Term): { from: string; to: string } {
  const y = t.be - 543
  return t.n === 1
    ? { from: `${y}-05-16`, to: `${y}-10-31` }
    : { from: `${y}-11-01`, to: `${y + 1}-03-31` }
}

export function prevTerm(t: Term): Term {
  return t.n === 2 ? { n: 1, be: t.be } : { n: 2, be: t.be - 1 }
}

export function termLabel(t: Term): string {
  return `ภาคเรียนที่ ${t.n}/${t.be}`
}

export interface RangePreset {
  id: string
  from: string
  to: string
  label: string
}

/** The current term (or, in the break, the one that just ended) plus the two before it (AC-R1). */
export function termPresets(todayIso: string): RangePreset[] {
  const isCurrent = termOf(todayIso) !== null
  let cur = termOf(todayIso) ?? { n: 2 as const, be: Number(todayIso.slice(0, 4)) + 543 - 1 }
  const out: RangePreset[] = []
  for (let i = 0; i < 3; i++) {
    const r = termRange(cur)
    out.push({
      id: `${cur.n}-${cur.be}`,
      from: r.from,
      to: r.to,
      label: termLabel(cur) + (i === 0 && isCurrent ? ' (ปัจจุบัน)' : ''),
    })
    cur = prevTerm(cur)
  }
  return out
}

/** Newest-first calendar months, back to `floorIso` inclusive of its month (AC-R1). */
export function monthPresets(todayIso: string, floorIso: string): RangePreset[] {
  const out: RangePreset[] = []
  let y = Number(todayIso.slice(0, 4))
  let m = Number(todayIso.slice(5, 7)) - 1
  const floorMonth = `${floorIso.slice(0, 7)}-01`
  for (;;) {
    const from = `${y}-${String(m + 1).padStart(2, '0')}-01`
    if (from < floorMonth) break
    const to = iso(Date.UTC(y, m + 1, 0))
    out.push({
      id: from.slice(0, 7),
      from,
      to,
      label: TH_MONTH_FULL[m] + ' ' + (y + 543) + (out.length === 0 ? ' (เดือนนี้)' : ''),
    })
    m -= 1
    if (m < 0) {
      m = 11
      y -= 1
    }
  }
  return out
}

export type ReportMode = 'term' | 'month' | 'custom'

/** AC-R2's client-side gate. `null` = valid, sendable. D-14's cap message is the new copy. */
export function validateRange(from: string, to: string): string | null {
  if (!from || !to) return 'กรุณาระบุวันที่ให้ครบทั้งสองช่อง'
  if (to < from) return '"ถึงวันที่" ต้องไม่ก่อน "ตั้งแต่วันที่"'
  if (inclusiveDays(from, to) > 366) return 'ช่วงวันที่ต้องไม่เกิน 366 วัน'
  return null
}

// ── Trend chart labels (AC-R9) ────────────────────────────────────────────────

/** The bucket shapes this module formats — a structural subset of `TrendBucketDto`. */
export interface TrendBucketLike {
  from: string
  to: string
  partial: boolean
  future: boolean
  total: number
  approved: number
  rejected: number
  autoRejected: number
  cancelled: number
  occupancyPercent: number | null
}

/** `1 dp` percent, or `—` for `null` — the chart/pick-line's own rounding rule (AC-R9). */
export function pct1(x: number | null): string {
  return x == null ? '—' : `${x.toFixed(1)}%`
}
/** `0 dp` percent, or `—` — used under each column, where space is tight. */
export function pct0(x: number | null): string {
  return x == null ? '—' : `${Math.round(x)}%`
}

/** The column's short label — a bare month name, or `D MMM` for a week bucket. */
export function bucketShortLabel(b: Pick<TrendBucketLike, 'from'>, grain: 'month' | 'week'): string {
  const [, m, d] = b.from.split('-').map(Number)
  return grain === 'month' ? TH_MONTH_SHORT[m - 1] : `${d} ${TH_MONTH_SHORT[m - 1]}`
}

/** The tooltip/pick-line's long label, with the `(บางส่วน)` flag for a clipped month. */
export function bucketLongLabel(b: TrendBucketLike, grain: 'month' | 'week'): string {
  if (grain === 'month') return thaiMonthOf(b.from) + (b.partial ? ' (บางส่วน)' : '')
  return `สัปดาห์ ${thaiDateOf(b.from)} – ${thaiDateOf(b.to)}`
}

/** Hover/`aria-label` text for one column. */
export function bucketTooltip(b: TrendBucketLike, grain: 'month' | 'week'): string {
  const long = bucketLongLabel(b, grain)
  if (b.future) return `${long} · ยังไม่ถึงช่วงเวลานี้`
  return `${long} · คำขอ ${b.total} · อนุมัติ ${b.approved} · ปฏิเสธ ${b.rejected} · ยกเลิก ${b.cancelled}`
}

/** The default selection: the latest non-future bucket that has any requests (AC-R9). */
export function defaultPickIndex(buckets: readonly TrendBucketLike[]): number {
  for (let i = buckets.length - 1; i >= 0; i--) {
    if (!buckets[i].future && buckets[i].total > 0) return i
  }
  return -1
}

/** The pick line under the chart — the bucket's full breakdown, or the empty sentence. */
export function pickLineText(b: TrendBucketLike | null, grain: 'month' | 'week'): string {
  if (!b) return 'ยังไม่มีคำขอในช่วงนี้'
  const long = bucketLongLabel(b, grain)
  const clash = b.autoRejected > 0 ? ` (เวลาชน ${b.autoRejected})` : ''
  return (
    `${long} — คำขอ ${b.total} รายการ · อนุมัติ ${b.approved} · ปฏิเสธ ${b.rejected}${clash}` +
    ` · ยกเลิก ${b.cancelled} · อัตราการใช้สถานที่ ${pct1(b.occupancyPercent)}`
  )
}

/**
 * D-10's client-computed previous-period range, one per mode: the prior term, the prior calendar
 * month, or the same-length span immediately before a custom range.
 */
export function previousRangeOf(
  mode: ReportMode,
  from: string,
  to: string,
  preset: RangePreset | null,
): { from: string; to: string; label: string } {
  if (mode === 'term' && preset) {
    const [n, be] = preset.id.split('-').map(Number)
    const prev = prevTerm({ n: n as 1 | 2, be })
    const r = termRange(prev)
    return { ...r, label: termLabel(prev) }
  }
  if (mode === 'month') {
    let y = Number(from.slice(0, 4))
    let m = Number(from.slice(5, 7)) - 2
    if (m < 0) {
      m = 11
      y -= 1
    }
    const prevFrom = `${y}-${String(m + 1).padStart(2, '0')}-01`
    return { from: prevFrom, to: iso(Date.UTC(y, m + 1, 0)), label: thaiMonthOf(prevFrom) }
  }
  const span = ms(to) - ms(from)
  return {
    from: iso(ms(from) - span - DAY_MS),
    to: iso(ms(from) - DAY_MS),
    label: 'ช่วงก่อนหน้าที่ยาวเท่ากัน',
  }
}

/**
 * The occupancy KPI's trend badge (D-10): neutral when either rate is unavailable, or when the
 * previous range predates the earliest data on record; otherwise the signed percentage-point delta.
 */
export interface OccupancyTrend {
  tone: 'success' | 'error' | 'neutral'
  text: string
}

export function occupancyTrend(
  currentPercent: number | null,
  previousPercent: number | null,
  previousRangeTo: string,
  previousLabel: string,
  dataStartDate: string | null,
): OccupancyTrend {
  if (
    currentPercent == null ||
    previousPercent == null ||
    dataStartDate == null ||
    previousRangeTo < dataStartDate
  ) {
    return { tone: 'neutral', text: 'ไม่มีข้อมูลช่วงก่อนหน้าให้เทียบ' }
  }
  const d = currentPercent - previousPercent
  const tone = Math.abs(d) < 0.05 ? 'neutral' : d > 0 ? 'success' : 'error'
  const sign = d > 0 ? '+' : d < 0 ? '−' : '±'
  return { tone, text: `${sign}${Math.abs(d).toFixed(1)} จุด เทียบกับ${previousLabel}` }
}

/** AC-R3's echo line. `schoolDays` is 0 when the selected range is entirely in the future (E-13). */
export function rangeEcho(params: {
  from: string
  to: string
  dataUntilDate: string
  schoolDays: number
}): string {
  const { from, to, dataUntilDate, schoolDays } = params
  const span = inclusiveDays(from, to)
  let s = `ช่วงข้อมูล ${thaiDateOf(from)} – ${thaiDateOf(to)} (${span} วัน)`
  if (to > dataUntilDate && from <= dataUntilDate) s += ` · มีข้อมูลถึง ${thaiDateOf(dataUntilDate)}`
  if (schoolDays > 0) s += ` · วันทำการ ${schoolDays} วัน`
  return s
}
