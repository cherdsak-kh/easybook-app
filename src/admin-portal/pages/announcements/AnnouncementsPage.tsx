/**
 * `ประกาศและข่าวสาร` — `/backend/announcements`.
 *
 * Two jobs on one page, and they are deliberately not the same kind of tool (prototype 6754–6926):
 *   · LEFT  — the broadcasts WE own: list, filter and search announcements (`GET /announcements`),
 *             and — since phase 4 (`ANNOUNCE-UI-4`) — compose, edit, delete and send them through
 *             `AnnouncementDialog`.
 *   · RIGHT — one-to-one chat, which we do NOT rebuild: the OA's identity and reply mode
 *             (`GET /announcements/line-bot-info`), canned replies to copy, and one link that opens
 *             LINE's own console in a new tab (LINE refuses to be framed).
 *
 * ── The dialog ──
 * This page owns only whether it is open and what it was opened with (`dlg`), and re-keys it on
 * every open (`seq`). Everything inside — form, record, mode, the send lock — is the dialog's. After
 * any write attempt that reached the server the dialog calls `onChanged`, which re-reads the list AND
 * both counts; the counts keep their numbers during that refresh instead of flashing `—` (A-10).
 *
 * ── Filtering and paging are server-side, and the state is the component's ──
 * `status` (the tab), `q`, `page` and `limit` are query parameters; this component holds one page of
 * rows. No URL state, like FeedbackPage: a deep link lands on ทั้งหมด, page 1 (plan D-2).
 *
 * ⚠️ THE TAB COUNTS ARE GLOBAL, AND COST TWO EXTRA REQUESTS (plan D-1). The list route has no
 * `counts` block, so on entry two more calls — `status=sent` and `status=draft`, `limit=10`, no `q` —
 * are read for their `meta.total`. ทั้งหมด is their sum, which is exact because the status enum has
 * only those two values. They do NOT move while searching or paging, and they are re-read only on
 * entry, on the list's error retry and after a write. A failed count reads `—`, never a made-up 0.
 * Do not "fix" a pill by counting `rows`: that would count the PAGE.
 *
 * ⚠️ UNDER <StrictMode> THE DEV SERVER FIRES EVERY ENTRY REQUEST TWICE (design S-9) — two identical
 * triples of list calls, two bot-info calls — and the `seq` guards keep only the newest. That is
 * StrictMode doing its job; do not add a ref latch that skips the second mount.
 *
 * ── Three roles ──
 * All three read everything here, and every row opens (`view` for a VIEWER, or for anyone on a SENT
 * row). Only `acl.write` renders the divider and `+ สร้างประกาศใหม่` (plan D-7) and gets `edit` on a
 * DRAFT. The server's `@Roles` is the control.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { ApiError } from '@/lib/api-client'
import { LoadError, type LoadErrorKind } from '../../components/feedback/LoadError'
import { PageHeading } from '../../components/shell/PageHeading'
import { Badge } from '../../components/ui/Badge'
import { PaginationBar, PaginationBarSkeleton } from '../../components/ui/PaginationBar'
import { useAcl } from '../../lib/use-acl'
import { useAuth } from '../../lib/auth-context'
import { thaiTime } from '../../lib/thai-date'
import type { AdminRoute } from '../../routes'
import {
  getLineBotInfo,
  listAnnouncements,
  type Announcement,
  type AnnouncementLimit,
  type AnnouncementStatusFilter,
  type OaState,
} from './announcements-api'
import type { DialogMode } from './announcement-form'
import { ICON } from './announcement-icons'
import { AnnouncementDialog } from './components/AnnouncementDialog'
import { Glyph } from './components/AnnouncementGlyph'
import { AnnouncementRow, EmptyBox, ListSkeleton } from './components/AnnouncementRows'
import { CannedRepliesCard } from './components/CannedRepliesCard'
import { LineOaCard } from './components/LineOaCard'

/** The three sizes the server accepts. Anything else is a 400, never a clamp. */
const PAGE_SIZES: readonly AnnouncementLimit[] = [10, 20, 50]

/** Debounce for the search box — the prototype's 180ms. */
const SEARCH_DEBOUNCE_MS = 180

/** The strip, in reading order. These are FILTER names, page copy — not enum translations. */
const TABS: readonly { key: AnnouncementStatusFilter; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'sent', label: 'ส่งแล้ว' },
  { key: 'draft', label: 'ฉบับร่าง' },
]

/** `null` = still loading OR failed; both render `—`. */
type Counts = { sent: number | null; draft: number | null }

/**
 * `open: false` KEEPS `seq`, so the same dialog instance stays mounted for the close commit — the
 * `Modal` rule: `close` fires and the opener gets focus back. The next open bumps `seq` and re-keys it.
 */
