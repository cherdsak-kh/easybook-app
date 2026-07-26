// Adapted from DashWind (daisyui-admin-dashboard-template),
// https://github.com/robbins23/daisyui-admin-dashboard-template — MIT (c) 2022 Dashwind.
// See THIRD_PARTY_NOTICES.md. Ports `containers/SidebarSubmenu.js`: typed, keeps the
// local `useState(isExpanded)` + `useLocation` auto-expand (no Redux — there was
// none). `menu-compact` → `menu-sm` (the one daisyUI v4→v5 rename). Phase 3.5: every
// submenu leaf is now a LIVE `NavLink` (the whole sidebar is clickable), and the rows
// use the same taller `py-2.5` spacing as the top-level menu.
import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import ChevronDownIcon from '@heroicons/react/24/outline/ChevronDownIcon'
import type { NavSubmenu } from './nav-config'
import { ADMIN_PORTAL_DRAWER_ID } from './nav-config'

const leafClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex items-center gap-2 py-2.5',
    isActive ? 'font-semibold bg-base-200' : 'font-normal',
  ].join(' ')

interface SidebarSubmenuProps {
  readonly entry: NavSubmenu
  /** Closes the mobile drawer after a real navigation. */
  readonly onNavigate: () => void
  /** True when a live child of this submenu is the current route (drives auto-open). */
  readonly hasActiveChild: boolean
}

export function SidebarSubmenu({ entry, onNavigate, hasActiveChild }: SidebarSubmenuProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Open the submenu on mount if it contains the active route (direct-load case).
  useEffect(() => {
    if (hasActiveChild) setIsExpanded(true)
  }, [hasActiveChild])

  const submenuId = `${ADMIN_PORTAL_DRAWER_ID}-submenu-${entry.label.replace(/\s+/g, '-').toLowerCase()}`

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        aria-expanded={isExpanded}
        aria-controls={submenuId}
        className="flex w-full items-center gap-2 py-3"
      >
        {entry.icon}
        <span className="flex-1 text-left">{entry.label}</span>
        <ChevronDownIcon
          aria-hidden
          className={`h-5 w-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      <div id={submenuId} className={`w-full ${isExpanded ? '' : 'hidden'}`}>
        <ul className="menu menu-sm gap-1">
          {entry.submenu.map((leaf) => (
            <li key={leaf.label}>
              <NavLink to={leaf.to} end onClick={onNavigate} className={leafClass}>
                {leaf.icon}
                <span>{leaf.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
