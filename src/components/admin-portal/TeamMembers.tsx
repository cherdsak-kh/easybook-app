// Adapted from DashWind (daisyui-admin-dashboard-template),
// https://github.com/robbins23/daisyui-admin-dashboard-template — MIT (c) 2022 Dashwind.
// See THIRD_PARTY_NOTICES.md. Ports `pages/protected/Team.js` + `features/settings/team`
// (the members table). Stripped: Redux (`useDispatch`, `showNotification`,
// `setPageTitle`) and `moment` — the "Invite New" button is inert visual-only, and
// the template's `moment(new Date()).add(-5*n,'days')` join dates are FROZEN to fixed
// literals (same treatment as the dashboard mock's random series) so the table is
// deterministic. Reuses the presentational `TitleCard` from `@/components/dashboard/*`.
import { useState } from 'react'
import { TitleCard } from '@/components/dashboard/TitleCard'

interface TeamMember {
  readonly name: string
  readonly avatar: string
  readonly email: string
  readonly role: string
  /** Frozen literal (template computed `moment().add(-5*n,'days')` — non-deterministic). */
  readonly joinedOn: string
  readonly lastActive: string
}

/**
 * The DashWind demo members, VERBATIM in name/email/role/lastActive/avatar. Only the
 * `joinedOn` dates — which the template derived from the current clock — are frozen
 * to fixed literals (preserving the template's ~5-day spacing) so the mock never
 * shifts between renders.
 */
const TEAM_MEMBERS: readonly TeamMember[] = [
  { name: 'Alex', avatar: 'https://reqres.in/img/faces/1-image.jpg', email: 'alex@dashwind.com', role: 'Owner', joinedOn: '26 Jun 2024', lastActive: '5 hr ago' },
  { name: 'Ereena', avatar: 'https://reqres.in/img/faces/2-image.jpg', email: 'ereena@dashwind.com', role: 'Admin', joinedOn: '21 Jun 2024', lastActive: '15 min ago' },
  { name: 'John', avatar: 'https://reqres.in/img/faces/3-image.jpg', email: 'jhon@dashwind.com', role: 'Admin', joinedOn: '16 Jun 2024', lastActive: '20 hr ago' },
  { name: 'Matrix', avatar: 'https://reqres.in/img/faces/4-image.jpg', email: 'matrix@dashwind.com', role: 'Manager', joinedOn: '11 Jun 2024', lastActive: '1 hr ago' },
  { name: 'Virat', avatar: 'https://reqres.in/img/faces/5-image.jpg', email: 'virat@dashwind.com', role: 'Support', joinedOn: '06 Jun 2024', lastActive: '40 min ago' },
  { name: 'Miya', avatar: 'https://reqres.in/img/faces/6-image.jpg', email: 'miya@dashwind.com', role: 'Support', joinedOn: '27 May 2024', lastActive: '5 hr ago' },
]

/** Role → daisyUI badge, verbatim from the template's `getRoleComponent`. */
function RoleBadge({ role }: { role: string }) {
  if (role === 'Admin') return <div className="badge badge-secondary">{role}</div>
  if (role === 'Manager') return <div className="badge">{role}</div>
  if (role === 'Owner') return <div className="badge badge-primary">{role}</div>
  if (role === 'Support') return <div className="badge badge-accent">{role}</div>
  return <div className="badge badge-ghost">{role}</div>
}

/** Inert "Invite New" control — visual parity, no Redux notification (design §5). */
function TopSideButtons() {
  return (
    <button type="button" className="btn btn-primary btn-sm px-6 normal-case">
      Invite New
    </button>
  )
}

/**
 * The DashWind "Active Members" table, presentational/mock. The row set is held in
 * local state (as the template did) though it never mutates here — kept for parity.
 */
export function TeamMembers() {
  const [members] = useState(TEAM_MEMBERS)

  return (
    <TitleCard title="Active Members" topMargin="mt-2" topSideButtons={<TopSideButtons />}>
      <div className="w-full overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email Id</th>
              <th>Joined On</th>
              <th>Role</th>
              <th>Last Active</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.email}>
                <td>
                  <div className="flex items-center space-x-3">
                    <div className="avatar">
                      <div className="mask mask-circle h-12 w-12 bg-base-300">
                        <img src={member.avatar} alt={member.name} loading="lazy" />
                      </div>
                    </div>
                    <div>
                      <div className="font-bold">{member.name}</div>
                    </div>
                  </div>
                </td>
                <td>{member.email}</td>
                <td>{member.joinedOn}</td>
                <td>
                  <RoleBadge role={member.role} />
                </td>
                <td>{member.lastActive}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TitleCard>
  )
}
