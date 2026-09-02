import {
  BAR_PAINT_ORDER,
  addDays,
  barSpan,
  countsOn,
  slotsOn,
  type VenueSlot,
} from '../venue-availability'
import { LIcon } from '@/client-portal/icons/LucideIcon'
import { TH_DOW, TH_MON_FULL, fmtD, fmtDShort } from '@/client-portal/lib/formatters'

/**
 * The availability calendar: a week strip or a month grid, each day carrying a 24-hour bar.
 * Prototype 1140–1180 and `vdDayCell` / `vdBar` / `paintVenueCal` (3746–3848).
 *
 * ── 🔴 THE 24-HOUR BAR SITS UNDER EACH DAY NUMBER — IT IS NOT ONE BAR BELOW THE CALENDAR ──
 * It replaced a single dot meaning "something is booked today", which made a day with a 09:00–12:00
 * meeting read exactly like a day booked end to end. Drawn to scale, somebody looking for an
 * afternoon can see it from the calendar without opening a single day.
 *
 * ── 🔴 THE GRID GEOMETRY IS `-mx-4 … gap-1 px-1 sm:gap-2`, AND THE NUMBERS DECIDED IT ──
 * The written spec asked for `grid grid-cols-7 gap-2 w-full`, which at 375 px yields cells of
 * **37.57 px** ((343 − 32 − 48) / 7) — contradicting that same spec's own ≥ 44 px target rule. This
 * set measures **44.43 px** at 375, 53.71 at 440, 83.14 at 670. `-mx-4` cancels the card's `p-4`
 * exactly, so the grid spans the card's inner width without overflowing it, and `px-1` moves the
 * breathing room *inside* the grid instead of leaving it as an outer margin.
 *
 * ⚠️ ARROWS EXIST IN BOTH VIEWS, unlike the home screen's calendar which hides them on its 7-day
 * strip. There the strip scrolls horizontally; this is a full-width seven-column grid, so without
 * arrows **there would be no way to reach next week at all** — the first thing anyone planning an
 * event wants.
 *
 * ⚠️ COLOUR ALONE IS NOT ENOUGH (WCAG 1.4.1). Two things carry the same information as text: the
 * legend under the grid, and every cell's `aria-label`, which spells out the counts.
 */

export type CalendarView = 'week' | 'month'

/** One day's proportional bar. Prototype `vdBar` (3746). */
function DayBar({ slots, day }: { slots: readonly VenueSlot[]; day: Date }) {
  const rows = slotsOn(slots, day)
  return (
    /* ⚠️ THE BAR IS DRAWN EVEN ON AN EMPTY DAY, as a plain grey rail. Hiding it makes that cell
       6 px shorter than its neighbours and the calendar row goes saw-toothed — the same lesson the
       home screen's under-day dots taught. */
    <span
      aria-hidden="true"
      className="relative block h-1.5 w-full overflow-hidden rounded-full bg-base-300"
    >
      {BAR_PAINT_ORDER.map((status) =>
        rows
          .filter((r) => r.status === status)
          .map((r) => {
            const span = barSpan(r, day)
            if (!span) return null
            return (
              <span
                key={`${status}-${r.id}`}
                className={`absolute inset-y-0 rounded-full ${status === 'approved' ? 'bg-error' : 'bg-warning'}`}
                style={{ left: `${span.left.toFixed(2)}%`, width: `${span.width.toFixed(2)}%` }}
              />
            )
          }),
      )}
    </span>
  )
}

/**
 * One day cell, shared by both views — written twice and the two views start disagreeing the day
 * somebody edits one.
 *
 * ⚠️ THREE STATES CAN COINCIDE; THE ORDER IS selected > today > ordinary. "Today" is a reference
 * point, "selected" is what the reader just did, and what the reader just did must always win.
 *
 * 🔴 `min-h-11` IS A FLOOR THAT MUST BE DECLARED, not something the content happens to produce. A
 * month cell measures `p-1.5` (12) + `text-sm` (20) + `gap-0.5` (2) + the bar (6) + borders (2) =
 * **42 px**, under 44 on every screen. `justify-center` has to come with it, or the extra 2 px pile
 * up at the bottom instead of centring.
 */
