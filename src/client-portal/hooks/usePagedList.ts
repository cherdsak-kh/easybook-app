import { useCallback, useEffect, useRef, useState } from 'react'
import type { ListFacets, ListPage } from '@/client-portal/lib/paging'

/** The server's `limit` ceiling. A silent refresh re-reads everything loaded in ONE request under it. */
const MAX_LIMIT = 100

/**
 * One page-1 read that has been asked for — a first load, a filter change, a retry, or a live refresh.
 *
 * 🔴 `silent` IS A PROPERTY OF THIS REQUEST, NOT OF THE HOOK (`ISSUE-QA-03`, fix round 3). It used to be
 * a flag on shared state that whichever read happened to be current would pick up, which produced a
 * family of leaks: a filter change inheriting an earlier refresh's `silent` (`ISSUE-QA-02`), and a
 * refresh arriving DURING a first load, filter change or retry turning that loud read silent — so its
 * failure was swallowed and the reader got another filter's rows or an endless skeleton
 * (`ISSUE-QA-03`). Now every read is a new `epoch`, its `silent` is decided ONCE when it is created,
 * and the load effect reads it from the closure of that one run.
 */
type ResetRequest = {
  /** Bumped by every new read. The load effect depends on this alone, so each request runs once. */
  epoch: number
  /** The `filterKey` this read is for. A render with a different key creates a new, loud request. */
  key: string
  /** Decided at creation and never changed for this epoch. */
  silent: boolean
  /** This epoch's reply has been committed (success or failure). Not an effect dependency. */
  landed: boolean
}

/**
 * "Load more" over a `{ data, meta, facets }` list (`CLIENT-PAGINATION-1`), shared by `#/venues` and
 * `#/bookings` so the two cannot disagree about the rules below.
 *
 * ── 🔴 THE RULES, AND WHY EACH ONE ──
 * 1. **A filter change resets to page 1 and REPLACES the list.** `filterKey` is the serialised filter
 *    set; appending page 1 of a new filter onto page 3 of the old one is a list of two different
 *    questions.
 * 2. **An appended page is de-duplicated by `id`.** Offset pagination can repeat a row when the set
 *    changes between two reads (a booking submitted, an approval crossing into history). A repeat is
 *    dropped; a gap cannot be detected, which is why a live update re-reads rather than patching.
 * 3. **A stale response is discarded, never rendered.** Every effect run carries a sequence number; a
 *    reply to an older run that lands late is ignored. Without it, typing fast shows the results for
 *    "ห้" underneath the box that says "ห้องประชุม".
 * 4. **More exists while `page < totalPages`**, both counted at `pageSize`. Tracked as pages, not as
 *    `rows.length < total`: after de-duplication those two can disagree forever and the button would
 *    stay on screen fetching nothing.
 * 5. **A silent refresh keeps what the reader loaded.** It re-reads page 1 with `limit = pages ×
 *    pageSize` (capped at 100) and replaces the list in place, so a socket event does not throw a
 *    reader who scrolled through three pages back to the first ten. No skeleton, and a failure leaves
 *    the list alone — stale beats wrong.
 * 6. **No append while a reset is in flight** (`ISSUE-QA-01`). Until a page-1 read lands, the OLD rows
 *    and page count are still here; an append started then would ask for "old page count + 1" under
 *    the new request and could leave a gap. `loadMore` refuses while `resettingRef` is set and the
 *    button is disabled. Only the reply carrying THAT run's sequence number releases the guard
 *    (success or failure, silent or not), so a StrictMode double run or a superseded read cannot
 *    release it early. An append that started BEFORE the reset is still discarded by rule 3.
 * 7. **A filter change and a retry are always loud** (`ISSUE-QA-02`). Each creates a new request with
 *    `silent: false`. A filter change does it while rendering (React's "adjust state while rendering"
 *    pattern, guarded by `req.key !== filterKey`), so the load effect sees the new key and the new loud
 *    request in the same commit and runs once.
 * 8. **A silent refresh never downgrades a loud read that has not landed** (`ISSUE-QA-03`).
 *    `refreshSilently` creates a request whose `silent` is `previous.landed || previous.silent`:
 *      · the previous read has landed → silent (rule 5 — the rows on screen belong to this request);
 *      · the previous read is itself a pending silent refresh → silent (two live updates in a row);
 *      · the previous read is a pending LOUD one (first load, filter change, retry) → **loud**: it
 *        replaces that read with `page=1&limit=pageSize` and reports its failure, exactly as the loud
 *        read alone would have. There is no page count to keep and no list worth protecting yet —
 *        without this, a failure left `rows === null` (an endless skeleton) or the previous filter's rows.
 *
 * ⚠️ WHY STATE AND FUNCTIONAL UPDATES, NOT REFS. `main.tsx` enables `StrictMode`. Every decision above
 * is made inside a `setReq` updater from the previous request, never from a ref consumed in the
 * effect, so the double render and the double effect take the same branch as production in LINE.
 */
