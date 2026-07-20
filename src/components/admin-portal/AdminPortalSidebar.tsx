// Adapted from DashWind (daisyui-admin-dashboard-template),
// https://github.com/robbins23/daisyui-admin-dashboard-template — MIT (c) 2022 Dashwind.
// See THIRD_PARTY_NOTICES.md. Ports `containers/LeftSidebar.js` (drawer-side + menu).
// Stripped: `useDispatch` (unused) and the template `routes/sidebar` import — the menu
// is driven by the local `NAV_ITEMS`. Phase 3.5: EVERY top-level entry is now a real
// `NavLink` (the sidebar is fully clickable) and the rows use DashWind's breathable
// spacing (`gap-1` between rows + taller `py-3` rows to match the daisyUI-4 template,
// which daisyUI-5 compacts by default). Close-drawer clicks target `ADMIN_PORTAL_DRAWER_ID`.
import { NavLink, useLocation } from 'react-router-dom'
import XMarkIcon from '@heroicons/react/24/outline/XMarkIcon'
import { SidebarSubmenu } from './SidebarSubmenu'
import {
  ADMIN_PORTAL_DRAWER_ID,
  BRAND_NAME,
  NAV_ITEMS,
  isSubmenu,
  type NavSubmenu,
} from './nav-config'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'relative flex items-center gap-2 py-3',
    isActive ? 'font-semibold bg-base-200' : 'font-normal',
  ].join(' ')

/** Does any LIVE leaf of this submenu match the current path? Drives auto-expand. */
function submenuHasActiveChild(entry: NavSubmenu, pathname: string): boolean {
  return entry.submenu.some((leaf) => leaf.to === pathname)
}

/**
 * The replica sidebar, rendered as daisyUI's `drawer-side`. On `lg+` it is
 * persistent; on mobile it slides in over a `drawer-overlay` scrim. Both the scrim
 * `<label>` and the ✕ button point at the drawer checkbox so tapping either closes
 * it, and each live `NavLink`'s `onClick` closes it too. The brand row keeps the
 * "DashWind" wordmark beside an inline-SVG placeholder mark (no binary asset).
 */
export function AdminPortalSidebar() {
  const { pathname } = useLocation()

  const closeDrawer = () => {
    ;(document.getElementById(ADMIN_PORTAL_DRAWER_ID) as HTMLInputElement | null)?.click()
  }

  return (
    <div className="drawer-side z-30">
      {/* Click-away scrim. DashWind ships this label with no accessible name; we
          add one so a screen reader announces a real close control. */}
      <label htmlFor={ADMIN_PORTAL_DRAWER_ID} aria-label="Close menu" className="drawer-overlay" />

      <nav
        aria-label="Sidebar navigation"
        className="relative min-h-full w-80 bg-base-100 pt-2 text-base-content"
      >
        {/* Mobile-only close affordance (keyboard-reachable, unlike the scrim). */}
        <button
          type="button"
          onClick={closeDrawer}
          aria-label="Close menu"
          className="btn btn-ghost btn-circle bg-base-300 absolute right-2 top-4 z-50 lg:hidden"
        >
          <XMarkIcon aria-hidden className="h-5 w-5" />
        </button>

        {/* `gap-1` widens the space between rows; `py-3` on each row (below) makes
            them taller — together they restore DashWind's breathable daisyUI-4 menu
            spacing that daisyUI-5 compacts by default. */}
        <ul className="menu w-full gap-1">
          {/* Brand row: inline-SVG placeholder mark + "DashWind" wordmark. */}
          <li className="mb-2 text-xl font-semibold">
            <div className="pointer-events-none flex items-center gap-2">
              <span
                aria-hidden
                className="mask mask-squircle flex h-10 w-10 items-center justify-center bg-primary text-primary-content"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                  <path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z" />
                </svg>
              </span>
              <span>{BRAND_NAME}</span>
            </div>
          </li>

          {NAV_ITEMS.map((entry) => {
            if (isSubmenu(entry)) {
              return (
                <li key={entry.label}>
                  <SidebarSubmenu
                    entry={entry}
                    onNavigate={closeDrawer}
                    hasActiveChild={submenuHasActiveChild(entry, pathname)}
                  />
                </li>
              )
            }
            return (
              <li key={entry.label}>
                <NavLink to={entry.to} end onClick={closeDrawer} className={linkClass}>
                  {({ isActive }) => (
                    <>
                      {entry.icon}
                      <span>{entry.label}</span>
                      {isActive && (
                        <span
                          aria-hidden
                          className="absolute inset-y-0 left-0 w-1 rounded-br-md rounded-tr-md bg-primary"
                        />
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
