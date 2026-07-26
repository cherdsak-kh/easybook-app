// Adapted from DashWind (daisyui-admin-dashboard-template),
// https://github.com/robbins23/daisyui-admin-dashboard-template — MIT (c) 2022 Dashwind.
// See THIRD_PARTY_NOTICES.md. Ports `features/dashboard/components/BarChart.js`.
// Chart.js registration is centralised in `./charts`; the random series is frozen
// in `dashboard-mock-data`; legend/tick/grid colours follow the daisyUI theme.
import { useRef } from 'react'
import type { ChartOptions } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import './charts'
import { TitleCard } from './TitleCard'
import { BAR_CHART_DATA, BAR_CHART_TITLE } from './dashboard-mock-data'
import { useChartThemeColors } from './useChartThemeColors'

/** Two-store revenue bar chart. */
export function BarChart() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { text, grid } = useChartThemeColors(containerRef)

  const options: ChartOptions<'bar'> = {
    responsive: true,
    plugins: {
      legend: { position: 'top', labels: { color: text } },
    },
    scales: {
      x: { ticks: { color: text }, grid: { color: grid } },
      y: { ticks: { color: text }, grid: { color: grid } },
    },
  }

  return (
    <TitleCard title={BAR_CHART_TITLE}>
      <div ref={containerRef}>
        <Bar data={BAR_CHART_DATA} options={options} />
      </div>
    </TitleCard>
  )
}
