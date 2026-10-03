/**
 * Hub 3 (สถิติตามฝ่ายและการดำเนินงาน)'s PURE presentation helpers over `GET /reports/operations`
 * (design §3.4): the badges, the top department / purpose picks and the registry's lead text.
 *
 * ⚠️ NO NO-SHOW ANYWHERE (D-12). The system has no attendance record, so `discipline.noShows` is
 * `null` and every lapse badge counts LATE CANCELLATIONS ONLY — never a fabricated 0.
 */

import type {
  ReportDepartmentRow,
  ReportLateCancellation,
  ReportPurposeRow,
  ReportSla,
} from '@/lib/api-client'

/** `x.x%` from a 0–100 value, or `—`. */
export const pct1 = (x: number | null): string => (x == null ? '—' : `${x.toFixed(1)}%`)
/** `1 dp`, thousands-separated. */
export const hrs = (h: number): string => (Math.round(h * 10) / 10).toLocaleString('en-US')

/** The `ไม่ระบุกลุ่ม/ฝ่าย` bucket is `departmentId === null`; it is not a department (DV-4). */
export const UNASSIGNED_LABEL = 'ไม่ระบุกลุ่ม/ฝ่าย'

export const departmentName = (d: Pick<ReportDepartmentRow, 'name' | 'isDeleted'>): string =>
  d.name == null ? UNASSIGNED_LABEL : d.name + (d.isDeleted ? ' (ลบแล้ว)' : '')

const realDepartments = (rows: readonly ReportDepartmentRow[]) =>
  rows.filter((r) => r.departmentId !== null)

/** AC-O3: the first real department with hours > 0 (rows arrive server-sorted). */
export function topDepartment(rows: readonly ReportDepartmentRow[]): ReportDepartmentRow | null {
  return realDepartments(rows).find((r) => r.heldHours > 0) ?? null
}

/** AC-O6: the first non-OTHER purpose with hours > 0. */
export function topPurpose(rows: readonly ReportPurposeRow[]): ReportPurposeRow | null {
  return rows.find((r) => r.category !== 'OTHER' && r.heldHours > 0) ?? null
}

export interface Badge {
  cls: string
  text: string
}

/** D-21: ≥ 75 success, ≥ 60 warning, else error; `—` neutral when there were no requests. */
export function approvalBadge(pct: number | null): Badge {
  if (pct == null) return { cls: 'badge-neutral', text: '—' }
  const text = `${Math.round(pct)}%`
  return { cls: pct >= 75 ? 'badge-success' : pct >= 60 ? 'badge-warning' : 'badge-error', text }
}

/** D-21: the top-2 share sum; warning above 60 %. `null` when fewer than one real department. */
export function equityBadge(rows: readonly ReportDepartmentRow[]): Badge | null {
  const top = realDepartments(rows).slice(0, 2)
  if (top.length === 0) return null
  const sum = top.reduce((s, r) => s + r.sharePercent, 0)
  return {
    cls: sum > 60 ? 'badge-warning' : 'badge-neutral',
    text: `2 อันดับแรกใช้ ${Math.round(sum)}% ของชั่วโมง`,
  }
}

/** D-12: late cancellations only. */
export function lapseBadge(late: number): Badge {
  return late > 0
    ? { cls: 'badge-warning', text: `ยกเลิกช้า ${late}` }
    : { cls: 'badge-ghost', text: 'ไม่มี' }
}

/** D-24: `x.x% ในเกณฑ์ 24 ชม.`, success at ≥ 90, else warning; neutral when nothing was decided. */
export function slaBadge(sla: Pick<ReportSla, 'decided' | 'withinSlaPercent' | 'slaHours'>): Badge {
  if (sla.decided === 0 || sla.withinSlaPercent == null) {
    return { cls: 'badge-neutral', text: 'ยังไม่มีคำขอที่พิจารณา' }
  }
  return {
    cls: sla.withinSlaPercent >= 90 ? 'badge-success' : 'badge-warning',
    text: `${sla.withinSlaPercent.toFixed(1)}% ในเกณฑ์ ${sla.slaHours} ชม.`,
  }
}

/** The SLA bars' daisyUI tone, in `buckets` order (fixed by the contract). */
export const SLA_BAR_CLASSES: readonly string[] = [
  'progress-primary',
  'progress-info',
  'progress-warning',
  'progress-error',
]

/** `ก่อนเริ่ม 10 นาที` / `หลังเริ่ม 15 นาที`. */
export const registryLeadText = (
  row: Pick<ReportLateCancellation, 'cancelledAfterStart' | 'minutes'>,
): string => `${row.cancelledAfterStart ? 'หลังเริ่ม' : 'ก่อนเริ่ม'} ${row.minutes} นาที`

/**
 * An ISO instant as Bangkok wall time (UTC+7, no DST): `{ date: '2026-09-15', time: '13:00' }`.
 * Never the device's zone — a slot's hour is the school's hour wherever the operator's laptop is.
 */
export function bangkokParts(iso: string): { date: string; time: string } {
  const shifted = new Date(new Date(iso).getTime() + 7 * 3_600_000).toISOString()
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) }
}

/** `(+N ช่วง)` for a request with more than one late slot, else `''`. */
export const registryExtraSlots = (row: Pick<ReportLateCancellation, 'lateSlotCount'>): string =>
  row.lateSlotCount > 1 ? `(+${row.lateSlotCount - 1} ช่วง)` : ''

/** The SLA note line (AC-O11), copy verbatim from the brief. */
export function slaNote(sla: ReportSla): string {
  const x = sla.excluded
  return (
    `ไม่นับคำขอที่ระบบปฏิเสธอัตโนมัติเพราะเวลาชน (ADR-001) ${x.autoRejected} รายการ · ` +
    `คำขอที่ผู้ขอยกเลิกก่อนมีการพิจารณา ${x.withdrawn} รายการ · ` +
    `การจองที่เจ้าหน้าที่สร้างเอง ${x.staffCreated} รายการ · ` +
    `คำขอที่หมดอายุก่อนมีการพิจารณา ${x.expired} รายการ · ` +
    'เวลาพิจารณาของคำขอที่ถูกปฏิเสธเป็นค่าประมาณ'
  )
}

/** AC-O15: nothing requested and nothing held. */
export const isOperationsEmpty = (d: { requests: { total: number }; heldHours: number }): boolean =>
  d.requests.total === 0 && d.heldHours === 0
