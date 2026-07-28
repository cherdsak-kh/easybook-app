// The admin-portal "LINE User Registration Data" surface (formerly "Leads"): a
// re-contextualised, Thai-localized view of REAL LINE-user data (via `useLineUsers` →
// `listLineUsers`). It keeps the DashWind `TitleCard` chrome; every row is a live LINE
// follower. All fetch/search/sort/pagination orchestration lives in `useLineUsers`; this
// file is presentational + wiring only.
//
// The data model here is FETCH-ALL: the hook loops the server's 100-row pages once, and
// search / sort / status-filter / pagination are then pure functions of the in-memory
// array. Nothing on this page issues a request while the operator types or re-sorts, and
// the server's `search`/`access` query params — still part of the published API for other
// callers — are simply never sent from here.
//
// The per-row "ตรวจสอบข้อมูล" action opens a single native `<dialog>` inspect modal;
// ADMIN/SUPER_ADMIN additionally get edit mode and the mandatory-reason Reject flow.
import { useCallback, useEffect, useRef, useState, type Ref } from 'react'
import MagnifyingGlassIcon from '@heroicons/react/24/outline/MagnifyingGlassIcon'
import PencilSquareIcon from '@heroicons/react/24/outline/PencilSquareIcon'
import ArrowUturnLeftIcon from '@heroicons/react/24/outline/ArrowUturnLeftIcon'
import { TitleCard } from '@/components/dashboard/TitleCard'
import { useToast } from '@/components/admin-portal/useToast'
import { useLineUsers } from '@/hooks/useLineUsers'
import type { RealtimeStatus } from '@/hooks/useLineUsersRealtime'
import {
  REJECT_REASON_MAX_LENGTH,
  useLineUserEditor,
  type UseLineUserEditor,
} from '@/hooks/useLineUserEditor'
import { useAuth } from '@/auth/useAuth'
import { canAdminSetAccess, canReject } from '@/lib/access-policy'
import type { AppAccess, LineUser, SystemRole } from '@/lib/api-client'
// Thai copy + status-badge map live in the centralized-but-modularized per-feature constants
// module (`@/constants/ui-strings-line-users`) so this component file exports ONLY components;
// the page and its tests share the same literal.
import {
  MODAL_STATUS_LABELS,
  SEARCH_FIELD_LABELS,
  SEARCH_FIELD_OPTIONS,
  SORT_LABELS,
  SORT_OPTIONS,
  STATUS_BADGE,
  T,
  type SearchField,
  type SortOption,
} from '@/constants/ui-strings-line-users'

/**
 * Access-filter option order. REJECTED is filterable — it is a first-class review state.
 *
 * `UNREGISTERED` is filterable too, and sits LAST — mirroring the `status` sort's ordering
 * (the review queue first, the rows with nothing to review at the end). It was previously
 * omitted, which left "show me the followers who never submitted the form" as the one
 * question this toolbar could not answer.
 */
const ACCESS_FILTER_OPTIONS: readonly AppAccess[] = [
  'PENDING',
  'ALLOWED',
  'BLOCKED',
  'REJECTED',
  'UNREGISTERED',
]

/** Roles allowed to see the modal's Edit affordance (STAFF is strictly read-only). Plan §5. */
const EDITOR_ROLES: readonly SystemRole[] = ['ADMIN', 'SUPER_ADMIN']

/**
 * The status `<select>`'s SELECTABLE targets — strictly `{ALLOWED, BLOCKED}` for BOTH roles,
 * derived from the backend-mirrored policy rather than hand-rolled. `UNREGISTERED`, `PENDING`
 * and `REJECTED` are never dropdown values: the first two are not settable by anyone through
 * this surface, and REJECTED is reachable ONLY via the dedicated Reject action (which always
 * carries a mandatory reason). SUPER_ADMIN no longer gets a four-state override picker here —
 * the wider capability still exists on the server, but this surface does not offer it.
 *
 * Returns `[]` for an UNREGISTERED user (nothing an operator may set), which locks the select.
 */
