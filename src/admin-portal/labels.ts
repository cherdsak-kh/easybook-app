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

/** `BookingStatus` — the four states a booking request moves through. */
export type BookingStatus = components['schemas']['AdminBookingRequestListItemDto']['status']

/** Where the request was TYPED: `LINE` (the LIFF form) or `ADMIN` (raised in the back office). */
export type BookingOrigin = components['schemas']['AdminBookingRequestListItemDto']['origin']

/**
 * ⚠️ FOUR STATES, NOT FIVE. "หมดอายุ" is not one of them: the server returns it as a derived
 * `isExpired` boolean on a row that is still `PENDING`, and adding a fifth entry here would be the
 * screen inventing a status the contract does not have.
 *
 * ⚠️ `ปฏิเสธ`/`ยกเลิก` are the tab labels too, and deliberately the same words — a count pill that
 * says ปฏิเสธ must name the same set as the badge in the สถานะ column, or the strip is describing a
 * table it does not match.
 */
export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: 'รอพิจารณา',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ปฏิเสธ',
  CANCELLED: 'ยกเลิก',
}

/**
 * The four hues, and they are shared with the tab strip's count pills on purpose: a count and the
 * rows it counts are one colour. Same reason `ACCESS_TONE` exists — `<Badge>` takes a tone and must
 * not learn what a `BookingStatus` is.
 */
export const BOOKING_STATUS_TONE: Record<BookingStatus, 'emerald' | 'amber' | 'sky' | 'rose'> = {
  PENDING: 'amber',
  APPROVED: 'emerald',
  REJECTED: 'sky',
  CANCELLED: 'rose',
}

/**
 * Who cancelled a slot — the enum `AdminBookingSlotDto.cancelledByRole` carries.
 *
 * ⚠️ THE TWO STAFF ROLES SHARE ONE WORD, and that is the contract's own framing rather than a
 * shortcut: the field answers "which DOMAIN cancelled this", the requester or the school, and the
 * matching id is deliberately not exposed (it points into one of two unbridged tables), so there is
 * no person to name. Printing `ผู้ดูแลระบบสูงสุด` here would announce a privilege level to answer a
 * question nobody asked — and it would read as the NAME of the person who dropped that Wednesday.
 */
export type BookingCancelledByRole = NonNullable<
  components['schemas']['AdminBookingSlotDto']['cancelledByRole']
>

export const BOOKING_CANCELLED_BY_LABEL: Record<BookingCancelledByRole, string> = {
  LINE_USER: 'ผู้จองยกเลิกเองผ่าน LINE',
  SUPER_ADMIN: 'เจ้าหน้าที่',
  ADMIN: 'เจ้าหน้าที่',
}

/**
 * The source chip in the ผู้ขอจอง column.
 *
 * ⚠️ `LINE` STAYS IN LATIN. It is the product's own name, not a word to translate, and the LIFF
 * surface, the sidebar and the registration screen all spell it that way.
 */
export const BOOKING_ORIGIN_LABEL: Record<BookingOrigin, string> = {
  LINE: 'LINE',
  ADMIN: 'เจ้าหน้าที่',
}
