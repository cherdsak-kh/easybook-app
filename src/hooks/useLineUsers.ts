import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ApiError,
  listLineUsers,
  patchLineUserAccess,
  type AppAccess,
  type LineUser,
  type PaginationMeta,
} from '@/lib/api-client'
import { useAuth } from '@/auth/useAuth'
import { useLineUsersRealtime, type RealtimeStatus } from '@/hooks/useLineUsersRealtime'
import type { SearchField, SortOption } from '@/constants/ui-strings-line-users'

/**
 * Page size used by the FETCH loop. The server caps `limit` at 100 (`limit=101` is a
 * validation rejection, pinned by a backend spec) — a deliberate DoS guard on a PII
 * endpoint. "Ask for one huge page" is therefore impossible; the client loops instead.
 * Do not raise this, and do not ask the backend to raise the cap.
 */
export const FETCH_PAGE_SIZE = 100

/**
 * Hard ceiling on the fetch-all loop: 30 × 100 = **3,000 rows**.
 *
 * This is a TRIPWIRE, not a limit anyone should hit. The real constraint is the DOM: the
 * table renders one `<tr>` with an avatar and a button per row, and without virtualization
 * render/scroll degrades somewhere around 1,500–3,000 rows. Past this ceiling the correct
 * fix is virtualization (`@tanstack/react-virtual`) or a return to server-side querying —
 * NOT a bigger number here.
 *
 * On exceeding it the loop stops, keeps what it fetched, and the page shows a visible
 * non-blocking warning, so a runaway dataset degrades LOUDLY instead of hanging.
 */
export const MAX_PAGES = 30

/** Rows per CLIENT page. Pagination survived the fetch-all rework — see the note below. */
export const CLIENT_PAGE_SIZE = 20

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
 * Ordering for the `status` sort: the review queue first (what an operator actually
 * works through), then the settled states, then the rows with nothing to review.
 */
const STATUS_ORDER: Readonly<Record<AppAccess, number>> = {
  PENDING: 0,
  REJECTED: 1,
  ALLOWED: 2,
  BLOCKED: 3,
  UNREGISTERED: 4,
}

/**
 * Thai collation. A raw `<`/`>` comparison mis-sorts Thai (it compares UTF-16 code
 * units, so leading vowels such as เ/แ/โ sort before the consonant they are pronounced
 * after). `Intl.Collator('th')` is `localeCompare(…, 'th')` with the collator built ONCE
 * — the same algorithm, without re-instantiating one per comparison inside a sort.
 */
const THAI_COLLATOR = new Intl.Collator('th')

/** `"First Last"`, or `''` when the follower has no registration row. */
function fullNameOf(user: LineUser): string {
  const reg = user.registration
  return reg ? `${reg.firstName} ${reg.lastName}`.trim() : ''
}

/** Epoch ms of `followedAt`, or `null` when it is missing/unparseable (sorts last). */
function followedAtOf(user: LineUser): number | null {
  const t = new Date(user.followedAt).getTime()
  return Number.isNaN(t) ? null : t
}

/**
 * The haystack for one row under one search field.
 *
 * The LINE **display name** is searchable in its own right (`lineDisplayName`) and is part
 * of `all`, which is what makes an UNREGISTERED follower findable: it is the only identity
 * such a row has, and the one the Name column now shows for it. The previous
 * `if (!reg) return []` short-circuit applied to EVERY field, so any non-empty query
 * filtered every registration-less row out — that was the bug.
 *
 * The registration-only fields still return `[]` without a registration: a row with no
 * phone must not match a phone query. `displayName` is nullable in the generated types, so
 * it is normalised to `''` here — never `null`/`undefined` in the list — and an empty
 * string can never match a (non-empty, trimmed) query.
 */
