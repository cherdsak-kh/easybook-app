/**
 * `ปฏิทินการจอง` — `/backend/bookings/calendar`, `GET /api/v1/booking-requests/calendar`.
 *
 * The requests queue answers "what needs my decision". This screen answers "what is happening on a
 * given day, in which room, and does anything collide". Design authority: the prototype's
 * `[data-route="calendar"]`, `#cal-item-tpl` and its calendar module. Plan:
 * `claude_planning/feature/20260921_1800_admin_booking_calendar/01_plan_log.md`.
 *
 * ── TWO PIECES OF STATE, NOT ONE (PO) ──
 * `month` is what the grid shows. `sel` is what the agenda shows. `‹` / `›` move only the first, so
 * an operator reading 17 ก.ย. can page ahead to check November and the agenda stays on 17 ก.ย.
 * `sel` changes only on a day click, an arrow key, or วันนี้, and each of those also brings the
 * grid to the selected day's month.
 *
 * ── 🔴 THE FILTERS ARE APPLIED HERE, NEVER SENT ──
 * The fetch is the visible grid window with NO `status` and NO `venueId`. The two comboboxes filter
 * in the browser. That is not laziness. A clash is a fact about the ROOM, and the clash banner on a
 * PENDING card has to see the APPROVED booking the status filter is hiding (prototype
 * `entries().all`, plan F13/F17/D6). The window is at most 42 days of one school's bookings.
 *
 * ── The window ──
 * Grid first cell 00:00 Bangkok → the day after the last cell, 00:00 Bangkok, so the padding days
 * show their bookings too. When the selected day is paged out of the grid, it gets a one-day fetch
 * of its own, so the agenda never goes blank while the operator browses. A response for a window
 * the screen has moved on from is discarded (`useCalendarSlots`' `seq`).
 *
 * ── Two views of the selected day ──
 * ไทม์ไลน์ (the default, `CalendarTimeline`: venues × 24 hours) or รายการ (the agenda of
 * `CalendarItem` cards). Both draw the same filtered slots, and both take clashes from the same
 * unfiltered pool. An APPROVED slot is never flagged in either (PO, `clashLabel`).
 *
 * ── 🔴 EVERY WRITE IS THE REQUESTS SCREEN'S DIALOGS ──
 * A card opens `BookingDetailDialog`. Its footer chains to approve / reject / cancel exactly as on
 * คำขอจองสถานที่, and the header's create button opens `BookingDirectCreateDialog`. Nothing about
 * those writes is re-implemented here. What IS repeated is the orchestration, the state machine
 * that `BookingRequestsPage` keeps inline: one `DialogView`, the synchronous hand-back to the
 * detail, the focus anchor, the stale-status guard, and the same sentences. It is a copy rather than
 * a shared hook on purpose. Extracting it would edit a live, untested screen that the plan requires
 * to stay byte-for-byte the same. A successful write REFETCHES the window. It never patches it,
 * because a partial cancel or an ADR-001 auto-reject changes rows only the server can name.
 *
 * ── Live ──
 * `bookingRequest.created` / `.updated` (and a reconnect) refetch the window, coalesced, so the burst
 * one approval emits (the subject plus every auto-rejected loser) is one request, not N. A VIEWER has
 * no socket at all (the gateway refuses that role). Their calendar is correct and static, the same
 * accepted limit as the queue.
 *
 * ── Three roles ──
 * A VIEWER gets the whole calendar, both filters and every record read-only. There is no create
 * button and no divider: they are ABSENT, not hidden with `data-write-only` (which loses to display
 * utilities) and not disabled. ⚠️ None of this is the boundary. The server answers 403 regardless.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ApiError,
  approveBookingRequest,
  cancelBookingRequest,
  createDirectBooking,
  getBookingCalendar,
  getBookingRequest,
  rejectBookingRequest,
  type BookingRequestDetail,
  type BookingStatus,
  type CalendarBookingSlot,
  type CreateDirectBookingBody,
} from '@/lib/api-client'
import { LoadError, type LoadErrorKind } from '../../components/feedback/LoadError'
import { Skeleton, SkeletonRegion } from '../../components/feedback/Skeleton'
import { PageHeading } from '../../components/shell/PageHeading'
import { Btn } from '../../components/ui/Btn'
import { Combobox, type ComboboxOption } from '../../components/ui/Combobox'
import { BOOKING_STATUS_LABEL } from '../../labels'
import { useAcl } from '../../lib/use-acl'
import { useAuth } from '../../lib/auth-context'
import { useRealtimeEvents } from '../../lib/realtime-context'
import { useToast } from '../../lib/toast-context'
import { liveSlots } from './booking-detail'
import {
  TH_DAYS_SHORT,
  addDays,
  bangkokToday,
  byDate,
  clashesOf,
  dayWindow,
  matchesFilter,
  monthGrid,
  monthOf,
  shiftMonth,
  shiftMonthClamped,
  tally,
  thaiDayLong,
  thaiMonthLong,
  weekday,
  type CalendarFilter,
  type DayWindow,
  type MonthView,
} from './calendar-model'
import { BookingApproveDialog } from './components/BookingApproveDialog'
import { BookingCancelDialog } from './components/BookingCancelDialog'
import { BookingDetailDialog, type BookingAction } from './components/BookingDetailDialog'
import { BookingDirectCreateDialog } from './components/BookingDirectCreateDialog'
import { BookingRejectDialog } from './components/BookingRejectDialog'
import { CalendarDay } from './components/CalendarDay'
import { CalendarItem } from './components/CalendarItem'
import { CalendarTimeline, CalendarTimelineSkeleton } from './components/CalendarTimeline'
import { useCreateOptions } from './use-create-options'
import { useVenueOptions } from './use-venue-options'
import type { AdminRoute } from '../../routes'

/** `''` is "no filter" for both comboboxes. It is a real option, so the caption states the filter. */
const ALL = ''

