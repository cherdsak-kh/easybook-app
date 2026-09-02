import { useCallback, useEffect, useState } from 'react'
import type { BootStepKey, BootStepState, BootSteps, GateValue } from './gate-context'
import type { GateAccess } from '@/client-portal/routes'
import { getLineUserStatus } from '@/lib/api-client'
import type { LineUserRegistration, LineUserStatus } from '@/lib/api-client'
import { bootLiff, getFriendship, getIdToken, isLiffConfigured, isLoggedIn } from '@/lib/liff'

/**
 * The gate engine: four checks, twelve outcomes, one splash screen.
 *
 * Ported from the prototype's `playGate()` (2390) — but where the prototype *plays* a chosen
 * case against a timer, this runs the real thing: `liff.init()` → `liff.getFriendship()` →
 * `GET /line-users/status`. The twelve cases are what those three calls can conclude, not a
 * list of animations.
 *
 * ── 🔴 THE CHAIN STOPS AT THE FIRST STEP THAT IS NOT `pass` ──
 * `getFriendship()` is not called when LIFF never initialised, and `/line-users/status` is not
 * called when there is no ID token. Everything after the first non-`pass` step stays `wait`.
 * A spinner on a request that will never be sent is an invented fact, and the prototype's first
 * version shipped exactly that.
 *
 * ── The four checks and what each can conclude ──
 * | # | Step       | Call                     | Not-`pass` outcomes                     |
 * |---|------------|--------------------------|-----------------------------------------|
 * | 1 | `login`    | `bootLiff()` + session   | `line-down` · `not-logged-in` · `obs2`  |
 * | 2 | `friend`   | `getFriendship()`        | `not-friend`                            |
 * | 3 | `register` | `GET /line-users/status` | `status-down` · `unregistered`          |
 * | 4 | `status`   | (reads the response)     | `pending` · `rejected` · `blocked`      |
 *
 * ⚠️ STEP 3 IS THE CALL AND STEP 4 IS THE VERDICT — one request, two rows. That is why
 * `status-down` fails on the *register* row (`PAGE_INDEX.md` §2.1) even though it is the status
 * endpoint that broke: row 3 is "did we get an answer", row 4 is "what did it say".
 */

/** 🔴 Load-bearing. See the note on `runGate`'s floor at the bottom of this file. */
export const MIN_SPLASH_MS = 1500

const NO_STEPS: BootSteps = { login: 'wait', friend: 'wait', register: 'wait', status: 'wait' }

/** The Thai one-liner the `status` row ends with. Prototype `CASES[*].answer`. */
const ANSWER: Partial<Record<GateAccess, string>> = {
  allowed: 'อนุมัติแล้ว',
  pending: 'รออนุมัติ',
  rejected: 'ถูกส่งคืนให้แก้ไข',
  blocked: 'ถูกระงับการใช้งาน',
}

type Outcome = { access: GateAccess; status: LineUserStatus | null }

/**
 * `AppAccess` (the wire enum) → `GateAccess` (the routing vocabulary). One table, two callers:
 * the `status` step below, and {@link GateValue.applyStatus}, which adopts the body a register or
 * edit submit answers with. Written out rather than lower-cased, so a new backend value is a
 * compile error here instead of a route that silently does not exist.
 */
const ACCESS_OF: Record<LineUserStatus['access'], GateAccess> = {
  UNREGISTERED: 'unregistered',
  PENDING: 'pending',
  REJECTED: 'rejected',
  BLOCKED: 'blocked',
  ALLOWED: 'allowed',
}

/**
 * ── DEV-ONLY CASE OVERRIDE: `?gate=<case>` ──────────────────────────────────────────────────
 *
 * The prototype has a review bar that plays any of the twelve cases on demand, and
 * `PAGE_INDEX.md` §1.5 says do not port it — it is a review tool, not the product. This is the
 * part of it that the exit gate ("all 12 gate cases land on the right screen") cannot be checked
 * without, reduced to a query parameter with no UI at all.
 *
 * 🔴 THREE LOCKS, AND ALL THREE MATTER:
 *  1. `import.meta.env.DEV` — Vite replaces this with `false` in a production build, so the
 *     whole table and its reader are dead code the bundler drops. A shipped `?gate=allowed`
 *     would be an authentication bypass spelled as a URL.
 *  2. `!isLiffConfigured()` — never available when a real LINE channel is configured, so it can
 *     never shadow a real session's verdict during a tunnelled test from the LINE app.
 *  3. It NEVER calls the backend, for any case. `obs2` in particular must not
 *     (`CHECKLIST.md` Phase 2): the failure mode being guarded against is a mock that binds to
 *     *token presence* rather than to `isLiffConfigured()`, which lets a real, tokenless session
 *     fall into the mock path and report a registration that was never stored.
 *
 * ⚠️ It is read ONCE and cached at module scope, because the first thing the gate does on
 * settling is navigate — which drops the query string. Without the cache a forbidden deep link
 * would re-check for real and land somewhere else, which is a confusing way to discover that
 * your test instrument evaporated.
 */

