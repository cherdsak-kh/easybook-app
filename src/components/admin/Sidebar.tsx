import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/admin/dashboard/line-users',
    label: 'LINE Users',
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M12 2C6.48 2 2 5.94 2 10.8c0 2.77 1.5 5.24 3.86 6.86-.13.5-.7 2.5-.73 2.66 0 0-.02.14.07.2.09.05.2.01.2.01.26-.04 2.98-1.96 3.45-2.29.72.1 1.46.16 2.15.16 5.52 0 10-3.94 10-8.8C22 5.94 17.52 2 12 2Z" />
      </svg>
    ),
  },
  {
    to: '/admin/dashboard/options',
    label: 'Registration Options',
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M12 2 4 6v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6l-8-4Zm-1.2 13.4-3.2-3.2 1.4-1.4 1.8 1.8 4.2-4.2 1.4 1.4-5.6 5.6Z" />
      </svg>
    ),
  },
  {
    to: '/admin/dashboard/staff',
    label: 'Staff',
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3Zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5Z" />
      </svg>
    ),
  },
]

/**
 * Dashboard navigation. Rendered inside a landmark `<nav>`; the active route is
 * highlighted via `NavLink`'s `isActive`. On mobile the parent slides this in a
 * drawer and passes `onNavigate` so tapping a link closes it.
 */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Dashboard" className="flex h-full flex-col gap-1 p-3">
      <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        Management
      </p>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            [
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
              isActive
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
            ].join(' ')
          }
        >
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
