import { useEffect, useRef, useState } from 'react'
import {
  ApiError,
  listLineUsers,
  patchLineUserAccess,
  type AccessAction,
  type AppAccess,
  type LineUser,
  type PaginatedLineUsers,
} from '@/lib/api-client'
import { AccessBadge } from '@/components/admin/AccessBadge'
import { Spinner } from '@/components/Spinner'
import { useAuth } from '@/auth/useAuth'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

const PAGE_SIZE = 20
const ACCESS_OPTIONS: readonly AppAccess[] = ['UNREGISTERED', 'PENDING', 'ALLOWED', 'BLOCKED']

function formatFollowedAt(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function initialsOf(name: string | null): string {
  if (!name) return '?'
  return name.trim().slice(0, 2).toUpperCase() || '?'
}

/**
 * LINE Users management (design §5.3): a paginated list with a debounced
 * display-name search, an access filter, and per-row Allow/Block actions that
 * update the row in place (no full-page reload). 401 bounces to login; 403/404
 * surface as non-crashing notices.
 */
export function LineUsersPage() {
  const { expireSession } = useAuth()

  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [accessFilter, setAccessFilter] = useState<AppAccess | ''>('')
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300)

  const [result, setResult] = useState<PaginatedLineUsers | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)

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
            ? 'You do not have permission to view LINE users.'
            : 'Could not load LINE users. Please try again.',
        )
        setLoading(false)
      })
  }, [page, debouncedSearch, accessFilter, expireSession])

  async function changeAccess(user: LineUser, access: AccessAction) {
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
        setRowError('That user no longer exists — refresh the list.')
      } else if (err instanceof ApiError && err.status === 403) {
        setRowError('You do not have permission to change access.')
      } else {
        setRowError('Could not update access. Please try again.')
      }
    } finally {
      setPendingId(null)
    }
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
          LINE Users
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Approve or block people who have added the LINE account.
        </p>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label
            htmlFor="line-user-search"
            className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Search by name
          </label>
          <input
            id="line-user-search"
            type="search"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Display name…"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <div>
          <label
            htmlFor="line-user-access-filter"
            className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Access
          </label>
          <select
            id="line-user-access-filter"
            aria-label="Filter by access status"
            value={accessFilter}
            onChange={(e) => onFilterChange(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:w-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">All</option>
            {ACCESS_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {a.charAt(0) + a.slice(1).toLowerCase()}
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
            No LINE users match your filters.
          </div>
        )}

        {!loading && !error && users.length > 0 && (
          <ul className="space-y-2">
            {users.map((user) => (
              <li
                key={user.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
              >
                <Avatar user={user} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                    {user.displayName ?? 'Unknown user'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Followed {formatFollowedAt(user.followedAt)}
                  </p>
                </div>
                <AccessBadge access={user.access} />
                <RowActions
                  user={user}
                  pending={pendingId === user.id}
                  onChange={changeAccess}
                />
                <RegistrationDetails registration={user.registration} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pagination */}
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
      <p className="w-full border-t border-slate-100 pt-2 text-xs italic text-slate-400 dark:border-slate-800 dark:text-slate-500">
        Not registered
      </p>
    )
  }
  const { firstName, lastName, staffId, phone, personnelRole, department } = registration
  return (
    <dl className="grid w-full grid-cols-2 gap-x-4 gap-y-1.5 border-t border-slate-100 pt-2 text-xs sm:grid-cols-3 dark:border-slate-800">
      <Detail label="Real name" value={`${firstName} ${lastName}`.trim() || '—'} />
      <Detail label="Staff ID" value={staffId} />
      <Detail label="Phone" value={phone} />
      <Detail label="Role" value={personnelRole} />
      <Detail label="Department" value={department} />
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
        {value || '—'}
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

function RowActions({
  user,
  pending,
  onChange,
}: {
  user: LineUser
  pending: boolean
  onChange: (user: LineUser, access: AccessAction) => void
}) {
  const name = user.displayName ?? 'this user'
  return (
    <div className="flex items-center gap-2">
      {pending && <Spinner label="Updating…" className="text-slate-400" />}
      {user.access !== 'ALLOWED' && (
        <button
          type="button"
          onClick={() => onChange(user, 'ALLOWED')}
          disabled={pending}
          aria-label={`Allow ${name}`}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
        >
          Allow
        </button>
      )}
      {user.access !== 'BLOCKED' && (
        <button
          type="button"
          onClick={() => onChange(user, 'BLOCKED')}
          disabled={pending}
          aria-label={`Block ${name}`}
          className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
        >
          Block
        </button>
      )}
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
