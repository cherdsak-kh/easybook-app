/**
 * The `/backend` branch, generated from `ADMIN_PORTAL_ROUTES`.
 *
 * ⚠️ THE 29 `<Route>`s ARE MAPPED, NEVER LISTED. A hand-written list is a second copy of the
 * route table, and the failure it produces is a menu row that 404s — or worse, a URL that works
 * while the menu says it does not exist. Adding a destination means adding a row to the table
 * and nothing else.
 *
 * ⚠️ Deep links work because these are real routes, not internal state: F5 on
 * `/backend/settings/positions` re-enters on `/backend/settings/positions`. That is a P2
 * acceptance criterion, and it is a property of routing this way rather than a feature to build.
 *
 * `index` redirects to `ภาพรวมระบบ` (`Q1`) with `replace`, so the redirect does not sit in the
 * history and turn "back" into a loop.
 *
 * As designed screens land in P3/P4 they replace their `ComingSoonPage` element one row at a
 * time — the prototype's `DESIGNED` map is that same idea, and the 2 undesigned destinations
 * keep rendering the stand-in until each is actually built.
 *
 * ⚠️ `LEGACY_REPORT_REDIRECTS` below (Phase 2, D-6) is a SEPARATE list, deliberately not rows in
 * `ADMIN_PORTAL_ROUTES` — a row there becomes a menu item and an ACL key, and these four URLs are
 * neither: they are old addresses for the two consolidated hubs, kept alive only so nothing
 * bookmarked before 28 ก.ย. 2569 breaks.
 */

import type { ReactElement } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider } from './AuthProvider'
import { BackendLayout } from './BackendLayout'
import { NotFound } from '@/components/shared/NotFound'
import { useAuth } from './lib/auth-context'
import { AnnouncementsPage } from './pages/announcements/AnnouncementsPage'
import { BookingCalendarPage } from './pages/bookings/BookingCalendarPage'
import { BookingRequestsPage } from './pages/bookings/BookingRequestsPage'
import { BootScreen } from './pages/login/BootScreen'
import { ComingSoonPage } from './pages/ComingSoonPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { FeedbackPage } from './pages/feedback/FeedbackPage'
import { IntegrationsPage } from './pages/settings/IntegrationsPage'
import { ForcePasswordChangePage } from './pages/password/ForcePasswordChangePage'
import { GuidePage } from './pages/help/GuidePage'
import { SupportPage } from './pages/help/SupportPage'
import { LineUsersPage } from './pages/line-users/LineUsersPage'
import { LoginPage } from './pages/login/LoginPage'
import { NotificationsPage } from './pages/notifications/NotificationsPage'
import { ChangePasswordPage } from './pages/password/ChangePasswordPage'
import { OptionsPage } from './pages/options/OptionsPage'
import { ProfilePage } from './pages/profile/ProfilePage'
import { SessionsPage } from './pages/profile/SessionsPage'
import { ActivityLogPage } from './pages/reports/ActivityLogPage'
import { ErrorLogPage } from './pages/reports/ErrorLogPage'
import { ExportPage } from './pages/reports/ExportPage'
import { ReportsOverviewPage } from './pages/reports/ReportsOverviewPage'
import { ReportsVenuesPage } from './pages/reports/ReportsVenuesPage'
import { ReportsOperationsPage } from './pages/reports/ReportsOperationsPage'
import { StaffPage } from './pages/staff/StaffPage'
import { VenuesPage } from './pages/venues/VenuesPage'
import { VersionPage } from './pages/version/VersionPage'
import { useTheme } from './lib/use-theme'
import {
  ADMIN_PORTAL_ROUTES,
  BACKEND_BASE,
  HOME_PATH,
  LOGIN_PATH,
  routeOf,
  urlOf,
  type AdminRoute,
  type AdminRouteLabel,
} from './routes'

/**
 * The destinations that have a real screen. Everything absent renders `ComingSoonPage`.
 *
 * The prototype's `DESIGNED` map is the same idea, and the reason it is a map rather than a
 * branch inside the loop is that this is the ONE place the two populations are distinguished —
 * so "which of the 26 are built (26 built, 0 coming soon)?" is answerable by reading a
 * single object.
 */
