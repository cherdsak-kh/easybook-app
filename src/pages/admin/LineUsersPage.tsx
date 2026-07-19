import { useEffect, useRef, useState } from 'react'
import {
  ApiError,
  listLineUsers,
  patchLineUserAccess,
  type AppAccess,
  type LineUser,
  type PaginatedLineUsers,
} from '@/lib/api-client'
import { AccessBadge } from '@/components/admin/AccessBadge'
import { LineUserRegistrationModal } from '@/components/admin/LineUserRegistrationModal'
import { Spinner } from '@/components/Spinner'
import { useAuth } from '@/auth/useAuth'
import { canAdminSetAccess } from '@/lib/access-policy'
import { UI_STRINGS } from '@/constants/ui-strings-backend'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

const LU = UI_STRINGS.lineUsers

const PAGE_SIZE = 20
const ACCESS_OPTIONS: readonly AppAccess[] = ['UNREGISTERED', 'PENDING', 'ALLOWED', 'BLOCKED']

function formatFollowedAt(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? UI_STRINGS.lineUsers.emptyValue
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function initialsOf(name: string | null): string {
  if (!name) return UI_STRINGS.avatar.unknownInitials
  return name.trim().slice(0, 2).toUpperCase() || UI_STRINGS.avatar.unknownInitials
}

/**
 * LINE Users management: a paginated list with a debounced display-name search,
 * an access filter, and a per-row **header / body / footer** card. The header
 * carries identity + state as one unit (Avatar, display name, and the status badge
 * inline top-left); the body is the registration details; the footer pins ALL the
 * interactive controls bottom-right — role-gated access transitions plus, on a
 * registered row, the registration Edit button — so status and actions never
 * cluster. Both roles get the matrix-permitted quick actions and the Edit button;
 * SUPER_ADMIN also gets a full-state access override picker on top. Row mutations
 * (access change AND registration edit) patch the row in place, no full-page
 * reload. 401 bounces to login; a 403 (the client gate drifting out of sync with
 * the server, e.g. between load and click) and 404 surface as non-crashing notices
 * — never a silent no-op, never a logout.
 */
export function LineUsersPage() {
  const { user: currentUser, expireSession } = useAuth()
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN'

  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [accessFilter, setAccessFilter] = useState<AppAccess | ''>('')
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300)

  const [result, setResult] = useState<PaginatedLineUsers | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  /** The row whose registration is being edited (null = modal closed). */
  const [editing, setEditing] = useState<LineUser | null>(null)

  const reqId = useRef(0)

  useEffect(() => {
    const id = ++reqId.current
    setLoading(true)
    setError(null)
    listLineUsers({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      access: accessFilter || undefined,
    })
      .then((res) => {
        if (id !== reqId.current) return
        setResult(res)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (id !== reqId.current) return
        if (err instanceof ApiError && err.status === 401) {
          expireSession()
          return
        }
        setError(
          err instanceof ApiError && err.status === 403
            ? UI_STRINGS.lineUsers.loadForbidden
            : UI_STRINGS.lineUsers.loadFailed,
        )
        setLoading(false)
      })
  }, [page, debouncedSearch, accessFilter, expireSession])

  async function changeAccess(user: LineUser, access: AppAccess) {
    setPendingId(user.id)
    setRowError(null)
    try {
      const updated = await patchLineUserAccess(user.id, access)
      setResult((prev) =>
        prev
          ? { ...prev, data: prev.data.map((u) => (u.id === updated.id ? updated : u)) }
          : prev,
      )
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        expireSession()
        return
      }
      if (err instanceof ApiError && err.status === 404) {
        setRowError(UI_STRINGS.lineUsers.rowGone)
      } else if (err instanceof ApiError && err.status === 403) {
        setRowError(UI_STRINGS.lineUsers.rowForbidden)
      } else {
        setRowError(UI_STRINGS.lineUsers.rowFailed)
      }
    } finally {
      setPendingId(null)
    }
  }

  /** Patch an updated user into the loaded page in place — same optimistic
   *  row-update the access change uses; no full-list re-fetch. */
  function replaceRow(updated: LineUser) {
    setResult((prev) =>
      prev
        ? { ...prev, data: prev.data.map((u) => (u.id === updated.id ? updated : u)) }
        : prev,
    )
  }

  function onRegistrationSaved(updated: LineUser) {
    replaceRow(updated)
    setEditing(null)
  }

  function onRegistrationRowGone() {
    setRowError(UI_STRINGS.lineUsers.rowGone)
    setEditing(null)
  }

  function onSearchChange(value: string) {
    setSearchInput(value)
    setPage(1)
  }

  function onFilterChange(value: string) {
    setAccessFilter(value as AppAccess | '')
    setPage(1)
  }

  const meta = result?.meta
  const totalPages = meta?.totalPages ?? 0
  const users = result?.data ?? []

  return (
    <section aria-labelledby="line-users-heading" className="mx-auto w-full max-w-4xl">
      <div className="mb-4">
        <h1 id="line-users-heading" className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {UI_STRINGS.lineUsers.heading}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {UI_STRINGS.lineUsers.subheading}
        </p>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label
            htmlFor="line-user-search"
            className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            {UI_STRINGS.lineUsers.searchLabel}
          </label>
          <input
            id="line-user-search"
            type="search"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={UI_STRINGS.lineUsers.searchPlaceholder}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <div>
          <label
            htmlFor="line-user-access-filter"
            className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            {UI_STRINGS.lineUsers.accessLabel}
          </label>
          <select
            id="line-user-access-filter"
            aria-label={UI_STRINGS.lineUsers.accessFilterLabel}
            value={accessFilter}
            onChange={(e) => onFilterChange(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:w-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">{UI_STRINGS.lineUsers.accessFilterAll}</option>
            {ACCESS_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {UI_STRINGS.access[a]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {rowError && (
        <p
          role="alert"
          className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400"
        >
          {rowError}
        </p>
      )}

      {/* Body: reserve height so state swaps don't shift layout. */}
      <div className="min-h-[16rem]">
        {loading && <ListSkeleton />}

        {!loading && error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
          >
            {error}
          </div>
        )}

        {!loading && !error && users.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {UI_STRINGS.lineUsers.empty}
          </div>
        )}

        {!loading && !error && users.length > 0 && (
          <ul className="space-y-2">
            {users.map((user) => (
              <li
                key={user.id}
                className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
              >
                {/* Header: identity + state as ONE unit — Avatar, display name and
                    the status badge inline top-left. The controls live in the
                    footer, diagonally opposite, so status and actions never cluster. */}
                <div className="flex items-start gap-3">
                  <Avatar user={user} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                        {user.displayName ?? LU.unknownUser}
                      </p>
                      <span role="group" aria-label={LU.statusHeader} className="shrink-0">
                        <AccessBadge access={user.access} />
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {LU.followedAt(formatFollowedAt(user.followedAt))}
                    </p>
                  </div>
                </div>

                {/* Body: the registration details. */}
                <RegistrationDetails registration={user.registration} />

                {/* Footer: ALL interactive controls, bottom-right. */}
                <div
                  role="group"
                  aria-label={LU.actionsHeader}
                  className="mt-3 flex flex-wrap items-center justify-end gap-2"
                >
                  <RowActions
                    user={user}
                    pending={pendingId === user.id}
                    isSuperAdmin={isSuperAdmin}
                    onChange={changeAccess}
                    onEdit={setEditing}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pagination */}
      {meta && totalPages > 0 && (
        <nav
          aria-label={UI_STRINGS.lineUsers.pagination.label}
          className="mt-4 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300"
        >
          <span>{UI_STRINGS.lineUsers.pagination.summary(meta.page, totalPages, meta.total)}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {UI_STRINGS.lineUsers.pagination.previous}
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages || loading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {UI_STRINGS.lineUsers.pagination.next}
            </button>
          </div>
        </nav>
      )}

      {/* Registration edit modal. Rendered only for a row that has a registration;
          the Edit affordance that opens it is likewise hidden without one. 409/400
          surface inline in the modal, 404 becomes a row notice, 401 logs out. */}
      {editing && editing.registration && (
        <LineUserRegistrationModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={onRegistrationSaved}
          onSessionExpired={expireSession}
          onRowGone={onRegistrationRowGone}
        />
      )}
    </section>
  )
}

/**
 * The registration credentials submitted by the user, so an admin approves a
 * *person* rather than a bare LINE handle. `registration` is `null` for a
 * follower who never completed the form — rendered as a muted "Not registered".
 *
 * Note: the admin list DTO (`LineUserRegistrationSummaryDto`) now includes the
 * applicant's phone (PII decision reversed so admins can vet registrations — see
 * the 2026-07-15 follow-up in 03_implement_log.md), shown alongside the rest.
 */
function RegistrationDetails({ registration }: { registration: LineUser['registration'] }) {
  if (!registration) {
    return (
      <p className="mt-3 w-full border-t border-slate-100 pt-2 text-xs italic text-slate-400 dark:border-slate-800 dark:text-slate-500">
        {UI_STRINGS.lineUsers.registration.none}
      </p>
    )
  }
  const { firstName, lastName, staffId, phone, personnelRole, department } = registration
  const reg = UI_STRINGS.lineUsers.registration
  return (
    <dl className="mt-3 grid w-full grid-cols-2 gap-x-4 gap-y-1.5 border-t border-slate-100 pt-2 text-xs sm:grid-cols-3 dark:border-slate-800">
      <Detail
        label={reg.realName}
        value={`${firstName} ${lastName}`.trim() || UI_STRINGS.lineUsers.emptyValue}
      />
      <Detail label={reg.staffId} value={staffId} />
      <Detail label={reg.phone} value={phone} />
      <Detail label={reg.role} value={personnelRole} />
      <Detail label={reg.department} value={department} />
    </dl>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.7rem] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </dt>
      <dd className="truncate text-slate-700 dark:text-slate-200" title={value}>
        {value || UI_STRINGS.lineUsers.emptyValue}
      </dd>
    </div>
  )
}

function Avatar({ user }: { user: LineUser }) {
  if (user.pictureUrl) {
    return (
      <img
        src={user.pictureUrl}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full object-cover"
        loading="lazy"
      />
    )
  }
  return (
    <span
      aria-hidden
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200"
    >
      {initialsOf(user.displayName)}
    </span>
  )
}

/**
 * The role-gated footer controls. BOTH roles get the same matrix-permitted quick
 * actions (one shared `QuickActions`, so the two paths can never drift) and — on a
 * row that HAS a registration — the same registration Edit button; SUPER_ADMIN
 * gets the full-state access override picker **in addition**. The difference
 * between the roles is therefore purely additive — SUPER_ADMIN = ADMIN's controls
 * + the override on top. Order matches the design's footer enumeration
 * (Approve/Block → Edit → override). The pending spinner sits alongside. Rendered
 * as a fragment: the row wraps this in the bottom-right footer group.
 */
function RowActions({
  user,
  pending,
  isSuperAdmin,
  onChange,
  onEdit,
}: {
  user: LineUser
  pending: boolean
  isSuperAdmin: boolean
  onChange: (user: LineUser, access: AppAccess) => void
  onEdit: (user: LineUser) => void
}) {
  return (
    <>
      {pending && <Spinner label={LU.updating} className="text-slate-400" />}
      <QuickActions user={user} pending={pending} onChange={onChange} />
      {/* Edit is hidden when there is no registration to edit (UNREGISTERED /
          followers who never submitted the form) — the backend would 404. */}
      {user.registration && <EditRegistrationButton user={user} pending={pending} onEdit={onEdit} />}
      {isSuperAdmin && <OverrideControl user={user} pending={pending} onChange={onChange} />}
    </>
  )
}

/**
 * Opens the registration-edit modal for a row that has a registration. Its
 * accessible name is "Edit registration for {name}", distinct from the SUPER_ADMIN
 * access override's "Edit access for {name}" so assistive tech never confuses the
 * two even though both read "Edit" on screen.
 */
function EditRegistrationButton({
  user,
  pending,
  onEdit,
}: {
  user: LineUser
  pending: boolean
  onEdit: (user: LineUser) => void
}) {
  const name = user.displayName ?? LU.thisUser
  return (
    <button
      type="button"
      onClick={() => onEdit(user)}
      disabled={pending}
      aria-label={LU.edit.actionFor(name)}
      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {LU.edit.action}
    </button>
  )
}

/**
 * ADMIN's matrix-gated transitions. A button appears only when
 * `canAdminSetAccess(from, to)` permits it AND the target differs from the
 * current state, so an ADMIN never sees an action the backend would 403 (nor a
 * redundant "Approve" on an already-approved user). An UNREGISTERED row shows no
 * actions at all. →ALLOWED reads "Reinstate" for a blocked user, "Approve"
 * otherwise; both send the same `ALLOWED` PATCH.
 */
function QuickActions({
  user,
  pending,
  onChange,
}: {
  user: LineUser
  pending: boolean
  onChange: (user: LineUser, access: AppAccess) => void
}) {
  const name = user.displayName ?? LU.thisUser
  const from = user.access
  const showApprove = canAdminSetAccess(from, 'ALLOWED') && from !== 'ALLOWED'
  const showBlock = canAdminSetAccess(from, 'BLOCKED') && from !== 'BLOCKED'
  const reinstating = from === 'BLOCKED'
  return (
    <>
      {showApprove && (
        <button
          type="button"
          onClick={() => onChange(user, 'ALLOWED')}
          disabled={pending}
          aria-label={reinstating ? LU.reinstateUser(name) : LU.approveUser(name)}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
        >
          {reinstating ? LU.reinstate : LU.approve}
        </button>
      )}
      {showBlock && (
        <button
          type="button"
          onClick={() => onChange(user, 'BLOCKED')}
          disabled={pending}
          aria-label={LU.blockUser(name)}
          className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
        >
          {LU.block}
        </button>
      )}
    </>
  )
}

/**
 * SUPER_ADMIN's full-state override. Collapsed to a single "Edit" button until
 * opened; expanding reveals a picker over ALL four `AppAccess` states plus Apply.
 * SUPER_ADMIN bypasses the ADMIN matrix, so every state is offered — including
 * UNREGISTERED / PENDING, which an ADMIN can never set. The picker closes
 * optimistically on Apply; a rejected write surfaces in the row-level notice.
 */
function OverrideControl({
  user,
  pending,
  onChange,
}: {
  user: LineUser
  pending: boolean
  onChange: (user: LineUser, access: AppAccess) => void
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState<AppAccess>(user.access)
  const name = user.displayName ?? LU.thisUser

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(user.access)
          setOpen(true)
        }}
        disabled={pending}
        aria-label={LU.editAccessFor(name)}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {LU.editAccess}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label={LU.overridePickerLabel(name)}
        value={value}
        onChange={(e) => setValue(e.target.value as AppAccess)}
        disabled={pending}
        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        {ACCESS_OPTIONS.map((a) => (
          <option key={a} value={a}>
            {UI_STRINGS.access[a]}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => {
          onChange(user, value)
          setOpen(false)
        }}
        disabled={pending}
        aria-label={LU.applyOverrideFor(name)}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
      >
        {LU.applyOverride}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        disabled={pending}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {UI_STRINGS.common.cancel}
      </button>
    </div>
  )
}

function ListSkeleton() {
  return (
    <ul className="space-y-2" aria-hidden data-testid="line-users-skeleton">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
        >
          <span className="h-10 w-10 shrink-0 rounded-full bg-slate-200 motion-safe:animate-pulse dark:bg-slate-700" />
          <div className="flex-1 space-y-2">
            <span className="block h-4 w-40 rounded bg-slate-200 motion-safe:animate-pulse dark:bg-slate-700" />
            <span className="block h-3 w-24 rounded bg-slate-200 motion-safe:animate-pulse dark:bg-slate-700" />
          </div>
          <span className="h-6 w-16 rounded-full bg-slate-200 motion-safe:animate-pulse dark:bg-slate-700" />
        </li>
      ))}
    </ul>
  )
}
