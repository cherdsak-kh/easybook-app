import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ApiError,
  changeOwnPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '@/lib/api-client'
import { Spinner } from '@/components/Spinner'
import { useAuth } from '@/auth/useAuth'
import { UI_STRINGS } from '@/constants/ui-strings'

const UI = UI_STRINGS.auth.forcePasswordChange
const DASHBOARD = '/admin/dashboard'

interface Fields {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

type Errors = Partial<Record<keyof Fields, string>>

/**
 * Client-side mirror of the backend's rules (>= 12, <= 128, must differ from the
 * current one). Fast feedback only — the server is the control and re-checks all
 * of it. `confirmPassword` is purely a frontend concern; it is never sent (the
 * DTO would 400 on the extra key).
 */
function validate(f: Fields): Errors {
  const e: Errors = {}
  if (!f.currentPassword) e.currentPassword = UI.currentRequired
  if (f.newPassword.length < PASSWORD_MIN_LENGTH) {
    e.newPassword = UI.tooShort(PASSWORD_MIN_LENGTH)
  } else if (f.newPassword.length > PASSWORD_MAX_LENGTH) {
    e.newPassword = UI.tooLong(PASSWORD_MAX_LENGTH)
  } else if (f.newPassword === f.currentPassword) {
    e.newPassword = UI.mustDiffer
  }
  if (f.confirmPassword !== f.newPassword) e.confirmPassword = UI.mismatch
  return e
}

/**
 * Force Reset Password (AC-F5/F6). Reached whenever the signed-in user has
 * `mustChangePassword === true` — `ProtectedRoute` redirects here and keeps them
 * here until the flag clears.
 *
 * The redirect is UX only: the backend independently 403s every gated route, so
 * nothing here is a security control. What IS load-bearing:
 *  - a wrong current password comes back as **400, not 401** — it is rendered
 *    inline and MUST NOT log the user out. A 401 here means the session really
 *    died, and only then do we expire it.
 *  - on success we re-probe `GET /auth/system/me` rather than trusting local
 *    state, so `mustChangePassword` is read back from the server before we let
 *    the user through. No re-login: the cookie stays valid.
 *
 * Logout stays reachable — a user must always be able to leave a screen.
 */
export function ForcePasswordChangePage() {
  const { user, refresh, logout, expireSession } = useAuth()
  const navigate = useNavigate()

  const [fields, setFields] = useState<Fields>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const found = validate(fields)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSubmitting(true)
    try {
      await changeOwnPassword(fields.currentPassword, fields.newPassword)
      // Re-read the flag from the server instead of assuming it flipped.
      await refresh()
      navigate(DASHBOARD, { replace: true })
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        // A genuine session death — and ONLY this. Never a wrong password.
        expireSession()
        return
      }
      if (err instanceof ApiError && err.status === 400) {
        // Wrong current password, or the new one broke a rule. The backend's
        // message is user-facing; render it inline and stay put.
        setFormError(err.message || UI.invalid)
        return
      }
      setFormError(UI.failed)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await logout()
      navigate('/admin/login', { replace: true })
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{UI.heading}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {UI.intro(user ? `${user.firstName} ${user.lastName}` : undefined)}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          {formError && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400"
            >
              {formError}
            </p>
          )}

          <PasswordField
            id="fpc-current"
            label={UI.currentPassword}
            autoComplete="current-password"
            value={fields.currentPassword}
            onChange={(v) => set('currentPassword', v)}
            error={errors.currentPassword}
            disabled={submitting}
          />

          <PasswordField
            id="fpc-new"
            label={UI.newPassword}
            autoComplete="new-password"
            value={fields.newPassword}
            onChange={(v) => set('newPassword', v)}
            error={errors.newPassword}
            hint={UI.newPasswordHint(PASSWORD_MIN_LENGTH)}
            disabled={submitting}
          />

          <PasswordField
            id="fpc-confirm"
            label={UI.confirmPassword}
            autoComplete="new-password"
            value={fields.confirmPassword}
            onChange={(v) => set('confirmPassword', v)}
            error={errors.confirmPassword}
            disabled={submitting}
          />

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-60 dark:focus-visible:ring-offset-slate-900"
          >
            {submitting ? <Spinner label={UI.submitting} /> : UI.submit}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {loggingOut ? <Spinner label={UI.loggingOut} /> : UI.logout}
          </button>
        </div>
      </div>
    </main>
  )
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  autoComplete,
  disabled,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
  autoComplete: string
  disabled?: boolean
}) {
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {label}
      </label>
      <input
        id={id}
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={`w-full rounded-lg border bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 disabled:opacity-60 dark:bg-slate-950 dark:text-slate-100 ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500 dark:border-red-500/60'
            : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 dark:border-slate-700'
        }`}
      />
      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
