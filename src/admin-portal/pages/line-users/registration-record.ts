/**
 * What การลงทะเบียน's two dialogs are handed.
 *
 * Unlike เจ้าหน้าที่ระบบ's shape, this one mirrors `LineUserResponseDto` almost exactly, because
 * that DTO is complete for this screen — `access`, `registeredAt` and a nullable `registration`
 * carry every state the design has. It stays a local interface anyway: props-only components that
 * import a transport type are coupled to the wire for nothing.
 *
 * ⚠️ `registration: null` IS A STATE, not missing data. It is a LINE follower who never submitted
 * the form — `access: 'UNREGISTERED'` — and the screen treats it as its own case throughout: no
 * name to show, no fields to edit, no transition to offer.
 */

import type { AppAccess } from '../../labels'

export interface RegistrationDetails {
  firstName: string
  lastName: string
  phone: string
  departmentId: number
  department: string
  personnelRoleId: number
  personnelRole: string
}

export interface RegistrationRecord {
  /** `LineUser.id`, a cuid — the `PATCH /line-users/:id` target key. */
  id: string
  /** The LINE-side `U…` identifier. NOT `id`; the two are different values on one row. */
  lineUserId: string
  /** The name LINE holds. Belongs to LINE, not to us — shown, never edited. */
  displayName: string | null
  pictureUrl: string | null
  access: AppAccess
  /** Registration submission date. `null` for a follower who never registered — NOT `followedAt`. */
  registeredAt: string | null
  /**
   * ── The two operator-authored notes (contract, 19 ส.ค. 2569) ──
   *
   * Each is non-null only while the state it describes is in force, so a record can never carry
   * both. They feed the ONE amber line in ตรวจสอบผู้ลงทะเบียน.
   *
   * ⚠️ THE PROTOTYPE'S TWO NOTICES SAY MORE THAN THESE CAN. It writes "ส่งคืนให้ผู้ใช้แก้ไขเมื่อ
   * 4 ส.ค. 2569 · เหตุผล: …" and "ระงับการใช้งานเมื่อ 3 ส.ค. 2569 โดย EasyBook Administrator" —
   * the WHEN and the WHO. Neither exists in the database: there is no `rejectedAt`, no `blockedAt`
   * and no actor column, and the realtime `actor` is per-event, not stored. The port renders the
   * halves it can prove and drops the halves it cannot; the gap is written down in
   * `NEEDS_DESIGN.md` rather than filled in with a plausible date.
   */
  rejectionReason: string | null
  blockReason: string | null
  registration: RegistrationDetails | null
}

/** What a field shows when the record has nothing for it. */
export const DASH = '—'

/** An option a select may offer, resolved id → name by the page. */
export interface RegistrationOption {
  id: number
  name: string
}

export const registrantName = (r: RegistrationRecord) =>
  r.registration ? `${r.registration.firstName} ${r.registration.lastName}`.trim() : ''

/**
 * Who the confirm dialog is about.
 *
 * Falls back to the LINE identity, because an unregistered follower has no name of ours to use and
 * "ยืนยันการระงับ —" is a dialog that names nobody.
 */
export const whoOf = (r: RegistrationRecord) =>
  registrantName(r) || (r.displayName ? `LINE: ${r.displayName}` : `LINE: ${r.lineUserId}`)
