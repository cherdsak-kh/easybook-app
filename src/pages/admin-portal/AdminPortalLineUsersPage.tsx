// The admin-portal "LINE User Registration Data" surface (formerly "Leads"). Phase A:
// a re-contextualised, Thai-localized view of REAL LINE-user data (via `useLineUsers` →
// `listLineUsers`), replacing both the earlier live table AND the static mockup rows.
// It keeps the DashWind `TitleCard` chrome; every row is a live LINE follower. All
// fetch/pagination/filter orchestration still lives in `useLineUsers`; this file is
// presentational + wiring only.
//
// Phase A is READ-ONLY: the per-row "ตรวจสอบข้อมูล" action opens a single native
// `<dialog>` inspect modal that DISPLAYS a follower's registration details. The Phase-B
// edit mode / role-gated status select / two-endpoint save are deliberately NOT here — the
// `useLineUsers` mutation machinery (`changeAccess`/`rowError`/`pendingId`) is retained in
// the hook but intentionally unused by this page for now (plan §7).
import { useCallback, useRef, useState, type Ref } from 'react'
import MagnifyingGlassIcon from '@heroicons/react/24/outline/MagnifyingGlassIcon'
import PencilSquareIcon from '@heroicons/react/24/outline/PencilSquareIcon'
import { TitleCard } from '@/components/dashboard/TitleCard'
import { useLineUsers } from '@/hooks/useLineUsers'
import { useLineUserEditor, type UseLineUserEditor } from '@/hooks/useLineUserEditor'
import { useAuth } from '@/auth/useAuth'
import { canAdminSetAccess } from '@/lib/access-policy'
import type { AppAccess, LineUser, SystemRole } from '@/lib/api-client'
// Thai copy + status-badge map live in the centralized-but-modularized per-feature constants
// module (`@/constants/ui-strings-line-users`) so this component file exports ONLY components;
// the page and its tests share the same literal.
import { STATUS_BADGE, T } from '@/constants/ui-strings-line-users'

/** Access-filter option order (matches the toolbar's existing set). */
const ACCESS_FILTER_OPTIONS: readonly AppAccess[] = ['UNREGISTERED', 'PENDING', 'ALLOWED', 'BLOCKED']

/** Roles allowed to see the modal's Edit affordance (STAFF is strictly read-only). Plan §5. */
const EDITOR_ROLES: readonly SystemRole[] = ['ADMIN', 'SUPER_ADMIN']

/**
 * The status `<select>` option set for the editor, per role (plan §6.3, PO decision (a)).
 * SUPER_ADMIN gets the full override (all four states). ADMIN gets the current state (as the
 * no-op default) PLUS only the targets `canAdminSetAccess` permits — so the set is DERIVED
 * from the backend-mirrored policy, never a hand-rolled literal, and can never offer a
 * reachable `PENDING` target (an ADMIN→PENDING PATCH is structurally impossible).
 */
function statusOptionsFor(role: SystemRole | undefined, current: AppAccess): AppAccess[] {
  if (role === 'SUPER_ADMIN') return ['UNREGISTERED', 'PENDING', 'ALLOWED', 'BLOCKED']
  const targets = (['ALLOWED', 'BLOCKED'] as AppAccess[]).filter((t) => canAdminSetAccess(current, t))
  return [...new Set<AppAccess>([current, ...targets])]
}

/**
 * Thai Buddhist-era date formatter (`th-TH-u-ca-buddhist`) → "20 ก.ค. 2569". Built once.
 * Tests must compute the expected string with the SAME formatter so the assertion is
 * locale/runner-robust (never hardcode "2569").
 */
const REGISTERED_AT_FORMATTER = new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function formatRegisteredAt(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? T.emptyValue : REGISTERED_AT_FORMATTER.format(d)
}

function initialsOf(name: string | null): string {
  if (!name) return '?'
  return name.trim().slice(0, 2).toUpperCase() || '?'
}

