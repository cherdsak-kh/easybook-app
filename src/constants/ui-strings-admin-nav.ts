/**
 * User-facing copy for the **admin-portal side menu** — the 4 visible category headers,
 * the 2 collapsible group labels and **30** of the menu's 31 leaf labels. (The 31st is
 * `โปรไฟล์`, which is `PROFILE_STRINGS.navLabel` — see the note at the bottom of this
 * docstring for why it deliberately lives elsewhere.)
 *
 * Part of the **centralized-but-modularized** UI-string architecture: each
 * feature/surface owns a `src/constants/ui-strings-<feature>.ts` module exporting named
 * `as const` objects. This is a **back-office** module: never import it from a
 * client/LIFF component.
 *
 * It exists as its own module (rather than as literals inside `nav-config.tsx`) because
 * TWO files must render the SAME literal and they cannot import each other:
 *
 *  - `components/admin-portal/nav-config.tsx` — the sidebar labels, and
 *  - `components/admin-portal/routes.ts` — `ADMIN_PORTAL_STUB_ROUTES[].title`, which is
 *    what `AdminPortalStubPage` shows as the page heading.
 *
 * `nav-config.tsx` already imports `routes.ts`, so the labels cannot live there without a
 * cycle, and `routes.ts` must NOT import `nav-config.tsx` (that would drag all 33 heroicon
 * modules into the eager `App.tsx` chunk the anonymous LIFF client downloads). A shared,
 * dependency-free literal module is what keeps "the stub page title matches the menu item
 * you just clicked" true by construction.
 *
 * Deliberately **dependency-free** (literals only) for that same chunk-weight reason.
 *
 * NOTE: the `โปรไฟล์` leaf is deliberately NOT here — its label is
 * `PROFILE_STRINGS.navLabel`, shared with the navbar avatar dropdown so the two entry
 * points into `/admin-portal/profile` cannot be worded differently. It is a bespoke page,
 * not a stub, so it needs no title here either.
 *
 * This is **not** i18n: no locale, no `t()`. Thai literals, as everywhere else in the
 * back office.
 */
export const ADMIN_NAV_STRINGS = {
  /** Category headers. Rendered as a non-interactive daisyUI `menu-title`. */
  sections: {
    management: 'การบริหารจัดการ',
    reports: 'รายงานและสถิติ',
    settings: 'การตั้งค่า',
    support: 'ข้อมูลเพิ่มเติมและการสนับสนุน',
  },

  /** The two collapsible groups. Neither has a route of its own — they only expand. */
  groups: {
    account: 'บัญชีผู้ใช้งาน',
    system: 'การตั้งค่าระบบ',
  },

  /**
   * Leaf labels, keyed by the same name as the matching `ADMIN_PORTAL_ROUTES` entry.
   * Every one of these except `lineUsers` is also a stub page title.
   */
  items: {
    dashboard: 'ภาพรวมระบบ',

    bookingCalendar: 'ปฏิทินการจอง',
    bookingRequests: 'ข้อมูลคำขอจองสถานที่',
    announcements: 'ประกาศและข่าวสาร',
    venues: 'ข้อมูลสถานที่จัดกิจกรรม',
    holidays: 'จัดการวันหยุดและวันปิดปรับปรุง',
    /** The REAL LINE-user registration page (bespoke, not a stub). */
    lineUsers: 'ข้อมูลการลงทะเบียน',
    feedback: 'ข้อมูลการเสนอแนะ/แจ้งปัญหา',
    staff: 'ข้อมูลเจ้าหน้าที่ระบบ',

    reportsAnalytics: 'สถิติและบทวิเคราะห์',
    /** The REPORT. Distinct from the `bookingRequests` DATA page above — different
     *  segment (`reports/booking-requests`), different icon, no route collision. */
    reportsBookingRequests: 'คำขอจองสถานที่',
    reportsVenueUsage: 'การขอใช้สถานที่จัดกิจกรรม',
    reportsRegistrations: 'การลงทะเบียน',
    reportsFeedback: 'การเสนอแนะ/แจ้งปัญหา',
    reportsSystemUsage: 'การใช้งานระบบ',
    reportsErrorLogs: 'บันทึกข้อผิดพลาดระบบ',

    accountPassword: 'เปลี่ยนรหัสผ่าน',
    accountNotifications: 'ตั้งค่าการแจ้งเตือน',
    accountPrivacy: 'ความเป็นส่วนตัว',
    accountLoginHistory: 'ประวัติการเข้าสู่ระบบส่วนตัว',

    settingsBooking: 'ระบบการจอง',
    settingsVenueTypes: 'ประเภทสถานที่',
    settingsRoles: 'จัดการบทบาทและสิทธิ์',
    settingsDepartments: 'แผนกบุคลากร',
    settingsPersonnelRoles: 'ตำแหน่งบุคลากร',
    settingsMessageTemplates: 'เทมเพลตข้อความ',
    settingsIntegrations: 'การเชื่อมต่อระบบ',

    helpUserGuide: 'คู่มือการใช้งาน',
    helpContactSupport: 'ติดต่อฝ่ายเทคนิค',
    helpVersion: 'ข้อมูลเวอร์ชันระบบ',
  },
} as const
