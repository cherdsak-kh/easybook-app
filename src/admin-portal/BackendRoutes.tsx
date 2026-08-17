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

import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider } from './AuthProvider'
import { BackendLayout } from './BackendLayout'
import { NotFound } from './components/feedback/NotFound'
import { useAuth } from './lib/auth-context'
import { BootScreen } from './pages/BootScreen'
import { ComingSoonPage } from './pages/ComingSoonPage'
import { ForcePasswordChangePage } from './pages/ForcePasswordChangePage'
import { LoginPage } from './pages/LoginPage'
import { useTheme } from './lib/use-theme'
import { ADMIN_PORTAL_ROUTES, HOME_PATH } from './routes'

/** The in-shell 404: a signed-in operator who followed a stale link. */
function ShellNotFound() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return (
    <NotFound
      variant="shell"
      path={pathname}
      onBack={() => void navigate(-1)}
      onHome={() => void navigate(HOME_PATH)}
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
            element={<ComingSoonPage route={route} />}
          />
        ))}

        {/* LAST, so it only catches genuinely unmatched paths under /backend. */}
        <Route path="*" element={<ShellNotFound />} />
      </Route>
    </Routes>
  )
}
