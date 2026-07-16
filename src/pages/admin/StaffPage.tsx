import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ApiError,
  deleteSystemUser,
  listSystemUsers,
  resetSystemUserPassword,
  type PaginatedSystemUsers,
  type SystemUser,
  type SystemUserWithTemporaryPassword,
} from '@/lib/api-client'
import { Spinner } from '@/components/Spinner'
import { Avatar } from '@/components/admin/Avatar'
import { StaffFormModal } from '@/components/admin/StaffFormModal'
import { TempPasswordDialog } from '@/components/admin/TempPasswordDialog'
import { useAuth } from '@/auth/useAuth'
import { UI_STRINGS } from '@/constants/ui-strings'

const UI = UI_STRINGS.staff
const PAGE_SIZE = 20

type ModalState =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; user: SystemUser }

/**
 * The one-time temporary password, held ONLY while its dialog is open. Closing
 * the dialog drops it; it is never persisted anywhere and never re-fetchable.
 */
type TempPasswordState =
  | { kind: 'none' }
  | { kind: 'shown'; password: string; userLabel: string; reason: 'created' | 'reset' }

/**
 * Staff (`SystemUser`) management (design §5.3). Lists back-office accounts and
 * offers the create/edit/deactivate actions the backend RBAC permits for the
 * current admin — actions a role cannot perform are hidden, and a backend 403 is
 * surfaced gracefully rather than crashing.
 */
