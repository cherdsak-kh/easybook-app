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
import {
  SessionExpiredDialog,
  type SessionEndKind,
} from './components/feedback/SessionExpiredDialog'
import {
  AuthContext,
  type AuthStatus,
  type AuthValue,
  type SignInOutcome,
} from './lib/auth-context'
import { useTheme } from './lib/use-theme'

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

/**
 * `ACCOUNT_UNAVAILABLE` in `easybook-service/src/auth/auth.constants.ts`, spelled again because the
 * two repositories cannot import from each other (AUTH-401-REASON).
 *
 * ⚠️ THIS STRING IS AN INTERFACE. `SessionGuard` answers it for `USER_NOT_FOUND` / `USER_REVOKED`
 * and the anonymous-safe `Authentication required.` for everything else, which is the only channel
 * that carries the distinction: `ErrorResponseDto` is `{ statusCode, error, message }` with no
 * `code` field anywhere in that repo, and adding one for a single error was considered and rejected
 * there (see `MUST_CHANGE_PASSWORD`).
 *
 * If it is ever reworded on the server, this stops matching and every 401 falls back to the
 * `ended` copy — vaguer, never wrong. The failure direction was chosen: the opposite default would
 * tell somebody their account was deleted because a sentence changed.
 */
const ACCOUNT_UNAVAILABLE = 'Account is no longer active.'

export function AuthProvider({ children }: { children: ReactNode }) {
  /* Only for the session dialog's own `data-theme` wrapper below — the shell has its own. */
  const { resolved } = useTheme()
  const [status, setStatus] = useState<AuthStatus>('booting')
  const [user, setUser] = useState<SystemUser | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [sessionEndKind, setSessionEndKind] = useState<SessionEndKind>('ended')
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
   * ⚠️ IT MUST EJECT ON UNMOUNT, and the first version did not. `api` is a MODULE-LEVEL client
   * shared by the whole app, `use()` appends, and `/backend` is a lazy branch that unmounts
   * whenever the operator leaves it — so every re-entry left another copy behind for the life
   * of the tab. Measured before the fix: three round trips out of `/backend` and back
   * registered 6 middlewares and ejected 0.
   *
   * StrictMode is what surfaced it, by mounting, unmounting and mounting again on the first
   * load — which is exactly the case it exists to expose. With the cleanup in place that same
   * double-mount now nets out to one.
   */
  useEffect(() => {
    const watchForSessionDeath: Parameters<typeof api.use>[0] = {
      async onResponse({ request, response }) {
        if (response.status !== 401) return
        if (NOT_SESSION_DEATH.some((p) => request.url.includes(p))) return
        // Only while we believed we were signed in. A 401 during the boot probe is the normal
        // "not signed in" answer and must not raise a dialog over the login screen.
        if (statusRef.current !== 'authenticated') return

        /*
         * ⚠️ `clone()` FIRST, and read the copy. The caller still has to read this response — the
         * body is a one-shot stream, so consuming it here would leave `messageFrom()` with nothing
         * and turn every session-death 401 into an empty error message downstream.
         *
         * Awaited rather than fired off, so the dialog opens ALREADY saying the right thing. The
         * alternative — open on the generic copy and swap it a tick later — is a dialog whose
         * headline changes while somebody is reading it.
         */
        let kind: SessionEndKind = 'ended'
        try {
          const body = (await response.clone().json()) as { message?: unknown }
          if (body?.message === ACCOUNT_UNAVAILABLE) kind = 'account'
        } catch {
          // Not JSON, or already consumed elsewhere. `ended` is the safe answer — see the constant.
        }
        setSessionEndKind(kind)
        setSessionExpired(true)
      },
    }
    api.use(watchForSessionDeath)
    return () => api.eject(watchForSessionDeath)
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
      /*
       * ⚠️ NO NAVIGATION HERE, and that is on purpose after trying the other way. `BackendGate`
       * sends every anonymous session to the login URL already, remembering the page underneath —
       * so signing out of เจ้าหน้าที่ระบบ and back in returns to เจ้าหน้าที่ระบบ. A version of this
       * navigated to a bare `LOGIN_PATH` first, specifically so a deliberate logout would NOT be
       * remembered (a shared machine handed to the next person). Measured: the `from` was recorded
       * anyway — the status flip and the navigation do not land in one render the way that assumed
       * — and the honest fix was a flag on the auth context to force the asymmetry. One uniform
       * rule is worth more than the small surprise it avoids: the next operator lands on a page
       * their own session fetched, and one their own role is allowed to reach (`BackendLayout`
       * bounces the rest).
       */
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
          able to take the explanation with it.

          ⚠️ WHICH IS EXACTLY WHY IT NEEDS ITS OWN `data-theme`. Every other dialog in the portal
          is a descendant of the shell's themed wrapper; this one is a sibling of it, so it fell
          outside `[data-theme^="easybook-admin"] dialog { margin: auto; … }` — the rule that
          centres a native dialog, since Tailwind Preflight zeroes the `margin: auto` the UA
          stylesheet uses. Measured before the fix: `x: 0, y: 0`, `margin: 0px`, no themed
          ancestor — the panel sat in the top-left corner of the viewport.

          The wrapper also restores the TOKENS. `bg-base-100` and `text-base-content` resolve
          against the nearest `data-theme`, so without one the dialog painted in whatever theme
          the document root happened to carry (this app also serves the LIFF client) — the same
          root-scoping the CSS comment warns about, seen from the other side. */}
      <div data-theme={resolved}>
        <SessionExpiredDialog
          open={sessionExpired}
          kind={sessionEndKind}
          onRelogin={() => {
            setSessionExpired(false)
            /*
             * Going anonymous is all this does. `BackendGate` then redirects to the login URL and
             * remembers the page underneath, so signing back in returns to it — which matters more
             * here than anywhere else: the operator did not choose to leave, and the half-finished
             * screen still readable behind this dialog is exactly where they are going back to. A
             * full reload would work and would throw that away.
             */
            setUser(null)
            setStatus('anonymous')
          }}
        />
      </div>
    </AuthContext.Provider>
  )
}
