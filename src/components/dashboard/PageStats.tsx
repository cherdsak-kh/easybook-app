// Ported from DashWind (daisyui-admin-dashboard-template) — MIT (c) 2022 Dashwind. See THIRD_PARTY_NOTICES.md
// Values are placeholder demo metrics — local literals on purpose, not chrome copy for `ui-strings-*`.
import HeartIcon from '@heroicons/react/24/outline/HeartIcon'
import BoltIcon from '@heroicons/react/24/outline/BoltIcon'

/** Two-cell `stats` block: total likes + page views. */
export function PageStats() {
  return (
    <div className="stats bg-base-100 shadow">
      <div className="stat">
        <div className="stat-figure invisible md:visible">
          <HeartIcon aria-hidden className="h-8 w-8" />
        </div>
        <div className="stat-title">Total Likes</div>
        <div className="stat-value">25.6K</div>
        <div className="stat-desc">21% more than last month</div>
      </div>

      <div className="stat">
        <div className="stat-figure invisible md:visible">
          <BoltIcon aria-hidden className="h-8 w-8" />
        </div>
        <div className="stat-title">Page Views</div>
        <div className="stat-value">2.6M</div>
        <div className="stat-desc">14% more than last month</div>
      </div>
    </div>
  )
}
