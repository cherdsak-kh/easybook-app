// User-facing copy + status-badge map for the admin-portal "LINE User Registration Data"
// page. Part of the **centralized-but-modularized** UI-string architecture: instead of one
// monolithic dictionary, each feature/surface has its own `src/constants/ui-strings-<feature>.ts`
// module. This Thai back-office copy stays separate from the LIFF client copy
// (`ui-strings-client.ts`) so it can never leak to an end user's screen. It lives in a
// dedicated module (not inline in the page) so the page component file exports ONLY
// components (fast-refresh friendly) while the page and its tests still read the SAME literal
// — the convention that stops a copy edited out-of-band from silently reddening the suite
// (see the app CLAUDE.md note).
import type { AppAccess } from '@/lib/api-client'

export const T = {
  title: 'ข้อมูลการลงทะเบียน',
  searchLabel: 'ค้นหาจากชื่อที่แสดง',
  searchPlaceholder: 'ค้นหาผู้ใช้…',
  accessFilterLabel: 'กรองตามสถานะ',
  accessFilterAll: 'ทุกสถานะ',
  colIndex: 'ลำดับ',
  colName: 'ชื่อ-สกุล',
  colDepartment: 'ฝ่าย/แผนก',
  colPhone: 'เบอร์โทรศัพท์',
  colStatus: 'สถานะ',
  colRegisteredAt: 'วันที่ลงทะเบียน',
  colActions: 'การจัดการ',
  inspect: 'ตรวจสอบข้อมูล',
  unknownUser: 'ไม่ทราบชื่อ',
  notRegistered: 'ยังไม่ลงทะเบียน',
  emptyValue: '—',
  empty: 'ไม่พบข้อมูลการลงทะเบียน',
  paginationLabel: 'การแบ่งหน้า',
  paginationSummary: (page: number, totalPages: number, total: number) =>
    `หน้า ${page} จาก ${totalPages} · ทั้งหมด ${total} รายการ`,
  previous: 'ก่อนหน้า',
  next: 'ถัดไป',
  // Inspect modal (read-only).
  modalTitle: 'ข้อมูลการลงทะเบียน',
  close: 'ปิด',
  closeBackdrop: 'ปิดหน้าต่าง',
  fieldRealName: 'ชื่อ-สกุล',
  fieldStaffId: 'รหัสพนักงาน',
  fieldPhone: 'เบอร์โทรศัพท์',
  fieldDepartment: 'ฝ่าย/แผนก',
  fieldPersonnelRole: 'ตำแหน่ง',
  fieldFollowedAt: 'วันที่ลงทะเบียน',
  notRegisteredNotice: 'ผู้ใช้รายนี้ยังไม่ได้ลงทะเบียน',
  // Edit mode (Phase B).
  editTitle: 'แก้ไขข้อมูลการลงทะเบียน',
  edit: 'แก้ไข',
  save: 'บันทึก',
  saving: 'กำลังบันทึก…',
  cancel: 'ยกเลิก',
  labelFirstName: 'ชื่อ',
  labelLastName: 'นามสกุล',
  labelStaffId: 'รหัสพนักงาน',
  labelPhone: 'เบอร์โทรศัพท์',
  labelDepartment: 'ฝ่าย/แผนก',
  labelPersonnelRole: 'ตำแหน่ง',
  labelStatus: 'สถานะ',
  selectPlaceholder: 'เลือก…',
  optionsLoading: 'กำลังโหลดตัวเลือก…',
  // Reject ("ส่งคืนเพื่อตรวจสอบข้อมูลใหม่") — the dedicated mandatory-reason action. Deliberately
  // NOT a dropdown value: the status <select> is strictly ALLOWED/BLOCKED for both roles, and
  // REJECTED is reachable only through this action (which always carries a reason).
  reject: 'ส่งคืนเพื่อตรวจสอบข้อมูลใหม่',
  rejectTitle: 'ส่งคืนเพื่อตรวจสอบข้อมูลใหม่',
  rejectIntro:
    'ระบบจะส่งเหตุผลนี้ไปยัง LINE ของผู้ใช้ และผู้ใช้จะแก้ไขข้อมูลแล้วส่งกลับมาให้พิจารณาอีกครั้ง',
  rejectReasonLabel: 'เหตุผลการส่งคืน',
  rejectReasonPlaceholder: 'เช่น เบอร์โทรศัพท์ไม่ถูกต้อง กรุณากรอกใหม่',
  /** Live character counter under the reason textarea (`used/max`). */
  rejectReasonCounter: (used: number, max: number) => `${used}/${max}`,
  rejectSubmit: 'ยืนยันการส่งคืน',
  rejectSubmitting: 'กำลังส่ง…',
} as const

/**
 * Full `AppAccess` → { Thai label, daisyUI badge color } map (plan §3). Rendered as
 * `badge badge-soft ${colorClass}`. Deliberately NOT the shared English
 * `components/admin-portal/AccessBadge` (English labels, no `badge-soft`); that component is
 * left untouched — this page no longer imports it.
 *
 * `REJECTED` is `badge-warning`, NOT `badge-error`: `BLOCKED` already owns `badge-error` as
 * the terminal punitive state, whereas REJECTED is a *recoverable, action-needed* state that
 * sits in the same review loop as `PENDING` (which is also `badge-warning`). Same hue, and
 * the label carries the distinction.
 */

export const STATUS_BADGE: Record<AppAccess, { readonly label: string; readonly colorClass: string }> = {
  ALLOWED: { label: 'อนุมัติแล้ว', colorClass: 'badge-success' },
  PENDING: { label: 'รออนุมัติ', colorClass: 'badge-warning' },
  BLOCKED: { label: 'ถูกระงับการใช้งาน', colorClass: 'badge-error' },
  UNREGISTERED: { label: 'ยังไม่ลงทะเบียน', colorClass: 'badge-ghost' },
  REJECTED: { label: 'ส่งคืนแล้ว', colorClass: 'badge-warning' },
}

/**
 * Labels for the edit modal's status `<select>` ONLY. Deliberately a SECOND map, not a reuse
 * of {@link STATUS_BADGE}: the table badge is *state-voiced* ("อนุมัติแล้ว" — this is what the
 * user currently is), whereas a dropdown option is *action-voiced* ("อนุมัติ" — this is what
 * picking it will do). Same five states, two different grammatical jobs.
 *
 * A FULL `Record<AppAccess, string>` rather than a `Partial`: the leading disabled option
 * renders the user's CURRENT access, which can be any `AppAccess`, so a partial map would
 * type as `string | undefined` and need a fallback branch that could regress into rendering
 * `undefined`. The full record makes "no key missing" a compile-time guarantee — a future
 * `AppAccess` member breaks the build, which is the desired failure mode.
 *
 * `REJECTED` / `UNREGISTERED` intentionally mirror their badge labels: those two (plus
 * `PENDING`) are only ever reachable via the disabled placeholder, never as a target, so
 * mirroring keeps the placeholder's wording identical to the badge the operator just clicked.
 *
 * The toolbar access FILTER does NOT use this map — it stays on `STATUS_BADGE` so its options
 * match the badge text being filtered.
 */
export const MODAL_STATUS_LABELS: Record<AppAccess, string> = {
  PENDING: 'รออนุมัติ',
  ALLOWED: 'อนุมัติ',
  BLOCKED: 'ระงับการใช้งาน',
  REJECTED: 'ส่งคืนแล้ว',
  UNREGISTERED: 'ยังไม่ลงทะเบียน',
}
