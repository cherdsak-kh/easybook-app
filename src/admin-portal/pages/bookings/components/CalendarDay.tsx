/**
 * One cell of ปฏิทินการจอง's month grid: a day button with a density readout.
 *
 * The readout is drawn TWICE, and CSS picks one. `.cal-pills` (≥ `xl`) is up to two start times and
 * then `+N`. `.cal-dots` (< `xl`) is up to three dots and then `+`. The short-window rule in
 * `admin-portal.css` also forces dots at lg+ when the viewport is under 960px tall. Rendering both
 * and letting the stylesheet choose keeps the breakpoint in one place, the CSS.
 *
 * ⚠️ STATUS IS NEVER COLOUR ALONE. อนุมัติแล้ว is a SOLID pill and a FILLED dot. รอพิจารณา is a
 * DASHED pill and a HOLLOW ring.
 *
 * ⚠️ THE ACCESSIBLE NAME IS THE `aria-label`, never the decoration inside. It carries the full Thai
 * date and the counts, so a screen reader hears "วันศุกร์ที่ 18 กันยายน 2569 · 3 รายการ …" rather
 * than "18 08:30 09:00 +1". While the window is loading (`list === null`) it carries the date alone.
 * Saying "ไม่มีรายการจอง" about a day that has not been read yet would be a false claim.
 */

import { BOOKING_STATUS_LABEL } from '../../../labels'
import { parseDay, tally, thaiDayLong } from '../calendar-model'
import type { CalendarBookingSlot } from '@/lib/api-client'

/** Per cell from `xl`. A third makes a six-week month taller than the viewport (prototype). */
const PILLS = 2
/** Per cell below `xl`. */
const DOTS = 3

export function CalendarDay({
  day,
  outside,
  selected,
  today,
  tabStop,
  list,
  onSelect,
}: {
  day: string
  /** A padding day from the previous or next month. Still clickable, and clicking pages to it. */
  outside: boolean
  selected: boolean
  today: boolean
  /** The one cell in the tab order (roving tabindex). */
  tabStop: boolean
  /** This day's slots AFTER the filters, or `null` while the window is loading. */
  list: readonly CalendarBookingSlot[] | null
  onSelect: (day: string) => void
}) {
  let label = thaiDayLong(day) + (today ? ' (วันนี้)' : '')
  if (list) {
    const t = tally(list)
    label +=
      ' · ' +
      (list.length
        ? `${list.length} รายการ อนุมัติแล้ว ${t.approved} รอพิจารณา ${t.pending}`
        : 'ไม่มีรายการจอง')
  }

  return (
    <button
      type="button"
      data-cal-day={day}
      className={`cal-day${outside ? ' cal-day-out' : ''}${selected ? ' cal-day-sel' : ''}`}
      tabIndex={tabStop ? 0 : -1}
      aria-pressed={selected}
      aria-current={today ? 'date' : undefined}
      aria-label={label}
      onClick={() => onSelect(day)}
    >
      <span className={`cal-num${today ? ' cal-num-today' : ''}`}>{parseDay(day).d}</span>
      {list && list.length > 0 && (
        <>
          <span className="cal-pills">
            {list.slice(0, PILLS).map((s) => (
              <span
                key={s.id}
                className={`cal-pill ${s.status === 'APPROVED' ? 'cal-pill-ok' : 'cal-pill-wait'}`}
                title={`${s.start}–${s.end} น. · ${s.venueName} · ${BOOKING_STATUS_LABEL[s.status]}`}
              >
                {s.start}
              </span>
            ))}
            {list.length > PILLS && (
              <span className="cal-more text-center">+{list.length - PILLS}</span>
            )}
          </span>
          <span className="cal-dots">
            {list.slice(0, DOTS).map((s) => (
              <span
                key={s.id}
                className={`cal-dot ${s.status === 'APPROVED' ? 'cal-dot-ok' : 'cal-dot-wait'}`}
              />
            ))}
            {list.length > DOTS && <span className="cal-more">+</span>}
          </span>
        </>
      )}
    </button>
  )
}
