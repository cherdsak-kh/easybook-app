/**
 * Hub 2 (การใช้สถานที่และช่วงเวลา)'s PURE presentation helpers — everything the page derives from
 * `GET /reports/venues` that the server deliberately does NOT compute (design §3.3): heat levels,
 * per-scope density, peak/quiet, the pick line, demand tiers, the unmet-demand groups and the three
 * recommendations. Ported from the prototype module (~L24699–25110).
 *
 * ⚠️ DENSITY IS A CLIENT COMPUTATION. The API sends raw `heldHours` per cell for the all-venue scope
 * and for each venue, plus `weekdaySchoolDays`, so switching the venue selector repaints from data
 * already in memory and never refetches (AC-V10). `k` (venues in scope) is `occupancy.venueCount`
 * for "all" and 1 for one venue.
 *
 * ⚠️ NO `NEAR` TYPE-FAMILY MAP (D-18). The prototype hard-coded which room kinds substitute for
 * which and said itself that a port should read it from ประเภทสถานที่; no such data exists, so
 * recommendation 1 offers SAME-TYPE alternatives only.
 */

import type { ReportHeatCell, ReportVenueRow, ReportsVenues } from '@/lib/api-client'

const TH_DAY = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'] as const
const TH_DAY_SHORT = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.'] as const
export { TH_DAY, TH_DAY_SHORT }

/** 8 one-hour cells per day starting 08:30; slots 3 and 4 (11:30, 12:30) are the lunch hour. */
export const HEAT_SLOTS = 8
export const HEAT_CELLS = 40
const LUNCH_SLOTS: readonly number[] = [3, 4]

/** Demand-tier thresholds (D-17) — PRESENTATION constants, so they live here and not on the wire. */
export const HIGH_OCC = 35
export const LOW_OCC = 10
export const HIGH_CLASH = 20

/**
 * The prototype's `LEVELS` strings verbatim (L24731). The legend's swatches use this SAME array, so
 * the legend cannot drift from the grid (AC-V8). `/60`, `/20`, `/40`, `/90` are all multiples of ten
 * — the only alpha steps that exist in this stack.
 */
export const HEAT_LEVEL_CLASSES: readonly string[] = [
  'bg-base-200/60 text-base-content/70',
  'bg-primary/20 text-base-content',
  'bg-primary/40 text-base-content',
  'bg-primary/90 text-primary-content',
  'bg-warning font-semibold text-warning-content',
]

/** D-16. `null`/≤ 0 → 0; > 100 % (closed-venue hours, E-6) stays at 4, unclamped. */
export function heatLevel(density: number | null): number {
  if (density == null || density <= 0) return 0
  if (density <= 0.3) return 1
  if (density <= 0.6) return 2
  if (density <= 0.85) return 3
  return 4
}

const hhmm = (totalMinutes: number): string =>
  `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`

/** `08:30` for slot 0 … `15:30` for slot 7. */
export const slotStart = (j: number): string => hhmm(510 + 60 * j)
/** `08:30–09:30`. */
export const slotLabel = (j: number): string => `${slotStart(j)}–${hhmm(570 + 60 * j)}`

/** One hour cell as read in a given scope. */
export interface ScopeCell {
  /** 0…39: `(isoWeekday − 1) × 8 + slot`. */
  i: number
  /** 0 = จันทร์ … 4 = ศุกร์. */
  day: number
  slot: number
  heldHours: number
  segments: number
  /** `weekdaySchoolDays[day] × k`. */
  capacityHours: number
  /** `heldHours ÷ capacityHours`, or `null` when the capacity is 0 (shown `—`). */
  density: number | null
}

export const ALL_SCOPE = 'all'