export function StaffPage() {
  const { user: currentUser, expireSession } = useAuth()
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN'

  const [page, setPage] = useState(1)
  const [result, setResult] = useState<PaginatedSystemUsers | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>({ kind: 'closed' })
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [tempPassword, setTempPassword] = useState<TempPasswordState>({ kind: 'none' })
  const [resettingId, setResettingId] = useState<string | null>(null)

  const reqId = useRef(0)

  const load = useCallback(() => {
    const id = ++reqId.current
    setLoading(true)
    setError(null)
    listSystemUsers({ page, limit: PAGE_SIZE })
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
          err instanceof ApiError && err.status === 403 ? UI.listForbidden : UI.listFailed,
        )
        setLoading(false)
      })
  }, [page, expireSession])

  useEffect(() => {
    load()
  }, [load])

  function handleSaved(saved: SystemUser | SystemUserWithTemporaryPassword) {
    setModal({ kind: 'closed' })
    // A create response carries the one-time plaintext; an edit response does not.
    if ('temporaryPassword' in saved) {
      setTempPassword({
        kind: 'shown',
        password: saved.temporaryPassword,
        userLabel: `${saved.firstName} ${saved.lastName} (${saved.email})`,
        reason: 'created',
      })
    }
    load()
  }

  async function resetPassword(user: SystemUser) {
    setBusyId(user.id)
    setActionError(null)
    try {
      const result = await resetSystemUserPassword(user.id)
      setResettingId(null)
      setTempPassword({
        kind: 'shown',
        password: result.temporaryPassword,
        userLabel: `${result.firstName} ${result.lastName} (${result.email})`,
        reason: 'reset',
      })
      load()
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        expireSession()
        return
      }
      setActionError(
        err instanceof ApiError && err.status === 403 ? UI.resetForbidden : UI.resetFailed,
      )
    } finally {
      setBusyId(null)
    }
  }

  async function deactivate(user: SystemUser) {
    setBusyId(user.id)
    setActionError(null)
    try {
      await deleteSystemUser(user.id)
      setConfirmingId(null)
      load()
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        expireSession()
        return
      }
      setActionError(
        err instanceof ApiError && err.status === 403
          ? UI.deactivateForbidden
          : UI.deactivateFailed,
      )
    } finally {
      setBusyId(null)
    }
  }

  const users = result?.data ?? []
  const meta = result?.meta
  const totalPages = meta?.totalPages ?? 0

  return (
    <section aria-labelledby="staff-heading" className="mx-auto w-full max-w-4xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 id="staff-heading" className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {UI.heading}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{UI.subheading}</p>
        </div>
        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => setModal({ kind: 'create' })}
            className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            {UI.addStaff}
          </button>
        )}
      </div>

      {actionError && (
        <p
          role="alert"
          className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400"
        >
          {actionError}
        </p>
      )}

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
            {UI.empty}
          </div>
        )}

        {!loading && !error && users.length > 0 && (
          <ul className="space-y-2">
            {users.map((user) => {
              const isSelf = user.id === currentUser?.id
              const canDeactivate = isSuperAdmin && !isSelf
              const canEditRole = isSuperAdmin && !isSelf
              // Hidden on your own row: the backend 403s a self-reset (use the
              // change-password screen instead).
              const canResetPassword = isSuperAdmin && !isSelf
              return (
                <li
                  key={user.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
                >
                  {/* No `alt`: decorative — the row names this person on the
                      very next line. `profilePictureUrl` already rides along on
                      the list DTO, so this costs no extra request. */}
                  <Avatar
                    src={user.profilePictureUrl}
                    name={`${user.firstName} ${user.lastName}`}
                    colorKey={user.id}
                    size="md"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                      <span className="truncate">
                        {user.firstName} {user.lastName}
                      </span>
                      {!user.isActive && (
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-normal text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          {UI.inactiveBadge}
                        </span>
                      )}
                      {user.mustChangePassword && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                          {UI.passwordNotSetBadge}
                        </span>
                      )}
                    </p>
                    {/* The resolved `{id,name}` embeds — a soft-deleted option
                        still resolves its name here, forever (AC-F2). */}
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {user.email} · {user.personnelRole.name}, {user.department.name}
                    </p>
                  </div>

                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {UI_STRINGS.roles[user.role]}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setModal({ kind: 'edit', user })}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {UI.edit}
                    </button>

                    {canResetPassword &&
                      (resettingId === user.id ? (
                        <span className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => resetPassword(user)}
                            disabled={busyId === user.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-60"
                          >
                            {busyId === user.id ? (
                              <Spinner label={UI.resetting} />
                            ) : (
                              UI.confirmReset
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setResettingId(null)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            {UI_STRINGS.common.cancel}
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActionError(null)
                            setConfirmingId(null)
                            setResettingId(user.id)
                          }}
                          aria-label={UI.resetPasswordFor(`${user.firstName} ${user.lastName}`)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          {UI.resetPassword}
                        </button>
                      ))}

                    {canDeactivate &&
                      (confirmingId === user.id ? (
                        <span className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => deactivate(user)}
                            disabled={busyId === user.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-60"
                          >
                            {busyId === user.id ? (
                              <Spinner label={UI.deactivating} />
                            ) : (
                              UI_STRINGS.common.confirm
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingId(null)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            {UI_STRINGS.common.cancel}
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setResettingId(null)
                            setConfirmingId(user.id)
                          }}
                          aria-label={UI.deactivateUser(`${user.firstName} ${user.lastName}`)}
                          className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
                        >
                          {UI.deactivate}
                        </button>
                      ))}
                  </div>

                  {/* Modal is rendered once outside the list, keyed by state. */}
                  {modal.kind === 'edit' && modal.user.id === user.id && (
                    <StaffFormModal
                      mode="edit"
                      user={modal.user}
                      canEditRole={canEditRole}
                      onClose={() => setModal({ kind: 'closed' })}
                      onSaved={handleSaved}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {meta && totalPages > 0 && (
        <nav
          aria-label={UI.pagination.label}
          className="mt-4 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300"
        >
          <span>{UI.pagination.summary(meta.page, totalPages, meta.total)}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {UI.pagination.previous}
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages || loading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {UI.pagination.next}
            </button>
          </div>
        </nav>
      )}

      {modal.kind === 'create' && (
        <StaffFormModal
          mode="create"
          canEditRole={isSuperAdmin}
          onClose={() => setModal({ kind: 'closed' })}
          onSaved={handleSaved}
        />
      )}

      {tempPassword.kind === 'shown' && (
        <TempPasswordDialog
          password={tempPassword.password}
          userLabel={tempPassword.userLabel}
          reason={tempPassword.reason}
          // Closing drops the plaintext from state entirely — it is gone for good.
          onClose={() => setTempPassword({ kind: 'none' })}
        />
      )}
    </section>
  )
}

function ListSkeleton() {
  return (
    <ul className="space-y-2" aria-hidden data-testid="staff-skeleton">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
        >
          {/* Same h-10 w-10 as the real row's Avatar, so the list does not jump
              sideways when the data lands. */}
          <span className="h-10 w-10 shrink-0 rounded-full bg-slate-200 motion-safe:animate-pulse dark:bg-slate-700" />
          <div className="flex-1 space-y-2">
            <span className="block h-4 w-40 rounded bg-slate-200 motion-safe:animate-pulse dark:bg-slate-700" />
            <span className="block h-3 w-56 rounded bg-slate-200 motion-safe:animate-pulse dark:bg-slate-700" />
          </div>
          <span className="h-6 w-20 rounded-full bg-slate-200 motion-safe:animate-pulse dark:bg-slate-700" />
        </li>
      ))}
    </ul>
  )
}
