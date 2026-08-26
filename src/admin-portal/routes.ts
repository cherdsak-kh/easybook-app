/**
 * THE route table — every destination in the back-office, ported from the prototype's `ROUTES`.
 *
 * ⚠️ THESE ARE `react-router` PATHS, NEVER API PATHS. The backend's admin surface lives at
 * `/auth/system/*` and `/api/v1/system-users` — "system", never "admin". Importing this module
 * into `api-client.ts` couples two unrelated namespaces and breaks auth the first time one of
 * them moves.
 *
 * ⚠️ ORDER IS LOAD-BEARING. It is the sidebar's order, which is the PRODUCT's order (set by the
 * project on 11 ส.ค. 2569, การบริหารจัดการ resequenced by the PO on 26 ส.ค. 2569), and the
 * prototype keeps its table in the same sequence for one reason: this table is read as a picture
 * of the menu, and a table that disagrees with the menu is a table nobody can check against
 * anything.
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
    // ⚠️ SECOND, NOT FIFTH (PO, 26 ส.ค. 2569). It sat after สถานที่จัดกิจกรรม, which put the three
    // booking screens ahead of the gate that decides who may book at all — and registration is
    // upstream of every one of them: an unapproved LINE user cannot raise a request, so a queue
    // left unread here silently starves the queues below it.
    //
    // Moving it also RETIRED a measured cost recorded on the icon swap of 25 ส.ค. 2569: at position
    // five this row sat directly above เจ้าหน้าที่ระบบ, and `user-plus` beside `users` made two
    // adjacent person silhouettes. Three rows now separate them. Do not "restore" that pairing.
    label: 'การลงทะเบียน',
    path: 'line-users',
    group: 'การบริหารจัดการ',
    desc: 'ตรวจสอบและอนุมัติผู้ใช้ที่ลงทะเบียนผ่าน LINE',
  },
  {
    label: 'ปฏิทินการจอง',
    path: 'bookings/calendar',
    group: 'การบริหารจัดการ',
    desc: 'ดูตารางการจองสถานที่ทั้งหมดในมุมมองปฏิทิน',
  },
  {
    // ⚠️ THIS ROW ABSORBED A DESTINATION (PO, 24 ส.ค. 2569) and the `desc` below is the only
    // place that currently says so. There was a separate row after this one for the admin's own
    // bookings: `วันหยุด/วันปิดปรับปรุง` → renamed `จองและล็อกเวลา` once the PO described what it
    // actually did → dissolved into this row the same day.
    //
    // The rename is what exposed the problem rather than fixing it. Named for what it does —
    // putting a booking on the calendar with nobody asking — it was plainly the same act as
    // approving a request, minus the request. Two destinations for "a booking exists now",
    // differing only in who started it, makes the operator pick a screen before they have made a
    // decision.
    //
    // ⚠️ THE SECOND JOB IS NOT DESIGNED. The PO deferred it ("เดี๋ยวถึงเวลาออกแบบหน้านี้เราค่อยมา
    // คุยกัน"). Open, and genuinely open: does a staff-raised request need approval at all
    // (self-approval is not a review), does it go straight to booked, and how one list holds two
    // kinds of row. Do not answer these in a port.
    label: 'คำขอจองสถานที่',
    path: 'bookings/requests',
    group: 'การบริหารจัดการ',
    desc: 'ตรวจสอบ อนุมัติ หรือปฏิเสธคำขอจองที่ส่งเข้ามา และสร้างคำขอจองของเจ้าหน้าที่เอง',
  },
  {
    label: 'สถานที่จัดกิจกรรม',
    path: 'venues',
    group: 'การบริหารจัดการ',
    desc: 'จัดการรายการสถานที่ ความจุ และอุปกรณ์ที่ให้บริการ',
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
    // A NEW destination (PO, 24 ส.ค. 2569), and it exists because of a question the
    // สถานที่จัดกิจกรรม prototype could not answer: "อุปกรณ์ที่ให้บริการ เพิ่ม/ลบ/แก้ไข ต้องทำที่
    // ไหน". The honest answer was "nowhere" — the vocabulary was hard-coded in the venue form.
    //
    // Directly under ประเภทสถานที่ because the two are read together: both are the lists that
    // form picks from, and this pair is the answer to "where do I change this?" for both.
    //
    // ⚠️ In the prototype it is the FOURTH row of the shared options screen's `MODELS`, and the
    // first whose holders are not pointed at by a required FK — an amenity is a tick in a join
    // table, so deleting one drops the ticks instead of moving holders to a `ไม่พบ…` tombstone.
    // That distinction has to survive the port; it is the difference between a `SET`-style
    // cleanup and a required-FK reassignment on the server too.
    label: 'อุปกรณ์ที่ให้บริการ',
    path: 'settings/amenities',
    group: 'การตั้งค่าระบบ',
    desc: 'จัดการรายการอุปกรณ์และสิ่งอำนวยความสะดวกที่ติ๊กเลือกได้ตอนเพิ่มสถานที่',
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

/**
 * The login screen's own address (`Q14`, PO 22 ส.ค. 2569).
 *
 * ⚠️ DELIBERATELY NOT A ROW IN THE TABLE ABOVE. That table is the MENU: every row in it becomes a
 * sidebar link, a breadcrumb and an ACL key, and login is none of the three — it is the one screen
 * that exists precisely because there is no operator yet to build a menu for. A row here would put
 * "เข้าสู่ระบบ" in the sidebar of every signed-in session.
 *
 * ⚠️ IT IS ALSO NOT A `<Route>` INSIDE THE SHELL. `BackendGate` matches this path itself, before
 * the shell exists, because the shell is what a session HAS and this is the screen for not having
 * one. See the gate.
 */
export const LOGIN_PATH = `${BACKEND_BASE}/login`

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