/** The 40 cells for `'all'` or one venue id. Never touches the network (AC-V10). */
export function scopeCells(data: ReportsVenues, scope: string): ScopeCell[] {
  const venue = scope === ALL_SCOPE ? null : data.venues.find((v) => v.venueId === scope)
  const source: ReportHeatCell[] = venue ? venue.cells : data.heatmap
  const k = venue ? 1 : data.occupancy.venueCount
  return Array.from({ length: HEAT_CELLS }, (_, i) => {
    const day = Math.floor(i / HEAT_SLOTS)
    const cell = source[i] ?? { heldHours: 0, segments: 0 }
    const capacityHours = (data.weekdaySchoolDays[day] ?? 0) * k
    return {
      i,
      day,
      slot: i % HEAT_SLOTS,
      heldHours: cell.heldHours,
      segments: cell.segments,
      capacityHours,
      density: capacityHours > 0 ? cell.heldHours / capacityHours : null,
    }
  })
}

/** The highest density; ties by more segments, then the lowest index. `null` when none has a density. */
export function peakOf(cells: readonly ScopeCell[]): ScopeCell | null {
  let best: ScopeCell | null = null
  for (const c of cells) {
    if (c.density == null) continue
    if (
      !best ||
      c.density > (best.density ?? 0) ||
      (c.density === best.density && c.segments > best.segments)
    ) {
      best = c
    }
  }
  return best
}

/** The lowest density outside the lunch hour; ties by fewer segments, then the lowest index. */
export function quietOf(cells: readonly ScopeCell[]): ScopeCell | null {
  let best: ScopeCell | null = null
  for (const c of cells) {
    if (c.density == null || LUNCH_SLOTS.includes(c.slot)) continue
    if (
      !best ||
      c.density < (best.density ?? 0) ||
      (c.density === best.density && c.segments < best.segments)
    ) {
      best = c
    }
  }
  return best
}

/** DV-5: "no data" means EVERY in-scope cell has zero held hours, not merely the picked one. */
export const hasAnyUse = (cells: readonly ScopeCell[]): boolean => cells.some((c) => c.heldHours > 0)

/** `1 dp`, thousands-separated — the prototype's `hrs()`. */
export const hrs = (h: number): string => (Math.round(h * 10) / 10).toLocaleString('en-US')

/** `x.x%` from a 0–100 value, or `—`. */
export const pct1 = (x: number | null): string => (x == null ? '—' : `${x.toFixed(1)}%`)
/** `NN%` from a 0–1 density, or `—`. */
export const densityPct0 = (d: number | null): string => (d == null ? '—' : `${Math.round(d * 100)}%`)

/** `วันจันทร์ 08:30–09:30`. */
export const cellText = (c: Pick<ScopeCell, 'day' | 'slot'>): string =>
  `วัน${TH_DAY[c.day]} ${slotLabel(c.slot)}`

/** `title` = `aria-label` of one heatmap button (AC-V8). */
export function cellLabel(c: ScopeCell): string {
  const head = `${TH_DAY[c.day]} ${slotLabel(c.slot)}`
  return c.density == null
    ? `${head}: ไม่มีวันทำการในช่วงนี้`
    : `${head}: มีการใช้งาน ${c.segments} รายการ (${densityPct0(c.density)})`
}

/** The pick line under the grid (AC-V11). `cell` is `null` when nothing in scope was ever held. */
export function pickLineText(cell: ScopeCell | null, scopeName: string): string {
  if (!cell) return 'ยังไม่มีการใช้สถานที่ในช่วงนี้'
  return (
    `${cellText(cell)} · ${scopeName} — มีการใช้งาน ${cell.segments} รายการ รวม ${hrs(cell.heldHours)} ชม. ` +
    `จากเวลาที่เปิดให้จอง ${hrs(cell.capacityHours)} ชม. (${pct1(cell.density == null ? null : cell.density * 100)})`
  )
}

/** `ช่วงพีค` / `ว่างที่สุด` badge text: `วันจันทร์ 08:30–09:30 · 87%`, or `—`. */
export function heatBadgeText(cell: ScopeCell | null, requireUse: boolean): string {
  if (!cell || (requireUse && cell.heldHours <= 0)) return '—'
  return `${cellText(cell)} · ${densityPct0(cell.density)}`
}

/** `(ลบแล้ว)` suffix — history names stay readable. */
export const venueName = (v: Pick<ReportVenueRow, 'name' | 'isDeleted'>): string =>
  v.name + (v.isDeleted ? ' (ลบแล้ว)' : '')

export interface VenueOption {
  value: string
  label: string
}

