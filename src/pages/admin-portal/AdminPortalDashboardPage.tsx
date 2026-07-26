// Adapted from DashWind (daisyui-admin-dashboard-template),
// https://github.com/robbins23/daisyui-admin-dashboard-template — MIT (c) 2022 Dashwind.
// See THIRD_PARTY_NOTICES.md. Ports `features/dashboard/index.js` as a pure
// presentational composition that REUSES the Phase-2 `src/components/dashboard/*`
// components UNMODIFIED (they restyle to the DashWind palette automatically under the
// `dashwind-*` `data-theme`). No Redux, no `setPageTitle`, no network — section order
// mirrors the template dashboard (and the live `/backend` overview).
import { DashboardTopBar } from '@/components/dashboard/DashboardTopBar'
import { StatCard } from '@/components/dashboard/StatCard'
import { LineChart } from '@/components/dashboard/LineChart'
import { BarChart } from '@/components/dashboard/BarChart'
import { AmountStats } from '@/components/dashboard/AmountStats'
import { PageStats } from '@/components/dashboard/PageStats'
import { UserChannels } from '@/components/dashboard/UserChannels'
import { DoughnutChart } from '@/components/dashboard/DoughnutChart'
import { STATS_CARDS } from '@/components/dashboard/dashboard-mock-data'
import { useAdminPortalTheme } from '@/components/admin-portal/admin-portal-theme'

/**
 * The replica Dashboard Overview. Section order mirrors the template dashboard:
 * TopBar → 4 StatCards → Line + Bar → AmountStats + PageStats → UserChannels +
 * Doughnut. All surfaces use daisyUI semantic tokens, so the page adopts the
 * `dashwind-*` `data-theme` from `AdminPortalThemeLayout`.
 *
 * The `key={...theme}` on each Chart.js chart is the fix for the local-toggle chart
 * trap (see `AdminPortalThemeLayout`): those reused charts read their chrome colours
 * off the DOM in `useChartThemeColors`, but that shared hook keys its recompute on the
 * SYSTEM preference, not this in-memory toggle — and it is off-limits to edit. Changing
 * the key on a theme flip REMOUNTS each chart, which re-runs its `useLayoutEffect` and
 * re-reads the now-updated `--color-*` values off the themed DOM. The non-canvas cards
 * (StatCards, AmountStats, PageStats, UserChannels) restyle via CSS tokens and need no
 * remount.
 */
export function AdminPortalDashboardPage() {
  const { theme } = useAdminPortalTheme()

  return (
    <>
      <DashboardTopBar />

      <div className="mt-2 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {STATS_CARDS.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LineChart key={`admin-portal-line-${theme}`} />
        <BarChart key={`admin-portal-bar-${theme}`} />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AmountStats />
        <PageStats />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UserChannels />
        <DoughnutChart key={`admin-portal-doughnut-${theme}`} />
      </div>
    </>
  )
}