/**
 * The registration the fixture cases below carry. Same person as the prototype's sample data
 * (`ROLES[0]`, `DEPTS[0]`, 2634), so a screen measured here can be held against the drawing.
 *
 * ⚠️ `phone` is stored as TEN BARE DIGITS, which is what the form submits — the `081-234-5678`
 * the prototype's summary shows is `fmtPhone()`'s doing, not the stored value. Keeping the
 * separators here would have made the summary look right while hiding a broken formatter.
 */
const DEV_REGISTRATION: LineUserRegistration = {
  id: 'dev-registration',
  firstName: 'สมชาย',
  lastName: 'ใจดี',
  phone: '0812345678',
  departmentId: 1,
  department: 'กลุ่มบริหารงานวิชาการ',
  personnelRoleId: 1,
  personnelRole: 'ครูผู้สอน',
  createdAt: '2026-09-01T03:00:00.000Z',
  updatedAt: '2026-09-01T03:00:00.000Z',
}

/** The prototype's reason text (735), so the `#/rejected` panel has the copy it was drawn with. */
const DEV_REJECTION = 'เบอร์โทรศัพท์ที่กรอกไม่สามารถติดต่อได้ กรุณาตรวจสอบและกรอกใหม่อีกครั้ง'

/**
 * ⚠️ A FIXTURE `status` IS PART OF THE OVERRIDE, NOT A SECOND MECHANISM. `/pending`, `/rejected`
 * and `/register`-in-edit-mode all render the registration the status call returned; without a
 * payload the override would reach those three screens and then show them empty, which measures
 * nothing. It is the same object the real call produces, typed as `LineUserStatus`, so a shape
 * that drifts from the contract is a compile error rather than a screen that quietly differs.
 *
 * 🔴 It is still NOT a backend. Nothing here proves a real `POST`/`PATCH` is accepted — that is
 * the Phase 3 exit gate's "against the real API", and it needs a tunnelled LINE session.
 */
const DEV_STATUS: Record<string, LineUserStatus> = {
  allowed: { access: 'ALLOWED', registration: DEV_REGISTRATION, rejectionReason: null },
  pending: { access: 'PENDING', registration: DEV_REGISTRATION, rejectionReason: null },
  rejected: { access: 'REJECTED', registration: DEV_REGISTRATION, rejectionReason: DEV_REJECTION },
  blocked: { access: 'BLOCKED', registration: DEV_REGISTRATION, rejectionReason: null },
  /* No registration yet — this is the case that must render an EMPTY form. */
  unregistered: { access: 'UNREGISTERED', registration: null, rejectionReason: null },
}

const DEV_CASES: Record<string, { steps: BootSteps; access?: GateAccess }> = {
  allowed: { steps: { login: 'pass', friend: 'pass', register: 'pass', status: 'pass' }, access: 'allowed' },
  pending: { steps: { login: 'pass', friend: 'pass', register: 'pass', status: 'pass' }, access: 'pending' },
  rejected: { steps: { login: 'pass', friend: 'pass', register: 'pass', status: 'pass' }, access: 'rejected' },
  blocked: { steps: { login: 'pass', friend: 'pass', register: 'pass', status: 'pass' }, access: 'blocked' },
  unregistered: { steps: { login: 'pass', friend: 'pass', register: 'action', status: 'wait' }, access: 'unregistered' },
  'not-friend': { steps: { login: 'pass', friend: 'action', register: 'wait', status: 'wait' }, access: 'not-friend' },
  'not-logged-in': { steps: { login: 'action', friend: 'wait', register: 'wait', status: 'wait' }, access: 'not-logged-in' },
  'line-down': { steps: { login: 'fail', friend: 'wait', register: 'wait', status: 'wait' }, access: 'line-down' },
  'status-down': { steps: { login: 'pass', friend: 'pass', register: 'fail', status: 'wait' }, access: 'status-down' },
  obs2: { steps: { login: 'fail', friend: 'wait', register: 'wait', status: 'wait' }, access: 'obs2' },
  /* The two hang cases have NO `access`: they are the checks never finishing, so the portal
     stays on the splash. They are told apart by which row is `busy` — which is the whole reason
     the hidden tape survives (`DECISIONS.md` §3.1). */
  'hang-friend': { steps: { login: 'pass', friend: 'busy', register: 'wait', status: 'wait' } },
  'hang-status': { steps: { login: 'pass', friend: 'pass', register: 'pass', status: 'busy' } },
}

