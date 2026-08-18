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
