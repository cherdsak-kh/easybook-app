/**
 * Hub 4's URL ⇄ state contract (plan D-9, AC-E3) and the deep link Hubs 1 to 3 build into it (D-10).
 *
 * ⚠️ PURE AND NEVER THROWS. `parseExportParams` reads whatever is in the address bar: a hand-edited
 * link, a bookmark from before a preset id changed, a link shared by a VIEWER. Every value that does
 * not validate falls back to that group's default and adds ONE notice for the echo line. It must never
 * produce a 400 page, a blank sheet or an exception, because the alternative is a router error
 * boundary on a screen whose whole job is producing an official document.
 *
 * ⚠️ THE URL CARRIES NOTHING BUT THESE KEYS (`template`, `period`, `preset`, `startDate`, `endDate`,
 * `venueId`, `departmentId`). `serializeExportParams` writes exactly those, in a fixed order, so an
 * unknown key in a pasted link is dropped on the first write-back and F5 reproduces the same document.
 *
 * ⚠️ THE VALIDATION IS NOT FORKED. Ranges are judged by `validateRange` and the preset ids by the SAME
 * `termPresets` / `monthPresets` Hubs 1 to 3 use; this file adds only the parts those pages never
 * needed (a real-calendar date check, preset-vs-dates agreement, the scope ids).
 */

import { routeOf, urlOf } from '../../routes'
import {
  monthPresets,
  termPresets,
  validateRange,
  type RangePreset,
  type ReportMode,
} from './report-presets'
import type { ExportApiParams, ReportPeriod, ReportScopeOptions, ReportTemplate } from '@/lib/api-client'

export type ExportTemplateKey = 'summary' | 'ledger' | 'venues'

export const EXPORT_TEMPLATE_KEYS: readonly ExportTemplateKey[] = ['summary', 'ledger', 'venues']

/** URL form (lower-case) → the API enum. */
const TEMPLATE_API: Record<ExportTemplateKey, ReportTemplate> = {
  summary: 'SUMMARY',
  ledger: 'LEDGER',
  venues: 'VENUES',
}

const PERIOD_API: Record<ReportMode, ReportPeriod> = {
  term: 'TERM',
  month: 'MONTH',
  custom: 'CUSTOM',
}

/** D-10: the template each hub's `ส่งออกรายงาน` button opens Hub 4 on. */
export const HUB_EXPORT_TEMPLATE = {
  overview: 'summary',
  venues: 'venues',
  operations: 'summary',
} as const satisfies Record<string, ExportTemplateKey>

export const NOTICE_RANGE = 'ลิงก์มีค่าที่ใช้ไม่ได้ จึงแสดงภาคเรียนปัจจุบันแทน'
export const NOTICE_TEMPLATE = 'ลิงก์ระบุรูปแบบเอกสารที่ไม่มีอยู่ จึงใช้แบบ 1 สรุปภาพรวมแทน'
export const NOTICE_PRESET_DATES =
  'ลิงก์ระบุวันที่ไม่ตรงกับภาคเรียนหรือเดือนที่เลือก จึงใช้ช่วงของภาคเรียนหรือเดือนนั้นแทน'
export const NOTICE_SCOPE = 'ลิงก์ระบุสถานที่หรือกลุ่ม/ฝ่ายที่ไม่มีอยู่ จึงแสดงทุกขอบเขตแทน'

export interface ExportParams {
  template: ExportTemplateKey
  period: ReportMode
  /** The term/month id; `null` in `custom` mode. */
  preset: string | null
  startDate: string
  endDate: string
  venueId: string | null
  departmentId: number | null
}

const isTemplateKey = (v: string): v is ExportTemplateKey =>
  (EXPORT_TEMPLATE_KEYS as readonly string[]).includes(v)

const isMode = (v: string): v is ReportMode => v === 'term' || v === 'month' || v === 'custom'

/** A `YYYY-MM-DD` string that names a real calendar day (`2026-02-30` is not one). */
export function isIsoDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const [y, m, d] = v.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

/** The preset lists a given `today` offers, exactly as `useReportRange` builds them. */
function presetLists(today: string): { terms: RangePreset[]; months: RangePreset[] } {
  const terms = termPresets(today)
  const months = monthPresets(today, terms[terms.length - 1].from)
  return { terms, months }
}

/** Hub 4's defaults: แบบ 1, the current term, every venue and department. */
export function defaultExportParams(today: string): ExportParams {
  const t = termPresets(today)[0]
  return {
    template: 'summary',
    period: 'term',
    preset: t.id,
    startDate: t.from,
    endDate: t.to,
    venueId: null,
    departmentId: null,
  }
}

type RangeResult =
  | { ok: true; period: ReportMode; preset: string | null; startDate: string; endDate: string; mismatch: boolean }
  | { ok: false }

