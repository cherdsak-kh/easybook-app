/**
 * `ข้อเสนอแนะ/แจ้งปัญหา` — `/backend/feedback`, `GET /api/v1/feedback`.
 *
 * The other end of the client portal's `#/issues` form. Every record is one submission from that
 * screen: an `ISS-` (แจ้งปัญหาการใช้งาน) or an `FDB-` (ข้อเสนอแนะ). Staff list, filter and open each
 * one, see its photos, and record what they did — a status and an internal note — in an append-only
 * log. Design authority: the prototype's route 6013–6350, dialog 9220–9456, script 20231–20826.
 *
 * ── Filtering and paging are server-side ──
 * `type` (the tab), `status`, `venueId` and `q` are query parameters; one page of rows is all this
 * component holds. ⛔ Never fetch the table and filter it in the browser.
 *
 * ⚠️ `counts` IS GLOBAL (AC-8): the tab pills and the <h1> chip are computed over the WHOLE table and
 * do not move when a tab or a filter changes. The pills count RECORDS OF THAT TYPE, not the pending
 * ones — "how much is waiting" already has two homes here (the chip and the สถานะ filter), and a
 * third copy would make the tabs and the table disagree the moment a status filter is on. Do not
 * "fix" a pill by counting `rows`: that would count the PAGE.
 *
 * ── Not live ──
 * There is no socket event for reports (§2 Out). The list refreshes on รีเฟรช, after a save, and on
 * re-entering the page. There is no sidebar count either (`FEEDBACK-NAV-COUNT-1`).
 *
 * ── Three roles ──
 * All three read this table and open any record. Only `acl.write` gets the update card and the save
 * button inside the dialog — rendered or not, never disabled. The server's `@Roles` is the control.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ApiError } from '@/lib/api-client'
import { LoadError, type LoadErrorKind } from '../../components/feedback/LoadError'
import { Skeleton } from '../../components/feedback/Skeleton'
import { Spinner } from '../../components/feedback/Spinner'
import { PageHeading } from '../../components/shell/PageHeading'
import { Btn } from '../../components/ui/Btn'
import { Combobox, type ComboboxOption } from '../../components/ui/Combobox'
import { PaginationBar, PaginationBarSkeleton } from '../../components/ui/PaginationBar'
import { FEEDBACK_TYPE, type FeedbackStatus, type FeedbackType } from '../../labels'
import { useAcl } from '../../lib/use-acl'
import { useAuth } from '../../lib/auth-context'
import { useBusy } from '../../lib/use-busy'
import { useToast } from '../../lib/toast-context'
import { useVenueOptions } from '../bookings/use-venue-options'
import type { AdminRoute } from '../../routes'
import {
  FEEDBACK_VENUE_GENERAL,
  getFeedback,
  listFeedback,
  type FeedbackCounts,
  type FeedbackDetail,
  type FeedbackLimit,
  type FeedbackListItem,
} from './feedback-api'
import { ICON } from './feedback-icons'
import { statusLabel } from './feedback-record'
import { FeedbackDetailModal } from './components/FeedbackDetailModal'
import { Glyph } from './components/FeedbackGlyph'
import { FeedbackCard, FeedbackRow } from './components/FeedbackRows'

/** The three sizes the server accepts. Anything else is a 400, never a clamp. */
const PAGE_SIZES: readonly FeedbackLimit[] = [10, 20, 50]

/** Debounce for the search box — the prototype's 180ms (AC-30). */
const SEARCH_DEBOUNCE_MS = 180

/** `null` is the ทั้งหมด tab — "no `type` on the query". */
type TypeTab = FeedbackType | null

/**
 * The strip, in reading order. The pill hue is the code pill's hue (`.fb-code-iss` red,
 * `.fb-code-fdb` sky), so a count and the codes it counts are one colour. Icons are the client
 * form's own glyph pair — SVG, never emoji.
 */
const TABS: {
  key: TypeTab
  label: string
  pill: string
  count: (c: FeedbackCounts) => number
  icon?: { d: string; tone: string }
}[] = [
  {
    key: null,
    label: 'ทั้งหมด',
    pill: 'rq-tab-n-slate',
    count: (c) => c.issueCount + c.feedbackCount,
  },
  {
    key: 'ISSUE',
    label: FEEDBACK_TYPE.ISSUE.label,
    pill: 'rq-tab-n-rose',
    count: (c) => c.issueCount,
    icon: { d: ICON.issue, tone: 'text-error' },
  },
  {
    key: 'FEEDBACK',
    label: FEEDBACK_TYPE.FEEDBACK.label,
    pill: 'rq-tab-n-sky',
    count: (c) => c.feedbackCount,
    icon: { d: ICON.bulb, tone: 'text-info' },
  },
]

