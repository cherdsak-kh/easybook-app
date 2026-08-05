// Ported from DashWind (daisyui-admin-dashboard-template) — MIT (c) 2022 Dashwind. See THIRD_PARTY_NOTICES.md
// Single source of the admin portal's react-router URL paths — NOT API paths.
import { ADMIN_NAV_STRINGS } from '@/constants/ui-strings-admin-nav'

/** Base of every admin-portal path — rebasing the back-office is a one-line edit here. */
const BASE = '/admin-portal'

/**
 * Absolute react-router paths (used by NavLink / Navigate). Every one of the sidebar's 31
 * leaves has a real route: `line-users` + `profile` have bespoke pages, and the other 29
 * render the shared `AdminPortalStubPage` (see `ADMIN_PORTAL_STUB_ROUTES`). The segment
 * tail of each path here matches the corresponding `ADMIN_PORTAL_STUB_ROUTES.segment`.
 *
 * Multi-segment tails (`reports/…`, `account/…`, `settings/…`, `help/…`) are deliberate:
 * they are legal as a single `<Route path>` string — `App.tsx`'s existing `.map()` handles
 * them with no nested-route refactor — and they keep otherwise-colliding names apart
 * (the `booking-requests` DATA page vs the `reports/booking-requests` REPORT).
 *
 * The DashWind leftovers (`transactions`, `charts`, `integration`, `calendar`,
 * `settings-billing`, `getting-started`, `features`, `components`) and the mock-data
 * `team` page were all deleted with the IA overhaul: those paths now match no route and
 * fall through to the GLOBAL `*` → `NotFoundPage`. `login` STAYS: it is the real, working
 * admin login page (just not a sidebar entry — the sidebar only renders inside the
 * authenticated shell).
 */
export const ADMIN_PORTAL_ROUTES = {
  base: BASE,
  login: `${BASE}/login`,

  /** Section 0 — no category header. Also the shell's `index` redirect target. */
  dashboard: `${BASE}/dashboard`,

  /** Section 1 — การบริหารจัดการ */
  bookingCalendar: `${BASE}/booking-calendar`,
  bookingRequests: `${BASE}/booking-requests`,
  announcements: `${BASE}/announcements`,
  venues: `${BASE}/venues`,
  holidays: `${BASE}/holidays`,
  lineUsers: `${BASE}/line-users`,
  feedback: `${BASE}/feedback`,
  staff: `${BASE}/staff`,

  /** Section 2 — รายงานและสถิติ */
  reportsAnalytics: `${BASE}/reports/analytics`,
  reportsBookingRequests: `${BASE}/reports/booking-requests`,
  reportsVenueUsage: `${BASE}/reports/venue-usage`,
  reportsRegistrations: `${BASE}/reports/registrations`,
  reportsFeedback: `${BASE}/reports/feedback`,
  reportsSystemUsage: `${BASE}/reports/system-usage`,
  reportsErrorLogs: `${BASE}/reports/error-logs`,

  /** Section 3a — การตั้งค่า › บัญชีผู้ใช้งาน */
  profile: `${BASE}/profile`,
  accountPassword: `${BASE}/account/password`,
  accountNotifications: `${BASE}/account/notifications`,
  accountPrivacy: `${BASE}/account/privacy`,
  accountLoginHistory: `${BASE}/account/login-history`,

  /** Section 3b — การตั้งค่า › การตั้งค่าระบบ */
  settingsBooking: `${BASE}/settings/booking`,
  settingsVenueTypes: `${BASE}/settings/venue-types`,
  settingsRoles: `${BASE}/settings/roles`,
  settingsDepartments: `${BASE}/settings/departments`,
  settingsPersonnelRoles: `${BASE}/settings/personnel-roles`,
  settingsMessageTemplates: `${BASE}/settings/message-templates`,
  settingsIntegrations: `${BASE}/settings/integrations`,

  /** Section 4 — ข้อมูลเพิ่มเติมและการสนับสนุน */
  helpUserGuide: `${BASE}/help/user-guide`,
  helpContactSupport: `${BASE}/help/contact-support`,
  helpVersion: `${BASE}/help/version`,
} as const

/**
 * Relative child segments under the shell mounted at `base`, for the two pages with a
 * bespoke component. React Router resolves these against the `AdminPortalLayout` parent
 * (`/admin-portal`), so `profile` -> `/admin-portal/profile`.
 *
 * Exactly two entries, by design: everything else in the menu is a placeholder generated
 * from `ADMIN_PORTAL_STUB_ROUTES`. `dashboard` is NOT here (its DashWind mock-data page
 * was deleted); the absolute `ADMIN_PORTAL_ROUTES.dashboard` STAYS because the sidebar
 * leaf and the shell's `index` redirect still target it.
 */