const DESIGNED: Partial<Record<AdminRouteLabel, (route: AdminRoute) => ReactElement>> = {
  // `Q1`'s `HOME_PATH` — where every sign-in lands. Reports & dashboard phase 1 (feature
  // `20260928_1535_reports_and_dashboard_phase1`): four vital cards, the room occupancy grid,
  // the pending queue (reusing คำขอจองสถานที่'s own dialogs) and the role-shaped system strip.
  ภาพรวมระบบ: (route) => <DashboardPage route={route} />,
  // Hub 1 — range-filtered KPIs, the volume trend and the top-5 venues. Same feature folder;
  // จุดคอขวด / ข้อสังเกตสำคัญ / สรุปรายการ and ส่งออกรายงาน are Phase 1 exclusions (D-11/D-12).
  ภาพรวมสถิติ: (route) => <ReportsOverviewPage route={route} />,
  // Hub 2 (Phase 2, feature `20260928_2040_reports_phase2_venues_and_operations`) — occupancy,
  // the 40-cell weekday heatmap, the per-venue table and ADR-001 clash analysis.
  'การใช้สถานที่และช่วงเวลา': (route) => <ReportsVenuesPage route={route} />,
  // Hub 3, same feature — department allocation, the purpose mix, the approval SLA and the
  // late-cancellation registry.
  'สถิติตามฝ่ายและการดำเนินงาน': (route) => <ReportsOperationsPage route={route} />,
  // Hubs 4–6 (reporting Phase 3, feature `20261003_0600_reports_phase3_export_activity_and_error_log`).
  // Each is gated by `BackendLayout` BEFORE it mounts (LOW-3: `decideAdminRoute`), so none of them fires
  // a request for a role that may not reach it: Hub 4 and Hub 5 are SUPER_ADMIN/ADMIN, Hub 6 is
  // SUPER_ADMIN only. Nothing here lists a role.
  ส่งออกรายงานราชการ: (route) => <ExportPage route={route} />,
  ประวัติการทำรายการ: (route) => <ActivityLogPage route={route} />,
  บันทึกข้อผิดพลาด: (route) => <ErrorLogPage route={route} />,
  ข้อมูลเวอร์ชันระบบ: (route) => <VersionPage route={route} />,
  โปรไฟล์: (route) => <ProfilePage route={route} />,
  เปลี่ยนรหัสผ่าน: (route) => <ChangePasswordPage route={route} />,
  // Reachable by all three roles (not in `VIEWER_DENY`) — a personal security view of the caller's OWN
  // sessions and login history (feature `20261004_2055_login_sessions_and_revocation`). Its two writes
  // are on the caller's own other devices, so nothing here is write-gated by role.
  ประวัติการเข้าสู่ระบบ: (route) => <SessionsPage route={route} />,
  // FOUR labels, ONE component — see `OptionsPage`'s header and the comment in `routes.ts`.
  // The two venue vocabularies joined on 25 ส.ค. 2569; everything that differs between the four is
  // a string (or a null) in `option-model.ts`, never a branch in the page.
  ตำแหน่งบุคลากร: (route) => <OptionsPage route={route} />,
  'กลุ่ม/ฝ่ายบุคลากร': (route) => <OptionsPage route={route} />,
  ประเภทสถานที่: (route) => <OptionsPage route={route} />,
  สิ่งอำนวยความสะดวก: (route) => <OptionsPage route={route} />,
  สถานที่จัดกิจกรรม: (route) => <VenuesPage route={route} />,
  เจ้าหน้าที่ระบบ: (route) => <StaffPage route={route} />,
  การลงทะเบียน: (route) => <LineUsersPage route={route} />,
  // Stage A of three: the shell (toolbar, table, cards, pager). The five dialogs land in B/C, in
  // this same component — the route does not change again.
  คำขอจองสถานที่: (route) => <BookingRequestsPage route={route} />,
  // The same records, laid out by day and room. Every write goes through คำขอจองสถานที่'s dialogs.
  'ปฏิทินการจอง': (route) => <BookingCalendarPage route={route} />,
  // Reachable by all three roles (not in `VIEWER_DENY`); only the dialog's update card is write-only.
  'ข้อเสนอแนะ/แจ้งปัญหา': (route) => <FeedbackPage route={route} />,
  // Read-only in phase 3, reachable by all three roles (not in `VIEWER_DENY`); only the create
  // button is write-only, and it only explains that creating arrives in phase 4.
  ประกาศและข่าวสาร: (route) => <AnnouncementsPage route={route} />,
  // SUPER_ADMIN and ADMIN only — in `VIEWER_DENY`, so `BackendLayout` refuses it for a VIEWER.
  // Simulated end to end until the integration endpoints exist; see the page's header.
  'การเชื่อมต่อระบบ': (route) => <IntegrationsPage route={route} />,
  // Reachable by all three roles (not in `VIEWER_DENY`); VIEWER's writes here touch only its own
  // receipts — read state and "delete for me" (Phase 1 D-3).
  'ดูการแจ้งเตือนทั้งหมด': (route) => <NotificationsPage route={route} />,
  // Reachable by all three roles (not in `VIEWER_DENY`). Static SOP content; its deep links are
  // filtered by the ACL AND by this very map (`isDesigned`), so it can never offer a button into a
  // stand-in — the guide asks "is this label in DESIGNED?" at render time, hence the lazy callback.
  คู่มือการใช้งาน: (route) => <GuidePage route={route} isDesigned={(label) => label in DESIGNED} />,
  // The 26th and last. Reachable by all three roles (not in `VIEWER_DENY`): health tiles from the two
  // existing system endpoints, a public Discord invite, and an incident form the backend relays to the
  // dev team's Discord. Renamed 5 ต.ค. 2569 (it used to name an in-school technical department).
  ติดต่อทีมผู้พัฒนา: (route) => <SupportPage route={route} />,
}

