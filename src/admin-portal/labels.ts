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
import type { BadgeTone } from './components/ui/Badge'

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

/** `BookingStatus` — the five stored states a booking request moves through. */
export type BookingStatus = components['schemas']['AdminBookingRequestListItemDto']['status']

/** Where the request was TYPED: `LINE` (the LIFF form) or `ADMIN` (raised in the back office). */
export type BookingOrigin = components['schemas']['AdminBookingRequestListItemDto']['origin']

/**
 * ⚠️ FIVE STORED STATES. `EXPIRED` (หมดเวลาพิจารณา) is written by the server's expiry job when a
 * request is still pending at its first slot's start (`#ISSUE-06`). It is a stored value like the
 * other four — the screen never derives it from the clock.
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
  EXPIRED: 'หมดเวลาพิจารณา',
}

/**
 * The five hues, and they are shared with the tab strip's count pills on purpose: a count and the
 * rows it counts are one colour. Same reason `ACCESS_TONE` exists — `<Badge>` takes a tone and must
 * not learn what a `BookingStatus` is. `EXPIRED` is `slate`: a closed record nobody ruled on, so it
 * takes the neutral tone rather than any hue that reads as a decision.
 */
export const BOOKING_STATUS_TONE: Record<BookingStatus, BadgeTone> = {
  PENDING: 'amber',
  APPROVED: 'emerald',
  REJECTED: 'sky',
  CANCELLED: 'rose',
  EXPIRED: 'slate',
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

/** `FeedbackType` — which of the client form's two switches a report came through. */
export type FeedbackType = components['schemas']['FeedbackType']

/** `FeedbackStatus` — the stored state. `DISMISSED` is in the enum but has no screen (OQ-1). */
export type FeedbackStatus = components['schemas']['FeedbackStatus']

/**
 * The report's kind: its Thai name and the code pill's hue (`.fb-code-iss` red, `.fb-code-fdb`
 * sky). One table, so a code, a tab and a type chip can never disagree about which hue means what.
 */
export const FEEDBACK_TYPE: Record<FeedbackType, { label: string; code: 'fb-code-iss' | 'fb-code-fdb' }> = {
  ISSUE: { label: 'แจ้งปัญหาการใช้งาน', code: 'fb-code-iss' },
  FEEDBACK: { label: 'ข้อเสนอแนะ', code: 'fb-code-fdb' },
}

/**
 * The status vocabulary — tone plus a label PER TYPE.
 *
 * ⚠️ `RESOLVED` IS ONE STATE WITH TWO NAMES. A broken projector is `แก้ไขแล้ว`; a suggestion is
 * `รับทราบแล้ว`. Printing "แก้ไขแล้ว" on a suggestion claims somebody fixed an idea. Only the
 * status FILTER says both words (`แก้ไขแล้ว / รับทราบ`), because it spans both types.
 *
 * ⚠️ `DISMISSED` has no prototype label, state or badge (OQ-1): the API refuses to write it and the
 * UI never offers it. It is here only because the generated union contains it and this record must
 * be exhaustive — pending's tone and `ไม่ดำเนินการ`, per the design log (§5).
 */
export const FEEDBACK_STATUS: Record<
  FeedbackStatus,
  { tone: BadgeTone; label: Record<FeedbackType, string> }
> = {
  PENDING: { tone: 'amber', label: { ISSUE: 'รอดำเนินการ', FEEDBACK: 'รอดำเนินการ' } },
  IN_PROGRESS: { tone: 'sky', label: { ISSUE: 'กำลังดำเนินการ', FEEDBACK: 'กำลังดำเนินการ' } },
  RESOLVED: { tone: 'emerald', label: { ISSUE: 'แก้ไขแล้ว', FEEDBACK: 'รับทราบแล้ว' } },
  DISMISSED: { tone: 'amber', label: { ISSUE: 'ไม่ดำเนินการ', FEEDBACK: 'ไม่ดำเนินการ' } },
}

/** `AnnouncementStatus` — a row is created `DRAFT`; only the send makes it `SENT`. */
export type AnnouncementStatus = components['schemas']['AnnouncementStatus']

/** `AnnouncementFormat` — `TEXT` is a plain chat message, `FLEX` the card with a header band. */
export type AnnouncementFormat = components['schemas']['AnnouncementFormat']

/** `AnnouncementAudience` — everyone, or one กลุ่ม/ฝ่าย. */
export type AnnouncementAudience = components['schemas']['AnnouncementAudience']

/** `LineBotChatMode` — whether staff can answer the OA's chat by hand. */
export type LineBotChatMode = components['schemas']['LineBotChatMode']

/**
 * The status badge. `emerald`/`amber` are the portal's 10% washes — the prototype's
 * `badge-success`/`badge-warning` in its shim, NOT daisyUI's solid fills (design S-3).
 */
export const ANNOUNCEMENT_STATUS: Record<AnnouncementStatus, { label: string; tone: BadgeTone }> = {
  SENT: { label: 'ส่งแล้ว', tone: 'emerald' },
  DRAFT: { label: 'ฉบับร่าง', tone: 'amber' },
}

export const ANNOUNCEMENT_FORMAT: Record<AnnouncementFormat, string> = {
  TEXT: 'ข้อความธรรมดา',
  FLEX: 'การ์ดประกาศ',
}

/**
 * ⚠️ `DEPARTMENT` IS A PREFIX — the department's own name follows it (`กลุ่ม/ฝ่าย · ชื่อ`), and a
 * hard-deleted one reads `(ถูกลบแล้ว)`. See `audienceLabel` in the announcements page folder.
 */
export const ANNOUNCEMENT_AUDIENCE: Record<AnnouncementAudience, string> = {
  ALL: 'ผู้ใช้ LINE ทั้งหมด',
  DEPARTMENT: 'กลุ่ม/ฝ่าย',
}

/**
 * The reply mode and its status dot. `bot` is amber because in bot mode chat.line.biz cannot be
 * used to answer by hand — the one thing the card's link is there for.
 */
export const LINE_CHAT_MODE: Record<
  LineBotChatMode,
  { label: string; dot: 'status-success' | 'status-warning' }
> = {
  chat: { label: 'แชท (Chat Mode)', dot: 'status-success' },
  bot: { label: 'บอท (Bot Mode)', dot: 'status-warning' },
}

/**
 * A mode the enum does not list (LINE adding one) reads `ไม่ทราบ` with a neutral dot — never a
 * throw, never a blank. `dot` is `''`, so the caller's plain `status` stays the neutral grey.
 */
export function chatModeOf(mode: string): { label: string; dot: string } {
  const known = (LINE_CHAT_MODE as Record<string, { label: string; dot: string } | undefined>)[mode]
  return known ?? { label: 'ไม่ทราบ', dot: '' }
}
