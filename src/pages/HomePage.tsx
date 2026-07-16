import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getFriendship,
  getIdToken,
  initLiff,
  isInLineClient,
  isLiffConfigured,
  isLoggedIn,
  login,
  type LiffProfile,
} from '@/lib/liff'
import {
  ApiError,
  getLineUserStatus,
  getRegistrationOptions,
  registerLineUser,
  updateLineUserRegistration,
  type AppAccess,
  type CreateLineUserRegistration,
  type LineUserRegistration,
  type LineUserStatus,
  type RegistrationOptions,
} from '@/lib/api-client'
import { RegistrationForm, type RegistrationFormValues } from '@/components/RegistrationForm'
import { FullPageSpinner } from '@/components/Spinner'

/** Square brand mark — used inside the LINE client where space is tight. */
const LOGO_MARK = '/logo/easybook-logo-512px-no-bg.svg'
/** Full wordmark — used on the web (splash + login card). */
const LOGO_WORDMARK = '/logo/easybook-logo-text-1024px-no-bg.svg'
/**
 * The LINE Official Account "add friend" QR. NOTE: the committed asset is a small
 * placeholder — replace it with the real OA QR before production.
 */
const OA_QR_IMAGE = '/line-oa-qrcode/QR_283iinva.png'

/**
 * Minimum time the splash stays up, so the fade/scale-in animation is always
 * perceptible even when LIFF init resolves instantly.
 */
const MIN_SPLASH_MS = 1500

type View =
  | { kind: 'splash' }
  | { kind: 'login' }
  | { kind: 'resolving' }
  | { kind: 'add-friend' }
  | { kind: 'registration' }
  | { kind: 'editing' }
  | { kind: 'pending' }
  | { kind: 'allowed' }
  | { kind: 'blocked' }
  | { kind: 'error' }
  | { kind: 'auth-error' }

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * DEV AFFORDANCE: option lists used by the registration/edit form when LIFF is
 * NOT configured (no `VITE_LIFF_ID`), so the whole flow — including the dynamic
 * dropdowns — stays walkable without a backend. Never used when LIFF is real.
 */
const MOCK_OPTIONS: RegistrationOptions = {
  departments: [
    { id: 1, name: 'Computer Science' },
    { id: 2, name: 'Mathematics' },
  ],
  personnelRoles: [
    { id: 10, name: 'Teacher' },
    { id: 11, name: 'Support Staff' },
  ],
}

const nameOf = (opts: RegistrationOptions['departments'], id: number): string =>
  opts.find((o) => o.id === id)?.name ?? String(id)

