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
import type { AdminRouteLabel } from './routes'

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

/** The list's format badge AND the compose dialog's choice — one spelling (phase 4 A-1). */
export const ANNOUNCEMENT_FORMAT: Record<AnnouncementFormat, string> = {
  TEXT: 'ข้อความธรรมดา',
  FLEX: 'การ์ด Flex Message',
}

/**
 * ⚠️ `DEPARTMENT` IS A PREFIX — the department's own name follows it (`กลุ่ม/ฝ่าย · ชื่อ`), and a
 * hard-deleted one reads `(ถูกลบแล้ว)`. See `audienceLabel` in the announcements page folder.
 *
 * `ALL` is `บุคลากรทั้งหมด` since phase 4 (A-1): the audience is approved personnel, and the list row
 * and the compose dialog now say the same word for the same value.
 */
export const ANNOUNCEMENT_AUDIENCE: Record<AnnouncementAudience, string> = {
  ALL: 'บุคลากรทั้งหมด',
  DEPARTMENT: 'กลุ่ม/ฝ่าย',
}

/**
 * The compose dialog's กลุ่มผู้รับ CHOICES. `DEPARTMENT` is a whole option here, not a prefix, so it
 * needs its own words; `ALL` points at the map above so it has exactly one spelling.
 */
export const ANNOUNCEMENT_AUDIENCE_CHOICE: Record<AnnouncementAudience, string> = {
  ALL: ANNOUNCEMENT_AUDIENCE.ALL,
  DEPARTMENT: 'เฉพาะกลุ่ม/ฝ่าย',
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

/** `AdminNotificationCategory` — which part of the product a notification came from. */
export type NotificationCategory = components['schemas']['AdminNotificationCategory']

/**
 * One string per category — the tab caption on การแจ้งเตือน AND the row's `.nt-cat` tag (the
 * prototype's `CATS`). A row filed under คำขอจอง whose tag printed something else would be the tab
 * and the row disagreeing about which bucket the row is in.
 */
export const NOTIF_CATEGORY_LABEL: Record<NotificationCategory, string> = {
  BOOKING: 'คำขอจอง',
  REGISTRATION: 'การลงทะเบียน',
  FEEDBACK: 'ข้อเสนอแนะ',
  SYSTEM: 'ระบบและการเชื่อมต่อ',
}

/** `ReportPurposeCategory` — Hub 3's D-22 keyword-classifier output for a booking's free-text purpose. */
export type ReportPurposeCategory = components['schemas']['ReportPurposeCategory']

/**
 * The four real categories plus the fallback (D-22). `OTHER`'s label carries its own caveat
 * inline ("จัดหมวดไม่ได้") rather than relying on the card's footnote alone, since a bar can be
 * read on its own out of context.
 */
export const PURPOSE_CATEGORY_LABEL: Record<ReportPurposeCategory, string> = {
  TRAINING: 'การอบรมสัมมนาและพัฒนาบุคลากร',
  MEETING: 'การประชุมฝ่ายและงานบริหาร',
  STUDENT_ACTIVITY: 'กิจกรรมนักเรียน ชมรม และกีฬา',
  TEACHING: 'การเรียนการสอนและกิจกรรมเสริมหลักสูตร',
  OTHER: 'อื่น ๆ / จัดหมวดไม่ได้',
}

/** `ReportSlaBucket` — Hub 3's four decision-turnaround buckets (D-24). */
export type ReportSlaBucket = components['schemas']['ReportSlaBucket']

export const SLA_BUCKET_LABEL: Record<ReportSlaBucket, string> = {
  UNDER_2H: '< 2 ชม. (รวดเร็วมาก)',
  FROM_2H_TO_12H: '2–12 ชม. (มาตรฐาน)',
  FROM_12H_TO_24H: '12–24 ชม. (ภายใน 1 วันทำการ)',
  OVER_24H: '> 24 ชม. (เกินเกณฑ์)',
}

/**
 * `ReportCancellerKind` — who cancelled a slot in Hub 3's late-cancellation registry, already
 * collapsed server-side from `cancelledByRole` (D-25, DV-8): `LINE_USER` → `REQUESTER`,
 * `SUPER_ADMIN`/`ADMIN` → `STAFF`, anything else → `UNKNOWN`.
 */
export type ReportCancellerKind = components['schemas']['ReportCancellerKind']

export const CANCELLER_LABEL: Record<ReportCancellerKind, string> = {
  REQUESTER: 'ผู้ขอยกเลิก',
  STAFF: 'เจ้าหน้าที่ยกเลิก',
  UNKNOWN: '—',
}

/** `HealthServiceStatus` — the four system-strip chips (ภาพรวมระบบ, D-8). */
export type HealthServiceStatus = components['schemas']['HealthServiceStatus']

/**
 * ADMIN's one-word-per-service strip (AC-D17) AND `ยังไม่ได้ตั้งค่า` for a service Phase 1 has no
 * credentials for (D-8) — never a degradation, just a fact about configuration.
 */
export const HEALTH_STATUS_LABEL: Record<HealthServiceStatus, string> = {
  UP: 'ปกติ',
  DOWN: 'ขัดข้อง',
  NOT_CONFIGURED: 'ยังไม่ได้ตั้งค่า',
}

// ── Reports phase 3: Hub 4 (ส่งออกรายงานราชการ), Hub 5 (ประวัติการทำรายการ), Hub 6 (บันทึกข้อผิดพลาด) ──

/** `ReportTemplate` — Hub 4's three document forms. The PO's names (Phase 3 ruling), not the prototype's. */
export type ReportTemplate = components['schemas']['ReportTemplate']

export const REPORT_TEMPLATE_LABEL: Record<ReportTemplate, string> = {
  SUMMARY: 'แบบ 1 สรุปภาพรวม',
  LEDGER: 'แบบ 2 บัญชีคำขอจอง',
  VENUES: 'แบบ 3 สถิติรายสถานที่',
}

/** `AuditAction` — Hub 5's action vocabulary, in the prototype's order (`TYPE_ORDER`). */
export type AuditAction = components['schemas']['AuditAction']

/**
 * Hub 5's action badge. The four booking DECISIONS are filled-tint `Badge`s in the hues คำขอจองสถานที่
 * already gives those outcomes; the three administrative changes are the outlined neutral `.act-chip`,
 * so SHAPE (not an invented palette) separates "a decision about a booking" from "a change to the
 * system". `d` is the heroicons outline path, ported from the prototype's `ICO`.
 */
export const AUDIT_ACTION: Record<
  AuditAction,
  { label: string; tone: BadgeTone | 'chip'; d: string }
> = {
  APPROVE: {
    label: 'อนุมัติคำขอจอง',
    tone: 'emerald',
    d: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  REJECT: {
    label: 'ปฏิเสธคำขอจอง',
    tone: 'rose',
    d: 'M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  CANCEL: {
    label: 'ยกเลิกคำขอจอง',
    tone: 'amber',
    d: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
  },
  DIRECT_BOOKING: {
    label: 'สร้างการจองแทน',
    tone: 'sky',
    d: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5M12 12.75v4.5m2.25-2.25h-4.5',
  },
  VENUE_UPDATE: {
    label: 'แก้ไขข้อมูลสถานที่',
    tone: 'chip',
    d: 'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21',
  },
  ACCOUNT: {
    label: 'จัดการบัญชีผู้ใช้',
    tone: 'chip',
    d: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
  },
  BROADCAST: {
    label: 'ส่งประกาศข่าวสาร',
    tone: 'chip',
    d: 'M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46',
  },
}

/** The order the action `select` offers, filtered to what `capabilities.actions` says the source can produce. */
export const AUDIT_ACTION_ORDER: readonly AuditAction[] = [
  'APPROVE',
  'REJECT',
  'CANCEL',
  'DIRECT_BOOKING',
  'VENUE_UPDATE',
  'ACCOUNT',
  'BROADCAST',
]

/** The three decisions KPI 2 counts (`การตัดสินใจคำขอจอง`). */
export const AUDIT_DECISIONS: readonly AuditAction[] = ['APPROVE', 'REJECT', 'CANCEL']

/** `AuditTargetKind` — what an event's target IS, and which menu row owns it (the dialog's `ไปที่หน้า…`). */
export type AuditTargetKind = components['schemas']['AuditTargetKind']

export const AUDIT_TARGET_KIND: Record<AuditTargetKind, { label: string; owner: AdminRouteLabel }> = {
  BOOKING_REQUEST: { label: 'คำขอจองสถานที่', owner: 'คำขอจองสถานที่' },
  VENUE: { label: 'สถานที่', owner: 'สถานที่จัดกิจกรรม' },
  LINE_USER: { label: 'ผู้ใช้ LINE', owner: 'การลงทะเบียน' },
  STAFF_ACCOUNT: { label: 'บัญชีเจ้าหน้าที่', owner: 'เจ้าหน้าที่ระบบ' },
  ANNOUNCEMENT: { label: 'ประกาศ', owner: 'ประกาศและข่าวสาร' },
}

/** `IncidentSeverity` — Hub 6, in the file's status hues: CRITICAL red, ERROR amber, WARNING sky. */
export type IncidentSeverity = components['schemas']['IncidentSeverity']

export const INCIDENT_SEVERITY: Record<IncidentSeverity, { badge: string }> = {
  CRITICAL: { badge: 'badge-error' },
  ERROR: { badge: 'badge-warning' },
  WARNING: { badge: 'badge-info' },
}

export const INCIDENT_SEVERITY_ORDER: readonly IncidentSeverity[] = ['CRITICAL', 'ERROR', 'WARNING']

/**
 * `IncidentComponent` — where an incident came from. The label is English on purpose: these are the
 * names of the services an engineer greps for (`LINE OA`, `Cloudflare R2`), the prototype's own `COMPS`.
 * `API` is the one bucket the prototype lacks: an unattributed 500 had nowhere to go (plan D-19).
 */
export type IncidentComponent = components['schemas']['IncidentComponent']

export const INCIDENT_COMPONENT_LABEL: Record<IncidentComponent, string> = {
  LINE_OA: 'LINE OA',
  PRISMA_DB: 'Prisma / DB',
  CLOUDFLARE_R2: 'Cloudflare R2',
  REDIS: 'Redis',
  AUTH: 'Auth',
  API: 'API',
}

export const INCIDENT_COMPONENT_ORDER: readonly IncidentComponent[] = [
  'LINE_OA',
  'PRISMA_DB',
  'CLOUDFLARE_R2',
  'REDIS',
  'AUTH',
  'API',
]