function searchableValues(user: LineUser, field: SearchField): string[] {
  const reg = user.registration
  const displayName = user.displayName ?? ''
  switch (field) {
    case 'lineDisplayName':
      return [displayName]
    case 'name':
      return reg ? [`${reg.firstName} ${reg.lastName}`] : []
    case 'phone':
      return reg ? [reg.phone] : []
    case 'department':
      return reg ? [reg.department] : []
    case 'all':
      return reg
        ? [displayName, `${reg.firstName} ${reg.lastName}`, reg.phone, reg.department]
        : [displayName]
  }
}

/** Case-insensitive substring match on the trimmed, lower-cased query. Null-safe. */
function matchesSearch(user: LineUser, field: SearchField, query: string): boolean {
  return searchableValues(user, field).some((value) => (value ?? '').toLowerCase().includes(query))
}

/**
 * Stable sort over a COPY of `rows` (`Array.prototype.sort` mutates, and is stable in
 * every engine we target). Rows with a null/absent key sort **last in every mode**,
 * including the descending ones — "no name" is not a name that happens to sort high.
 */
export function sortLineUsers(rows: readonly LineUser[], sortBy: SortOption): LineUser[] {
  const out = [...rows]
  switch (sortBy) {
    case 'nameAsc':
    case 'nameDesc': {
      const direction = sortBy === 'nameAsc' ? 1 : -1
      return out.sort((a, b) => {
        const an = fullNameOf(a)
        const bn = fullNameOf(b)
        if (!an && !bn) return 0
        if (!an) return 1
        if (!bn) return -1
        return THAI_COLLATOR.compare(an, bn) * direction
      })
    }
    case 'registeredAtAsc':
    case 'registeredAtDesc': {
      const direction = sortBy === 'registeredAtAsc' ? 1 : -1
      return out.sort((a, b) => {
        const at = followedAtOf(a)
        const bt = followedAtOf(b)
        if (at === null && bt === null) return 0
        if (at === null) return 1
        if (bt === null) return -1
        return (at - bt) * direction
      })
    }
    case 'status':
      return out.sort((a, b) => STATUS_ORDER[a.access] - STATUS_ORDER[b.access])
  }
}

/**
 * The orchestration the LINE-users page consumes. All fetch/filter/sort/pagination logic
 * lives here so the page stays presentational and this stays unit-testable at the
 * `api-client` boundary.
 */
export interface UseLineUsers {
  /** The CURRENT CLIENT PAGE of the filtered + searched + sorted set. */
  users: LineUser[]
  /** Client-side pagination meta, derived from the filtered set. */
  meta: PaginationMeta | undefined
  totalPages: number
  /** True for the WHOLE fetch-all loop, not per page. */
  loading: boolean
  /** Page-level load error (403 forbidden vs. generic). `null` when the load succeeded. */
  error: string | null
  /** The `MAX_PAGES` tripwire fired: the list is truncated and must say so. */
  truncated: boolean
  /** How many rows were actually fetched (pre-filter) — the truncation notice needs it. */
  loadedCount: number
  /** Per-row mutation error (403/404/generic). The page routes this to a toast. */
  rowError: string | null
  /** Id of the row whose access change is in flight (disables that row's buttons). */
  pendingId: string | null
  page: number
  setPage: (p: number) => void
  /** Raw search input. Filtering is LOCAL and immediate — no debounce, no request. */
  search: string
  /** Sets the search term and resets `page` → 1. */
  setSearch: (s: string) => void
  searchField: SearchField
  /** Sets the searched field and resets `page` → 1. */
  setSearchField: (f: SearchField) => void
  sortBy: SortOption
  /** Sets the sort order and resets `page` → 1. */
  setSortBy: (s: SortOption) => void
  accessFilter: AppAccess | ''
  /** Sets the access filter and resets `page` → 1. */
  setAccessFilter: (a: AppAccess | '') => void
  /** Optimistically PATCH a row's access; rolls forward on the returned row, maps errors. */
  changeAccess: (user: LineUser, access: AppAccess) => Promise<void>
  /**
   * Replace a single row in-place by id (the list stays the single source of truth).
   * Consumed by the edit modal (`useLineUserEditor`) after each successful PATCH so the
   * list reflects a save — including a partial two-endpoint save — without a refetch.
   */
  updateUserInPlace: (updated: LineUser) => void
  /** Dismiss the row-level error. */
  clearRowError: () => void
  /**
   * Re-run the whole fetch-all loop.
   *
   * `{ silent: true }` skips the loading state so the table keeps its rows while it
   * revalidates — used by the socket's reconnect reconciliation (AC F12), where flashing a
   * full skeleton (and momentarily collapsing the pager) on every transient network blip
   * would be a worse experience than the staleness it is fixing.
   */
  refetch: (options?: { silent?: boolean }) => void
  /** Live-channel state for the connection indicator (AC F14). */
  realtimeStatus: RealtimeStatus
  /**
   * The id of the most recently `lineUser.deleted`-ed row, or `null`.
   *
   * Exists for exactly one consumer: the page must not leave its inspect/edit modal bound to
   * a row that has vanished from under it (plan edge case 11). A dedicated signal rather than
   * "diff the visible rows", because a row can leave the visible page for entirely legitimate
   * reasons (a filter, a search, a page change) that must NOT close the modal.
   */
  deletedRowId: string | null
}

