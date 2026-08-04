// Ported from DashWind (daisyui-admin-dashboard-template) — MIT (c) 2022 Dashwind. See THIRD_PARTY_NOTICES.md
// The `btn` actions are intentionally static no-ops (visual parity); values are placeholder
// demo metrics — local literals on purpose, not chrome copy for `ui-strings-*`.

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
