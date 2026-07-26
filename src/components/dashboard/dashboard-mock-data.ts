// Demo data adapted from DashWind (daisyui-admin-dashboard-template),
// https://github.com/robbins23/daisyui-admin-dashboard-template — MIT (c) 2022 Dashwind.
// See THIRD_PARTY_NOTICES.md. Reproduces the template dashboard's `statsData`,
// chart datasets and `userSourceData` VERBATIM, typed and FROZEN: the template
// generated the Line/Bar series with `Math.random()` in the component body, which
// reshuffled on every render. Here those series are fixed literal arrays so the
// charts render deterministically (and are testable). These are placeholder demo
// metrics — they get replaced wholesale when real metrics are wired, which is why
// they live as local data rather than in a `src/constants/ui-strings-*.ts` module.
import type { ChartData } from 'chart.js'
import UserGroupIcon from '@heroicons/react/24/outline/UserGroupIcon'
import CreditCardIcon from '@heroicons/react/24/outline/CreditCardIcon'
import CircleStackIcon from '@heroicons/react/24/outline/CircleStackIcon'
import UsersIcon from '@heroicons/react/24/outline/UsersIcon'

/**
 * A `@heroicons/react` outline glyph. Derived from a real icon's type so it
 * matches by identity — every `24/outline` icon shares this exact signature.
 */
export type HeroIcon = typeof UserGroupIcon

/** One KPI stat card (was the template's `statsData` entries). */
export interface StatCardData {
  readonly title: string
  readonly value: string
  /** Free-text delta; a leading ↗︎/↙ drives the up/down colour in `StatCard`. */
  readonly description: string
  readonly icon: HeroIcon
}

/** The four KPI cards, verbatim from the template dashboard. */
export const STATS_CARDS: readonly StatCardData[] = [
  { title: 'New Users', value: '34.7k', description: '↗︎ 2300 (22%)', icon: UserGroupIcon },
  { title: 'Total Sales', value: '$34,545', description: 'Current month', icon: CreditCardIcon },
  { title: 'Pending Leads', value: '450', description: '50 in hot leads', icon: CircleStackIcon },
  { title: 'Active Users', value: '5.6k', description: '↙ 300 (18%)', icon: UsersIcon },
]

/** One "User Signup Source" row. */
export interface UserSourceRow {
  readonly source: string
  readonly count: string
  readonly conversionPercent: number
}

/** The "User Signup Source" table rows, verbatim from the template. */
export const USER_SOURCE_ROWS: readonly UserSourceRow[] = [
  { source: 'Facebook Ads', count: '26,345', conversionPercent: 10.2 },
  { source: 'Google Ads', count: '21,341', conversionPercent: 11.7 },
  { source: 'Instagram Ads', count: '34,379', conversionPercent: 12.4 },
  { source: 'Affiliates', count: '12,359', conversionPercent: 20.9 },
  { source: 'Organic', count: '10,345', conversionPercent: 10.3 },
]

/** Shared x-axis labels for the Line and Bar charts (template used Jan–Jul). */
const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July']

// Template typo "Montly" corrected to "Monthly" (it is our copy now).
export const LINE_CHART_TITLE = 'Monthly Active Users (in K)'

/**
 * FROZEN Line series. Template: `data: labels.map(() => Math.random() * 100 + 500)`
 * — a fixed sample from that 500–600 range so the chart never reshuffles.
 * `borderColor` / `backgroundColor` are the template's exact brand literals.
 */
export const LINE_CHART_DATA: ChartData<'line'> = {
  labels: MONTH_LABELS,
  datasets: [
    {
      fill: true,
      label: 'MAU',
      data: [542, 568, 521, 589, 534, 573, 556],
      borderColor: 'rgb(53, 162, 235)',
      backgroundColor: 'rgba(53, 162, 235, 0.5)',
    },
  ],
}

export const BAR_CHART_TITLE = 'Revenue'

/**
 * FROZEN Bar series. Template: `data: labels.map(() => Math.random() * 1000 + 500)`
 * per store — fixed samples from that 500–1500 range. Bar fills are the template's
 * exact brand literals.
 */
export const BAR_CHART_DATA: ChartData<'bar'> = {
  labels: MONTH_LABELS,
  datasets: [
    {
      label: 'Store 1',
      data: [845, 1120, 932, 1370, 760, 1240, 1080],
      backgroundColor: 'rgba(255, 99, 132, 1)',
    },
    {
      label: 'Store 2',
      data: [1180, 690, 1305, 940, 1420, 815, 1010],
      backgroundColor: 'rgba(53, 162, 235, 1)',
    },
  ],
}

export const DOUGHNUT_CHART_TITLE = 'Orders by Category'

/** Doughnut data — already fixed literals in the template; reproduced exactly. */
export const DOUGHNUT_CHART_DATA: ChartData<'doughnut'> = {
  labels: ['Electronics', 'Home Applicances', 'Beauty', 'Furniture', 'Watches', 'Apparel'],
  datasets: [
    {
      label: '# of Orders',
      data: [122, 219, 30, 51, 82, 13],
      backgroundColor: [
        'rgba(255, 99, 132, 0.8)',
        'rgba(54, 162, 235, 0.8)',
        'rgba(255, 206, 86, 0.8)',
        'rgba(75, 192, 192, 0.8)',
        'rgba(153, 102, 255, 0.8)',
        'rgba(255, 159, 64, 0.8)',
      ],
      borderColor: [
        'rgba(255, 99, 132, 1)',
        'rgba(54, 162, 235, 1)',
        'rgba(255, 206, 86, 1)',
        'rgba(75, 192, 192, 1)',
        'rgba(153, 102, 255, 1)',
        'rgba(255, 159, 64, 1)',
      ],
      borderWidth: 1,
    },
  ],
}
