import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { FullPageSpinner } from '@/components/Spinner'
import { UI_STRINGS } from '@/constants/ui-strings-backend'
import { useAuth } from './useAuth'

/**
 * Gate for the protected `/admin-portal/*` subtree:
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
 * ## Explicit login path per branch (R6 — Phase 5 cutover)
 * `loginPath` is **required** — with the legacy `/backend` portal deleted, there is
 * no single portal to default to, and an implicit default would be a footgun.
 * TypeScript now enforces that every consumer states its login path. The sole
 * caller (the `/admin-portal` branch) passes `loginPath={ADMIN_PORTAL_ROUTES.login}`
 * plus an explicit `forcePasswordChangePath={null}` to SKIP the force-reset redirect:
 * there is no in-app reset screen this phase (accepted lockout R2), and the server
 * still gates every mutation, so skipping the client redirect is a UX gap, not a
 * security hole. `null` (the default) means "no reset screen to point at".
 */
export function ProtectedRoute({
  children,
  loginPath,
  forcePasswordChangePath = null,
}: {
  children: ReactNode
  loginPath: string
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
