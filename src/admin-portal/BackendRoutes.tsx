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
  BACKEND_BASE,
  HOME_PATH,
  LOGIN_PATH,
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

        {/* LAST, so it only catches genuinely unmatched paths under /backend. */}
        <Route path="*" element={<ShellNotFound />} />
      </Route>
    </Routes>
  )
}
