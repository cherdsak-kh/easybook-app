import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchMasterSchedule, messageFor, type ScheduleSlot } from './home-api'
import { EmptyState } from '@/client-portal/components/feedback/EmptyState'
import { Skeleton } from '@/client-portal/components/feedback/Skeleton'
import { Dropdown } from '@/client-portal/components/ui/Dropdown'
import { SCREEN_WIDTH } from '@/client-portal/components/ui/ScreenHeader'
import { useGate } from '@/client-portal/hooks/gate-context'
import { useScheduleRealtime } from '@/client-portal/hooks/useClientRealtime'
import { LIcon } from '@/client-portal/icons/LucideIcon'
import {
  TH_DOW,
  TH_DOW_FULL,
  TH_MON_FULL,
  fmtD,
  fmtSlot,
  fmtT,
  fmtTe,
  hmDur,
} from '@/client-portal/lib/formatters'
import { addDays, midnight } from '@/client-portal/pages/venues/venue-availability'
import { getProfile } from '@/lib/liff'

/**
 * `#/home` — the organisation's approved schedule. Prototype 785–932 (markup) and module 9,
 * 5101–5558 (`approvedOn` · `hmDayCell` · `paintHomeCal` · `paintHomeList` · `hmTypeMenu`).
 *
 * The twentieth and last screen of Client Portal v2.
 *
 * ── 🔴 NO `<h1>`, AND THAT IS A RULING ──
 * *"หน้าแรกไม่ประกาศตัวเอง"*. The brand answers *where am I in this product* and the greeting names
 * the reader; neither of them labels the content of the page, so neither is a heading. This is the
 * one screen in the portal that does not use `ScreenHeader` (which always emits an `<h1>`), and the
 * two `<h2>`s below — ภาพรวมการใช้งาน and ตารางกิจกรรมที่อนุมัติแล้ว — are therefore the document's
 * top-level headings. It shares `SCREEN_WIDTH` and the header's class list with every other screen,
 * so only the heading level differs, not the geometry.
 *
 * ── 🔴 ONE ROUND TRIP FEEDS BOTH HALVES ──
 * The dots under the calendar and the list under it are the same rows read two ways. Fetching the
 * selected day alone would mean either a request per tap or a calendar that cannot draw a dot, and
 * the dot is the entire reason to look at a calendar rather than at a list.
 *
 * ── 🔴 THE WINDOW IS THE GRID BEING PAINTED, NOT THE CALENDAR MONTH ──
 * The month view opens on the previous month's tail (up to six days) and closes on the next month's
 * head, and every one of those cells is tappable. Asking for `[1st, next 1st)` would leave those
 * fringe days permanently dotless and, worse, would answer "สถานที่ทุกแห่งว่าง" for a day that is
 * fully booked. So the request is the 42-cell grid: Sunday-on-or-before the 1st, plus 42 days. That
 * also covers the 7-day strip in every case, because the strip is anchored to the selected day's
 * week and the selected day is always inside the month the grid is drawn for.
 * ⚠️ 42 DAYS IS COMFORTABLY INSIDE THE SERVER'S TWO 400s (`to` before `from`; wider than 366 days).
 * Nothing on this screen can widen it — the arrows step one month at a time.
 *
 * ── ⚠️ FIVE PIECES OF STATE, NONE OF THEM IN THE URL (`D-C3`) ──
 * selected day · view · month on show · type filter · search text. Picking a day is reading the same
 * page from another angle, not travelling; pushing it into history would make LIFF's back button
 * take ten presses to leave one screen. `#/venues` (`vnQ`) and `#/bookings` (`mbQ`) follow the same
 * rule.
 */

type CalendarView = 'week' | 'month'

const DAY_MS = 86_400_000

/**
 * The widest window the endpoint will accept is 366 days; this stays six days under it.
 *
 * ⚠️ IT IS A CEILING ON A REQUEST, NOT A PRODUCT RULE. Nothing on this screen normally approaches
 * it — a grid is 42 days — so the only thing it protects against is a reader paging a year away
 * from their selection and turning a legal window into a 400.
 */
const MAX_WINDOW_DAYS = 360

/** One approved span with its two timestamps already parsed. */
type Row = {
  id: string
  start: Date
  end: Date
  venueName: string
  /** Nullable on the wire; the FK is required today, so `null` is defence, not a case that occurs. */
  venueTypeName: string | null
  purpose: string
  requesterName: string | null
  isMine: boolean
}

/**
 * A span's LAST day for display purposes.
 *
 * 🔴 MIDNIGHT BELONGS TO THE DAY THAT JUST ENDED. A slot finishing at `00:00` on the 6th is the 5th's
 * activity — `midnight(end - 1ms)` is the one expression that says so, and it is the same one
 * `fmtSlot` and the prototype's `approvedOn` use. Getting this wrong paints a dot on an empty day and
 * prints `6 ก.ย. 24:00`, a date-and-time pair that does not exist.
 */
function lastDay(row: Row): Date {
  return midnight(new Date(row.end.getTime() - 1))
}