/** AC-V10: `ทุกสถานที่ (ภาพรวม)`, then every row by name (DV-10) with `(ลบแล้ว)` / `(ปิดให้จอง)`. */
export function venueOptions(venues: readonly ReportVenueRow[]): VenueOption[] {
  const rows = [...venues].sort((a, b) => a.name.localeCompare(b.name, 'th'))
  return [
    { value: ALL_SCOPE, label: 'ทุกสถานที่ (ภาพรวม)' },
    ...rows.map((v) => ({
      value: v.venueId,
      label: v.name + (v.isDeleted ? ' (ลบแล้ว)' : !v.isOpen ? ' (ปิดให้จอง)' : ''),
    })),
  ]
}

export interface DemandTier {
  /** daisyUI badge tone class. */
  cls: 'badge-ghost' | 'badge-error' | 'badge-primary'
  text: string
  /** Turns the row's bar `progress-warning`, so the bar and the badge never argue. */
  high: boolean
  low: boolean
}

/** D-17 (prototype `tierOf`). */
export function demandTier(row: ReportVenueRow): DemandTier {
  if (!row.isOpen) return { cls: 'badge-ghost', text: 'ปิดให้จอง', high: false, low: false }
  const occ = row.occupancyPercent ?? 0
  const clash = row.autoRejectedPercent ?? 0
  if (occ >= HIGH_OCC || (row.requests >= 5 && clash >= HIGH_CLASH)) {
    return { cls: 'badge-error', text: 'หนาแน่นสูง', high: true, low: false }
  }
  if (occ < LOW_OCC) return { cls: 'badge-ghost', text: 'ใช้งานน้อย', high: false, low: true }
  return { cls: 'badge-primary', text: 'เหมาะสม', high: false, low: false }
}

export interface TypeClashRow {
  typeName: string
  requests: number
  autoRejected: number
  /** 0–1. */
  rate: number
  /** `หอประชุมใหญ่ 3 ครั้ง` per venue with at least one clash. */
  venues: string[]
}

/** AC-V13: the types with requests > 0, by clash rate desc then requests desc. */
export function typeClashRows(venues: readonly ReportVenueRow[]): TypeClashRow[] {
  const per = new Map<string, TypeClashRow>()
  for (const v of venues) {
    const t = per.get(v.typeName) ?? {
      typeName: v.typeName,
      requests: 0,
      autoRejected: 0,
      rate: 0,
      venues: [],
    }
    t.requests += v.requests
    t.autoRejected += v.autoRejected
    if (v.autoRejected > 0) t.venues.push(`${venueName(v)} ${v.autoRejected} ครั้ง`)
    per.set(v.typeName, t)
  }
  return [...per.values()]
    .filter((t) => t.requests > 0)
    .map((t) => ({ ...t, rate: t.autoRejected / t.requests }))
    .sort((a, b) => b.rate - a.rate || b.requests - a.requests)
}

export type RecommendationIcon = 'move' | 'clock' | 'space' | 'ok'

export interface Recommendation {
  tone: 'text-warning' | 'text-success' | 'text-primary' | 'text-info'
  icon: RecommendationIcon
  key: string
  text: string
}

const toHours = (hhmmText: string): number => {
  const [h, m] = hhmmText.split(':').map(Number)
  return h + m / 60
}