/** Build a mock registration record from a submitted DTO (dev mock path only). */
function mockRegistrationFrom(dto: CreateLineUserRegistration): LineUserRegistration {
  const now = new Date().toISOString()
  return {
    id: 'mock-registration',
    firstName: dto.firstName,
    lastName: dto.lastName,
    staffId: dto.staffId,
    phone: dto.phone,
    departmentId: dto.departmentId,
    department: nameOf(MOCK_OPTIONS.departments, dto.departmentId),
    personnelRoleId: dto.personnelRoleId,
    personnelRole: nameOf(MOCK_OPTIONS.personnelRoles, dto.personnelRoleId),
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Derive the form's pre-fill values from an existing registration (edit mode).
 * The option ids come back as integers, but a `<select value>` is compared as a
 * DOM string — so stringify them here to keep the currently-selected option
 * highlighted (the form re-parses them to integers on submit).
 */
function initialFrom(reg: LineUserRegistration | null): RegistrationFormValues | undefined {
  if (!reg) return undefined
  return {
    firstName: reg.firstName,
    lastName: reg.lastName,
    staffId: reg.staffId,
    phone: reg.phone,
    departmentId: String(reg.departmentId),
    personnelRoleId: String(reg.personnelRoleId),
  }
}

/**
 * Client Portal onboarding flow.
 *
 * Splash → **friendship gate** → **access-status gate** → one of four screens
 * (Registration / Pending / Allowed / Blocked). All LINE access is isolated
 * behind `@/lib/liff` (fail-soft) and the backend LINE-consumer endpoints are
 * called through `@/lib/api-client` with the LIFF ID token as a bearer.
 *
 * **Local dev without LIFF:** the mock path is gated **strictly on
 * `!isLiffConfigured()`** (no `VITE_LIFF_ID`) — only a truly unconfigured
 * environment. There the friendship gate fails open (friend) and the status gate
 * short-circuits to a mock (`UNREGISTERED` → registration → mock submit →
 * `PENDING`), keeping the whole flow walkable and testable without a backend or
 * the LINE app — mirroring the existing mock-login affordance.
 *
 * **Configured-but-tokenless (OBS-2 hardening):** when a real LIFF id IS present
 * but `getIdToken()` yields `null` (e.g. the LINE Login channel is missing the
 * `openid` scope), we must NOT silently mock — that would look like a successful
 * registration while the backend persisted nothing. Instead the status gate
 * stops and renders a loud authentication-error screen, and never issues the
 * status/register calls.
 */
export function HomePage() {
  const [view, setView] = useState<View>({ kind: 'splash' })
  const [entered, setEntered] = useState(false)
  const [profile, setProfile] = useState<LiffProfile | null>(null)

  // Registration submit UI state.
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Add-friend re-check UI state.
  const [rechecking, setRechecking] = useState(false)
  const [recheckHint, setRecheckHint] = useState<string | null>(null)

  // The caller's current registration (populated on the status gate; used to
  // pre-fill the PENDING edit form and echo submitted details on Pending).
  const [registration, setRegistration] = useState<LineUserRegistration | null>(null)

  const active = useRef(true)
  // The verified LIFF ID token used as the bearer; null in local-dev/mock mode.
  const idTokenRef = useRef<string | null>(null)
  // DEV AFFORDANCE: the simulated status used when there is no real ID token.
  const mockStatusRef = useRef<LineUserStatus>({ access: 'UNREGISTERED', registration: null })

  /**
   * Loads the dynamic Department / PersonnelRole option lists for the form.
   * Uses the bearer token when LIFF is real; falls back to {@link MOCK_OPTIONS}
   * in unconfigured local dev so the form stays walkable without a backend.
   */
  const loadOptions = useCallback(async (): Promise<RegistrationOptions> => {
    if (!isLiffConfigured()) return MOCK_OPTIONS
    const token = idTokenRef.current
    if (!token) throw new ApiError(401, 'Missing LINE session.')
    return getRegistrationOptions(token)
  }, [])

  const route = useCallback((access: AppAccess) => {
    switch (access) {
      case 'PENDING':
        setView({ kind: 'pending' })
        break
      case 'ALLOWED':
        setView({ kind: 'allowed' })
        break
      case 'BLOCKED':
        setView({ kind: 'blocked' })
        break
      case 'UNREGISTERED':
      default:
        setView({ kind: 'registration' })
        break
    }
  }, [])

  /** Access-status gate: read the user's `access` and route to a screen. */
  const runStatusGate = useCallback(async () => {
    setView({ kind: 'resolving' })
    try {
      const token = getIdToken()
      idTokenRef.current = token
      let status: LineUserStatus
      if (!isLiffConfigured()) {
        // DEV AFFORDANCE: no VITE_LIFF_ID (true local dev / plain browser) — a
        // real /status call would 401, so short-circuit to the mock status.
        // Gated on isLiffConfigured() (NOT on the token) so a real-but-
        // misconfigured channel can never silently enter mock mode (OBS-2).
        status = mockStatusRef.current
      } else if (!token) {
        // OBS-2: LIFF IS configured but there is no ID token (e.g. the LINE Login
        // channel lacks the `openid` scope). Do NOT mock and do NOT call the
        // backend — that would fake a successful registration while nothing
        // persisted. Surface a loud authentication error instead.
        setView({ kind: 'auth-error' })
        return
      } else {
        status = await getLineUserStatus(token)
      }
      if (!active.current) return
      setRegistration(status.registration)
      route(status.access)
    } catch {
      if (!active.current) return
      setView({ kind: 'error' })
    }
  }, [route])

  /** Friendship gate: gate to the Add-Friend screen unless the OA is added. */
  const runFriendshipGate = useCallback(async () => {
    setView({ kind: 'resolving' })
    const { friendFlag } = await getFriendship() // fail-soft: true when non-LIFF
    if (!active.current) return
    if (!friendFlag) {
      setRecheckHint(null)
      setView({ kind: 'add-friend' })
      return
    }
    await runStatusGate()
  }, [runStatusGate])

  useEffect(() => {
    active.current = true

    // Trigger the fade/scale-in one tick after mount so the transition runs.
    const enterTimer = setTimeout(() => {
      if (active.current) setEntered(true)
    }, 50)

    // Race SDK init against a minimum splash duration: whichever finishes last
    // wins, guaranteeing the animation is seen and nothing flashes early.
    Promise.all([initLiff(), delay(MIN_SPLASH_MS)]).then(([p]) => {
      if (!active.current) return

      if (isInLineClient()) {
        if (isLoggedIn() && p) {
          setProfile(p)
          void runFriendshipGate()
        } else {
          // Not signed in: redirect to LINE login and KEEP the splash up so
          // nothing renders before the client leaves this page.
          login()
        }
        return
      }

      // External web browser.
      if (p) {
        setProfile(p)
        void runFriendshipGate()
      } else {
        setView({ kind: 'login' })
      }
    })

    return () => {
      active.current = false
      clearTimeout(enterTimer)
    }
  }, [runFriendshipGate])

  function handleLogin() {
    if (!isLiffConfigured()) {
      // DEV AFFORDANCE — no VITE_LIFF_ID configured (local dev, no LINE app).
      // A real liff.login() redirect can't succeed without a channel, so instead
      // simulate a successful LINE login with a dummy profile and run the SAME
      // gate flow (friendship fails open, status short-circuits to a mock). Gated
      // on isLiffConfigured() so this NEVER runs when a real LIFF id is present.
      setProfile({ displayName: 'Mock User', userId: 'U1234567890abcdef' })
      void runFriendshipGate()
      return
    }
    login()
  }

  async function handleRecheckFriendship() {
    setRechecking(true)
    setRecheckHint(null)
    try {
      const { friendFlag } = await getFriendship()
      if (!active.current) return
      if (friendFlag) {
        await runStatusGate()
      } else {
        setRecheckHint("ระบบยังไม่พบสถานะการเป็นเพื่อน โปรดเพิ่มบัญชีทางการเป็นเพื่อนแล้วลองใหม่อีกครั้ง")
      }
    } finally {
      if (active.current) setRechecking(false)
    }
  }

  async function handleRegister(dto: CreateLineUserRegistration) {
    setSubmitError(null)
    setSubmitting(true)
    try {
      if (!isLiffConfigured()) {
        // DEV AFFORDANCE: no VITE_LIFF_ID — simulate a successful registration so
        // the flow is walkable without a backend. Mirrors the mock-login path.
        // Gated on isLiffConfigured() (OBS-2): a real-but-tokenless channel must
        // never fake a submit — the status gate already routes it to auth-error.
        const reg = mockRegistrationFrom(dto)
        mockStatusRef.current = { access: 'PENDING', registration: reg }
        if (active.current) {
          setRegistration(reg)
          setView({ kind: 'pending' })
        }
        return
      }
      const token = idTokenRef.current
      if (!token) {
        // OBS-2 defensive: configured but tokenless callers can't reach the form
        // (runStatusGate shows auth-error first), but never silently submit nothing.
        if (active.current) setView({ kind: 'auth-error' })
        return
      }
      const status = await registerLineUser(dto, token)
      if (!active.current) return
      setRegistration(status.registration)
      route(status.access)
    } catch (err) {
      if (!active.current) return
      setSubmitError(messageForRegister(err))
    } finally {
      if (active.current) setSubmitting(false)
    }
  }

  /** Open the PENDING edit form (pre-filled from the current registration). */
  function handleStartEdit() {
    setSubmitError(null)
    setView({ kind: 'editing' })
  }

  /** Cancel the edit and return to the Pending screen. */
  function handleCancelEdit() {
    setSubmitError(null)
    setView({ kind: 'pending' })
  }

  async function handleEditSubmit(dto: CreateLineUserRegistration) {
    setSubmitError(null)
    setSubmitting(true)
    try {
      if (!isLiffConfigured()) {
        // DEV AFFORDANCE: mock a successful self-edit without a backend.
        const reg = mockRegistrationFrom(dto)
        mockStatusRef.current = { access: 'PENDING', registration: reg }
        if (active.current) {
          setRegistration(reg)
          setView({ kind: 'pending' })
        }
        return
      }
      const token = idTokenRef.current
      if (!token) {
        if (active.current) setView({ kind: 'auth-error' })
        return
      }
      const status = await updateLineUserRegistration(dto, token)
      if (!active.current) return
      setRegistration(status.registration)
      // Success → back to the (refreshed) Pending screen. `access` stays PENDING.
      route(status.access)
    } catch (err) {
      if (!active.current) return
      setSubmitError(messageForEdit(err))
    } finally {
      if (active.current) setSubmitting(false)
    }
  }

  switch (view.kind) {
    case 'login':
      return <LineLoginScreen onLogin={handleLogin} />
    case 'resolving':
      return <FullPageSpinner label="Loading your account…" />
    case 'add-friend':
      return (
        <AddFriendScreen
          onRecheck={handleRecheckFriendship}
          rechecking={rechecking}
          hint={recheckHint}
        />
      )
    case 'registration':
      return (
        <RegistrationForm
          mode="create"
          loadOptions={loadOptions}
          onSubmit={handleRegister}
          submitting={submitting}
          serverError={submitError}
          displayName={profile?.displayName}
        />
      )
    case 'editing':
      return (
        <RegistrationForm
          mode="edit"
          loadOptions={loadOptions}
          onSubmit={handleEditSubmit}
          submitting={submitting}
          serverError={submitError}
          displayName={profile?.displayName}
          initial={initialFrom(registration)}
          onCancel={handleCancelEdit}
        />
      )
    case 'pending':
      return <PendingScreen profile={profile} registration={registration} onEdit={handleStartEdit} />
    case 'allowed':
      return <HelloScreen profile={profile} />
    case 'blocked':
      return <BlockedScreen />
    case 'error':
      return <GateErrorScreen onRetry={runFriendshipGate} />
    case 'auth-error':
      return <AuthErrorScreen />
    default:
      return <SplashScreen entered={entered} inClient={isInLineClient()} />
  }
}

/** Map a registration submit failure to a user-facing, non-crashing message. */
function messageForRegister(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409) {
      // Either already registered, or the staff ID is taken.
      return err.message || 'This ID is already registered. Please check your details.'
    }
    if (err.status === 400) {
      return err.message || 'Please check the form and try again.'
    }
    if (err.status === 401) {
      return 'Your LINE session has expired. Please reopen the app and try again.'
    }
    if (err.status === 502) {
      return 'We could not reach LINE to verify you. Please try again in a moment.'
    }
    return err.message || 'Something went wrong. Please try again.'
  }
  return 'Something went wrong. Please try again.'
}

