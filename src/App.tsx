import { Navigate, Route, Routes } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { AdminLoginPage } from '@/pages/admin/AdminLoginPage'
import { ForcePasswordChangePage } from '@/pages/admin/ForcePasswordChangePage'
import { DashboardOverviewPage } from '@/pages/admin/DashboardOverviewPage'
import { LineUsersPage } from '@/pages/admin/LineUsersPage'
import { OptionsPage } from '@/pages/admin/OptionsPage'
import { ProfilePage } from '@/pages/admin/ProfilePage'
import { StaffPage } from '@/pages/admin/StaffPage'
import { DashboardLayout } from '@/components/admin/DashboardLayout'
import { ThemeLayout } from '@/components/ThemeLayout'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { DASHBOARD_CHILDREN, ROUTES } from '@/constants/routes'
import { AdminPortalThemeLayout } from '@/components/admin-portal/AdminPortalThemeLayout'
import { AdminPortalLayout } from '@/components/admin-portal/AdminPortalLayout'
import { AdminPortalLoginPage } from '@/pages/admin-portal/AdminPortalLoginPage'
import { AdminPortalDashboardPage } from '@/pages/admin-portal/AdminPortalDashboardPage'
import { AdminPortalTeamPage } from '@/pages/admin-portal/AdminPortalTeamPage'
import { AdminPortalStubPage } from '@/pages/admin-portal/AdminPortalStubPage'
import {
  ADMIN_PORTAL_ROUTES,
  ADMIN_PORTAL_SEGMENTS,
  ADMIN_PORTAL_STUB_ROUTES,
} from '@/components/admin-portal/routes'

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
 */
function App() {
  return (
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
      {/* ADD-ONLY (Phase 3): the isolated DashWind replica. Open — no ProtectedRoute,
          no AuthProvider, no api-client. Mock/presentational only. Its own
          `AdminPortalThemeLayout` stamps the `dashwind-*` theme and a distinct
          `admin-portal-drawer` id keeps its drawer independent of the live shell.
          React Router ranks the concrete `/admin-portal/*` paths above the client
          `/*` catch-all, and the inner `*`→Navigate keeps the branch from ever
          falling through to the client portal. */}
      <Route element={<AdminPortalThemeLayout />}>
        <Route path={ADMIN_PORTAL_ROUTES.login} element={<AdminPortalLoginPage />} />
        <Route path={ADMIN_PORTAL_ROUTES.base} element={<AdminPortalLayout />}>
          <Route index element={<Navigate to={ADMIN_PORTAL_ROUTES.dashboard} replace />} />
          <Route path={ADMIN_PORTAL_SEGMENTS.dashboard} element={<AdminPortalDashboardPage />} />
          <Route path={ADMIN_PORTAL_SEGMENTS.team} element={<AdminPortalTeamPage />} />
          {/* Phase 3.5: every other DashWind menu target is a real route rendering the
              shared "coming soon" placeholder, so the whole sidebar is clickable. */}
          {ADMIN_PORTAL_STUB_ROUTES.map((stub) => (
            <Route
              key={stub.segment}
              path={stub.segment}
              element={<AdminPortalStubPage title={stub.title} />}
            />
          ))}
          <Route path="*" element={<Navigate to={ADMIN_PORTAL_ROUTES.dashboard} replace />} />
        </Route>
      </Route>
      <Route element={<ThemeLayout portal="client" />}>
        <Route path="/*" element={<HomePage />} />
      </Route>
    </Routes>
  )
}

export default App