function DayCell({
  day,
  slots,
  selected,
  today,
  strip,
  dim,
  onPick,
}: {
  day: Date
  slots: readonly VenueSlot[]
  selected: boolean
  today: boolean
  /** `true` in the week strip, which prints the weekday inside the cell. */
  strip: boolean
  /** `true` for a day outside the month being shown. */
  dim: boolean
  onPick: (day: Date) => void
}) {
  const { approved, pending } = countsOn(slots, day)
  const total = approved + pending
  const label = total
    ? [approved ? `อนุมัติแล้ว ${approved} รายการ` : '', pending ? `รอพิจารณา ${pending} รายการ` : '']
        .filter(Boolean)
        .join(' · ')
    : 'ว่างทั้งวัน'

  return (
    <button
      type="button"
      onClick={() => onPick(day)}
      aria-pressed={selected}
      aria-label={`${fmtD(day)} — ${label}`}
      className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-field border ${strip ? 'p-2' : 'p-1.5'} ${
        selected
          ? 'border-base-content bg-base-200'
          : today
            ? 'border-primary'
            : 'border-base-300'
      }${dim ? ' opacity-40' : ''} motion-safe:transition-colors`}
    >
      {strip ? (
        <span className="block text-xs text-base-content/60">{TH_DOW[day.getDay()]}</span>
      ) : null}
      <span className={`block text-sm font-medium${today && !selected ? ' text-primary' : ''}`}>
        {day.getDate()}
      </span>
      <DayBar slots={slots} day={day} />
    </button>
  )
}

export function AvailabilityCalendar({
  slots,
  view,
  onViewChange,
  anchorWeek,
  anchorMonth,
  onAnchorChange,
  selected,
  onSelect,
  today,
}: {
  slots: readonly VenueSlot[]
  view: CalendarView
  onViewChange: (view: CalendarView) => void
  /** Sunday of the week on show. */
  anchorWeek: Date
  /** First of the month on show. */
  anchorMonth: Date
  onAnchorChange: (next: { week: Date; month: Date }) => void
  selected: Date
  onSelect: (day: Date) => void
  today: Date
}) {
  /* ⚠️ THE RANGE LABEL PRINTS DIFFERENT THINGS IN THE TWO VIEWS. A month is `กันยายน 2569`; a week
     is the real span (`31 ส.ค. – 6 ก.ย. 2569`), because a label reading "กันยายน" over a week that
     straddles two months is a label that lies about half the row. The year is printed once, at the
     end — a week cannot straddle two years in a way that confuses. */
  const weekEnd = addDays(anchorWeek, 6)
  const rangeLabel =
    view === 'month'
      ? `${TH_MON_FULL[anchorMonth.getMonth()]} ${anchorMonth.getFullYear() + 543}`
      : `${fmtDShort(anchorWeek)} – ${fmtDShort(weekEnd)} ${weekEnd.getFullYear() + 543}`

  const step = (dir: -1 | 1) => {
    if (view === 'week') {
      const week = addDays(anchorWeek, dir * 7)
      onAnchorChange({ week, month: new Date(week.getFullYear(), week.getMonth(), 1) })
    } else {
      const month = new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() + dir, 1)
      onAnchorChange({ week: addDays(month, -month.getDay()), month })
    }
  }

  const pick = (day: Date) => {
    onSelect(day)
    onAnchorChange({
      week: addDays(day, -day.getDay()),
      month: new Date(day.getFullYear(), day.getMonth(), 1),
    })
  }

  /* The month grid opens on the previous month's tail rather than on blanks: somebody planning
     something at the end of a month needs to see what that week already holds. Out-of-month days
     are dimmed but remain tappable. It runs to 42 cells, stopping after 35 when the sixth row
     would be entirely outside the month. */
  const days: { day: Date; dim: boolean }[] = []
  if (view === 'week') {
    for (let i = 0; i < 7; i++) days.push({ day: addDays(anchorWeek, i), dim: false })
  } else {
    const first = new Date(anchorMonth.getFullYear(), anchorMonth.getMonth(), 1)
    const start = addDays(first, -first.getDay())
    for (let k = 0; k < 42; k++) {
      const day = addDays(start, k)
      if (k >= 35 && day.getMonth() !== anchorMonth.getMonth()) break
      days.push({ day, dim: day.getMonth() !== anchorMonth.getMonth() })
    }
  }

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-0 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="join w-full" role="group" aria-label="สลับมุมมองปฏิทิน">
            <button
              type="button"
              onClick={() => onViewChange('week')}
              aria-pressed={view === 'week'}
              className={`btn btn-app-sm join-item grow gap-1.5${view === 'week' ? ' btn-neutral' : ''}`}
            >
              <LIcon name="calendarRange" className="h-4 w-4 shrink-0" />
              รายสัปดาห์
            </button>
            <button
              type="button"
              onClick={() => onViewChange('month')}
              aria-pressed={view === 'month'}
              className={`btn btn-app-sm join-item grow gap-1.5${view === 'month' ? ' btn-neutral' : ''}`}
            >
              <LIcon name="calendarDays" className="h-4 w-4 shrink-0" />
              รายเดือน
            </button>
          </div>
        </div>

        <div className="divider my-3" />

        {/* ⚠️ A full 44 px on both arrows — an icon-only button has no text width to make up the
            target area. `min-h-11` must always accompany `h-11`, because daisyUI's `.btn` sets its
            own `min-height` and would otherwise win. */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => step(-1)}
            className="btn btn-ghost btn-square h-11 min-h-11 w-11"
            aria-label="ช่วงก่อนหน้า"
          >
            <LIcon name="chevronLeft" className="h-4 w-4" />
          </button>
          <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold">{rangeLabel}</p>
          <button
            type="button"
            onClick={() => step(1)}
            className="btn btn-ghost btn-square h-11 min-h-11 w-11"
            aria-label="ช่วงถัดไป"
          >
            <LIcon name="chevronRight" className="h-4 w-4" />
          </button>
        </div>

        {/* ⚠️ THE WEEKDAY HEADER ROW EXISTS ONLY IN MONTH VIEW. In the week strip each cell prints
            its own weekday on its top line, and having both is the same label stacked twice. */}
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

        <div
          role="group"
          aria-label={view === 'week' ? 'เลือกวันในสัปดาห์' : 'เลือกวันในเดือน'}
          className="-mx-4 mt-2 grid grid-cols-7 gap-1 px-1 sm:gap-2"
        >
          {days.map(({ day, dim }) => (
            <DayCell
              key={day.getTime()}
              day={day}
              slots={slots}
              selected={day.getTime() === selected.getTime()}
              today={day.getTime() === today.getTime()}
              strip={view === 'week'}
              dim={dim}
              onPick={pick}
            />
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-base-200/80 pt-3 text-xs text-base-content/60">
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2 w-3.5 rounded-full bg-error" />
            อนุมัติแล้ว
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2 w-3.5 rounded-full bg-warning" />
            รอพิจารณา
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2 w-3.5 rounded-full bg-base-300" />
            ว่าง
          </span>
        </div>
      </div>
    </div>
  )
}