/** Map a PENDING self-edit failure to a user-facing, non-crashing message. */
function messageForEdit(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) {
      // No longer PENDING (an admin approved/blocked in the meantime).
      return 'Your registration can no longer be edited — please reopen the app to refresh your status.'
    }
    if (err.status === 409) {
      return err.message || 'That staff ID is already in use. Please check your details.'
    }
    if (err.status === 400) {
      // A selected option was removed, or a field is invalid.
      return err.message || 'Please review your selections and try again.'
    }
    if (err.status === 401) {
      return 'Your LINE session has expired. Please reopen the app and try again.'
    }
    if (err.status === 502) {
      return 'We could not reach LINE to verify you. Please try again in a moment.'
    }
    return err.message || 'Something went wrong. Please try again.'
  }
  return 'Something went wrong. Please try again.'
}

/** Full-screen animated splash shown while LIFF initialises / redirects. */
function SplashScreen({ entered, inClient }: { entered: boolean; inClient: boolean }) {
  return (
    <div
      role="status"
      aria-label="Loading EasyBook"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 dark:bg-slate-900"
    >
      <img
        src={inClient ? LOGO_MARK : LOGO_WORDMARK}
        alt="EasyBook"
        className={[
          inClient ? 'h-28 w-28' : 'w-56 max-w-[70%]',
          'select-none motion-safe:transition-all motion-safe:duration-1000 motion-safe:ease-out',
          entered ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
        ].join(' ')}
      />
    </div>
  )
}

