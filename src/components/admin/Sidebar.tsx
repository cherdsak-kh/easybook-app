// Layout/structure adapted from DashWind (daisyui-admin-dashboard-template),
// https://github.com/robbins23/daisyui-admin-dashboard-template — MIT (c) 2022 Dashwind.
// See THIRD_PARTY_NOTICES.md. Adapts DashWind's LeftSidebar.js (drawer-side + menu).
import { Fragment } from 'react'
import { NavLink } from 'react-router-dom'
import { UI_STRINGS } from '@/constants/ui-strings-backend'
import { NAV_GROUPS, SIDEBAR_DRAWER_ID } from './nav-config'

const LOGO_MARK = '/logo/easybook-logo-512px-no-bg.svg'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
    isActive ? 'bg-primary/10 text-primary' : 'text-base-content/70 hover:bg-base-200',
  ].join(' ')

const titleClass =
  'menu-title px-3 text-xs font-semibold uppercase tracking-wide text-base-content/50'

/**
 * The dashboard sidebar, rendered as daisyUI's `drawer-side`. On `lg+` it is
 * persistent; on mobile it slides in over a `drawer-overlay` scrim. Both the
 * scrim `<label>` and the ✕ button point at the drawer checkbox so tapping either
 * closes it, and each `NavLink`'s `onClick` closes it too (a link-tap dismisses
 * the drawer on mobile; on `lg+` the checkbox is inert under `lg:drawer-open`).
 *
 * The list is a landmark `<nav>` wrapping a daisyUI `menu`. The active route is
 * driven by `NavLink`'s `isActive` render-prop — explicit token classes
 * (`bg-primary/10 text-primary`) plus a left accent bar — rather than daisyUI's
 * zero-specificity `.menu-active`, which our tokens would have to fight.
 */
export function Sidebar() {
  const closeDrawer = () => {
    ;(document.getElementById(SIDEBAR_DRAWER_ID) as HTMLInputElement | null)?.click()
  }

  return (
    <div className="drawer-side z-30">
      {/* Click-away scrim. DashWind ships this label with no accessible name;
          we add one so a screen reader announces a real close control. */}
      <label
        htmlFor={SIDEBAR_DRAWER_ID}
        aria-label={UI_STRINGS.nav.closeMenu}
        className="drawer-overlay"
      />

      <nav
        aria-label={UI_STRINGS.nav.label}
        className="relative flex min-h-full w-72 flex-col bg-base-100 p-3 text-base-content"
      >
        {/* Mobile-only close affordance (keyboard-reachable, unlike the scrim). */}
        <button
          type="button"
          onClick={closeDrawer}
          aria-label={UI_STRINGS.nav.closeMenu}
          className="btn btn-ghost btn-circle btn-sm absolute right-2 top-2 lg:hidden focus-visible:ring-2 focus-visible:ring-primary"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        {/* Brand row. Decorative logo (`alt=""`): the product name sits beside it. */}
        <div className="mb-2 flex items-center gap-2 px-2 py-1">
          <img src={LOGO_MARK} alt="" aria-hidden className="h-8 w-8 shrink-0 select-none" />
          <span className="truncate font-semibold text-base-content">{UI_STRINGS.header.brand}</span>
        </div>

        <ul className="menu w-full gap-1 p-0">
          {NAV_GROUPS.map((group) => (
            <Fragment key={group.title}>
              <li className={titleClass}>{group.title}</li>
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} end onClick={closeDrawer} className={linkClass}>
                    {({ isActive }) => (
                      <>
                        {item.icon}
                        <span>{item.label}</span>
                        {isActive && (
                          <span
                            aria-hidden
                            className="absolute inset-y-1 left-0 w-1 rounded-r bg-primary"
                          />
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </Fragment>
          ))}
        </ul>
      </nav>
    </div>
  )
}
