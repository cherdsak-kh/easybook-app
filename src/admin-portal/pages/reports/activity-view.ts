/**
 * Hub 5's pure view model: how an `AuditEventDto` and the KPI block READ on screen. Everything the
 * components would otherwise decide inline lives here so the rules that carry meaning (who acted, what
 * "unknown" is called, what the KPI sentences say) are pinned by tests rather than by eyeballing.
 *
 * ⚠️ AN UNKNOWN IS NEVER INVENTED. The source (synthesis from existing columns, OQ-P3-1) cannot say who
 * rejected a request or who sent an announcement, and a deleted staff account loses its name. Each has
 * its own honest wording (AC-A10) and none of them ever becomes the "top operator" (AC-A4): rendering a
 * guess as a person on an audit trail is worse than a blank.
 *
 * ⚠️ FIELDS THE SOURCE CANNOT FILL ARE `null`, NOT PLACEHOLDERS. The page reads `capabilities` and hides
 * what is not recorded (the IP column, IP search, the IP and device rows) instead of printing dashes
 * under a column that can never have a value.
 */

import type { AuditActor, AuditChange, AuditEvent, AuditKpis } from '@/lib/api-client'
import { ROLE_LABEL, AUDIT_TARGET_KIND, type SystemRole } from '../../labels'
import type { AdminRouteLabel } from '../../routes'

export const ACTOR_UNRECORDED = 'ไม่ได้บันทึกผู้กระทำ'
export const ACTOR_DELETED = 'ไม่ทราบผู้กระทำ (บัญชีถูกลบ)'
export const NO_DEPARTMENT = 'ไม่ระบุกลุ่ม/ฝ่าย'
export const RESOURCE_UNRECORDED = 'ระบบยังไม่บันทึกการแก้ไขข้อมูลสถานที่'
export const NO_NOTE = 'ไม่ได้ระบุหมายเหตุ'
export const NO_CHANGES = 'ไม่มีข้อมูลก่อนและหลังการเปลี่ยนแปลง'

export interface ActorView {
  /** What to print. Already carries `(ลบแล้ว)` or the unknown wording. */
  name: string
  /** The role chip, or `null` when the source does not know it (the chip is then omitted, not guessed). */
  role: SystemRole | null
  /** The department line, or `null` when there is nothing true to say. */
  department: string | null
  position: string | null
  /** `false` for every unknown: never a candidate for "top operator" and never linkable. */
  known: boolean
}

/** AC-A10: how an actor renders in every state the source can produce. */
export function actorView(actor: AuditActor | null): ActorView {
  if (!actor) return { name: ACTOR_UNRECORDED, role: null, department: null, position: null, known: false }
  if (actor.state === 'HARD_DELETED') {
    // `role` survives only for CANCEL (it is the role AT THE TIME); a nulled FK has none.
    return { name: ACTOR_DELETED, role: actor.role, department: null, position: null, known: false }
  }
  const name = actor.name ?? ACTOR_UNRECORDED
  return {
    name: actor.state === 'SOFT_DELETED' ? `${name} (ลบแล้ว)` : name,
    role: actor.role,
    department: actor.department ?? NO_DEPARTMENT,
    position: actor.position,
    known: actor.name !== null,
  }
}

/** The dialog's `position · department` line. */
export function positionLine(v: ActorView): string | null {
  const parts = [v.position, v.department].filter((x): x is string => !!x)
  return parts.length ? parts.join(' · ') : null
}

// ── KPIs (range only, AC-A4) ────────────────────────────────────────────────────────────────────

/** KPI 1's sentence: an average over the range, or "since midnight" for one day. */
export function totalDesc(k: Pick<AuditKpis, 'total' | 'days'>): string {
  if (k.days > 1) {
    const avg = (Math.round((k.total / k.days) * 10) / 10).toFixed(1)
    return `เฉลี่ยวันละ ${avg} รายการ ใน ${k.days} วัน`
  }
  return 'ตั้งแต่เวลา 00.00 น. ของวันนี้'
}

/** KPI 2: approve + reject + cancel, and the direct bookings as a tail (they are not decisions). */
export function decisionsOf(k: Pick<AuditKpis, 'approve' | 'reject' | 'cancel' | 'directBooking'>): {
  count: number
  desc: string
} {
  return {
    count: k.approve + k.reject + k.cancel,
    desc:
      `อนุมัติ ${k.approve} · ปฏิเสธ ${k.reject} · ยกเลิก ${k.cancel}` +
      (k.directBooking > 0 ? ` · และจองแทนอีก ${k.directBooking} รายการ` : ''),
  }
}

