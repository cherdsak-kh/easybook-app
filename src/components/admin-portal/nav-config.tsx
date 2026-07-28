// Sidebar config adapted from DashWind (daisyui-admin-dashboard-template),
// https://github.com/robbins23/daisyui-admin-dashboard-template — MIT (c) 2022 Dashwind.
// See THIRD_PARTY_NOTICES.md. Ports `routes/sidebar.js` — the VERBATIM DashWind menu
// labels/icons (built with the already-installed `@heroicons/react`) — as a local
// data list. Redux is irrelevant here (there was none). Phase 3.5: EVERY entry now
// carries a `to` and is a real React Router `NavLink` (the sidebar is fully
// clickable). `Dashboard` + `Team Members` navigate to bespoke pages; `Login` opens
// the replica login screen; every other target renders the shared `AdminPortalStubPage`
// placeholder — so no menu item is a dead end.
import type { ReactNode } from 'react'
import BoltIcon from '@heroicons/react/24/outline/BoltIcon'
import CalendarDaysIcon from '@heroicons/react/24/outline/CalendarDaysIcon'
import ChartBarIcon from '@heroicons/react/24/outline/ChartBarIcon'
import CodeBracketSquareIcon from '@heroicons/react/24/outline/CodeBracketSquareIcon'
import Cog6ToothIcon from '@heroicons/react/24/outline/Cog6ToothIcon'
import CurrencyDollarIcon from '@heroicons/react/24/outline/CurrencyDollarIcon'
import DocumentTextIcon from '@heroicons/react/24/outline/DocumentTextIcon'
import IdentificationIcon from '@heroicons/react/24/outline/IdentificationIcon'
import Squares2X2Icon from '@heroicons/react/24/outline/Squares2X2Icon'
import TableCellsIcon from '@heroicons/react/24/outline/TableCellsIcon'
import UserIcon from '@heroicons/react/24/outline/UserIcon'
import UsersIcon from '@heroicons/react/24/outline/UsersIcon'
import WalletIcon from '@heroicons/react/24/outline/WalletIcon'
import { BRAND } from '@/constants/ui-strings-brand'
import { PROFILE_STRINGS } from '@/constants/ui-strings-profile'
import { ADMIN_PORTAL_ROUTES } from './routes'

/**
 * The one id the hamburger `<label>`, the drawer-overlay scrim, the ✕ close button
 * and the visually-hidden `drawer-toggle` checkbox must all agree on. Deliberately
 * DISTINCT from the real shell's `left-sidebar-drawer` so the replica's drawer never
 * cross-toggles the live portal's when both co-render (edge case, design §4c).
 */
export const ADMIN_PORTAL_DRAWER_ID = 'admin-portal-drawer'

/**
 * The sidebar wordmark. Re-exported from the shared {@link BRAND} module rather than
 * declared here so the login screen (`LandingIntro`) and the shell cannot disagree.
 *
 * It used to be the literal `'DashWind'` — the upstream template's name. Only the
 * USER-VISIBLE wordmark changed: the DashWind attribution comments in this file and in
 * `THIRD_PARTY_NOTICES.md` are a licence obligation and stay exactly as they are.
 */
export const BRAND_NAME = BRAND.name

const ICON = 'h-6 w-6'
const SUBMENU_ICON = 'h-5 w-5'

/** A single (leaf) nav entry. Every leaf is a LIVE route (`to` is required). */
export interface NavLeaf {
  readonly label: string
  readonly icon: ReactNode
  readonly to: string
}

/** A collapsible submenu group (its own items are leaves). */
export interface NavSubmenu {
  readonly label: string
  readonly icon: ReactNode
  readonly submenu: readonly NavLeaf[]
}

export type NavEntry = NavLeaf | NavSubmenu

/** Type guard: does this entry open a submenu? */
export function isSubmenu(entry: NavEntry): entry is NavSubmenu {
  return 'submenu' in entry
}

