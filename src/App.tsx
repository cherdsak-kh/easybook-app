import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
// Eager (initial chunk): the anonymous LIFF client (`/*` → HomePage) and BOTH login
// screens must paint without waiting on a lazy chunk, so they stay statically imported.
// None of them pull in `chart.js`, so keeping them eager does not reintroduce the heavy
// dependency into the initial download (Phase 4 design §4).
import { HomePage } from '@/pages/HomePage'
import { AdminLoginPage } from '@/pages/admin/AdminLoginPage'
import { AdminPortalLoginPage } from '@/pages/admin-portal/AdminPortalLoginPage'
import { ThemeLayout } from '@/components/ThemeLayout'
import { AdminPortalThemeLayout } from '@/components/admin-portal/AdminPortalThemeLayout'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { DASHBOARD_CHILDREN, ROUTES } from '@/constants/routes'
import {
  ADMIN_PORTAL_ROUTES,
  ADMIN_PORTAL_SEGMENTS,
  ADMIN_PORTAL_STUB_ROUTES,
} from '@/components/admin-portal/routes'

// Lazy (route-split async chunks): every chart-bearing / heroicon-heavy page in BOTH
// portal branches is dynamically imported so `chart.js` + `react-chartjs-2` +
// `components/dashboard/*` are evicted from the initial chunk the LIFF client downloads
// (Phase 4 design §4). Each source uses a NAMED export, so the `.then(m => ({ default:
// m.X }))` adaptation is required — `React.lazy` resolves a module's `default`.
// Isolation note: dynamically importing a file does NOT edit it — `src/pages/admin/**`,
// `src/components/admin/**`, and `src/components/dashboard/**` stay byte-for-byte frozen.
const DashboardLayout = lazy(() =>
  import('@/components/admin/DashboardLayout').then((m) => ({ default: m.DashboardLayout })),
)
const DashboardOverviewPage = lazy(() =>
  import('@/pages/admin/DashboardOverviewPage').then((m) => ({ default: m.DashboardOverviewPage })),
)
const LineUsersPage = lazy(() =>
  import('@/pages/admin/LineUsersPage').then((m) => ({ default: m.LineUsersPage })),
)
const OptionsPage = lazy(() =>
  import('@/pages/admin/OptionsPage').then((m) => ({ default: m.OptionsPage })),
)
const StaffPage = lazy(() =>
  import('@/pages/admin/StaffPage').then((m) => ({ default: m.StaffPage })),
)
const ProfilePage = lazy(() =>
  import('@/pages/admin/ProfilePage').then((m) => ({ default: m.ProfilePage })),
)
const ForcePasswordChangePage = lazy(() =>
  import('@/pages/admin/ForcePasswordChangePage').then((m) => ({
    default: m.ForcePasswordChangePage,
  })),
)
const AdminPortalLayout = lazy(() =>
  import('@/components/admin-portal/AdminPortalLayout').then((m) => ({
    default: m.AdminPortalLayout,
  })),
)
const AdminPortalDashboardPage = lazy(() =>
  import('@/pages/admin-portal/AdminPortalDashboardPage').then((m) => ({
    default: m.AdminPortalDashboardPage,
  })),
)
const AdminPortalTeamPage = lazy(() =>
  import('@/pages/admin-portal/AdminPortalTeamPage').then((m) => ({
    default: m.AdminPortalTeamPage,
  })),
)
const AdminPortalLeadsPage = lazy(() =>
  import('@/pages/admin-portal/AdminPortalLeadsPage').then((m) => ({
    default: m.AdminPortalLeadsPage,
  })),
)
const AdminPortalStubPage = lazy(() =>
  import('@/pages/admin-portal/AdminPortalStubPage').then((m) => ({
    default: m.AdminPortalStubPage,
  })),
)
const AdminPortalNotFoundPage = lazy(() =>
  import('@/pages/admin-portal/AdminPortalNotFoundPage').then((m) => ({
    default: m.AdminPortalNotFoundPage,
  })),
)

/**
 * The single Suspense fallback for every lazily-loaded route chunk. A centered daisyUI
 * spinner. Because `HomePage` and both login pages stay eager, this never flashes on a
 * first-paint-critical screen (`/`, `/backend/login`, `/admin-portal/login`) — only
 * while a dashboard/inner page chunk is fetched.
 */
function RouteFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-base-200"
    >
      <span className="loading loading-spinner loading-lg text-primary" />
      <span className="sr-only">Loading…</span>
    </div>
  )
}

