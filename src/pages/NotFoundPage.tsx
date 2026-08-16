// Ported from DashWind (daisyui-admin-dashboard-template) — MIT (c) 2022 Dashwind. See THIRD_PARTY_NOTICES.md
import FaceFrownIcon from '@heroicons/react/24/solid/FaceFrownIcon'

/**
 * The app's single GLOBAL 404 page. It backs the one `path="*"` fallback in `App.tsx`, so
 * ANY unmatched URL lands here. It is purely static and presentational: the frown glyph and
 * the `404 - Not Found` heading, with no router hook, no countdown, no auto-redirect and no
 * login link.
 *
 * Since the old back-office was deleted (2026-08-16) that includes every `/admin-portal/*`
 * URL, which is the honest answer: there is no back-office to be logged out of, so a bounce
 * to a login screen would be a lie about what exists. It uses only theme-agnostic semantic
 * tokens, so it stays correct when v2 arrives with its own theme.
 */
export function NotFoundPage() {
  return (
    <div className="hero min-h-screen bg-base-200">
      <div className="hero-content text-center text-error">
        <div className="max-w-md">
          <FaceFrownIcon className="inline-block h-48 w-48" aria-hidden />
          <h1 className="text-5xl font-bold">404 - Not Found</h1>
        </div>
      </div>
    </div>
  )
}
