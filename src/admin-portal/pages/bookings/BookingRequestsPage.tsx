/**
 * `คำขอจองสถานที่` — `/backend/bookings/requests`, `GET /api/v1/booking-requests`.
 *
 * The destination the whole product has been waiting for. P5 (submit) and P6 (self-cancel) on the
 * LINE side are live, so requests ARE arriving — and until this screen exists they sit at `PENDING`
 * forever, because nothing in the back office can answer one.
 *
 * ── ONE SCREEN, TWO JOBS ──
 * A separate `จองและล็อกเวลา` destination was dissolved into this one: "an operator books a venue
 * directly" and "an operator approves a request" are the same act minus the request. Two menu rows
 * for "a booking exists now" would make the operator choose a SCREEN before they have made a
 * DECISION. So the table holds both, and ONE column tells them apart — ผู้ขอจอง carries a source
 * chip, `LINE` or `เจ้าหน้าที่`. Nothing else in the row differs, because nothing else about them
 * does: both hold a venue, a set of slots, a purpose and a head count.
 *
 * ── 🔴 EVERY WRITE LIVES IN A DIALOG, AND THEY ARE NOT `ConfirmModal` ──
 * `#rq-detail-modal` is the hub: it is the only thing the table's one button opens, and อนุมัติ /
 * ปฏิเสธ / ยกเลิก exist ONLY in its footer. Each of the three carries a payload the shared confirm
 * dialog has no shape for — a LIST OF OTHER RECORDS this click rejects (ADR-001), a reason that is
 * delivered to the requester, a reason PLUS a scope — so each is its own dialog and the dialog IS
 * the confirm step. ⛔ Do not fold them back into `ConfirmModal` by adding three optional slots to
 * it; a version with an optional conflict list, an optional slot picker and an optional booking form
 * is four dialogs sharing a wrapper.
 *
 * ── 🔴 THE SECOND JOB: `สร้างคำจองสถานที่` ──
 * The header's primary button opens `BookingDirectCreateDialog`, which does NOT raise a request — it
 * writes an APPROVED booking with the caller as its own approver. It is the one dialog on this
 * screen that is not reached from the detail hub, because it is not about a record that exists yet.
 * ⚠️ IT IS A HIDE FOR A VIEWER, NEVER A DISABLED BUTTON: a greyed primary promises a capability that
 * role will never be granted. The same rule governs its copies in the two empty panels.
 *
 * ── Filtering, sorting and paging are ALL server-side ──
 * The same rule as การลงทะเบียน and เจ้าหน้าที่ระบบ, and here it is not cosmetic parity: the client
 * portal lists ONE person's bookings and can render them whole, while this table is the entire
 * school across every term, and the seed's nine rows are the smallest it will ever be. `status`,
 * `search`, `venueId`, `sort`, `page` and `limit` are query parameters; one page of rows is all this
 * component ever holds. ⛔ Never fetch the table and filter it in the browser.
 *
 * ⚠️ THE TAB COUNTS ARE THE SERVER'S, and they do NOT move when a tab is selected — `counts` is
 * computed with `search` and `venueId` applied but WITHOUT `status`. One fact, rendered once. Do not
 * "fix" a badge by counting `rows`: that would count the PAGE, and the page is ten of them.
 *
 * ── 🔴 THE LIVE LAYER (`ADMIN-REALTIME-BOOKINGS-1`) — one rule, taken from การลงทะเบียน ──
 *   Anything that would MOVE a row waits for a click.
 *   Anything that does not move a row happens immediately.
 *
 * This screen is why the rule matters more here than anywhere else: two operators can be looking at
 * the same queue, and ADR-001 means one of them approving a request REFUSES rows the other is
 * reading. So:
 *
 *  · `bookingRequest.created` → the bar (`มีคำขอใหม่ N รายการ`), never an insert. The one exception
 *    falls out of the rule instead of bending it: with an EMPTY, UNFILTERED table there is nothing
 *    to displace, so it loads at once — which is also the promise the inbox-zero panel already makes
 *    in as many words ("คำขอใหม่จากผู้ใช้ LINE จะขึ้นที่นี่ทันที").
 *  · `bookingRequest.updated` → the row is replaced IN PLACE and flashed. No reordering, no scroll
 *    jump, no removal — a row that has drifted out of the selected tab stays exactly where it was
 *    being read, and the bar counts it (`driftCount`) instead of moving it.
 *  · a dialog open on a record that just changed status is DISARMED, not closed. See `staleStatus`.
 *
 * ⚠️ THE TAB BADGES AND THE `แสดง x–y จาก z` LINE DO NOT MOVE LIVE, AND THAT IS THE RULE, NOT A GAP.
 * `counts`, `meta.total` and the rows all come out of ONE request, so there is no way to refresh a
 * badge without refreshing the rows underneath it — which is the move this screen defers. The bar is
 * what carries that news in the meantime, which is why it counts drift as well as arrivals. (The
 * SIDEBAR pill is different and does move on its own: it is a single number with no row attached to
 * it, fetched by its own request — `use-pending-bookings.ts`.)
 *
 * ⚠️ THE SOCKET IS THE SHELL'S. This page SUBSCRIBES (`useRealtimeEvents`); it must never open a
 * connection of its own, or the sidebar's คำขอจองสถานที่ pill would stop moving the moment the
 * operator navigated away — which is the entire reason the socket was hoisted in the first place.
 *
 * ⚠️ AND A VIEWER HAS NO SOCKET AT ALL. The `/admin` namespace refuses that role
 * (`REALTIME_ERRORS.forbidden`) while the LIST is readable by all three, so a VIEWER gets a screen
 * that is CORRECT AND STATIC: no bar, no flash, no offline chip, nothing that claims to be live.
 * That is a known, accepted limitation of the transport — identical to การลงทะเบียน's — and NOT a
 * bug to fix on this page. What would be a bug is a live-looking affordance rendered for them, so
 * every one of the controls below is behind news that only an event can produce.
 *
 * ── Three roles ──
 * A VIEWER reads this table, searches it, filters it, sorts it, pages through it, and opens any
 * record and reads all of it — and gets NO ACTION BAR AT ALL in the detail dialog, not disabled
 * buttons. Every write is `SUPER_ADMIN|ADMIN` on the server. ⚠️ None of what this file renders is
 * the boundary — the backend answers 403 whatever appears here.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ApiError,
  approveBookingRequest,
  cancelBookingRequest,
  createDirectBooking,
  getBookingRequest,
  listBookingRequests,
  rejectBookingRequest,
  type BookingRequestDetail,
  type BookingRequestLimit,
  type BookingRequestListItem,
  type BookingRequestSort,
  type BookingStatus,
  type BookingStatusCounts,
  type CreateDirectBookingBody,
} from '@/lib/api-client'
import { EmptyState } from '../../components/feedback/EmptyState'
import { LoadError, type LoadErrorKind } from '../../components/feedback/LoadError'
import { PageHeading } from '../../components/shell/PageHeading'
import { Btn } from '../../components/ui/Btn'
import { Combobox, type ComboboxOption } from '../../components/ui/Combobox'
import { Pagination } from '../../components/ui/Pagination'
import { BOOKING_STATUS_LABEL } from '../../labels'
import { useAcl } from '../../lib/use-acl'
import { useAuth } from '../../lib/auth-context'
import { useRealtimeEvents, useRealtimeStatus } from '../../lib/realtime-context'
import { useToast } from '../../lib/toast-context'
import { liveSlots } from './booking-detail'
import { BookingApproveDialog } from './components/BookingApproveDialog'
import { BookingCancelDialog } from './components/BookingCancelDialog'
import { BookingDetailDialog, type BookingAction } from './components/BookingDetailDialog'
import { BookingDirectCreateDialog } from './components/BookingDirectCreateDialog'
import { BookingRejectDialog } from './components/BookingRejectDialog'
import { Glyph } from './components/BookingGlyph'
import { ICON } from './components/booking-icons'
import { RequestCard } from './components/RequestCard'
import { RequestRow } from './components/RequestRow'
import { RequestStatusTabs, type StatusTab } from './components/RequestStatusTabs'
import { RequestsSkeleton } from './components/RequestsSkeleton'
import { useCreateOptions } from './use-create-options'
import { useVenueOptions } from './use-venue-options'
import type { AdminRoute } from '../../routes'

/**
 * ⚠️ THE THREE THE SERVER ACCEPTS, AND NOTHING ELSE. `limit` outside 10/20/50 is a 400 rather than
 * a silent clamp, because every row's ordinal is computed from the value that was SENT.
 */
