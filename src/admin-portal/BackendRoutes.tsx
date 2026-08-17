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
import { BackendLayout } from './BackendLayout'
import { NotFound } from './components/feedback/NotFound'
import { ComingSoonPage } from './pages/ComingSoonPage'
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

export function BackendRoutes() {
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
