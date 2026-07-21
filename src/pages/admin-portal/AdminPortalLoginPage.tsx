// Adapted from DashWind (daisyui-admin-dashboard-template),
// https://github.com/robbins23/daisyui-admin-dashboard-template — MIT (c) 2022 Dashwind.
// See THIRD_PARTY_NOTICES.md. Ports `features/user/Login.js` as the two-panel DashWind
// shell (card / grid / LandingIntro left panel), but — unlike the earlier visual-only
// mock — the form now performs REAL cookie-session auth. The auth behavior is
// re-implemented INLINE from the protected `src/pages/admin/AdminLoginPage.tsx` (which
// is isolation-frozen and cannot be imported or refactored into a shared helper — see
// Phase 4 design §1): same `EMAIL_RE` + presence validation, same `loginErrorMessage`
// 401/429/503/generic mapping over the shared `UI_STRINGS.auth.login`, same
// already-authenticated redirect. The ONLY adaptation is the redirect target: this
// replica stays in its own namespace and lands on `ADMIN_PORTAL_ROUTES.dashboard`
// (`/admin-portal/dashboard`), never the real `/backend`. There is no `ProtectedRoute`
// in this branch, so there is no `location.state.from` return path to honor. The CSRF
// 403 retry is handled transparently inside `api-client` — not re-implemented here. The
// carried-over DashWind "Forgot Password?" / "Register" template links have been removed
// (Phase 5.1.1 UI polish): the V2 has no such routes.
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { UI_STRINGS } from '@/constants/ui-strings-backend'
import { LandingIntro } from '@/components/admin-portal/LandingIntro'
import { ADMIN_PORTAL_ROUTES } from '@/components/admin-portal/routes'

const UI = UI_STRINGS.auth.login

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Map a failed login status to a user-facing message. Byte-identical to the real
 * `admin/AdminLoginPage.tsx` helper — duplicated inline (not extracted to a shared
 * module) because the real login is isolation-frozen and could never be repointed at a
 * shared helper without editing the frozen tree, so extraction would dedupe nothing.
 */
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
 * The replica login screen — now FUNCTIONAL. Submits email/password against the
 * cookie-session auth surface via `useAuth().login`; the CSRF token is fetched/attached
 * transparently by the client. On success it redirects to the replica dashboard
 * (`/admin-portal/dashboard`); a failed login shows an inline error and stays put.
 * Renders the `<LandingIntro/>` left panel. Semantic tokens only (adopts `dashwind-*`).
 */
export function AdminPortalLoginPage() {
  const { status, login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)

  // Already signed in (or just authenticated after submit) → skip the form and land on
  // the replica dashboard. No force-reset gate and no `/backend` bounce (design §1/D4):
  // the branch is unprotected, so the redirect target is unconditionally the replica.
  useEffect(() => {
    if (status === 'authenticated') {
      navigate(ADMIN_PORTAL_ROUTES.dashboard, { replace: true })
    }
  }, [status, navigate])

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
      const result = await login(email, password)
      if (result.ok) {
        navigate(ADMIN_PORTAL_ROUTES.dashboard, { replace: true })
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
    <div className="flex min-h-screen items-center bg-base-200">
      <div className="card mx-auto w-full max-w-5xl shadow-xl">
        <div className="grid grid-cols-1 rounded-xl bg-base-100 md:grid-cols-2">
          <div>
            <LandingIntro />
          </div>

          <div className="px-10 py-24">
            <h2 className="mb-2 text-center text-2xl font-semibold">Login</h2>
            <form onSubmit={handleSubmit} noValidate>
              {formError && (
                <div role="alert" className="alert alert-error alert-soft mb-4 text-sm">
                  {formError}
                </div>
              )}

              <div className="mb-4">
                <div className="mt-4">
                  <label htmlFor="admin-portal-email" className="label mb-1">
                    <span className="label-text">{UI.email}</span>
                  </label>
                  <input
                    id="admin-portal-email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={fieldError != null}
                    aria-describedby={fieldError ? 'admin-portal-field-error' : undefined}
                    className="input input-bordered w-full focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100"
                    placeholder={UI.emailPlaceholder}
                  />
                </div>

                <div className="mt-4">
                  <label htmlFor="admin-portal-password" className="label mb-1">
                    <span className="label-text">{UI.password}</span>
                  </label>
                  <input
                    id="admin-portal-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={fieldError != null}
                    aria-describedby={fieldError ? 'admin-portal-field-error' : undefined}
                    className="input input-bordered w-full focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100"
                    placeholder={UI.passwordPlaceholder}
                  />
                </div>
              </div>

              {fieldError && (
                <p id="admin-portal-field-error" role="alert" className="mt-8 text-sm text-error">
                  {fieldError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                aria-busy={submitting}
                className="btn btn-primary mt-2 w-full focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100"
              >
                {submitting ? (
                  <>
                    <span className="loading loading-spinner loading-sm" aria-hidden="true" />
                    <span className="sr-only">{UI.submitting}</span>
                  </>
                ) : (
                  UI.submit
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