/**
 * D-6: the retired report URLs, redirected to the hub that absorbed them. THE ONLY place these
 * four paths may appear (AC-M1) — everywhere else in `src/`/`tests/` they were deleted with the
 * legacy route rows. Query and hash are DROPPED: the old pages were coming-soon stand-ins with no
 * query semantics, so there is nothing on the old URL worth carrying forward.
 *
 * `reports/activity` gets NO entry here — it is the SAME path, only renamed (ประวัติการทำรายการ,
 * ACL per `use-acl.ts`'s `VIEWER_DENY`), so the existing route row already serves it.
 */
const LEGACY_REPORT_REDIRECTS: readonly { from: string; to: AdminRouteLabel }[] = [
  { from: 'reports/bookings', to: 'การใช้สถานที่และช่วงเวลา' },
  { from: 'reports/venue-usage', to: 'การใช้สถานที่และช่วงเวลา' },
  { from: 'reports/registrations', to: 'สถิติตามฝ่ายและการดำเนินงาน' },
  { from: 'reports/feedback', to: 'สถิติตามฝ่ายและการดำเนินงาน' },
]

/** The in-shell 404: a signed-in operator who followed a stale link. */
function ShellNotFound() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return (
    <NotFound
      variant="shell"
      path={pathname}
      onBack={() => void navigate(-1)}
      homeTo={HOME_PATH}
    />
  )
}

/**
 * Where a successful sign-in lands.
 *
 * ⚠️ THE INTENDED DESTINATION TRAVELS IN HISTORY STATE, NOT IN THE URL (`Q14`, PO 22 ส.ค. 2569).
 * A `?next=` parameter would additionally survive a refresh — and pays for it with a login link
 * that carries a redirect target anyone can rewrite. State cannot be typed into an address bar,
 * so there is no link to craft and nothing to sanitise on the way in. What it costs is stated
 * plainly: F5 on the login screen forgets where you were headed and you land on ภาพรวมระบบ.
 *
 * ⚠️ IT IS VALIDATED ANYWAY, and not out of ceremony. State is app-written but it OUTLIVES the
 * app: it rides in the browser's history entry, comes back on Back/Forward, and is editable from
 * the console. Three answers are refused —
 *   · not a string        — nothing was remembered; a direct visit to `/backend/login`
 *   · not under `/backend/` — including the `//host` form, which a bare "starts with /" check reads
 *     as a path and the browser reads as another origin
 *   · the login screen itself — which would bounce here again, forever
 * — and all three fall back to ภาพรวมระบบ, the same place `Q1` sends a plain login.
 */
function returnToOf(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from
  if (typeof from !== 'string') return HOME_PATH
  if (!from.startsWith(`${BACKEND_BASE}/`)) return HOME_PATH
  if (from === LOGIN_PATH || from.startsWith(`${LOGIN_PATH}?`)) return HOME_PATH
  return from
}

