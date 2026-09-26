/**
 * `การแจ้งเตือน` — `/backend/notifications` (`NOTIF-UI-1`), the record behind the topbar bell's peek.
 * Design authority: the prototype's route 6013–6388, row template 6779–6846 and page module
 * 20663–21440. Contract: `NOTIF-API-1`'s six routes.
 *
 * ── Filtering and paging are server-side ──
 * The tab (`category`), สถานะการอ่าน (`isRead`), ช่วงเวลา (`period`) and the search box (`search`) are
 * query parameters, ANDed by the server; one page of rows is all this component holds. ⛔ Never fetch
 * the feed and filter it in the browser. Every change of them — and of the page size — goes back to
 * page 1 and clears the selection. All of it is local state: nothing is written to the URL, and the
 * page starts over on the way back in (the prototype's `__notifPageReset`).
 *
 * ── The counts are NOT this page's ──
 * The <h1> pill and the five tab pills read `unread` from `NotificationsProvider`, the same answer the
 * bell's badge reads (D-10). They are GLOBAL — they do not move with any filter — and UNREAD, not total:
 * the tab is a source, and "how many ever came from การลงทะเบียน" is a number nobody acts on.
 *
 * ── Nothing is optimistic ──
 * Every write awaits the server, then `invalidate()` re-reads the bell, the counts, the read-probe AND
 * this list (through `version`). That refetch is QUIET — rows stay on screen, no skeleton, and a
 * failure keeps them. A LOUD load (arriving, any filter/page/size change, the error panel's retry)
 * shows the skeleton only while there are no rows yet, and the error panel on failure.
 *
 * ── Three roles, one screen ──
 * All three reach it, and a VIEWER's writes here are allowed: they touch only its own receipts (read
 * state and "delete for me"). The only role-dependent thing on the page is the row CTA, hidden when it
 * points at a screen this role cannot open (D-14). That is UX; the server's `@Roles` is the control.
 *
 * PDPA: titles and bodies carry names and phone numbers. Nothing here logs a row, a title, a body or a
 * search term; titles reach a toast only where the prototype's own copy puts them (a single delete).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '@/lib/api-client'
import { ConfirmModal } from '../../components/feedback/ConfirmModal'
import { LoadError, type LoadErrorKind } from '../../components/feedback/LoadError'
import { PageHeading } from '../../components/shell/PageHeading'
import { Btn } from '../../components/ui/Btn'
import { Combobox, type ComboboxOption } from '../../components/ui/Combobox'
import { PaginationBar } from '../../components/ui/PaginationBar'
import { NOTIF_CATEGORY_LABEL, type NotificationCategory } from '../../labels'
import { useAuth } from '../../lib/auth-context'
import { actionTarget } from '../../lib/notifications'
import {
  listNotifications,
  type AdminNotification,
  type NotificationPeriod,
  type NotificationUnreadCount,
} from '../../lib/notifications-api'
import { useNotifications } from '../../lib/notifications-context'
import { useToast } from '../../lib/toast-context'
import { useAcl } from '../../lib/use-acl'
import { useBusy } from '../../lib/use-busy'
import { HOME_PATH, type AdminRoute } from '../../routes'
import { NotificationRow } from './components/NotificationRow'
import { NotificationsSkeleton } from './components/NotificationsSkeleton'
import { RowMenu } from './components/RowMenu'
import { ICON } from './notification-icons'

type PageSize = 10 | 20 | 50

/** The three sizes the page offers. The server takes 1–50; the bell asks for 5, the probe for 1. */
const PAGE_SIZES: readonly PageSize[] = [10, 20, 50]

/** Debounce for the search box — the three `search=` siblings' 300ms, not the `q=` pages' 180. */
const SEARCH_DEBOUNCE_MS = 300

/** The server's ceiling on `search` (after trimming). Above it is a 400, which would read as an outage. */
const SEARCH_MAX = 100

/** `null` is the ทั้งหมด tab — "no `category` on the query". */
type Tab = NotificationCategory | null