/** ALLOWED landing: the greeting (unchanged behaviour). */
function HelloScreen({ profile }: { profile: LiffProfile | null }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center dark:bg-slate-900">
      {profile?.pictureUrl && (
        <img
          src={profile.pictureUrl}
          alt=""
          className="mb-4 h-20 w-20 rounded-full object-cover shadow-sm ring-2 ring-white dark:ring-slate-800"
        />
      )}
      <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
        Hello, {profile?.displayName ?? 'there'} 👋
      </h1>
      <p className="mt-3 text-slate-500 dark:text-slate-400">Welcome to EasyBook.</p>
    </main>
  )
}

/**
 * PENDING: registered, awaiting an administrator's approval. Echoes the submitted
 * details and offers an "Edit registration" affordance (backend permits edits
 * only while PENDING).
 */
function PendingScreen({
  profile,
  registration,
  onEdit,
}: {
  profile: LiffProfile | null
  registration: LineUserRegistration | null
  onEdit: () => void
}) {
  return (
    <StatusCard
      tone="amber"
      icon="clock"
      title="รอการอนุมัติลงทะเบียน"
      body={
        <>
          {profile?.displayName ? `ขอบคุณ ${profile.displayName} ` : ''}ระบบได้รับข้อมูลการลงทะเบียนของคุณแล้ว โปรดรอผู้ดูแลระบบพิจารณาอนุมัติสิทธิ์การเข้าใช้งาน
        </>
      }
      action={
        <>
          {registration && (
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-left text-sm dark:border-slate-800">
              <SummaryItem
                label="ชื่อ-นามสกุล"
                value={`${registration.firstName} ${registration.lastName}`.trim()}
              />
              <SummaryItem label="รหัสบุคลากร" value={registration.staffId} />
              <SummaryItem label="เบอร์โทรศัพท์" value={registration.phone} />
              <SummaryItem label="ฝ่าย/แผนก" value={registration.department} />
              <SummaryItem label="ตำแหน่ง/บทบาท" value={registration.personnelRole} />
            </dl>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl border border-amber-300 px-5 py-2.5 font-semibold text-amber-800 transition-colors hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:border-amber-500/40 dark:text-amber-300 dark:hover:bg-amber-500/10 dark:focus-visible:ring-offset-slate-900"
          >
            แก้ไขข้อมูลลงทะเบียน
          </button>
        </>
      }
    />
  )
}

/** A labelled read-only value inside the Pending summary. */
function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.7rem] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </dt>
      <dd className="truncate text-slate-700 dark:text-slate-200" title={value}>
        {value || '—'}
      </dd>
    </div>
  )
}

