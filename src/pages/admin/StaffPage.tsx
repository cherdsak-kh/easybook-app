import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ApiError,
  deleteSystemUser,
  listSystemUsers,
  type PaginatedSystemUsers,
  type SystemRole,
  type SystemUser,
} from '@/lib/api-client'
import { Spinner } from '@/components/Spinner'
import { StaffFormModal } from '@/components/admin/StaffFormModal'
import { useAuth } from '@/auth/useAuth'

const PAGE_SIZE = 20
const ROLE_LABEL: Record<SystemRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  STAFF: 'Staff',
}

type ModalState =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; user: SystemUser }

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
          err instanceof ApiError && err.status === 403
            ? 'You do not have permission to view staff.'
            : 'Could not load staff. Please try again.',
        )
        setLoading(false)
      })
  }, [page, expireSession])

  useEffect(() => {
    load()
  }, [load])

  function handleSaved() {
    setModal({ kind: 'closed' })
    load()
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
          ? 'You do not have permission to deactivate this account.'
          : 'Could not deactivate the account. Please try again.',
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
            Staff
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage back-office user accounts.
          </p>
        </div>
        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => setModal({ kind: 'create' })}
            className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            Add staff
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
            No staff accounts found.
          </div>
        )}

        {!loading && !error && users.length > 0 && (
          <ul className="space-y-2">
            {users.map((user) => {
              const isSelf = user.id === currentUser?.id
              const canDeactivate = isSuperAdmin && !isSelf
              const canEditRole = isSuperAdmin && !isSelf
              return (
                <li
                  key={user.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                      <span className="truncate">
                        {user.firstName} {user.lastName}
                      </span>
                      {!user.isActive && (
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-normal text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          Inactive
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {user.email} · {user.position}, {user.department}
                    </p>
                  </div>

                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {ROLE_LABEL[user.role]}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setModal({ kind: 'edit', user })}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Edit
                    </button>

                    {canDeactivate &&
                      (confirmingId === user.id ? (
                        <span className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => deactivate(user)}
                            disabled={busyId === user.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-60"
                          >
                            {busyId === user.id ? <Spinner label="Deactivating…" /> : 'Confirm'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingId(null)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingId(user.id)}
                          aria-label={`Deactivate ${user.firstName} ${user.lastName}`}
                          className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
                        >
                          Deactivate
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
          aria-label="Pagination"
          className="mt-4 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300"
        >
          <span>
            Page {meta.page} of {totalPages} · {meta.total} total
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages || loading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Next
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