/** The strip, in the prototype's order. The captions are `NOTIF_CATEGORY_LABEL`, the row tag's words. */
const TABS: readonly { key: Tab; label: string }[] = [
  { key: null, label: 'ทั้งหมด' },
  { key: 'BOOKING', label: NOTIF_CATEGORY_LABEL.BOOKING },
  { key: 'REGISTRATION', label: NOTIF_CATEGORY_LABEL.REGISTRATION },
  { key: 'FEEDBACK', label: NOTIF_CATEGORY_LABEL.FEEDBACK },
  { key: 'SYSTEM', label: NOTIF_CATEGORY_LABEL.SYSTEM },
]

const tabCount = (u: NotificationUnreadCount, key: Tab): number =>
  key === null ? u.total : u.byCategory[key]

/** `''` is "no filter" — the resting caption says the filter is OFF, rather than a placeholder. */
type ReadFilter = '' | 'unread' | 'read'
type PeriodFilter = '' | NotificationPeriod

const READ_OPTIONS: readonly ComboboxOption<ReadFilter>[] = [
  { id: '', name: 'ทุกสถานะ' },
  { id: 'unread', name: 'ยังไม่อ่าน' },
  { id: 'read', name: 'อ่านแล้ว' },
]

const PERIOD_OPTIONS: readonly ComboboxOption<PeriodFilter>[] = [
  { id: '', name: 'ทุกช่วงเวลา' },
  { id: 'today', name: 'วันนี้' },
  { id: '7d', name: '7 วันที่ผ่านมา' },
  { id: '30d', name: '30 วันที่ผ่านมา' },
]

/** `ReadFilter` → the wire. `false` is a real filter, which is why this is not a truthiness test. */
const IS_READ: Record<ReadFilter, boolean | undefined> = { '': undefined, unread: false, read: true }

/** The toolbar comboboxes keep their <label> as the accessible name and hide only its pixels. */
const LABEL_HIDDEN = '[&>.form-label]:sr-only'

/*
 * The two failures the prototype cannot have, so has no copy for (design deviation 4). They follow its
 * `deleteNotif` failure line: what failed, that nothing changed, what to do.
 */
const READ_FAIL = 'ทำเครื่องหมายว่าอ่านแล้วไม่สำเร็จ — สถานะการอ่านยังเหมือนเดิม ลองใหม่อีกครั้ง'
const UNREAD_FAIL = 'ทำเครื่องหมายว่ายังไม่อ่านไม่สำเร็จ — สถานะการอ่านยังเหมือนเดิม ลองใหม่อีกครั้ง'

/** The prototype's `deleteNotif` confirm copy, verbatim (OPEN-4 default). */
const DELETE_DESC =
  'รายการที่ลบแล้วนำกลับมาไม่ได้ · การลบเป็นการนำ “ข้อความแจ้ง” ออกเท่านั้น คำขอจองหรือการลงทะเบียนที่อ้างถึงยังอยู่ในระบบตามเดิม'

/** The shared ⋯ menu's id — one menu, so one id. */
const MENU_ID = 'nt-row-menu'

/**
 * What a delete confirm is about. ONE kind of confirm for three entry points (D-3): a row's ⋯ and the
 * selection both send `{ ids }`; the header's purge sends `{ allRead: true }`. The purge `count` is the
 * read-probe's answer at the moment the dialog opened.
 */
type DeleteTarget =
  | { kind: 'rows'; ids: string[]; title: string | null }
  | { kind: 'purge'; count: number }

/** `การแจ้งเตือน “…”` for one titled row, else `การแจ้งเตือน N รายการ` — the prototype's `askDelete`. */
const whatOf = (t: DeleteTarget): string =>
  t.kind === 'purge'
    ? `การแจ้งเตือน ${t.count} รายการ`
    : t.ids.length === 1 && t.title !== null
      ? `การแจ้งเตือน “${t.title}”`
      : `การแจ้งเตือน ${t.ids.length} รายการ`

/** `ApiError` → which error panel. A 401 has already raised the session-expired dialog. */
const kindOf = (err: unknown): LoadErrorKind => {
  const status = err instanceof ApiError ? err.status : 0
  if (status === 0) return 'network'
  if (status === 403) return 'forbidden'
  return 'server'
}

