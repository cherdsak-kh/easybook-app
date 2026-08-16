/**
 * enum → คำไทย. The ONE exception to `Q9` (no `ui-strings-*` layer), and it is not copy:
 * these translate VALUES the API sends, not sentences a screen says.
 *
 * They live together because there is one enum, so there should be one spelling.
 * `ผู้ดูแลระบบสูงสุด` appears on the ACL switcher, the staff table, the profile card and
 * the version page's info block — spread inline across four files, the day the PO changes
 * the wording and one is missed the portal calls the same role two different things.
 *
 * ⚠️ Everything that is a SENTENCE stays inline in the page that renders it. This file is
 * ~40 lines and is not permission to start a strings layer.
 */

import type { components } from '@/lib/api-types'

/** `SystemRole` as the contract spells it — the only thing that grants privilege. */
export type SystemRole = components['schemas']['SystemUserResponseDto']['role']

/** `AppAccess` on a LINE user — what the registration queue moves through. */
export type AppAccess = components['schemas']['LineUserResponseDto']['access']

export const ROLE_LABEL: Record<SystemRole, string> = {
  SUPER_ADMIN: 'ผู้ดูแลระบบสูงสุด',
  ADMIN: 'เจ้าหน้าที่ดูแลระบบ',
  VIEWER: 'ผู้ดูข้อมูล',
}

/**
 * What each role can actually do, in the operator's words. Shown beside the role on the
 * staff form, where picking one is a decision rather than a label.
 */
export const ROLE_HINT: Record<SystemRole, string> = {
  SUPER_ADMIN:
    'เห็นและแก้ไขได้ทุกอย่างในระบบ รวมถึงเพิ่ม ลบ และเปลี่ยนบทบาทของบัญชีเจ้าหน้าที่ · ให้เฉพาะผู้ที่ดูแลระบบจริงเท่านั้น',
  ADMIN:
    'ทำงานประจำวันได้ทั้งหมด เช่น อนุมัติคำขอจอง จัดการผู้ลงทะเบียน และตั้งค่าระบบ · แต่เพิ่มหรือลบบัญชีเจ้าหน้าที่ไม่ได้',
  VIEWER: 'ดูข้อมูลได้อย่างเดียว แก้ไขอะไรไม่ได้เลย',
}

export const ACCESS_LABEL: Record<AppAccess, string> = {
  ALLOWED: 'อนุมัติแล้ว',
  PENDING: 'รออนุมัติ',
  REJECTED: 'ส่งคืนแล้ว',
  BLOCKED: 'ถูกระงับการใช้งาน',
  UNREGISTERED: 'ยังไม่ลงทะเบียน',
}

/**
 * Which badge tone each access value gets. Five states, five hues — deliberately NOT the
 * live app's mapping, which paints PENDING and REJECTED both amber and leaves "รออนุมัติ"
 * and "ส่งคืนแล้ว" the same colour. Those are the two an operator most has to tell apart:
 * one is waiting on THEM, the other is waiting on the user.
 *
 * This map is here rather than in `<Badge>` because `<Badge>` must not know what an
 * `AppAccess` is (CONVENTIONS §4 rule 3) — it takes a tone and nothing else.
 */
export const ACCESS_TONE: Record<AppAccess, 'emerald' | 'amber' | 'sky' | 'rose' | 'slate'> = {
  ALLOWED: 'emerald',
  PENDING: 'amber',
  REJECTED: 'sky',
  BLOCKED: 'rose',
  UNREGISTERED: 'slate',
}