/**
 * Fetches the FULL LINE-user dataset once, then filters/searches/sorts/paginates it
 * entirely in memory.
 *
 * **Why fetch everything.** Search and sort must span the whole dataset, not one server
 * page — an operator searching "สมชาย" on page 3 of 12 expects every match, not the
 * matches that happen to be on page 3. Since `limit` is capped at 100 server-side
 * (see {@link FETCH_PAGE_SIZE}), that means a page loop.
 *
 * **The loop's guarantees** (each has a test):
 *  - it terminates on `meta.totalPages`, never on "a page came back short" — otherwise an
 *    exactly-`limit`-divisible total fires one wasted request;
 *  - it is SEQUENTIAL, never an unbounded `Promise.all` over a page list;
 *  - the monotonic `reqId` guard covers the WHOLE loop, so a superseded fetch-all discards
 *    every one of its pages rather than interleaving them with the newer one;
 *  - a failure on page *k* raises a page-level error; it NEVER renders a silently short list;
 *  - a 401 anywhere in the loop expires the session (the route guard owns the redirect);
 *  - `MAX_PAGES` truncates loudly.
 *
 * **Pagination survived** (PO decision OPEN-2), now client-side: filtering and sorting see
 * every row, but the DOM only ever holds {@link CLIENT_PAGE_SIZE} of them. Keeping the DOM
 * small is what actually holds the ceiling described on {@link MAX_PAGES}.
 *
 * The server's `search` / `access` query params are untouched and still supported by the
 * API — this page simply stops sending them. An unused parameter is not a dead parameter;
 * do not "clean them up" for other callers.
 *
 * **Live updates are additive.** `useLineUsersRealtime` patches the SAME in-memory array on
 * `lineUser.created` / `updated` / `deleted`, and reconciles it after a reconnect. It can
 * only ever fail SOFT: if the socket never connects (backend down, gateway not deployed, a
 * proxy without upgrade headers, or `VITE_WS_ENABLED=false`) this hook behaves exactly as it
 * did before the socket existed — every fetch/filter/sort path above is untouched by it.
 */
