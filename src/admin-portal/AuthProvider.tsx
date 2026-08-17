/**
 * Probes `/auth/system/me` once on mount and holds the answer.
 *
 * ⚠️ `Q2` — THE LOGIN SCREEN MUST NOT APPEAR UNTIL `/me` HAS ACTUALLY ANSWERED. Rendering it
 * optimistically and swapping it for the shell a moment later shows a signed-in operator a
 * login form on every page load, which teaches them to start typing before the app has decided
 * — and then eats the keystrokes. `status: 'booting'` is what makes that impossible: there is
 * no third thing to render.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { api, getMe, login, logout, type SystemUser } from '@/lib/api-client'
import { SessionExpiredDialog } from './components/feedback/SessionExpiredDialog'
import {
  AuthContext,
  type AuthStatus,
  type AuthValue,
  type SignInOutcome,
} from './lib/auth-context'

/** 401/403/429/503 → what the login screen renders. Anything else is treated as unreachable. */
const outcomeOf = (status: number, retryAfter?: string | null): SignInOutcome => {
  const seconds = retryAfter ? Number(retryAfter) : NaN
  switch (status) {
    case 401:
      return { ok: false, kind: 'credentials' }
    case 403:
      return { ok: false, kind: 'csrf' }
    case 429:
      return {
        ok: false,
        kind: 'rate',
        retryAfterSeconds: Number.isFinite(seconds) && seconds > 0 ? seconds : undefined,
      }
    case 503:
      return { ok: false, kind: 'unavailable' }
    default:
      // ⚠️ Includes 0 — `api-client` reports an unreachable server that way. A 500 lands here
      // too, deliberately: "ลองใหม่อีกครั้ง" is the only useful instruction for both, and
      // inventing a distinct message for a bug the operator cannot act on is noise.
      return { ok: false, kind: 'network' }
  }
}

/**
 * The endpoints whose 401 is an ANSWER rather than a dead session.
 *
 * ⚠️ Getting this wrong in either direction is a real defect. `login` answering 401 means the
 * password was wrong — treating it as session death throws up "เซสชันหมดอายุ" over a login
 * form, which is nonsense. And the reset screen's wrong-current-password is a **400**, so it
 * never reaches here at all; that is a backend design decision this list depends on.
 */
const NOT_SESSION_DEATH = ['/auth/system/login', '/auth/system/csrf']

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('booting')
  const [user, setUser] = useState<SystemUser | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)
  const statusRef = useRef(status)
  statusRef.current = status

  /**
   * ONE place watches for session death, and it is here rather than in each caller.
   *
   * Every authenticated route re-reads the user server-side on every request (D-9), so a
   * deletion, suspension or demotion surfaces as a 401 on whatever the operator happened to do
   * next — which could be any of forty call sites. A per-caller check would be forty chances to
   * forget one, and the symptom of forgetting is a screen that silently stops working.
   *
   * Registered once, at module scope of this component's lifetime: `api.use` appends, so
   * re-registering on every render would stack middleware until the tab died.
   */
  useEffect(() => {
    api.use({
      onResponse({ request, response }) {
        if (response.status !== 401) return
        if (NOT_SESSION_DEATH.some((p) => request.url.includes(p))) return
        // Only while we believed we were signed in. A 401 during the boot probe is the normal
        // "not signed in" answer and must not raise a dialog over the login screen.
        if (statusRef.current !== 'authenticated') return
        setSessionExpired(true)
      },
    })
  }, [])

  const probe = useCallback(async () => {
    const me = await getMe()
    setUser(me)
    setStatus(me ? 'authenticated' : 'anonymous')
  }, [])

  useEffect(() => {
    void probe()
  }, [probe])

  const signIn = useCallback<AuthValue['signIn']>(
    async (email, password) => {
      // ⚠️ `login()` RETURNS a failure for anything the server answered, but THROWS when the
      // request never completed — and the CSRF pre-flight it runs first is the likeliest place
      // for that. Measured with the backend down: the promise rejected, `apply()` never ran,
      // and the login screen sat there having said nothing at all. The contract this hook
      // publishes is "never throws"; this is what makes it true.
      let result: Awaited<ReturnType<typeof login>>
      try {
        result = await login(email, password)
      } catch {
        return { ok: false, kind: 'network' }
      }
      if (!result.ok) return outcomeOf(result.status, result.retryAfter)

      // ⚠️ A 200 DOES NOT MEAN "you are in". `mustChangePassword` is not in the login body, and
      // if it is true every other route answers 403 — so the only honest next step is to ask
      // `/me`, which is also exactly what a page reload has to do anyway. Routing off the login
      // response instead would send a temp-password user to a shell that 403s on contact.
      await probe()
      return { ok: true }
    },
    [probe],
  )

  const signOut = useCallback(async () => {
    try {
      await logout()
    } finally {
      // Local state clears whether or not the server heard us. A failed logout that leaves the
      // operator apparently signed in is the one outcome nobody expects from that button.
      setUser(null)
      setStatus('anonymous')
    }
  }, [])

  const value = useMemo<AuthValue>(
    () => ({ status, user, signIn, signOut, refresh: probe }),
    [status, user, signIn, signOut, probe],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
      {/* Rendered as a SIBLING of the whole portal, not inside a page: the dialog outlives
          whatever route was showing when the session died, and a page unmounting must not be
          able to take the explanation with it. */}
      <SessionExpiredDialog
        open={sessionExpired}
        onRelogin={() => {
          setSessionExpired(false)
          // Drops to the login form in place, at the same URL — so signing back in returns to
          // the page they were on. A full reload would work too and would throw that away.
          setUser(null)
          setStatus('anonymous')
        }}
      />
    </AuthContext.Provider>
  )
}