const STATUS_CHOICES: readonly ComboboxOption<CalendarFilter['status']>[] = [
  { id: ALL, name: 'ทุกสถานะ' },
  { id: 'APPROVED', name: BOOKING_STATUS_LABEL.APPROVED },
  { id: 'PENDING', name: BOOKING_STATUS_LABEL.PENDING },
]

/** Toolbar comboboxes keep their `<label>` as the accessible name and drop its pixels (as on คำขอจองสถานที่). */
const LABEL_HIDDEN = '[&>.form-label]:sr-only'

/**
 * How long a realtime event waits for its siblings before the refetch. One approval emits `updated`
 * for the subject and for every ADR-001 loser, all within a few milliseconds.
 */
const REFRESH_COALESCE_MS = 400

/** `ApiError` → which of the three error panels. Same mapping as คำขอจองสถานที่. */
const kindOf = (err: unknown): LoadErrorKind => {
  const status = err instanceof ApiError ? err.status : 0
  if (status === 0) return 'network'
  if (status === 403) return 'forbidden'
  return 'server'
}

/* ── The window's data ─────────────────────────────────────────────────────────────────────────── */

interface SlotsState {
  key: string
  /** `null` while this key has never loaded, or after a failure. */
  slots: CalendarBookingSlot[] | null
  error: LoadErrorKind | null
}

/**
 * One window's slots. A new `win.key` loads with a skeleton. `reload(quiet)` re-reads the same window
 * and keeps what is on screen until the answer lands, so a refetch never flickers.
 *
 * ⚠️ ONLY THE NEWEST CALL MAY WRITE (`seq`). Paging ‹ › quickly puts three months in flight, and they
 * land in network order. Without the guard, September's late answer would paint over November.
 *
 * ⚠️ A QUIET FAILURE DESTROYS NOTHING when there is data for this window: the operator keeps the
 * calendar they are reading instead of losing it to an error about a refetch they never asked for.
 * It still surfaces the error when there is NOTHING on screen. Otherwise a quiet call that superseded
 * a skeleton load would leave the skeleton up forever, with no request behind it.
 */
function useCalendarSlots(win: DayWindow | null) {
  const [state, setState] = useState<SlotsState | null>(null)
  const seq = useRef(0)
  const current = useRef(win)
  current.current = win

  const load = useCallback(async (w: DayWindow, quiet: boolean): Promise<boolean> => {
    const mine = ++seq.current
    if (!quiet) {
      setState((s) =>
        s?.key === w.key && s.slots ? { ...s, error: null } : { key: w.key, slots: null, error: null },
      )
    }
    try {
      const slots = await getBookingCalendar({ from: w.from, to: w.to })
      if (mine !== seq.current) return false
      setState({ key: w.key, slots, error: null })
      return true
    } catch (err) {
      if (mine !== seq.current) return false
      setState((s) =>
        quiet && s?.key === w.key && s.slots ? s : { key: w.key, slots: null, error: kindOf(err) },
      )
      return false
    }
  }, [])

  /* Keyed on the window's KEY, not its identity. A day click inside the viewed month rebuilds the
     window object with the same key, and that must not refetch. */
  const key = win?.key ?? null
  useEffect(() => {
    if (current.current) void load(current.current, false)
  }, [key, load])

  const reload = useCallback(
    (quiet: boolean): Promise<boolean> =>
      current.current ? load(current.current, quiet) : Promise.resolve(true),
    [load],
  )

  const mine = win && state?.key === win.key ? state : null
  return { slots: mine?.slots ?? null, error: mine?.error ?? null, reload }
}

/* ── The dialogs: the same state machine as คำขอจองสถานที่ ──────────────────────────────────────── */

/** WHICH record dialog is open, as ONE value. Two stacked `<dialog>`s paint the backdrop twice. */
type DialogView = 'detail' | 'approve' | 'reject' | 'cancel' | null

const ACTION_VIEW: Record<BookingAction, Exclude<DialogView, 'detail' | null>> = {
  approve: 'approve',
  reject: 'reject',
  cancel: 'cancel',
}

/* The sentences are คำขอจองสถานที่'s, word for word. Same writes, same outcomes, same words. */

const WRITE_FAILED = 'บันทึกไม่สำเร็จ ยังไม่มีอะไรเปลี่ยนแปลง · ลองใหม่อีกครั้ง'

