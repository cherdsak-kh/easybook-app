/**
 * THE route table — every destination in the back-office, ported from the prototype's `ROUTES`.
 *
 * ⚠️ THESE ARE `react-router` PATHS, NEVER API PATHS. The backend's admin surface lives at
 * `/auth/system/*` and `/api/v1/system-users` — "system", never "admin". Importing this module
 * into `api-client.ts` couples two unrelated namespaces and breaks auth the first time one of
 * them moves.
 *
 * ⚠️ ORDER IS LOAD-BEARING. It is the sidebar's order, which is the PRODUCT's order (set by the
 * project on 11 ส.ค. 2569), and the prototype keeps its table in the same sequence for one
 * reason: this table is read as a picture of the menu, and a table that disagrees with the menu
 * is a table nobody can check against anything.
 *
 * ⚠️ `label` IS THE JOIN KEY — for the sidebar row, the router, the breadcrumb and the ACL. One
 * string, one answer. Two copies of "what is this row called" is two answers waiting to diverge,
 * and the failure mode is a menu row that navigates somewhere it is not allowed to go, or hides
 * while staying reachable. `AdminRouteLabel` below turns that from a convention into a compile
 * error.
 *
 * 7 of the 31 have a design. The other 24 render the coming-soon stand-in, so it is impossible
 * to walk this file and come away thinking a screen exists when it does not.
 */

/** Where the whole back-office is mounted. Every `path` below is relative to this. */
export const BACKEND_BASE = '/backend'

export interface AdminRoute {
  /** The sidebar label. Also the key the ACL, the breadcrumb and the router all join on. */
  readonly label: string
  /** URL slug, relative to `BACKEND_BASE`. */
  readonly path: string
  /** The sidebar section, and therefore the breadcrumb parent. `''` = top level. */
  readonly group: string
  /**
   * What the page is FOR, in one line.
   *
   * On the coming-soon stand-in this is the ONLY thing on screen describing the destination, so
   * it is a sentence about the work — never "หน้านี้ยังไม่พร้อม", which the page already says
   * for itself, larger, right underneath.
   */
  readonly desc: string
}

