// Adapted from DashWind (daisyui-admin-dashboard-template),
// https://github.com/robbins23/daisyui-admin-dashboard-template — MIT (c) 2022 Dashwind.
// See THIRD_PARTY_NOTICES.md. A single parameterised placeholder page in the spirit of
// the template's `pages/protected/Blank.js` / `404.js` — used for every DashWind menu
// target that has no bespoke replica page (Leads, Transactions, Analytics, Integration,
// Calendar, Register, Forgot Password, Blank Page, 404, Profile, Billing, Getting
// Started, Features, Components). Parameterising by `title` avoids ~14 near-identical
// files while keeping every sidebar item a real, navigable route (Phase 3.5). Reuses
// the presentational `TitleCard` from `@/components/dashboard/*` (unmodified).
import DocumentTextIcon from '@heroicons/react/24/outline/DocumentTextIcon'
import { TitleCard } from '@/components/dashboard/TitleCard'

interface AdminPortalStubPageProps {
  /** The DashWind menu label — matches the header title from `usePageTitle`. */
  readonly title: string
}

/**
 * A "coming soon" placeholder that renders inside the replica shell (so the sidebar,
 * header, page title and theme all stay live). Presentational only — no data, no auth.
 */
export function AdminPortalStubPage({ title }: AdminPortalStubPageProps) {
  return (
    <TitleCard title={title} topMargin="mt-2">
      <div className="hero py-16">
        <div className="hero-content text-center">
          <div className="max-w-md">
            <DocumentTextIcon aria-hidden className="mx-auto h-24 w-24 text-accent" />
            <h2 className="mt-4 text-2xl font-bold">{title}</h2>
            <p className="mt-2 text-base-content/60">
              This DashWind demo page is a placeholder — coming soon.
            </p>
          </div>
        </div>
      </div>
    </TitleCard>
  )
}
