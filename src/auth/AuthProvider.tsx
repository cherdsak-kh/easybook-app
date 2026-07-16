import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  getMe,
  login as apiLogin,
  logout as apiLogout,
  type LoginResponse,
  type LoginResult,
  type SystemUser,
} from '@/lib/api-client'
import { AuthContext, type AdminUser, type AuthStatus } from './auth-context'

/** Narrow either DTO down to the fields the dashboard shows. */
function toAdminUser(u: SystemUser | LoginResponse): AdminUser {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    // `LoginResponseDto` has no `mustChangePassword`; only `GET /auth/system/me`
    // carries it. Absent → false, so a transient /me failure can never trap a
    // normal user on the reset screen. The server gate is the real control: a
    // genuinely gated user is 403'd everywhere and the next /me probe routes them.
    mustChangePassword: 'mustChangePassword' in u ? u.mustChangePassword : false,
  }
}

/**
 * Holds the back-office session state. On mount it probes `GET /auth/system/me`
 * exactly once; a 401 is a normal "unauthenticated" outcome (not an error), so
 * the dashboard never flashes before the probe resolves.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AdminUser | null>(null)

  const refresh = useCallback(async () => {
    const me = await getMe()
    if (me) {
      setUser(toAdminUser(me))
      setStatus('authenticated')
    } else {
      setUser(null)
      setStatus('unauthenticated')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const result = await apiLogin(email, password)
    if (result.ok) {
      // The login body cannot tell us whether this user is confined to the
      // force-reset screen (`LoginResponseDto` has no `mustChangePassword`), and
      // someone logging in with a temporary password is exactly the case that
      // matters. Re-probe /me — it is exempt from the server gate, so it always
      // answers — and fall back to the login body if that probe fails.
      const me = await getMe()
      setUser(toAdminUser(me ?? result.user))
      setStatus('authenticated')
    }
    return result
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiLogout()
    } finally {
      setUser(null)
      setStatus('unauthenticated')
    }
  }, [])

  const expireSession = useCallback(() => {
    setUser(null)
    setStatus('unauthenticated')
  }, [])

  const value = useMemo(
    () => ({ status, user, login, logout, refresh, expireSession }),
    [status, user, login, logout, refresh, expireSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
