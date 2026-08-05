// Ported from DashWind (daisyui-admin-dashboard-template) — MIT (c) 2022 Dashwind. See THIRD_PARTY_NOTICES.md
// EVERY leaf must carry a `to`: targets without a bespoke page render the shared
// `AdminPortalStubPage`, so no menu item is ever a dead end.
import type { ReactNode } from 'react'
import AdjustmentsHorizontalIcon from '@heroicons/react/24/outline/AdjustmentsHorizontalIcon'
import BellIcon from '@heroicons/react/24/outline/BellIcon'
import BoltIcon from '@heroicons/react/24/outline/BoltIcon'
import BookOpenIcon from '@heroicons/react/24/outline/BookOpenIcon'
import BriefcaseIcon from '@heroicons/react/24/outline/BriefcaseIcon'
import BuildingLibraryIcon from '@heroicons/react/24/outline/BuildingLibraryIcon'
import BuildingOffice2Icon from '@heroicons/react/24/outline/BuildingOffice2Icon'
import BuildingOfficeIcon from '@heroicons/react/24/outline/BuildingOfficeIcon'
import CalendarDaysIcon from '@heroicons/react/24/outline/CalendarDaysIcon'
import CalendarIcon from '@heroicons/react/24/outline/CalendarIcon'
import ChartBarIcon from '@heroicons/react/24/outline/ChartBarIcon'
import ChatBubbleBottomCenterTextIcon from '@heroicons/react/24/outline/ChatBubbleBottomCenterTextIcon'
import ChatBubbleLeftEllipsisIcon from '@heroicons/react/24/outline/ChatBubbleLeftEllipsisIcon'
import ChatBubbleLeftRightIcon from '@heroicons/react/24/outline/ChatBubbleLeftRightIcon'
import ClipboardDocumentCheckIcon from '@heroicons/react/24/outline/ClipboardDocumentCheckIcon'
import ClipboardDocumentListIcon from '@heroicons/react/24/outline/ClipboardDocumentListIcon'
import ClockIcon from '@heroicons/react/24/outline/ClockIcon'
import Cog6ToothIcon from '@heroicons/react/24/outline/Cog6ToothIcon'
import ExclamationTriangleIcon from '@heroicons/react/24/outline/ExclamationTriangleIcon'
import IdentificationIcon from '@heroicons/react/24/outline/IdentificationIcon'
import InformationCircleIcon from '@heroicons/react/24/outline/InformationCircleIcon'
import KeyIcon from '@heroicons/react/24/outline/KeyIcon'
import LifebuoyIcon from '@heroicons/react/24/outline/LifebuoyIcon'
import LockClosedIcon from '@heroicons/react/24/outline/LockClosedIcon'
import MegaphoneIcon from '@heroicons/react/24/outline/MegaphoneIcon'
import PresentationChartLineIcon from '@heroicons/react/24/outline/PresentationChartLineIcon'
import ShieldCheckIcon from '@heroicons/react/24/outline/ShieldCheckIcon'
import Squares2X2Icon from '@heroicons/react/24/outline/Squares2X2Icon'
import TagIcon from '@heroicons/react/24/outline/TagIcon'
import UserCircleIcon from '@heroicons/react/24/outline/UserCircleIcon'
import UserGroupIcon from '@heroicons/react/24/outline/UserGroupIcon'
import UserIcon from '@heroicons/react/24/outline/UserIcon'
import UserPlusIcon from '@heroicons/react/24/outline/UserPlusIcon'
import { ADMIN_NAV_STRINGS } from '@/constants/ui-strings-admin-nav'
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
 * USER-VISIBLE wordmark changed: DashWind attribution is still a licence obligation —
 * compressed to a one-line pointer per file, never removed; full notice in `THIRD_PARTY_NOTICES.md`.
 */
export const BRAND_NAME = BRAND.name