/** `''` is "no status filter". The resolved row says BOTH words because it spans both types. */
type StatusFilter = '' | FeedbackStatus

const STATUS_OPTIONS: readonly ComboboxOption<StatusFilter>[] = [
  { id: '', name: 'ทุกสถานะ' },
  { id: 'PENDING', name: 'รอดำเนินการ' },
  { id: 'IN_PROGRESS', name: 'กำลังดำเนินการ' },
  { id: 'RESOLVED', name: 'แก้ไขแล้ว / รับทราบ' },
]

/** The toolbar comboboxes keep their <label> as the accessible name and hide only its pixels. */
const LABEL_HIDDEN = '[&>.form-label]:sr-only'

/** The skeleton's ragged bars, spelt out as literals so the class scanner generates every one. */
const SKELETON_BARS = [
  { a: 'w-2/5', b: 'w-3/5' },
  { a: 'w-3/5', b: 'w-4/5' },
  { a: 'w-1/2', b: 'w-2/3' },
  { a: 'w-2/3', b: 'w-1/2' },
  { a: 'w-3/4', b: 'w-2/5' },
] as const

const GONE = 'ไม่พบเรื่องนี้ในระบบแล้ว · ระบบดึงข้อมูลล่าสุดให้แล้ว'

/** `ApiError` → which error panel. A 401 has already raised the session-expired dialog. */
const kindOf = (err: unknown): LoadErrorKind => {
  const status = err instanceof ApiError ? err.status : 0
  if (status === 0) return 'network'
  if (status === 403) return 'forbidden'
  return 'server'
}

