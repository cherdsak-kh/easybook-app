// Ported from DashWind (daisyui-admin-dashboard-template) — MIT (c) 2022 Dashwind. See THIRD_PARTY_NOTICES.md
// Auto-expand is local `useState` + `useLocation` (no Redux — there was none upstream either).
// Markup is daisyUI's JS-driven submenu pattern (`menu-dropdown-toggle` / `menu-dropdown` /
// `menu-dropdown-show`), NOT `<details>`: `<summary>` cannot carry `aria-expanded` +
// `aria-controls`, and those are a hard requirement here.
import { useEffect, useState } from 'react'
import type { NavSubmenu } from './nav-config'
import { ADMIN_PORTAL_DRAWER_ID } from './nav-config'
import { SidebarLeafLink, SidebarSubmenuToggle } from './sidebar-row'

interface SidebarSubmenuProps {
  readonly entry: NavSubmenu
  /** Closes the mobile drawer after a real navigation. */
  readonly onNavigate: () => void
  /** True when a live child of this submenu is the current route (drives auto-open). */
  readonly hasActiveChild: boolean
}

/**
 * A collapsible group. Renders a FRAGMENT (toggle + list) rather than a wrapper `<div>`,
 * because daisyUI's dropdown selectors are direct-child ones — `li > .menu-dropdown-toggle`
 * for the chevron and `li > .menu-dropdown:not(.menu-dropdown-show)` for the hide — so a
 * wrapper element in between would silently disable both. The caller supplies the `<li>`.
 *
 * Collapsed by default; auto-expands when it contains the active route, including on a
 * direct URL load of a nested path such as `/admin-portal/settings/roles`. Navigating away
 * deliberately does NOT re-collapse it (prior behaviour, preserved).
 */
export function SidebarSubmenu({ entry, onNavigate, hasActiveChild }: SidebarSubmenuProps) {
  // Seeded from `hasActiveChild` so a direct deep link paints expanded on the FIRST frame
  // instead of flashing collapsed for one commit.
  const [isExpanded, setIsExpanded] = useState(hasActiveChild)

  // Re-open if the active route moves INTO this submenu after mount.
  useEffect(() => {
    if (hasActiveChild) setIsExpanded(true)
  }, [hasActiveChild])

  const submenuId = `${ADMIN_PORTAL_DRAWER_ID}-submenu-${entry.label.replace(/\s+/g, '-').toLowerCase()}`

  return (
    <>
      <SidebarSubmenuToggle
        entry={entry}
        isExpanded={isExpanded}
        submenuId={submenuId}
        onToggle={() => setIsExpanded((v) => !v)}
      />

      {/* `whitespace-normal` overrides daisyUI's `white-space: nowrap` on nested lists —
          without it the long Thai labels overflow a 320px drawer and are then clipped by
          the drawer's `overflow-x: hidden`. */}
      <ul
        id={submenuId}
        className={[
          'menu-dropdown gap-1 whitespace-normal',
          isExpanded ? 'menu-dropdown-show' : '',
        ].join(' ')}
      >
        {entry.submenu.map((leaf) => (
          <li key={leaf.label}>
            <SidebarLeafLink leaf={leaf} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </>
  )
}