export function useLineUsers(): UseLineUsers {
  const { status: authStatus, expireSession } = useAuth()

  const [page, setPageState] = useState(1)
  const [search, setSearchState] = useState('')
  const [searchField, setSearchFieldState] = useState<SearchField>('all')
  const [sortBy, setSortByState] = useState<SortOption>('registeredAtDesc')
  const [accessFilter, setAccessFilterState] = useState<AppAccess | ''>('')

  const [allUsers, setAllUsers] = useState<LineUser[]>([])
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const [deletedRowId, setDeletedRowId] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  /**
   * Monotonic id of the newest fetch-all. Captured once BEFORE the loop and re-checked
   * after every page, so a superseded run bails out mid-loop and can never commit a
   * partially-accumulated (or stale) dataset.
   */
  const reqId = useRef(0)

  /** Set by `refetch({ silent: true })`; consumed (and reset) by the next loop run. */
  const silentRef = useRef(false)

  useEffect(() => {
    const id = ++reqId.current
    // A silent run keeps the current rows on screen while it revalidates. Failures still
    // take the SAME error path below — one error path, no divergence.
    const silent = silentRef.current
    silentRef.current = false
    if (!silent) {
      setLoading(true)
      setError(null)
    }

    void (async () => {
      const accumulated: LineUser[] = []
      try {
        const first = await listLineUsers({ page: 1, limit: FETCH_PAGE_SIZE })
        if (id !== reqId.current) return // superseded — drop this page AND the whole run.
        accumulated.push(...first.data)

        const serverTotalPages = first.meta.totalPages
        const lastPage = Math.min(serverTotalPages, MAX_PAGES)
        // Sequential on purpose. Terminates on `meta.totalPages`, so an exactly
        // 100-divisible total does not fire one extra request.
        for (let p = 2; p <= lastPage; p += 1) {
          const next = await listLineUsers({ page: p, limit: FETCH_PAGE_SIZE })
          if (id !== reqId.current) return
          accumulated.push(...next.data)
        }

        setAllUsers(accumulated)
        setTruncated(serverTotalPages > MAX_PAGES)
        // Explicit rather than implied by the pre-loop reset: a SILENT run never cleared it,
        // so this is what lets a reconnect reconciliation recover from an earlier failure.
        setError(null)
        setLoading(false)
      } catch (err: unknown) {
        if (id !== reqId.current) return
        if (err instanceof ApiError && err.status === 401) {
          // Session death — not a render error. The guard bounces to login, so `loading`
          // deliberately stays true rather than flashing an empty table mid-redirect.
          expireSession()
          return
        }
        // A mid-loop failure is a PAGE-level error. Never commit `accumulated`: a short
        // list that looks complete is worse than a visible failure.
        setError(
          err instanceof ApiError && err.status === 403
            ? LEADS_MESSAGES.loadForbidden
            : LEADS_MESSAGES.loadFailed,
        )
        setLoading(false)
      }
    })()
  }, [refreshTick, expireSession])

  // filter → search → sort. Memoized as ONE pipeline so a keystroke does not re-scan the
  // array several times over (NFR-3: ≤100 ms at 1,000 rows).
  const filtered = useMemo(() => {
    const byAccess = accessFilter ? allUsers.filter((u) => u.access === accessFilter) : allUsers
    const query = search.trim().toLowerCase()
    const bySearch = query
      ? byAccess.filter((u) => matchesSearch(u, searchField, query))
      : byAccess
    return sortLineUsers(bySearch, sortBy)
  }, [allUsers, accessFilter, search, searchField, sortBy])

  const totalPages = Math.ceil(filtered.length / CLIENT_PAGE_SIZE)
  // Clamp rather than reset: a row removed from the last page must not strand the operator
  // on an empty page they cannot see out of.
  const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages)
  const users = useMemo(
    () => filtered.slice((safePage - 1) * CLIENT_PAGE_SIZE, safePage * CLIENT_PAGE_SIZE),
    [filtered, safePage],
  )

  const meta = useMemo<PaginationMeta>(
    () => ({
      page: safePage,
      limit: CLIENT_PAGE_SIZE,
      total: filtered.length,
      totalPages,
    }),
    [safePage, filtered.length, totalPages],
  )

  const setPage = useCallback((p: number) => setPageState(p), [])

  const setSearch = useCallback((s: string) => {
    setSearchState(s)
    setPageState(1)
  }, [])

  const setSearchField = useCallback((f: SearchField) => {
    setSearchFieldState(f)
    setPageState(1)
  }, [])

  const setSortBy = useCallback((s: SortOption) => {
    setSortByState(s)
    setPageState(1)
  }, [])

  const setAccessFilter = useCallback((a: AppAccess | '') => {
    setAccessFilterState(a)
    setPageState(1)
  }, [])

  const clearRowError = useCallback(() => setRowError(null), [])

  const refetch = useCallback((options?: { silent?: boolean }) => {
    silentRef.current = options?.silent === true
    setRefreshTick((t) => t + 1)
  }, [])

  // In-place replace by id — no refetch. Reused internally by `changeAccess` so both paths
  // stay identical, and idempotent by construction.
  const updateUserInPlace = useCallback((updated: LineUser) => {
    setAllUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
  }, [])

  // ---------------------------------------------------------------------------
  // Live channel (design §11.2). Every handler below mutates ONLY `allUsers`; `search`,
  // `searchField`, `sortBy`, `accessFilter` and `page` are separate state and are never
  // touched, which is precisely why an incoming event cannot reset the operator's view or
  // yank them back to page 1. The filter → search → sort → paginate memo simply re-runs over
  // the new array, so a row that no longer matches the active filter drops out of view while
  // staying in the dataset (and reappears the moment the filter is cleared).
  // ---------------------------------------------------------------------------

  /**
   * `lineUser.created` AND `lineUser.updated` both land here: both are UPSERTS by id and
   * differ only in intent (append vs. replace-in-place), which the sort memo erases anyway
   * since it re-orders the whole set on every render.
   *
   * Upsert, not insert/replace:
   *  - a re-follow or a webhook retry can repeat a `created` for a row we already hold, and
   *  - an `updated` can arrive for a row created after our fetch-all (AC F11),
   * so BOTH directions must be non-crashing and non-duplicating. This is also what makes the
   * socket echo of the operator's own optimistic mutation a no-op (AC F15), and what keeps a
   * post-reconnect burst from duplicating rows.
   */
  const upsertUser = useCallback((incoming: LineUser) => {
    setAllUsers((prev) => {
      const index = prev.findIndex((u) => u.id === incoming.id)
      if (index === -1) return [...prev, incoming]
      const next = [...prev]
      next[index] = incoming
      return next
    })
    // A re-follow re-surfaces a row we previously removed, so the "this row is gone" signal
    // must not outlive it — otherwise the page would keep closing that row's modal.
    setDeletedRowId((prev) => (prev === incoming.id ? null : prev))
  }, [])

  /**
   * `lineUser.deleted` — remove by id. Idempotent: a concurrent double-unfollow can emit it
   * twice, and an unknown id returns the SAME array reference so React skips the re-render
   * entirely rather than re-running the whole pipeline for nothing.
   */
  const removeUser = useCallback((id: string) => {
    setAllUsers((prev) => (prev.some((u) => u.id === id) ? prev.filter((u) => u.id !== id) : prev))
    setDeletedRowId(id)
  }, [])

  /** Reconnect reconciliation (AC F12) — silent, so a blip does not blank the table. */
  const resync = useCallback(() => refetch({ silent: true }), [refetch])

  // Connect only once the session probe says we are authenticated (AC F7): an anonymous page
  // load must never open a socket whose handshake is guaranteed to be rejected.
  const realtimeStatus = useLineUsersRealtime(authStatus === 'authenticated', {
    onCreated: upsertUser,
    onUpdated: upsertUser,
    onDeleted: removeUser,
    onResync: resync,
  })

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

  return {
    users,
    meta,
    totalPages,
    loading,
    error,
    truncated,
    loadedCount: allUsers.length,
    rowError,
    pendingId,
    page: safePage,
    setPage,
    search,
    setSearch,
    searchField,
    setSearchField,
    sortBy,
    setSortBy,
    accessFilter,
    setAccessFilter,
    changeAccess,
    updateUserInPlace,
    clearRowError,
    refetch,
    realtimeStatus,
    deletedRowId,
  }
}
