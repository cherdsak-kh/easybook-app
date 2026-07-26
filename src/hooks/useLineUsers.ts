import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ApiError,
  listLineUsers,
  patchLineUserAccess,
  type AppAccess,
  type LineUser,
  type PaginatedLineUsers,
  type PaginationMeta,
} from '@/lib/api-client'
import { useAuth } from '@/auth/useAuth'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

/** Server default; the admin Leads list is fixed at one page size. */
const PAGE_SIZE = 20

/**
 * User-facing copy for the LINE-users data layer. Kept LOCAL to this hook rather than in a
 * `src/constants/ui-strings-*.ts` feature module — it is data-layer error copy, not page
 * chrome. Exported so the page and its tests read the SAME literal (a copy edited out-of-band
 * while a test queried the old string is a silent red — see the app CLAUDE.md note).
 */
export const LEADS_MESSAGES = {
  /** 403 on the list read — distinct from a generic failure. */
  loadForbidden: 'You do not have permission to view LINE users.',
  loadFailed: 'Could not load LINE users. Please try again.',
  /** 404 on a row mutation — the row was deleted between load and click. */
  rowGone: 'That user no longer exists. Refresh the list.',
  /** 403 on a row mutation — the client gate drifted vs. the server. */
  rowForbidden: 'You are not permitted to change this user’s access.',
  rowFailed: 'Could not update access. Please try again.',
} as const

/**
 * The orchestration the Leads page consumes. All fetch/pagination/filter/mutation logic
 * lives here so the page stays presentational and this stays unit-testable at the
 * `api-client` boundary (design §3.1).
 */
export interface UseLineUsers {
  users: LineUser[]
  meta: PaginationMeta | undefined
  totalPages: number
  /** True during the initial load and every refetch. */
  loading: boolean
  /** Page-level load error (403 forbidden vs. generic). `null` when the load succeeded. */
  error: string | null
  /** Per-row mutation error (403/404/generic). Surfaced as a dismissible row-level alert. */
  rowError: string | null
  /** Id of the row whose access change is in flight (disables that row's buttons). */
  pendingId: string | null
  page: number
  setPage: (p: number) => void
  /** Raw search input (debounced 300ms before it hits the network). */
  search: string
  /** Sets the search term and resets `page` → 1. */
  setSearch: (s: string) => void
  accessFilter: AppAccess | ''
  /** Sets the access filter and resets `page` → 1. */
  setAccessFilter: (a: AppAccess | '') => void
  /** Optimistically PATCH a row's access; rolls forward on the returned row, maps errors. */
  changeAccess: (user: LineUser, access: AppAccess) => Promise<void>
  /**
   * Replace a single row in-place by id (the list stays the single source of truth).
   * Consumed by the Phase-B edit modal (`useLineUserEditor`) after each successful PATCH
   * so the list reflects a save — including a partial two-endpoint save — without a full
   * refetch. Mirrors the by-id replace `changeAccess` already performs internally.
   */
  updateUserInPlace: (updated: LineUser) => void
  /** Dismiss the row-level error alert. */
  clearRowError: () => void
  /** Re-run the current query (e.g. after a "row gone" to reconcile the list). */
  refetch: () => void
}

/**
 * Fetches + mutates the admin LINE-user ("Leads") list. Built fresh against the
 * `api-client` contract, carrying the legacy `LineUsersPage`'s solved edge-cases forward
 * as requirements (design §3.2):
 *  - a monotonic `reqId` race-guard so a slow, superseded response never clobbers a newer
 *    one (a stale page-1 landing after a fast page-2, or a stale search overwriting a
 *    newer one);
 *  - a `loading → error | empty | rows` state machine;
 *  - **401 → `expireSession()`** on both the list read and the row mutation (no navigation
 *    here — the route guard owns the redirect to `/admin-portal/login`);
 *  - 403-on-load → a distinct forbidden notice, any other load failure → generic;
 *  - optimistic in-place row replace on a successful access change (no full refetch),
 *    with `pendingId` disabling the row while in flight;
 *  - row-mutation error mapping (404 → gone, 403 → forbidden, else → generic) — never a
 *    silent no-op, never a logout.
 */
export function useLineUsers(): UseLineUsers {
  const { expireSession } = useAuth()

  const [page, setPageState] = useState(1)
  const [search, setSearchState] = useState('')
  const [accessFilter, setAccessFilterState] = useState<AppAccess | ''>('')
  const debouncedSearch = useDebouncedValue(search.trim(), 300)

  const [result, setResult] = useState<PaginatedLineUsers | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  /** Monotonic id of the newest fetch; a resolution whose captured id is stale is dropped. */
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
        if (id !== reqId.current) return // superseded by a newer fetch — ignore.
        setResult(res)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (id !== reqId.current) return
        if (err instanceof ApiError && err.status === 401) {
          // Session death — not a render error. The guard bounces to login.
          expireSession()
          return
        }
        setError(
          err instanceof ApiError && err.status === 403
            ? LEADS_MESSAGES.loadForbidden
            : LEADS_MESSAGES.loadFailed,
        )
        setLoading(false)
      })
  }, [page, debouncedSearch, accessFilter, refreshTick, expireSession])

  const setPage = useCallback((p: number) => setPageState(p), [])

  const setSearch = useCallback((s: string) => {
    setSearchState(s)
    setPageState(1)
  }, [])

  const setAccessFilter = useCallback((a: AppAccess | '') => {
    setAccessFilterState(a)
    setPageState(1)
  }, [])

  const clearRowError = useCallback(() => setRowError(null), [])
  const refetch = useCallback(() => setRefreshTick((t) => t + 1), [])

  // Optimistic in-place replace by id — no full-list refetch. Exposed for the Phase-B
  // edit modal, and reused internally by `changeAccess` so both paths stay identical.
  const updateUserInPlace = useCallback((updated: LineUser) => {
    setResult((prev) =>
      prev
        ? { ...prev, data: prev.data.map((u) => (u.id === updated.id ? updated : u)) }
        : prev,
    )
  }, [])

  const changeAccess = useCallback(
    async (user: LineUser, access: AppAccess) => {
      setPendingId(user.id)
      setRowError(null)
      try {
        const updated = await patchLineUserAccess(user.id, access)
        updateUserInPlace(updated)
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 401) {
          expireSession()
          return
        }
        if (err instanceof ApiError && err.status === 404) {
          setRowError(LEADS_MESSAGES.rowGone)
        } else if (err instanceof ApiError && err.status === 403) {
          setRowError(LEADS_MESSAGES.rowForbidden)
        } else {
          setRowError(LEADS_MESSAGES.rowFailed)
        }
      } finally {
        setPendingId(null)
      }
    },
    [expireSession, updateUserInPlace],
  )

  const meta = result?.meta
  return {
    users: result?.data ?? [],
    meta,
    totalPages: meta?.totalPages ?? 0,
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
    updateUserInPlace,
    clearRowError,
    refetch,
  }
}
