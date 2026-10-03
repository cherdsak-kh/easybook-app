/**
 * Bangkok-time formatting for Hub 5 and Hub 6, from the ISO instants the API sends (`at`).
 *
 * ⚠️ BANGKOK, NOT THE BROWSER'S ZONE. An event at 2026-09-30T16:30:00Z is 1 ต.ค. 23.30 น. in Bangkok;
 * a `getHours()` on a machine in another zone would put it on the wrong day (E-6). The offset is applied
 * by arithmetic (`+7 h`, then the UTC getters), so the answer does not depend on where the browser is.
 *
 * ⚠️ NO COLON IN THE CLOCK of Hub 5 (`10.15 น.`, the prototype's brief). Hub 6 is the opposite and
 * deliberately so: an engineer reads `HH:MM:SS.mmm` against a log line, so its clock keeps colons.
 */

import { thaiDateOf } from './report-presets'

const BANGKOK_OFFSET_MS = 7 * 3_600_000

const TH_DAY = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'] as const
const TH_MONTH_LONG = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
] as const

export interface BangkokParts {
  /** `YYYY-MM-DD` in Bangkok. */
  date: string
  /** 0 = Sunday. */
  weekday: number
  hour: number
  minute: number
  second: number
  ms: number
}

/** `null` for an unparseable instant, so a bad value renders as a dash and never as `NaN`. */
export function bangkokParts(iso: string): BangkokParts | null {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  const d = new Date(t + BANGKOK_OFFSET_MS)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    weekday: d.getUTCDay(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    ms: d.getUTCMilliseconds(),
  }
}

const p2 = (n: number) => String(n).padStart(2, '0')

/** `28 ก.ย. 2569`. */
export function bangkokDateShort(iso: string): string {
  const p = bangkokParts(iso)
  return p ? thaiDateOf(p.date) : '—'
}

/** `10.15 น.` (Hub 5's clock). */
export function bangkokClock(iso: string): string {
  const p = bangkokParts(iso)
  return p ? `${p2(p.hour)}.${p2(p.minute)} น.` : '—'
}

/** `28 ก.ย. 2569 10.15 น.`, one line (the phone card). */
export function bangkokDateClock(iso: string): string {
  const p = bangkokParts(iso)
  return p ? `${thaiDateOf(p.date)} ${p2(p.hour)}.${p2(p.minute)} น.` : '—'
}

/** `วันจันทร์ที่ 28 กันยายน พ.ศ. 2569`. */
export function bangkokDateFull(iso: string): string {
  const p = bangkokParts(iso)
  if (!p) return '—'
  const [y, m, d] = p.date.split('-').map(Number)
  return `วัน${TH_DAY[p.weekday]}ที่ ${d} ${TH_MONTH_LONG[m - 1]} พ.ศ. ${y + 543}`
}

/** Hub 5's dialog: `วันจันทร์ที่ 28 กันยายน พ.ศ. 2569 เวลา 10.15.42 น.` (+ `(เวลาโดยประมาณ)` for a proxy time). */
export function bangkokTimestampFull(iso: string, approximate = false): string {
  const p = bangkokParts(iso)
  if (!p) return '—'
  const s = `${bangkokDateFull(iso)} เวลา ${p2(p.hour)}.${p2(p.minute)}.${p2(p.second)} น.`
  return approximate ? `${s} (เวลาโดยประมาณ)` : s
}

/** Hub 6: `HH:MM:SS.mmm`. */
export function bangkokClockMs(iso: string): string {
  const p = bangkokParts(iso)
  return p ? `${p2(p.hour)}:${p2(p.minute)}:${p2(p.second)}.${String(p.ms).padStart(3, '0')}` : '—'
}

/** Hub 6's card line: `28 ก.ย. 2569 10:15:42`. */
export function bangkokDateClockSeconds(iso: string): string {
  const p = bangkokParts(iso)
  return p ? `${thaiDateOf(p.date)} ${p2(p.hour)}:${p2(p.minute)}:${p2(p.second)}` : '—'
}

/** Hub 6's dialog: `วันจันทร์ที่ 28 กันยายน พ.ศ. 2569 10:15:42.123 (UTC+7)`. */
export function bangkokTimestampMs(iso: string): string {
  return bangkokParts(iso) ? `${bangkokDateFull(iso)} ${bangkokClockMs(iso)} (UTC+7)` : '—'
}

/** ลำดับ: the position in the FILTERED view (page 2 at ten rows starts at 11), not an id. */
export function rowNumber(page: number, limit: number, index: number): number {
  return (page - 1) * limit + index + 1
}