/** Does `row` fall on `day`? A day comparison, deliberately — not an interval overlap. */
function fallsOn(row: Row, day: Date): boolean {
  const t = day.getTime()
  return midnight(row.start).getTime() <= t && lastDay(row).getTime() >= t
}

export function HomePage() {
  const { status } = useGate()

  /* Frozen at mount. `new Date()` inside a render would make "today" drift mid-session and, worse,
     produce a different value on every render — so the today ring would flicker rather than move. */
  const [today] = useState(() => midnight(new Date()))
  const [pick, setPick] = useState(today)
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [view, setView] = useState<CalendarView>('week')
  /** `''` is ทุกประเภท — the prototype's `hmType`, same sentinel. */
  const [type, setType] = useState('')
  const [query, setQuery] = useState('')

  const [rows, setRows] = useState<Row[] | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  /**
   * The refetch trigger, and **`silent` travels WITH the counter rather than in a ref**.
   *
   * 🔴 A `useRef` FLAG CONSUMED INSIDE THE EFFECT IS WRONG UNDER `StrictMode`, which `main.tsx`
   * enables: the effect is invoked twice in development, the first run consumes the flag and the
   * second one takes the loud branch — so a live update would flash the skeleton on a dev machine
   * and nowhere else, which is the worst place for a difference to live. As state, both invocations
   * read the same value.
   */
  const [reload, setReload] = useState({ n: 0, silent: false })
  const [lineName, setLineName] = useState<string | null>(null)

  /* The 42-cell grid the month view paints. Sunday-on-or-before the 1st, because the grid opens on
     the previous month's tail and every one of those cells is tappable. */
  const gridStart = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    return addDays(first, -first.getDay())
  }, [month])

  /**
   * 🔴 THE WINDOW IS THE GRID **UNION THE SELECTED DAY'S WEEK**, AND THE UNION IS NOT OPTIONAL.
   *
   * The month arrows move the month on show and deliberately leave the selection alone (prototype
   * 5304) — the reader is looking for a day, and until they tap one the list below still answers
   * about the day they picked. Fetching the grid alone therefore unloads the very day the list is
   * describing, and the screen then prints *"8 ก.ย. 2569 · 0 กิจกรรม"* over *"สถานที่ทุกแห่งว่าง"*
   * for a day with two approved activities on it. That is not a stale number, it is a false
   * statement about a room, and it is exactly the failure the two-empty-states rule exists to stop.
   * Measured: paging one month back did precisely that before this union was added.
   *
   * The **week**, not the day, because switching back to รายสัปดาห์ paints the selected day's whole
   * week and every cell in it needs its dot.
   *
   * ⚠️ THE SERVER REFUSES A WINDOW WIDER THAN 366 DAYS, so the union is clamped. Reaching the clamp
   * takes about a dozen arrow presses with no tap in between; when it fires, the **selected day is
   * what survives** and the far-away grid loses its dots. That is the right way round: a calendar
   * with no dots on a month you paged a year into is uninformative, while a list that claims a day
   * is free is wrong.
   */
  const { from, to } = useMemo(() => {
    const gridEnd = addDays(gridStart, 42)
    const weekStart = addDays(pick, -pick.getDay())
    const weekEnd = addDays(weekStart, 7)
    let lo = gridStart.getTime() <= weekStart.getTime() ? gridStart : weekStart
    let hi = gridEnd.getTime() >= weekEnd.getTime() ? gridEnd : weekEnd
    if (hi.getTime() - lo.getTime() > MAX_WINDOW_DAYS * DAY_MS) {
      if (gridStart.getTime() > weekStart.getTime()) hi = addDays(lo, MAX_WINDOW_DAYS)
      else lo = addDays(hi, -MAX_WINDOW_DAYS)
    }
    return { from: lo, to: hi }
  }, [gridStart, pick])

  /* ⚠️ KEYED ON TIMESTAMPS, NOT ON THE `Date` OBJECTS. A fresh `Date` with the same instant is a
     different identity to `useEffect`, so a `Date` in the dependency array refetches on every
     render — the classic version of this bug fetches forever. */
  const fromKey = from.getTime()
  const toKey = to.getTime()

  useEffect(() => {
    let cancelled = false
    /* 🔴 A LIVE UPDATE MUST NOT BLANK THE SCREEN. On a reader-initiated run (a new window, the retry
       button) the rows in hand describe a month nobody is looking at any more, so they are cleared
       and `null` puts the skeleton up — it says "not known yet" instead of letting the
       "ทุกแห่งว่าง" card claim a day is free that simply has not been read. On a socket-driven run
       the window has NOT moved and what is on screen is still very nearly right; replacing it with
       grey boxes for the length of a round trip is the exact flash a background refresh exists to
       avoid, and it moves the page under a thumb that is mid-scroll. */
    if (!reload.silent) {
      setFailure(null)
      setRows(null)
    }
    void (async () => {
      try {
        const data = await fetchMasterSchedule(
          new Date(fromKey).toISOString(),
          new Date(toKey).toISOString(),
        )
        if (cancelled) return
        /* Cleared on success rather than only at the top, so a silent refetch also takes down a
           failure banner the reader never dismissed. */
        setFailure(null)
        setRows(
          data.map((s: ScheduleSlot) => ({
            id: s.id,
            start: new Date(s.startAt),
            end: new Date(s.endAt),
            venueName: s.venueName,
            venueTypeName: s.venueTypeName,
            purpose: s.purpose,
            requesterName: s.requesterName,
            isMine: s.isMine,
          })),
        )
      } catch (error) {
        console.warn('[home] schedule read failed:', error)
        if (cancelled) return
        /* ⚠️ A FAILED **BACKGROUND** REFETCH LEAVES THE SCREEN ALONE, and this is the one place this
           file departs from "every failed request is visible". Nobody asked for this read: swapping
           a correct-looking schedule for an error card, because an event the reader never saw could
           not be followed up, degrades a working screen for news they cannot act on. The data is
           merely as fresh as the last successful read — which is what it was a second ago — and the
           next pulse, or any navigation, corrects it. A read the reader DID ask for still reports. */
        if (reload.silent) return
        setFailure(messageFor(error))
        setRows([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fromKey, toKey, reload])

  /* ── The live schedule pulse (`CLIENT-REALTIME-1`) ──────────────────────────────────────────
     `client.scheduleUpdated` is payload-free and fires for `APPROVED`/`CANCELLED` only — exactly
     the two transitions that add or remove a block from this screen. There is nothing to patch from
     it, so the response is a refetch of the window already on show. */
  useScheduleRealtime(() => setReload((r) => ({ n: r.n + 1, silent: true })))

  /* The greeting's fallback. `getProfile()` never throws and answers `null` in a plain dev browser,
     so this quietly does nothing there and the registration name (or the generic word) stands. */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const profile = await getProfile()
      if (!cancelled && profile?.displayName) setLineName(profile.displayName)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const greeting = status?.registration?.firstName || lineName || 'ผู้ใช้งาน'
  const loading = rows === null

  /* 🔴 THE TYPE LIST COMES FROM THE SCHEDULE THAT LOADED, NOT FROM A WRITTEN-DOWN LIST — the rule
     `#/venues` and `#/bookings` both follow. An option that matches nothing is a dead end, and a
     hard-coded vocabulary drifts the moment an admin renames a category.
     ⚠️ THE SELECTED TYPE IS KEPT IN THE LIST EVEN IF THIS MONTH HAS NONE OF IT. Otherwise paging to
     a quiet month removes the only row that could switch the filter back off, and the reader is
     left with a filter they can see on the button and cannot reach in the menu. */
  const types = useMemo(() => {
    const seen = new Set<string>()
    for (const r of rows ?? []) if (r.venueTypeName) seen.add(r.venueTypeName)
    if (type) seen.add(type)
    return [...seen].sort((a, b) => a.localeCompare(b, 'th'))
  }, [rows, type])

  /* ⚠️ BOTH FILTER LAYERS APPLY EVERYWHERE ACTIVITIES ARE COUNTED — the dots, the count line and the
     list. A dot is a promise that tapping the day finds something; a dot that counts every type
     while the screen shows one is a promise the very next tap breaks, and that reads as breakage
     rather than as a filter doing its job.
     ⚠️ THE SEARCH MATCHES THE VENUE NAME ONLY, which is what the placeholder says it does. A box
     that catches more than it advertises produces results nobody can explain. */
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (rows ?? []).filter(
      (r) =>
        (!type || r.venueTypeName === type) && (!q || r.venueName.toLowerCase().includes(q)),
    )
  }, [rows, type, query])

  /* Which days carry a dot. Every day a span touches, not only the day it starts — a two-day camp
     has to be findable from its second day, or somebody opening that day sees an empty hall that
     has people in it. */
  const dotted = useMemo(() => {
    const days = new Set<number>()
    for (const r of visible) {
      const stop = lastDay(r).getTime()
      /* A guard, not a limit anyone should hit: the endpoint caps the window at 366 days, so the
         longest span this can walk is bounded — but an unbounded `for` over dates is one bad
         timestamp away from freezing the tab. */
      for (let d = midnight(r.start), i = 0; d.getTime() <= stop && i < 400; d = addDays(d, 1), i++) {
        days.add(d.getTime())
      }
    }
    return days
  }, [visible])

  /* The selected day's activities, ordered by the time they are visible ON THAT DAY. A span that
     began yesterday occupies this day from midnight, so it heads the list rather than sinking to
     the bottom behind a 09:00 meeting that starts later but reads as earlier. */
  const dayRows = useMemo(() => {
    const t = pick.getTime()
    return visible
      .filter((r) => fallsOn(r, pick))
      .sort(
        (a, b) =>
          Math.max(a.start.getTime(), t) - Math.max(b.start.getTime(), t) ||
          a.venueName.localeCompare(b.venueName, 'th'),
      )
  }, [visible, pick])

  /** Would anything show on this day with no filters at all? The question that splits the two empty states. */
  const anyUnfiltered = useMemo(
    () => (rows ?? []).some((r) => fallsOn(r, pick)),
    [rows, pick],
  )

  /* ⚠️ ONE SPELLING OF "WHAT IS FILTERED", USED BY THE COUNT LINE AND THE EMPTY CARD. Two copies is
     how the count comes to say "เฉพาะห้องประชุม" while the empty card below it stays silent about
     the search box that is also hiding rows. */
  const filterNote = () => {
    const bits: string[] = []
    if (type) bits.push(`เฉพาะ${type}`)
    if (query.trim()) bits.push(`ค้นหา “${query.trim()}”`)
    return bits.length ? ` (${bits.join(' · ')})` : ''
  }

  const pickDay = (day: Date) => {
    setPick(day)
    setMonth(new Date(day.getFullYear(), day.getMonth(), 1))
  }

  const stepMonth = (dir: -1 | 1) =>
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + dir, 1))

  /* ⚠️ CLEARS THE VISIBLE BOX, NOT ONLY THE STATE BEHIND IT. The input is controlled, so resetting
     `query` empties what the reader can see — the prototype has to say `hm-q.value = ''` out loud
     because its box is not. Leaving text in the field while the full list returns is a screen that
     contradicts itself. */
  const clearFilters = () => {
    setType('')
    setQuery('')
  }

  /* Week: the seven days of the SELECTED day's week — not "seven days from today". Tap the 18th in
     the month grid, switch back, and the 18th must still be in the strip; snapping back to this week
     throws away the work the reader just did. There are no arrows here on purpose: the way to
     another week is the month view (prototype 827). */
  const days: { day: Date; dim: boolean }[] = []
  if (view === 'week') {
    const weekStart = addDays(pick, -pick.getDay())
    for (let i = 0; i < 7; i++) days.push({ day: addDays(weekStart, i), dim: false })
  } else {
    for (let k = 0; k < 42; k++) {
      const day = addDays(gridStart, k)
      if (k >= 35 && day.getMonth() !== month.getMonth()) break
      days.push({ day, dim: day.getMonth() !== month.getMonth() })
    }
  }

  return (
    <section className="min-h-dvh">
      {/* ─── Header ────────────────────────────────────────────────────────────────────
          ⚠️ THE GREETING IS A SECOND LINE INSIDE THE BRAND'S TEXT COLUMN, not a sibling of the
          logo. Beside the brand, the two compete for one line at 375 px and a name longer than
          "สมชาย" pushes the app's own name onto a second row. Under it, aligned to the `E` of
          EasyBook — which a column gives exactly, while a `pl-11` would be 44 px against the real
          46 px (`h-9` + `gap-2.5`) and would silently drift the day anyone resizes the mark.
          ⚠️ `min-w-0` ON THE TEXT COLUMN or `truncate` does nothing: a flex item's default
          `min-width: auto` refuses to shrink below its content.
          ⚠️ `bg-base-100/90`, NOT `/95`. Token alphas exist only in steps of ten (`D-C11`); a step
          with no rule behind it renders at FULL opacity and the bar stops being translucent in
          silence. */}
      <header className="hdr-blur sticky top-0 z-30 border-b border-base-300 bg-base-100/90 shadow-xs backdrop-blur-md">
        <div className={`${SCREEN_WIDTH} pb-3 pt-safe`}>
          <div className="flex items-center gap-2.5">
            {/* Decorative: the word "EasyBook" is right beside it, so an alt would be read twice. */}
            <img
              src="/logo/easybook-logo-512px-no-bg.svg"
              alt=""
              className="h-9 w-9 shrink-0 select-none"
            />
            <div className="min-w-0">
              <p className="text-xl font-semibold tracking-tight">EasyBook</p>
              <p className="mt-0.5 truncate text-sm text-base-content/70">สวัสดี, คุณ{greeting}</p>
            </div>
          </div>
        </div>
      </header>

      <div className={`${SCREEN_WIDTH} pt-4`}>
        {/* ─── 1 · Calendar ────────────────────────────────────────────────────────────
            ⚠️ `mb-2` ON THE HEADING AND NO `mt-4` ON THE CARD. Both would collapse into one 16 px
            margin that is written nowhere; the top space comes from the container's `pt-4`, the
            same value `#/venues` and `#/bookings` start with. */}
        <div className="mb-2">
          <h2 className="text-base font-semibold text-base-content">ภาพรวมการใช้งาน</h2>
        </div>

        <div className="card bg-base-100 shadow-sm">
          <div className="card-body gap-0 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 text-sm">
                <span className="text-base-content/60">วันที่เลือก · </span>
                <span className="font-medium">
                  {TH_DOW_FULL[pick.getDay()]}ที่ {fmtD(pick)}
                </span>
              </p>
              {/* ⚠️ `px-4` IS LOAD-BEARING, and `h-11` is not a substitute. "วันนี้" measures ~38 px
                  of text; with `btn-app-sm`'s standard padding it lands well under the 70–105 px
                  band every other control on this screen occupies, and `px-4` puts it at ~70. The
                  height stays 36 because `.btn.btn-app-sm` is a TWO-class rule and beats any single
                  utility — an `h-11` here would read as a 44 px guarantee and deliver 36. */}
              <button
                type="button"
                onClick={() => {
                  setPick(today)
                  setMonth(new Date(today.getFullYear(), today.getMonth(), 1))
                }}
                className="btn btn-app-sm btn-outline shrink-0 px-4"
              >
                วันนี้
              </button>
            </div>

            <div className="join mt-3 w-full" role="group" aria-label="มุมมองปฏิทิน">
              <button
                type="button"
                onClick={() => setView('week')}
                aria-pressed={view === 'week'}
                className={`btn btn-app-sm join-item grow gap-1.5${view === 'week' ? ' btn-neutral' : ''}`}
              >
                <LIcon name="calendarRange" className="h-4 w-4 shrink-0" />
                รายสัปดาห์
              </button>
              <button
                type="button"
                /* Compact → full opens on the month of the SELECTED day, not on this month —
                   otherwise switching views silently moves the reader somewhere else. */
                onClick={() => {
                  setView('month')
                  setMonth(new Date(pick.getFullYear(), pick.getMonth(), 1))
                }}
                aria-pressed={view === 'month'}
                className={`btn btn-app-sm join-item grow gap-1.5${view === 'month' ? ' btn-neutral' : ''}`}
              >
                <LIcon name="calendarDays" className="h-4 w-4 shrink-0" />
                รายเดือน
              </button>
            </div>

            <div className="divider my-3" />

            {/* ⚠️ ARROWS EXIST IN THE MONTH VIEW ONLY. A month grid that cannot change month is a
                calendar that does not work; the 7-day strip reaches other weeks through the month
                view, so a second pair of arrows there would be a second way to do one thing.
                ⚠️ A FULL 44 px on both — an icon-only button has no text width to make up the
                target — and `min-h-11` must accompany `h-11` because daisyUI's `.btn` sets its own
                `min-height` and would otherwise win.
                ⚠️ `flex-1 text-center` ON THE LABEL, with `justify-between` kept: the two arrows are
                exactly the same width, so the label's centre is the row's centre. */}
            {view === 'month' ? (
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => stepMonth(-1)}
                  className="btn btn-ghost btn-square h-11 min-h-11 w-11"
                  aria-label="เดือนก่อนหน้า"
                >
                  <LIcon name="chevronLeft" className="h-4 w-4" />
                </button>
                <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold">
                  {TH_MON_FULL[month.getMonth()]} {month.getFullYear() + 543}
                </p>
                <button
                  type="button"
                  onClick={() => stepMonth(1)}
                  className="btn btn-ghost btn-square h-11 min-h-11 w-11"
                  aria-label="เดือนถัดไป"
                >
                  <LIcon name="chevronRight" className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            {/* ⚠️ THE WEEKDAY HEADER ROW EXISTS ONLY IN THE MONTH VIEW — in the strip each cell
                prints its own weekday, and having both is one label stacked twice. It must carry
                the identical overflow, gap and padding classes as the grid below it, or `อา จ อ …`
                stops lining up with the columns it names. */}
            {view === 'month' ? (
              <div
                aria-hidden="true"
                className="-mx-4 mt-2 grid grid-cols-7 gap-1 px-1 text-center text-xs text-base-content/60 sm:gap-2"
              >
                {TH_DOW.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
            ) : null}

            {/* 🔴 `-mx-4 … gap-1 px-1 sm:gap-2`, AND THE NUMBERS DECIDED IT. Inside `card-body p-4`
                the content column is 311 px at a 375 px screen, which gives 37.57 px cells with a
                plain `gap-2` grid — under the 44 px target. `-mx-4` cancels the card's padding
                exactly (so the grid spans the card's inner width and cannot overflow it) and `px-1`
                moves the breathing room INSIDE the grid: (343 − 8 − 24) / 7 = **44.43 px** at 375,
                53.71 at 440, 83.14 at 670. `gap-1` and not `gap-1.5`, which leaves 0.14 px of margin
                and fails on a 374 px screen.
                ⚠️ THE STRIP USES THE SAME CLASS LIST, CHARACTER FOR CHARACTER. It stopped being a
                horizontally scrolling `flex` row on 1 ก.ย. 2569; a fixed `w-14` here would overflow
                the grid at 375 px. It carries no `mt-2` because it follows the divider directly. */}
            <div
              role="group"
              aria-label={view === 'week' ? 'เลือกวันในสัปดาห์' : 'เลือกวันในเดือน'}
              className={`-mx-4 grid grid-cols-7 gap-1 px-1 sm:gap-2${view === 'month' ? ' mt-2' : ''}`}
            >
              {days.map(({ day, dim }) => (
                <DayCell
                  key={day.getTime()}
                  day={day}
                  selected={day.getTime() === pick.getTime()}
                  today={day.getTime() === today.getTime()}
                  dot={dotted.has(day.getTime())}
                  strip={view === 'week'}
                  dim={dim}
                  onPick={pickDay}
                />
              ))}
            </div>

            {/* ⚠️ COLOUR ALONE IS NOT ENOUGH (WCAG 1.4.1), and a 6 px dot is not guessable. Every
                cell's `aria-label` says the same thing in words; this line says it on screen. */}
            <p className="mt-3 flex items-center gap-1.5 text-xs text-base-content/60">
              <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              วันที่มีกิจกรรมซึ่งได้รับอนุมัติแล้ว
            </p>
          </div>
        </div>

        {/* ─── 2 · The activity list ───────────────────────────────────────────────── */}
        <div className="mt-7">
          <h2 className="font-semibold">ตารางกิจกรรมที่อนุมัติแล้ว</h2>
          {/* ⚠️ A SKELETON BAR RATHER THAN AN EMPTY `<p>` while the window loads. The prototype
              leaves this line blank and lets its list placeholder stand in for the height, which
              costs a ~20 px jump the moment the count arrives — the one thing a skeleton exists to
              prevent. Same width as the bar the prototype puts at the top of `#hm-skel`, which is
              why that bar is not repeated below. */}
          {loading ? (
            <Skeleton className="mt-1.5 h-4 w-44" />
          ) : (
            /* ⚠️ NO COUNT AFTER A FAILED READ — measured, and it was printing "· 0 กิจกรรม". Zero is
               something this screen would have to have been TOLD; after a refused request it knows
               nothing about the day, and a zero there is the same false statement the empty-state
               card is already suppressed for. The date stays, because that much is still true. */
            <p className="mt-0.5 text-sm text-base-content/60">
              {failure ? fmtD(pick) : `${fmtD(pick)} · ${dayRows.length} กิจกรรม${filterNote()}`}
            </p>
          )}
        </div>

        {/* ─── 3 · Search + venue-type filter ──────────────────────────────────────────
            🔴 THREE SCREENS SHARE THIS ROW CHARACTER FOR CHARACTER — `#/home`, `#/venues`,
            `#/bookings`. A change to one is a change to all three.
            🔴 `bg-base-100` ON THE FILTER BUTTON IS NOT `.btn`'s default. A bare `.btn` takes the
            grey `--btn-bg` and sits beside a white search field: two controls of the same height,
            touching, in different colours, which reads as two unrelated things rather than one
            toolbar. `hover:bg-base-200/60` gives back the hover signal the grey used to carry. Both
            come from `Dropdown`'s default trigger class. */}
        <div className="mt-3 flex items-center gap-2">
          <label className="input input-lg flex min-w-0 flex-1 items-center gap-2 border-base-300 bg-base-100 shadow-2xs">
            {/* The r=7 magnifier written inline, as all three search fields in this portal do —
                `licon.ts` deliberately carries no `search` key, because lucide's is r=8 with a
                longer handle and would silently split the three screens apart. */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
              className="h-4 w-4 opacity-60"
            >
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="m20 20-3.5-3.5" />
            </svg>
            {/* ⚠️ NO DEBOUNCE, AND NO REQUEST. Unlike `#/venues` and `#/bookings`, this search runs
                over rows already in memory — a month is tens of them — so it is applied on every
                keystroke. It also drives the calendar dots, which must not lag the list. */}
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 grow"
              placeholder="ค้นหาชื่อสถานที่"
              aria-label="ค้นหาชื่อสถานที่ในตารางกิจกรรม"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </label>

          {/* ⚠️ `<li><button>` per daisyUI's `menu`, and do NOT add `btn` to these rows —
              `menu-active` selects `li > *:not(.btn)`, so the selected state would go silently
              missing. `closeOnSelect` because `<details>` does not close itself when something
              inside it is clicked, and a menu parked over the list it just re-filtered reads as
              "I pressed it and nothing happened". */}
          <Dropdown
            align="end"
            label="กรองตามประเภทสถานที่"
            closeOnSelect
            trigger={
              <>
                <LIcon name="slidersHorizontal" className="h-5 w-5 shrink-0" />
                <span className="sr-only">ประเภทสถานที่:</span>
                <span className="sr-only text-sm font-medium sm:not-sr-only">
                  {type || 'ทุกประเภท'}
                </span>
                <LIcon name="chevronDown" className="hidden h-4 w-4 shrink-0 opacity-60 sm:block" />
              </>
            }
          >
            <li>
              <button
                type="button"
                onClick={() => setType('')}
                aria-pressed={type === ''}
                className={type === '' ? 'menu-active' : ''}
              >
                ทุกประเภท
              </button>
            </li>
            {types.map((t) => (
              <li key={t}>
                <button
                  type="button"
                  onClick={() => setType(t)}
                  aria-pressed={type === t}
                  className={type === t ? 'menu-active' : ''}
                >
                  {t}
                </button>
              </li>
            ))}
          </Dropdown>
        </div>

        {/* The prototype has no failure branch — it is one static file with its data in a variable.
            A read that can fail needs one, and it needs a way to retry that is not "close the app".
            Same shape as `#/bookings`' alert, so the two failures look like the same kind of event. */}
        {failure ? (
          <div role="alert" className="mt-3 rounded-box border border-error/40 bg-base-100 p-4">
            <p className="text-sm font-medium text-base-content">{failure}</p>
            <button
              type="button"
              /* `silent: false` — the reader pressed this, so the skeleton is the right answer and
                 a second failure has to be reported. The effect clears the rows itself. */
              onClick={() => setReload((r) => ({ n: r.n + 1, silent: false }))}
              className="btn btn-app btn-outline mt-3"
            >
              ลองใหม่อีกครั้ง
            </button>
          </div>
        ) : null}

        <div className="mt-3 space-y-3">
          {loading ? (
            /* ⚠️ THE PLACEHOLDER HAS THE CARD'S PROPORTIONS — a header row with a badge, a title
               line and two meta lines. A skeleton of a different height spends the loading time
               promising a layout it then breaks. Two cards, as the prototype draws (909–927). */
            <div aria-busy="true" aria-hidden="true" className="space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-box border border-base-300 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className={i === 0 ? 'h-5 w-40' : 'h-5 w-32'} />
                    <Skeleton className="h-5 w-24 rounded-full" />
                  </div>
                  <Skeleton className={`mt-4 h-5 ${i === 0 ? 'w-2/3' : 'w-3/4'}`} />
                  <Skeleton className={`mt-4 h-4 ${i === 0 ? 'w-1/2' : 'w-2/5'}`} />
                  <Skeleton className={`mt-2 h-4 ${i === 0 ? 'w-2/5' : 'w-1/2'}`} />
                </div>
              ))}
            </div>
          ) : (
            dayRows.map((row) => <ActivityCard key={row.id} row={row} />)
          )}

          {/* 🔴 TWO EMPTY STATES, SPLIT BY ONE QUESTION: "with no filters at all, is there anything
              on this day?"
                1) **No** → genuinely good news about that day. `circleCheck`, the original wording,
                   and the CTA that starts the thing this screen is for.
                2) **Yes, the filters hid it** → not good news; it is "the filter is too narrow". It
                   has to name what is filtering and offer the one button that undoes it — a CTA
                   that leaves the screen would read as "there is nothing more to see here".
              ⚠️ ONE MESSAGE FOR BOTH IS A LIE THE MOMENT A FILTER IS ON: "วันนี้สถานที่ทุกแห่งว่าง
              (เฉพาะห้องประชุม)" on a day the hall is booked solid is factually wrong, not merely
              vague.
              ⚠️ Case 1's headline changes with the day, too — "วันนี้…" printed while looking at the
              12th is wrong in the same way.
              ⚠️ Case 1 is `btn-primary` (the screen's only CTA); case 2 is `btn-outline`, because it
              is a step BACK rather than forward, and two filled CTAs on one screen means neither is
              the loudest. */}
          {!loading && !failure && dayRows.length === 0 ? (
            anyUnfiltered ? (
              <EmptyState
                icon={<LIcon name="slidersHorizontal" className="h-7 w-7" />}
                title="ไม่พบกิจกรรมที่ตรงกับตัวกรอง"
                description={`${fmtD(pick)}${filterNote()}`}
                action={
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="btn btn-app btn-outline"
                  >
                    ล้างตัวกรอง
                  </button>
                }
              />
            ) : (
              <EmptyState
                icon={<LIcon name="circleCheck" className="h-7 w-7" />}
                title={
                  pick.getTime() === today.getTime()
                    ? 'วันนี้สถานที่ทุกแห่งว่าง'
                    : `${fmtD(pick)} สถานที่ทุกแห่งว่าง`
                }
                description="พร้อมให้คุณยื่นคำขอจองใช้งานได้ทันที"
                action={
                  /* A router `<Link>`, never a bare `<a href>`: a full page load restarts the LIFF
                     gate's four checks for a destination the reader may already enter. */
                  <Link to="/venues" className="btn btn-app btn-primary gap-2">
                    <LIcon name="plus" className="h-4 w-4 shrink-0" />
                    เริ่มต้นจองสถานที่
                  </Link>
                }
              />
            )
          ) : null}
        </div>
      </div>
    </section>
  )
}