/**
 * The DashWind sidebar, verbatim in labels + icon choices (`routes/sidebar.js`).
 * Every leaf carries a real `to`: Dashboard, Leads + Team Members reach bespoke pages,
 * Login opens the replica login screen, and every other target reaches the shared
 * `AdminPortalStubPage` — so the whole menu navigates (Phase 3.5 / 3.6).
 */
export const NAV_ITEMS: readonly NavEntry[] = [
  { label: 'Dashboard', icon: <Squares2X2Icon className={ICON} />, to: ADMIN_PORTAL_ROUTES.dashboard },
  { label: 'ข้อมูลการลงทะเบียน', icon: <IdentificationIcon className={ICON} />, to: ADMIN_PORTAL_ROUTES.lineUsers },
  { label: 'Transactions', icon: <CurrencyDollarIcon className={ICON} />, to: ADMIN_PORTAL_ROUTES.transactions },
  { label: 'Analytics', icon: <ChartBarIcon className={ICON} />, to: ADMIN_PORTAL_ROUTES.charts },
  { label: 'Integration', icon: <BoltIcon className={ICON} />, to: ADMIN_PORTAL_ROUTES.integration },
  { label: 'Calendar', icon: <CalendarDaysIcon className={ICON} />, to: ADMIN_PORTAL_ROUTES.calendar },
  // REMOVED: the DashWind `Pages` submenu (Login / Register / Forgot Password / Blank
  // Page). Three of its four leaves pointed at "coming soon" placeholders for auth screens
  // this product does not have and will not grow here — self-service registration and
  // password recovery are deliberately NOT features of an invite-only back office — so the
  // routes were deleted with the menu rather than left as reachable dead ends.
  //
  // `/admin-portal/login` is untouched and still the app's real, working login page; it is
  // simply not a SIDEBAR entry, because the sidebar only renders inside the authenticated
  // shell, where "go to the login page" is not a thing anyone needs.
  {
    label: 'Settings',
    icon: <Cog6ToothIcon className={ICON} />,
    submenu: [
      // The REAL self-service profile page. This leaf used to point at the
      // `settings-profile` DashWind stub; the stub (and its route constant) were
      // removed with it, so the sidebar carries exactly ONE profile entry. The label
      // is the SHARED `PROFILE_STRINGS.navLabel` — the navbar avatar dropdown renders
      // the same constant, so the two ways into this page cannot be worded differently.
      {
        label: PROFILE_STRINGS.navLabel,
        icon: <UserIcon className={SUBMENU_ICON} />,
        to: ADMIN_PORTAL_ROUTES.profile,
      },
      { label: 'Billing', icon: <WalletIcon className={SUBMENU_ICON} />, to: ADMIN_PORTAL_ROUTES.settingsBilling },
      // The ported Team members table (PO scope addition) — a bespoke page.
      { label: 'Team Members', icon: <UsersIcon className={SUBMENU_ICON} />, to: ADMIN_PORTAL_ROUTES.team },
    ],
  },
  {
    label: 'Documentation',
    icon: <DocumentTextIcon className={ICON} />,
    submenu: [
      { label: 'Getting Started', icon: <DocumentTextIcon className={SUBMENU_ICON} />, to: ADMIN_PORTAL_ROUTES.gettingStarted },
      { label: 'Features', icon: <TableCellsIcon className={SUBMENU_ICON} />, to: ADMIN_PORTAL_ROUTES.features },
      { label: 'Components', icon: <CodeBracketSquareIcon className={SUBMENU_ICON} />, to: ADMIN_PORTAL_ROUTES.components },
    ],
  },
]

// REMOVED (PO review): `TITLE_BY_PATH` + `usePageTitle(pathname)`. They existed only to
// feed the navbar's `<h1>{pageTitle}</h1>`, which is gone from `AdminPortalHeader` for
// every page at every breakpoint (on mobile the hamburger overlapped it). Nothing else
// imported either symbol — grep-verified — so they are deleted rather than left as dead
// code. `BRAND_NAME` survives: the sidebar's wordmark still uses it.
