import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Spinner } from '@/components/Spinner'
import { useAuth } from '@/auth/useAuth'
import { UI_STRINGS } from '@/constants/ui-strings'
import type { LoginResult } from '@/lib/api-client'

const UI = UI_STRINGS.auth.login

interface LocationState {
  from?: { pathname?: string }
}

const DASHBOARD = '/admin/dashboard'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Map a failed login status to a user-facing message. */
function loginErrorMessage(status: number, retryAfter?: string | null): string {
  if (status === 401) return UI.badCredentials
  if (status === 429) {
    const secs = retryAfter ? Number(retryAfter) : NaN
    return Number.isFinite(secs) && secs > 0 ? UI.rateLimitedIn(secs) : UI.rateLimited
  }
  if (status === 503) return UI.unavailable
  return UI.failed
}

/**
 * Admin login (design §5.2). Submits email/password against the cookie-session
 * auth surface; the CSRF token is fetched/attached transparently by the client.
 * On success it redirects to the originally requested path (if any) or the
 * dashboard; a 401 shows an inline error and stays put.
 */
export function AdminLoginPage() {
  const { status, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as LocationState | null)?.from?.pathname ?? DASHBOARD

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)

  // Already signed in → skip the form.
  useEffect(() => {
    if (status === 'authenticated') {
      navigate(from, { replace: true })
    }
  }, [status, from, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!EMAIL_RE.test(email)) {
      setFieldError(UI.emailInvalid)
      return
    }
    if (password.length === 0) {
      setFieldError(UI.passwordRequired)
      return
    }
    setFieldError(null)

    setSubmitting(true)
    try {
      const result = (await login(email, password)) as LoginResult
      if (result.ok) {
        navigate(from, { replace: true })
      } else {
        setFormError(loginErrorMessage(result.status, result.retryAfter))
      }
    } catch {
      setFormError(UI.networkFailed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{UI.heading}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{UI.subheading}</p>
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

          <div>
            <label
              htmlFor="admin-email"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              {UI.email}
            </label>
            <input
              id="admin-email"
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={fieldError != null}
              aria-describedby={fieldError ? 'admin-field-error' : undefined}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              placeholder={UI.emailPlaceholder}
            />
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              {UI.password}
            </label>
            <input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={fieldError != null}
              aria-describedby={fieldError ? 'admin-field-error' : undefined}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              placeholder={UI.passwordPlaceholder}
            />
          </div>

          {fieldError && (
            <p id="admin-field-error" role="alert" className="text-sm text-red-600 dark:text-red-400">
              {fieldError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-60 dark:focus-visible:ring-offset-slate-900"
          >
            {submitting ? <Spinner label={UI.submitting} /> : UI.submit}
          </button>
        </form>
      </div>
    </main>
  )
}
