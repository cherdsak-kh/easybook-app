import { createContext } from 'react'
import type { LoginResult, SystemRole } from '@/lib/api-client'

/** The session probe state machine (design §5.2). */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

/**
 * The subset of the logged-in admin the dashboard needs (name, role). Both
 * `SystemUserResponseDto` (from `getMe`) and `LoginResponseDto` (from `login`)
 * satisfy this shape, so either source can hydrate it without an extra request.
 */
export interface AdminUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: SystemRole
}

export interface AuthContextValue {
  status: AuthStatus
  user: AdminUser | null
  /** Attempt a login; on success sets the session state. Returns the raw result so the page can map errors. */
  login: (email: string, password: string) => Promise<LoginResult>
  /** Destroy the server session and clear local state. */
  logout: () => Promise<void>
  /** Re-run the `GET /auth/system/me` probe (e.g. after a mid-session 401). */
  refresh: () => Promise<void>
  /** Mark the session dead locally without a round-trip (used on a mid-session 401). */
  expireSession: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