type DialogState = { open: boolean; seq: number; mode: DialogMode; record: Announcement | null }

/** `ApiError` → which error panel. A 401 has already raised the session-expired dialog. */
const kindOf = (err: unknown): LoadErrorKind => {
  const status = err instanceof ApiError ? err.status : 0
  if (status === 0) return 'network'
  if (status === 403) return 'forbidden'
  return 'server'
}

export function AnnouncementsPage({ route }: { route: AdminRoute }) {
  const { user } = useAuth()
  const acl = useAcl(user!.role)

  /* ── the dialog ── */
  const [dlg, setDlg] = useState<DialogState>({ open: false, seq: 0, mode: 'create', record: null })
  /** The row button or the create button that opened it — where focus goes back after a re-read. */
  const anchor = useRef<HTMLElement | null>(null)
  /** Set by a close that a list re-read will follow; spent by the next committed rows. */
  const refocus = useRef(false)
  /** A `load` is in flight — whether a close can leave the refocus to the rows effect. */
  const listLoading = useRef(false)
  const listHead = useRef<HTMLHeadingElement>(null)

  /* ── the list ── */
  const [rows, setRows] = useState<Announcement[] | null>(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<LoadErrorKind | null>(null)
  const [live, setLive] = useState('')

  const [tab, setTab] = useState<AnnouncementStatusFilter>('all')
  /** What is TYPED. `query` is what was last SENT (trimmed) — see the debounce. */
  const [term, setTerm] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState<AnnouncementLimit>(10)

  const [counts, setCounts] = useState<Counts>({ sent: null, draft: null })
  const [oa, setOa] = useState<OaState>({ status: 'loading' })

  /** Only the newest call of each loader may write state — two in flight land in network order. */
  const loadSeq = useRef(0)
  const countsSeq = useRef(0)
  const oaSeq = useRef(0)
  /** The first load is not news; every later one changed the list under the reader. */
  const announced = useRef(false)

  /**
   * ⚠️ COMMITS ONLY A CHANGED TERM (design S-10). A trailing space trims to the same query, so it
   * sends nothing and does not throw the reader back to page 1.
   */
  useEffect(() => {
    const id = setTimeout(() => {
      const next = term.trim()
      if (next !== query) {
        setQuery(next)
        setPage(1)
      }
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [term, query])

  const load = useCallback(async () => {
    const seq = ++loadSeq.current
    listLoading.current = true
    setError(null)
    try {
      const res = await listAnnouncements({ page, limit, status: tab, q: query || undefined })
      if (seq !== loadSeq.current) return
      // ⚠️ CLAMP BEFORE COMMITTING. A search that shrinks the result under the current page would
      // otherwise commit `data: []` under a pager that still claims rows. Changing `page` re-runs
      // this through the effect below.
      if (res.meta.totalPages > 0 && page > res.meta.totalPages) {
        setPage(res.meta.totalPages)
        return
      }
      setRows(res.data)
      setTotal(res.meta.total)
      if (announced.current) setLive(`แสดงผลแล้ว ${res.meta.total} รายการ`)
      announced.current = true
    } catch (err) {
      if (seq !== loadSeq.current) return
      // No rows are coming, so no refocus either — a stale flag would steal focus on a later load.
      refocus.current = false
      setRows(null)
      setError(kindOf(err))
    } finally {
      if (seq === loadSeq.current) listLoading.current = false
    }
  }, [page, limit, tab, query])

  useEffect(() => {
    void load()
  }, [load])

  /**
   * Both pills from their own `meta.total`, settled independently — one failure is one `—`.
   * `keep` (after a write) skips the reset, so the pills hold their numbers during the refresh
   * instead of flashing `—` (A-10).
   */
  const loadCounts = useCallback(async (keep = false) => {
    const seq = ++countsSeq.current
    if (!keep) setCounts({ sent: null, draft: null })
    const [sent, draft] = await Promise.allSettled([
      listAnnouncements({ page: 1, limit: 10, status: 'sent' }),
      listAnnouncements({ page: 1, limit: 10, status: 'draft' }),
    ])
    if (seq !== countsSeq.current) return
    setCounts({
      sent: sent.status === 'fulfilled' ? sent.value.meta.total : null,
      draft: draft.status === 'fulfilled' ? draft.value.meta.total : null,
    })
  }, [])

  useEffect(() => {
    void loadCounts()
  }, [loadCounts])

  /**
   * `initial` is the ONLY call that shows the skeleton. A retry keeps the failure panel — and the
   * retry button that has focus — on screen until the answer lands (design §4.3).
   */
  const loadOa = useCallback(async (initial: boolean) => {
    const seq = ++oaSeq.current
    if (initial) setOa({ status: 'loading' })
    const res = await getLineBotInfo()
    if (seq !== oaSeq.current) return
    setOa(
      res.ok
        ? { status: 'ok', info: res.value, checkedAt: thaiTime(new Date()) }
        : { status: 'failed', reason: res.reason },
    )
  }, [])

  useEffect(() => {
    void loadOa(true)
  }, [loadOa])

  const retryOa = useCallback(() => loadOa(false), [loadOa])

  /* ── Every filter change goes back to page 1 ── */
  const selectTab = (next: AnnouncementStatusFilter) => {
    setTab(next)
    setPage(1)
  }
  const selectLimit = (next: AnnouncementLimit) => {
    setLimit(next)
    setPage(1)
  }

  const pill = (key: AnnouncementStatusFilter): number | string => {
    if (key === 'sent') return counts.sent ?? '—'
    if (key === 'draft') return counts.draft ?? '—'
    return counts.sent !== null && counts.draft !== null ? counts.sent + counts.draft : '—'
  }

  /* ── the dialog: open, close, and focus after a re-read ── */

  const openCreate = (e: MouseEvent<HTMLButtonElement>) => {
    anchor.current = e.currentTarget
    setDlg((d) => ({ open: true, seq: d.seq + 1, mode: 'create', record: null }))
  }

  /** From the ROW DATA — list and detail share `AnnouncementDto`, so there is no spinner (D-10). */
  const openRow = useCallback(
    (item: Announcement, opener: HTMLElement) => {
      anchor.current = opener
      setDlg((d) => ({
        open: true,
        seq: d.seq + 1,
        mode: acl.write && item.status === 'DRAFT' ? 'edit' : 'view',
        record: item,
      }))
    },
    [acl.write],
  )

  /**
   * ⚠️ IDEMPOTENT: `Modal` calls `onClose` twice (the ✕, then its `close` event).
   *
   * When a re-read is in flight, the rows effect below re-applies focus once the new rows commit.
   * Otherwise `Modal` has already restored focus to the opener; if that opener is gone, the list
   * heading takes it — in a timeout, so it runs after `Modal`'s own restore.
   */
  const closeDialog = useCallback(({ changed }: { changed: boolean }) => {
    setDlg((d) => (d.open ? { ...d, open: false } : d))
    if (changed && listLoading.current) {
      refocus.current = true
      return
    }
    setTimeout(() => {
      if (!anchor.current?.isConnected) listHead.current?.focus()
    }, 0)
  }, [])

  /** The dialog's `onChanged`: the list AND both counts, the counts without the `—` flash. */
  const refresh = useCallback(() => {
    void load()
    void loadCounts(true)
  }, [load, loadCounts])

  /**
   * After a write closed the dialog and the list re-read, focus goes back to the row or the create
   * button — or to the list heading if the row left the page (DRAFT → SENT under ฉบับร่าง, a
   * deletion). Runs on the COMMIT of the new rows, when the DOM is current (the FeedbackPage AC-48
   * pattern).
   */
  useEffect(() => {
    if (!refocus.current || rows === null) return
    refocus.current = false
    const back = anchor.current
    if (back?.isConnected) {
      if (document.activeElement !== back) back.focus()
    } else {
      listHead.current?.focus()
    }
  }, [rows])

  return (
    <div className="card-shell lg:overflow-y-auto">
      <PageHeading
        route={route}
        desc="เผยแพร่ประกาศและข่าวสารไปยังผู้ใช้ผ่าน LINE และจัดการการสนทนา"
        descAtEveryWidth={false}
      />

      {/* Mounted ONCE, above every panel: a live region is announced only if it already existed
          when the text arrived, and the list unmounts behind every skeleton. */}
      <p role="status" aria-live="polite" className="sr-only">
        {live}
      </p>

      {/* DOM order is the stacking order below xl: the list first, then the LINE column. */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section aria-labelledby="an-list-h" className="pf-card flex min-w-0 flex-col xl:col-span-2">
          <div className="pf-body flex flex-col gap-4">
            {/* ── title | tabs · divider · create ── */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* `tabIndex={-1}`: focus lands here when the row that opened a written record has
                  left the page. */}
              <h2
                id="an-list-h"
                ref={listHead}
                tabIndex={-1}
                className="pf-title flex items-center gap-2 outline-none"
              >
                <Glyph d={ICON.megaphone} className="h-5 w-5 shrink-0 text-base-content/60" />
                ประกาศทั้งหมด
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                {/* daisyUI 5 styles the active tab from `aria-selected` OR `.tab-active`; both are
                    set. One shared list, so no `tabpanel` — the FeedbackPage strip's pattern.
                    ⚠️ The colours are the prototype shim's, as utilities: daisyUI paints an idle tab
                    at 50% `base-content`, under the 4.5:1 floor on `base-200`; `/70` is the portal's
                    secondary-text floor. Utilities win because daisyUI's `.tab` sits in a SUB-layer
                    of `utilities`. Its own `:focus-visible` ring is left alone. */}
                <div role="tablist" aria-label="กรองตามสถานะประกาศ" className="tabs tabs-box max-w-full">
                  {TABS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={tab === t.key}
                      onClick={() => selectTab(t.key)}
                      className={`tab gap-1.5 font-medium ${
                        tab === t.key
                          ? 'tab-active text-primary'
                          : 'text-base-content/70 transition-colors hover:text-base-content'
                      }`}
                    >
                      {t.label}
                      <Badge tone="slate" className="tabular-nums">
                        {pill(t.key)}
                      </Badge>
                    </button>
                  ))}
                </div>
                {/* Rendered or not — never hidden with CSS. The prototype's `[data-write-only]`
                    hook does not exist in React (plan D-7). */}
                {acl.write && (
                  <>
                    <span aria-hidden="true" className="hidden h-6 w-px bg-base-300 sm:block" />
                    <button
                      type="button"
                      onClick={openCreate}
                      className="btn-primary2 min-h-9 gap-1.5 px-3 text-[13px]"
                    >
                      <Glyph d={ICON.plus} className="h-4 w-4 shrink-0" strokeWidth={2} />
                      สร้างประกาศใหม่
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ── search: the title only, so the placeholder promises exactly that ── */}
            <div className="relative">
              <Glyph
                d={ICON.search}
                className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-base-content/60"
              />
              <label className="sr-only" htmlFor="an-q">
                ค้นหาหัวข้อประกาศ
              </label>
              {/* `maxLength={100}`: the server answers a longer `q` with a 400, which would read as
                  a LoadError for typing too much (design S-8). */}
              <input
                id="an-q"
                type="search"
                maxLength={100}
                autoComplete="off"
                enterKeyHint="search"
                placeholder="ค้นหาหัวข้อประกาศ"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="min-h-11 w-full min-w-0 rounded-control border border-base-300 bg-base-100 pr-3.5 pl-11 text-[15px] text-base-content transition-colors placeholder:text-base-content/70 focus:border-primary focus:outline-2 focus:-outline-offset-1 focus:outline-primary"
              />
            </div>

            {error ? (
              <LoadError
                kind={error}
                onRetry={() => {
                  void load()
                  void loadCounts()
                }}
              />
            ) : rows === null ? (
              <ListSkeleton />
            ) : rows.length === 0 ? (
              <EmptyBox />
            ) : (
              // No `aria-live` here: the page-level status announces the total instead, so a
              // screen reader is not read every row again.
              <ul className="-mx-1 my-0 flex list-none flex-col divide-y divide-base-300 p-0">
                {rows.map((r) => (
                  <AnnouncementRow key={r.id} item={r} onOpen={openRow} />
                ))}
              </ul>
            )}
          </div>

          {/* OUTSIDE `pf-body`: the bar owns its border-t and padding. Hidden on an empty result,
              so the dashed box does not sit on a "0 รายการ" pager. */}
          {!error &&
            (rows === null ? (
              <PaginationBarSkeleton />
            ) : (
              rows.length > 0 && (
                <PaginationBar
                  page={page}
                  pageSize={limit}
                  total={total}
                  unit="รายการ"
                  pageSizeOptions={PAGE_SIZES}
                  onPageChange={setPage}
                  // `PAGE_SIZES` is the select's only source, so the value is one of the three.
                  onPageSizeChange={(n) => selectLimit(n as AnnouncementLimit)}
                  ariaLabel="แบ่งหน้ารายการประกาศ"
                />
              )
            ))}
        </section>

        <aside aria-label="แชท LINE Official Account" className="flex min-w-0 flex-col gap-6">
          <LineOaCard state={oa} onRetry={retryOa} />
          <CannedRepliesCard canWrite={acl.write} />
        </aside>
      </div>

      {dlg.seq > 0 && (
        <AnnouncementDialog
          key={dlg.seq}
          open={dlg.open}
          initialMode={dlg.mode}
          initialRecord={dlg.record}
          canWrite={acl.write}
          oa={oa.status === 'ok' ? oa.info : null}
          onClose={closeDialog}
          onChanged={refresh}
        />
      )}
    </div>
  )
}
