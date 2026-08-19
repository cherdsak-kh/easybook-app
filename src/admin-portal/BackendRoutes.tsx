/**
 * The `/backend` branch, generated from `ADMIN_PORTAL_ROUTES`.
 *
 * ⚠️ THE 31 `<Route>`s ARE MAPPED, NEVER LISTED. A hand-written list is a second copy of the
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
 * time — the prototype's `DESIGNED` map is that same idea, and the 24 undesigned destinations
 * keep rendering the stand-in until each is actually built.
 */

import type { ReactElement } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider } from './AuthProvider'
import { BackendLayout } from './BackendLayout'
import { NotFound } from '@/components/shared/NotFound'
import { useAuth } from './lib/auth-context'
import { BootScreen } from './pages/login/BootScreen'
import { ComingSoonPage } from './pages/ComingSoonPage'
import { ForcePasswordChangePage } from './pages/password/ForcePasswordChangePage'
import { LineUsersPage } from './pages/line-users/LineUsersPage'
import { LoginPage } from './pages/login/LoginPage'
import { ChangePasswordPage } from './pages/password/ChangePasswordPage'
import { OptionsPage } from './pages/options/OptionsPage'
import { ProfilePage } from './pages/profile/ProfilePage'
import { StaffPage } from './pages/staff/StaffPage'
import { VersionPage } from './pages/version/VersionPage'
import { useTheme } from './lib/use-theme'
import {
  ADMIN_PORTAL_ROUTES,
  HOME_PATH,
  type AdminRoute,
  type AdminRouteLabel,
} from './routes'

/**
 * The destinations that have a real screen. Everything absent renders `ComingSoonPage`.
 *
 * The prototype's `DESIGNED` map is the same idea, and the reason it is a map rather than a
 * branch inside the loop is that this is the ONE place the two populations are distinguished —
 * so "which of the 31 are built?" is answerable by reading a single object.
 */
const DESIGNED: Partial<Record<AdminRouteLabel, (route: AdminRoute) => ReactElement>> = {
  ข้อมูลเวอร์ชันระบบ: (route) => <VersionPage route={route} />,
  โปรไฟล์: (route) => <ProfilePage route={route} />,
  เปลี่ยนรหัสผ่าน: (route) => <ChangePasswordPage route={route} />,
  // TWO labels, ONE component — see `OptionsPage`'s header and the comment in `routes.ts`.
  ตำแหน่งบุคลากร: (route) => <OptionsPage route={route} />,
  'กลุ่ม/ฝ่ายบุคลากร': (route) => <OptionsPage route={route} />,
  เจ้าหน้าที่ระบบ: (route) => <StaffPage route={route} />,
  การลงทะเบียน: (route) => <LineUsersPage route={route} />,
}

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
 * What the whole `/backend` branch renders, in three mutually exclusive states.
 *
 * ⚠️ THE URL NEVER CHANGES. The login screen is rendered IN PLACE of the shell at whatever
 * address the operator asked for, rather than redirected to `/backend/login` and bounced back
 * afterwards. That is what makes a deep link survive a signed-out arrival for free: no
 * `?next=` parameter to round-trip, nothing to sanitise on the way back, and no window in which
 * a half-restored redirect target can point somewhere it should not.
 *
 * ⚠️ There is no fourth branch. `booting` exists precisely so nothing has to guess: rendering
 * the login form optimistically would flash it at every signed-in operator on every page load,
 * teaching them to start typing before the app has decided, and then eating the keystrokes.
 */
function BackendGate() {
  const { status, user } = useAuth()
  const { resolved } = useTheme()

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

  if (status === 'authenticated') return <ShellRoutes />

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

        {/* LAST, so it only catches genuinely unmatched paths under /backend. */}
        <Route path="*" element={<ShellNotFound />} />
      </Route>
    </Routes>
  )
}
