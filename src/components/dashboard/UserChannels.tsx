// Adapted from DashWind (daisyui-admin-dashboard-template),
// https://github.com/robbins23/daisyui-admin-dashboard-template — MIT (c) 2022 Dashwind.
// See THIRD_PARTY_NOTICES.md. Ports `features/dashboard/components/UserChannels.js`
// ("User Signup Source") — the dashboard's actual table. Rows are demo literals
// from `dashboard-mock-data`. daisyUI `table` is structurally unchanged v4→v5.
import { TitleCard } from './TitleCard'
import { USER_SOURCE_ROWS } from './dashboard-mock-data'

/** "User Signup Source" table, paired with the Doughnut chart in the last row. */
export function UserChannels() {
  return (
    <TitleCard title="User Signup Source">
      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr>
              <th />
              <th>Source</th>
              <th>No of Users</th>
              <th>Conversion</th>
            </tr>
          </thead>
          <tbody>
            {USER_SOURCE_ROWS.map((row, index) => (
              <tr key={row.source}>
                <th>{index + 1}</th>
                <td>{row.source}</td>
                <td>{row.count}</td>
                <td>{`${row.conversionPercent}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TitleCard>
  )
}