export function usePagedList<T extends { id: string }>(opts: {
  /** For the console only. */
  label: string
  filterKey: string
  pageSize: number
  fetchPage: (page: number, limit: number) => Promise<ListPage<T>>
  messageFor: (error: unknown) => string
}) {
  const { label, filterKey, pageSize } = opts

  /* The latest closures, read at call time. `fetchPage` is a fresh arrow on every render; putting it
     in the effect's deps would refetch on every keystroke instead of on every DEBOUNCED change. This
     effect is declared first, so it runs before the load effect in the same commit. */
  const fetchRef = useRef(opts.fetchPage)
  const messageRef = useRef(opts.messageFor)
  useEffect(() => {
    fetchRef.current = opts.fetchPage
    messageRef.current = opts.messageFor
  })

  const [rows, setRows] = useState<T[] | null>(null)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(0)
  const [facets, setFacets] = useState<ListFacets>({ venueTypes: [] })
  const [failure, setFailure] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreFailure, setMoreFailure] = useState<string | null>(null)

  /* The first load is request 0: loud, for the initial filter. */
  const [req, setReq] = useState<ResetRequest>({
    epoch: 0,
    key: filterKey,
    silent: false,
    landed: false,
  })

  /* Rule 7. Guarded by the comparison, so it settles in one extra render pass and never loops. The
     updater re-checks `r.key`, so a StrictMode double render cannot create two requests for one change
     — and even if the epoch advanced twice, the effect runs once per commit. */
  if (req.key !== filterKey) {
    setReq((r) =>
      r.key === filterKey
        ? r
        : { epoch: r.epoch + 1, key: filterKey, silent: false, landed: false },
    )
  }

  const seq = useRef(0)
  const pagesRef = useRef(0)
  const loadingMoreRef = useRef(false)
  /* Rule 6. The ref is what `loadMore` reads, synchronously; the state is what disables the button. */
  const resettingRef = useRef(false)
  const [resetting, setResetting] = useState(false)

  const commitPages = (n: number) => {
    pagesRef.current = n
    setPages(n)
  }

  const endReset = () => {
    resettingRef.current = false
    setResetting(false)
  }

  const { epoch, silent } = req

  useEffect(() => {
    /* `epoch` and `silent` are this request's own values, captured by this run — nothing another
       request does later can change what THIS read does with its reply. */
    const id = ++seq.current
    const maxPages = Math.max(1, Math.floor(MAX_LIMIT / pageSize))
    const want = silent ? Math.min(Math.max(pagesRef.current, 1), maxPages) : 1

    /* Marks THIS epoch as landed. Keyed by epoch, so a late write can never mark a newer request. */
    const markLanded = () =>
      setReq((r) => (r.epoch === epoch && !r.landed ? { ...r, landed: true } : r))

    if (!silent) setFailure(null)
    // Rule 6: no append may start until THIS read's reply lands.
    resettingRef.current = true
    setResetting(true)
    // A reset outranks an append that is still in flight — its reply is stale by rule 3.
    loadingMoreRef.current = false
    setLoadingMore(false)
    setMoreFailure(null)

    fetchRef.current(1, want * pageSize).then(
      (page) => {
        if (id !== seq.current) return
        endReset()
        markLanded()
        /* Cleared on success rather than only at the top, so a silent refetch also takes down a
           failure banner the reader never dismissed. */
        setFailure(null)
        setRows(page.data)
        setTotal(page.meta.total)
        setFacets(page.facets)
        commitPages(want)
      },
      (error: unknown) => {
        console.warn(`[${label}] list failed:`, error)
        if (id !== seq.current) return
        /* Released on a SILENT failure too — otherwise one dropped socket-triggered refresh would
           leave "load more" disabled on a list that is still perfectly usable. */
        endReset()
        markLanded()
        if (silent) return
        setFailure(messageRef.current(error))
        setRows([])
        setTotal(0)
        commitPages(0)
      },
    )
    // `silent` is fixed for a given `epoch` (see `ResetRequest`), so `epoch` alone identifies the run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epoch, pageSize, label])

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || resettingRef.current) return
    const id = seq.current
    const next = pagesRef.current + 1
    loadingMoreRef.current = true
    setLoadingMore(true)
    setMoreFailure(null)

    fetchRef.current(next, pageSize).then(
      (page) => {
        if (id !== seq.current) return
        setRows((prev) => {
          const seen = new Set((prev ?? []).map((r) => r.id))
          return [...(prev ?? []), ...page.data.filter((r) => !seen.has(r.id))]
        })
        setTotal(page.meta.total)
        setFacets(page.facets)
        commitPages(next)
        loadingMoreRef.current = false
        setLoadingMore(false)
      },
      (error: unknown) => {
        console.warn(`[${label}] load more failed:`, error)
        if (id !== seq.current) return
        setMoreFailure(messageRef.current(error))
        loadingMoreRef.current = false
        setLoadingMore(false)
      },
    )
  }, [pageSize, label])

  /** The reader pressed "try again": skeleton back, a new LOUD request (rule 7). */
  const retry = useCallback(() => {
    setRows(null)
    setReq((r) => ({ epoch: r.epoch + 1, key: r.key, silent: false, landed: false }))
  }, [])

  /**
   * A live update nobody asked for. Silent only if it cannot downgrade a loud read that has not landed
   * yet (rule 8) — decided here, from the previous request, and bound to the new one.
   */
  const refreshSilently = useCallback(() => {
    setReq((r) => ({
      epoch: r.epoch + 1,
      key: r.key,
      silent: r.landed || r.silent,
      landed: false,
    }))
  }, [])

  return {
    rows,
    total,
    facets,
    failure,
    loadingMore,
    /** A page-1 read is in flight (rule 6): "load more" must not be actionable. */
    resetting,
    moreFailure,
    hasMore: rows !== null && pages * pageSize < total,
    loadMore,
    retry,
    refreshSilently,
  }
}
