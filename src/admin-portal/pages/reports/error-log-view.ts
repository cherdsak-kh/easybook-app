/**
 * Hub 6's pure view model: how the incident KPIs, a row and the purge read on screen.
 *
 * ⚠️ THE AVAILABILITY NUMBER IS REAL, NOT THE PROTOTYPE'S. The prototype assumed a flat 1,850 requests a
 * day ("REQ_PER_DAY, mock"); the server counts requests and 5xx responses per Bangkok day (D-23) and the
 * rate is `1 - Σ5xx / Σrequests`. When no request was counted at all the rate is `—`, never 100% and
 * never 0%: an empty denominator is "unknown", and a green `ปกติ` on no data would be a lie.
 *
 * ⚠️ THE BADGE JUDGES THE NUMBER THAT IS PRINTED. `99.896` prints as `99.90%`; judging the unrounded
 * value would stamp `เฝ้าระวัง` next to a number that reads as meeting the 99.9 line. Thresholds are the
 * prototype's: `ปกติ` from 99.9, `เฝ้าระวัง` from 99.5, else `ต่ำกว่าเป้า`.
 *
 * ⚠️ NO INVENTED COPY ABOUT WHAT AN INCIDENT IS. `CRITICAL` is exactly two things on this server (the
 * database unreachable, a deadlock or write conflict), so the card says that, not the prototype's
 * "Server 500", which is the generic `ERROR` severity.
 */

import type { IncidentDetail, IncidentKpis, IncidentSummary } from '@/lib/api-client'
import { thaiDateOf } from './report-presets'
import { bangkokClock, bangkokParts } from './log-format'

export interface AvailabilityView {
  /** `99.95%` or `—`. */
  value: string
  badge: { text: string; cls: string } | null
  desc: string
}

/** `ปกติ` / `เฝ้าระวัง` / `ต่ำกว่าเป้า`, judged on the 2 dp number that is printed. */
export function availabilityBadge(percent: number): { text: string; cls: string } {
  const shown = Math.round(percent * 100) / 100
  if (shown >= 99.9) return { text: 'ปกติ', cls: 'badge-success' }
  if (shown >= 99.5) return { text: 'เฝ้าระวัง', cls: 'badge-warning' }
  return { text: 'ต่ำกว่าเป้า', cls: 'badge-error' }
}

export function availabilityOf(a: IncidentKpis['availability']): AvailabilityView {
  const tail = a.daysWithoutData > 0 ? ` · ไม่มีข้อมูล ${a.daysWithoutData} วัน` : ''
  const target = `เป้าหมาย ${a.targetPercent}%`
  if (a.percent === null) {
    return { value: '—', badge: null, desc: `ยังไม่มีข้อมูลจำนวนคำขอในช่วงที่เลือก · ${target}${tail}` }
  }
  return {
    value: `${a.percent.toFixed(2)}%`,
    badge: availabilityBadge(a.percent),
    desc:
      `คำขอล้มเหลว (5xx) ${a.failed.toLocaleString('en-US')} จาก ` +
      `${a.requests.toLocaleString('en-US')} คำขอ · ${target}${tail}`,
  }
}

/** KPI 2: a ROLLING 24 h count, independent of the range, with the range's own count as context. */
export function last24hDesc(k: Pick<IncidentKpis, 'inRange'>): string {
  return `นับย้อนหลัง 24 ชั่วโมงจากตอนนี้ · ทั้งช่วงที่เลือก ${k.inRange.toLocaleString('en-US')} รายการ`
}

/** KPI 3's sentence: what CRITICAL covers and when the latest one was, or that there is none. */
export function criticalDesc(c: IncidentKpis['critical']): string {
  if (c.count === 0 || !c.latestAt) return 'ไม่มีข้อผิดพลาดระดับวิกฤตในช่วงนี้'
  const p = bangkokParts(c.latestAt)
  const when = p ? `${thaiDateOf(p.date)} ${bangkokClock(c.latestAt)}` : '—'
  return `ฐานข้อมูลเชื่อมต่อไม่ได้หรือเกิด deadlock · ล่าสุด ${when}`
}

/** KPI 4: the three integrations, summed and itemised. */
export function externalOf(e: IncidentKpis['external']): { count: number; desc: string } {
  return {
    count: e.lineOa + e.cloudflareR2 + e.redis,
    desc: `LINE OA ${e.lineOa} · Cloudflare R2 ${e.cloudflareR2} · Redis ${e.redis}`,
  }
}

/** The retention note on the echo line: the log is bounded, not permanent. */
export function retentionNote(r: { maxEntries: number; maxDays: number }): string {
  return `เก็บย้อนหลังสูงสุด ${r.maxDays} วัน หรือ ${r.maxEntries.toLocaleString('en-US')} รายการ`
}

// ── Rows ────────────────────────────────────────────────────────────────────────────────────────

/** Status coloured by class: 5xx red, 4xx amber, anything else (or none) the body colour. */
export function statusClass(status: number | null): string {
  if (status !== null && status >= 500) return 'text-error'
  if (status !== null && status >= 400) return 'text-warning'
  return 'text-base-content'
}

/** An incident with no HTTP response (a worker's failed push) has no status: `SYS`. */
export function statusLabel(status: number | null): string {
  return status === null ? 'SYS' : String(status)
}

/** The URL the incident hit, falling back to its route template, then to a dash. */
export function pathOf(i: Pick<IncidentSummary, 'path' | 'routeTemplate'>): string {
  return i.path ?? i.routeTemplate ?? '—'
}

export function viewLabel(i: IncidentSummary): string {
  return `ดูรายละเอียด ${i.id} ${statusLabel(i.status)} ${i.method ?? ''} ${pathOf(i)}`.replace(/\s+/g, ' ').trim()
}

// ── Purge ───────────────────────────────────────────────────────────────────────────────────────

export interface PurgeView {
  disabled: boolean
  title: string
  who: string
  description: string
}

/** `ล้างบันทึกเก่ากว่า 30 วัน`: disabled with its reason when nothing is that old. */
export function purgeOf(p: { count: number; cutoffDate: string }): PurgeView {
  return {
    disabled: p.count === 0,
    title:
      p.count === 0
        ? 'ไม่มีบันทึกที่เก่ากว่า 30 วัน'
        : `บันทึกที่เก่ากว่า 30 วันมี ${p.count.toLocaleString('en-US')} รายการ`,
    who: `บันทึกข้อผิดพลาดเก่า ${p.count.toLocaleString('en-US')} รายการ`,
    description: `บันทึกก่อนวันที่ ${thaiDateOf(p.cutoffDate)} จะถูกลบถาวร กู้คืนไม่ได้`,
  }
}

// ── Inspector ───────────────────────────────────────────────────────────────────────────────────

/**
 * The context block: the server's whitelisted keys, plus the error code and the query KEYS (never
 * values) the detail carries. Empty parts are omitted, and `null` means there is nothing to show.
 */
export function contextOf(d: Pick<IncidentDetail, 'context' | 'errorCode' | 'queryKeys'>): string | null {
  const out: Record<string, unknown> = {}
  if (d.errorCode) out.errorCode = d.errorCode
  if (d.queryKeys.length > 0) out.queryKeys = d.queryKeys
  for (const [k, v] of Object.entries(d.context)) {
    if (v === undefined) continue
    if (k === 'params' && v && Object.keys(v as object).length === 0) continue
    out[k] = v
  }
  return Object.keys(out).length > 0 ? JSON.stringify(out, null, 2) : null
}
