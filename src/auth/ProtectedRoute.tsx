import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { FullPageSpinner } from '@/components/Spinner'
import { ROUTES } from '@/constants/routes'
import { useAuth } from './useAuth'

/**
 * Gate for `{ROUTES.dashboard}/*` (design §5.2):
 *  - `loading`        → render a spinner; do NOT render the dashboard and do NOT
 *                       redirect yet (no dashboard flash before the probe resolves).
 *  - `authenticated`  → render the protected children.
 *  - `unauthenticated`→ redirect to {@link ROUTES.login}, preserving the intended
 *                       path in router state so post-login can return the user here.
 *
 * Plus the forced-reset redirect: while `mustChangePassword` is true the user is
 * sent to {@link ROUTES.forcePasswordChange} and kept there. That route renders
 * itself (the redirect skips its own path, so it cannot loop).
 *
 * This redirect is **UX, never the control**: the backend 403s every gated route
 * regardless of what the client does, so nothing here is load-bearing for
 * security — it exists so a gated user sees a usable screen instead of a wall of
 * 403s.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <FullPageSpinner label="Checking your session…" />
  }

  if (status === 'unauthenticated') {
    // `state.from` is the return path: AdminLoginPage reads it back and sends the
    // user to where they were headed. Dropping it fails silently (you get the
    // dashboard instead of the page you asked for), so it must stay.
    return <Navigate to={ROUTES.login} replace state={{ from: location }} />
  }

  if (user?.mustChangePassword && location.pathname !== ROUTES.forcePasswordChange) {
    return <Navigate to={ROUTES.forcePasswordChange} replace />
  }

  return <>{children}</>
}
