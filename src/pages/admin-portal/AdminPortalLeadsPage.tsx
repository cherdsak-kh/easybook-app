// Adapted from DashWind (daisyui-admin-dashboard-template),
// https://github.com/robbins23/daisyui-admin-dashboard-template — MIT (c) 2022 Dashwind.
// See THIRD_PARTY_NOTICES.md. Ports `features/leads/index.js` as the replica "Current
// Leads" table. Stripped: Redux (`useDispatch`/`useSelector`, `leadSlice`,
// `getLeadsContent`, `deleteLead`), `openModal`/`showNotification`, `axios` and
// `moment`. The template's data came from an async thunk hitting `reqres.in`; here the
// rows are a FROZEN static mock (same treatment as `TeamMembers`), so no network runs.
// The "Add New" button and the per-row delete buttons are inert no-ops (visual-only,
// like the Phase-3.5 profile/menu items). The template's
// `moment(new Date()).add(-5*(k+2),'days')` created-at dates are frozen to fixed
// literals so the table is deterministic. Reuses the presentational `TitleCard` from
// `@/components/dashboard/*` (unmodified) — the same one the Team page uses.
import { useState } from 'react'
import TrashIcon from '@heroicons/react/24/outline/TrashIcon'
import { TitleCard } from '@/components/dashboard/TitleCard'
import { ADMIN_PORTAL_AVATARS } from '@/components/admin-portal/avatars'

interface Lead {
  readonly firstName: string
  readonly lastName: string
  readonly email: string
  readonly avatar: string
  /** Frozen literal — template computed `moment().add(-5*(k+2),'days')` (non-deterministic). */
  readonly createdAt: string
}

/**
 * The DashWind demo leads. The template loaded these from `reqres.in/api/users?page=2`
 * (first_name / last_name / email / avatar) — the first_name / last_name / email are
 * reproduced here VERBATIM from that page's real payload (the `@reqres.in` emails are
 * that mock's own display text, not a fetched host). Six rows so every status badge
 * variant (index % 5 = 0..4) is on screen. Two fields differ from the raw template and
 * are deliberate:
 *  - `avatar`: the template's `reqres.in/img/faces/N-image.jpg` hotlinks are DEAD (that
 *    host now errors), so avatars are the LOCAL, offline-safe `ADMIN_PORTAL_AVATARS`
 *    SVGs (lead N -> avatar N by index), matching the `TeamMembers` table. Renders 100%
 *    of the time, even with no internet — no external host.
 *  - `createdAt`: the dates the template derived from the current clock are frozen to
 *    fixed literals (`DD MMM YY`, preserving the template's ~5-day spacing) so the mock
 *    never shifts between renders.
 */
const LEADS: readonly Lead[] = [
  { firstName: 'Michael', lastName: 'Lawson', email: 'michael.lawson@reqres.in', avatar: ADMIN_PORTAL_AVATARS[0], createdAt: '10 Jul 26' },
  { firstName: 'Lindsay', lastName: 'Ferguson', email: 'lindsay.ferguson@reqres.in', avatar: ADMIN_PORTAL_AVATARS[1], createdAt: '05 Jul 26' },
  { firstName: 'Tobias', lastName: 'Funke', email: 'tobias.funke@reqres.in', avatar: ADMIN_PORTAL_AVATARS[2], createdAt: '30 Jun 26' },
  { firstName: 'Byron', lastName: 'Fields', email: 'byron.fields@reqres.in', avatar: ADMIN_PORTAL_AVATARS[3], createdAt: '25 Jun 26' },
  { firstName: 'George', lastName: 'Edwards', email: 'george.edwards@reqres.in', avatar: ADMIN_PORTAL_AVATARS[4], createdAt: '20 Jun 26' },
  { firstName: 'Rachel', lastName: 'Howell', email: 'rachel.howell@reqres.in', avatar: ADMIN_PORTAL_AVATARS[5], createdAt: '15 Jun 26' },
]

/** Row index → daisyUI badge, verbatim from the template's `getDummyStatus(index % 5)`. */
function StatusBadge({ index }: { index: number }) {
  const variant = index % 5
  if (variant === 0) return <div className="badge">Not Interested</div>
  if (variant === 1) return <div className="badge badge-primary">In Progress</div>
  if (variant === 2) return <div className="badge badge-secondary">Sold</div>
  if (variant === 3) return <div className="badge badge-accent">Need Followup</div>
  return <div className="badge badge-ghost">Open</div>
}

/** Inert "Add New" control — visual parity, no Redux modal (template opened `LEAD_ADD_NEW`). */
function TopSideButtons() {
  return (
    <button type="button" className="btn px-6 btn-sm normal-case btn-primary" onClick={() => {}}>
      Add New
    </button>
  )
}

/**
 * The DashWind "Current Leads" table, presentational/mock. The row set is held in local
 * state (as the template held it in its slice) though it never mutates here — kept for
 * parity. No auth, no data fetching, no modal.
 */
export function AdminPortalLeadsPage() {
  const [leads] = useState(LEADS)

  return (
    <TitleCard title="Current Leads" topMargin="mt-2" topSideButtons={<TopSideButtons />}>
      <div className="overflow-x-auto w-full">
        <table className="table w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email Id</th>
              <th>Created At</th>
              <th>Status</th>
              <th>Assigned To</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead, index) => (
              <tr key={lead.email}>
                <td>
                  <div className="flex items-center space-x-3">
                    <div className="avatar">
                      <div className="mask mask-squircle w-12 h-12">
                        <img
                          src={lead.avatar}
                          alt={`${lead.firstName} ${lead.lastName}`}
                          loading="lazy"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="font-bold">{lead.firstName}</div>
                      <div className="text-sm opacity-50">{lead.lastName}</div>
                    </div>
                  </div>
                </td>
                <td>{lead.email}</td>
                <td>{lead.createdAt}</td>
                <td>
                  <StatusBadge index={index} />
                </td>
                <td>{lead.lastName}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-square btn-ghost"
                    aria-label={`Delete ${lead.firstName} ${lead.lastName}`}
                    onClick={() => {}}
                  >
                    <TrashIcon aria-hidden className="w-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TitleCard>
  )
}
