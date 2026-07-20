// Adapted from DashWind (daisyui-admin-dashboard-template),
// https://github.com/robbins23/daisyui-admin-dashboard-template — MIT (c) 2022 Dashwind.
// See THIRD_PARTY_NOTICES.md. Ports `features/dashboard/index.js` as a pure
// presentational composition: the template's Redux (`useDispatch` +
// `showNotification`, and the `setPageTitle` wrapper) is fully stripped — this
// page renders local mock data only and its title comes from `nav-config`.
import { DashboardTopBar } from '@/components/dashboard/DashboardTopBar'
import { StatCard } from '@/components/dashboard/StatCard'
import { LineChart } from '@/components/dashboard/LineChart'
import { BarChart } from '@/components/dashboard/BarChart'
import { AmountStats } from '@/components/dashboard/AmountStats'
import { PageStats } from '@/components/dashboard/PageStats'
import { UserChannels } from '@/components/dashboard/UserChannels'
import { DoughnutChart } from '@/components/dashboard/DoughnutChart'
import { STATS_CARDS } from '@/components/dashboard/dashboard-mock-data'

/**
 * The admin Dashboard Overview, rendered at the `/backend/dashboard` index.
 * Section order mirrors the template dashboard: TopBar → 4 StatCards → Line + Bar
 * → AmountStats + PageStats → UserChannels + Doughnut. All surfaces use daisyUI
 * semantic tokens, so the page adopts the admin `data-theme` from `ThemeLayout`.
 */
export function DashboardOverviewPage() {
  return (
    <>
      {/* Select-period bar (static) */}
      <DashboardTopBar />

      {/* KPI stat cards */}
      <div className="mt-2 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {STATS_CARDS.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      {/* Charts */}
      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LineChart />
        <BarChart />
      </div>

      {/* Amount + page stats */}
      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AmountStats />
        <PageStats />
      </div>

      {/* User source channels table + doughnut */}
      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UserChannels />
        <DoughnutChart />
      </div>
    </>
  )
}
