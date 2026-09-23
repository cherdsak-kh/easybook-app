/**
 * The staff entrance.
 *
 * ⚠️ WHAT THE BACKEND FORCES ON THIS SCREEN — contract facts, not preferences. Check
 * `easybook-service/src/auth/` before changing any of them:
 *  · **401 is ONE message** for unknown email, wrong password, suspended AND soft-deleted
 *    (`INVALID_CREDENTIALS`). Splitting it in the UI hands an attacker an account-enumeration
 *    oracle. There is deliberately no "อีเมลนี้ยังไม่ได้ลงทะเบียน" state and there must not be.
 *  · **403 here is a CSRF failure**, not a suspended account — so the copy says reload, which
 *    is what fixes it.
 *  · **429 carries `Retry-After`** (5 tries / 15 min per IP+email, 20 per IP).
 *  · **503 is the session store** and must not read like a wrong password.
 *  · **There is no forgot-password endpoint.** Recovery is out of band: a SUPER_ADMIN calls
 *    `POST /system-users/:id/reset-password` and hands over a temporary password in person. So
 *    the hint below the card is TEXT — a link would have nowhere to go, and a dead
 *    "ลืมรหัสผ่าน?" link is worse than none.
 *  · `LoginDto` caps email at 254 and password at 128, so `maxLength` mirrors it: the client
 *    should never be able to compose a guaranteed 400.
 *
 * No theme control here, on purpose. The switcher lives in the topbar, which does not exist on
 * this screen, and a second copy is a second thing to keep in sync; the stored preference is
 * already applied by the wrapper above.
 *
 * Six of the seven interesting things here are BEHAVIOUR, not markup — which field takes focus
 * after a failure, whether the password survives it, what the button says in flight, and what a
 * 429 does to the form. None of that is visible in a screenshot.
 */

import { useEffect, useRef, useState } from 'react'
import { InlineAlert } from '../../components/feedback/InlineAlert'
import { PasswordField } from '../../components/ui/PasswordField'
import { useAuth } from '../../lib/auth-context'
import type { SignInOutcome } from '../../lib/auth-context'

const MSG = {
  emailRequired: 'โปรดระบุอีเมล',
  emailInvalid: 'โปรดระบุอีเมลให้ถูกต้อง',
  passwordRequired: 'โปรดระบุรหัสผ่าน',
  credentials: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  csrf: 'เซสชันหมดอายุหรือไม่ปลอดภัย โปรดรีเฟรชหน้าเว็บแล้วลองใหม่อีกครั้ง',
  rate: 'พยายามเข้าสู่ระบบหลายครั้งเกินไป โปรดรอสักครู่แล้วลองใหม่อีกครั้ง',
  unavailable: 'ระบบไม่สามารถใช้งานได้ชั่วคราว โปรดลองใหม่อีกครั้งในภายหลัง',
  network: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ โปรดลองใหม่อีกครั้ง',
} as const

/**
 * Deliberately LOOSER than the server. `class-validator`'s `@IsEmail` is the real gate; this
 * only catches "sombat" before it costs a round trip. A client regex STRICTER than the server
 * rejects addresses the backend would have accepted — a bug the user cannot work around, and
 * one that fails silently and permanently for that person.
 */
const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

/** Fallback when a 429 arrives without a usable `Retry-After`. */
const DEFAULT_COOLDOWN_SECONDS = 30