let devCase: string | null | undefined

function readDevCase(): string | null {
  if (!import.meta.env.DEV || isLiffConfigured()) return null
  if (devCase === undefined) {
    const asked = new URLSearchParams(window.location.search).get('gate')
    devCase = asked && asked in DEV_CASES ? asked : null
    if (devCase) console.info(`[gate] dev override: ${devCase}`)
  }
  return devCase
}

/**
 * Whether the DEV case override is driving this session.
 *
 * The registration screens ask, because under the override there is no ID token and therefore no
 * bearer call they could make — `pages/register/registration-api.ts` answers from the same
 * fixture instead. It is exported so that decision is made in ONE place with all three locks
 * already applied, rather than re-derived (and re-weakened) at each call site.
 */
export function isDevGate(): boolean {
  return readDevCase() !== null
}

/** The fixture status for the active override case, or `null` when there is none. */
export function devStatus(): LineUserStatus | null {
  const forced = readDevCase()
  return forced ? (DEV_STATUS[forced] ?? null) : null
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Run the four checks. `setStep` writes the tape as it goes, so the splash's hidden `<ul>` is
 * current even for a run that never returns.
 */
async function runChecks(setStep: (key: BootStepKey, state: BootStepState) => void): Promise<Outcome> {
  // ── 1 · LINE login ────────────────────────────────────────────────────────────────────────
  setStep('login', 'busy')
  const boot = await bootLiff()

  /* ⚠️ NO LIFF ID CONFIGURED IS `not-logged-in`, NOT AN ERROR AND NOT A FREE PASS. A plain dev
     browser genuinely has no LINE session, so the honest landing is the login screen — the same
     answer a real LIFF gives someone who opened the URL outside the LINE app. It must not be
     `line-down`: nothing is down. */
  if (boot === 'unconfigured') {
    setStep('login', 'action')
    return { access: 'not-logged-in', status: null }
  }
  if (boot === 'failed') {
    setStep('login', 'fail')
    return { access: 'line-down', status: null }
  }
  if (!isLoggedIn()) {
    setStep('login', 'action')
    return { access: 'not-logged-in', status: null }
  }

  /* 🔴 OBS-2: configured, logged in, and STILL no ID token. The LINE channel is missing the
     `openid` scope, so `getIDToken()` returns null and no bearer call can ever be made. It is a
     channel configuration the user cannot fix, which is why the error screen offers no retry
     (`PAGE_INDEX.md` §2.1) — a button that fails every time is a lie.
     ⚠️ We return here rather than falling through, so the backend is never called without a
     token. A 401 would look like `status-down` and offer a retry that cannot work. */
  const idToken = getIdToken()
  if (!idToken) {
    setStep('login', 'fail')
    return { access: 'obs2', status: null }
  }
  setStep('login', 'pass')

  // ── 2 · Friendship with the Official Account ──────────────────────────────────────────────
  /* `getFriendship()` fails OPEN by contract (`lib/liff.ts`): a thrown SDK call resolves to
     `{ friendFlag: true }`. That is deliberate and there is no case for it in the table — the
     twelve do not include a friendship outage, because being wrongly sent to "add the OA as a
     friend" is a dead end, while being wrongly let past is corrected by the status call two
     lines below. */
  setStep('friend', 'busy')
  const { friendFlag } = await getFriendship()
  if (!friendFlag) {
    setStep('friend', 'action')
    return { access: 'not-friend', status: null }
  }
  setStep('friend', 'pass')

  // ── 3 · Registration ──────────────────────────────────────────────────────────────────────
  setStep('register', 'busy')
  let status: LineUserStatus
  try {
    status = await getLineUserStatus(idToken)
  } catch (error) {
    console.warn('[gate] /line-users/status failed:', error)
    setStep('register', 'fail')
    return { access: 'status-down', status: null }
  }

  if (status.access === 'UNREGISTERED') {
    setStep('register', 'action')
    return { access: 'unregistered', status }
  }
  setStep('register', 'pass')

  /* ── 4 · Access status ─────────────────────────────────────────────────────────────────────
     🟠 NO `busy` HERE, AND THIS IS THE ONE PLACE THE REAL ENGINE DIVERGES FROM THE PROTOTYPE'S
     TAPE. The prototype models four checks and shows `hang-status` as row 4 `busy`; the real API
     answers rows 3 and 4 with a SINGLE request (`GET /line-users/status` returns `access`), so a
     status call that never settles leaves row **3** busy, not row 4. Lighting row 4 as well
     would put a spinner on a request that does not exist — the same invented fact the chain rule
     at the top of this file exists to prevent. Recorded in `CHECKLIST.md` Phase 2. */
  setStep('status', 'pass')
  return { access: ACCESS_OF[status.access], status }
}

export function useLiffGate(): GateValue {
  const [phase, setPhase] = useState<'checking' | 'settled'>('checking')
  const [access, setAccess] = useState<GateAccess | null>(null)
  const [steps, setSteps] = useState<BootSteps>(NO_STEPS)
  const [status, setStatus] = useState<LineUserStatus | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    /* ⚠️ ONE FLAG PER RUN, CLOSED OVER — not a ref counter. A `recheck()` (or StrictMode's
       double-mount in dev) starts a second run while the first is still awaiting a network call,
       and without this the slower one wins and writes a verdict nobody asked for. React runs the
       previous cleanup before the next effect, so the older closure is always the one retired. */
    let cancelled = false
    const live = () => !cancelled

    /* ⚠️ THE RESET LIVES IN `recheck()`, NOT ON THIS LINE — and the reason is caution about a
       React-internal ordering, NOT a bug that was observed.

       A/B measured 2 ก.ย. 2569 on the retry button, both orderings, same machine: identical.
       29 splash frames, splash up by ~51 ms, back on `/gate-error` at ~2.0–2.3 s. So this is not
       a fix for anything; `setPhase('checking')` here would work today.

       What it buys is independence from *why* it works. Pressing ลองใหม่อีกครั้ง navigates to `/`
       in the same commit that starts the attempt, and at that moment `GateLanding` is mounted
       holding the previous verdict. An effect runs after its commit, so whether the splash or the
       redirect wins comes down to the order React flushes the provider's effect against
       `<Navigate>`'s. Resetting inside the setter puts the reset in the SAME commit as the
       navigation, which takes the question off the table.

       ⚠️ It means the initial state below IS the reset state; do not also reset here, or a
       `recheck` would write the same values twice for no reason. */

    const setStep = (key: BootStepKey, state: BootStepState) => {
      if (live()) setSteps((prev) => ({ ...prev, [key]: state }))
    }

    void (async () => {
      const started = Date.now()
      const forced = readDevCase()

      let outcome: Outcome
      if (forced) {
        const dev = DEV_CASES[forced]
        if (live()) setSteps(dev.steps)
        /* A hang case has no verdict: leave `phase` on `checking` forever, exactly like a real
           `getFriendship()` that never settles. */
        if (!dev.access) return
        outcome = { access: dev.access, status: DEV_STATUS[forced] ?? null }
      } else {
        outcome = await runChecks(setStep)
      }
      if (!live()) return

      /* 🔴 MIN_SPLASH_MS IS A FLOOR, NOT A DELAY — the checks and the minimum race, and the
         slower one wins. The fastest failure path here is a `bootLiff()` rejection, which can
         come back in well under half a second: without the floor the user sees a logo flash and
         a bounce to an error screen, which reads as a stuttering app rather than a working one.
         It is also the case people hit most often, on a bad connection. */
      const remaining = MIN_SPLASH_MS - (Date.now() - started)
      if (remaining > 0) await sleep(remaining)
      if (!live()) return

      setAccess(outcome.access)
      setStatus(outcome.status)
      setPhase('settled')
    })()

    return () => {
      // Retire this run: a verdict that arrives after unmount belongs to nobody.
      cancelled = true
    }
  }, [attempt])

  /**
   * Start the checks again, clearing the previous verdict in the same commit. See the note at the
   * top of the effect for why the reset is here rather than there — and for the measurement
   * saying it makes no observable difference today.
   */
  const recheck = useCallback(() => {
    setPhase('checking')
    setAccess(null)
    setStatus(null)
    setSteps(NO_STEPS)
    setAttempt((n) => n + 1)
  }, [])

  /**
   * Adopt a newer status body — the one a register or edit submit answers with.
   *
   * 🔴 IT DOES NOT TOUCH `attempt`, WHICH IS THE POINT. Bumping it would restart the effect and
   * run the four checks again, throwing away the answer the server just gave and replacing it
   * with a second, slower one that can only agree. It would also put the splash back over a
   * screen the user has already been sent to.
   */
  const applyStatus = useCallback((next: LineUserStatus) => {
    setStatus(next)
    setAccess(ACCESS_OF[next.access])
    setPhase('settled')
  }, [])

  return {
    phase,
    access,
    steps,
    answer: access ? (ANSWER[access] ?? null) : null,
    status,
    recheck,
    attempts: attempt,
    applyStatus,
  }
}