/**
 * ONE icon size for the whole menu. Nested submenu icons used to be `h-5 w-5`; they are
 * now the same `h-6 w-6` as the top level — a 20px glyph is the first thing an older
 * user loses at arm's length, and the PO asked for prominent icons.
 *
 * `shrink-0` keeps the glyph square when a long Thai label wraps onto a second line.
 * Every icon is `aria-hidden`: the text label always ships beside it, so the icon is
 * never the sole carrier of meaning.
 */
const ICON = 'h-6 w-6 shrink-0'

/** A single (leaf) nav entry. Every leaf is a LIVE route (`to` is required). */
export interface NavLeaf {
  readonly label: string
  readonly icon: ReactNode
  readonly to: string
}

/** A collapsible submenu group (its own items are leaves). Has no route of its own. */
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
 * A category of the menu. Sections WRAP entries, they do not replace them — a
 * {@link NavSubmenu} nests one level deeper, inside a section.
 *
 * The header is rendered as a daisyUI `<li class="menu-title">`: non-interactive and
 * non-focusable. A section header is never a link and never collapses its section.
 */
export interface NavSection {
  /** Thai category header. `undefined` = an unlabelled top group (section 0). */
  readonly title?: string
  readonly items: readonly NavEntry[]
}

/**
 * The admin portal's real information architecture: 5 sections, 31 leaves, 2 collapsible
 * submenus. Labels come from `ADMIN_NAV_STRINGS` — the same literals `routes.ts` uses for
 * the stub page titles — so a placeholder page can never be headed differently from the
 * menu item that reached it.
 *
 * This replaced the DashWind-verbatim menu wholesale. Its leftovers (Transactions,
 * Analytics/`charts`, Integration, Calendar, Billing and the whole Documentation submenu)
 * and the mock-data Team Members page were deleted rather than relabelled — see
 * `routes.ts`.
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  // --- Section 0 — no category header -------------------------------------
  {
    items: [
      {
        label: ADMIN_NAV_STRINGS.items.dashboard,
        icon: <Squares2X2Icon aria-hidden className={ICON} />,
        to: ADMIN_PORTAL_ROUTES.dashboard,
      },
    ],
  },

  // --- Section 1 — การบริหารจัดการ -------------------------------------------
  {
    title: ADMIN_NAV_STRINGS.sections.management,
    items: [
      {
        label: ADMIN_NAV_STRINGS.items.bookingCalendar,
        icon: <CalendarDaysIcon aria-hidden className={ICON} />,
        to: ADMIN_PORTAL_ROUTES.bookingCalendar,
      },
      {
        label: ADMIN_NAV_STRINGS.items.bookingRequests,
        icon: <ClipboardDocumentListIcon aria-hidden className={ICON} />,
        to: ADMIN_PORTAL_ROUTES.bookingRequests,
      },
      {
        label: ADMIN_NAV_STRINGS.items.announcements,
        icon: <MegaphoneIcon aria-hidden className={ICON} />,
        to: ADMIN_PORTAL_ROUTES.announcements,
      },
      {
        label: ADMIN_NAV_STRINGS.items.venues,
        icon: <BuildingOffice2Icon aria-hidden className={ICON} />,
        to: ADMIN_PORTAL_ROUTES.venues,
      },
      {
        label: ADMIN_NAV_STRINGS.items.holidays,
        icon: <CalendarIcon aria-hidden className={ICON} />,
        to: ADMIN_PORTAL_ROUTES.holidays,
      },
      // The REAL LINE-user registration page — bespoke, wired to live data. Untouched
      // by this overhaul apart from its new parent section.
      {
        label: ADMIN_NAV_STRINGS.items.lineUsers,
        icon: <IdentificationIcon aria-hidden className={ICON} />,
        to: ADMIN_PORTAL_ROUTES.lineUsers,
      },
      {
        label: ADMIN_NAV_STRINGS.items.feedback,
        icon: <ChatBubbleLeftRightIcon aria-hidden className={ICON} />,
        to: ADMIN_PORTAL_ROUTES.feedback,
      },
      // Successor to the deleted DashWind "Team Members" mock table: where the
      // still-outstanding staff-management rebuild will land. A placeholder for now.
      {
        label: ADMIN_NAV_STRINGS.items.staff,
        icon: <UserGroupIcon aria-hidden className={ICON} />,
        to: ADMIN_PORTAL_ROUTES.staff,
      },
    ],
  },

  // --- Section 2 — รายงานและสถิติ ---------------------------------------------
  {
    title: ADMIN_NAV_STRINGS.sections.reports,
    items: [
      {
        label: ADMIN_NAV_STRINGS.items.reportsAnalytics,
        icon: <ChartBarIcon aria-hidden className={ICON} />,
        to: ADMIN_PORTAL_ROUTES.reportsAnalytics,
      },
      // Distinct icon from the `booking-requests` DATA page above, so the two
      // similarly-worded entries never read as duplicates.
      {
        label: ADMIN_NAV_STRINGS.items.reportsBookingRequests,
        icon: <ClipboardDocumentCheckIcon aria-hidden className={ICON} />,
        to: ADMIN_PORTAL_ROUTES.reportsBookingRequests,
      },
      {
        label: ADMIN_NAV_STRINGS.items.reportsVenueUsage,
        icon: <BuildingLibraryIcon aria-hidden className={ICON} />,
        to: ADMIN_PORTAL_ROUTES.reportsVenueUsage,
      },
      {
        label: ADMIN_NAV_STRINGS.items.reportsRegistrations,
        icon: <UserPlusIcon aria-hidden className={ICON} />,
        to: ADMIN_PORTAL_ROUTES.reportsRegistrations,
      },
      {
        label: ADMIN_NAV_STRINGS.items.reportsFeedback,
        icon: <ChatBubbleBottomCenterTextIcon aria-hidden className={ICON} />,
        to: ADMIN_PORTAL_ROUTES.reportsFeedback,
      },
      {
        label: ADMIN_NAV_STRINGS.items.reportsSystemUsage,
        icon: <PresentationChartLineIcon aria-hidden className={ICON} />,
        to: ADMIN_PORTAL_ROUTES.reportsSystemUsage,
      },
      {
        label: ADMIN_NAV_STRINGS.items.reportsErrorLogs,
        icon: <ExclamationTriangleIcon aria-hidden className={ICON} />,
        to: ADMIN_PORTAL_ROUTES.reportsErrorLogs,
      },
    ],
  },

  // --- Section 3 — การตั้งค่า (two collapsible submenus) ----------------------
  {
    title: ADMIN_NAV_STRINGS.sections.settings,
    items: [
      {
        label: ADMIN_NAV_STRINGS.groups.account,
        icon: <UserCircleIcon aria-hidden className={ICON} />,
        submenu: [
          // The REAL self-service profile page. The label is the SHARED
          // `PROFILE_STRINGS.navLabel` — the navbar avatar dropdown renders the same
          // constant, so the two ways into this page cannot be worded differently.
          {
            label: PROFILE_STRINGS.navLabel,
            icon: <UserIcon aria-hidden className={ICON} />,
            to: ADMIN_PORTAL_ROUTES.profile,
          },
          // Coexists (for now) with the profile page's `ChangePasswordModal` — plan
          // assumption #2; consolidating the two is a later decision.
          {
            label: ADMIN_NAV_STRINGS.items.accountPassword,
            icon: <KeyIcon aria-hidden className={ICON} />,
            to: ADMIN_PORTAL_ROUTES.accountPassword,
          },
          {
            label: ADMIN_NAV_STRINGS.items.accountNotifications,
            icon: <BellIcon aria-hidden className={ICON} />,
            to: ADMIN_PORTAL_ROUTES.accountNotifications,
          },
          {
            label: ADMIN_NAV_STRINGS.items.accountPrivacy,
            icon: <LockClosedIcon aria-hidden className={ICON} />,
            to: ADMIN_PORTAL_ROUTES.accountPrivacy,
          },
          {
            label: ADMIN_NAV_STRINGS.items.accountLoginHistory,
            icon: <ClockIcon aria-hidden className={ICON} />,
            to: ADMIN_PORTAL_ROUTES.accountLoginHistory,
          },
        ],
      },
      {
        label: ADMIN_NAV_STRINGS.groups.system,
        icon: <Cog6ToothIcon aria-hidden className={ICON} />,
        submenu: [
          {
            label: ADMIN_NAV_STRINGS.items.settingsBooking,
            icon: <AdjustmentsHorizontalIcon aria-hidden className={ICON} />,
            to: ADMIN_PORTAL_ROUTES.settingsBooking,
          },
          {
            label: ADMIN_NAV_STRINGS.items.settingsVenueTypes,
            icon: <TagIcon aria-hidden className={ICON} />,
            to: ADMIN_PORTAL_ROUTES.settingsVenueTypes,
          },
          {
            label: ADMIN_NAV_STRINGS.items.settingsRoles,
            icon: <ShieldCheckIcon aria-hidden className={ICON} />,
            to: ADMIN_PORTAL_ROUTES.settingsRoles,
          },
          {
            label: ADMIN_NAV_STRINGS.items.settingsDepartments,
            icon: <BuildingOfficeIcon aria-hidden className={ICON} />,
            to: ADMIN_PORTAL_ROUTES.settingsDepartments,
          },
          {
            label: ADMIN_NAV_STRINGS.items.settingsPersonnelRoles,
            icon: <BriefcaseIcon aria-hidden className={ICON} />,
            to: ADMIN_PORTAL_ROUTES.settingsPersonnelRoles,
          },
          {
            label: ADMIN_NAV_STRINGS.items.settingsMessageTemplates,
            icon: <ChatBubbleLeftEllipsisIcon aria-hidden className={ICON} />,
            to: ADMIN_PORTAL_ROUTES.settingsMessageTemplates,
          },
          {
            label: ADMIN_NAV_STRINGS.items.settingsIntegrations,
            icon: <BoltIcon aria-hidden className={ICON} />,
            to: ADMIN_PORTAL_ROUTES.settingsIntegrations,
          },
        ],
      },
    ],
  },

  // --- Section 4 — ข้อมูลเพิ่มเติมและการสนับสนุน --------------------------------
  {
    title: ADMIN_NAV_STRINGS.sections.support,
    items: [
      {
        label: ADMIN_NAV_STRINGS.items.helpUserGuide,
        icon: <BookOpenIcon aria-hidden className={ICON} />,
        to: ADMIN_PORTAL_ROUTES.helpUserGuide,
      },
      {
        label: ADMIN_NAV_STRINGS.items.helpContactSupport,
        icon: <LifebuoyIcon aria-hidden className={ICON} />,
        to: ADMIN_PORTAL_ROUTES.helpContactSupport,
      },
      {
        label: ADMIN_NAV_STRINGS.items.helpVersion,
        icon: <InformationCircleIcon aria-hidden className={ICON} />,
        to: ADMIN_PORTAL_ROUTES.helpVersion,
      },
    ],
  },
]

/**
 * Every LIVE destination in the menu, flattened across sections and submenus, in render
 * order. Callers (and tests) use this instead of re-deriving a `flatMap` over the section
 * tree — the nesting is now two levels deep, so hand-rolled flattening silently misses
 * the submenu leaves.
 */
export function allNavLeaves(): readonly NavLeaf[] {
  return NAV_SECTIONS.flatMap((section) =>
    section.items.flatMap((entry) => (isSubmenu(entry) ? entry.submenu : [entry])),
  )
}