/**
 * What the whole `/backend` branch renders, in four mutually exclusive states.
 *
 * ⚠️ THE URL AND THE SCREEN AGREE — and until 22 ส.ค. 2569 they did not. The login form used to
 * render IN PLACE at whatever address was asked for, which made a deep link survive for free but
 * left `/backend/staff` showing a login form: an address bar that reports a page nobody is on. It
 * is the one line of text a browser treats as the truth — bookmarks, shared links, history and a
 * password manager's saved-credential key all read it — so the portal had 31 different "login
 * pages" as far as any of them could tell. Signed out now redirects to `LOGIN_PATH` with `replace`,
 * and the destination is remembered separately; see `returnToOf`.
 *
 * ⚠️ `replace`, NEVER a push, in BOTH directions. The deep link must not stay in history behind
 * the login screen (Back would return to it and bounce straight out again), and the login screen
 * must not stay in history behind the page it just let you into (Back would land a signed-in
 * operator on a login form). Net effect of a signed-out arrival plus a sign-in: ONE history entry,
 * the page that was asked for.
 *
 * ⚠️ THE FORCED RESET STAYS IN PLACE — it gets no URL of its own, by PO ruling on the same day:
 * it is not a destination anyone may visit, it is a gate that opens for exactly one account state.
 * The consequence is accepted and named here rather than discovered later: while that screen is up
 * the address bar still says `/backend/login`.
 *
 * ⚠️ `booting` renders in place too, and must. It is the state of NOT KNOWING, so redirecting
 * from it would send every signed-in operator to the login URL on every page load and bounce them
 * back a tick later — the URL flicker version of the flash `Q2` already forbids on screen.
 */
function BackendGate() {
  const { status, user } = useAuth()
  const { resolved } = useTheme()
  const location = useLocation()
  const atLogin = location.pathname === LOGIN_PATH

  // ⚠️ The forced reset comes BEFORE the shell, not as a route inside it. With the flag set the
  // server answers 403 on everything but six routes, so a shell rendered here would be a portal
  // where nothing works and nothing says why.
  if (status === 'authenticated' && user?.mustChangePassword) {
    return (
      <div data-theme={resolved}>
        <ForcePasswordChangePage />
      </div>
    )
  }

  // Signed in, standing on the login URL: either the sign-in just succeeded, or someone typed it.
  // Both want the same thing, and `returnToOf` already answers the second with ภาพรวมระบบ.
  if (status === 'authenticated') {
    return atLogin ? <Navigate to={returnToOf(location.state)} replace /> : <ShellRoutes />
  }

  // Signed out anywhere else. `search` and `hash` ride along because a deep link's filters are
  // part of the destination — returning to `/backend/line-users` after asking for
  // `/backend/line-users?access=PENDING` is a different page as far as the operator is concerned.
  if (status === 'anonymous' && !atLogin) {
    return (
      <Navigate
        to={LOGIN_PATH}
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    )
  }

  // Boot and login carry the theme themselves — they render instead of, not inside, the shell,
  // and the stored preference has to apply before either paints.
  return (
    <div data-theme={resolved}>{status === 'booting' ? <BootScreen /> : <LoginPage />}</div>
  )
}

export function BackendRoutes() {
  return (
    <AuthProvider>
      <BackendGate />
    </AuthProvider>
  )
}

function ShellRoutes() {
  return (
    <Routes>
      <Route element={<BackendLayout />}>
        <Route index element={<Navigate to={HOME_PATH} replace />} />

        {ADMIN_PORTAL_ROUTES.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={
              // ⚠️ Keyed by LABEL, which is `AdminRouteLabel` — renaming a menu row breaks the
              // build rather than silently reverting its page to the stand-in. As P3/P4 land,
              // rows move out of `ComingSoonPage` one at a time; the table stays the only list.
              DESIGNED[route.label] ? (
                DESIGNED[route.label]!(route)
              ) : (
                <ComingSoonPage route={route} />
              )
            }
          />
        ))}

        {/* D-6: legacy report URLs → the hub that absorbed them, AFTER the table's own routes
            (so a live path always wins) and BEFORE `*` (so a stale bookmark redirects rather than
            404ing). Not a table row — see `LEGACY_REPORT_REDIRECTS`'s own comment. */}
        {LEGACY_REPORT_REDIRECTS.map((r) => (
          <Route
            key={r.from}
            path={r.from}
            element={<Navigate to={urlOf(routeOf(r.to)!)} replace />}
          />
        ))}

        {/* LAST, so it only catches genuinely unmatched paths under /backend. */}
        <Route path="*" element={<ShellNotFound />} />
      </Route>
    </Routes>
  )
}