/**
 * Route tree (design §5.1). Paths come from `@/constants/routes` — the portal is
 * based at `/backend`, and rebasing it is one edit there, not a sweep here.
 *
 *  - `{ROUTES.login}`                → the admin login form.
 *  - `{ROUTES.forcePasswordChange}`  → the forced reset screen. Protected (you
 *                                      must be signed in) but deliberately
 *                                      OUTSIDE `DashboardLayout`: while gated
 *                                      there is nowhere else to navigate to.
 *  - `{ROUTES.dashboard}/*`          → protected shell (sidebar + header) with
 *                                      the `line-users` / `options` / `staff` /
 *                                      `profile` nested pages.
 *  - `/*`                            → the existing Hello-World client
 *                                      placeholder, unchanged. Kept LAST: React
 *                                      Router ranks specific paths above this
 *                                      catch-all, so the portal branch wins and
 *                                      `/*` only catches non-portal paths.
 *
 * Note the file tree still says `pages/admin` / `components/admin`. That is
 * deliberate: URL paths are not file paths, and only the URL was rebased.
 *
 * Each branch is wrapped in a pathless `ThemeLayout` layout route that stamps
 * the portal's daisyUI `data-theme` (admin emerald vs. client LINE-green) onto
 * the subtree. These wrappers are presentational only — they add no path
 * segment, so route specificity is unchanged and `/*` still ranks last.
 *
 * Phase 4: the chart-bearing dashboard pages of BOTH portal branches are code-split
 * (`React.lazy`) behind a single top-level `<Suspense>`, so the anonymous LIFF client
 * never eagerly downloads `chart.js`/`react-chartjs-2`. The trade-off (accepted, PO
 * sign-off): the real `/backend` dashboard shows a brief `RouteFallback` spinner on its
 * first paint after login while its chunk loads.
 */
function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<ThemeLayout portal="admin" />}>
          <Route path={ROUTES.login} element={<AdminLoginPage />} />
          <Route
            path={ROUTES.forcePasswordChange}
            element={
              <ProtectedRoute>
                <ForcePasswordChangePage />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.dashboard}
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardOverviewPage />} />
            <Route path={DASHBOARD_CHILDREN.lineUsers} element={<LineUsersPage />} />
            <Route path={DASHBOARD_CHILDREN.options} element={<OptionsPage />} />
            <Route path={DASHBOARD_CHILDREN.staff} element={<StaffPage />} />
            <Route path={DASHBOARD_CHILDREN.profile} element={<ProfilePage />} />
          </Route>
        </Route>
        {/* ADD-ONLY (Phase 3): the isolated DashWind replica. Phase 5.1 gates the shell:
            every `/admin-portal/*` route EXCEPT `/admin-portal/login` now requires a live
            admin session via the shared `ProtectedRoute`. The guard bounces an
            unauthenticated visitor to `/admin-portal/login` (loginPath) — NOT `/backend/login`
            — and is passed `forcePasswordChangePath={null}` so a `mustChangePassword` admin is
            admitted without a cross-portal force-reset bounce (this branch has no reset screen;
            the server still gates every mutation). `/admin-portal/login` stays OUTSIDE the guard
            so it remains reachable while unauthenticated (else redirect loop). Its own
            `AdminPortalThemeLayout` stamps the `dashwind-*` theme and a distinct
            `admin-portal-drawer` id keeps its drawer independent of the live shell.
            React Router ranks the concrete `/admin-portal/*` paths above the client
            `/*` catch-all; the inner `*` now renders the replica's own 404 page (Phase 4)
            instead of redirecting to the dashboard. */}
        <Route element={<AdminPortalThemeLayout />}>
          <Route path={ADMIN_PORTAL_ROUTES.login} element={<AdminPortalLoginPage />} />
          <Route
            path={ADMIN_PORTAL_ROUTES.base}
            element={
              <ProtectedRoute loginPath={ADMIN_PORTAL_ROUTES.login} forcePasswordChangePath={null}>
                <AdminPortalLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to={ADMIN_PORTAL_ROUTES.dashboard} replace />} />
            <Route path={ADMIN_PORTAL_SEGMENTS.dashboard} element={<AdminPortalDashboardPage />} />
            <Route path={ADMIN_PORTAL_SEGMENTS.team} element={<AdminPortalTeamPage />} />
            {/* Phase 3.6: the Leads menu target is now a bespoke ported page (not a stub). */}
            <Route path={ADMIN_PORTAL_SEGMENTS.leads} element={<AdminPortalLeadsPage />} />
            {/* Phase 3.5: every other DashWind menu target is a real route rendering the
                shared "coming soon" placeholder, so the whole sidebar is clickable. */}
            {ADMIN_PORTAL_STUB_ROUTES.map((stub) => (
              <Route
                key={stub.segment}
                path={stub.segment}
                element={<AdminPortalStubPage title={stub.title} />}
              />
            ))}
            {/* Phase 4: an unknown sub-path renders the ported 404 INSIDE the shell (the
                index route above still wins for the bare base → dashboard). */}
            <Route path="*" element={<AdminPortalNotFoundPage />} />
          </Route>
        </Route>
        <Route element={<ThemeLayout portal="client" />}>
          <Route path="/*" element={<HomePage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default App
