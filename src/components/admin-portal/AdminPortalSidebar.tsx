// Ported from DashWind (daisyui-admin-dashboard-template) — MIT (c) 2022 Dashwind. See THIRD_PARTY_NOTICES.md
// ~31 rows do not fit one viewport, so the sidebar is a fixed-height flex column: a brand
// header that never scrolls away, and a nav body that scrolls on its own. The explicit
// `gap-1` row spacing is load-bearing: it restores the daisyUI-4 template's breathable
// menu, which daisyUI-5 compacts by default.
import { useLocation } from 'react-router-dom'
import XMarkIcon from '@heroicons/react/24/outline/XMarkIcon'
import { BRAND } from '@/constants/ui-strings-brand'
import { SidebarSubmenu } from './SidebarSubmenu'
import { SidebarLeafLink } from './sidebar-row'
import {
  ADMIN_PORTAL_DRAWER_ID,
  BRAND_NAME,
  NAV_SECTIONS,
  isSubmenu,
  type NavSubmenu,
} from './nav-config'

/** Does any LIVE leaf of this submenu match the current path? Drives auto-expand. */
function submenuHasActiveChild(entry: NavSubmenu, pathname: string): boolean {
  return entry.submenu.some((leaf) => leaf.to === pathname)
}

/**
 * The admin-portal sidebar, rendered as daisyUI's `drawer-side`. On `lg+` it is
 * persistent; on mobile it slides in over a `drawer-overlay` scrim. Both the scrim
 * `<label>` and the ✕ button point at the drawer checkbox so tapping either closes it, and
 * each `NavLink`'s `onClick` closes it too.
 *
 * Layout: `.drawer-side` is `height: 100dvh` in both modes, so the `<nav>` is pinned to
 * `h-dvh` and split into a `shrink-0` brand header and a `flex-1 overflow-y-auto` body.
 * That is what keeps the wordmark on screen through a 31-item scroll; `overscroll-contain`
 * stops that scroll chaining into the page content behind it.
 *
 * Structure: one `<ul class="menu">` per section, each headed by a non-interactive
 * `<li class="menu-title">` that also names the list via `aria-labelledby`, so a screen
 * reader announces the category before its leaves instead of reading 31 orphaned links.
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
        className="flex h-dvh w-80 flex-col bg-base-100 text-base-content"
      >
        {/* Brand row: the real EasyBook mark + wordmark, both from the shared `BRAND`
            module so this row and the login screen's `LandingIntro` cannot drift apart.
            The mark is served from `public/` at its runtime URL, not imported as a module.
            `sticky top-0` is belt-and-braces on top of the flex pinning; the opaque
            `bg-base-100` keeps scrolled rows from showing through it. The ✕ moved INTO
            this row (it used to be `absolute`, so it scrolled off the top of a long menu). */}
        <div className="sticky top-0 z-10 flex shrink-0 items-center gap-3 border-b border-base-300 bg-base-100 px-4 py-3">
          <img
            src={BRAND.logoSrc}
            alt={BRAND.logoAlt}
            width={40}
            height={40}
            className="h-10 w-10 object-contain"
          />
          <span className="text-xl font-semibold">{BRAND_NAME}</span>
          {/* Mobile-only close affordance (keyboard-reachable, unlike the scrim). */}
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Close menu"
            className="btn btn-ghost btn-circle ml-auto lg:hidden"
          >
            <XMarkIcon aria-hidden className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pb-8">
          {NAV_SECTIONS.map((section, index) => {
            const titleId = section.title
              ? `${ADMIN_PORTAL_DRAWER_ID}-section-${index}`
              : undefined

            return (
              <ul
                key={section.title ?? `section-${index}`}
                aria-labelledby={titleId}
                className={[
                  'menu w-full gap-1',
                  // A rule above every LABELLED section visually separates the groups; the
                  // unlabelled section 0 sits flush at the top with no leading rule.
                  section.title ? 'border-t border-base-300' : '',
                ].join(' ')}
              >
                {section.title && (
                  // Non-interactive, non-focusable, never a link. daisyUI's stock
                  // `menu-title` colour is `base-content` at 40% — 1.60:1 on `cupcake`,
                  // which is unreadable — so it is pinned to /90 (6.39:1 / 6.42:1) and
                  // distinguished from leaves by SIZE + WEIGHT + tracking, not by colour.
                  <li
                    id={titleId}
                    className="menu-title text-sm font-bold tracking-wide text-base-content/90"
                  >
                    {section.title}
                  </li>
                )}

                {section.items.map((entry) => {
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
                      {/* Same component the nested submenu leaves use, so a top-level row
                          and a submenu row cannot drift apart. */}
                      <SidebarLeafLink leaf={entry} onNavigate={closeDrawer} />
                    </li>
                  )
                })}
              </ul>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
