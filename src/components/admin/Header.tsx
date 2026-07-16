import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Spinner } from '@/components/Spinner'
import { Avatar } from '@/components/admin/Avatar'
import { useAuth } from '@/auth/useAuth'
import { ROUTES } from '@/constants/routes'
import type { AdminUser } from '@/auth/auth-context'

/** Human-friendly role label. */
const ROLE_LABEL: Record<AdminUser['role'], string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  STAFF: 'Staff',
}

/**
 * Square brand mark. DECORATIVE (`alt=""`): the "EasyBook Management System"
 * text sits immediately beside it, so alt text here would make a screen reader
 * announce the product twice in a row.
 */
const LOGO_MARK = '/logo/easybook-logo-512px-no-bg.svg'

/**
 * Dashboard top bar: a mobile menu toggle, the logged-in admin's name + role,
 * and a Logout button. Logout destroys the server session then returns to login.
 */
export function Header({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
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
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <button
        type="button"
        onClick={onMenuToggle}
        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 md:hidden dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label="Toggle navigation menu"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <span className="flex min-w-0 items-center gap-2">
        <img src={LOGO_MARK} alt="" aria-hidden className="h-8 w-8 shrink-0 select-none" />
        <span className="truncate font-semibold text-slate-900 dark:text-slate-100">
          EasyBook Management System
        </span>
      </span>

      <div className="ml-auto flex items-center gap-3">
        {user && (
          <>
            {/* `min-w-0` + `truncate`: the LINE webview is narrow and the bar now
                carries a logo and an avatar too — a long name must ellipsize
                rather than shove the Logout button off-screen. */}
            <div className="min-w-0 text-right leading-tight">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                {fullName}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {ROLE_LABEL[user.role]}
              </p>
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
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {loggingOut ? <Spinner label="Logging out…" /> : 'Logout'}
        </button>
      </div>
    </header>
  )
}