export const ADMIN_PORTAL_ROUTES = [
  {
    label: 'ภาพรวมระบบ',
    path: 'dashboard',
    group: '',
    desc: 'สรุปคำขอจอง การใช้งานสถานที่ และสถานะของระบบในหน้าเดียว',
  },

  {
    label: 'ประกาศและข่าวสาร',
    path: 'announcements',
    group: 'การบริหารจัดการ',
    desc: 'เผยแพร่ประกาศและข่าวสารไปยังผู้ใช้ผ่าน LINE',
  },
  {
    label: 'ปฏิทินการจอง',
    path: 'bookings/calendar',
    group: 'การบริหารจัดการ',
    desc: 'ดูตารางการจองสถานที่ทั้งหมดในมุมมองปฏิทิน',
  },
  {
    label: 'คำขอจองสถานที่',
    path: 'bookings/requests',
    group: 'การบริหารจัดการ',
    desc: 'ตรวจสอบ อนุมัติ หรือปฏิเสธคำขอจองที่ส่งเข้ามา',
  },
  {
    label: 'สถานที่จัดกิจกรรม',
    path: 'venues',
    group: 'การบริหารจัดการ',
    desc: 'จัดการรายการสถานที่ ความจุ และอุปกรณ์ที่ให้บริการ',
  },
  {
    // ⚠️ `Q7` — this menu name is NOT settled. It stays as the prototype spells it until the PO
    // rules; see NEEDS_DESIGN. The `path` is unaffected either way.
    label: 'วันหยุด/วันปิดปรับปรุง',
    path: 'venues/closures',
    group: 'การบริหารจัดการ',
    desc: 'กำหนดวันที่ไม่เปิดให้จอง เช่น วันหยุดหรือช่วงปิดปรับปรุง',
  },
  {
    label: 'การลงทะเบียน',
    path: 'line-users',
    group: 'การบริหารจัดการ',
    desc: 'ตรวจสอบและอนุมัติผู้ใช้ที่ลงทะเบียนผ่าน LINE',
  },
  {
    label: 'เจ้าหน้าที่ระบบ',
    path: 'staff',
    group: 'การบริหารจัดการ',
    desc: 'จัดการบัญชีเจ้าหน้าที่ บทบาท และสิทธิ์การเข้าถึงระบบ',
  },
  {
    label: 'ข้อเสนอแนะ/แจ้งปัญหา',
    path: 'feedback',
    group: 'การบริหารจัดการ',
    desc: 'รับเรื่องข้อเสนอแนะและปัญหาการใช้งานจากผู้ใช้',
  },

  {
    label: 'ภาพรวมสถิติ',
    path: 'reports/overview',
    group: 'รายงานและสถิติ',
    desc: 'สรุปสถิติการใช้งานระบบในภาพรวม',
  },
  {
    label: 'รายงานคำขอจอง',
    path: 'reports/bookings',
    group: 'รายงานและสถิติ',
    desc: 'รายงานคำขอจองแยกตามช่วงเวลา สถานะ และสถานที่',
  },
  {
    label: 'รายงานการใช้สถานที่',
    path: 'reports/venue-usage',
    group: 'รายงานและสถิติ',
    desc: 'รายงานความถี่และช่วงเวลาที่แต่ละสถานที่ถูกใช้งาน',
  },
  {
    label: 'รายงานการลงทะเบียน',
    path: 'reports/registrations',
    group: 'รายงานและสถิติ',
    desc: 'รายงานจำนวนผู้ลงทะเบียนและสถานะการอนุมัติ',
  },
  {
    label: 'รายงานข้อเสนอแนะ',
    path: 'reports/feedback',
    group: 'รายงานและสถิติ',
    desc: 'รายงานเรื่องที่แจ้งเข้ามา แยกตามประเภทและสถานะ',
  },
  {
    label: 'รายงานการใช้งานระบบ',
    path: 'reports/activity',
    group: 'รายงานและสถิติ',
    desc: 'ประวัติการทำรายการของเจ้าหน้าที่ในระบบ',
  },
  {
    label: 'บันทึกข้อผิดพลาด',
    path: 'reports/error-log',
    group: 'รายงานและสถิติ',
    desc: 'บันทึกข้อผิดพลาดของระบบสำหรับตรวจสอบปัญหา',
  },

  {
    label: 'ระบบการจอง',
    path: 'settings/booking',
    group: 'การตั้งค่าระบบ',
    desc: 'ตั้งค่าเงื่อนไขการจอง เช่น ช่วงเวลาและขั้นตอนการอนุมัติ',
  },
  {
    label: 'ประเภทสถานที่',
    path: 'settings/venue-types',
    group: 'การตั้งค่าระบบ',
    desc: 'จัดการประเภทของสถานที่ที่เปิดให้จอง',
  },
  {
    // TWO labels, ONE screen — `settings/positions` and `settings/departments` are the same page
    // reading its model from the label, exactly as `OptionsService` serves both tables on the
    // server. `OptionsPage` does that; do not fork it into two components.
    //
    // ⚠️ ตำแหน่ง BEFORE กลุ่ม/ฝ่าย (PO, 18 ส.ค. 2569). THE ORDER OF THESE TWO OBJECTS IS THE ORDER
    // OF THE MENU — `Sidebar` filters this table by `group` and renders what it gets, so there is
    // no second list to keep in step and no way to reorder the menu except here.
    label: 'ตำแหน่งบุคลากร',
    path: 'settings/positions',
    group: 'การตั้งค่าระบบ',
    desc: 'จัดการรายการตำแหน่งของบุคลากรในโรงเรียน',
  },
  {
    label: 'กลุ่ม/ฝ่ายบุคลากร',
    path: 'settings/departments',
    group: 'การตั้งค่าระบบ',
    desc: 'จัดการรายการกลุ่ม/ฝ่ายของบุคลากรในโรงเรียน',
  },
  {
    label: 'เทมเพลตข้อความ',
    path: 'settings/message-templates',
    group: 'การตั้งค่าระบบ',
    desc: 'แก้ไขข้อความแจ้งเตือนที่ระบบส่งให้ผู้ใช้ผ่าน LINE',
  },
  {
    label: 'การเชื่อมต่อระบบ',
    path: 'settings/integrations',
    group: 'การตั้งค่าระบบ',
    desc: 'ตั้งค่าการเชื่อมต่อกับ LINE และบริการภายนอก',
  },

  {
    label: 'คู่มือการใช้งาน',
    path: 'help/guide',
    group: 'ช่วยเหลือ',
    desc: 'คู่มือและขั้นตอนการใช้งานระบบ รวมถึงบทบาทและสิทธิ์ของผู้ใช้แต่ละประเภท',
  },
  {
    label: 'ติดต่อฝ่ายเทคนิค',
    path: 'help/support',
    group: 'ช่วยเหลือ',
    desc: 'ช่องทางติดต่อผู้ดูแลระบบเมื่อพบปัญหาการใช้งาน',
  },
  {
    label: 'ข้อมูลเวอร์ชันระบบ',
    path: 'help/version',
    group: 'ช่วยเหลือ',
    desc: 'เวอร์ชันของระบบและประวัติการอัปเดตที่ผ่านมา',
  },

  {
    label: 'โปรไฟล์',
    path: 'profile',
    group: 'บัญชีผู้ใช้งาน',
    desc: 'ดูและแก้ไขข้อมูลส่วนตัวของบัญชีคุณ',
  },
  {
    label: 'เปลี่ยนรหัสผ่าน',
    path: 'profile/password',
    group: 'บัญชีผู้ใช้งาน',
    desc: 'ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ',
  },
  {
    label: 'ตั้งค่าการแจ้งเตือน',
    path: 'profile/notifications',
    group: 'บัญชีผู้ใช้งาน',
    desc: 'เลือกเรื่องที่ต้องการให้ระบบแจ้งเตือนคุณ',
  },
  {
    label: 'ความเป็นส่วนตัว',
    path: 'profile/privacy',
    group: 'บัญชีผู้ใช้งาน',
    desc: 'จัดการข้อมูลส่วนบุคคลและการยินยอมให้ใช้ข้อมูล',
  },
  {
    label: 'ประวัติการเข้าสู่ระบบ',
    path: 'profile/sessions',
    group: 'บัญชีผู้ใช้งาน',
    desc: 'ตรวจสอบอุปกรณ์และเวลาที่เข้าสู่ระบบล่าสุด',
  },

  {
    label: 'ดูการแจ้งเตือนทั้งหมด',
    path: 'notifications',
    group: 'การแจ้งเตือน',
    desc: 'รายการแจ้งเตือนทั้งหมดของบัญชีคุณ',
  },
] as const satisfies readonly AdminRoute[]

