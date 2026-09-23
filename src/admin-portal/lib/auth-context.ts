/**
 * The signed-in back-office user, and the only thing that knows whether there is one.
 *
 * ⚠️ THE SESSION IS AN httpOnly COOKIE. The frontend never reads, stores or forwards a token,
 * and `GET /auth/system/me` is the ONLY way to find out whether one is live. A 401 there is a
 * normal "not signed in" answer, not an error to report.
 *
 * ⚠️ `mustChangePassword` IS AUTHORITATIVE ONLY FROM `/me`, never from the login response body.
 * The login DTO does not carry it, and a user signing in with a temporary password must be
 * re-probed — which is why `signIn` below always follows a 200 with a fresh probe rather than
 * trusting what it just got back. `/me` is exempt from the server's force-reset gate precisely
 * so that probe works while every other route answers 403.
 *
 * ⚠️ NONE OF THIS IS A SECURITY BOUNDARY. `SessionGuard` re-reads the user from the database on
 * every authenticated request, so a demotion, suspension or deletion takes effect on the
 * victim's NEXT request no matter what this module believes. Everything here decides what to
 * render; the server decides what is allowed.
 */

import { createContext, useContext } from 'react'
import type { SystemUser } from '@/lib/api-client'

export type AuthStatus = 'booting' | 'anonymous' | 'authenticated'

export interface AuthValue {
  status: AuthStatus
  /** Non-null exactly when `status === 'authenticated'`. */
  user: SystemUser | null
  /**
   * Sign in, then re-probe. Resolves with the outcome the login screen renders; it never
   * throws, because "wrong password" is an answer and not a failure.
   */
  signIn: (email: string, password: string) => Promise<SignInOutcome>
  /** Best-effort server logout; local state clears either way. */
  signOut: () => Promise<void>
  /** Re-read `/me` — used after a password change clears the force-reset gate. */
  refresh: () => Promise<void>
}

export type SignInOutcome =
  | { ok: true }
  /**
   * `kind` is what the SCREEN renders, mapped from the status by the provider so the copy has
   * one home. They are not interchangeable:
   *  · `credentials` — 401, and it is ONE message for unknown email, wrong password, suspended
   *    AND soft-deleted. Splitting it hands an attacker an account-enumeration oracle.
   *  · `csrf` — 403 here is a stale CSRF token, NOT a suspended account. The copy says reload,
   *    because that is what fixes it.
   *  · `rate` — 429, carrying `Retry-After`.
   *  · `unavailable` — 503, the session store. Must not read as a wrong password.
   *  · `network` — no response at all.
   */
  | { ok: false; kind: 'credentials' | 'csrf' | 'rate' | 'unavailable' | 'network'; retryAfterSeconds?: number }

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
