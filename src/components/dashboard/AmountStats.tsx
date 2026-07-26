// Adapted from DashWind (daisyui-admin-dashboard-template),
// https://github.com/robbins23/daisyui-admin-dashboard-template — MIT (c) 2022 Dashwind.
// See THIRD_PARTY_NOTICES.md. Ports `features/dashboard/components/AmountStats.js`.
// The `btn` actions were demo controls; kept for visual parity as static, no-op
// buttons. Values are placeholder demo metrics (local literals, not chrome copy).

/** Two-cell `stats` block: amount to be collected + cash in hand. */
export function AmountStats() {
  return (
    <div className="stats bg-base-100 shadow">
      <div className="stat">
        <div className="stat-title">Amount to be Collected</div>
        <div className="stat-value">$25,600</div>
        <div className="stat-actions">
          <button type="button" className="btn btn-xs">
            View Users
          </button>
        </div>
      </div>

      <div className="stat">
        <div className="stat-title">Cash in hand</div>
        <div className="stat-value">$5,600</div>
        <div className="stat-actions">
          <button type="button" className="btn btn-xs">
            View Members
          </button>
        </div>
      </div>
    </div>
  )
}