function statusTargetsFor(current: AppAccess): AppAccess[] {
  return (['ALLOWED', 'BLOCKED'] as AppAccess[]).filter((t) => canAdminSetAccess(current, t))
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

/**
 * The live-channel indicator (AC F14, design §11.3).
 *
 * daisyUI 5 canonical markup (skill: components/status.md + components/badge.md): a `badge`
 * carrying a `status` dot. The dot is DECORATIVE (`aria-hidden`) — colour alone must never be
 * the message — and the adjacent text is what actually says whether the table updates itself.
 *
 * Renders NOTHING when real-time is switched off at build time (`VITE_WS_ENABLED=false`):
 * announcing "not connected" for a feature the deployment deliberately disabled is noise. A
 * dead socket, by contrast, is worth saying out loud — but quietly, and it must never blank
 * or block the table, which keeps working from the initial fetch-all.
 */
function RealtimeIndicator({ status }: { status: RealtimeStatus }) {
  if (status === 'disabled') return null
  const dotClass =
    status === 'live'
      ? 'status-success'
      : status === 'connecting'
        ? 'status-info motion-safe:animate-pulse'
        : 'status-warning'
  const label =
    status === 'live'
      ? T.realtimeLive
      : status === 'connecting'
        ? T.realtimeConnecting
        : T.realtimeOffline
  return (
    <span
      role="status"
      aria-live="polite"
      title={status === 'offline' ? T.realtimeOfflineHint : undefined}
      className="badge badge-ghost badge-sm gap-2 align-middle font-normal"
    >
      <span aria-hidden className={`status ${dotClass}`} />
      {label}
    </span>
  )
}

/** Thai status badge — `badge badge-soft <color>` per plan §3. */
function StatusBadge({ access }: { access: AppAccess }) {
  const { label, colorClass } = STATUS_BADGE[access]
  return <span className={`badge badge-soft ${colorClass}`}>{label}</span>
}

/**
 * LINE avatar with the initials fallback (NO external image host — `img.daisyui.com` is
 * banned). Renders `pictureUrl` when present, else the display-name initials.
 *
 * daisyUI 5 canonical markup (skill: components/avatar.md, components/mask.md): the
 * no-image case takes the `avatar-placeholder` MODIFIER, which is what centres the
 * initials — hand-rolling that with flex utilities was the drift the skill exists to stop.
 * The image itself carries `alt=""` because the adjacent cell text already names the row;
 * a decorative duplicate would just make a screen reader say the name twice.
 *
 * This avatar SURVIVES the Name-column rework (PO decision OPEN-3): the LINE display name
 * is gone from the cell, and the avatar is the last visual identity anchor left, so it
 * stays — including its display-name initials fallback, which is part of the avatar, not
 * of the name text.
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
    <div className={pictureUrl ? 'avatar' : 'avatar avatar-placeholder'}>
      <div
        className={
          pictureUrl
            ? `mask mask-squircle ${size}`
            : `mask mask-squircle bg-base-300 text-base-content/70 ${size}`
        }
      >
        {pictureUrl ? (
          <img src={pictureUrl} alt="" loading="lazy" />
        ) : (
          <span aria-hidden className="text-sm font-semibold">
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
    truncated,
    loadedCount,
    rowError,
    page,
    setPage,
    search,
    setSearch,
    searchField,
    setSearchField,
    sortBy,
    setSortBy,
    accessFilter,
    setAccessFilter,
    updateUserInPlace,
    realtimeStatus,
    deletedRowId,
  } = useLineUsers()

  const { user: currentAdmin, expireSession } = useAuth()
  const canEdit = currentAdmin ? EDITOR_ROLES.includes(currentAdmin.role) : false
  const editor = useLineUserEditor({ updateUserInPlace, expireSession })

  // A row-mutation failure is a TRANSIENT OUTCOME of an action the operator just took, so
  // it is a toast rather than an inline alert (plan §7's rule). Without this the hook's
  // `rowError` had no surface at all — a failed write would have been a silent no-op.
  // The ref makes the effect idempotent under React StrictMode's double-invoke, so one
  // failure produces exactly one toast.
  const { show } = useToast()
  const shownRowErrorRef = useRef<string | null>(null)
  useEffect(() => {
    if (rowError === null) {
      shownRowErrorRef.current = null
      return
    }
    if (shownRowErrorRef.current === rowError) return
    shownRowErrorRef.current = rowError
    show(rowError, 'error')
  }, [rowError, show])

  // ONE modal instance, driven by page state — not one <dialog> per row (plan §4).
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [selectedUser, setSelectedUser] = useState<LineUser | null>(null)
  // The Reject dialog is a SIBLING <dialog>, not a nested one: nesting a modal inside an open
  // modal-box relies on top-layer stacking that jsdom does not model, and a sibling keeps each
  // dialog's own focus trap / Esc / return-focus intact.
  const rejectDialogRef = useRef<HTMLDialogElement>(null)

  const handleInspect = useCallback((user: LineUser) => {
    setSelectedUser(user)
    dialogRef.current?.showModal()
  }, [])

  // A live `lineUser.deleted` for the row currently being inspected must not leave the modal
  // bound to a row that no longer exists (plan edge case 11) — worst case an operator would
  // be editing, and saving, a vanished user. Closing fires the native `close` event, which is
  // the page's single reset path, so the selection AND any edit draft are discarded together.
  //
  // Driven by the hook's explicit `deletedRowId` signal rather than "the row left `users`":
  // a row leaves the visible page for entirely legitimate reasons (a filter, a search, a page
  // change) that must NOT close the modal.
  //
  // The ref makes each deletion act EXACTLY ONCE (same pattern as the row-error toast below):
  // without it, StrictMode's double-invoke or a later `selectedUser` change would re-run the
  // check against a long-past deletion and slam a freshly opened modal shut.
  const handledDeletionRef = useRef<string | null>(null)
  useEffect(() => {
    if (deletedRowId === null) {
      handledDeletionRef.current = null
      return
    }
    if (handledDeletionRef.current === deletedRowId) return
    handledDeletionRef.current = deletedRowId
    if (selectedUser?.id === deletedRowId) dialogRef.current?.close()
  }, [deletedRowId, selectedUser])

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

  const handleStartReject = useCallback(
    (user: LineUser) => {
      editor.startReject(user)
      rejectDialogRef.current?.showModal()
    },
    [editor],
  )

  const closeRejectModal = useCallback(() => {
    rejectDialogRef.current?.close()
  }, [])

  // Esc / backdrop / Cancel all land here (native `close`) — one discard path.
  const handleRejectDialogClose = useCallback(() => {
    editor.cancelReject()
  }, [editor])

  // Reject: on success, close the reason dialog and re-seed the inspect modal's snapshot so
  // its badge flips to ส่งคืนแล้ว immediately. On failure the dialog STAYS open with the
  // inline error — never a silent no-op.
  const handleReject = useCallback(async () => {
    const rejected = await editor.submitReject()
    if (rejected) {
      setSelectedUser((prev) => (prev && prev.id === rejected.id ? rejected : prev))
      rejectDialogRef.current?.close()
    }
  }, [editor])

  return (
    <TitleCard
      title={T.title}
      topMargin="mt-2"
      // `undefined` (not a component that renders null) when real-time is switched off, so the
      // heading row keeps its plain layout instead of reserving an empty float.
      topSideButtons={
        realtimeStatus === 'disabled' ? undefined : <RealtimeIndicator status={realtimeStatus} />
      }
    >
      {/* Toolbar: search text + "ค้นหาด้วย…" field + "เรียงลำดับ…" order + status filter.
          All four are CLIENT-SIDE and each resets to page 1. Mobile-first: one column on
          the narrowest viewport, two from `sm`, four from `xl`; the text box spans the row
          on `sm` because it is the control operators aim at first. daisyUI 5 has no
          `input-bordered`/`select-bordered` (skill: components/input.md, select.md) — the
          bare `input`/`select` component classes already carry the border. (Those dead
          class names still linger on the MODAL's edit-form controls below and in a few
          other files; they are inert, pre-date this change, and removing them repo-wide is
          its own task rather than drive-by churn here.) */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="sm:col-span-2 xl:col-span-1">
          <label htmlFor="lineusers-search" className="mb-1 block text-sm font-medium">
            {T.searchLabel}
          </label>
          <input
            id="lineusers-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={T.searchPlaceholder}
            className="input w-full focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <div>
          <label htmlFor="lineusers-search-field" className="mb-1 block text-sm font-medium">
            {T.searchFieldLabel}
          </label>
          <select
            id="lineusers-search-field"
            aria-label={T.searchFieldLabel}
            value={searchField}
            onChange={(e) => setSearchField(e.target.value as SearchField)}
            className="select w-full focus-visible:ring-2 focus-visible:ring-primary"
          >
            {SEARCH_FIELD_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {SEARCH_FIELD_LABELS[f]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="lineusers-sort" className="mb-1 block text-sm font-medium">
            {T.sortLabel}
          </label>
          <select
            id="lineusers-sort"
            aria-label={T.sortLabel}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="select w-full focus-visible:ring-2 focus-visible:ring-primary"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </select>
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
            className="select w-full focus-visible:ring-2 focus-visible:ring-primary"
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

      {/* The `MAX_PAGES` tripwire. Non-blocking and `role="status"` (not `alert`): the list
          below is still usable, so this must be announced politely, not urgently. */}
      {!loading && !error && truncated && (
        <div role="status" className="alert alert-warning alert-soft mb-4 text-sm">
          <span>{T.truncatedWarning(loadedCount)}</span>
        </div>
      )}

      {/* The fetch-all loop can span several round trips, so the wait is ANNOUNCED as well
          as drawn. It lives outside the table because a live region on a <tr> would break
          the table's row semantics; the skeleton itself stays `aria-hidden`. */}
      {loading && (
        <span role="status" aria-live="polite" className="sr-only">
          {T.loading}
        </span>
      )}

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
        onStartReject={handleStartReject}
        onClose={handleDialogClose}
        onRequestClose={closeModal}
      />

      <RejectReasonModal
        ref={rejectDialogRef}
        editor={editor}
        onSubmit={handleReject}
        onClose={handleRejectDialogClose}
        onRequestClose={closeRejectModal}
      />
    </TitleCard>
  )
}

/**
 * One LINE follower rendered as a table row.
 *
 * The **Name column shows ONLY the registration's Name-Surname** for a registered row. The
 * LINE display name that used to sit above it as the bold primary line is gone — this is a
 * *registration data* page, and two names in one cell made the operator read the wrong one.
 * The LINE **avatar** stays (PO decision OPEN-3), and the inspect modal still shows the
 * display name.
 *
 * For a row with NO registration there is no real name, so the cell falls back to the LINE
 * **display name** (the only identity that row has, and the one the search box now matches
 * on) and only to `T.notRegistered` when that is null too. It stays visually de-emphasised
 * either way: the status badge is what states "ยังไม่ลงทะเบียน", so the cell does not need
 * to repeat it.
 *
 * The inspect button's accessible name follows the cell: for a registered row it is the
 * real name the operator can actually see. For an unregistered row there is no real name,
 * so it falls back to the LINE display name — the only identity that row has, and the one
 * the modal will show — rather than to a generic "ยังไม่ลงทะเบียน" that every such row
 * would share.
 */
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
  const rowLabel = realName || user.displayName || T.unknownUser
  return (
    <tr className="transition-colors hover:bg-base-300">
      <td className="text-center font-semibold">{index}</td>
      <td>
        <div className="flex items-center gap-3">
          <UserAvatar pictureUrl={user.pictureUrl} displayName={user.displayName} />
          <div className="min-w-0">
            {/* No registration → the LINE display name, de-emphasised (the status badge is
                what states "ยังไม่ลงทะเบียน"). `||`, not `??`, for the same reason as
                `rowLabel` above: a blank display name is as absent as a null one, and an
                empty cell would say nothing at all. */}
            {realName ? (
              <div className="truncate font-bold">{realName}</div>
            ) : (
              <div className="truncate italic opacity-60">
                {user.displayName || T.notRegistered}
              </div>
            )}
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
          aria-label={`${T.inspect}: ${rowLabel}`}
          className="btn btn-info btn-soft btn-sm transition-colors focus-visible:ring-2 focus-visible:ring-info"
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
 * Edit affordance and the dedicated **Reject** ("ส่งคืนเพื่อตรวจสอบข้อมูลใหม่") action, the latter gated by
 * `canReject` so it is hidden for an UNREGISTERED user (nothing was submitted to send back)
 * and, for ADMIN, for an already-REJECTED one. Edit mode swaps in the registration + status
 * form (Phase B). STAFF never sees either action; the backend is the authority regardless
 * (these gates are UX-only).
 */
function LineUserInspectModal({
  ref,
  user,
  editor,
  canEdit,
  role,
  onSave,
  onStartReject,
  onClose,
  onRequestClose,
}: {
  ref: Ref<HTMLDialogElement>
  user: LineUser | null
  editor: UseLineUserEditor
  canEdit: boolean
  role: SystemRole | undefined
  onSave: () => void
  onStartReject: (user: LineUser) => void
  onClose: () => void
  onRequestClose: () => void
}) {
  const editing = editor.mode === 'edit'
  const showReject = canEdit && user !== null && canReject(user.access, role)
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
                {showReject && (
                  <button
                    type="button"
                    onClick={() => onStartReject(user)}
                    className="btn btn-warning btn-soft btn-sm focus-visible:ring-2 focus-visible:ring-warning"
                  >
                    <ArrowUturnLeftIcon className="size-[1.2em]" aria-hidden />
                    {T.reject}
                  </button>
                )}
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

        {user && editing && <LineUserEditForm user={user} editor={editor} onSave={onSave} />}
      </div>
      {/* Click-outside close (native dialog form submit → `close` event). */}
      <form method="dialog" className="modal-backdrop">
        <button aria-label={T.closeBackdrop}>{T.close}</button>
      </form>
    </dialog>
  )
}

/**
 * The Reject ("ส่งคืนเพื่อตรวจสอบข้อมูลใหม่") dialog — a second native `<dialog className="modal">`,
 * sibling to the inspect modal, opened via `showModal()` so it gets its own focus trap, Esc
 * handling and return-focus. Its ONE field is the **mandatory** reason: submit is disabled
 * while it is blank, the field is capped at the backend's 500 chars with a live counter, and
 * a blank submit can never reach the network (`submitReject` short-circuits). The field
 * carries `aria-invalid` + `aria-describedby` pointing at the hint/counter and, when present,
 * the inline error — so the requirement and any failure are announced, not just coloured.
 *
 * Every failure path lands in the inline `alert` and KEEPS the dialog open; a 401 is the one
 * exception (the editor expires the session and the route guard owns the redirect).
 */
function RejectReasonModal({
  ref,
  editor,
  onSubmit,
  onClose,
  onRequestClose,
}: {
  ref: Ref<HTMLDialogElement>
  editor: UseLineUserEditor
  onSubmit: () => void
  onClose: () => void
  onRequestClose: () => void
}) {
  const { rejectTarget, rejectReason, rejectSubmittable, rejecting, rejectError, setRejectReason } =
    editor
  const displayName = rejectTarget?.displayName ?? T.unknownUser
  const blocked = !rejectSubmittable || rejecting

  return (
    <dialog ref={ref} className="modal" aria-labelledby="lineuser-reject-title" onClose={onClose}>
      <div className="modal-box max-w-lg">
        <button
          type="button"
          onClick={onRequestClose}
          aria-label={T.close}
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 focus-visible:ring-2 focus-visible:ring-primary"
        >
          ✕
        </button>
        <h3 id="lineuser-reject-title" className="text-lg font-bold">
          {T.rejectTitle}
        </h3>

        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!blocked) onSubmit()
          }}
        >
          <p className="text-sm text-base-content/70">
            <span className="font-semibold text-base-content">{displayName}</span> · {T.rejectIntro}
          </p>

          <div>
            <label htmlFor="reject-reason" className="mb-1 block text-sm font-medium">
              {T.rejectReasonLabel}
              <span aria-hidden className="ml-0.5 text-error">
                *
              </span>
            </label>
            <textarea
              id="reject-reason"
              required
              rows={4}
              value={rejectReason}
              maxLength={REJECT_REASON_MAX_LENGTH}
              placeholder={T.rejectReasonPlaceholder}
              onChange={(e) => setRejectReason(e.target.value)}
              aria-invalid={rejectError ? true : undefined}
              aria-describedby={
                rejectError ? 'reject-reason-error reject-reason-counter' : 'reject-reason-counter'
              }
              className={`textarea w-full focus-visible:ring-2 focus-visible:ring-warning ${
                rejectError ? 'textarea-error' : ''
              }`}
            />
            <p
              id="reject-reason-counter"
              className="mt-1 text-end text-xs text-base-content/60 tabular-nums"
            >
              {T.rejectReasonCounter(rejectReason.length, REJECT_REASON_MAX_LENGTH)}
            </p>
          </div>

          {/* Reserved height is unnecessary here (the dialog is centred), but the alert always
              renders in the same slot so an error never pushes the actions off-screen. */}
          {rejectError && (
            <div
              id="reject-reason-error"
              role="alert"
              className="alert alert-error alert-soft text-sm"
            >
              <span>{rejectError}</span>
            </div>
          )}

          <div className="modal-action">
            <button
              type="button"
              onClick={onRequestClose}
              disabled={rejecting}
              className="btn btn-ghost btn-sm focus-visible:ring-2 focus-visible:ring-primary"
            >
              {T.cancel}
            </button>
            <button
              type="submit"
              disabled={blocked}
              className="btn btn-warning btn-sm focus-visible:ring-2 focus-visible:ring-warning"
            >
              {rejecting && <span className="loading loading-spinner loading-xs" aria-hidden />}
              {rejecting ? T.rejectSubmitting : T.rejectSubmit}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button aria-label={T.closeBackdrop}>{T.close}</button>
      </form>
    </dialog>
  )
}