/** Thai status badge — `badge badge-soft <color>` per plan §3. */
function StatusBadge({ access }: { access: AppAccess }) {
  const { label, colorClass } = STATUS_BADGE[access]
  return <span className={`badge badge-soft ${colorClass}`}>{label}</span>
}

/**
 * LINE avatar with the initials fallback (NO external image host — `img.daisyui.com` is
 * banned). Renders `pictureUrl` when present, else the display-name initials.
 */
function UserAvatar({
  pictureUrl,
  displayName,
  size = 'h-12 w-12',
}: {
  pictureUrl: string | null
  displayName: string | null
  size?: string
}) {
  return (
    <div className="avatar">
      <div className={`mask mask-squircle ${size}`}>
        {pictureUrl ? (
          <img src={pictureUrl} alt="" loading="lazy" />
        ) : (
          <span
            aria-hidden
            className="flex h-full w-full items-center justify-center bg-base-300 text-sm font-semibold text-base-content/70"
          >
            {initialsOf(displayName)}
          </span>
        )}
      </div>
    </div>
  )
}

export function AdminPortalLineUsersPage() {
  const {
    users,
    meta,
    totalPages,
    loading,
    error,
    page,
    setPage,
    search,
    setSearch,
    accessFilter,
    setAccessFilter,
    updateUserInPlace,
  } = useLineUsers()

  const { user: currentAdmin, expireSession } = useAuth()
  const canEdit = currentAdmin ? EDITOR_ROLES.includes(currentAdmin.role) : false
  const editor = useLineUserEditor({ updateUserInPlace, expireSession })

  // ONE modal instance, driven by page state — not one <dialog> per row (plan §4).
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [selectedUser, setSelectedUser] = useState<LineUser | null>(null)

  const handleInspect = useCallback((user: LineUser) => {
    setSelectedUser(user)
    dialogRef.current?.showModal()
  }, [])

  const closeModal = useCallback(() => {
    dialogRef.current?.close()
  }, [])

  // Native `close` event (fired by Esc / backdrop / the ✕ button) is the single reset
  // path, so every close route clears the selection AND the edit state consistently.
  const handleDialogClose = useCallback(() => {
    setSelectedUser(null)
    editor.reset()
  }, [editor])

  // Save: re-seed the modal's snapshot from the freshest committed row so view mode reflects
  // the save (incl. a partial two-endpoint save); the editor keeps the modal open on failure.
  const handleSave = useCallback(async () => {
    const saved = await editor.save()
    if (saved) setSelectedUser(saved)
  }, [editor])

  return (
    <TitleCard title={T.title} topMargin="mt-2">
      {/* Toolbar: debounced search + access filter (both reset to page 1). */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="lineusers-search" className="mb-1 block text-sm font-medium">
            {T.searchLabel}
          </label>
          <input
            id="lineusers-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={T.searchPlaceholder}
            className="input input-bordered w-full focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <div>
          <label htmlFor="lineusers-access-filter" className="mb-1 block text-sm font-medium">
            {T.accessFilterLabel}
          </label>
          <select
            id="lineusers-access-filter"
            aria-label={T.accessFilterLabel}
            value={accessFilter}
            onChange={(e) => setAccessFilter(e.target.value as AppAccess | '')}
            className="select select-bordered w-full focus-visible:ring-2 focus-visible:ring-primary sm:w-56"
          >
            <option value="">{T.accessFilterAll}</option>
            {ACCESS_FILTER_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {STATUS_BADGE[a].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Reserve height so state swaps (skeleton → error / empty / rows) don't shift layout. */}
      <div className="min-h-64 w-full overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr>
              <th className="w-px whitespace-nowrap px-2 text-center">{T.colIndex}</th>
              <th className="w-3/12">{T.colName}</th>
              <th className="w-2/12">{T.colDepartment}</th>
              <th className="w-2/12 text-center">{T.colPhone}</th>
              <th className="w-2/12 text-center">{T.colStatus}</th>
              <th className="w-1/12 text-center">{T.colRegisteredAt}</th>
              <th className="w-2/12">
                <span className="sr-only">{T.colActions}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows />}

            {!loading && error && (
              <tr>
                <td colSpan={7}>
                  <div role="alert" className="alert alert-error alert-soft justify-center text-center">
                    {error}
                  </div>
                </td>
              </tr>
            )}

            {!loading && !error && users.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-base-content/60">
                  {T.empty}
                </td>
              </tr>
            )}

            {!loading &&
              !error &&
              users.map((user, i) => (
                <LineUserRow
                  key={user.id}
                  user={user}
                  index={meta ? (meta.page - 1) * meta.limit + i + 1 : i + 1}
                  onInspect={handleInspect}
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
          <span>{T.paginationSummary(meta.page, totalPages, meta.total)}</span>
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

      <LineUserInspectModal
        ref={dialogRef}
        user={selectedUser}
        editor={editor}
        canEdit={canEdit}
        role={currentAdmin?.role}
        onSave={handleSave}
        onClose={handleDialogClose}
        onRequestClose={closeModal}
      />
    </TitleCard>
  )
}

/** One LINE follower rendered as a table row (plan §2.1 column mapping). Read-only. */
function LineUserRow({
  user,
  index,
  onInspect,
}: {
  user: LineUser
  index: number
  onInspect: (user: LineUser) => void
}) {
  const reg = user.registration
  const realName = reg ? `${reg.firstName} ${reg.lastName}`.trim() : ''
  const displayName = user.displayName ?? T.unknownUser
  return (
    <tr className="hover:bg-base-300">
      <td className="text-center font-semibold">{index}</td>
      <td>
        <div className="flex items-center gap-3">
          <UserAvatar pictureUrl={user.pictureUrl} displayName={user.displayName} />
          <div className="min-w-0">
            <div className="truncate font-bold">{displayName}</div>
            <div className="truncate text-sm opacity-60">
              {realName || <span className="italic">{T.notRegistered}</span>}
            </div>
          </div>
        </div>
      </td>
      <td>{reg?.department || T.emptyValue}</td>
      <td className="text-center">{reg?.phone || T.emptyValue}</td>
      <td className="text-center">
        <StatusBadge access={user.access} />
      </td>
      <td className="text-center">{formatRegisteredAt(user.followedAt)}</td>
      <td className="text-end">
        <button
          type="button"
          onClick={() => onInspect(user)}
          aria-label={`${T.inspect}: ${displayName}`}
          className="btn btn-info btn-soft btn-sm focus-visible:ring-2 focus-visible:ring-info"
        >
          <MagnifyingGlassIcon className="size-[1.2em]" aria-hidden />
          {T.inspect}
        </button>
      </td>
    </tr>
  )
}

/**
 * Inspect modal (plan §4/§5). A SINGLE native `<dialog className="modal">` driven by `user`
 * state and opened via `ref.showModal()` (real focus trap + Esc + return-focus + inert
 * background for free). Esc / backdrop / ✕ all trigger the native `close` event, which the
 * page uses to reset the selection AND the edit state.
 *
 * View mode shows the read-only details (all roles) plus — for ADMIN / SUPER_ADMIN only — an
 * Edit affordance. Edit mode swaps in the registration + status form (Phase B). STAFF never
 * sees the Edit button; the backend is the authority regardless (this gate is UX-only).
 */
function LineUserInspectModal({
  ref,
  user,
  editor,
  canEdit,
  role,
  onSave,
  onClose,
  onRequestClose,
}: {
  ref: Ref<HTMLDialogElement>
  user: LineUser | null
  editor: UseLineUserEditor
  canEdit: boolean
  role: SystemRole | undefined
  onSave: () => void
  onClose: () => void
  onRequestClose: () => void
}) {
  const editing = editor.mode === 'edit'
  return (
    <dialog ref={ref} className="modal" aria-labelledby="lineuser-modal-title" onClose={onClose}>
      <div className="modal-box max-w-lg">
        <button
          type="button"
          onClick={onRequestClose}
          aria-label={T.close}
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 focus-visible:ring-2 focus-visible:ring-primary"
        >
          ✕
        </button>
        <h3 id="lineuser-modal-title" className="text-lg font-bold">
          {editing ? T.editTitle : T.modalTitle}
        </h3>

        {user && !editing && (
          <>
            <LineUserDetails user={user} />
            {canEdit && (
              <div className="modal-action">
                <button
                  type="button"
                  onClick={() => editor.startEdit(user)}
                  className="btn btn-primary btn-sm focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <PencilSquareIcon className="size-[1.2em]" aria-hidden />
                  {T.edit}
                </button>
              </div>
            )}
          </>
        )}

        {user && editing && (
          <LineUserEditForm user={user} editor={editor} role={role} onSave={onSave} />
        )}
      </div>
      {/* Click-outside close (native dialog form submit → `close` event). */}
      <form method="dialog" className="modal-backdrop">
        <button aria-label={T.closeBackdrop}>{T.close}</button>
      </form>
    </dialog>
  )
}

/**
 * The edit form (Phase B, plan §5–§7). Renders the six registration inputs (dept/role as
 * `<select>`s from the lazily-fetched admin option lists) only when the user has a
 * registration row; the status `<select>` (role-gated option set, plan §6.3) is always
 * shown. Save is disabled until the draft is dirty and — for a registered user — the option
 * lists have loaded (so a dept/role choice can be validated). Errors surface in the modal:
 * the staffId-taken (409) case is a per-field error with `aria-invalid`/`aria-describedby`.
 */
function LineUserEditForm({
  user,
  editor,
  role,
  onSave,
}: {
  user: LineUser
  editor: UseLineUserEditor
  role: SystemRole | undefined
  onSave: () => void
}) {
  const {
    draft,
    draftAccess,
    dirty,
    saving,
    formError,
    staffIdError,
    departments,
    personnelRoles,
    optionsLoading,
    optionsLoaded,
    optionsError,
    setDraftField,
    setDraftAccess,
    cancel,
  } = editor

  const statusOptions = statusOptionsFor(role, user.access)
  const statusLocked = statusOptions.length <= 1
  // A registered user's Save waits for the option lists (needed to validate the dept/role
  // choice); an option-load failure keeps Save disabled behind a visible notice (plan §6.2).
  const saveDisabled = saving || !dirty || (draft !== null && !optionsLoaded)

  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!saveDisabled) onSave()
      }}
    >
      {draft && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            id="edit-firstName"
            label={T.labelFirstName}
            value={draft.firstName}
            onChange={(v) => setDraftField('firstName', v)}
          />
          <TextField
            id="edit-lastName"
            label={T.labelLastName}
            value={draft.lastName}
            onChange={(v) => setDraftField('lastName', v)}
          />
          <TextField
            id="edit-staffId"
            label={T.labelStaffId}
            value={draft.staffId}
            onChange={(v) => setDraftField('staffId', v)}
            error={staffIdError}
          />
          <TextField
            id="edit-phone"
            label={T.labelPhone}
            value={draft.phone}
            onChange={(v) => setDraftField('phone', v)}
          />
          <OptionSelect
            id="edit-department"
            label={T.labelDepartment}
            value={draft.departmentId}
            options={departments}
            loading={optionsLoading}
            loaded={optionsLoaded}
            onChange={(v) => setDraftField('departmentId', v)}
          />
          <OptionSelect
            id="edit-personnelRole"
            label={T.labelPersonnelRole}
            value={draft.personnelRoleId}
            options={personnelRoles}
            loading={optionsLoading}
            loaded={optionsLoaded}
            onChange={(v) => setDraftField('personnelRoleId', v)}
          />
        </div>
      )}

      <div>
        <label htmlFor="edit-status" className="mb-1 block text-sm font-medium">
          {T.labelStatus}
        </label>
        <select
          id="edit-status"
          value={draftAccess}
          onChange={(e) => setDraftAccess(e.target.value as AppAccess)}
          disabled={statusLocked}
          className="select select-bordered w-full focus-visible:ring-2 focus-visible:ring-primary"
        >
          {statusOptions.map((a) => (
            <option key={a} value={a}>
              {STATUS_BADGE[a].label}
            </option>
          ))}
        </select>
      </div>

      {optionsError && (
        <div role="alert" className="alert alert-warning alert-soft text-sm">
          <span>{optionsError}</span>
        </div>
      )}

      {formError && (
        <div role="alert" className="alert alert-error alert-soft text-sm">
          <span>{formError}</span>
        </div>
      )}

      <div className="modal-action">
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          className="btn btn-ghost btn-sm focus-visible:ring-2 focus-visible:ring-primary"
        >
          {T.cancel}
        </button>
        <button
          type="submit"
          disabled={saveDisabled}
          className="btn btn-primary btn-sm focus-visible:ring-2 focus-visible:ring-primary"
        >
          {saving && <span className="loading loading-spinner loading-xs" aria-hidden />}
          {saving ? T.saving : T.save}
        </button>
      </div>
    </form>
  )
}