const MSG = {
  gone: 'ไม่พบคำขอนี้ในระบบแล้ว · ระบบดึงข้อมูลล่าสุดให้แล้ว',
  forbidden: 'บัญชีของคุณไม่มีสิทธิ์ดำเนินการนี้ · โปรดติดต่อผู้ดูแลระบบ',
} as const

const CONFLICT: Record<BookingAction, string> = {
  approve: 'คำขอนี้ถูกพิจารณาไปแล้ว หรือช่วงเวลานี้ถูกจองไปก่อนหน้าแล้ว · ระบบดึงข้อมูลล่าสุดให้แล้ว',
  reject: 'คำขอนี้ไม่ได้อยู่ในสถานะรอพิจารณาแล้ว · ระบบดึงข้อมูลล่าสุดให้แล้ว',
  cancel: 'การจองนี้ไม่ได้อยู่ในสถานะที่ยกเลิกได้แล้ว · ระบบดึงข้อมูลล่าสุดให้แล้ว',
}

const STALE_MSG = (label: string) =>
  `รายการนี้ถูกเปลี่ยนสถานะเป็น “${label}” โดยเจ้าหน้าที่ท่านอื่นแล้ว · ปิดหน้าต่างนี้แล้วเปิดใหม่เพื่อดูข้อมูลล่าสุด`

const CREATE = {
  conflict: 'ช่วงเวลานี้ถูกจองไปก่อนหน้าแล้ว · ยังไม่มีการบันทึกใด ๆ · เปลี่ยนวัน เวลา หรือสถานที่แล้วลองอีกครั้ง',
  venueGone: 'ไม่พบสถานที่นี้ในระบบแล้ว · ระบบดึงรายชื่อสถานที่ล่าสุดให้แล้ว · เลือกสถานที่อีกครั้ง',
} as const

/** What the dialog stack was opened on, before the detail fetch lands. A slot carries all three. */
interface DialogTarget {
  id: string
  code: string
  status: BookingStatus
}