export const ADMIN_PORTAL_SEGMENTS = {
  lineUsers: 'line-users',
  profile: 'profile',
} as const

/** A menu target that renders the shared placeholder `AdminPortalStubPage`. */
export interface AdminPortalStubRoute {
  /** Relative segment under the shell (matches the tail of the absolute route). */
  readonly segment: string
  /** Page + card title. Reads the SAME literal the sidebar label does. */
  readonly title: string
}

/**
 * The 29 menu targets that have no bespoke page yet — each renders the shared
 * `AdminPortalStubPage` ("coming soon" placeholder), parameterised by `title`, so clicking
 * any sidebar item produces a real route transition without hand-writing 29 near-identical
 * files. **This array IS the route registration**: `App.tsx` generates one `<Route>` per
 * entry, so adding/removing an entry adds/removes the route.
 *
 * `line-users` + `profile` have real pages and are NOT here; `login` is a full-screen
 * sibling route (outside the shell) and is NOT here either.
 *
 * Titles come from `ADMIN_NAV_STRINGS` — the SAME literals `nav-config.tsx` renders as
 * sidebar labels — so the heading of the page you land on can never drift from the menu
 * item you just clicked.
 *
 * There is no `/admin-portal/404` route: any unknown `/admin-portal/*` path falls through
 * to the GLOBAL `*` → `NotFoundPage` in `App.tsx`, the single 404 surface for the whole app.
 */
export const ADMIN_PORTAL_STUB_ROUTES: readonly AdminPortalStubRoute[] = [
  { segment: 'dashboard', title: ADMIN_NAV_STRINGS.items.dashboard },

  { segment: 'booking-calendar', title: ADMIN_NAV_STRINGS.items.bookingCalendar },
  { segment: 'booking-requests', title: ADMIN_NAV_STRINGS.items.bookingRequests },
  { segment: 'announcements', title: ADMIN_NAV_STRINGS.items.announcements },
  { segment: 'venues', title: ADMIN_NAV_STRINGS.items.venues },
  { segment: 'holidays', title: ADMIN_NAV_STRINGS.items.holidays },
  { segment: 'feedback', title: ADMIN_NAV_STRINGS.items.feedback },
  { segment: 'staff', title: ADMIN_NAV_STRINGS.items.staff },

  { segment: 'reports/analytics', title: ADMIN_NAV_STRINGS.items.reportsAnalytics },
  { segment: 'reports/booking-requests', title: ADMIN_NAV_STRINGS.items.reportsBookingRequests },
  { segment: 'reports/venue-usage', title: ADMIN_NAV_STRINGS.items.reportsVenueUsage },
  { segment: 'reports/registrations', title: ADMIN_NAV_STRINGS.items.reportsRegistrations },
  { segment: 'reports/feedback', title: ADMIN_NAV_STRINGS.items.reportsFeedback },
  { segment: 'reports/system-usage', title: ADMIN_NAV_STRINGS.items.reportsSystemUsage },
  { segment: 'reports/error-logs', title: ADMIN_NAV_STRINGS.items.reportsErrorLogs },

  { segment: 'account/password', title: ADMIN_NAV_STRINGS.items.accountPassword },
  { segment: 'account/notifications', title: ADMIN_NAV_STRINGS.items.accountNotifications },
  { segment: 'account/privacy', title: ADMIN_NAV_STRINGS.items.accountPrivacy },
  { segment: 'account/login-history', title: ADMIN_NAV_STRINGS.items.accountLoginHistory },

  { segment: 'settings/booking', title: ADMIN_NAV_STRINGS.items.settingsBooking },
  { segment: 'settings/venue-types', title: ADMIN_NAV_STRINGS.items.settingsVenueTypes },
  { segment: 'settings/roles', title: ADMIN_NAV_STRINGS.items.settingsRoles },
  { segment: 'settings/departments', title: ADMIN_NAV_STRINGS.items.settingsDepartments },
  { segment: 'settings/personnel-roles', title: ADMIN_NAV_STRINGS.items.settingsPersonnelRoles },
  { segment: 'settings/message-templates', title: ADMIN_NAV_STRINGS.items.settingsMessageTemplates },
  { segment: 'settings/integrations', title: ADMIN_NAV_STRINGS.items.settingsIntegrations },

  { segment: 'help/user-guide', title: ADMIN_NAV_STRINGS.items.helpUserGuide },
  { segment: 'help/contact-support', title: ADMIN_NAV_STRINGS.items.helpContactSupport },
  { segment: 'help/version', title: ADMIN_NAV_STRINGS.items.helpVersion },
]
