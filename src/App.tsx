import { Navigate, Route, Routes } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { AdminLoginPage } from '@/pages/admin/AdminLoginPage'
import { LineUsersPage } from '@/pages/admin/LineUsersPage'
import { StaffPage } from '@/pages/admin/StaffPage'
import { DashboardLayout } from '@/components/admin/DashboardLayout'
import { ProtectedRoute } from '@/auth/ProtectedRoute'

/**
 * Route tree (design §5.1):
 *  - `/admin/login`          → the admin login form.
 *  - `/admin/dashboard/*`    → protected shell (sidebar + header) with the
 *                              `line-users` / `staff` nested pages.
 *  - `/*`                    → the existing Hello-World client placeholder,
 *                              unchanged. Kept last so it only catches non-admin
 *                              paths.
 */
function App() {
  return (
    <Routes>
      <Route path="/admin/login" element={<AdminLoginPage />} />
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
        <Route path="staff" element={<StaffPage />} />
      </Route>
      <Route path="/*" element={<HomePage />} />
    </Routes>
  )
}

export default App
