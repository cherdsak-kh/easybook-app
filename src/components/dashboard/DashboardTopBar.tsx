// Adapted from DashWind (daisyui-admin-dashboard-template),
// https://github.com/robbins23/daisyui-admin-dashboard-template — MIT (c) 2022 Dashwind.
// See THIRD_PARTY_NOTICES.md. Ports `features/dashboard/components/DashboardTopBar.js`.
// The `react-tailwindcss-datepicker` (whose only behaviour was a Redux
// `showNotification` on change — stripped) is DROPPED and replaced by a static,
// read-only daisyUI input. The Refresh/Share/⋮ controls are kept for parity as
// static, no-op buttons. `menu-compact` → `menu-sm` (the one v4→v5 rename in scope).
import ArrowPathIcon from '@heroicons/react/24/outline/ArrowPathIcon'
import ShareIcon from '@heroicons/react/24/outline/ShareIcon'
import EllipsisVerticalIcon from '@heroicons/react/24/outline/EllipsisVerticalIcon'
import EnvelopeIcon from '@heroicons/react/24/outline/EnvelopeIcon'
import ArrowDownTrayIcon from '@heroicons/react/24/outline/ArrowDownTrayIcon'

// Frozen demo range spanning the charts' Jan–Jul window. Static: this overview
// makes no network calls, so there is no period to actually change.
const REPORTING_PERIOD = '01 Jan 2024 – 31 Jul 2024'

/** Static top bar: a read-only period field and no-op Refresh/Share/more controls. */
export function DashboardTopBar() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <input
          type="text"
          readOnly
          value={REPORTING_PERIOD}
          aria-label="Reporting period"
          className="input input-bordered w-72"
        />
      </div>
      <div className="text-right">
        <button type="button" className="btn btn-ghost btn-sm normal-case">
          <ArrowPathIcon aria-hidden className="mr-2 w-4" />
          Refresh Data
        </button>
        <button type="button" className="btn btn-ghost btn-sm normal-case ml-2">
          <ShareIcon aria-hidden className="mr-2 w-4" />
          Share
        </button>

        <div className="dropdown dropdown-bottom dropdown-end ml-2">
          <div tabIndex={0} role="button" aria-label="More actions" className="btn btn-ghost btn-square btn-sm normal-case">
            <EllipsisVerticalIcon aria-hidden className="w-5" />
          </div>
          <ul tabIndex={0} className="dropdown-content menu menu-sm z-10 w-52 rounded-box bg-base-100 p-2 shadow">
            <li>
              <button type="button">
                <EnvelopeIcon aria-hidden className="w-4" />
                Email Digests
              </button>
            </li>
            <li>
              <button type="button">
                <ArrowDownTrayIcon aria-hidden className="w-4" />
                Download
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