const PAGE_SIZES: readonly BookingRequestLimit[] = [10, 20, 50]

/** The prototype's default, and it does not persist across visits — see the pager's own note. */
const DEFAULT_PAGE_SIZE: BookingRequestLimit = 10

/** `''` is "no venue filter", which is not a value the query may carry. */
const ALL_VENUES = ''

/**
 * The four orderings, in the prototype's order — which is NOT alphabetical and not grouped by axis.
 *
 * ⚠️ TWO AXES, AND THEY ANSWER DIFFERENT QUESTIONS. `วันที่ยื่นคำขอ` is "who has been waiting
 * longest" (the queue's own order, and the default). `วันจัดกิจกรรม` is "what happens soonest",
 * which is equally real: a request submitted this morning for TOMORROW is more urgent than one
 * submitted last week for December, and sorting by submission time buries it. That is the whole
 * reason `event-asc` carries the word `เร่งด่วน` on its label instead of leaving it to be inferred.
 */
const SORT_OPTIONS: readonly ComboboxOption<BookingRequestSort>[] = [
  { id: 'created-desc', name: 'วันที่ยื่นคำขอ (ใหม่ล่าสุดก่อน)' },
  { id: 'event-asc', name: 'วันจัดกิจกรรม (เร็วที่สุดก่อน - เร่งด่วน)' },
  { id: 'created-asc', name: 'วันที่ยื่นคำขอ (เก่าที่สุดก่อน)' },
  { id: 'event-desc', name: 'วันจัดกิจกรรม (ไกลที่สุดก่อน)' },
]

/**
 * The two toolbar comboboxes take a VISUALLY HIDDEN label.
 *
 * `Combobox` composes `Field`, which always renders a `.form-label` — correct inside a dialog, where
 * every control is a labelled field, and wrong in a filter bar, where the control's caption already
 * names it and a stacked label would break the row's alignment. The label element STAYS (it is the
 * accessible name, and `Combobox` points `aria-labelledby` at it); only its pixels go. Same
 * `[&>…]` idiom `Combobox` already uses on `.form-shell`.
 */
const LABEL_HIDDEN = '[&>.form-label]:sr-only'

/** `ApiError` → which of the three error panels. */
const kindOf = (err: unknown): LoadErrorKind => {
  const status = err instanceof ApiError ? err.status : 0
  if (status === 0) return 'network'
  if (status === 403) return 'forbidden'
  return 'server'
}

/**
 * WHICH DIALOG IS OPEN, as ONE value — never four booleans.
 *
 * ⚠️ EXACTLY ONE MAY BE OPEN AT A TIME, and a single state is what makes that structural rather
 * than a convention somebody has to remember. Two stacked `<dialog>`s paint `::backdrop` twice
 * (0.5 over 0.5 is 0.75 black) and on a phone leave two cards fighting for 375px.
 *
 * It is also what makes the hand-back SYNCHRONOUS. `detail → approve → dismiss` is one state
 * transition back to `'detail'`, taken on the click itself; hanging it off the dialog's `close`
 * event would make it wait on a queued task — instrumented at **1863ms** in the prototype's preview
 * embedding, which reads as a screen that lost the operator's record and then found it again.
 */
type DialogView = 'detail' | 'approve' | 'reject' | 'cancel' | null

/** The three views a write can be launched from. `detail` is the hub they all return to. */
const ACTION_VIEW: Record<BookingAction, Exclude<DialogView, 'detail' | null>> = {
  approve: 'approve',
  reject: 'reject',
  cancel: 'cancel',
}

/**
 * A write that did not land, and the operator's typed reason is still in the box.
 *
 * ⚠️ THE DIALOG STAYS OPEN FOR THIS ONE. Closing it would throw away what was typed to report a
 * failure that changed nothing — the prototype's own rule (`FAIL_MSG`, then `return` before
 * anything is closed).
 */
const WRITE_FAILED = 'บันทึกไม่สำเร็จ ยังไม่มีอะไรเปลี่ยนแปลง · ลองใหม่อีกครั้ง'

/**
 * …and the three that CLOSE it, because retrying the same payload cannot succeed: the record moved,
 * vanished, or the role is not allowed. Each one says what the system did about it, so nobody is
 * left wondering whether to press again.
 */
const MSG = {
  gone: 'ไม่พบคำขอนี้ในระบบแล้ว · ระบบดึงข้อมูลล่าสุดให้แล้ว',
  forbidden: 'บัญชีของคุณไม่มีสิทธิ์ดำเนินการนี้ · โปรดติดต่อผู้ดูแลระบบ',
} as const

/** The 409 for each write, in the operator's terms — "somebody else got there first". */
const CONFLICT: Record<BookingAction, string> = {
  approve: 'คำขอนี้ถูกพิจารณาไปแล้ว หรือช่วงเวลานี้ถูกจองไปก่อนหน้าแล้ว · ระบบดึงข้อมูลล่าสุดให้แล้ว',
  reject: 'คำขอนี้ไม่ได้อยู่ในสถานะรอพิจารณาแล้ว · ระบบดึงข้อมูลล่าสุดให้แล้ว',
  cancel: 'การจองนี้ไม่ได้อยู่ในสถานะที่ยกเลิกได้แล้ว · ระบบดึงข้อมูลล่าสุดให้แล้ว',
}

/**
 * 🔴 THE STALE-DIALOG BANNER — the sentence that makes disarming the action bar honest.
 *
 * The scenario it exists for is the ticket's own: two operators, one approves a request, and ADR-001
 * auto-rejects the overlapping one the other has open. Without this, that second operator presses
 * อนุมัติ on a record that is already REJECTED and gets a 409 they cannot explain; with it, the
 * buttons are greyed and this line is directly above them.
 *
 * ⚠️ IT NAMES NOBODY, and that is not squeamishness: `actor` IS on the payload, but nothing in this
 * portal has been designed to render "สมหญิง เปลี่ยนรายการนี้" yet — it is written up in
 * `NEEDS_DESIGN.md` rather than invented per screen. `เจ้าหน้าที่ท่านอื่น` is what we can say
 * truthfully today: every `bookingRequest.updated` comes from an operator's write (the LIFF app
 * raises requests, it does not decide them).
 *
 * ⚠️ AND IT SAYS WHAT TO DO NEXT. "This is out of date" with no way forward is a dead end; reopening
 * the record re-fetches it, which is one click and puts a live action bar back.
 */
const STALE_MSG = (label: string) =>
  `รายการนี้ถูกเปลี่ยนสถานะเป็น “${label}” โดยเจ้าหน้าที่ท่านอื่นแล้ว · ปิดหน้าต่างนี้แล้วเปิดใหม่เพื่อดูข้อมูลล่าสุด`

/**
 * The create dialog's two record-level failures.
 *
 * ⚠️ NEITHER CLOSES THE DIALOG. A booking form holds several minutes of typing, and both of these
 * are fixable inside it — a 409 by moving the dates, a 404 by picking another venue. Throwing the
 * form away to report a failure that changed nothing is the cost this screen refuses to charge.
 */
const CREATE = {
  conflict: 'ช่วงเวลานี้ถูกจองไปก่อนหน้าแล้ว · ยังไม่มีการบันทึกใด ๆ · เปลี่ยนวัน เวลา หรือสถานที่แล้วลองอีกครั้ง',
  venueGone: 'ไม่พบสถานที่นี้ในระบบแล้ว · ระบบดึงรายชื่อสถานที่ล่าสุดให้แล้ว · เลือกสถานที่อีกครั้ง',
} as const