/** An outline glyph, decorative. 1.8 on controls, the prototype's 1.5 on the 32px panel icons. */
function Glyph({
  d,
  className = 'h-4 w-4 shrink-0',
  stroke = 1.8,
}: {
  d: string
  className?: string
  stroke?: number
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

export function NotificationsPage({ route }: { route: AdminRoute }) {
  const { user } = useAuth()
  const acl = useAcl(user!.role)
  const toast = useToast()
  const navigate = useNavigate()
  const { unread, readTotal, version, markRead, markUnread, markManyRead, dismiss } =
    useNotifications()

  const [rows, setRows] = useState<AdminNotification[] | null>(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<LoadErrorKind | null>(null)
  const [live, setLive] = useState('')

  const [tab, setTab] = useState<Tab>(null)
  const [status, setStatus] = useState<ReadFilter>('')
  const [period, setPeriod] = useState<PeriodFilter>('')
  /** What is TYPED. `query` is what was last SENT — see the debounce. */
  const [term, setTerm] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState<PageSize>(10)
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set())

  const searchRef = useRef<HTMLInputElement>(null)
  /** Focus lands here when the control that acted is gone (a deleted row's ⋯, the bulk buttons). */
  const cardRef = useRef<HTMLDivElement>(null)
  const allRef = useRef<HTMLInputElement>(null)
  /** Only the newest `load` may write state — two in flight land in network order otherwise. */
  const loadSeq = useRef(0)
  /** A LOUD load has started and nothing has committed since — see `load`. */
  const loudPending = useRef(false)
  /** Set by a successful delete; spent by the next committed page of rows. */
  const refocus = useRef(false)
  /** Per-row writes in flight — a double click on a row body or a menu item fires once. */
  const inFlight = useRef(new Set<string>())

  /* 300ms after the last keystroke, not on every one — each one would otherwise be a request. */
  useEffect(() => {
    const id = setTimeout(() => {
      setQuery(term.trim())
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [term])

  /**
   * ⚠️ THE TAB IS A FILTER HERE (prototype `anyFilter`), unlike on ข้อเสนอแนะ. An empty tab is a miss
   * with a way out, not a "nothing in this category" message: the pills already say how many are
   * unread there, and the empty state that means "you have no notifications at all" is reserved for
   * exactly that.
   */
  const anyFilter = Boolean(tab || status || period || query)

  /**
   * One page of rows. `quiet` is the post-write revalidation: a failure keeps the rows on screen
   * rather than swapping in the error panel for data that was fine a second ago.
   *
   * ⚠️ A QUIET LOAD THAT SUPERSEDES A LOUD ONE IS LOUD. The sequence guard discards the older
   * response, so if the newer one were allowed to swallow its failure, nobody would ever commit
   * anything: measured, a revalidation landing while the FIRST load was in flight (StrictMode's
   * second effect run does exactly this on every mount) left the page on its skeleton for good
   * against a 503. The same happens after a tab change if the window regains focus mid-request —
   * and there the screen would keep the OLD tab's rows under the new tab.
   */
  const load = useCallback(
    async (quietAsked: boolean) => {
      const seq = ++loadSeq.current
      if (!quietAsked) loudPending.current = true
      const quiet = quietAsked && !loudPending.current
      if (!quiet) setError(null)
      try {
        const res = await listNotifications({
          page,
          limit,
          category: tab ?? undefined,
          isRead: IS_READ[status],
          period: period || undefined,
          search: query,
        })
        if (seq !== loadSeq.current) return
        // ⚠️ CLAMP BEFORE COMMITTING (D-19). Deleting the last rows of the last page empties it;
        // committing its `data: []` would flash an empty panel under a pager that still claims rows.
        // Changing `page` re-runs this through the effect below. At least 1, so a feed emptied to 0
        // from page 3 lands on page 1 rather than staying on a page that no longer exists.
        const last = Math.max(1, res.meta.totalPages)
        if (page > last) {
          setPage(last)
          return
        }
        loudPending.current = false
        setRows(res.data)
        setTotal(res.meta.total)
        setError(null)
        // Pruned to what is ON SCREEN, every time — a row that left the page (dismissed in another
        // tab, or no longer matching a filter) can never be acted on invisibly (prototype `pageRows`).
        setPicked((prev) => {
          if (prev.size === 0) return prev
          const here = new Set(res.data.map((r) => r.id))
          const next = new Set([...prev].filter((id) => here.has(id)))
          return next.size === prev.size ? prev : next
        })
      } catch (err) {
        if (seq !== loadSeq.current) return
        loudPending.current = false
        if (quiet) return
        refocus.current = false
        setRows(null)
        setError(kindOf(err))
      }
    },
    [page, limit, tab, status, period, query],
  )

  /**
   * LOUD when the query changed (the `load` identity moved), QUIET when only `version` did — a write
   * somewhere in the shell, a return to the tab, the bell opening.
   */
  const lastLoad = useRef<typeof load | null>(null)
  useEffect(() => {
    const quiet = lastLoad.current === load
    lastLoad.current = load
    void load(quiet)
  }, [load, version])

  /* Any change of page, size, tab, filter or committed search clears the selection (D-13). */
  useEffect(() => {
    setPicked((prev) => (prev.size === 0 ? prev : new Set()))
  }, [page, limit, tab, status, period, query])

  /* After a delete, once the new rows are on screen: the control that acted is gone. */
  useEffect(() => {
    if (!refocus.current || rows === null) return
    refocus.current = false
    cardRef.current?.focus({ preventScroll: true })
  }, [rows])

  /* ── Filters: every one goes back to page 1 ─────────────────────────────────────────────────── */
  const selectTab = (next: Tab) => {
    setTab(next)
    setPage(1)
  }
  const selectStatus = (next: ReadFilter) => {
    setStatus(next)
    setPage(1)
  }
  const selectPeriod = (next: PeriodFilter) => {
    setPeriod(next)
    setPage(1)
  }
  const selectLimit = (next: PageSize) => {
    setLimit(next)
    setPage(1)
  }
  /** Tab, both filters and the search — NOT the page size — then page 1 and the caret in the box. */
  const clearFilters = () => {
    setTab(null)
    setStatus('')
    setPeriod('')
    setTerm('')
    setQuery('')
    setPage(1)
    searchRef.current?.focus()
  }

  /* ── Selection (D-13) ───────────────────────────────────────────────────────────────────────── */
  const shown = rows ?? []
  const n = shown.filter((r) => picked.has(r.id)).length
  const allOn = n > 0 && n === shown.length
  const someOn = n > 0 && n < shown.length

  // `indeterminate` is a DOM property with no attribute, so React cannot render it. Without it the box
  // reads "nothing selected" while three rows below it sit highlighted — and the click that follows
  // selects everything instead of the clear a half-filled box promises.
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = someOn
  })

  const pick = (id: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  /* ── Per-row writes ─────────────────────────────────────────────────────────────────────────── */
  const once = async (id: string, task: () => Promise<unknown>) => {
    if (inFlight.current.has(id)) return
    inFlight.current.add(id)
    try {
      await task()
    } finally {
      inFlight.current.delete(id)
    }
  }

  const readOne = (r: AdminNotification) =>
    once(r.id, () => markRead(r.id).catch(() => toast('error', READ_FAIL)))

  const unreadOne = (r: AdminNotification) =>
    once(r.id, () => markUnread(r.id).catch(() => toast('error', UNREAD_FAIL)))

  /**
   * The row CTA (D-7/D-15): acting on a notification IS reading it. Marked read on the way out, NOT
   * awaited — SPA navigation does not cancel the request, and a failure toast survives the route
   * change because toasts are shell chrome.
   */
  const openRow = (r: AdminNotification, to: string) => {
    if (!r.isRead) void readOne(r)
    void navigate(to)
  }

  /* ── The ⋯ menu ─────────────────────────────────────────────────────────────────────────────── */
  const [menu, setMenu] = useState<{ id: string; anchor: HTMLButtonElement } | null>(null)
  const menuRow = menu ? (shown.find((r) => r.id === menu.id) ?? null) : null

  const openMenu = (r: AdminNotification, anchor: HTMLButtonElement) =>
    setMenu((m) => (m?.id === r.id ? null : { id: r.id, anchor }))

  const closeMenu = useCallback(
    (refocusKebab: boolean) => {
      if (refocusKebab) menu?.anchor.focus()
      setMenu(null)
    },
    [menu],
  )

  // The row it was open for left the page (a refetch after another tab's delete): close, never point
  // at a different notification.
  useEffect(() => {
    if (menu && !menuRow) setMenu(null)
  }, [menu, menuRow])

  /* ── Bulk and header writes ─────────────────────────────────────────────────────────────────── */
  const bulkRead = useBusy()
  const readAll = useBusy()

  /**
   * ALL the ticked ids, read ones included — so a selection that is entirely read answers
   * `updated: 0` rather than a 400 on an empty array. The toast counts what the SERVER changed.
   */
  const onBulkRead = () =>
    bulkRead.run(async () => {
      const ids = [...picked].filter((id) => shown.some((r) => r.id === id))
      if (ids.length === 0) return
      try {
        const updated = await markManyRead(ids)
        toast('success', `ทำเครื่องหมายว่าอ่านแล้ว ${updated} รายการ`)
        setLive(`ทำเครื่องหมายอ่านแล้ว ${updated} จาก ${ids.length} รายการที่เลือก`)
        setPicked(new Set())
        // The bulk buttons unmount with the selection; the select-all box is where the bar starts.
        allRef.current?.focus({ preventScroll: true })
      } catch {
        toast('error', READ_FAIL)
      }
    })

  /** Every visible unread row — every tab, every page — not just this page (AC-14). */
  const onReadAll = () =>
    readAll.run(async () => {
      try {
        const updated = await markManyRead()
        toast('success', `ทำเครื่องหมายว่าอ่านแล้ว ${updated} รายการ`)
        setLive(`ทำเครื่องหมายอ่านแล้ว ${updated} รายการ`)
        setPicked(new Set())
        // The button disables itself at 0 unread, and focus left on a disabled control drops a
        // keyboard user out of the page.
        cardRef.current?.focus({ preventScroll: true })
      } catch {
        toast('error', READ_FAIL)
      }
    })

  /* ── Delete: one confirm, three entry points (D-3) ──────────────────────────────────────────── */
  const [confirmOpen, setConfirmOpen] = useState(false)
  /** Kept after the dialog closes, so its words do not blank out during the close. */
  const [target, setTarget] = useState<DeleteTarget | null>(null)

  const askDelete = (t: DeleteTarget) => {
    setTarget(t)
    setConfirmOpen(true)
  }

  /**
   * ⚠️ A FAILURE LEAVES THE DIALOG OPEN, by simply not closing it — `ConfirmModal` closes only when
   * told to. It is NOT rethrown: `ConfirmModal` runs this under `void run(...)`, so a rethrow would
   * surface as an unhandled rejection in the console while changing nothing on screen.
   */
  const onConfirmDelete = async () => {
    if (!target) return
    const what = whatOf(target)
    try {
      const deleted = await dismiss(
        target.kind === 'purge' ? { allRead: true } : { ids: target.ids },
      )
      setConfirmOpen(false)
      if (target.kind === 'purge') {
        // The SERVER's count: another tab may have read or deleted rows since the probe ran.
        toast('success', `ลบการแจ้งเตือน ${deleted} รายการ แล้ว`)
        setLive(`ลบแล้ว ${deleted} รายการ`)
      } else {
        toast('success', `ลบ${what} แล้ว`)
        setLive(`ลบแล้ว ${target.ids.length} รายการ`)
      }
      setPicked(new Set())
      refocus.current = true
    } catch {
      toast('error', `ลบ${what} ไม่สำเร็จ — รายการยังอยู่ในระบบ ลองใหม่อีกครั้ง`)
    }
  }

  const unreadTotal = unread?.total ?? 0
  /** Nothing at all for this operator — a different fact from "nothing matches". */
  const systemEmpty = rows !== null && rows.length === 0 && !anyFilter

  return (
    <div className="card-shell">
      <PageHeading
        route={route}
        title="การแจ้งเตือน"
        trail={[
          { label: 'หน้าแรก', to: HOME_PATH },
          { label: 'การแจ้งเตือน' },
          { label: 'รายการแจ้งเตือนทั้งหมด' },
        ]}
        desc="คำขอจอง การลงทะเบียน ข้อเสนอแนะ และเหตุการณ์ของระบบทั้งหมดที่ต้องรับทราบหรือดำเนินการ"
        descAtEveryWidth={false}
        // Inside the <h1>: it is what the page is worth opening for, and a screen reader announcing
        // the heading gets both in one breath. Hidden at zero — and while not yet known.
        titleExtra={
          unreadTotal > 0 ? (
            <span className="nav-count nav-count-alert ml-2 inline-block align-middle">
              {unreadTotal} ยังไม่อ่าน
            </span>
          ) : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            {/* Disabled at zero rather than hidden: a toolbar that changes shape under the operator
                is worse than a dimmed button saying "this lives here, and there is none of it". */}
            <button
              type="button"
              onClick={() => void onReadAll()}
              className="btn-ghost2 disabled:pointer-events-none disabled:opacity-50"
              {...readAll.buttonProps('กำลังทำเครื่องหมายว่าอ่านแล้ว')}
              disabled={readAll.busy || unreadTotal === 0}
            >
              <Glyph d={ICON.checkCircle} className="h-4.5 w-4.5 shrink-0" />
              อ่านทั้งหมด
            </button>
            {/* EVERY read row the operator can see, across all tabs and pages — a page-header action
                means what the page means, not what a tab three elements away is filtering. */}
            <button
              type="button"
              onClick={() => askDelete({ kind: 'purge', count: readTotal ?? 0 })}
              className="btn-ghost2 disabled:pointer-events-none disabled:opacity-50"
              disabled={!readTotal}
            >
              <Glyph d={ICON.trash} className="h-4.5 w-4.5 shrink-0" />
              <span className="hidden sm:inline">ลบรายการที่อ่านแล้วทั้งหมด</span>
              <span className="sm:hidden">ลบที่อ่านแล้ว</span>
            </button>
          </div>
        }
      />

      {/* Mounted ONCE, above every panel: a live region is announced only if it already existed when
          the text arrived, and the list panel unmounts behind the skeleton. It reports BULK results,
          which have no other voice — the checkboxes already announce their own state. */}
      <p role="status" aria-live="polite" className="sr-only">
        {live}
      </p>

      <div
        ref={cardRef}
        tabIndex={-1}
        role="region"
        aria-label="รายการแจ้งเตือน"
        className="card-shell rounded-card border border-base-300/70 bg-base-100 shadow-e1 outline-none"
      >
        {/* ── หมวดหมู่ ── `mx-auto w-max` on the INNER track, never `justify-center` on the scroller:
            centring the scroller pushes the first tab past the left edge on a phone. */}
        <div className="shrink-0 border-b border-base-300 px-2 pt-2 sm:px-3 lg:px-4">
          <div className="nav-scroll flex overflow-x-auto pb-2">
            <div
              role="tablist"
              aria-label="กรองตามหมวดหมู่การแจ้งเตือน"
              className="mx-auto flex w-max items-center gap-1"
            >
              {TABS.map((t) => {
                const count = unread ? tabCount(unread, t.key) : null
                return (
                  <button
                    key={t.label}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.key}
                    onClick={() => selectTab(t.key)}
                    className="rq-tab"
                  >
                    <span>{t.label}</span>
                    {/* UNREAD, amber when there is work and neutral at a genuine 0; `—` until the
                        first count lands, never a fake 0. */}
                    <span
                      className={`rq-tab-n ${count ? 'rq-tab-n-amber' : 'rq-tab-n-slate'}`}
                    >
                      {count === null ? '—' : count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── ค้นหาและตัวกรอง ── search grows; two filters beside it, a 2-up grid on a phone. */}
        <div className="flex shrink-0 flex-col gap-2.5 border-b border-base-300 p-3 sm:gap-3 sm:p-4 lg:flex-row lg:items-center lg:p-5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-control border border-transparent bg-base-200 px-4 transition-all focus-within:border-primary/40 focus-within:bg-base-100 focus-within:ring-4 focus-within:ring-primary/10">
            <Glyph d={ICON.search} className="h-5 w-5 shrink-0 text-base-content/60" />
            {/* The placeholder is a PROMISE: the server searches the title, the body and the code. */}
            <label className="sr-only" htmlFor="nt-q">
              ค้นหาหัวเรื่อง ชื่อผู้ใช้ รหัสคำขอ หรือรายละเอียด
            </label>
            <input
              ref={searchRef}
              id="nt-q"
              type="search"
              maxLength={SEARCH_MAX}
              autoCorrect="on"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck
              enterKeyHint="search"
              placeholder="ค้นหาหัวเรื่อง ชื่อผู้ใช้ รหัสคำขอ หรือรายละเอียด"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="min-h-11 w-full min-w-0 border-none bg-transparent text-[15px] text-base-content/90 outline-none placeholder:text-base-content/70"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5 lg:flex lg:shrink-0">
            {/* `raised` by the brief (plan §9, OPEN-1). No `placeholder`: the resting caption is the
                "all" option, so a filter that is off SAYS it is off. */}
            <Combobox
              id="nt-read"
              label="สถานะการอ่าน"
              className={`min-w-0 ${LABEL_HIDDEN} lg:w-44`}
              options={READ_OPTIONS}
              value={status}
              onChange={selectStatus}
              searchable={false}
              raised
            />
            <Combobox
              id="nt-range"
              label="ช่วงเวลา"
              className={`min-w-0 ${LABEL_HIDDEN} lg:w-48`}
              options={PERIOD_OPTIONS}
              value={period}
              onChange={selectPeriod}
              searchable={false}
              raised
            />
          </div>
        </div>

        {error ? (
          <div className="card-shell">
            <LoadError kind={error} onRetry={() => void load(false)} />
          </div>
        ) : rows === null ? (
          <NotificationsSkeleton />
        ) : systemEmpty ? (
          <div className="card-shell">
            <Panel
              icon={ICON.bellSlash}
              title="ยังไม่มีการแจ้งเตือน"
              description="เมื่อมีคำขอจองเข้ามา มีผู้ลงทะเบียนรอการอนุมัติ มีผู้ส่งข้อเสนอแนะ หรือระบบพบปัญหาการเชื่อมต่อ รายการจะแสดงที่นี่ทันที"
              wide
            />
          </div>
        ) : (
          <div className="card-shell">
            {/* ── แถบเลือกหลายรายการ ── ALWAYS present: select-all needs a home before anything is
                ticked. What appears with a selection is the pair of bulk buttons and the tint. */}
            <div className={`nt-selbar ${n > 0 ? 'nt-selbar-on' : ''}`.trim()}>
              <label className="nt-pick">
                <input
                  ref={allRef}
                  type="checkbox"
                  className="sr-only"
                  checked={allOn}
                  disabled={shown.length === 0}
                  // Native behaviour takes an indeterminate box to CHECKED, which selects the page.
                  onChange={(e) =>
                    setPicked(e.target.checked ? new Set(shown.map((r) => r.id)) : new Set())
                  }
                />
                <span className="chk-box" aria-hidden="true">
                  <svg
                    data-chk-tick=""
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={ICON.tick} />
                  </svg>
                  <svg
                    data-chk-dash=""
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" d={ICON.dash} />
                  </svg>
                </span>
                <span className="sr-only">เลือกการแจ้งเตือนทั้งหมดในหน้านี้</span>
              </label>
              <p className="m-0 min-w-0 flex-1 text-[14px] text-base-content/70">
                {n > 0 ? `เลือก ${n} รายการ` : 'เลือกทั้งหมดในหน้านี้'}
              </p>
              {n > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    className="nt-cta"
                    onClick={() => void onBulkRead()}
                    {...bulkRead.buttonProps('กำลังทำเครื่องหมายว่าอ่านแล้ว')}
                  >
                    <Glyph d={ICON.envelopeOpen} />
                    <span className="hidden sm:inline">ทำเครื่องหมายว่าอ่านแล้ว</span>
                    <span className="sm:hidden">อ่านแล้ว</span>
                  </button>
                  <button
                    type="button"
                    className="nt-cta hover:border-error/40 hover:bg-error/10 hover:text-error"
                    onClick={() => {
                      const ids = shown.filter((r) => picked.has(r.id))
                      askDelete({
                        kind: 'rows',
                        ids: ids.map((r) => r.id),
                        title: ids.length === 1 ? ids[0].title : null,
                      })
                    }}
                  >
                    <Glyph d={ICON.trash} />
                    <span className="hidden sm:inline">ลบรายการที่เลือก</span>
                    <span className="sm:hidden">ลบ</span>
                  </button>
                </div>
              )}
            </div>

            <div className="card-scroll nav-scroll">
              {shown.length > 0 ? (
                <ul className="m-0 list-none divide-y divide-base-300/60 p-0">
                  {shown.map((r) => {
                    const to = actionTarget(r.actionUrl, acl.can)
                    return (
                      <NotificationRow
                        key={r.id}
                        item={r}
                        picked={picked.has(r.id)}
                        onPick={(on) => pick(r.id, on)}
                        ctaTarget={to}
                        onCta={() => {
                          if (to) openRow(r, to)
                        }}
                        onMenu={(el) => openMenu(r, el)}
                        onBodyClick={() => {
                          if (!r.isRead) void readOne(r)
                        }}
                        menuOpen={menu?.id === r.id}
                        menuId={MENU_ID}
                      />
                    )
                  })}
                </ul>
              ) : (
                /* A miss — FOUR inputs feed it (tab, search, read state, period), so the way out is
                   "clear all" rather than whichever one the operator happens to remember. */
                <Panel
                  icon={ICON.search}
                  title="ไม่พบการแจ้งเตือนที่ตรงกับเงื่อนไข"
                  description="ลองเปลี่ยนหมวดหมู่ คำค้นหา สถานะการอ่าน หรือช่วงเวลา แล้วดูอีกครั้ง"
                  actions={
                    <Btn variant="ghost" onClick={clearFilters}>
                      ล้างตัวกรองทั้งหมด
                    </Btn>
                  }
                />
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
              onPageSizeChange={(size) => selectLimit(size as PageSize)}
              ariaLabel="แบ่งหน้ารายการแจ้งเตือน"
            />
          </div>
        )}
      </div>

      {/* STAYS MOUNTED, closed rather than unrendered: removing an open <dialog> never fires `close`,
          and focus is left on <body>. */}
      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={onConfirmDelete}
        title="ยืนยันการลบการแจ้งเตือน"
        who={target ? whatOf(target) : undefined}
        description={DELETE_DESC}
        tone="danger"
        confirmLabel="ยืนยันการลบ"
        busyLabel="กำลังลบ…"
      />

      <RowMenu
        id={MENU_ID}
        row={menuRow}
        anchor={menu?.anchor ?? null}
        onClose={closeMenu}
        onToggleRead={(r) => void (r.isRead ? unreadOne(r) : readOne(r))}
        onDelete={(r) => askDelete({ kind: 'rows', ids: [r.id], title: r.title })}
      />
    </div>
  )
}

/**
 * The empty / no-match panel, in the prototype's own markup (6208–6222, 6262–6271): a glyph of the
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
  /** The whole-feed empty panel's longer sentence gets `max-w-md`; the miss panel keeps `sm`. */
  wide?: boolean
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-base-200">
        <Glyph d={icon} className="h-8 w-8 text-base-content/60" stroke={1.5} />
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