/**
 * The 31 labels as a union type.
 *
 * This is what makes `VIEWER_DENY` in `lib/use-acl.ts` impossible to typo. The prototype could
 * only warn about it in a comment — "a typo here is a menu row that never hides rather than a
 * silent half-grant" — and a silent half-grant is precisely the failure nobody notices, because
 * the row still works for the role that was supposed to lose it.
 */
export type AdminRouteLabel = (typeof ADMIN_PORTAL_ROUTES)[number]['label']

/**
 * A row of the table with its literal `label` intact.
 *
 * `AdminRoute` widens `label` back to `string`, which is right for a component that only prints
 * it — and wrong for anything that feeds it to `acl.can` or looks it up in a per-label map,
 * because that is exactly where the union is doing the work. Annotate with this type there.
 */
export type AdminRouteEntry = (typeof ADMIN_PORTAL_ROUTES)[number]

/** `Q1` — where login lands, and the one destination with no breadcrumb. */
export const HOME_LABEL: AdminRouteLabel = 'ภาพรวมระบบ'
export const HOME_PATH = `${BACKEND_BASE}/dashboard`

/** Absolute URL for a route. The one place `BACKEND_BASE` is concatenated. */
export const urlOf = (route: AdminRoute): string =>
  `${BACKEND_BASE}/${route.path}`

/** Lookup by label. `undefined` for anything not in the table — callers decide what that means. */
export const routeOf = (label: string): AdminRoute | undefined =>
  ADMIN_PORTAL_ROUTES.find((r) => r.label === label)

/**
 * Section headings, in sidebar order, with their rows.
 *
 * Derived from the table rather than written a second time: a hand-kept group list is the same
 * "two answers waiting to diverge" problem as a hand-kept label. The top-level route (`group: ''`)
 * comes back under the `''` key and the sidebar renders it above the first heading.
 */
export const ROUTE_GROUPS: readonly (readonly [string, readonly AdminRoute[]])[] =
  ADMIN_PORTAL_ROUTES.reduce<[string, AdminRoute[]][]>((acc, route) => {
    const last = acc[acc.length - 1]
    if (last && last[0] === route.group) last[1].push(route)
    else acc.push([route.group, [route]])
    return acc
  }, [])