export function BookingCalendarPage({ route }: { route: AdminRoute }) {
  const { user } = useAuth()
  const acl = useAcl(user!.role)
  const toast = useToast()

  /* ── Where the operator is ─────────────────────────────────────────────────────────────────── */

  /** Entering always opens on today (F18). Leaving unmounts, which discards all of this. */
  const [sel, setSel] = useState(() => bangkokToday())
  const [month, setMonth] = useState<MonthView>(() => monthOf(sel))
  const [venueId, setVenueId] = useState<string>(ALL)
  const [status, setStatus] = useState<CalendarFilter['status']>(ALL)
  const filter = useMemo<CalendarFilter>(() => ({ venueId, status }), [venueId, status])
  const anyFilter = Boolean(venueId || status)
  /**
   * ไทม์ไลน์ | รายการ (PO evaluation, 21 ก.ย. 2569). ไทม์ไลน์ is the default. Like the filters, it is
   * part of what the operator walked away from: leaving unmounts, so re-entry opens on ไทม์ไลน์ again
   * (prototype `__calendarReset`).
   */
  const [view, setView] = useState<'timeline' | 'list'>('timeline')

  /** Read every render. A screen left open past midnight moves its ring and its วันนี้ with the clock. */
  const today = bangkokToday()

  /** Bumped when the create dialog learns a venue vanished, so the shared list is re-read. */
  const [venueKey, setVenueKey] = useState(0)
  const venueOptions = useVenueOptions(venueKey)

  const venueChoices = useMemo<ComboboxOption<string>[]>(
    () => [
      { id: ALL, name: 'ทุกสถานที่' },
      ...(venueOptions.venues ?? []).map((v) => ({ id: v.id, name: v.name })),
    ],
    [venueOptions.venues],
  )

  /* ── The two windows ───────────────────────────────────────────────────────────────────────── */

  const grid = useMemo(() => monthGrid(month), [month])
  const gridWin = useMemo(() => dayWindow(grid.start, grid.last), [grid])
  const selInGrid = sel >= grid.start && sel <= grid.last
  /** Only while the selected day is paged out of the grid. See the header. */
  const selWin = useMemo(() => (selInGrid ? null : dayWindow(sel, sel)), [selInGrid, sel])

  const gridData = useCalendarSlots(gridWin)
  const selData = useCalendarSlots(selWin)

  const error = gridData.error ?? (selWin ? selData.error : null)

  const reloadGrid = gridData.reload
  const reloadSel = selData.reload
  /** Both windows. `quiet` keeps what is on screen on failure (realtime). */
  const reloadAll = useCallback(
    (quiet: boolean) => Promise.all([reloadGrid(quiet), reloadSel(quiet)]),
    [reloadGrid, reloadSel],
  )

  /* ── What the grid and the agenda draw ─────────────────────────────────────────────────────── */

  /** The grid's cells, AFTER the filters. `null` while the window loads. */
  const gridShown = useMemo(
    () => (gridData.slots ? byDate(gridData.slots.filter((s) => matchesFilter(s, filter))) : null),
    [gridData.slots, filter],
  )

  /** The month footer's tally: the viewed month's own days only, never the padding. After filters. */
  const monthTally = useMemo(() => {
    if (!gridShown) return null
    const prefix = grid.first.slice(0, 8)
    const inMonth: CalendarBookingSlot[] = []
    for (const [day, list] of gridShown) if (day.startsWith(prefix)) inMonth.push(...list)
    return tally(inMonth)
  }, [gridShown, grid.first])

  /** The selected day, UNFILTERED. This is the clash pool (F13). */
  const agendaSource = selInGrid ? gridData.slots : selData.slots
  const dayAll = useMemo(
    () => (agendaSource ? agendaSource.filter((s) => s.date === sel) : null),
    [agendaSource, sel],
  )
  /** …and FILTERED, which is what the agenda lists. */
  const dayShown = useMemo(
    () => (dayAll ? dayAll.filter((s) => matchesFilter(s, filter)) : null),
    [dayAll, filter],
  )
  const dayTally = dayShown ? tally(dayShown) : null

  /* ── Selection, paging and the keyboard ────────────────────────────────────────────────────── */

  const gridRef = useRef<HTMLDivElement>(null)
  /** The day whose cell should take focus once it has rendered (keys, clicks, วันนี้). */
  const focusFor = useRef<string | null>(null)
  /** The day the live region should announce once its data is on screen. */
  const announceFor = useRef<string | null>(null)
  /** Bumped per selection, so choosing the day that is already selected still announces it. */
  const [selectTick, setSelectTick] = useState(0)
  const [live, setLive] = useState('')

  /** A date was CHOSEN: select it, and bring the grid to its month. */
  const select = (day: string) => {
    const next = monthOf(day)
    setSel(day)
    // The same object when the month does not change, so the grid and its window are not rebuilt.
    setMonth((m) => (m.y === next.y && m.m === next.m ? m : next))
    focusFor.current = day
    announceFor.current = day
    setSelectTick((t) => t + 1)
  }

  /** ‹ › BROWSE. Only the viewed month moves. The selection and the agenda stay put (PO). */
  const page = (n: number) => setMonth((m) => shiftMonth(m, n))

  useEffect(() => {
    const day = focusFor.current
    if (!day) return
    focusFor.current = null
    gridRef.current?.querySelector<HTMLElement>(`[data-cal-day="${day}"]`)?.focus()
    // `selectTick`, not `sel`/`month`: consumed on the render of THIS selection, even when it changed
    // neither. A leftover request would pull focus into the grid on the next ‹ › instead.
  }, [selectTick])

  /* Announced once the day's data is on screen. A day paged into view can take a round-trip, and
     "ไม่มีรายการจอง" said before the answer arrives would be a false claim. */
  useEffect(() => {
    if (announceFor.current !== sel || dayShown === null) return
    announceFor.current = null
    setLive(`${thaiDayLong(sel)} · ${dayShown.length ? `${dayShown.length} รายการ` : 'ไม่มีรายการจอง'}`)
  }, [selectTick, sel, dayShown])

  /**
   * The APG date-grid keys. They start from the FOCUSED cell, not from `sel`. After paging away,
   * focus can sit on the fallback tab stop in another month, and → must mean "the day after this
   * one". Keys move a DATE, so, unlike ‹ ›, they select it, as a click would.
   *
   * Modified keys pass through: Alt+← is the browser's Back, and taking it would trap the operator.
   */
  const onGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-cal-day]')
    const from = cell?.dataset.calDay ?? sel
    let next: string | null = null
    switch (e.key) {
      case 'ArrowLeft':
        next = addDays(from, -1)
        break
      case 'ArrowRight':
        next = addDays(from, 1)
        break
      case 'ArrowUp':
        next = addDays(from, -7)
        break
      case 'ArrowDown':
        next = addDays(from, 7)
        break
      case 'Home':
        next = addDays(from, -weekday(from))
        break
      case 'End':
        next = addDays(from, 6 - weekday(from))
        break
      case 'PageUp':
        next = shiftMonthClamped(from, -1)
        break
      case 'PageDown':
        next = shiftMonthClamped(from, 1)
        break
    }
    if (!next) return
    e.preventDefault()
    select(next)
  }

  /**
   * The ONE cell in the tab order: the selected day if it is drawn, else today if this is its month,
   * else the 1st. Without the fallback, a selection paged off screen would leave no cell with
   * tabindex 0, and Tab would skip the grid entirely.
   */
  const monthPrefix = grid.first.slice(0, 8)
  const tabStop = selInGrid ? sel : today.startsWith(monthPrefix) ? today : grid.first

  /** Disabled only when there is nowhere to go: today is selected AND its month is on screen. */
  const atToday = sel === today && today.startsWith(monthPrefix)

  const clearFilters = () => {
    setVenueId(ALL)
    setStatus(ALL)
    // Back to the first control of the thing that was just reset (F14). The trigger carries the id.
    document.getElementById('cal-venue-f')?.focus()
  }

  /* ── The dialog stack (see the header) ─────────────────────────────────────────────────────── */

  const [dialog, setDialog] = useState<DialogView>(null)
  const [target, setTarget] = useState<DialogTarget | null>(null)
  const [detail, setDetail] = useState<BookingRequestDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailFailed, setDetailFailed] = useState(false)
  const [dialogAlert, setDialogAlert] = useState<string | null>(null)
  const [writing, setWriting] = useState(false)
  /** The open record's status moved under the dialog (socket). Disarms, never closes. */
  const [staleStatus, setStaleStatus] = useState<BookingStatus | null>(null)

  /** Which id the in-flight detail fetch belongs to. Two cards opened quickly is a real sequence. */
  const wanted = useRef<string | null>(null)
  /** Where focus goes when the whole stack closes. `Modal`'s own restore is not enough after a hand-back. */
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

  /** A card opens its REQUEST. Every slot of a three-day booking opens the same record. */
  const openDetail = (slot: CalendarBookingSlot) => {
    const from = document.activeElement
    anchor.current = from instanceof HTMLElement && from !== document.body ? from : null
    setTarget({ id: slot.bookingRequestId, code: slot.code, status: slot.status })
    setDetail(null)
    setDetailFailed(false)
    setDialogAlert(null)
    setStaleStatus(null)
    setDialog('detail')
    void loadDetail(slot.bookingRequestId)
  }

  /* Escape inside an action dialog is "back to the detail", taken synchronously. */
  useEffect(() => {
    if (dialog === null || dialog === 'detail') return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || writing) return
      e.preventDefault()
      e.stopPropagation()
      setDialog('detail')
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [dialog, writing])

  /* The stack closed: focus goes back to the card's chevron. A refetch keeps that node while the slot
     still exists, because cards are keyed by slot id. A slot a cancel removed has no node, and the
     `isConnected` test lets that case drop quietly. */
  useEffect(() => {
    if (dialog !== null) return
    const back = anchor.current
    anchor.current = null
    if (back?.isConnected) back.focus()
  }, [dialog])

  /* Guarded by the current view: `Modal` calls `onClose` twice, and also when another dialog takes over. */
  const closeDetail = () => {
    if (dialog !== 'detail') return
    setDialog(null)
  }

  const backToDetail = (from: Exclude<DialogView, 'detail' | null>) => () => {
    if (dialog !== from) return
    setDialogAlert(null)
    setDialog('detail')
  }

  /** A write landed: close the stack, say so, re-read the window. Never a patch. */
  const finishWrite = async (message: string) => {
    setDialog(null)
    setDialogAlert(null)
    setStaleStatus(null)
    toast('success', message)
    await reloadAll(false)
  }

  const failWrite = async (err: unknown, kind: BookingAction) => {
    const code = err instanceof ApiError ? err.status : 0
    if (code === 404 || code === 409 || code === 403) {
      setDialog(null)
      setStaleStatus(null)
      toast('error', code === 403 ? MSG.forbidden : code === 404 ? MSG.gone : CONFLICT[kind])
      await reloadAll(false)
      return
    }
    // Offline, 400, 5xx: the dialog stays open with what was typed in it.
    setDialogAlert(WRITE_FAILED)
  }

  const runApprove = async () => {
    if (!detail || writing) return
    setWriting(true)
    setDialogAlert(null)
    try {
      const res = await approveBookingRequest(detail.id)
      // The server's list, never the dialog's forecast.
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
      await finishWrite(`ปฏิเสธคำขอ ${res.code} แล้ว`)
    } catch (err) {
      await failWrite(err, 'reject')
    } finally {
      setWriting(false)
    }
  }

  const runCancel = async (reason: string, slotIds?: string[]) => {
    if (!detail || writing) return
    setWriting(true)
    setDialogAlert(null)
    try {
      const res = await cancelBookingRequest(detail.id, reason, slotIds)
      // The branch is on the response's status. Whether the request is now CANCELLED is the server's ruling.
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

  /* ── สร้างคำจองสถานที่: not part of the record stack, as on คำขอจองสถานที่ ─────────────────────── */

  const [createOpen, setCreateOpen] = useState(false)
  /** Bumped on every open, so the LINE-user and department lists are rebuilt rather than reused. */
  const [createOpenKey, setCreateOpenKey] = useState(0)
  const [createBusy, setCreateBusy] = useState(false)
  const [createAlert, setCreateAlert] = useState<string | null>(null)
  const [createRecheck, setCreateRecheck] = useState(0)
  const createOptions = useCreateOptions(createOpenKey, createOpen)

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
      const n = res.autoRejected.length
      toast(
        'success',
        `สร้างการจอง ${res.booking.code} แล้ว (อนุมัติทันที)` +
          (n > 0 ? ` · ปฏิเสธคำขอที่เวลาชนกันอัตโนมัติ ${n} คำขอ` : ''),
      )
      await reloadAll(false)
    } catch (err) {
      const code = err instanceof ApiError ? err.status : 0
      if (code === 403) {
        setCreateOpen(false)
        toast('error', MSG.forbidden)
        return
      }
      setCreateAlert(
        code === 409
          ? CREATE.conflict
          : code === 404
            ? CREATE.venueGone
            : code === 400 && err instanceof ApiError
              ? err.message
              : WRITE_FAILED,
      )
      setCreateRecheck((k) => k + 1)
      if (code === 404) setVenueKey((k) => k + 1)
    } finally {
      setCreateBusy(false)
    }
  }

  /* ── Live ──────────────────────────────────────────────────────────────────────────────────── */

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** One pending refetch absorbs every event that arrives before it starts. */
  const scheduleRefresh = () => {
    if (refreshTimer.current) return
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null
      void reloadAll(true)
    }, REFRESH_COALESCE_MS)
  }
  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
    },
    [],
  )

  /* The handlers read state directly. `useRealtimeEvents` re-points its ref every render and never
     re-subscribes, so they are never stale. Do not wrap them in `useCallback`. */
  useRealtimeEvents({
    onBookingCreated: () => scheduleRefresh(),
    onBookingUpdated: (booking) => {
      scheduleRefresh()
      /* The stale-dialog guard, as on คำขอจองสถานที่: the stack is open on this id, the status really
         differs, and it is not our own write's echo. */
      const openStatus = dialog === null ? null : (detail?.status ?? target?.status ?? null)
      const openId = dialog === null ? null : (detail?.id ?? target?.id ?? null)
      if (openId === booking.id && !writing && openStatus !== null && openStatus !== booking.status) {
        setStaleStatus(booking.status)
      }
    },
    // A gap with no replay: whatever changed during it is unknown, so re-read.
    onResync: () => scheduleRefresh(),
  })

  const dialogNotice =
    staleStatus !== null ? STALE_MSG(BOOKING_STATUS_LABEL[staleStatus]) : dialogAlert
  const stale = staleStatus !== null

  /* ── Render ────────────────────────────────────────────────────────────────────────────────── */

  const loadingGrid = gridShown === null

  return (
    <div
      data-route="calendar"
      className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden"
    >
      <PageHeading
        route={route}
        desc="ดูตารางเวลาและการใช้สถานที่ทั้งหมดในมุมมองปฏิทินและไทม์ไลน์รายวัน"
        toolbar
        actions={
          /* Filters FIRST, the action LAST: narrow what you are looking at, then act on it. Below `sm`
             a 2-column grid: the filters 2-up, then the button full width on its own row. */
          <div className="grid w-full grid-cols-2 gap-2.5 sm:ml-auto sm:flex sm:w-auto sm:items-center sm:gap-3">
            <Combobox
              id="cal-venue-f"
              className={`min-w-0 ${LABEL_HIDDEN} sm:w-56`}
              label="กรองตามสถานที่"
              // Outlined: this header stands on the page background, not in a card.
              raised
              options={venueChoices}
              value={venueId}
              onChange={setVenueId}
              disabled={venueOptions.venues === null}
              error={venueOptions.error ?? undefined}
            />
            <Combobox
              id="cal-status-f"
              className={`min-w-0 ${LABEL_HIDDEN} sm:w-44`}
              label="กรองตามสถานะ"
              // Outlined: this header stands on the page background, not in a card.
              raised
              options={STATUS_CHOICES}
              value={status}
              onChange={setStatus}
              searchable={false}
            />
            {/* ⚠️ Both ABSENT for a VIEWER (F4), so there is no rule with nothing on its right. */}
            {acl.write && (
              <>
                <div
                  aria-hidden="true"
                  className="h-8 w-0.5 shrink-0 rounded-full bg-base-300 max-sm:hidden"
                />
                <Btn variant="primary" className="col-span-2 sm:col-auto" onClick={openCreate}>
                  <svg
                    aria-hidden="true"
                    className="h-4.5 w-4.5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  <span>สร้างคำจองสถานที่</span>
                </Btn>
              </>
            )}
          </div>
        }
      />

      {error ? (
        <div className="flex flex-col rounded-card border border-base-300/70 bg-base-100 shadow-e1 lg:min-h-0 lg:flex-1">
          <LoadError kind={error} onRetry={() => void reloadAll(false)} />
        </div>
      ) : (
        /* From `lg`, a LOCKED DASHBOARD: the row takes the height the header leaves, and only the
           agenda scrolls. Below `lg` the cards stack, month first, and the content region scrolls. */
        <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:flex-row lg:gap-5">
          {/* ── The month ── `lg:overflow-y-auto` is a short-window fallback only. */}
          <section
            aria-labelledby="cal-month-label"
            className="min-w-0 rounded-card border border-base-300/70 bg-base-100 px-2 py-3 shadow-e1 sm:p-4 lg:flex lg:min-h-0 lg:flex-1 lg:basis-0 lg:flex-col lg:overflow-y-auto lg:px-5 lg:py-4"
          >
            <div className="flex items-center gap-2 xl:grid xl:grid-cols-[1fr_auto_1fr]">
              <button
                type="button"
                onClick={() => page(-1)}
                className="cal-nav-btn xl:justify-self-start"
                aria-label="เดือนก่อนหน้า"
                data-tip="เดือนก่อนหน้า"
                data-tip-pos="bottom"
              >
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              {/* `aria-live`: paging changes every button in the grid, and this says so. */}
              <h2
                id="cal-month-label"
                aria-live="polite"
                className="min-w-0 flex-1 whitespace-nowrap text-center text-[16px] font-semibold text-base-content tabular-nums sm:text-[17px] xl:px-2"
              >
                {thaiMonthLong(month.y, month.m)}
              </h2>
              <div className="flex shrink-0 items-center gap-2 xl:justify-self-end">
                <button
                  type="button"
                  onClick={() => page(1)}
                  className="cal-nav-btn"
                  aria-label="เดือนถัดไป"
                  data-tip="เดือนถัดไป"
                  data-tip-pos="bottom"
                >
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                {/* Disabled, not hidden, when already there. It moves focus onto today's cell,
                    because the button disables itself under the click, and a disabled button drops
                    keyboard focus onto <body>. */}
                <button
                  type="button"
                  disabled={atToday}
                  onClick={() => select(today)}
                  className="btn-ghost2 disabled:pointer-events-none disabled:opacity-50"
                >
                  วันนี้
                </button>
              </div>
            </div>

            <div aria-hidden="true" className="mb-2.5 mt-3 h-px bg-base-300" />

            <div className="lg:flex lg:flex-1 lg:flex-col">
              <div className="grid grid-cols-7 gap-0.5 sm:gap-1" aria-hidden="true">
                {TH_DAYS_SHORT.map((d) => (
                  <span key={d} className="cal-dow">
                    {d}
                  </span>
                ))}
              </div>
              {/* Roving tabindex: ONE day in the tab order, the arrows walk the rest. */}
              <div
                ref={gridRef}
                role="group"
                aria-label="เลือกวันที่ ใช้ปุ่มลูกศรเพื่อเลื่อนวัน"
                aria-busy={loadingGrid || undefined}
                onKeyDown={onGridKeyDown}
                className="grid grid-cols-7 gap-0.5 sm:gap-1 lg:flex-1 lg:auto-rows-fr"
              >
                {grid.cells.map((d) => (
                  <CalendarDay
                    key={d}
                    day={d}
                    outside={!d.startsWith(monthPrefix)}
                    selected={d === sel}
                    today={d === today}
                    tabStop={d === tabStop}
                    list={gridShown ? (gridShown.get(d) ?? []) : null}
                    onSelect={select}
                  />
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1 sm:mt-4 lg:mt-auto lg:pt-4">
                <ul
                  className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-base-content/80"
                  aria-label="คำอธิบายสัญลักษณ์"
                >
                  <li className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="cal-dot cal-dot-ok" />
                    อนุมัติแล้ว
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="cal-dot cal-dot-wait" />
                    รอพิจารณา
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="grid h-5 w-5 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-content"
                    >
                      1
                    </span>
                    วันนี้
                  </li>
                </ul>
                {monthTally ? (
                  <p className="text-[13px] text-base-content/70 tabular-nums">
                    ทั้งเดือน · อนุมัติแล้ว {monthTally.approved} · รอพิจารณา {monthTally.pending}
                  </p>
                ) : (
                  <Skeleton className="h-3.5 w-48" variant="soft" />
                )}
              </div>
            </div>
          </section>

          {/* ── The selected day ── `relative` contains the sr-only live region below. */}
          <section
            aria-labelledby="cal-day-title"
            className="relative min-w-0 rounded-card border border-base-300/70 bg-base-100 p-3 shadow-e1 sm:p-4 lg:flex lg:min-h-0 lg:flex-1 lg:basis-0 lg:flex-col lg:overflow-hidden lg:p-5"
          >
            <p role="status" aria-live="polite" className="sr-only">
              {live}
            </p>
            {/* The view switch shares a row with the TITLE only, and the tally runs full width
                underneath (prototype: beside the title block, the switch made a one-line tally wrap
                and strand a "·"). No `flex-wrap`: a long day name wraps the h2, never the switch. */}
            <div className="mb-3 shrink-0 sm:mb-4">
              <div className="flex items-center justify-between gap-3">
                <h2
                  id="cal-day-title"
                  className="min-w-0 text-[16px] font-semibold text-base-content th-tight sm:text-[17px]"
                >
                  {thaiDayLong(sel)}
                </h2>
                {/* Two native radios dressed as a segmented switch: ONE tab stop, the arrow keys
                    move between them, and the state is the radio's own `checked`. Focus stays on
                    the radio, so the arrows keep flipping the view. */}
                <div
                  role="radiogroup"
                  aria-label="รูปแบบการแสดงรายการของวัน"
                  className="cal-view-seg"
                >
                  <label className="cal-view-btn">
                    <input
                      type="radio"
                      name="cal-view"
                      value="timeline"
                      checked={view === 'timeline'}
                      onChange={() => setView('timeline')}
                      className="sr-only"
                    />
                    <svg
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
                      />
                    </svg>
                    <span>ไทม์ไลน์</span>
                  </label>
                  <label className="cal-view-btn">
                    <input
                      type="radio"
                      name="cal-view"
                      value="list"
                      checked={view === 'list'}
                      onChange={() => setView('list')}
                      className="sr-only"
                    />
                    <svg
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                      />
                    </svg>
                    <span>รายการ</span>
                  </label>
                </div>
              </div>
              {dayShown && dayTally ? (
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-base-content/70 tabular-nums">
                  {dayShown.length ? (
                    <>
                      <span className="flex items-center gap-1.5">{dayShown.length} รายการ</span>
                      {dayTally.approved > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="flex items-center gap-1.5">
                            <span aria-hidden="true" className="cal-dot cal-dot-ok" />
                            อนุมัติแล้ว {dayTally.approved}
                          </span>
                        </>
                      )}
                      {dayTally.pending > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="flex items-center gap-1.5">
                            <span aria-hidden="true" className="cal-dot cal-dot-wait" />
                            รอพิจารณา {dayTally.pending}
                          </span>
                        </>
                      )}
                    </>
                  ) : (
                    <span className="flex items-center gap-1.5">ไม่มีรายการ</span>
                  )}
                </p>
              ) : (
                <Skeleton className="mt-2 h-3.5 w-40" variant="soft" />
              )}
            </div>

            {/* One of the two views, never both. An empty day (or a filter that matches nothing)
                shows the empty card in EITHER view: a grid of empty venue rows would say "every room
                is free", which is the claim the filtered empty state exists to avoid making. The
                timeline also waits for the venue list, whose order its rows follow. */}
            {dayShown === null ||
            dayAll === null ||
            (view === 'timeline' &&
              dayShown.length > 0 &&
              venueOptions.venues === null &&
              venueOptions.error === null) ? (
              view === 'timeline' ? (
                <CalendarTimelineSkeleton />
              ) : (
                /* Shaped like three compact cards (~90px each), so nothing jumps when they land. */
                <SkeletonRegion label="กำลังโหลดรายการจองของวันนี้" className="flex flex-col gap-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="rounded-control border border-l-4 border-base-300 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3.5 flex-1" variant="soft" />
                        <Skeleton className="h-5 w-16" variant="soft" />
                      </div>
                      <Skeleton className="mt-2 h-4 w-3/4" />
                      <Skeleton className="mt-2 h-3.5 w-1/3" variant="soft" />
                    </div>
                  ))}
                </SkeletonRegion>
              )
            ) : dayShown.length > 0 ? (
              view === 'list' ? (
                <ol className="flex list-none flex-col gap-2 p-0 nav-scroll lg:-mx-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:py-0.5 lg:pl-1">
                  {dayShown.map((s) => (
                    <CalendarItem
                      key={s.id}
                      slot={s}
                      clashes={clashesOf(s, dayAll)}
                      onOpen={() => openDetail(s)}
                    />
                  ))}
                </ol>
              ) : (
                <CalendarTimeline
                  day={sel}
                  slots={dayShown}
                  pool={dayAll}
                  venues={venueOptions.venues}
                  venueId={venueId}
                  onOpen={openDetail}
                />
              )
            ) : (
              /* "ว่างตลอดทั้งวัน" is a claim about EVERY venue, and it is false while a filter hides
                 some of them. So the filtered version says so and offers the way out. */
              <div className="flex flex-col items-center rounded-control border border-dashed border-base-300 px-4 py-10 text-center lg:flex-1 lg:justify-center">
                <span
                  aria-hidden="true"
                  className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-3.75l1.5 1.5 3-3"
                    />
                  </svg>
                </span>
                <p className="text-[15px] font-semibold text-base-content">
                  {anyFilter ? 'ไม่มีรายการที่ตรงกับตัวกรองในวันนี้' : 'ไม่มีรายการจองในวันนี้'}
                </p>
                <p className="mt-1 text-[14px] text-base-content/70">
                  {anyFilter
                    ? 'ล้างตัวกรองเพื่อดูการจองของสถานที่ทุกแห่ง'
                    : 'สถานที่ทุกแห่งว่างตลอดทั้งวัน'}
                </p>
                {anyFilter && (
                  <button type="button" className="btn-ghost2 mt-4" onClick={clearFilters}>
                    ล้างตัวกรอง
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── The dialogs ── ALL STAY MOUNTED, closed rather than unrendered, and the detail dialog is
          FIRST: effects run in child order, which lets the platform restore focus on the hand-back.
          Same order and the same reasons as คำขอจองสถานที่. */}
      <BookingDetailDialog
        open={dialog === 'detail'}
        onClose={closeDetail}
        row={target}
        detail={detail}
        loading={detailLoading}
        failed={detailFailed}
        onRetry={() => {
          if (target) void loadDetail(target.id)
        }}
        canWrite={acl.write}
        alert={dialogNotice}
        stale={stale}
        onAction={(action) => {
          if (!detail || stale) return
          setDialogAlert(null)
          setDialog(ACTION_VIEW[action])
        }}
      />

      <BookingApproveDialog
        open={dialog === 'approve'}
        onClose={backToDetail('approve')}
        detail={detail}
        alert={dialogNotice}
        busy={writing}
        stale={stale}
        onConfirm={() => void runApprove()}
      />

      <BookingRejectDialog
        open={dialog === 'reject'}
        onClose={backToDetail('reject')}
        detail={detail}
        alert={dialogNotice}
        busy={writing}
        stale={stale}
        onConfirm={(reason) => void runReject(reason)}
      />

      <BookingCancelDialog
        open={dialog === 'cancel'}
        onClose={backToDetail('cancel')}
        detail={detail}
        alert={dialogNotice}
        busy={writing}
        stale={stale}
        onConfirm={(reason, slotIds) => void runCancel(reason, slotIds)}
      />

      {/* It reads the SAME venue list as the toolbar filter: one vocabulary per screen. */}
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
        onCreateDepartment={createOptions.createDepartment}
        onOpenDepartments={createOptions.refreshDepartments}
      />
    </div>
  )
}