function parseRange(q: URLSearchParams, today: string): RangeResult | 'absent' {
  const keys = ['period', 'preset', 'startDate', 'endDate']
  if (keys.every((k) => q.get(k) === null)) return 'absent'

  const periodRaw = q.get('period')
  if (periodRaw === null || !isMode(periodRaw)) return { ok: false }
  const start = q.get('startDate')
  const end = q.get('endDate')

  if (periodRaw === 'custom') {
    if (start === null || end === null) return { ok: false }
    if (!isIsoDate(start) || !isIsoDate(end) || validateRange(start, end) !== null) return { ok: false }
    return { ok: true, period: 'custom', preset: null, startDate: start, endDate: end, mismatch: false }
  }

  const { terms, months } = presetLists(today)
  const list = periodRaw === 'month' ? months : terms
  const presetRaw = q.get('preset')
  const datesGiven = start !== null || end !== null

  if (presetRaw !== null) {
    const p = list.find((x) => x.id === presetRaw)
    if (!p) return { ok: false }
    const mismatch = datesGiven && (start !== p.from || end !== p.to)
    return { ok: true, period: periodRaw, preset: p.id, startDate: p.from, endDate: p.to, mismatch }
  }
  if (datesGiven) {
    const p = list.find((x) => x.from === start && x.to === end)
    if (!p) return { ok: false }
    return { ok: true, period: periodRaw, preset: p.id, startDate: p.from, endDate: p.to, mismatch: false }
  }
  // `period=term` / `period=month` alone: that family's newest preset.
  const p = list[0]
  return { ok: true, period: periodRaw, preset: p.id, startDate: p.from, endDate: p.to, mismatch: false }
}

/**
 * The query string → a document the page can ask for. `notice` is one line for the echo (several
 * problems are joined), or `null` when the link was clean or empty. `search` may start with `?`.
 */
export function parseExportParams(
  search: string,
  today: string,
): { params: ExportParams; notice: string | null } {
  const q = new URLSearchParams(search)
  const params = defaultExportParams(today)
  const notices: string[] = []

  const templateRaw = q.get('template')
  if (templateRaw !== null) {
    if (isTemplateKey(templateRaw)) params.template = templateRaw
    else notices.push(NOTICE_TEMPLATE)
  }

  const range = parseRange(q, today)
  if (range !== 'absent') {
    if (range.ok) {
      params.period = range.period
      params.preset = range.preset
      params.startDate = range.startDate
      params.endDate = range.endDate
      if (range.mismatch) notices.push(NOTICE_PRESET_DATES)
    } else {
      notices.push(NOTICE_RANGE)
    }
  }

  let scopeBad = false
  const venueRaw = q.get('venueId')
  if (venueRaw !== null) {
    if (/^[A-Za-z0-9_-]{1,64}$/.test(venueRaw)) params.venueId = venueRaw
    else scopeBad = true
  }
  const deptRaw = q.get('departmentId')
  if (deptRaw !== null) {
    if (/^[1-9]\d{0,8}$/.test(deptRaw)) params.departmentId = Number(deptRaw)
    else scopeBad = true
  }
  if (scopeBad) notices.push(NOTICE_SCOPE)

  return { params, notice: notices.length ? notices.join(' · ') : null }
}

/**
 * Drops a scope id the server does not offer (a deleted-then-purged venue, or the reserved department
 * for an ADMIN), with the scope notice. Run once the `scope-options` response is in: until then a
 * carried id is unverified and the page sends nothing.
 */
export function reconcileScope(
  params: ExportParams,
  options: Pick<ReportScopeOptions, 'venues' | 'departments'>,
): { params: ExportParams; notice: string | null } {
  let dropped = false
  const next = { ...params }
  if (next.venueId !== null && !options.venues.some((v) => v.id === next.venueId)) {
    next.venueId = null
    dropped = true
  }
  if (next.departmentId !== null && !options.departments.some((d) => d.id === next.departmentId)) {
    next.departmentId = null
    dropped = true
  }
  return { params: next, notice: dropped ? NOTICE_SCOPE : null }
}

/** The state → a query string (no leading `?`), in a fixed key order, omitting what does not apply. */
export function serializeExportParams(p: ExportParams): string {
  const q = new URLSearchParams()
  q.set('template', p.template)
  q.set('period', p.period)
  if (p.period !== 'custom' && p.preset) q.set('preset', p.preset)
  q.set('startDate', p.startDate)
  q.set('endDate', p.endDate)
  if (p.venueId) q.set('venueId', p.venueId)
  if (p.departmentId !== null) q.set('departmentId', String(p.departmentId))
  return q.toString()
}

/** The state → the API's query (enum spellings are upper-case on the wire). */
export function toExportApiParams(p: ExportParams): ExportApiParams {
  const out: ExportApiParams = {
    template: TEMPLATE_API[p.template],
    period: PERIOD_API[p.period],
    startDate: p.startDate,
    endDate: p.endDate,
  }
  if (p.venueId) out.venueId = p.venueId
  if (p.departmentId !== null) out.departmentId = p.departmentId
  return out
}

/**
 * The URL Hubs 1 to 3's `ส่งออกรายงาน` button navigates to: Hub 4 opened on the hub's CURRENT valid
 * range and mode/preset, with the template that hub defaults to (`HUB_EXPORT_TEMPLATE`). Never carries
 * a scope: Hubs 1 to 3 have no venue or department picker to carry.
 */
export function exportLinkOf(p: {
  template: ExportTemplateKey
  mode: ReportMode
  presetId: string
  from: string
  to: string
}): string {
  const query = serializeExportParams({
    template: p.template,
    period: p.mode,
    preset: p.mode === 'custom' ? null : p.presetId,
    startDate: p.from,
    endDate: p.to,
    venueId: null,
    departmentId: null,
  })
  return `${urlOf(routeOf('ส่งออกรายงานราชการ')!)}?${query}`
}