/** BLOCKED: account suspended, no actions. */
function BlockedScreen() {
  return (
    <StatusCard
      tone="red"
      icon="ban"
      title="Account suspended"
      body="Your account has been suspended. Please contact the administration."
    />
  )
}

/** A gate call (friendship/status) failed — offer a retry. */
function GateErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <StatusCard
      tone="red"
      icon="ban"
      title="Something went wrong"
      body="We couldn't load your account status. Please check your connection and try again."
      action={
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
        >
          Try again
        </button>
      }
    />
  )
}

/** Friendship gate: prompt the user to add the Official Account. */
function AddFriendScreen({
  onRecheck,
  rechecking,
  hint,
}: {
  onRecheck: () => void
  rechecking: boolean
  hint: string | null
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            เพิ่มเพื่อน EasyBook บน LINE
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            เพื่อดำเนินการต่อ โปรดเพิ่มบัญชีทางการของเราเป็นเพื่อน โดยสแกนคิวอาร์โค้ดด้านล่างผ่านแอปพลิเคชัน LINE หรือเปิดผ่านอุปกรณ์อื่น
          </p>

          <div className="mt-6 flex justify-center">
            <img
              src={OA_QR_IMAGE}
              alt="QR code to add the EasyBook LINE Official Account"
              width={192}
              height={192}
              className="h-48 w-48 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700"
            />
          </div>

          <ol className="mt-6 space-y-1 text-left text-sm text-slate-600 dark:text-slate-300">
            <li>1. เปิดแอปพลิเคชัน LINE และเลือกตัวสแกนคิวอาร์โค้ด</li>
            <li>2. สแกนคิวอาร์โค้ดด้านบน และกดเพิ่มเพื่อน EasyBook</li>
            <li>3. กลับมาที่หน้านี้ และกดปุ่มด้านล่าง</li>
          </ol>

          {hint && (
            <p role="alert" className="mt-4 text-sm text-amber-700 dark:text-amber-400">
              {hint}
            </p>
          )}

          <button
            type="button"
            onClick={onRecheck}
            disabled={rechecking}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-60 dark:focus-visible:ring-offset-slate-900"
          >
            {rechecking ? 'กำลังตรวจสอบ...' : 'ตรวจสอบสถานะการเพิ่มเพื่อน'}
          </button>
        </div>
      </div>
    </main>
  )
}

