// The admin-portal "Current Leads" surface. Phase 5 cutover: this renders REAL
// LINE-user data (via `useLineUsers` → `listLineUsers` / `patchLineUserAccess`),
// replacing the frozen `reqres.in` demo rows. It keeps the DashWind `TitleCard` +
// `table` chrome, but every row is a live LINE follower. All fetch/mutation/pagination
// orchestration lives in `useLineUsers`; this file is presentational + wiring only.
//
// Scoped OUT this phase (design §3.6 — deferred, NOT defects): the SUPER_ADMIN full-state
// override picker and the registration-edit modal. Approve/Block (the ADMIN-safe matrix
// transitions) is the row-action scope here.
import { TitleCard } from '@/components/dashboard/TitleCard'
import { AccessBadge } from '@/components/admin-portal/AccessBadge'
import { canAdminSetAccess } from '@/lib/access-policy'
import { useLineUsers } from '@/hooks/useLineUsers'
import type { AppAccess, LineUser } from '@/lib/api-client'

/** LOCAL admin-portal copy — deliberately not from `ui-strings-backend` (design §3.7). */
const T = {
  title: 'Current Leads',
  searchLabel: 'Search by display name',
  searchPlaceholder: 'Search leads…',
  accessFilterLabel: 'Filter by access',
  accessFilterAll: 'All access states',
  colName: 'Name',
  colStaffId: 'Staff ID',
  colFollowedAt: 'Followed At',
  colStatus: 'Status',
  colDepartment: 'Department',
  colActions: 'Actions',
  unknownUser: 'Unknown user',
  notRegistered: 'Not registered',
  emptyValue: '—',
  empty: 'No LINE users match the current filters.',
  approve: 'Approve',
  reinstate: 'Reinstate',
  block: 'Block',
  dismiss: 'Dismiss',
  paginationLabel: 'Leads pagination',
  previous: 'Previous',
  next: 'Next',
} as const

const ACCESS_LABELS: Record<AppAccess, string> = {
  UNREGISTERED: 'Unregistered',
  PENDING: 'Pending',
  ALLOWED: 'Allowed',
  BLOCKED: 'Blocked',
}
const ACCESS_FILTER_OPTIONS: readonly AppAccess[] = ['UNREGISTERED', 'PENDING', 'ALLOWED', 'BLOCKED']

