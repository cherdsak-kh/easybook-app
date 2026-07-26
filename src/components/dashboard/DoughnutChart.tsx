// Adapted from DashWind (daisyui-admin-dashboard-template),
// https://github.com/robbins23/daisyui-admin-dashboard-template — MIT (c) 2022 Dashwind.
// See THIRD_PARTY_NOTICES.md. Ports `features/dashboard/components/DoughnutChart.js`.
// Chart.js registration is centralised in `./charts`; data is fixed literals in
// `dashboard-mock-data`; the legend label colour follows the daisyUI theme.
import { useRef } from 'react'
import type { ChartOptions } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import './charts'
import { TitleCard } from './TitleCard'
import { DOUGHNUT_CHART_DATA, DOUGHNUT_CHART_TITLE } from './dashboard-mock-data'
import { useChartThemeColors } from './useChartThemeColors'

/** Orders-by-category doughnut chart. */
export function DoughnutChart() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { text } = useChartThemeColors(containerRef)

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    plugins: {
      legend: { position: 'top', labels: { color: text } },
    },
  }

  return (
    <TitleCard title={DOUGHNUT_CHART_TITLE}>
      <div ref={containerRef}>
        <Doughnut data={DOUGHNUT_CHART_DATA} options={options} />
      </div>
    </TitleCard>
  )
}