/** AC-V13 — the prototype's `paintRecs`, copy verbatim; recommendation 1 is same-type only (D-18). */
export function recommendations(data: ReportsVenues): Recommendation[] {
  const out: Recommendation[] = []
  const rows = data.venues

  // 1. The worst collision room, its worst hour, and the emptiest same-type room at that hour.
  let hot: ReportVenueRow | null = null
  for (const r of rows) if (r.autoRejected > 0 && (!hot || r.autoRejected > hot.autoRejected)) hot = r
  if (hot) {
    const clash = hot.topClash
    const hotName = venueName(hot)
    let text = `${hotName} ปฏิเสธคำขอเพราะเวลาชน ${hot.autoRejected} ครั้ง`
    const noAlt =
      ' — ไม่มีสถานที่ประเภทใกล้เคียงที่จุคนได้เท่ากันและเปิดให้จอง ควรพิจารณาเพิ่มรอบเวลาหรือจัดลำดับความสำคัญของคำขอ'
    if (clash && clash.isoWeekday >= 1 && clash.isoWeekday <= 5) {
      const w = clash.isoWeekday
      const mid = (toHours(clash.startTime) + toHours(clash.endTime)) / 2
      const slot = Math.max(0, Math.min(7, Math.floor(mid - 8.5)))
      const cell = (w - 1) * 8 + slot
      text += ` ส่วนใหญ่วัน${TH_DAY[w - 1]} ${clash.startTime}–${clash.endTime}`
      const hotRow = hot
      const alts = rows
        .filter(
          (r) =>
            r !== hotRow &&
            r.isOpen &&
            !r.isDeleted &&
            r.capacity >= hotRow.capacity &&
            r.typeName === hotRow.typeName,
        )
        .sort((a, b) => (a.cells[cell]?.heldHours ?? 0) - (b.cells[cell]?.heldHours ?? 0))
      const alt = alts[0]
      if (alt) {
        const util = (alt.cells[cell]?.heldHours ?? 0) / (data.weekdaySchoolDays[w - 1] || 1)
        text +=
          ` · ช่วงเดียวกัน ${venueName(alt)} (จุ ${alt.capacity.toLocaleString('en-US')} คน)` +
          ` ถูกใช้เพียง ${Math.round(util * 100)}% — ควรย้ายกิจกรรมที่จองทุกสัปดาห์บางรายการไปที่นั่น เพื่อเปิดเวลาให้คำขอใหม่`
      } else {
        text += noAlt
      }
    } else {
      // DV-7: a weekend (or missing) top clash has no heatmap cell to compare against.
      text += noAlt
    }
    out.push({ tone: 'text-warning', icon: 'move', key: 'ย้ายการจองประจำสัปดาห์ออกจากช่วงที่ชน', text })
  } else {
    out.push({
      tone: 'text-success',
      icon: 'ok',
      key: 'ยังไม่มีจุดคอขวด',
      text: 'ไม่มีคำขอที่ถูกปฏิเสธเพราะเวลาชนในช่วงนี้ — พื้นที่ที่มีอยู่เพียงพอต่อความต้องการ',
    })
  }

  // 2. Peak vs quiet across every venue.
  const all = scopeCells(data, ALL_SCOPE)
  const pk = peakOf(all)
  const qt = quietOf(all)
  if (pk && qt && pk.density != null && qt.density != null && pk.density > qt.density) {
    out.push({
      tone: 'text-primary',
      icon: 'clock',
      key: 'กระจายกิจกรรมไปช่วงเวลาที่ว่าง',
      text:
        `ช่วงพีค ${cellText(pk)} ใช้พื้นที่ ${densityPct0(pk.density)} ขณะที่ ${cellText(qt)} ใช้เพียง ${densityPct0(qt.density)}` +
        ' — ประชุม อบรม และชมรมที่ไม่ผูกกับตารางสอน ควรจัดในช่วงที่ว่างแทน',
    })
  }

  // 3. Rooms with spare capacity.
  const low = rows.filter((r) => demandTier(r).low)
  if (low.length > 0) {
    out.push({
      tone: 'text-info',
      icon: 'space',
      key: 'ใช้พื้นที่ที่ยังว่างให้เต็มประโยชน์',
      text:
        low.map((r) => `${venueName(r)} (${Math.round(r.occupancyPercent ?? 0)}%)`).join(', ') +
        ` ใช้งานต่ำกว่า ${LOW_OCC}% ของเวลาเปิดให้จอง — ประชาสัมพันธ์ให้กลุ่มสาระใช้เป็นพื้นที่สำรอง หรือปรับเป็นห้องกิจกรรมอเนกประสงค์ก่อนพิจารณาสร้างพื้นที่ใหม่`,
    })
  }
  return out
}

/** D-19: stricter than Hub 1 — a summer-break range has no bookable time to measure against. */
export const isVenuesEmpty = (d: ReportsVenues): boolean =>
  d.range.schoolDays === 0 || (d.requests.total === 0 && d.occupancy.heldHours === 0)