/**
 * The edit form (Phase B, plan §5–§7). Renders the five registration inputs (dept/role as
 * `<select>`s from the lazily-fetched admin option lists) only when the user has a
 * registration row; the status `<select>` is always shown, offering strictly
 * `{ALLOWED, BLOCKED}` for BOTH roles. Save is disabled until the draft is dirty and — for a
 * registered user — the option lists have loaded (so a dept/role choice can be validated).
 * Save errors all surface as ONE modal-level alert: the registration PATCH mutates no
 * unique column, so there is no field-specific conflict left to place next to an input.
 */
function LineUserEditForm({
  user,
  editor,
  onSave,
}: {
  user: LineUser
  editor: UseLineUserEditor
  onSave: () => void
}) {
  const {
    draft,
    draftAccess,
    dirty,
    saving,
    formError,
    departments,
    personnelRoles,
    optionsLoading,
    optionsLoaded,
    optionsError,
    setDraftField,
    setDraftAccess,
    cancel,
  } = editor

  // Strictly ALLOWED/BLOCKED for both roles. When the CURRENT state is not one of them
  // (UNREGISTERED / PENDING / REJECTED) the select leads with a DISABLED placeholder carrying
  // that state's label, so the controlled value always matches a rendered option — without it
  // the browser would silently display the first target while the draft still held the old
  // state, and a Save would look applied but be a no-op.
  const statusTargets = statusTargetsFor(user.access)
  const statusLocked = statusTargets.length === 0
  const currentIsTarget = statusTargets.includes(draftAccess)
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
          value={currentIsTarget ? draftAccess : ''}
          onChange={(e) => setDraftAccess(e.target.value as AppAccess)}
          disabled={statusLocked}
          className="select select-bordered w-full focus-visible:ring-2 focus-visible:ring-primary"
        >
          {!currentIsTarget && (
            <option value="" disabled>
              {MODAL_STATUS_LABELS[user.access]}
            </option>
          )}
          {statusTargets.map((a) => (
            <option key={a} value={a}>
              {MODAL_STATUS_LABELS[a]}
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

/**
 * One labelled text input for the edit form. Deliberately carries NO per-field error
 * slot: every save failure on this surface is modal-level (`formError`), because the
 * registration PATCH mutates no unique column and so has no field-specific conflict.
 */
function TextField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
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
        className="input input-bordered w-full focus-visible:ring-2 focus-visible:ring-primary"
      />
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

/**
 * Loading placeholder — one testable node that reserves row height so the swap to real
 * rows does not shift the layout under the operator. Uses daisyUI's `skeleton` component
 * (skill: components/skeleton.md) rather than a hand-rolled `bg-base-300 animate-pulse`
 * pair; `skeleton`'s own shimmer is already reduced-motion aware.
 *
 * `aria-hidden` on purpose: the wait is announced by the sr-only live region above the
 * table, so a screen reader hears one sentence instead of five empty rows.
 */
function SkeletonRows() {
  return (
    <tr data-testid="lineusers-skeleton" aria-hidden>
      <td colSpan={7} className="p-0">
        <div className="space-y-3 py-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="skeleton h-12 w-12 shrink-0" />
              <span className="skeleton h-4 flex-1" />
            </div>
          ))}
        </div>
      </td>
    </tr>
  )
}