/**
 * Configured-but-tokenless authentication failure (OBS-2). Shown when a real LIFF
 * id is present yet `getIdToken()` returns `null` — most often a LINE Login
 * channel missing the `openid` scope. Rendered as a labelled `alert` (loud, not a
 * silent mock) and styled like the other error/suspended screens.
 */
function AuthErrorScreen() {
  return (
    <StatusCard
      tone="red"
      icon="ban"
      alert
      title="Authentication failed"
      body="LINE Authentication failed: Missing ID Token. Please contact support or verify that the LINE login channel has the 'openid' scope configured."
    />
  )
}

/** Shared centred status card (Pending / Blocked / Error / Auth error). */
function StatusCard({
  tone,
  icon,
  title,
  body,
  action,
  alert = false,
}: {
  tone: 'amber' | 'red'
  icon: 'clock' | 'ban'
  title: string
  body: React.ReactNode
  action?: React.ReactNode
  /** When true, mark the card as an assertive alert region (for error states). */
  alert?: boolean
}) {
  const toneRing =
    tone === 'amber'
      ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400'
      : 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400'
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm text-center">
        <div
          {...(alert ? { role: 'alert', 'aria-label': title } : {})}
          className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <span
            aria-hidden
            className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${toneRing}`}
          >
            {icon === 'clock' ? <ClockIcon /> : <BanIcon />}
          </span>
          <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{body}</p>
          {action}
        </div>
      </div>
    </main>
  )
}

/** Styled "Log in with LINE" card shown to signed-out web visitors. */
function LineLoginScreen({ onLogin }: { onLogin: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <img
            src={LOGO_MARK}
            alt="EasyBook"
            className="mx-auto h-14 w-auto max-w-[70%]"
          />
          <h1 className="mt-6 text-xl font-bold text-slate-900 dark:text-slate-100">
            ยินดีต้อนรับสู่ EasyBook
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            เข้าสู่ระบบด้วยบัญชี LINE ของคุณเพื่อใช้งานระบบ
          </p>

          <button
            type="button"
            onClick={onLogin}
            className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#06C755] px-4 py-3 font-semibold text-white transition-colors hover:bg-[#05b34c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06C755] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
          >
            <LineGlyph className="h-5 w-5" />
            เข้าสู่ระบบด้วย LINE
          </button>
        </div>
      </div>
    </main>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="9" strokeWidth="2" />
      <path strokeWidth="2" strokeLinecap="round" d="M12 7v5l3 2" />
    </svg>
  )
}

function BanIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="9" strokeWidth="2" />
      <path strokeWidth="2" strokeLinecap="round" d="m5.6 5.6 12.8 12.8" />
    </svg>
  )
}

/** Inline LINE brand glyph (white speech bubble); decorative. */
function LineGlyph({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 3.5C6.9 3.5 2.75 6.86 2.75 11c0 3.71 3.29 6.82 7.74 7.41.3.06.71.2.82.46.09.24.06.6.03.85l-.13.79c-.04.24-.19.93.82.51 1.02-.42 5.46-3.22 7.45-5.51h0C20.86 14.05 21.5 12.6 21.5 11c0-4.14-4.15-7.5-9.5-7.5zM8.2 13.28H6.36a.49.49 0 0 1-.49-.49V9.11a.49.49 0 1 1 .98 0v3.19H8.2a.49.49 0 1 1 0 .98zm1.92-.49a.49.49 0 1 1-.98 0V9.11a.49.49 0 1 1 .98 0v3.68zm4.44 0a.49.49 0 0 1-.34.47.5.5 0 0 1-.15.02.49.49 0 0 1-.4-.2l-1.89-2.57v2.28a.49.49 0 1 1-.98 0V9.11a.49.49 0 0 1 .89-.29l1.89 2.57V9.11a.49.49 0 1 1 .98 0v3.68zm2.98-2.33a.49.49 0 1 1 0 .98h-1.35v.86h1.35a.49.49 0 1 1 0 .98h-1.84a.49.49 0 0 1-.49-.49V9.11a.49.49 0 0 1 .49-.49h1.84a.49.49 0 1 1 0 .98h-1.35v.86h1.35z" />
    </svg>
  )
}