export function BookingRequestsPage({ route }: { route: AdminRoute }) {
  const { user } = useAuth()
  const acl = useAcl(user!.role)
  const toast = useToast()

  const [rows, setRows] = useState<BookingRequestListItem[] | null>(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [counts, setCounts] = useState<BookingStatusCounts | null>(null)
  const [error, setError] = useState<LoadErrorKind | null>(null)
  const [live, setLive] = useState('')

  /**
   * ⚠️ `PENDING`, NOT `null`. The strip READS ทั้งหมด → รอพิจารณา → … (superset first, which is how
   * a filter row is read), but the screen OPENS on รอพิจารณา, because the queue is the job. Reading
   * order and default state are different questions.
   */
  const [status, setStatus] = useState<StatusTab>('PENDING')
  /** What is TYPED. `query` is what was last SENT — see the debounce below. */
  const [term, setTerm] = useState('')
  const [query, setQuery] = useState('')
  const [venueId, setVenueId] = useState<string>(ALL_VENUES)
  const [sort, setSort] = useState<BookingRequestSort>('created-desc')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState<BookingRequestLimit>(DEFAULT_PAGE_SIZE)

  /** Bumped by รีเฟรช, so the venue vocabulary is re-read with the rows rather than going stale. */
  const [reloadKey, setReloadKey] = useState(0)
  const venueOptions = useVenueOptions(reloadKey)

  /** The first load is not news; every load after it changed the table under the reader. */
  const announced = useRef(false)

  /* ── The live layer's three pieces of deferred news ─────────────────────────────────────────── */

  /**
   * Ids of requests CREATED since the last load. A set of ids rather than the records themselves,
   * because the catch-up is a refetch — the payloads are never spliced in, or a row would appear
   * that the filters above it exclude.
   *
   * ⚠️ IT COUNTS ARRIVALS, NOT MATCHES. With a search term typed or a tab selected, some of them may
   * not come back when the list reloads. Deciding otherwise would mean re-implementing the server's
   * four-field search in the browser to guess at it. An over-count says "your view is behind" one
   * time too often; an under-count hides work in an approval queue.
   */
  const [queued, setQueued] = useState<Set<string>>(() => new Set())
  /** Reconnected, and there is no replay: we know there was a gap and cannot know how big. */
  const [missed, setMissed] = useState(false)
  /** Rows to paint the 2.5s left rail on. */
  const [flashing, setFlashing] = useState<Set<string>>(() => new Set())

  const flashTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  /* 300ms after the last keystroke, not on every one — each one would otherwise be a request.
     Matches การลงทะเบียน exactly, because a search box that behaves differently per screen is a
     search box the operator has to learn twice. */
  useEffect(() => {
    const id = setTimeout(() => {
      setQuery(term.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(id)
  }, [term])

  /**
   * ⚠️ THE TAB IS NOT A FILTER FOR THIS PURPOSE, and the difference decides which empty panel the
   * operator gets. "No rows on รอพิจารณา with nothing typed" is INBOX ZERO and is good news; "no
   * rows with a search term" is a miss and needs a way out. Only the second one may offer
   * `ล้างตัวกรองทั้งหมด`, because the first would point at controls nobody touched.
   */
  const anyFilter = Boolean(query || venueId)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await listBookingRequests({
        page,
        limit,
        search: query || undefined,
        venueId: venueId || undefined,
        status: status ?? undefined,
        sort,
      })
      setRows(res.data)
      setTotal(res.meta.total)
      setTotalPages(res.meta.totalPages)
      setCounts(res.counts)
      // ⚠️ CLAMP BEFORE THE NEXT SLICE. Approving the last row on page 4 — or another operator
      // cancelling it — leaves that page empty while this one is still asking for it, and the
      // operator lands on a table that looks like somebody's write deleted everything. The server
      // answers `totalPages: 0` for an empty result, hence the floor of 1.
      if (res.meta.totalPages > 0 && page > res.meta.totalPages) setPage(res.meta.totalPages)
      if (announced.current) setLive(`แสดงผลแล้ว ${res.meta.total} รายการ`)
      announced.current = true
      return true
    } catch (err) {
      setRows(null)
      setError(kindOf(err))
      return false
    }
  }, [page, limit, query, venueId, status, sort])

  useEffect(() => {
    void load()
  }, [load])

  /** Everything the live layer was holding is answered by a fresh page of rows. */
  const clearNews = useCallback(() => {
    setQueued(new Set())
    setMissed(false)
  }, [])

  const refresh = async () => {
    setRows(null)
    clearNews()
    setReloadKey((k) => k + 1)
    if (await load()) toast('success', 'อัปเดตข้อมูลล่าสุดแล้ว')
  }

  /**
   * `โหลดข้อมูลล่าสุด` — deliberately the SAME sequence as รีเฟรช, skeleton first. The rows are about
   * to change, and a list that mutates in place while being read is what the deferral exists to
   * prevent; that applies to the catch-up too.
   *
   * ⚠️ NO TOAST. รีเฟรช is unprompted and its receipt confirms that the button did something; this
   * one was pressed BECAUSE the screen said there was news, and the news disappearing is the receipt.
   * `load` announces the new total to the live region on its own.
   */
  const catchUp = async () => {
    setRows(null)
    clearNews()
    setReloadKey((k) => k + 1)
    await load()
  }

  /* ── Every filter change goes back to page 1 ───────────────────────────────────────────────── */
  /**
   * ⚠️ INCLUDING THE SORT, and that is not an oversight about "re-ordering is not filtering": the
   * record you were looking at on page 3 of a `created-desc` list is somewhere else entirely in an
   * `event-asc` one, so staying put keeps the NUMBER and loses the PLACE. Page 1 is at least a place
   * that was asked for.
   */
  const selectTab = (next: StatusTab) => {
    setStatus(next)
    setPage(1)
  }
  const selectVenue = (next: string) => {
    setVenueId(next)
    setPage(1)
  }
  const selectSort = (next: BookingRequestSort) => {
    setSort(next)
    setPage(1)
  }
  const selectLimit = (next: BookingRequestLimit) => {
    setLimit(next)
    setPage(1)
  }
  const clearFilters = () => {
    setTerm('')
    setQuery('')
    setVenueId(ALL_VENUES)
    setPage(1)
  }

  /**
   * The venue filter's options: the "off" row FIRST and as a real choice, then every venue.
   *
   * ⚠️ THE RESTING CAPTION READS `ทุกสถานที่`, NOT "ค้นหาสถานที่" — the FILTER STATE, not a
   * description of the control. A filter that will not say it is off is a filter people forget is
   * on. That is why `ALL_VENUES` is an option rather than a placeholder.
   */
  const venueChoices = useMemo<ComboboxOption<string>[]>(
    () => [
      { id: ALL_VENUES, name: 'ทุกสถานที่' },
      ...(venueOptions.venues ?? []).map((v) => ({ id: v.id, name: v.name })),
    ],
    [venueOptions.venues],
  )

  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = (page - 1) * limit + (rows?.length ?? 0)
  const pages = Math.max(1, totalPages)

  /** Nothing at all in the system — a different fact from "nothing on this tab". */
  const systemEmpty = rows !== null && rows.length === 0 && !anyFilter && counts?.all === 0
  const miss = rows !== null && rows.length === 0 && anyFilter
  const tabEmpty = rows !== null && rows.length === 0 && !anyFilter && !systemEmpty

  /**
   * The miss panel NAMES the filters that are actually on. "ลองล้างตัวกรอง" does not say what to
   * undo — and the venue is named by its NAME, never its id, or the sentence becomes the rename bug
   * wearing a new hat.
   */
  const missBits: string[] = []
  if (query) missBits.push(`คำค้นหา “${query}”`)
  if (venueId) {
    missBits.push(`สถานที่ “${venueChoices.find((v) => v.id === venueId)?.name ?? ''}”`)
  }

  /* ── The dialogs ───────────────────────────────────────────────────────────────────────────────
     Four of them, and 🔴 EVERY WRITE ON THIS SCREEN GOES THROUGH THEM — the table deliberately
     offers no อนุมัติ / ปฏิเสธ / ยกเลิก, so reading the record is a precondition of acting on it.
     `BookingDetailDialog` is the hub; the other three are reached from its footer and hand back to
     it when dismissed. */

  const [view, setView] = useState<DialogView>(null)
  /** The ROW the stack was opened from — it carries the code before the detail fetch lands. */
  const [target, setTarget] = useState<BookingRequestListItem | null>(null)
  const [detail, setDetail] = useState<BookingRequestDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailFailed, setDetailFailed] = useState(false)
  /** A failed write, shown INSIDE the dialog that failed, next to the button that will retry it. */
  const [dialogAlert, setDialogAlert] = useState<string | null>(null)
  const [writing, setWriting] = useState(false)
  /**
   * 🔴 THE OPEN RECORD MOVED UNDER THE DIALOG — the status the socket says it now has.
   *
   * Non-null disarms every action in the stack (detail's footer AND whichever action dialog is up)
   * and puts `STALE_MSG` where the failure banner would go. ⚠️ IT DOES NOT CLOSE ANYTHING: shutting
   * a dialog in somebody's face loses whatever they had typed and tells them nothing about why.
   */
  const [staleStatus, setStaleStatus] = useState<BookingStatus | null>(null)

  /**
   * Which id the in-flight detail fetch belongs to.
   *
   * ⚠️ TWO ROWS OPENED QUICKLY IS A REAL SEQUENCE, not a hypothetical: the second fetch can land
   * first, and without this the dialog would show request A under request B's heading — with
   * an action bar wired to whichever one the state happened to hold.
   */
  const wanted = useRef<string | null>(null)

  /**
   * Where focus goes when the whole stack closes.
   *
   * ⚠️ `Modal` RESTORES ITS OWN OPENER AND THAT IS NOT ENOUGH HERE. After detail → approve → back,
   * the detail dialog's recorded opener is a button inside the (now closed) approve dialog, and
   * focusing a `display: none` element does nothing at all — a keyboard operator would be dropped on
   * `<body>`, mid-queue. This is captured once, from the click that opened the record, and spent
   * when `view` returns to `null`.
   */
  const anchor = useRef<HTMLElement | null>(null)

  const loadDetail = useCallback(async (id: string) => {
    wanted.current = id
    setDetailLoading(true)
    setDetailFailed(false)
    try {
      const res = await getBookingRequest(id)
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

  const openDetail = (request: BookingRequestListItem) => {
    const from = document.activeElement
    // `<body>` is an HTMLElement and is NOT an anchor — focusing it silently does nothing, which
    // looks exactly like having no restore at all. `null` is the honest answer. (Same rule `Modal`
    // records for its own opener.)
    anchor.current = from instanceof HTMLElement && from !== document.body ? from : null
    setTarget(request)
    // A previous record's data, a previous record's failure and a previous record's staleness are
    // not this one's. Reopening the SAME record clears it too — and correctly so: `loadDetail` is
    // about to re-read it, which is exactly what `STALE_MSG` told the operator to do.
    setDetail(null)
    setDetailFailed(false)
    setDialogAlert(null)
    setStaleStatus(null)
    setView('detail')
    void loadDetail(request.id)
  }

  /**
   * ⚠️ ESCAPE IS OWNED WHILE AN ACTION DIALOG IS UP, for the same reason the hand-back is taken on
   * the click: `preventDefault()` refuses the UA's own dismissal, and the state moves to `'detail'`
   * SYNCHRONOUSLY instead of waiting for a queued `close` event. React then closes this dialog and
   * opens the detail one in a single commit.
   *
   * The detail dialog is deliberately NOT in here — Escape there is an ordinary dismissal and the
   * platform's own path is exactly right for it.
   */
  useEffect(() => {
    if (view === null || view === 'detail') return
    const onKeyDown = (e: KeyboardEvent) => {
      // A write is in flight; nothing dismisses it. `Modal` refuses the UA's `cancel` too.
      if (e.key !== 'Escape' || writing) return
      e.preventDefault()
      e.stopPropagation()
      setView('detail')
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [view, writing])

  /**
   * The stack is closed — hand focus back to the control that opened it.
   *
   * ⚠️ IT RUNS AFTER THE DIALOG'S OWN CLOSE, because a parent's effects run after its children's, so
   * the platform's restore has already happened and this corrects it where it landed nowhere.
   * `Modal`'s later `close`-event restore cannot undo it: its anchor is either this same element or
   * an unfocusable one, and `focus()` on the latter is a no-op.
   */
  useEffect(() => {
    if (view !== null) return
    const back = anchor.current
    anchor.current = null
    if (back?.isConnected) back.focus()
  }, [view])

  /**
   * ⚠️ THE CLOSE HANDLERS ARE GUARDED BY THE CURRENT `view`, AND THEY MUST BE. `Modal` calls
   * `onClose` twice for a ✕ dismissal — once from the click, once from the dialog's own `close`
   * event — and it also fires when a dialog closes because ANOTHER one took over. Without the guard,
   * opening the approve dialog would immediately close it (detail's own close handler running with
   * the new view already committed).
   */
  const closeDetail = () => {
    if (view !== 'detail') return
    setView(null)
  }

  /** Dismissing an action = "not now" to the ACTION, never to the record. Back to the detail. */
  const backToDetail = (from: Exclude<DialogView, 'detail' | null>) => () => {
    if (view !== from) return
    setDialogAlert(null)
    setView('detail')
  }

  /* ── The three writes ──────────────────────────────────────────────────────────────────────── */

  /**
   * ⚠️ A SUCCESSFUL WRITE CLOSES THE STACK AND RE-READS THE TABLE. It does NOT patch the row in
   * place and it does not reopen the record: a partial cancel changes which spans a booking holds
   * and can turn the whole request `CANCELLED` — a ruling only the server makes — so the only
   * honest local copy is the one that has just been fetched again. Reopening a dialog onto a record
   * that just changed state also reads as the action having failed.
   */
  const finishWrite = async (message: string) => {
    setView(null)
    setDialogAlert(null)
    setStaleStatus(null)
    // The toast is itself a live region, so this is announced without a second copy in `live`.
    toast('success', message)
    await load()
  }

  const failWrite = async (err: unknown, kind: BookingAction) => {
    const status = err instanceof ApiError ? err.status : 0
    if (status === 404 || status === 409 || status === 403) {
      setView(null)
      setStaleStatus(null)
      toast('error', status === 403 ? MSG.forbidden : status === 404 ? MSG.gone : CONFLICT[kind])
      await load()
      return
    }
    // Everything else — offline, 400, 5xx — leaves the dialog open with what was typed in it.
    setDialogAlert(WRITE_FAILED)
  }

  const runApprove = async () => {
    if (!detail || writing) return
    setWriting(true)
    setDialogAlert(null)
    try {
      const res = await approveBookingRequest(detail.id)
      /* 🔴 THE SERVER'S LIST, NEVER THE DIALOG'S. `conflicts.pendingLosers` was read outside the
         deciding transaction and is a forecast; `autoRejected` is what actually happened, and the
         two differ the moment another operator moves one of those requests in between. Reporting
         the stale number would tell somebody that three people were refused when it was two. */
      const n = res.autoRejected.length
      await finishWrite(
        n > 0
          ? `อนุมัติคำขอ ${res.booking.code} แล้ว · ปฏิเสธคำขอที่เวลาชนกันอัตโนมัติ ${n} คำขอ`
          : `อนุมัติคำขอ ${res.booking.code} แล้ว`,
      )
    } catch (err) {
      await failWrite(err, 'approve')
    } finally {
      setWriting(false)
    }
  }

  const runReject = async (reason: string) => {
    if (!detail || writing) return
    setWriting(true)
    setDialogAlert(null)
    try {
      const res = await rejectBookingRequest(detail.id, reason)
      // ⚠️ NO "ระบบแจ้งผู้ขอจองทาง LINE เรียบร้อย" HERE. A receipt states what happened, and the LINE
      // push is a planned feature with no caller yet (`CLIENT-NOTIFY-1`). The reason does reach the
      // requester — on My Bookings — which is what the field's own hint describes.
      await finishWrite(`ปฏิเสธคำขอ ${res.code} แล้ว`)
    } catch (err) {
      await failWrite(err, 'reject')
    } finally {
      setWriting(false)
    }
  }

  /* ── สร้างคำจองสถานที่ ────────────────────────────────────────────────────────────────────────
     Deliberately NOT part of the `DialogView` stack above. Those four are one record's dialogs and
     hand back to each other; this one is opened from the header, is about no existing record, and
     has nothing to hand back to. Folding it into that union would make "which record is open"
     answerable with `null` in a way the other four never are. */

  const [createOpen, setCreateOpen] = useState(false)
  /** Bumped on every open, so the dialog's LINE-user and department lists are rebuilt rather than
   *  reused — the ALLOWED set changes on การลงทะเบียน while this screen sits open. */
  const [createOpenKey, setCreateOpenKey] = useState(0)
  const [createBusy, setCreateBusy] = useState(false)
  const [createAlert, setCreateAlert] = useState<string | null>(null)
  /** Bumped after a failed write, so the live banner re-asks instead of continuing to show the
   *  picture that was true before somebody else took the room. */
  const [createRecheck, setCreateRecheck] = useState(0)
  const createOptions = useCreateOptions(createOpenKey)

  const openCreate = () => {
    setCreateAlert(null)
    setCreateOpenKey((k) => k + 1)
    setCreateOpen(true)
  }

  const runCreate = async (body: CreateDirectBookingBody) => {
    if (createBusy) return
    setCreateBusy(true)
    setCreateAlert(null)
    try {
      const res = await createDirectBooking(body)
      setCreateOpen(false)
      /* 🔴 THE SERVER'S LIST, NEVER THE BANNER'S. `overlappingPendingRequests` was a forecast read
         outside the deciding transaction; `autoRejected` is what the transaction actually refused. */
      const n = res.autoRejected.length
      toast(
        'success',
        `สร้างการจอง ${res.booking.code} แล้ว (อนุมัติทันที)` +
          (n > 0 ? ` · ปฏิเสธคำขอที่เวลาชนกันอัตโนมัติ ${n} คำขอ` : ''),
      )
      /* The new booking is APPROVED and the operator is almost certainly standing on รอพิจารณา —
         landing them back on a tab that does not contain the thing they just made reads as the save
         having failed. ⚠️ ONE FETCH EITHER WAY: changing the tab or the page re-runs `load` through
         its own dependencies, so calling it here as well would put two requests in flight for two
         different queries and let the slower one win. */
      const moved = status !== 'APPROVED' || page !== 1
      setStatus('APPROVED')
      setPage(1)
      if (!moved) await load()
    } catch (err) {
      const code = err instanceof ApiError ? err.status : 0
      if (code === 403) {
        // The role changed under the operator. Retrying cannot succeed, so the form goes.
        setCreateOpen(false)
        toast('error', MSG.forbidden)
        return
      }
      setCreateAlert(
        code === 409
          ? CREATE.conflict
          : code === 404
            ? CREATE.venueGone
            : // A 400 is the server naming a value it refused — its own sentence beats a generic one.
              code === 400 && err instanceof ApiError
              ? err.message
              : WRITE_FAILED,
      )
      setCreateRecheck((k) => k + 1)
      // The venue vanished from under the picker; the list the dialog is reading is stale.
      if (code === 404) setReloadKey((k) => k + 1)
    } finally {
      setCreateBusy(false)
    }
  }

  const runCancel = async (reason: string, slotIds?: string[]) => {
    if (!detail || writing) return
    setWriting(true)
    setDialogAlert(null)
    try {
      const res = await cancelBookingRequest(detail.id, reason, slotIds)
      /* ⚠️ THE BRANCH IS ON THE RESPONSE'S STATUS, not on what was sent. Cancelling every remaining
         span turns the request `CANCELLED`, and that is the SERVER's ruling — inferring it from the
         tick boxes would be a second copy of a rule that already has an owner. */
      const left = liveSlots(res.slots).length
      await finishWrite(
        res.status === 'CANCELLED'
          ? `ยกเลิกการจอง ${res.code} แล้ว · ช่วงเวลานี้กลับมาว่างให้จองได้`
          : `ยกเลิก ${slotIds?.length ?? 0} ช่วงเวลาของ ${res.code} แล้ว · เหลือการจอง ${left} ช่วงเวลา`,
      )
    } catch (err) {
      await failWrite(err, 'cancel')
    } finally {
      setWriting(false)
    }
  }

  /* ── The live layer ────────────────────────────────────────────────────────────────────────────
     It sits HERE, after the dialog state and the writes, for one non-negotiable reason: the handlers
     read `rows`, `view`, `detail`, `target` and `writing` DIRECTLY, so every one of them has to be
     declared above. That is safe — and the only reason it is safe — because `useRealtimeEvents`
     holds the handlers in a ref that is re-pointed on every render while the socket is never
     re-subscribed. ⛔ Do not "optimise" them into `useCallback`s with dependency arrays: a handler
     closed over a stale `rows` would patch the page the operator was looking at three filters ago,
     and nothing would ever say so. */

  const flash = useCallback((id: string) => {
    setFlashing((s) => new Set(s).add(id))
    const timers = flashTimers.current
    clearTimeout(timers.get(id))
    timers.set(
      id,
      setTimeout(() => {
        timers.delete(id)
        setFlashing((s) => {
          const next = new Set(s)
          next.delete(id)
          return next
        })
      }, 2500),
    )
  }, [])

  // Every pending flash timer is cleared on unmount — a `setFlashing` after the page is gone is a
  // React warning at best and a leak at worst.
  useEffect(() => {
    const timers = flashTimers.current
    return () => {
      timers.forEach((t) => clearTimeout(t))
      timers.clear()
    }
  }, [])

  const realtime = useRealtimeStatus()

  useRealtimeEvents({
    onBookingCreated: (booking) => {
      /* THE EXCEPTION, and it falls out of the rule rather than bending it: with nothing on screen
         there is nothing to displace, so the queue appears at once instead of behind a button — and
         a bar reading "มีคำขอใหม่ 1 รายการ" over the words "ไม่มีคำขอรอพิจารณา" would be the screen
         arguing with itself.
         ⚠️ The TAB is deliberately NOT part of `anyFilter` here. A request that arrives APPROVED
         (another operator's direct booking) while รอพิจารณา is empty costs one wasted fetch and
         refreshes the tab badges, which is the honest picture; testing the tab instead would mean
         predicting what the server is about to return. Nothing is displaced either way. */
      if (rows !== null && rows.length === 0 && !anyFilter) {
        setLive('มีคำขอจองใหม่เข้ามา')
        void load()
        return
      }
      // Not spliced in: the catch-up re-runs the CURRENT query, so what appears is what the filters
      // above actually ask for.
      setQueued((s) => new Set(s).add(booking.id))
    },

    onBookingUpdated: (booking) => {
      /* IN PLACE, AND ONLY IF IT IS ON SCREEN. Replacing the row costs the reader nothing — same
         index, same height, a status chip that now says something else — and the rail says where to
         look. An event for one of the other ninety rows in the queue is deliberately SILENT: it is
         news the operator cannot see and cannot act on. */
      const onScreen = rows?.some((r) => r.id === booking.id) ?? false
      if (onScreen) {
        setRows((current) => current?.map((r) => (r.id === booking.id ? booking : r)) ?? current)
        flash(booking.id)
        setLive(`คำขอ ${booking.code} เปลี่ยนสถานะเป็น ${BOOKING_STATUS_LABEL[booking.status]}`)
      }

      /* 🔴 THE STALE-DIALOG GUARD — the whole reason this ticket exists.
         Three conditions, and each one earns its place:
          · the stack is OPEN on this id — `view === null` means there is nothing to disarm, and
            `target`/`detail` may still hold the last record read;
          · the STATUS actually differs from what the dialog is showing. A partial cancel leaves an
            APPROVED booking APPROVED and emits `updated` all the same; announcing "ถูกเปลี่ยนสถานะ
            เป็น อนุมัติแล้ว" to somebody already looking at อนุมัติแล้ว is a false alarm, and false
            alarms are how a real one stops being read. `detail` first, `target` as the fallback
            while the detail fetch is still in flight;
          · no write of OURS is in flight. Our own approve emits this event, and the emit usually
            beats the HTTP response back — without this the operator would watch their own click
            raise a banner accusing somebody else. A write already disables every button through
            `busy`, and its own 404/409/403 path re-reads the table and says what happened. */
      const openStatus = view === null ? null : (detail?.status ?? target?.status ?? null)
      const openId = view === null ? null : (detail?.id ?? target?.id ?? null)
      if (openId === booking.id && !writing && openStatus !== null && openStatus !== booking.status) {
        setStaleStatus(booking.status)
      }
    },

    /* There was a gap and the gateway has no replay, so the number of rows that changed during it is
       unknowable — which is why the bar's reconnect clause states no number. */
    onResync: () => setMissed(true),
  })

  /**
   * ⚠️ DRIFT IS DERIVED, NOT REMEMBERED, and that is what makes it self-correcting. A row that
   * changed OUT of the selected tab cannot be allowed to vanish — that moves every row under it —
   * but leaving it silent makes the tab strip look broken: รอพิจารณา is selected and a row plainly
   * reads "ปฏิเสธ". Since every load and every filter change re-asks the server, a row on screen that
   * contradicts the tab IS the whole definition, and there is no set to forget to clear.
   *
   * It matters more here than on การลงทะเบียน: ADR-001's losers drift out of รอพิจารณา in a burst,
   * without anybody on this screen having touched them.
   */
  const driftCount = useMemo(
    () => (status ? (rows ?? []).filter((r) => r.status !== status).length : 0),
    [rows, status],
  )

  /**
   * The bar's sentence, assembled from whatever is currently true.
   *
   * ⚠️ THE RECONNECT CLAUSE STATES NO NUMBER AND MUST NOT. The gateway has no replay and no
   * sequence, so "3 รายการ" after a gap would be a guess dressed as a fact. What we know is that
   * there WAS a gap.
   */
  const barParts: string[] = []
  if (queued.size) barParts.push(`มีคำขอใหม่ ${queued.size} รายการ`)
  if (driftCount) barParts.push(`มี ${driftCount} รายการที่ไม่ตรงกับแท็บนี้แล้ว`)
  if (missed) barParts.push('เชื่อมต่อใหม่แล้ว · ข้อมูลระหว่างที่ขาดการเชื่อมต่ออาจไม่ครบ')
  const barMessage = barParts.join(' · ')

  /**
   * What the four dialogs put in their alert slot.
   *
   * ⚠️ STALENESS OUTRANKS A FAILED WRITE, and the order is the point: while `staleStatus` is set the
   * confirm buttons are greyed, so if the older `WRITE_FAILED` were shown instead the operator would
   * be looking at a dead button next to a message telling them to try again. `dialogAlert` is not
   * lost — retrying is simply not the next move, reopening the record is, and that is what this
   * sentence says.
   */
  const dialogNotice =
    staleStatus !== null ? STALE_MSG(BOOKING_STATUS_LABEL[staleStatus]) : dialogAlert
  const stale = staleStatus !== null

  return (
    <div className="card-shell">
      <PageHeading
        route={route}
        desc="ตรวจสอบ อนุมัติ หรือปฏิเสธคำขอจองที่ส่งเข้ามา และสร้างการจองของเจ้าหน้าที่เอง"
        descAtEveryWidth={false}
        actions={
          <div className="flex items-center gap-2">
            {/* ══ อัปเดตอัตโนมัติหยุด ══
                The dangerous state on a live page is not "disconnected" — it is being disconnected
                AND NOT KNOWING, because the rows still look authoritative. This says the automatic
                half stopped; รีเฟรช beside it still fetches perfectly good data, which is why it is
                a quiet grey chip and not a red banner. Nothing is broken; one convenience is.
                ⚠️ `offline` ONLY. `disabled` — a VIEWER, or the `VITE_WS_ENABLED` rollback — renders
                NOTHING: warning somebody that live updates stopped, when their role was never going
                to be issued a socket, is a warning they can do nothing about, and it is the one
                thing that would make a correct static screen look broken.
                Same chip, same copy and same rule as การลงทะเบียน — two live tables, one vocabulary. */}
            {realtime === 'offline' && (
              <span
                aria-live="polite"
                data-tip="ข้อมูลจะไม่อัปเดตเองจนกว่าจะเชื่อมต่อได้อีกครั้ง · กดรีเฟรชเพื่อดึงข้อมูลล่าสุด"
                data-tip-pos="bottom"
                className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-control border border-base-content/20 bg-base-200 px-2.5 text-[13px] font-medium text-base-content/70"
              >
                <Glyph d={ICON.offline} className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">อัปเดตอัตโนมัติหยุด</span>
                <span className="sm:hidden">ออฟไลน์</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => void refresh()}
              aria-label="รีเฟรช"
              data-tip="รีเฟรช"
              data-tip-pos="bottom"
              className="flex min-h-11 items-center gap-2 rounded-control border border-base-content/20 bg-base-100 px-3 text-[14px] font-medium text-base-content/80 transition-colors hover:border-info/40 hover:bg-info/10 hover:text-info focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-4"
            >
              <Glyph d={ICON.refresh} />
              <span className="hidden sm:inline">รีเฟรช</span>
            </button>
            {/* ⚠️ ABSENT FOR A VIEWER, NOT DISABLED — see the file header. Also note what is NOT on
                the label: the "(เจ้าหน้าที่)" qualifier came off (PO), because everything raised
                from this screen is raised by staff by definition, and the dialog's own footer states
                the fact that qualifier was reaching for — that the booking lands APPROVED rather
                than queued. One label at one width; the phone gets no shortened variant, because the
                short one was the ambiguous one. */}
            {acl.write && (
              <Btn variant="primary" onClick={openCreate}>
                <Glyph d={ICON.plus} className="h-4.5 w-4.5 shrink-0" />
                <span>สร้างคำจองสถานที่</span>
              </Btn>
            )}
          </div>
        }
      />

      {/* ⚠️ MOUNTED ONCE, ABOVE EVERY PANEL, AND IT MUST BE. An assistive technology announces a
          live region only if the region ALREADY EXISTED when the text arrived — the same rule
          `FormField` records for its error paragraph. Inside the list panel this would unmount on
          every skeleton and come back carrying its message, i.e. silently. The table changing under
          a reader after a filter change is exactly what this exists to say. */}
      <p role="status" aria-live="polite" className="sr-only">
        {live}
      </p>

      <div className="card-shell rounded-card border border-base-300/70 bg-base-100 shadow-e1">
        <RequestStatusTabs active={status} counts={counts} onSelect={selectTab} />

        {/* Toolbar — pinned. Filters that scroll away are filters you cannot correct without first
            scrolling back to them. Two controls and a tab strip, not four filters: there is
            deliberately NO date filter, because a question about a date is a question about a
            calendar, and ปฏิทินการจอง is that screen. This one is a queue. */}
        <div className="flex shrink-0 flex-col gap-2.5 border-b border-base-300 p-3 sm:gap-3 sm:p-4 lg:flex-row lg:items-center lg:p-5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-control border border-transparent bg-base-200 px-4 transition-all focus-within:border-primary/40 focus-within:bg-base-100 focus-within:ring-4 focus-within:ring-primary/10">
            <Glyph d={ICON.search} className="h-5 w-5 shrink-0 text-base-content/60" />
            {/* ⚠️ The placeholder is a PROMISE about what this box searches, so it names every field
                the server actually reads. It reads four. */}
            <label className="sr-only" htmlFor="rq-q">
              ค้นหารหัสคำขอ ชื่อผู้ขอจอง สถานที่ หรือวัตถุประสงค์
            </label>
            <input
              id="rq-q"
              type="search"
              autoCorrect="on"
              autoCapitalize="none"
              spellCheck
              enterKeyHint="search"
              placeholder="ค้นหารหัสคำขอ ชื่อผู้ขอจอง สถานที่ หรือวัตถุประสงค์"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="min-h-11 w-full min-w-0 border-none bg-transparent text-[15px] text-base-content/90 outline-none placeholder:text-base-content/70"
            />
          </div>

          {/* ⚠️ A SEARCHABLE COMBOBOX, NOT A <select> (PO). Nine venues fit in a dropdown; a school
              that grows to forty does not, and a native select has no way in but scrolling — the
              operator knows the name and cannot type it. Same component the two personnel fields on
              การลงทะเบียน use. */}
          <Combobox
            id="rq-venue-f"
            className={`min-w-0 ${LABEL_HIDDEN} lg:w-64`}
            label="กรองตามสถานที่"
            options={venueChoices}
            value={venueId}
            onChange={selectVenue}
            // Loading and failure both have to SAY so: a filter that silently offers one row would
            // read as a school with one venue. `error` is set only when the list has never arrived.
            disabled={venueOptions.venues === null}
            error={venueOptions.error ?? undefined}
          />

          {/* ── เรียงลำดับ ──
              THE SAME COMPONENT as the venue field beside it, minus the search box. A native
              <select> here was the one control in this toolbar that rendered in the operating
              system's own widget: different height, different radius, a platform chevron, and on
              Windows a white popup with no rounded corners sitting under two controls that had just
              agreed on all four. */}
          <Combobox
            id="rq-sort"
            className={`min-w-0 ${LABEL_HIDDEN} lg:w-64`}
            label="เรียงลำดับ"
            options={SORT_OPTIONS}
            value={sort}
            onChange={selectSort}
            searchable={false}
            icon={<Glyph d={ICON.sort} className="h-4 w-4 shrink-0 text-base-content/60" />}
          />
        </div>

        {error ? (
          <div className="card-shell">
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
              <LoadError kind={error} onRetry={() => void load()} />
            </div>
          </div>
        ) : rows === null ? (
          <RequestsSkeleton actionsLabel={acl.actionsColumnLabel} />
        ) : systemEmpty ? (
          /* The whole table is empty, which is a different fact from "this tab has nothing in it".
             The copy already said an operator can raise a booking without waiting for a request;
             now the button that does it sits under the sentence, as the prototype has it.
             ⚠️ A VIEWER GETS รีเฟรช INSTEAD, not a greyed create: the prototype leaves that panel
             with no action at all for that role, and an empty screen with nothing to press reads as
             broken rather than as read-only. รีเฟรช is honest — the rows arrive from LINE. */
          <div className="card-shell">
            <EmptyState
              icon={<Glyph d={ICON.clipboard} className="h-8 w-8" />}
              title="ยังไม่มีคำขอจองในระบบ"
              description="เมื่อผู้ใช้ส่งคำขอจองผ่าน LINE คำขอจะเข้ามาที่หน้านี้ · เจ้าหน้าที่สร้างการจองเองได้โดยไม่ต้องรอคำขอ"
              actions={
                acl.write ? (
                  <Btn variant="primary" onClick={openCreate}>
                    <Glyph d={ICON.plus} className="h-4.5 w-4.5 shrink-0" />
                    สร้างคำจองสถานที่
                  </Btn>
                ) : (
                  <Btn variant="primary" onClick={() => void refresh()}>
                    <Glyph d={ICON.refresh} />
                    รีเฟรชข้อมูล
                  </Btn>
                )
              }
            />
          </div>
        ) : (
          <div className="card-shell">
            {/* ══ แถบข้อมูลใหม่ — the one place this list may interrupt ══
                THE BAR IS THE BUTTON, and that is measured on การลงทะเบียน: as a strip with a button
                inside it, it stood 65px and pushed every row down by that much the first time it
                appeared. A notice that moves five rows in order to promise that rows will not move is
                self-defeating. Collapsed into one full-width target it is 44px, and the 44px IS the
                bar.
                It sits INSIDE the list panel and above the scroller, so it never scrolls away from
                the rows it describes — and it is inside the branch that has rows or a filter miss,
                so it can never appear over "ยังไม่มีคำขอจองในระบบ", which loads at once instead. */}
            {barMessage && (
              <button
                type="button"
                onClick={() => void catchUp()}
                className="flex min-h-11 w-full shrink-0 items-center gap-2.5 border-b border-info/35 bg-info/10 px-3 py-2 text-left text-[14px] leading-[1.55] text-info transition-colors hover:bg-info/20 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-info sm:px-4"
              >
                <Glyph d={ICON.info} className="h-5 w-5 shrink-0" />
                <span className="min-w-0 flex-1">{barMessage}</span>
                <span className="shrink-0 font-medium underline underline-offset-2">
                  โหลดข้อมูลล่าสุด
                </span>
              </button>
            )}

            <div className="card-scroll nav-scroll">
              {miss ? (
                <EmptyState
                  icon={<Glyph d={ICON.search} className="h-8 w-8" />}
                  title="ไม่พบคำขอที่ตรงกับเงื่อนไข"
                  description={`ไม่มีคำขอในแท็บนี้ที่ตรงกับ ${missBits.join(' · ')} — ลองลดตัวกรองลง หรือดูแท็บ “ทั้งหมด”`}
                  actions={
                    <Btn variant="ghost" onClick={clearFilters}>
                      ล้างตัวกรองทั้งหมด
                    </Btn>
                  }
                />
              ) : tabEmpty ? (
                /* INBOX ZERO on the tab the screen opens on is GOOD NEWS, and it gets its own words
                   and its own icon. Offering "ล้างตัวกรองทั้งหมด" under it would point at controls
                   nobody touched. */
                <EmptyState
                  icon={<Glyph d={ICON.check} className="h-8 w-8" />}
                  title={
                    status === 'PENDING'
                      ? 'ไม่มีคำขอรอพิจารณา'
                      : `ยังไม่มีคำขอในสถานะ “${status ? BOOKING_STATUS_LABEL[status] : 'ทั้งหมด'}”`
                  }
                  description={
                    status === 'PENDING'
                      ? 'ทุกคำขอที่ส่งเข้ามาได้รับคำตอบแล้ว · คำขอใหม่จากผู้ใช้ LINE จะขึ้นที่นี่ทันที'
                      : 'ลองดูแท็บอื่น หรือสร้างการจองของเจ้าหน้าที่เอง'
                  }
                  /* The prototype's `data-rq-blank` carries the same `data-write-only` create button
                     the header does. It is the one action that makes sense here: the copy above ends
                     by offering it, and there are no filters to clear. */
                  actions={
                    acl.write ? (
                      <Btn variant="primary" onClick={openCreate}>
                        <Glyph d={ICON.plus} className="h-4.5 w-4.5 shrink-0" />
                        สร้างคำจองสถานที่
                      </Btn>
                    ) : undefined
                  }
                />
              ) : (
                /* ⚠️ TWO SIBLINGS, EACH OWNING ONE FACT. The breakpoint is carried by these CLASSES
                   (`hidden lg:block` / `lg:hidden`); EMPTINESS is carried by the branch above. In
                   the prototype both jobs briefly shared one `hidden`, and toggling it to show rows
                   also turned the eight-column table on at 375px, where it measured 1064px inside an
                   839px card. Never put a `hidden` prop on an element that already has a
                   breakpoint's `hidden` class. */
                <>
                  <div className="hidden lg:block">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr>
                          <th scope="col" className="th-cell th-cell-tight w-14 text-center">
                            ลำดับ
                          </th>
                          <th scope="col" className="th-cell th-cell-tight whitespace-nowrap">
                            รหัสคำขอ
                          </th>
                          <th scope="col" className="th-cell th-cell-tight whitespace-nowrap">
                            วันที่ยื่น
                          </th>
                          <th scope="col" className="th-cell th-cell-tight">
                            ผู้ขอจอง
                          </th>
                          <th scope="col" className="th-cell th-cell-tight">
                            สถานที่
                          </th>
                          <th scope="col" className="th-cell th-cell-tight">
                            วัน-เวลาใช้งาน
                          </th>
                          <th scope="col" className="th-cell th-cell-tight text-center">
                            สถานะ
                          </th>
                          <th
                            scope="col"
                            data-col="actions"
                            className="th-cell th-cell-tight text-center"
                          >
                            {/* ดูข้อมูล for a VIEWER: the column holds exactly one thing and that
                                thing opens a record, so a header still reading "จัดการ" would claim
                                a capability the role does not have. */}
                            {acl.actionsColumnLabel}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <RequestRow
                            key={r.id}
                            request={r}
                            index={from + i}
                            flash={flashing.has(r.id)}
                            onView={() => openDetail(r)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <ul className="m-0 list-none divide-y divide-base-300/60 p-0 lg:hidden">
                    {rows.map((r) => (
                      <RequestCard
                        key={r.id}
                        request={r}
                        flash={flashing.has(r.id)}
                        onView={() => openDetail(r)}
                      />
                    ))}
                  </ul>
                </>
              )}
            </div>

            {/* ── Pager ──
                OUTSIDE `.card-scroll` and inside `.card-shell`, exactly where การลงทะเบียน and
                เจ้าหน้าที่ระบบ put theirs: a pager that scrolls away with the rows is a pager you
                have to scroll back to the bottom to reach, on the one screen whose job is moving
                between pages. */}
            <div className="flex shrink-0 flex-col items-center gap-3 border-t border-base-300 p-4 lg:flex-row lg:justify-between lg:px-5">
              {/* The RANGE is what is on screen; the TOTAL is what the FILTER matched, not what the
                  table holds. Printing the latter would have this bar contradict the tab strip. */}
              <p className="order-1 text-[14px] text-base-content/70 lg:order-none">
                แสดง{' '}
                <span className="font-medium text-base-content/90 tabular-nums">
                  {total === 0 ? '0' : `${from}–${to}`}
                </span>{' '}
                จากทั้งหมด{' '}
                <span className="font-medium text-base-content/90 tabular-nums">{total}</span>{' '}
                รายการ
                {/* A REMINDER, so it is absent while you are already standing on the pending tab —
                    restating the number you are looking at is noise. */}
                {status !== 'PENDING' && counts !== null && counts.pending > 0 && (
                  <>
                    {' · '}รอพิจารณา{' '}
                    <span className="font-medium text-warning tabular-nums">{counts.pending}</span>{' '}
                    รายการ
                  </>
                )}
              </p>

              {/* Order-2 on a phone so the numbers sit above the buttons: the summary is what you
                  read, the buttons are what you reach for, and the reach should be nearest the
                  thumb. */}
              {pages > 1 && (
                <div className="order-3 lg:order-none">
                  <Pagination
                    page={page}
                    pages={pages}
                    onGo={setPage}
                    label="แบ่งหน้ารายการคำขอจอง"
                    long
                  />
                </div>
              )}

              <label className="order-2 flex items-center gap-2 text-[14px] text-base-content/70 lg:order-none">
                <span className="shrink-0">แถวต่อหน้า</span>
                <span className="form-shell relative">
                  {/* 44px like every other control here. It was `min-h-9` to keep the bar visually
                      light and measured 36px — under the minimum, on a control that sits between two
                      rows of 44px buttons. `.form-select` carries the floor. */}
                  <select
                    aria-label="จำนวนแถวต่อหน้า"
                    value={limit}
                    onChange={(e) => selectLimit(Number(e.target.value) as BookingRequestLimit)}
                    className="form-select w-[4.5rem] pl-1 text-[14px] tabular-nums"
                  >
                    {PAGE_SIZES.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <Glyph
                    d={ICON.caret}
                    className="pointer-events-none absolute right-2 h-4 w-4 text-base-content/70"
                  />
                </span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* ── The four dialogs ────────────────────────────────────────────────────────────────────
          ⚠️ ALL FOUR STAY MOUNTED, closed rather than unrendered. A caller that stops rendering an
          open `<dialog>` removes the node without ever closing it, so `close` never fires and focus
          is left on `<body>` — the rule `Modal` states from the other side.

          ⚠️ THE DETAIL DIALOG IS FIRST, AND THE ORDER IS LOAD-BEARING. Effects run in child order,
          so on `approve → detail` the detail is shown BEFORE the approve dialog closes — which lets
          the platform's own restore put focus back on the อนุมัติคำขอ button that opened it. With
          the order reversed, focus lands on `<body>` in between. */}
      <BookingDetailDialog
        open={view === 'detail'}
        onClose={closeDetail}
        row={target}
        detail={detail}
        loading={detailLoading}
        failed={detailFailed}
        onRetry={() => {
          if (target) void loadDetail(target.id)
        }}
        // A VIEWER reads every field here and gets NO action bar — not disabled buttons.
        canWrite={acl.write}
        // The prototype's `#rq-d-alert`: the place a record-level message goes. It carries the
        // three action dialogs' failures and — outranking them — the realtime staleness banner,
        // which is the sentence that explains the greyed buttons below it.
        alert={dialogNotice}
        stale={stale}
        onAction={(action) => {
          // Guarded again, and not redundantly: the disabled attribute is UX, the server is the
          // boundary, and this is the one line that keeps a keyboard or a stray event from
          // launching an action dialog onto a record we already know has moved.
          if (!detail || stale) return
          setDialogAlert(null)
          setView(ACTION_VIEW[action])
        }}
      />

      {/* ⚠️ ALL THREE GET `stale`, not just the detail hub. The operator can be standing INSIDE the
          approve dialog when ADR-001 refuses their request out from under them — that is the exact
          scenario this ticket names — and the footer they are reaching for is the one in here. */}
      <BookingApproveDialog
        open={view === 'approve'}
        onClose={backToDetail('approve')}
        detail={detail}
        alert={dialogNotice}
        busy={writing}
        stale={stale}
        onConfirm={() => void runApprove()}
      />

      <BookingRejectDialog
        open={view === 'reject'}
        onClose={backToDetail('reject')}
        detail={detail}
        alert={dialogNotice}
        busy={writing}
        stale={stale}
        onConfirm={(reason) => void runReject(reason)}
      />

      <BookingCancelDialog
        open={view === 'cancel'}
        onClose={backToDetail('cancel')}
        detail={detail}
        alert={dialogNotice}
        busy={writing}
        stale={stale}
        onConfirm={(reason, slotIds) => void runCancel(reason, slotIds)}
      />

      {/* The fifth dialog, and the only one that is not about a record that already exists. It reads
          the SAME venue list the toolbar filter does (`useVenueOptions`) rather than fetching its
          own: one vocabulary, so a venue renamed on สถานที่จัดกิจกรรม cannot be called two things on
          one screen — and its capacity is read live from that array on every render, never captured
          when the operator picked it. */}
      <BookingDirectCreateDialog
        open={createOpen}
        onClose={() => {
          if (createBusy) return
          setCreateOpen(false)
        }}
        venues={venueOptions.venues}
        venuesError={venueOptions.error}
        users={createOptions.users}
        usersError={createOptions.usersError}
        usersTruncated={createOptions.usersTruncated}
        departments={createOptions.departments}
        departmentsError={createOptions.departmentsError}
        alert={createAlert}
        busy={createBusy}
        recheckKey={createRecheck}
        onSubmit={(body) => void runCreate(body)}
      />
    </div>
  )
}
