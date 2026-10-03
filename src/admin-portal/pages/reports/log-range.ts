/**
 * The range model Hub 5 (ประวัติการทำรายการ) and Hub 6 (บันทึกข้อผิดพลาด) share: pure, so the part that
 * could be wrong is testable without a browser. Prototype `preset()` L26109 / L26717 and the range
 * handlers L26422–26451.
 *
 * ⚠️ NOT HUBS 1 TO 3'S RANGE, on purpose (D-16). Those hubs read BACKWARDS from yesterday and speak in
 * terms and months; an audit trail and an error log are about what just happened, so every preset here
 * ENDS TODAY and the data includes today. Do not reuse `useReportRange` for them, and do not "align" the
 * two: a 30-day window ending yesterday would hide the incident that sent the engineer here.
 *
 * ⚠️ DATES ARE BANGKOK CALENDAR DATES, `YYYY-MM-DD`, arithmetic on the STRING plus `Date.UTC`, never a
 * local-time getter. Same rule as `report-presets.ts`.
 */

import { inclusiveDays, termPresets, thaiDateOf } from './report-presets'

export type LogPreset = 'today' | '7d' | '30d' | 'term' | 'custom'

export const LOG_PRESET_LABEL: Record<LogPreset, string> = {
  today: 'วันนี้',
  '7d': '7 วันล่าสุด',
  '30d': '30 วันล่าสุด',
  term: 'ภาคเรียนปัจจุบัน',
  custom: 'กำหนดเอง',
}

export const LOG_DEFAULT_PRESET: Exclude<LogPreset, 'custom'> = '30d'

const DAY_MS = 86_400_000

function shiftDays(dateIso: string, delta: number): string {
  const [y, m, d] = dateIso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d) + delta * DAY_MS)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/** A quick preset's dates. Every one ends `today`; `term` starts at the current term's first day. */
export function logPresetRange(
  preset: Exclude<LogPreset, 'custom'>,
  today: string,
): { from: string; to: string } {
  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case '7d':
      return { from: shiftDays(today, -6), to: today }
    case 'term':
      return { from: termPresets(today)[0].from, to: today }
    default:
      return { from: shiftDays(today, -29), to: today }
  }
}

/** The date inputs' bounds: the oldest term the filter bars know, up to today. */
export function logDateBounds(today: string): { min: string; max: string } {
  const terms = termPresets(today)
  return { min: terms[terms.length - 1].from, max: today }
}

export const LOG_ERR_INCOMPLETE = 'กรุณาระบุวันที่ให้ครบทั้งสองช่อง'
export const LOG_ERR_INVERTED = 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น'
export const LOG_ERR_TOO_WIDE = 'ช่วงวันที่ต้องไม่เกิน 366 วัน'

/** The inline gate for typed dates (AC-A2). `null` = sendable. The server enforces the same three. */
export function validateLogRange(from: string, to: string): string | null {
  if (!from || !to) return LOG_ERR_INCOMPLETE
  if (to < from) return LOG_ERR_INVERTED
  if (inclusiveDays(from, to) > 366) return LOG_ERR_TOO_WIDE
  return null
}

/** `HH.MM`: the Thai clock with a period, from a browser-local `Date` (the "last updated" stamp). */
export function clockOf(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}.${pad(d.getMinutes())}`
}

/**
 * The echo line (`ช่วงข้อมูล 4 ก.ย. 2569 – 3 ต.ค. 2569 · อัปเดตล่าสุด 10.15 น.`). One day shows one date.
 * `extra` carries the per-hub tail (Hub 6's live and retention notes).
 */
export function logRangeEcho(
  from: string,
  to: string,
  lastSync: Date | null,
  extra: readonly string[] = [],
): string {
  let s = `ช่วงข้อมูล ${thaiDateOf(from)}${from === to ? '' : ` – ${thaiDateOf(to)}`}`
  if (lastSync) s += ` · อัปเดตล่าสุด ${clockOf(lastSync)} น.`
  for (const e of extra) s += ` · ${e}`
  return s
}
