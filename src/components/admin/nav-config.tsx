// Sidebar route-config shape modeled on DashWind (daisyui-admin-dashboard-template),
// https://github.com/robbins23/daisyui-admin-dashboard-template — MIT (c) 2022 Dashwind.
// Populated entirely from OUR routes + copy dictionary (no template data).
import type { ReactNode } from 'react'
import { ROUTES } from '@/constants/routes'
import { UI_STRINGS } from '@/constants/ui-strings-backend'

/**
 * The one id the hamburger `<label>`, the drawer-overlay scrim, the ✕ close
 * button and the visually-hidden `drawer-toggle` checkbox must all agree on, so
 * tapping any of them flips the SAME daisyUI drawer state. Lives here (not in a
 * component file) so `DashboardLayout`, `Sidebar` and `Header` share it without
 * importing one another.
 */
export const SIDEBAR_DRAWER_ID = 'left-sidebar-drawer'

export interface NavItem {
  /** Absolute react-router path from `ROUTES.*`. */
  readonly to: string
  /** Visible label + nav accessible name, from `UI_STRINGS.nav.*`. */
  readonly label: string
  /** Inline SVG glyph (no icon dependency — carried from the old Sidebar). */
  readonly icon: ReactNode
}

export interface NavGroup {
  /** Group header copy, from `UI_STRINGS.nav.*`. */
  readonly title: string
  readonly items: readonly NavItem[]
}

/**
 * The single source feeding BOTH the sidebar render and the page-title lookup,
 * so a nav label and its page title can never drift. Exactly the four in-scope
 * routes, grouped Management (3) / Account (1) — zero demo entries. Icons are the
 * same inline SVGs the previous hand-rolled sidebar shipped.
 */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    title: UI_STRINGS.nav.management,
    items: [
      {
        // The Dashboard Overview, first so it is the top link (matching the
        // template, where "Dashboard" leads). Mapped to `ROUTES.dashboard` (the
        // index path), which now renders `DashboardOverviewPage` — so this entry
        // also supplies that path's header title via `usePageTitle`.
        to: ROUTES.dashboard,
        label: UI_STRINGS.nav.dashboard,
        icon: (
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
            <path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z" />
          </svg>
        ),
      },
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
    ],
  },
  {
    // Self-service, available to every role — not a management surface.
    title: UI_STRINGS.nav.account,
    items: [
      {
        to: ROUTES.profile,
        label: UI_STRINGS.nav.profile,
        icon: (
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4Zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4Z" />
          </svg>
        ),
      },
    ],
  },
]

/** Built once from `NAV_GROUPS`: absolute path → nav label. */
const TITLE_BY_PATH = new Map(NAV_GROUPS.flatMap((g) => g.items).map((i) => [i.to, i.label]))

/**
 * The navbar page title, derived from the SAME config the sidebar renders so the
 * two can never drift. Pure lookup (no Redux, no context): the index path
 * `/backend/dashboard` now renders the Overview and maps to "Dashboard", and the
 * four child paths map to their own labels; the brand is the fallback for any
 * unmapped path.
 */
export function usePageTitle(pathname: string): string {
  return TITLE_BY_PATH.get(pathname) ?? UI_STRINGS.header.brand
}
