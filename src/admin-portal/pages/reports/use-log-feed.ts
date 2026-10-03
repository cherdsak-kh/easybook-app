/**
 * The data layer Hub 5 and Hub 6 share: a range-level "meta" request (KPIs, options) plus a
 * server-paginated list, with the fetch discipline every report page owes.
 *
 * ⚠️ TWO REQUESTS WITH DIFFERENT TRIGGERS, because the API splits them and the UI must not re-pay for
 * what did not change: the META follows the RANGE only (the KPIs never move with the toolbar), the LIST
 * follows range, filters, page and size. Typing in the search box refetches the list, never the KPIs.
 *
 * ⚠️ FILTERS RESET THE PAGE WITHOUT AN EXTRA REQUEST. The page number is stored with the key of the
 * range+filters it was chosen under; when the key changes, `page` reads as 1 on that same render, so the
 * list effect fires ONCE with page 1 instead of once with a stale page and again after a reset effect.
 * The server clamps a page past the end and echoes the page it used, which is adopted here.
 *
 * ⚠️ STALE-WHILE-REVALIDATE ON FILTERS, SKELETON ON A RANGE CHANGE. A filter or page change keeps the
 * rows on screen (dimmed, `listLoading`) so the toolbar the user is typing in never unmounts and the
 * card does not jump; a RANGE change clears everything, as Hubs 1 to 3 do, so the previous range is
 * never shown under the new echo line. รีเฟรช keeps data on screen too.
 *
 * ⚠️ ONE REQUEST IN FLIGHT PER KIND: a new one aborts the old and a `seq` guard drops a late answer.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '@/lib/api-client'
import type { LoadErrorKind } from '../../components/feedback/LoadError'

export interface RefreshResult {
  ok: boolean
  /** The HTTP status of the first failure, or `null` (success, a dead connection, a superseded call). */
  status: number | null
}

const kindOf = (err: unknown): LoadErrorKind => {
  const status = err instanceof ApiError ? err.status : 0
  if (status === 0) return 'network'
  if (status === 403) return 'forbidden'
  return 'server'
}
const statusOf = (err: unknown): number | null => (err instanceof ApiError ? err.status : null)

const SUPERSEDED: RefreshResult = { ok: false, status: null }

export function useLogFeed<L extends { page: number }, M>({
  from,
  to,
  filterKey,
  fetchMeta,
  fetchList,
}: {
  from: string
  to: string
  /** Identity of the toolbar filters AND the page size: when it changes the page returns to 1. */
  filterKey: string
  fetchMeta: (signal: AbortSignal) => Promise<M>
  fetchList: (page: number, signal: AbortSignal) => Promise<L>
}) {
  const [meta, setMeta] = useState<M | null>(null)
  const [metaError, setMetaError] = useState<LoadErrorKind | null>(null)
  const [list, setList] = useState<L | null>(null)
  const [listError, setListError] = useState<LoadErrorKind | null>(null)
  const [listLoading, setListLoading] = useState(true)
  const [lastSync, setLastSync] = useState<Date | null>(null)

  const rangeKey = `${from}|${to}`
  const resetKey = `${rangeKey}|${filterKey}`
  const [pageState, setPageState] = useState({ key: resetKey, page: 1 })
  const page = pageState.key === resetKey ? pageState.page : 1
  const setPage = useCallback((n: number) => setPageState({ key: resetKey, page: n }), [resetKey])

  // The callers' closures change identity every render; the effects below must not.
  const fns = useRef({ fetchMeta, fetchList })
  const current = useRef({ page, resetKey, rangeKey })
  useEffect(() => {
    fns.current = { fetchMeta, fetchList }
    current.current = { page, resetKey, rangeKey }
  })

  const metaSeq = useRef(0)
  const listSeq = useRef(0)
  const listRange = useRef<string | null>(null)

  const loadMeta = useCallback(async (keep: boolean, signal: AbortSignal): Promise<RefreshResult> => {
    const mine = ++metaSeq.current
    setMetaError(null)
    if (!keep) setMeta(null)
    try {
      const m = await fns.current.fetchMeta(signal)
      if (mine !== metaSeq.current) return SUPERSEDED
      setMeta(m)
      return { ok: true, status: null }
    } catch (err) {
      if (mine !== metaSeq.current) return SUPERSEDED
      setMeta(null)
      setMetaError(kindOf(err))
      return { ok: false, status: statusOf(err) }
    }
  }, [])

  const loadList = useCallback(
    async (p: number, key: string, range: string, signal: AbortSignal): Promise<RefreshResult> => {
      const mine = ++listSeq.current
      setListError(null)
      setListLoading(true)
      // A different range clears the rows; the same range keeps them while the new page loads.
      if (listRange.current !== range) setList(null)
      try {
        const l = await fns.current.fetchList(p, signal)
        if (mine !== listSeq.current) return SUPERSEDED
        listRange.current = range
        setList(l)
        setListLoading(false)
        setLastSync(new Date())
        // The server clamps a page past the end; adopt the page it actually used.
        if (l.page !== p) setPageState({ key, page: l.page })
        return { ok: true, status: null }
      } catch (err) {
        if (mine !== listSeq.current) return SUPERSEDED
        setListLoading(false)
        setListError(kindOf(err))
        return { ok: false, status: statusOf(err) }
      }
    },
    [],
  )

  // The META follows the range only.
  useEffect(() => {
    const ac = new AbortController()
    void loadMeta(false, ac.signal)
    return () => ac.abort()
  }, [rangeKey, loadMeta])

  // The LIST follows range, filters, size and page.
  useEffect(() => {
    const ac = new AbortController()
    void loadList(page, resetKey, rangeKey, ac.signal)
    return () => ac.abort()
  }, [page, resetKey, rangeKey, loadList])

  /** รีเฟรช and the live poll: both requests again, data kept on screen behind the new answer. */
  const refresh = useCallback(async (): Promise<RefreshResult> => {
    const ac = new AbortController()
    const c = current.current
    const [a, b] = await Promise.all([
      loadMeta(true, ac.signal),
      loadList(c.page, c.resetKey, c.rangeKey, ac.signal),
    ])
    return { ok: a.ok && b.ok, status: a.status ?? b.status }
  }, [loadMeta, loadList])

  /** `ลองใหม่อีกครั้ง` on an error panel: a fresh load, nothing kept. */
  const retry = useCallback(() => {
    const ac = new AbortController()
    const c = current.current
    void loadMeta(false, ac.signal)
    void loadList(c.page, c.resetKey, c.rangeKey, ac.signal)
  }, [loadMeta, loadList])

  return { meta, metaError, list, listError, listLoading, page, setPage, lastSync, refresh, retry }
}
