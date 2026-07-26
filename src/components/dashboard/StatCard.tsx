// Adapted from DashWind (daisyui-admin-dashboard-template),
// https://github.com/robbins23/daisyui-admin-dashboard-template — MIT (c) 2022 Dashwind.
// See THIRD_PARTY_NOTICES.md. Ports `features/dashboard/components/DashboardStats.js`.
// The template's `dark:` utilities and dynamic `text-${COLORS[...]}` (COLORS was
// ["primary","primary"] → always primary) are replaced by daisyUI semantic tokens:
// figure/value use `text-primary`; the ↗︎/↙ deltas use `text-success`/`text-error`.
import type { StatCardData } from './dashboard-mock-data'

/**
 * Up deltas (↗︎) read as success, down deltas (↙) as error — both cues carry a
 * glyph as well as colour, so the direction is not conveyed by colour alone.
 */
function deltaClass(description: string): string {
  if (description.includes('↗︎')) return 'font-bold text-success'
  if (description.includes('↙')) return 'font-bold text-error'
  return ''
}

/** One KPI stat card (daisyUI `stats`/`stat`). */
export function StatCard({ title, value, description, icon: Icon }: StatCardData) {
  return (
    <div className="stats bg-base-100 shadow">
      <div className="stat">
        <div className="stat-figure text-primary">
          <Icon aria-hidden className="h-8 w-8" />
        </div>
        <div className="stat-title">{title}</div>
        <div className="stat-value text-primary">{value}</div>
        <div className={`stat-desc ${deltaClass(description)}`}>{description}</div>
      </div>
    </div>
  )
}
