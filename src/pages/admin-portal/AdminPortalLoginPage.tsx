// Adapted from DashWind (daisyui-admin-dashboard-template),
// https://github.com/robbins23/daisyui-admin-dashboard-template — MIT (c) 2022 Dashwind.
// See THIRD_PARTY_NOTICES.md. Ports `features/user/Login.js` as a VISUAL-ONLY form:
// no auth, no token, no network. Stripped `localStorage.setItem('token', …)` +
// `window.location.href`; the Login button simply `useNavigate`s to the replica
// dashboard. The template's `InputText`/`ErrorText` become inline daisyUI controls,
// and the "Forgot Password?" / "Register" links render as inert spans (their pages
// are out of scope, so a real link would dead-end).
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { LandingIntro } from '@/components/admin-portal/LandingIntro'
import { ADMIN_PORTAL_ROUTES } from '@/components/admin-portal/routes'

/**
 * The replica login screen. Validates presence (like the template) but does not
 * authenticate — a valid submit navigates to `/admin-portal/dashboard`. Renders the
 * `<LandingIntro/>` left panel. Semantic tokens only (adopts the `dashwind-*` theme).
 */
export function AdminPortalLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  function submitForm(e: FormEvent) {
    e.preventDefault()
    setErrorMessage('')

    if (email.trim() === '') {
      setErrorMessage('Email Id is required! (use any value)')
      return
    }
    if (password.trim() === '') {
      setErrorMessage('Password is required! (use any value)')
      return
    }
    // Visual-only: no auth. Straight to the replica dashboard.
    navigate(ADMIN_PORTAL_ROUTES.dashboard)
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
            <form onSubmit={submitForm} noValidate>
              <div className="mb-4">
                <div className="mt-4">
                  <label htmlFor="admin-portal-email" className="label">
                    <span className="label-text">Email Id</span>
                  </label>
                  <input
                    id="admin-portal-email"
                    type="text"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setErrorMessage('')
                    }}
                    className="input input-bordered w-full focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>

                <div className="mt-4">
                  <label htmlFor="admin-portal-password" className="label">
                    <span className="label-text">Password</span>
                  </label>
                  <input
                    id="admin-portal-password"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setErrorMessage('')
                    }}
                    className="input input-bordered w-full focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>
              </div>

              <div className="text-right text-primary">
                {/* Inert — its page is out of scope (design §5). */}
                <span className="inline-block cursor-default text-sm">Forgot Password?</span>
              </div>

              {errorMessage && (
                <p role="alert" className="mt-8 text-sm text-error">
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                className="btn btn-primary mt-2 w-full focus-visible:ring-2 focus-visible:ring-primary"
              >
                Login
              </button>

              <div className="mt-4 text-center">
                Don't have an account yet?{' '}
                {/* Inert — its page is out of scope (design §5). */}
                <span className="inline-block cursor-default">Register</span>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
