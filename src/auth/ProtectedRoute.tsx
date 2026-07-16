import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { FullPageSpinner } from '@/components/Spinner'
import { useAuth } from './useAuth'

/**
 * The forced password-change screen. Lives inside `ProtectedRoute` (you must be
 * signed in to reach it) but outside `DashboardLayout` (there is nothing to
 * navigate to while gated).
 */
export const FORCE_PASSWORD_CHANGE_PATH = '/admin/force-password-change'

/**
 * Gate for `/admin/dashboard/*` (design §5.2):
 *  - `loading`        → render a spinner; do NOT render the dashboard and do NOT
 *                       redirect yet (no dashboard flash before the probe resolves).
 *  - `authenticated`  → render the protected children.
 *  - `unauthenticated`→ redirect to `/admin/login`, preserving the intended path
 *                       in router state so post-login can return the user here.
 *
 * Plus the forced-reset redirect: while `mustChangePassword` is true the user is
 * sent to {@link FORCE_PASSWORD_CHANGE_PATH} and kept there. That route renders
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
    return <Navigate to="/admin/login" replace state={{ from: location }} />
  }

  if (user?.mustChangePassword && location.pathname !== FORCE_PASSWORD_CHANGE_PATH) {
    return <Navigate to={FORCE_PASSWORD_CHANGE_PATH} replace />
  }

  return <>{children}</>
}
