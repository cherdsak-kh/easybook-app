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
import ArrowRightOnRectangleIcon from '@heroicons/react/24/outline/ArrowRightOnRectangleIcon'
import BoltIcon from '@heroicons/react/24/outline/BoltIcon'
import CalendarDaysIcon from '@heroicons/react/24/outline/CalendarDaysIcon'
import ChartBarIcon from '@heroicons/react/24/outline/ChartBarIcon'
import CodeBracketSquareIcon from '@heroicons/react/24/outline/CodeBracketSquareIcon'
import Cog6ToothIcon from '@heroicons/react/24/outline/Cog6ToothIcon'
import CurrencyDollarIcon from '@heroicons/react/24/outline/CurrencyDollarIcon'
import DocumentDuplicateIcon from '@heroicons/react/24/outline/DocumentDuplicateIcon'
import DocumentIcon from '@heroicons/react/24/outline/DocumentIcon'
import DocumentTextIcon from '@heroicons/react/24/outline/DocumentTextIcon'
import ExclamationTriangleIcon from '@heroicons/react/24/outline/ExclamationTriangleIcon'
import InboxArrowDownIcon from '@heroicons/react/24/outline/InboxArrowDownIcon'
import KeyIcon from '@heroicons/react/24/outline/KeyIcon'
import Squares2X2Icon from '@heroicons/react/24/outline/Squares2X2Icon'
import TableCellsIcon from '@heroicons/react/24/outline/TableCellsIcon'
import UserIcon from '@heroicons/react/24/outline/UserIcon'
import UsersIcon from '@heroicons/react/24/outline/UsersIcon'
import WalletIcon from '@heroicons/react/24/outline/WalletIcon'
import { ADMIN_PORTAL_ROUTES } from './routes'

/**
 * The one id the hamburger `<label>`, the drawer-overlay scrim, the ✕ close button
 * and the visually-hidden `drawer-toggle` checkbox must all agree on. Deliberately
 * DISTINCT from the real shell's `left-sidebar-drawer` so the replica's drawer never
 * cross-toggles the live portal's when both co-render (edge case, design §4c).
 */
export const ADMIN_PORTAL_DRAWER_ID = 'admin-portal-drawer'

/** DashWind wordmark, kept verbatim for brand fidelity. */
export const BRAND_NAME = 'DashWind'

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
  { label: 'Leads', icon: <InboxArrowDownIcon className={ICON} />, to: ADMIN_PORTAL_ROUTES.leads },
  { label: 'Transactions', icon: <CurrencyDollarIcon className={ICON} />, to: ADMIN_PORTAL_ROUTES.transactions },
  { label: 'Analytics', icon: <ChartBarIcon className={ICON} />, to: ADMIN_PORTAL_ROUTES.charts },
  { label: 'Integration', icon: <BoltIcon className={ICON} />, to: ADMIN_PORTAL_ROUTES.integration },
  { label: 'Calendar', icon: <CalendarDaysIcon className={ICON} />, to: ADMIN_PORTAL_ROUTES.calendar },
  {
    label: 'Pages',
    icon: <DocumentDuplicateIcon className={ICON} />,
    submenu: [
      // Live — the replica's own full-screen login screen (a real sibling route).
      { label: 'Login', icon: <ArrowRightOnRectangleIcon className={SUBMENU_ICON} />, to: ADMIN_PORTAL_ROUTES.login },
      { label: 'Register', icon: <UserIcon className={SUBMENU_ICON} />, to: ADMIN_PORTAL_ROUTES.register },
      { label: 'Forgot Password', icon: <KeyIcon className={SUBMENU_ICON} />, to: ADMIN_PORTAL_ROUTES.forgotPassword },
      { label: 'Blank Page', icon: <DocumentIcon className={SUBMENU_ICON} />, to: ADMIN_PORTAL_ROUTES.blank },
      { label: '404', icon: <ExclamationTriangleIcon className={SUBMENU_ICON} />, to: ADMIN_PORTAL_ROUTES.notFound },
    ],
  },
  {
    label: 'Settings',
    icon: <Cog6ToothIcon className={ICON} />,
    submenu: [
      { label: 'Profile', icon: <UserIcon className={SUBMENU_ICON} />, to: ADMIN_PORTAL_ROUTES.settingsProfile },
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

/** Absolute path → page title, built once from every leaf of `NAV_ITEMS`. */
const TITLE_BY_PATH = new Map<string, string>(
  NAV_ITEMS.flatMap((entry) => (isSubmenu(entry) ? entry.submenu : [entry])).map((leaf) => [
    leaf.to,
    leaf.label,
  ]),
)

/**
 * The navbar page title, derived from the SAME config the sidebar renders so the
 * two can never drift. Pure lookup (no Redux, no context): the brand name is the
 * fallback for any unmapped path.
 */
export function usePageTitle(pathname: string): string {
  return TITLE_BY_PATH.get(pathname) ?? BRAND_NAME
}