/** One labelled text input for the edit form; renders a per-field error when present. */
function TextField({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string | null
}) {
  const errorId = `${id}-error`
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`input input-bordered w-full focus-visible:ring-2 focus-visible:ring-primary ${
          error ? 'input-error' : ''
        }`}
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-sm text-error">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * A labelled option `<select>` bound to an INTEGER id (`<option value>` is the numeric id,
 * parsed back with `Number` on change). Shows a disabled placeholder until the option list
 * has loaded, so the controlled value always matches a rendered option.
 */
function OptionSelect({
  id,
  label,
  value,
  options,
  loading,
  loaded,
  onChange,
}: {
  id: string
  label: string
  value: number
  options: readonly { id: number; name: string }[]
  loading: boolean
  loaded: boolean
  onChange: (value: number) => void
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        value={loaded ? value : ''}
        disabled={!loaded}
        onChange={(e) => onChange(Number(e.target.value))}
        className="select select-bordered w-full focus-visible:ring-2 focus-visible:ring-primary"
      >
        {!loaded && <option value="">{loading ? T.optionsLoading : T.selectPlaceholder}</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  )
}

/**
 * The read-only detail body. Shows all LINE-side + registration fields for the selected
 * user; when `registration === null` (an UNREGISTERED follower) it shows ONLY the LINE-side
 * fields plus a clear "not registered" notice — never a blank/`undefined` row, never a crash
 * (plan §4.1).
 */
function LineUserDetails({ user }: { user: LineUser }) {
  const reg = user.registration
  const displayName = user.displayName ?? T.unknownUser
  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center gap-4">
        <UserAvatar pictureUrl={user.pictureUrl} displayName={user.displayName} size="h-16 w-16" />
        <div className="min-w-0">
          <div className="truncate text-base font-bold">{displayName}</div>
          <div className="mt-1">
            <StatusBadge access={user.access} />
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        <DetailItem label={T.fieldFollowedAt} value={formatRegisteredAt(user.followedAt)} />
        {reg && (
          <>
            <DetailItem label={T.fieldRealName} value={`${reg.firstName} ${reg.lastName}`.trim()} />
            <DetailItem label={T.fieldStaffId} value={reg.staffId} />
            <DetailItem label={T.fieldPhone} value={reg.phone} />
            <DetailItem label={T.fieldDepartment} value={reg.department} />
            <DetailItem label={T.fieldPersonnelRole} value={reg.personnelRole} />
          </>
        )}
      </dl>

      {!reg && (
        <div role="note" className="alert alert-warning alert-soft text-sm">
          <span>{T.notRegisteredNotice}</span>
        </div>
      )}
    </div>
  )
}

/** One term/description pair in the read-only detail list. */
function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-base-content/60">{label}</dt>
      <dd className="mt-0.5 wrap-break-word text-sm">{value || T.emptyValue}</dd>
    </div>
  )
}

/** Loading placeholder — one testable node that reserves row height. */
function SkeletonRows() {
  return (
    <tr data-testid="lineusers-skeleton" aria-hidden>
      <td colSpan={7} className="p-0">
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