export function LoginPage() {
  const { signIn } = useAuth()
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailErr, setEmailErr] = useState('')
  const [passwordErr, setPasswordErr] = useState('')
  const [alert, setAlert] = useState('')
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    emailRef.current?.focus()
  }, [])

  // The countdown ticks on the BUTTON, never inside the alert: the alert is `role="alert"`, so
  // rewriting it once a second would re-announce the whole sentence sixty times. The alert
  // states the reason once; the button carries the clock.
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const apply = (outcome: SignInOutcome) => {
    if (outcome.ok) return
    setAlert(MSG[outcome.kind])
    if (outcome.kind === 'rate') {
      setCooldown(outcome.retryAfterSeconds ?? DEFAULT_COOLDOWN_SECONDS)
      return
    }
    if (outcome.kind === 'credentials') {
      // The email STAYS, the password is wiped, focus lands on the password. It is the only
      // field that can be wrong in the common case, and retyping an address you already typed
      // correctly is the small indignity every badly built login screen inflicts.
      setPassword('')
      passwordRef.current?.focus()
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || cooldown > 0) return
    setAlert('')

    const v = email.trim()
    const eErr = !v ? MSG.emailRequired : looksLikeEmail(v) ? '' : MSG.emailInvalid
    const pErr = password ? '' : MSG.passwordRequired
    setEmailErr(eErr)
    setPasswordErr(pErr)

    // Both messages render — this is not a one-error-at-a-time form — but focus goes to the
    // FIRST offender, where the work starts.
    if (eErr || pErr) {
      ;(eErr ? emailRef : passwordRef).current?.focus()
      return
    }

    setBusy(true)
    try {
      apply(await signIn(v, password))
    } finally {
      setBusy(false)
    }
  }

  const disabled = busy || cooldown > 0

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-base-200 px-4 py-8 sm:px-6">
      <div className="w-full max-w-[400px]">
        {/* Same lockup and the same HAND-SPLIT Thai lines as the boot screen — see BootScreen
            for why the two `block` spans must stay even though they look collapsible. */}
        <div className="flex flex-col items-center gap-3.5 text-center">
          <img
            src="/logo/easybook-logo-512px-no-bg.svg"
            alt="โลโก้ EasyBook"
            width={56}
            height={56}
            className="h-14 w-14"
          />
          <div>
            <p className="m-0 text-[20px] font-semibold leading-tight tracking-wide text-base-content">
              EasyBook
            </p>
            <p className="m-0 mt-1.5 text-[13px] leading-relaxed text-base-content/70 th-tight">
              <span className="block">ระบบจองสถานที่จัดกิจกรรม</span>
              <span className="block">ภายในโรงเรียนเทศบาลท่าโขลง&nbsp;1</span>
            </p>
          </div>
        </div>

        {/* `noValidate`: the browser's own validation bubbles are not translatable and not
            stylable, they appear one at a time, and they speak whatever language the BROWSER is
            set to — a Thai operator on an English Chrome would be told "Please fill out this
            field". Rendering our own is also the only way to tie a message to `aria-describedby`. */}
        <form
          noValidate
          onSubmit={(e) => void onSubmit(e)}
          className="mt-6 rounded-card border border-base-300/70 bg-base-100 p-5 shadow-e1 sm:p-6"
        >
          <h1 className="m-0 text-[20px] font-semibold leading-tight text-base-content th-tight">
            เข้าสู่ระบบ
          </h1>
          <p className="m-0 mt-1 text-[13px] text-base-content/70 th-tight">
            สำหรับเจ้าหน้าที่ผู้ดูแลระบบเท่านั้น
          </p>

          <InlineAlert message={alert} className="mb-0 mt-4" />

          {/* `autoComplete="username"`, NOT "email": this is a login identifier, and "username"
              is the token every password manager looks for to offer the saved pair.
              `inputMode="email"` gives the phone keyboard an @; capitalisation and spellcheck
              are off because iOS otherwise capitalises the first letter of an address the
              server lowercases anyway. */}
          <div className="mt-4">
            <label className="form-label" htmlFor="login-email">
              อีเมล
            </label>
            <div className={`form-shell ${emailErr ? 'form-shell-err' : ''}`.trim()}>
              <input
                ref={emailRef}
                id="login-email"
                name="email"
                type="email"
                maxLength={254}
                autoComplete="username"
                inputMode="email"
                enterKeyHint="next"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="name@example.com"
                className="form-input"
                aria-invalid={emailErr ? true : undefined}
                // Unconditional: `#login-email-err` is always rendered (hidden when empty), so
                // the link may as well be permanent — see FormField's header.
                aria-describedby="login-email-err"
                value={email}
                // Clear the error the moment they start fixing it — leaving it up until the
                // next submit means the screen keeps arguing with someone who already agreed.
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (emailErr) setEmailErr('')
                }}
              />
            </div>
            {emailErr && (
              <p id="login-email-err" className="form-err">
                <svg
                  aria-hidden="true"
                  className="form-err-ico"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                  />
                </svg>
                <span>{emailErr}</span>
              </p>
            )}
          </div>

          <div className="mt-3.5">
            {/* `ref` reaches the `<input>` through `PasswordField`'s prop spread — React 19
                passes it as an ordinary prop to a function component. That is what lets a 401
                put the caret back in this field without the component growing a forwarded ref
                it needs for nothing else. */}
            <PasswordField
              ref={passwordRef}
              id="login-password"
              name="password"
              label="รหัสผ่าน"
              maxLength={128}
              autoComplete="current-password"
              enterKeyHint="go"
              placeholder="••••••••"
              value={password}
              error={passwordErr}
              onChange={(e) => {
                setPassword(e.target.value)
                if (passwordErr) setPasswordErr('')
              }}
            />
          </div>

          {/* The disabled treatment lives on THIS button rather than on `.btn-primary2`, which
              every modal's confirm also uses and which `useBusy` disables for about a second —
              greying those would flicker. Here `disabled` means a 429 cooldown the backend
              measures in MINUTES, and a solid primary button that silently ignores clicks for
              that long is the single most complained-about control in any admin tool. It goes
              neutral rather than merely translucent so the countdown stays readable. */}
          <button
            type="submit"
            disabled={disabled}
            className="btn-primary2 mt-5 w-full disabled:cursor-not-allowed disabled:bg-base-200 disabled:text-base-content/70 disabled:hover:brightness-100"
          >
            {cooldown > 0
              ? `ลองใหม่ได้ในอีก ${cooldown} วินาที`
              : busy
                ? 'กำลังเข้าสู่ระบบ'
                : 'เข้าสู่ระบบ'}
          </button>
        </form>

        {/* TEXT, not links — see the note at the top. The second line is here so a LIFF user who
            somehow lands on the staff URL learns they are in the wrong place, instead of trying
            their LINE account against a form that will only ever answer "อีเมลหรือรหัสผ่านไม่ถูกต้อง". */}
        <div className="mt-5 space-y-1.5 text-center">
          <p className="m-0 text-[13px] leading-[1.55] text-base-content/70 th-tight">
            ลืมรหัสผ่าน? ติดต่อผู้ดูแลระบบเพื่อขอรหัสผ่านชั่วคราว
          </p>
          {/* /70, not /60. Measured: /60 at 12px lands on 4.55 against base-200 — it passes 4.5,
              but by 0.05, which is inside the noise of a font-hinting or token change. */}
          <p className="m-0 text-[12px] leading-[1.55] text-base-content/70 th-tight">
            ผู้ใช้ทั่วไปเข้าใช้งานผ่านแอปพลิเคชัน LINE
          </p>
        </div>
      </div>
    </div>
  )
}
