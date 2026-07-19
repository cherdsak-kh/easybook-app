import { Navigate, Route, Routes } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { AdminLoginPage } from '@/pages/admin/AdminLoginPage'
import { ForcePasswordChangePage } from '@/pages/admin/ForcePasswordChangePage'
import { LineUsersPage } from '@/pages/admin/LineUsersPage'
import { OptionsPage } from '@/pages/admin/OptionsPage'
import { ProfilePage } from '@/pages/admin/ProfilePage'
import { StaffPage } from '@/pages/admin/StaffPage'
import { DashboardLayout } from '@/components/admin/DashboardLayout'
import { ThemeLayout } from '@/components/ThemeLayout'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { DASHBOARD_CHILDREN, ROUTES } from '@/constants/routes'

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
          <Route index element={<Navigate to={DASHBOARD_CHILDREN.lineUsers} replace />} />
          <Route path={DASHBOARD_CHILDREN.lineUsers} element={<LineUsersPage />} />
          <Route path={DASHBOARD_CHILDREN.options} element={<OptionsPage />} />
          <Route path={DASHBOARD_CHILDREN.staff} element={<StaffPage />} />
          <Route path={DASHBOARD_CHILDREN.profile} element={<ProfilePage />} />
        </Route>
      </Route>
      <Route element={<ThemeLayout portal="client" />}>
        <Route path="/*" element={<HomePage />} />
      </Route>
    </Routes>
  )
}

export default App
