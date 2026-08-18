/**
 * What the เจ้าหน้าที่ระบบ dialogs are handed, and the four states a row can be in.
 *
 * ⚠️ THIS IS THE DIALOGS' OWN SHAPE, NOT `SystemUserResponseDto`, and that is deliberate for two
 * reasons. The dialogs are props-only (PO, 18 ส.ค. 2569) — they never call the API, so binding them
 * to a transport DTO would couple three components to a wire format for no gain. And the DTO cannot
 * express one of the four states anyway: see `deleted` below.
 *
 * The page maps `SystemUserResponseDto` → this on the way in. That mapping is the page's job
 * because only the page knows which request produced the row.
 */

import type { SystemRole } from '../../labels'

/** A ตำแหน่ง or กลุ่ม/ฝ่าย the form may offer. */
export interface StaffOption {
  id: number
  name: string
  /**
   * `isSystemReserved` — the System Developer's two rows. Only a SUPER_ADMIN may ASSIGN one, and
   * only a SUPER_ADMIN opens this form, so it is always offerable here; it goes in its own
   * `<optgroup>` because the reserved ตำแหน่ง sits two words from an ordinary "ผู้ดูแลระบบ".
   */
  reserved?: boolean
  /**
   * The tombstone rows (`ไม่พบตำแหน่ง` / `ไม่พบกลุ่ม/ฝ่าย`) that a required FK lands on when its
   * target is deleted. NOT a choice — filing somebody under "not found" on purpose is not
   * something this form may offer — but shown when it is ALREADY the value, because `<select>`
   * has no concept of "a value not in the list": omit it and the browser silently selects the
   * first option, which is a delete on one screen quietly rewriting a record on another.
   */
  fallback?: boolean
}

export interface StaffRecord {
  id: string
  email: string
  firstName: string
  lastName: string
  role: SystemRole
  personnelRole: StaffOption
  department: StaffOption
  phoneNumber: string | null
  profilePictureUrl: string | null
  isActive: boolean
  /** A temporary password is still outstanding. */
  mustChangePassword: boolean
  /**
   * ⚠️ NOT ON `SystemUserResponseDto`. The list endpoint takes a `status` filter whose values are
   * exactly these four, and it EXCLUDES soft-deleted rows unless `status=deleted` is asked for —
   * so the caller knows a row is deleted from the request it made, never from the row itself.
   * That works, and it is fragile: any future response mixing the two populations cannot be
   * rendered correctly. Recorded rather than worked around; the page sets this from its query.
   */
  deleted?: boolean
  lastLoginAt: string | null
  createdAt: string
  createdBy: { firstName: string; lastName: string } | null
}

export const fullName = (r: { firstName: string; lastName: string }) =>
  [r.firstName, r.lastName].filter(Boolean).join(' ').trim()

export type StaffState = 'active' | 'pending' | 'suspended' | 'deleted'

/**
 * ⚠️ THE ORDER IS THE CONTRACT. The server derives `status` the same way — `deleted` > `suspended`
 * > `pending` > `active` — so the badge this screen prints and the value the `status` filter
 * matches are the same fact. Two ladders in different orders would let a row be filtered as one
 * thing and labelled as another.
 */
export function stateOf(r: StaffRecord): StaffState {
  if (r.deleted) return 'deleted'
  if (!r.isActive) return 'suspended'
  if (r.mustChangePassword) return 'pending'
  return 'active'
}

/**
 * Four states, four badge tones. The tones are `<Badge>`'s, which knows nothing about staff —
 * translating a state into a colour is the page's job (CONVENTIONS §4 rule 3).
 */
export const STAFF_STATE: Record<
  StaffState,
  { label: string; tone: 'emerald' | 'amber' | 'rose' | 'slate' }
> = {
  active: { label: 'ใช้งานอยู่', tone: 'emerald' },
  pending: { label: 'รอตั้งรหัสผ่าน', tone: 'amber' },
  suspended: { label: 'ระงับการใช้งาน', tone: 'rose' },
  deleted: { label: 'ถูกลบแล้ว', tone: 'slate' },
}