/**
 * One day in the calendar, shared by both views — written twice and the two start disagreeing the
 * day somebody edits one of them.
 *
 * ⚠️ THREE STATES CAN COINCIDE; THE ORDER IS selected > today > ordinary. "Today" is a reference
 * point, "selected" is what the reader just did, and what the reader just did must win.
 *
 * ⚠️ THE DOT IS ALWAYS DRAWN, only its colour changes (`bg-transparent` when the day is free). Hide
 * the element and cells with activities stand 8 px taller than their neighbours, and the row goes
 * saw-toothed.
 *
 * 🔴 `min-h-11` IS A FLOOR THAT HAS TO BE DECLARED, not something the content happens to produce. A
 * month cell measures `p-1.5` (12) + `text-sm` (20) + `gap-0.5` (2) + the dot (6) + borders (2) =
 * **42 px**, under 44 on every screen — this is two short lines, where the venue calendar's single
 * taller line reaches 44 by itself. `justify-center` must come with it, or the extra 2 px pile up at
 * the bottom instead of centring.
 */
function DayCell({
  day,
  selected,
  today,
  dot,
  strip,
  dim,
  onPick,
}: {
  day: Date
  selected: boolean
  today: boolean
  /** Does this day carry at least one activity under the filters currently on? */
  dot: boolean
  /** `true` in the week strip, which prints the weekday inside the cell. */
  strip: boolean
  /** `true` for a day outside the month being shown. Dimmed, but still tappable. */
  dim: boolean
  onPick: (day: Date) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(day)}
      aria-pressed={selected}
      aria-label={`${fmtD(day)} — ${dot ? 'มีกิจกรรมที่อนุมัติแล้ว' : 'ยังไม่มีกิจกรรมที่อนุมัติแล้ว'}`}
      className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-field border ${strip ? 'p-2' : 'p-1.5'} ${
        selected ? 'border-base-content bg-base-200' : today ? 'border-primary' : 'border-base-300'
      }${dim ? ' opacity-40' : ''} motion-safe:transition-colors`}
    >
      {strip ? (
        <span className="block text-xs text-base-content/60">{TH_DOW[day.getDay()]}</span>
      ) : null}
      <span className={`block text-sm font-medium${today && !selected ? ' text-primary' : ''}`}>
        {day.getDate()}
      </span>
      <span
        aria-hidden="true"
        className={`block h-1.5 w-1.5 rounded-full ${dot ? 'bg-primary' : 'bg-transparent'}`}
      />
    </button>
  )
}

/**
 * One approved activity. Four tiers: venue + status, rule, purpose, two meta lines.
 *
 * ⚠️ THE "อนุมัติแล้ว" BADGE IS THE SAME FORMULA AS `#/bookings`' approved badge — `border-success/40
 * bg-success/20 text-base-content`. The same meaning has to look the same in both places, and
 * `text-success` on its own measures about 3.5:1 in the light theme and fails AA. It is GREEN here
 * where the venue calendar's bar is red, and the two are not in conflict: there red means "you
 * cannot ask for these hours", here green means "this is happening".
 *
 * ⚠️ `shrink-0 whitespace-nowrap` ON THE BADGE. daisyUI's `.badge` fixes its height and does not set
 * `white-space`; squeezed in a `justify-between` row the text wraps and the second line is clipped
 * by that fixed height, which reads as a badge with a word missing.
 *
 * ⚠️ THE `คุณ` BADGE FOLLOWS THE REQUESTER'S NAME, NOT THE CARD HEADER. The header answers "where,
 * and what state"; "whose" belongs to the requester line. Put it at the top and it competes with the
 * status badge, which is a different question.
 */
function ActivityCard({ row }: { row: Row }) {
  /* A same-day span prints `09:00–12:00`; one that crosses midnight prints the file's own
     `fmtSlot` (`30 ส.ค. 08:00 → 31 ส.ค. 16:00`) rather than a format invented for this screen. */
  const sameDay = midnight(row.start).getTime() === lastDay(row).getTime()
  const when = sameDay ? `${fmtT(row.start)}–${fmtTe(row.end)}` : fmtSlot(row.start, row.end)

  return (
    <article className="card bg-base-100 shadow-sm">
      <div className="card-body gap-0 p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2 text-sm text-base-content/70">
            <LIcon name="building2" className="h-[18px] w-[18px] shrink-0 text-base-content/60" />
            <span className="min-w-0 truncate">{row.venueName}</span>
          </span>
          <span className="badge badge-sm shrink-0 whitespace-nowrap border-success/40 bg-success/20 text-base-content">
            อนุมัติแล้ว
          </span>
        </div>

        <div className="divider my-2" />

        <p className="font-semibold leading-snug">{row.purpose}</p>

        <div className="mt-3 flex flex-col gap-2 text-sm text-base-content/70">
          <span className="flex items-start gap-2">
            <LIcon name="clock" className="mt-px h-[18px] w-[18px] shrink-0 text-base-content/60" />
            <span className="min-w-0">
              {when} <span className="whitespace-nowrap">({hmDur(row.start, row.end)})</span>
            </span>
          </span>
          <span className="flex items-start gap-2">
            <LIcon name="user" className="mt-px h-[18px] w-[18px] shrink-0 text-base-content/60" />
            <span className="min-w-0">
              {/* 🟠 `requesterName` IS NULLABLE ON THE WIRE and the prototype draws no case for it —
                  its fixture always names somebody. It is null for a staff booking made on behalf of
                  nobody in particular (`จองแทน` with no requester). The row is kept rather than
                  dropped so every card has the same two meta lines and the list does not go ragged,
                  and the word is neutral rather than invented detail. Flagged for the PO. */}
              {row.requesterName ?? 'ไม่ระบุผู้ขอใช้'}
              {row.isMine ? (
                <>
                  {' '}
                  <span className="badge badge-sm whitespace-nowrap border-primary/40 bg-primary/20 text-base-content">
                    คุณ
                  </span>
                </>
              ) : null}
            </span>
          </span>
        </div>
      </div>
    </article>
  )
}
