import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { FullPageSpinner } from '@/components/Spinner'
import { useAuth } from './useAuth'

/**
 * Gate for `/admin/dashboard/*` (design §5.2):
 *  - `loading`        → render a spinner; do NOT render the dashboard and do NOT
 *                       redirect yet (no dashboard flash before the probe resolves).
 *  - `authenticated`  → render the protected children.
 *  - `unauthenticated`→ redirect to `/admin/login`, preserving the intended path
 *                       in router state so post-login can return the user here.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <FullPageSpinner label="Checking your session…" />
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/admin/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}
