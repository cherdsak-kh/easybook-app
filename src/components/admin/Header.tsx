// Layout/structure adapted from DashWind (daisyui-admin-dashboard-template),
// https://github.com/robbins23/daisyui-admin-dashboard-template — MIT (c) 2022 Dashwind.
// See THIRD_PARTY_NOTICES.md. Adapts DashWind's Header.js (navbar only); our own
// identity/logout via useAuth is kept (NOT the template's localStorage.clear()).
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Spinner } from '@/components/Spinner'
import { Avatar } from '@/components/admin/Avatar'
import { useAuth } from '@/auth/useAuth'
import { ROUTES } from '@/constants/routes'
import { UI_STRINGS } from '@/constants/ui-strings-backend'
import { SIDEBAR_DRAWER_ID, usePageTitle } from './nav-config'

/**
 * Square brand mark. DECORATIVE (`alt=""`): the current page title sits beside it
 * and the sidebar's brand row already names the product, so alt text here would
 * make a screen reader announce the brand redundantly.
 */
const LOGO_MARK = '/logo/easybook-logo-512px-no-bg.svg'

/**
 * Dashboard top bar (daisyUI `navbar`): a mobile drawer toggle, the current
 * page title, the logged-in admin's name + role, and a Logout button. The
 * hamburger is a `<label htmlFor>` bound to the drawer checkbox (no toggle
 * callback — the drawer owns its own state). Logout destroys the server session
 * then returns to login (NOT a client-side `localStorage` wipe, which would
 * desync `AuthProvider`).
 */
export function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const pageTitle = usePageTitle(pathname)
  const [loggingOut, setLoggingOut] = useState(false)

  const fullName = user ? `${user.firstName} ${user.lastName}`.trim() : ''

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await logout()
      navigate(ROUTES.login, { replace: true })
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="navbar sticky top-0 z-20 gap-2 border-b border-base-300 bg-base-100/90 px-4 backdrop-blur">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <label
          htmlFor={SIDEBAR_DRAWER_ID}
          aria-label={UI_STRINGS.header.toggleMenu}
          className="btn btn-ghost btn-square btn-sm lg:hidden focus-visible:ring-2 focus-visible:ring-primary"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </label>
        <img src={LOGO_MARK} alt="" aria-hidden className="h-8 w-8 shrink-0 select-none" />
        <h1 className="truncate text-lg font-semibold text-base-content">{pageTitle}</h1>
      </div>

      <div className="flex flex-none items-center gap-3">
        {user && (
          <>
            {/* `min-w-0` + `truncate`: the LINE webview is narrow and the bar
                carries a logo, a title and an avatar — a long name must ellipsize
                rather than shove the Logout button off-screen. */}
            <div className="min-w-0 text-right leading-tight">
              <p className="truncate text-sm font-medium text-base-content">{fullName}</p>
              <p className="truncate text-xs text-base-content/60">{UI_STRINGS.roles[user.role]}</p>
            </div>
            {/* No `alt`: decorative, because the name block beside it already
                names this person. `colorKey` is the id so the fallback colour
                survives a rename. */}
            <Avatar src={user.profilePictureUrl} name={fullName} colorKey={user.id} size="sm" />
          </>
        )}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="btn btn-outline btn-sm gap-2 focus-visible:ring-2 focus-visible:ring-primary"
        >
          {loggingOut ? <Spinner label={UI_STRINGS.header.loggingOut} /> : UI_STRINGS.header.logout}
        </button>
      </div>
    </div>
  )
}
