import { Navigate, Route, Routes } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { AdminLoginPage } from '@/pages/admin/AdminLoginPage'
import { ForcePasswordChangePage } from '@/pages/admin/ForcePasswordChangePage'
import { LineUsersPage } from '@/pages/admin/LineUsersPage'
import { OptionsPage } from '@/pages/admin/OptionsPage'
import { ProfilePage } from '@/pages/admin/ProfilePage'
import { StaffPage } from '@/pages/admin/StaffPage'
import { DashboardLayout } from '@/components/admin/DashboardLayout'
import { FORCE_PASSWORD_CHANGE_PATH, ProtectedRoute } from '@/auth/ProtectedRoute'

/**
 * Route tree (design §5.1):
 *  - `/admin/login`                  → the admin login form.
 *  - `/admin/force-password-change`  → the forced reset screen. Protected (you
 *                                      must be signed in) but deliberately
 *                                      OUTSIDE `DashboardLayout`: while gated
 *                                      there is nowhere else to navigate to.
 *  - `/admin/dashboard/*`            → protected shell (sidebar + header) with
 *                                      the `line-users` / `options` / `staff` /
 *                                      `profile` nested pages.
 *  - `/*`                            → the existing Hello-World client
 *                                      placeholder, unchanged. Kept last so it
 *                                      only catches non-admin paths.
 */
function App() {
  return (
    <Routes>
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path={FORCE_PASSWORD_CHANGE_PATH}
        element={
          <ProtectedRoute>
            <ForcePasswordChangePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="line-users" replace />} />
        <Route path="line-users" element={<LineUsersPage />} />
        <Route path="options" element={<OptionsPage />} />
        <Route path="staff" element={<StaffPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="/*" element={<HomePage />} />
    </Routes>
  )
}

export default App
