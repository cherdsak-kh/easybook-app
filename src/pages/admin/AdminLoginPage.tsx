import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Spinner } from '@/components/Spinner'
import { useAuth } from '@/auth/useAuth'
import { ROUTES } from '@/constants/routes'
import { UI_STRINGS } from '@/constants/ui-strings-backend'
import type { LoginResult } from '@/lib/api-client'

const UI = UI_STRINGS.auth.login

interface LocationState {
  from?: { pathname?: string }
}

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
  // The return path ProtectedRoute stashed on redirect; the dashboard is the
  // fallback for a direct visit to the login page.
  const from = (location.state as LocationState | null)?.from?.pathname ?? ROUTES.dashboard

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
    <main className="flex min-h-screen items-center justify-center bg-base-200 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-base-content">{UI.heading}</h1>
          <p className="mt-1 text-sm text-base-content/60">{UI.subheading}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="card border border-base-300 bg-base-100 shadow-sm"
        >
          <div className="card-body gap-4 p-6">
            {formError && (
              <div role="alert" className="alert alert-error alert-soft text-sm">
                {formError}
              </div>
            )}

            <div>
              <label htmlFor="admin-email" className="mb-1 block text-sm font-medium">
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
                className="input input-bordered w-full focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100"
                placeholder={UI.emailPlaceholder}
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="mb-1 block text-sm font-medium">
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
                className="input input-bordered w-full focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100"
                placeholder={UI.passwordPlaceholder}
              />
            </div>

            {fieldError && (
              <p id="admin-field-error" role="alert" className="text-sm text-error">
                {fieldError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary w-full focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100"
            >
              {submitting ? <Spinner label={UI.submitting} /> : UI.submit}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
