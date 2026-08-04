// Ported from DashWind (daisyui-admin-dashboard-template) — MIT (c) 2022 Dashwind. See THIRD_PARTY_NOTICES.md
// Chart.js registration is centralised in `./charts` (do not re-register here); the
// template's random series is frozen to literals in `dashboard-mock-data`.
import { useRef } from 'react'
import type { ChartOptions } from 'chart.js'
import { Line } from 'react-chartjs-2'
import './charts'
import { TitleCard } from './TitleCard'
import { LINE_CHART_DATA, LINE_CHART_TITLE } from './dashboard-mock-data'
import { useChartThemeColors } from './useChartThemeColors'

/** Monthly-active-users line chart. */
export function LineChart() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { text, grid } = useChartThemeColors(containerRef)

  const options: ChartOptions<'line'> = {
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
    <TitleCard title={LINE_CHART_TITLE}>
      <div ref={containerRef}>
        <Line data={LINE_CHART_DATA} options={options} />
      </div>
    </TitleCard>
  )
}