/** KPI 3: `null` means the source records no venue changes, rendered `—` with its reason. */
export function resourceOf(k: Pick<AuditKpis, 'resourceChanges'>): { value: string; desc: string } {
  if (k.resourceChanges === null) return { value: '—', desc: RESOURCE_UNRECORDED }
  return {
    value: String(k.resourceChanges),
    desc:
      k.resourceChanges > 0
        ? 'แก้ไขข้อมูลสถานที่ (สถานะ ความจุ สิ่งอำนวยความสะดวก)'
        : 'ไม่มีการแก้ไขข้อมูลสถานที่ในช่วงนี้',
  }
}

/** KPI 4: the most active NAMED actor, or an empty card. */
export function topActorOf(k: Pick<AuditKpis, 'topActor'>): {
  name: string
  badge: string | null
  desc: string
} {
  const t = k.topActor
  if (!t) return { name: '—', badge: null, desc: '' }
  const v = actorView(t.actor)
  const parts = [
    t.actor.role ? ROLE_LABEL[t.actor.role] : null,
    t.actor.department ?? NO_DEPARTMENT,
    `${Math.round(t.percent)}% ของทั้งหมด`,
  ].filter((x): x is string => !!x)
  return { name: v.name, badge: `${t.count} รายการ`, desc: parts.join(' · ') }
}

// ── Toolbar and rows ────────────────────────────────────────────────────────────────────────────

export function searchPlaceholder(recordsIp: boolean): string {
  return recordsIp
    ? 'ค้นหารหัสคำขอ ชื่อเจ้าหน้าที่ รายละเอียด หรือ IP'
    : 'ค้นหารหัสคำขอ ชื่อเจ้าหน้าที่ หรือรายละเอียด'
}

export function searchLabel(recordsIp: boolean): string {
  return recordsIp
    ? 'ค้นหารหัสคำขอ ชื่อเจ้าหน้าที่ รายละเอียด หรือ IP Address'
    : 'ค้นหารหัสคำขอ ชื่อเจ้าหน้าที่ หรือรายละเอียด'
}

/** `ล้างตัวกรอง` shows only while something narrows the list. */
export function filtersActive(f: { q: string; action: string; actorId: string }): boolean {
  return f.q.trim() !== '' || f.action !== '' || f.actorId !== ''
}

/** The view button's `aria-label` (the prototype's). */
export function viewLabel(e: Pick<AuditEvent, 'id' | 'target'>, actionLabel: string): string {
  return `ดูรายละเอียด ${e.id} ${actionLabel} ${e.target.label}`
}

/** The empty-filter-miss paragraph, naming the range the miss happened in. */
export function noMatchDesc(rangeLabel: string): string {
  return `ไม่มีรายการใน${rangeLabel}ที่ตรงกับคำค้นหรือตัวกรองที่เลือก ลองล้างตัวกรองหรือขยายช่วงเวลา`
}

// ── Dialog ──────────────────────────────────────────────────────────────────────────────────────

export interface DiffRow {
  field: string
  before: string
  after: string
  changed: boolean
}

/** `null` = the source has no before/after (ACCOUNT). Changed rows are marked `เปลี่ยน`. */
export function diffRowsOf(changes: AuditChange[] | null): DiffRow[] | null {
  if (!changes || changes.length === 0) return null
  return changes.map((c) => ({ ...c, changed: c.before !== c.after }))
}

/**
 * The dialog's `ไปที่หน้า<owner>` link: ABSENT when this role cannot reach the owner's route (a button
 * that answers with a redirect is a capability promised and refused).
 */
export function gotoOf(
  e: Pick<AuditEvent, 'target'>,
  can: (label: AdminRouteLabel) => boolean,
): { label: string; owner: AdminRouteLabel } | null {
  const owner = AUDIT_TARGET_KIND[e.target.kind].owner
  return can(owner) ? { label: `ไปที่หน้า${owner}`, owner } : null
}

/** `คัดลอก JSON` copies the event as the API sent it. */
export function eventJson(e: AuditEvent): string {
  return JSON.stringify(e, null, 2)
}