export function FeedbackPage({ route }: { route: AdminRoute }) {
  const { user } = useAuth()
  const acl = useAcl(user!.role)
  const toast = useToast()

  const [rows, setRows] = useState<FeedbackListItem[] | null>(null)
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<FeedbackCounts | null>(null)
  const [error, setError] = useState<LoadErrorKind | null>(null)
  const [live, setLive] = useState('')

  const [tab, setTab] = useState<TypeTab>(null)
  /** What is TYPED. `query` is what was last SENT — see the debounce. */
  const [term, setTerm] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('')
  /** `''` = ทุกสถานที่; `FEEDBACK_VENUE_GENERAL` = ปัญหาทั่วไป. Two questions, never one value. */
  const [venueId, setVenueId] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState<FeedbackLimit>(10)

  /** Bumped by รีเฟรช, so the venue vocabulary is re-read with the rows. */
  const [reloadKey, setReloadKey] = useState(0)
  const venueOptions = useVenueOptions(reloadKey)

  const searchRef = useRef<HTMLInputElement>(null)
  /** Focus lands here when the row that opened a saved record has left the page (AC-48). */
  const cardRef = useRef<HTMLDivElement>(null)
  /** Only the newest `load` may write state — two in flight land in network order otherwise. */
  const loadSeq = useRef(0)
  /** The first load is not news; every later one changed the table under the reader. */
  const announced = useRef(false)
  /** Set by a save; spent by the next committed page of rows (see the focus effect below). */
  const refocus = useRef(false)

  useEffect(() => {
    const id = setTimeout(() => {
      setQuery(term.trim())
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [term])

  /**
   * ⚠️ THE TAB IS NOT A FILTER HERE, and that decides which empty panel shows. An empty tab with
   * nothing typed or picked is good news; an empty result WITH a filter is a miss and needs a way
   * out. Only the second offers `ล้างตัวกรองทั้งหมด`.
   */
  const anyFilter = Boolean(query || status || venueId)

  /**
   * Resolves `true` when it committed rows. `quiet` skips the live-region total — used after a save,
   * whose own receipt is the thing to announce.
   */
  const load = useCallback(
    async (options?: { quiet?: boolean }): Promise<boolean> => {
      const seq = ++loadSeq.current
      setError(null)
      try {
        const res = await listFeedback({
          page,
          limit,
          type: tab ?? undefined,
          status: status || undefined,
          venueId: venueId || undefined,
          q: query || undefined,
        })
        if (seq !== loadSeq.current) return false
        setCounts(res.counts)
        // ⚠️ CLAMP BEFORE COMMITTING. Resolving the last pending row on page 3 of a รอดำเนินการ
        // filter empties that page (E-6); committing its `data: []` would flash an empty panel under
        // a pager that still claims rows. Changing `page` re-runs this through the effect below.
        if (res.meta.totalPages > 0 && page > res.meta.totalPages) {
          setPage(res.meta.totalPages)
          return true
        }
        setRows(res.data)
        setTotal(res.meta.total)
        if (announced.current && !options?.quiet) setLive(`แสดงผลแล้ว ${res.meta.total} รายการ`)
        announced.current = true
        return true
      } catch (err) {
        if (seq !== loadSeq.current) return false
        refocus.current = false
        setRows(null)
        setError(kindOf(err))
        return false
      }
    },
    [page, limit, tab, status, venueId, query],
  )

  useEffect(() => {
    void load()
  }, [load])

  const { busy: refreshing, run: runRefresh } = useBusy()
  const refresh = () =>
    runRefresh(async () => {
      setRows(null)
      setReloadKey((k) => k + 1)
      if (await load()) toast('success', 'อัปเดตข้อมูลล่าสุดแล้ว')
    })

  /* ── Every filter change goes back to page 1 ── */
  const selectTab = (next: TypeTab) => {
    setTab(next)
    setPage(1)
  }
  const selectStatus = (next: StatusFilter) => {
    setStatus(next)
    setPage(1)
  }
  const selectVenue = (next: string) => {
    setVenueId(next)
    setPage(1)
  }
  const selectLimit = (next: FeedbackLimit) => {
    setLimit(next)
    setPage(1)
  }
  /** q, status and venue — NOT the tab — then page 1 and the caret back in the search box. */
  const clearFilters = () => {
    setTerm('')
    setQuery('')
    setStatus('')
    setVenueId('')
    setPage(1)
    searchRef.current?.focus()
  }

  /**
   * ทุกสถานที่ FIRST and as a real choice (a filter that will not say it is off is a filter people
   * forget is on), then ปัญหาทั่วไป, then the live venue list in Thai collation order.
   */
  const venueChoices = useMemo<ComboboxOption<string>[]>(
    () => [
      { id: '', name: 'ทุกสถานที่' },
      { id: FEEDBACK_VENUE_GENERAL, name: 'ปัญหาทั่วไป / ไม่ระบุสถานที่' },
      ...[...(venueOptions.venues ?? [])]
        .sort((a, b) => a.name.localeCompare(b.name, 'th'))
        .map((v) => ({ id: v.id, name: v.name })),
    ],
    [venueOptions.venues],
  )

  const pending = counts?.pendingCount ?? 0
  /** Nothing in the whole table — a different fact from "nothing on this tab". */
  const systemEmpty =
    rows !== null &&
    rows.length === 0 &&
    !anyFilter &&
    counts !== null &&
    counts.issueCount + counts.feedbackCount === 0
  const miss = rows !== null && rows.length === 0 && anyFilter
  const tabEmpty = rows !== null && rows.length === 0 && !anyFilter && !systemEmpty
  const first = (page - 1) * limit + 1

  /* ── The detail dialog ─────────────────────────────────────────────────────────────────────── */

  const [open, setOpen] = useState(false)
  /** The ROW it was opened from — carries the code before the detail fetch lands. */
  const [target, setTarget] = useState<FeedbackListItem | null>(null)
  const [detail, setDetail] = useState<FeedbackDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailFailed, setDetailFailed] = useState(false)
  /** Which id the in-flight detail fetch belongs to — two rows opened quickly can land reversed. */
  const wanted = useRef<string | null>(null)
  /** The row or card button that opened the dialog, for the focus hand-back after a save. */
  const anchor = useRef<HTMLElement | null>(null)

  const loadDetail = useCallback(async (id: string) => {
    wanted.current = id
    setDetailLoading(true)
    setDetailFailed(false)
    try {
      const res = await getFeedback(id)
      if (wanted.current !== id) return
      setDetail(res)
    } catch {
      if (wanted.current !== id) return
      setDetail(null)
      setDetailFailed(true)
    } finally {
      if (wanted.current === id) setDetailLoading(false)
    }
  }, [])

  const openDetail = (item: FeedbackListItem, opener: HTMLElement) => {
    anchor.current = opener
    setTarget(item)
    setDetail(null)
    setDetailFailed(false)
    setOpen(true)
    void loadDetail(item.id)
  }

  /**
   * AC-48 — after a save the dialog closes (and `Modal` hands focus back to the opener), then the
   * list re-reads. If the opener's row is no longer on the page — it left the filter, or the page
   * clamped — focus would be stranded on <body>; it goes to the list card instead. Runs on the
   * COMMIT of the new rows, not when the fetch resolves, because only then is the DOM current.
   */
  useEffect(() => {
    if (!refocus.current || rows === null) return
    refocus.current = false
    const back = anchor.current
    if (back?.isConnected) {
      if (document.activeElement !== back) back.focus()
    } else {
      cardRef.current?.focus()
    }
  }, [rows])

  const onSaved = (saved: FeedbackDetail, before: FeedbackStatus) => {
    const message =
      saved.status !== before
        ? `อัปเดต ${saved.code} เป็น “${statusLabel(saved.status, saved.type)}” แล้ว`
        : `บันทึกการดำเนินการของ ${saved.code} แล้ว`
    setDetail(saved)
    setOpen(false)
    setLive(message)
    toast('success', message)
    refocus.current = true
    void load({ quiet: true })
  }

  const onGone = () => {
    setOpen(false)
    toast('error', GONE)
    refocus.current = true
    void load()
  }

  const onStale = () => {
    if (target) void loadDetail(target.id)
    void load({ quiet: true })
  }

  return (
    <div className="card-shell">
      <PageHeading
        route={route}
        desc="รับเรื่องข้อเสนอแนะและปัญหาการใช้งานจากผู้ใช้ พร้อมติดตามสถานะการดำเนินการ"
        descAtEveryWidth={false}
        // Hidden at zero rather than reading "0 รายการรอดำเนินการ" — an alert chip that says
        // nothing is wrong still has to be read to be ignored.
        titleExtra={
          pending > 0 ? (
            <span className="nav-count nav-count-alert ml-2 inline-block align-middle">
              {pending} รายการรอดำเนินการ
            </span>
          ) : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            {/* Busy but NOT disabled: `disabled` blurs the button and would drop a keyboard user
                on <body> mid-refresh. `useBusy` refuses the re-entrant click on its own. */}
            <button
              type="button"
              onClick={() => void refresh()}
              aria-label="รีเฟรช"
              aria-busy={refreshing || undefined}
              className="flex min-h-11 items-center gap-2 rounded-control border border-base-content/20 bg-base-100 px-3 text-[14px] font-medium text-base-content/80 transition-colors hover:border-info/40 hover:bg-info/10 hover:text-info focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-4"
            >
              {refreshing ? <Spinner /> : <Glyph d={ICON.refresh} />}
              <span className="hidden sm:inline">รีเฟรช</span>
            </button>
          </div>
        }
      />

      {/* Mounted ONCE, above every panel: a live region is announced only if it already existed
          when the text arrived, and the list panel unmounts behind every skeleton. */}
      <p role="status" aria-live="polite" className="sr-only">
        {live}
      </p>

      <div
        ref={cardRef}
        tabIndex={-1}
        role="region"
        aria-label="รายการข้อเสนอแนะและแจ้งปัญหา"
        className="card-shell rounded-card border border-base-300/70 bg-base-100 shadow-e1 outline-none"
      >
        {/* ── ประเภทเรื่อง ── `mx-auto w-max` on the INNER track, never `justify-center` on the
            scroller: centring the scroller pushes the first tab past the left edge on a phone,
            where `scrollLeft` cannot reach it. */}
        <div className="shrink-0 border-b border-base-300 px-2 pt-2 sm:px-3 lg:px-4">
          <div className="nav-scroll flex overflow-x-auto pb-2">
            <div
              role="tablist"
              aria-label="กรองตามประเภทเรื่อง"
              className="mx-auto flex w-max items-center gap-1"
            >
              {TABS.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => selectTab(t.key)}
                  className="rq-tab"
                >
                  {t.icon && (
                    <Glyph d={t.icon.d} className={`h-4.5 w-4.5 shrink-0 ${t.icon.tone}`} />
                  )}
                  <span>{t.label}</span>
                  {/* `—` until the first page lands, never a fake 0. */}
                  <span className={`rq-tab-n ${t.pill}`}>{counts ? t.count(counts) : '—'}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── ค้นหาและตัวกรอง ── search grows; two comboboxes beside it, a 2-up grid on a phone.
            สถานะ has four fixed options (no search box); สถานที่ is searchable, because nine venues
            fit a dropdown and forty do not. */}
        <div className="flex shrink-0 flex-col gap-2.5 border-b border-base-300 p-3 sm:gap-3 sm:p-4 lg:flex-row lg:items-center lg:p-5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-control border border-transparent bg-base-200 px-4 transition-all focus-within:border-primary/40 focus-within:bg-base-100 focus-within:ring-4 focus-within:ring-primary/10">
            <Glyph d={ICON.search} className="h-5 w-5 shrink-0 text-base-content/60" />
            {/* The placeholder is a PROMISE: the server searches exactly these three things. */}
            <label className="sr-only" htmlFor="fb-q">
              ค้นหารหัสอ้างอิง หัวข้อ หรือชื่อผู้ส่งเรื่อง
            </label>
            <input
              ref={searchRef}
              id="fb-q"
              type="search"
              autoCorrect="on"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck
              enterKeyHint="search"
              placeholder="ค้นหารหัสอ้างอิง หัวข้อ หรือชื่อผู้ส่งเรื่อง"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="min-h-11 w-full min-w-0 border-none bg-transparent text-[15px] text-base-content/90 outline-none placeholder:text-base-content/70"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5 lg:flex lg:shrink-0">
            <Combobox
              id="fb-status-f"
              className={`min-w-0 ${LABEL_HIDDEN} lg:w-48`}
              label="กรองตามสถานะ"
              options={STATUS_OPTIONS}
              value={status}
              onChange={selectStatus}
              searchable={false}
            />
            <Combobox
              id="fb-venue-f"
              className={`min-w-0 ${LABEL_HIDDEN} lg:w-64`}
              label="กรองตามสถานที่"
              options={venueChoices}
              value={venueId}
              onChange={selectVenue}
              // Loading and failure both SAY so — a filter silently offering two rows would read as
              // a school with no venues.
              disabled={venueOptions.venues === null}
              error={venueOptions.error ?? undefined}
            />
          </div>
        </div>

        {error ? (
          <div className="card-shell">
            <LoadError kind={error} onRetry={() => void load()} />
          </div>
        ) : rows === null ? (
          <ListSkeleton />
        ) : systemEmpty ? (
          <div className="card-shell">
            <Panel
              icon={ICON.chat}
              title="ยังไม่มีเรื่องที่แจ้งเข้ามา"
              description="เมื่อผู้ใช้ส่งแจ้งปัญหาการใช้งานหรือข้อเสนอแนะผ่าน LINE เรื่องจะเข้ามาที่หน้านี้ พร้อมรหัสอ้างอิง ISS- หรือ FDB-"
              wide
            />
          </div>
        ) : (
          <div className="card-shell">
            <div className="card-scroll nav-scroll">
              {miss || tabEmpty ? (
                /* ONE block, two copies of its words. With no filter on, an empty tab is good news
                   and a clear button would point at controls nobody touched; with one on, it is a
                   miss and the reset is the way out. */
                <Panel
                  icon={ICON.search}
                  title={miss ? 'ไม่พบเรื่องที่ตรงกับเงื่อนไข' : 'ไม่มีเรื่องในหมวดนี้'}
                  description={
                    miss
                      ? 'ลองเปลี่ยนคำค้นหา สถานะ หรือสถานที่ แล้วดูอีกครั้ง'
                      : 'ยังไม่มีผู้ใช้ส่งเรื่องประเภทนี้เข้ามา'
                  }
                  actions={
                    miss ? (
                      <Btn variant="ghost" onClick={clearFilters}>
                        ล้างตัวกรองทั้งหมด
                      </Btn>
                    ) : undefined
                  }
                />
              ) : (
                /* Two siblings, each owning one fact: the breakpoint is carried by these CLASSES,
                   emptiness by the branch above. Never a `hidden` prop on either. */
                <>
                  <div className="hidden lg:block">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr>
                          <th scope="col" className="th-cell th-cell-tight w-14 text-center">
                            ลำดับ
                          </th>
                          <th scope="col" className="th-cell th-cell-tight whitespace-nowrap">
                            รหัสอ้างอิง
                          </th>
                          <th scope="col" className="th-cell th-cell-tight">
                            สถานที่
                          </th>
                          <th scope="col" className="th-cell th-cell-tight">
                            หัวข้อและรายละเอียด
                          </th>
                          <th scope="col" className="th-cell th-cell-tight">
                            ผู้ส่งเรื่อง
                          </th>
                          <th scope="col" className="th-cell th-cell-tight whitespace-nowrap">
                            วันที่แจ้ง
                          </th>
                          <th scope="col" className="th-cell th-cell-tight text-center">
                            สถานะการดำเนินงาน
                          </th>
                          <th
                            scope="col"
                            data-col="actions"
                            className="th-cell th-cell-tight text-center"
                          >
                            {/* ดูข้อมูล for a VIEWER: the column holds one read, so "จัดการ" would
                                claim a capability the role does not have. */}
                            {acl.actionsColumnLabel}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <FeedbackRow
                            key={r.id}
                            item={r}
                            index={first + i}
                            onView={(el) => openDetail(r, el)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <ul className="m-0 list-none divide-y divide-base-300/60 p-0 lg:hidden">
                    {rows.map((r) => (
                      <FeedbackCard key={r.id} item={r} onView={(el) => openDetail(r, el)} />
                    ))}
                  </ul>
                </>
              )}
            </div>

            <PaginationBar
              page={page}
              pageSize={limit}
              total={total}
              unit="รายการ"
              pageSizeOptions={PAGE_SIZES}
              onPageChange={setPage}
              // `PAGE_SIZES` is the select's only source, so the value is one of the three.
              onPageSizeChange={(n) => selectLimit(n as FeedbackLimit)}
              ariaLabel="แบ่งหน้ารายการข้อเสนอแนะและแจ้งปัญหา"
            />
          </div>
        )}
      </div>

      {/* STAYS MOUNTED, closed rather than unrendered: removing an open <dialog> from the tree never
          fires `close`, and focus is left on <body>. */}
      <FeedbackDetailModal
        open={open}
        onClose={() => setOpen(false)}
        row={target}
        detail={detail}
        loading={detailLoading}
        failed={detailFailed}
        onRetry={() => {
          if (target) void loadDetail(target.id)
        }}
        canWrite={acl.write}
        onSaved={onSaved}
        onStale={onStale}
        onGone={onGone}
      />
    </div>
  )
}

/**
 * The empty / no-match panel, in the prototype's own markup (6150–6159, 6190–6198): a glyph of the
 * thing that is missing, a heading, one sentence, and at most one way out.
 */
function Panel({
  icon,
  title,
  description,
  actions,
  wide = false,
}: {
  icon: string
  title: string
  description: string
  actions?: ReactNode
  /** The whole-table empty panel's longer sentence gets `max-w-md`; the miss panel keeps `sm`. */
  wide?: boolean
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-base-200">
        <svg
          aria-hidden="true"
          className="h-8 w-8 text-base-content/60"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <h2 className="text-[18px] font-semibold text-base-content th-tight">{title}</h2>
      <p
        className={`mt-1.5 text-[14px] leading-[1.6] text-base-content/70 th-tight ${
          wide ? 'max-w-md' : 'max-w-sm'
        }`}
      >
        {description}
      </p>
      {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  )
}

/**
 * The first-load skeleton — the prototype's five ragged rows (6227–6251) plus the pager's stand-in,
 * so the card does not change height when the rows land. `aria-busy` and ONE announcement.
 */
function ListSkeleton() {
  return (
    <div className="card-shell" aria-busy="true">
      <span className="sr-only" role="status">
        กำลังโหลดรายการข้อเสนอแนะและแจ้งปัญหา
      </span>
      <div className="card-scroll nav-scroll">
        <ul className="m-0 list-none divide-y divide-base-300/60 p-0" aria-hidden="true">
          {SKELETON_BARS.map(({ a, b }) => (
            <li key={`${a}-${b}`} className="flex items-center gap-4 px-4 py-4 lg:px-5">
              <Skeleton variant="box" className="h-6 w-20 shrink-0" />
              <span className="min-w-0 flex-1">
                <Skeleton className={`h-3.5 ${a}`} />
                <Skeleton variant="soft" className={`mt-2.5 h-3 ${b}`} />
              </span>
              {/* Wrapped, because `Skeleton` always carries `block` and two display utilities on
                  one element resolve by generated-CSS order, which nothing here controls. */}
              <span className="hidden shrink-0 sm:block">
                <Skeleton variant="box" className="h-6 w-24" />
              </span>
            </li>
          ))}
        </ul>
      </div>
      <PaginationBarSkeleton />
    </div>
  )
}