function formatFollowedAt(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? T.emptyValue
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function initialsOf(name: string | null): string {
  if (!name) return '?'
  return name.trim().slice(0, 2).toUpperCase() || '?'
}

export function AdminPortalLeadsPage() {
  const {
    users,
    meta,
    totalPages,
    loading,
    error,
    rowError,
    pendingId,
    page,
    setPage,
    search,
    setSearch,
    accessFilter,
    setAccessFilter,
    changeAccess,
    clearRowError,
  } = useLineUsers()

  return (
    <TitleCard title={T.title} topMargin="mt-2">
      {/* Toolbar: debounced search + access filter (both reset to page 1). */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="leads-search" className="mb-1 block text-sm font-medium">
            {T.searchLabel}
          </label>
          <input
            id="leads-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={T.searchPlaceholder}
            className="input input-bordered w-full focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <div>
          <label htmlFor="leads-access-filter" className="mb-1 block text-sm font-medium">
            {T.accessFilterLabel}
          </label>
          <select
            id="leads-access-filter"
            aria-label={T.accessFilterLabel}
            value={accessFilter}
            onChange={(e) => setAccessFilter(e.target.value as AppAccess | '')}
            className="select select-bordered w-full focus-visible:ring-2 focus-visible:ring-primary sm:w-48"
          >
            <option value="">{T.accessFilterAll}</option>
            {ACCESS_FILTER_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {ACCESS_LABELS[a]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row-mutation error — dismissible, distinct from the page-level load error. */}
      {rowError && (
        <div role="alert" className="alert alert-error alert-soft mb-3 text-sm">
          <span className="flex-1">{rowError}</span>
          <button
            type="button"
            onClick={clearRowError}
            aria-label={T.dismiss}
            className="btn btn-ghost btn-xs focus-visible:ring-2 focus-visible:ring-error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Reserve height so state swaps (skeleton → error / empty / rows) don't shift layout. */}
      <div className="min-h-[16rem] w-full overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr>
              <th>{T.colName}</th>
              <th>{T.colStaffId}</th>
              <th>{T.colFollowedAt}</th>
              <th>{T.colStatus}</th>
              <th>{T.colDepartment}</th>
              <th className="text-right">{T.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows />}

            {!loading && error && (
              <tr>
                <td colSpan={6}>
                  <div role="alert" className="alert alert-error alert-soft justify-center text-center">
                    {error}
                  </div>
                </td>
              </tr>
            )}

            {!loading && !error && users.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-base-content/60">
                  {T.empty}
                </td>
              </tr>
            )}

            {!loading &&
              !error &&
              users.map((user) => (
                <LeadRow
                  key={user.id}
                  user={user}
                  pending={pendingId === user.id}
                  onChange={changeAccess}
                />
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination — hidden while loading / on error / when there are no pages. */}
      {!loading && !error && meta && totalPages > 0 && (
        <nav
          aria-label={T.paginationLabel}
          className="mt-4 flex items-center justify-between text-sm text-base-content/70"
        >
          <span>
            Page {meta.page} of {totalPages} · {meta.total} total
          </span>
          <div className="join">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1 || loading}
              className="btn btn-outline btn-sm join-item focus-visible:ring-2 focus-visible:ring-primary"
            >
              {T.previous}
            </button>
            <button
              type="button"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages || loading}
              className="btn btn-outline btn-sm join-item focus-visible:ring-2 focus-visible:ring-primary"
            >
              {T.next}
            </button>
          </div>
        </nav>
      )}
    </TitleCard>
  )
}

/** One LINE follower rendered as a Leads row (design §3.3 column mapping). */
function LeadRow({
  user,
  pending,
  onChange,
}: {
  user: LineUser
  pending: boolean
  onChange: (user: LineUser, access: AppAccess) => void
}) {
  const reg = user.registration
  const realName = reg ? `${reg.firstName} ${reg.lastName}`.trim() : ''
  return (
    <tr>
      <td>
        <div className="flex items-center gap-3">
          <div className="avatar">
            <div className="mask mask-squircle h-12 w-12">
              {user.pictureUrl ? (
                <img src={user.pictureUrl} alt="" loading="lazy" />
              ) : (
                <span
                  aria-hidden
                  className="flex h-full w-full items-center justify-center bg-base-300 text-sm font-semibold text-base-content/70"
                >
                  {initialsOf(user.displayName)}
                </span>
              )}
            </div>
          </div>
          <div className="min-w-0">
            <div className="truncate font-bold">{user.displayName ?? T.unknownUser}</div>
            <div className="truncate text-sm opacity-60">
              {realName || <span className="italic">{T.notRegistered}</span>}
            </div>
          </div>
        </div>
      </td>
      <td>{reg?.staffId || T.emptyValue}</td>
      <td>{formatFollowedAt(user.followedAt)}</td>
      <td>
        <AccessBadge access={user.access} />
      </td>
      <td>{reg?.department || T.emptyValue}</td>
      <td>
        <RowActions user={user} pending={pending} onChange={onChange} />
      </td>
    </tr>
  )
}

/**
 * ADMIN-safe quick actions, gated by the shared `canAdminSetAccess` matrix so a button
 * that would 403 is never shown. An UNREGISTERED row shows nothing; a BLOCKED row's
 * →ALLOWED button reads "Reinstate". SUPER_ADMIN's full-state override is out of scope
 * this phase (design §3.6). The backend stays the authority — this gate is UX only.
 */
function RowActions({
  user,
  pending,
  onChange,
}: {
  user: LineUser
  pending: boolean
  onChange: (user: LineUser, access: AppAccess) => void
}) {
  const name = user.displayName ?? T.unknownUser
  const from = user.access
  const showApprove = canAdminSetAccess(from, 'ALLOWED') && from !== 'ALLOWED'
  const showBlock = canAdminSetAccess(from, 'BLOCKED') && from !== 'BLOCKED'
  const reinstating = from === 'BLOCKED'

  return (
    <div className="flex items-center justify-end gap-2">
      {pending && (
        <span className="loading loading-spinner loading-xs text-base-content/50" aria-hidden />
      )}
      {showApprove && (
        <button
          type="button"
          onClick={() => onChange(user, 'ALLOWED')}
          disabled={pending}
          aria-label={`${reinstating ? T.reinstate : T.approve} ${name}`}
          className="btn btn-primary btn-sm normal-case focus-visible:ring-2 focus-visible:ring-primary"
        >
          {reinstating ? T.reinstate : T.approve}
        </button>
      )}
      {showBlock && (
        <button
          type="button"
          onClick={() => onChange(user, 'BLOCKED')}
          disabled={pending}
          aria-label={`${T.block} ${name}`}
          className="btn btn-outline btn-error btn-sm normal-case focus-visible:ring-2 focus-visible:ring-error"
        >
          {T.block}
        </button>
      )}
    </div>
  )
}

/** Loading placeholder — one testable node that reserves row height. */
function SkeletonRows() {
  return (
    <tr data-testid="leads-skeleton" aria-hidden>
      <td colSpan={6} className="p-0">
        <div className="space-y-3 py-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="h-12 w-12 shrink-0 rounded-lg bg-base-300 motion-safe:animate-pulse" />
              <span className="h-4 flex-1 rounded bg-base-300 motion-safe:animate-pulse" />
            </div>
          ))}
        </div>
      </td>
    </tr>
  )
}
