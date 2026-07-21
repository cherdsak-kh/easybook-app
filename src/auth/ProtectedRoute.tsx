import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { FullPageSpinner } from '@/components/Spinner'
import { ROUTES } from '@/constants/routes'
import { UI_STRINGS } from '@/constants/ui-strings-backend'
import { useAuth } from './useAuth'

/**
 * Gate for `{ROUTES.dashboard}/*` (design §5.2):
 *  - `loading`        → render a spinner; do NOT render the dashboard and do NOT
 *                       redirect yet (no dashboard flash before the probe resolves).
 *  - `authenticated`  → render the protected children.
 *  - `unauthenticated`→ redirect to `loginPath`, preserving the intended
 *                       path in router state so post-login can return the user here.
 *
 * Plus the forced-reset redirect: while `mustChangePassword` is true the user is
 * sent to `forcePasswordChangePath` and kept there. That route renders itself (the
 * redirect skips its own path, so it cannot loop).
 *
 * This redirect is **UX, never the control**: the backend 403s every gated route
 * regardless of what the client does, so nothing here is load-bearing for
 * security — it exists so a gated user sees a usable screen instead of a wall of
 * 403s.
 *
 * ## Parameterized for two portals (design §2)
 * `loginPath` and `forcePasswordChangePath` default to the `/backend` portal's
 * routes, so the existing `/backend` call sites (no props) behave **exactly** as
 * before. The `/admin-portal` branch passes its own `loginPath` and — because it
 * has no force-reset screen yet — an explicit `forcePasswordChangePath={null}` to
 * SKIP the force-reset redirect. `null` (not omission) is required: a defaulted
 * param cannot distinguish "omitted" from `undefined`, so omitting it would fall
 * back to the `/backend` default and cross-portal-bounce a `mustChangePassword`
 * admin into the wrong portal. The server still gates every mutation, so skipping
 * the client redirect is a UX gap, not a security hole.
 */
export function ProtectedRoute({
  children,
  loginPath = ROUTES.login,
  forcePasswordChangePath = ROUTES.forcePasswordChange,
}: {
  children: ReactNode
  loginPath?: string
  /** `null` (or empty) → skip the force-reset redirect for this branch. */
  forcePasswordChangePath?: string | null
}) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <FullPageSpinner label={UI_STRINGS.auth.checkingSession} />
  }

  if (status === 'unauthenticated') {
    // `state.from` is the return path: AdminLoginPage reads it back and sends the
    // user to where they were headed. Dropping it fails silently (you get the
    // dashboard instead of the page you asked for), so it must stay.
    return <Navigate to={loginPath} replace state={{ from: location }} />
  }

  if (
    forcePasswordChangePath &&
    user?.mustChangePassword &&
    location.pathname !== forcePasswordChangePath
  ) {
    return <Navigate to={forcePasswordChangePath} replace />
  }

  return <>{children}</>
}
