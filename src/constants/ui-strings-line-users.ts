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
  empty: 'ไม่พบผู้ใช้ที่ตรงกับเงื่อนไข',
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
} as const

/**
 * Full `AppAccess` → { Thai label, daisyUI badge color } map (plan §3). Rendered as
 * `badge badge-soft ${colorClass}`. Deliberately NOT the shared English
 * `components/admin-portal/AccessBadge` (English labels, no `badge-soft`); that component is
 * left untouched — this page no longer imports it.
 */
export const STATUS_BADGE: Record<AppAccess, { readonly label: string; readonly colorClass: string }> = {
  ALLOWED: { label: 'อนุมัติแล้ว', colorClass: 'badge-success' },
  PENDING: { label: 'รออนุมัติ', colorClass: 'badge-warning' },
  BLOCKED: { label: 'ถูกระงับการใช้งาน', colorClass: 'badge-error' },
  UNREGISTERED: { label: 'ยังไม่ลงทะเบียน', colorClass: 'badge-ghost' },
}
