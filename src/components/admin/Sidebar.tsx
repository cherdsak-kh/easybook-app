import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import { UI_STRINGS } from '@/constants/ui-strings-backend'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
}

const NAV_ITEMS: NavItem[] = [
  {
    to: ROUTES.lineUsers,
    label: UI_STRINGS.nav.lineUsers,
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M12 2C6.48 2 2 5.94 2 10.8c0 2.77 1.5 5.24 3.86 6.86-.13.5-.7 2.5-.73 2.66 0 0-.02.14.07.2.09.05.2.01.2.01.26-.04 2.98-1.96 3.45-2.29.72.1 1.46.16 2.15.16 5.52 0 10-3.94 10-8.8C22 5.94 17.52 2 12 2Z" />
      </svg>
    ),
  },
  {
    to: ROUTES.options,
    label: UI_STRINGS.nav.options,
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M12 2 4 6v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6l-8-4Zm-1.2 13.4-3.2-3.2 1.4-1.4 1.8 1.8 4.2-4.2 1.4 1.4-5.6 5.6Z" />
      </svg>
    ),
  },
  {
    to: ROUTES.staff,
    label: UI_STRINGS.nav.staff,
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3Zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5Z" />
      </svg>
    ),
  },
]

/** Self-service, available to every role — not a management surface. */
const ACCOUNT_ITEMS: NavItem[] = [
  {
    to: ROUTES.profile,
    label: UI_STRINGS.nav.profile,
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4Zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4Z" />
      </svg>
    ),
  },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
    isActive
      ? 'bg-primary/10 text-primary'
      : 'text-base-content/70 hover:bg-base-200',
  ].join(' ')

const titleClass =
  'menu-title px-3 text-xs font-semibold uppercase tracking-wide text-base-content/50'

/**
 * Dashboard navigation. Rendered inside a landmark `<nav>` as a daisyUI `menu`;
 * the active route is highlighted via `NavLink`'s `isActive` (explicit token
 * classes keep the emerald→primary active look and win over menu's zero-
 * specificity defaults). On mobile the parent slides this in a drawer and passes
 * `onNavigate` so tapping a link closes it.
 */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label={UI_STRINGS.nav.label} className="h-full p-3">
      <ul className="menu w-full gap-1 p-0">
        <li className={titleClass}>{UI_STRINGS.nav.management}</li>
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} onClick={onNavigate} className={linkClass}>
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}

        <li className={`${titleClass} pt-3`}>{UI_STRINGS.nav.account}</li>
        {ACCOUNT_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} onClick={onNavigate} className={linkClass}>
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
