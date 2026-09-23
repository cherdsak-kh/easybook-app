/**
 * The day TIMELINE on ปฏิทินการจอง: a resource schedule (PO evaluation, 21 ก.ย. 2569), and the right
 * card's default view. Rows are venues and columns are the 24 hours, so an operator reads a day's
 * occupancy at a glance: the idle stretches, the staffing peaks, the overlaps. Design authority: the
 * prototype's `[data-cal-timeline]` markup and its `paintTimeline` / `venueRow` / `bar` / `aimTip` /
 * `roomForTips`. The geometry and the words are pure and live in `calendar-model.ts`.
 *
 *   ┌ สถานที่ ┬ 00:00 ─ 01:00 ─ … ─ 24:00 ┐  ← ruler, sticky top (the corner is sticky on both axes)
 *   │ venue   │   ▭▭▭    ▭▭▭▭▭▭           │  ← one row per venue, sticky left; a row grows a lane per overlap
 *
 * ── ONE SCROLLER, THREE STICKY LAYERS ──
 * The ruler row, the venue names and the corner stick inside the one `.cal-timeline-container`. See
 * the CSS note for the z-order. The container is a focusable, named region, because a day whose bars
 * are all off to the right must still be reachable and announced.
 *
 * ── 🔴 IT LANDS ON 08:00, INSTANTLY, AND ONLY FOR A NEW VIEW ──
 * `scrollLeft = LAND_AT` (8 * 70 - 20 = 540, the prototype's value) runs on mount and on a day change,
 * which is when a new view appears: another day, the switch to ไทม์ไลน์, the first load. A refetch
 * (realtime, or the refetch after a dialog write) re-renders the rows in the SAME scroller, so the
 * operator stays where they had scrolled to, as in the prototype. The jump is instant, not smooth.
 * The container is `scroll-behavior: smooth` for Tab and the arrow keys, and a programmatic jump
 * under it animates, which a re-render or the timer throttling can strand midway.
 *
 * ── The tooltip is daisyUI's, aimed by hand ──
 * Each bar is `tooltip` + `data-tip`, coloured by status (a clash wins, red). daisyUI centres the
 * bubble on the WHOLE bar, but the scroller shows only part of a 1680px track, so `aimTip` (on
 * pointerenter, on focus, and on every scroll while a bubble is up) aims it at the part of the bar in
 * view and keeps it inside the scroller. A bar with nothing in view is `cal-bar-away`: no bubble.
 * `roomForTips` pads the grid when a bubble fits neither above nor below its bar (a one-venue day).
 *
 * ⚠️ `aimTip` WRITES CLASSES REACT ALSO OWNS (`tooltip-top` / `tooltip-bottom`, `cal-bar-away`). That
 * is deliberate and safe. React only rewrites `className` when the value it renders CHANGES, so a
 * refetch that redraws the same bar leaves the aimed classes alone. When a bar's classes do change
 * (a clash appears), React writes the unscrolled default, and the next hover or focus re-aims it.
 */

import { useLayoutEffect, useMemo, useRef } from 'react'
import { Skeleton, SkeletonRegion } from '../../../components/feedback/Skeleton'
import type { CalendarBookingSlot } from '@/lib/api-client'
import {
  BAR_WIDE,
  HOUR_WIDTH,
  LAND_AT,
  barBox,
  barLabel,
  barTip,
  clashLabel,
  clashesOf,
  laneTop,
  packLanes,
  rowHeight,
  thaiDayLong,
  timelineRows,
  type PlacedSlot,
} from '../calendar-model'

const HOURS = Array.from({ length: 25 }, (_, h) => h)
const pad = (n: number) => String(n).padStart(2, '0')

/** daisyUI's `--tt-off` (`100% + .5rem`): the gap between a bar and its bubble. */
const TIP_GAP = 8

/** Instant, whatever the container's `scroll-behavior` says. See the header. */
function jump(el: HTMLElement, x: number, y: number) {
  el.style.scrollBehavior = 'auto'
  el.scrollLeft = x
  el.scrollTop = y
  el.style.scrollBehavior = ''
}

/**
 * Aim a bar's bubble at the part of the bar in view, and keep it inside the scroller
 * (`--cal-tip-x`, the tail `--cal-tail-x`). It opens UPWARD when that fits, else downward, else
 * toward the bigger gap. Over the pinned ruler is fine (the bar is z 40); out of the box is not.
 * Unscrolled, that is exactly the rendered default: lane 0 of the first row opens down, everything
 * else up. The prototype's function, line for line.
 */
function aimTip(b: HTMLElement, scroller: HTMLElement) {
  const box = scroller.getBoundingClientRect()
  const lo = Math.max(box.left + scroller.clientLeft, 0)
  const hi = Math.min(box.left + scroller.clientLeft + scroller.clientWidth, window.innerWidth)
  const top = Math.max(box.top + scroller.clientTop, 0)
  const bot = Math.min(box.top + scroller.clientTop + scroller.clientHeight, window.innerHeight)
  const names = scroller.querySelector('.cal-venue-name')?.getBoundingClientRect().right ?? lo
  const ruler = scroller.querySelector('.cal-tl-head')?.getBoundingClientRect().bottom ?? top
  const r = b.getBoundingClientRect()
  const mid = r.left + r.width / 2
  const from = Math.max(r.left, names)
  const to = Math.min(r.right, hi)
  // Nothing in view: no bubble, and not raised over the pinned layers. Measured in the prototype:
  // Esc out of the detail dialog hands focus back to the bar, and a wheel scroll then left its
  // bubble hanging over the ruler for a bar that was nowhere on screen.
  b.classList.toggle(
    'cal-bar-away',
    to - from < 12 || r.bottom <= Math.max(ruler, top) || r.top >= bot,
  )
  const tip = getComputedStyle(b, '::before')
  const w = parseFloat(tip.width)
  const h = parseFloat(tip.height) + TIP_GAP
  const aim = (from + to) / 2
  const left = Math.max(lo + 4, Math.min(aim - w / 2, hi - 4 - w))
  b.style.setProperty('--cal-tip-x', `${left + w / 2 - mid}px`)
  b.style.setProperty('--cal-tail-x', `${Math.max(left + 14, Math.min(aim, left + w - 14)) - mid}px`)
  const above = r.top - top
  const below = bot - r.bottom
  const down = above < h && (below >= h || below > above)
  b.classList.toggle('tooltip-bottom', down)
  b.classList.toggle('tooltip-top', !down)
}

/**
 * A bubble that fits neither above nor below its bar needs room made for it, and only a one-venue
 * day is that short: one lane is a 92px box for a bubble up to ~86px. The grid gains exactly the
 * missing height, below the last row. On a full day this measures 0 and changes nothing.
 */
function roomForTips(grid: HTMLElement) {
  grid.style.paddingBottom = ''
  const g = grid.getBoundingClientRect()
  let need = 0
  grid.querySelectorAll<HTMLElement>('.cal-bar').forEach((b) => {
    const r = b.getBoundingClientRect()
    const h = parseFloat(getComputedStyle(b, '::before').height) + TIP_GAP
    if (r.top - g.top < h) need = Math.max(need, h - (g.bottom - r.bottom))
  })
  if (need > 0) grid.style.paddingBottom = `${Math.ceil(need) + 4}px`
}

/** Bar placeholders per row: [left offset, width], in the ragged spread a real day has. */
const SKELETON_BARS = [
  ['ml-4', 'w-24'],
  ['ml-16', 'w-36'],
  ['ml-2', 'w-16'],
] as const

/**
 * The timeline while the day (or the venue list its rows follow) loads: the same frame, a 36px ruler
 * and three 56px one-lane rows behind the same venue column, so nothing jumps when the rows land.
 */
export function CalendarTimelineSkeleton() {
  return (
    <SkeletonRegion
      label="กำลังโหลดไทม์ไลน์ของวันนี้"
      className="overflow-hidden rounded-control border border-base-300 bg-base-100"
    >
      <div className="flex h-9 border-b border-base-300">
        <div className="flex w-36 shrink-0 items-center border-r border-base-300 px-3 sm:w-44">
          <Skeleton className="h-3 w-12" variant="soft" />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-8 overflow-hidden px-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-3 w-9 shrink-0" variant="soft" />
          ))}
        </div>
      </div>
      {SKELETON_BARS.map(([ml, w], i) => (
        <div key={i} className="flex h-14 border-b border-base-300 last:border-b-0">
          <div className="flex w-36 shrink-0 items-center border-r border-base-300 px-3 sm:w-44">
            <Skeleton className="h-3.5 w-24" />
          </div>
          <div className="flex min-w-0 flex-1 items-center overflow-hidden">
            <Skeleton className={`h-8 shrink-0 ${ml} ${w}`} variant="box" />
          </div>
        </div>
      ))}
    </SkeletonRegion>
  )
}

export function CalendarTimeline({
  day,
  slots,
  pool,
  venues,
  venueId,
  onOpen,
}: {
  /** The selected day. A new one lands the scroller on 08:00 again. */
  day: string
  /** The day's SHOWN slots (both filters applied), in server order. Never empty: the page shows its
      empty state instead, because a grid of empty rows would claim every room is free. */
  slots: readonly CalendarBookingSlot[]
  /** The day's UNFILTERED slots: the clash pool, exactly as for the agenda cards. */
  pool: readonly CalendarBookingSlot[]
  /** The venue list, or `null` if it could not be loaded. Then only the booked venues get a row. */
  venues: readonly { id: string; name: string }[] | null
  /** The venue filter, `''` for all. */
  venueId: string
  onOpen: (slot: CalendarBookingSlot) => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const grid = useRef<HTMLDivElement>(null)

  const rows = useMemo(
    () =>
      timelineRows(venues, slots, venueId).map((row) => ({ ...row, ...packLanes(row.slots) })),
    [venues, slots, venueId],
  )

  /* After every redraw: the bubbles' room first, then (for a new view only) the landing. */
  useLayoutEffect(() => {
    if (grid.current) roomForTips(grid.current)
  }, [rows])

  useLayoutEffect(() => {
    if (scroller.current) jump(scroller.current, LAND_AT, 0)
  }, [day])

  /* A bubble that is up rides along with a scroll (a wheel under the pointer, or the smooth scroll
     that brings a Tab-focused bar into view): re-aim it. */
  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    el.querySelectorAll<HTMLElement>('.cal-bar:hover, .cal-bar:focus-visible').forEach((b) =>
      aimTip(b, el),
    )
  }

  const aim = (b: HTMLElement) => {
    if (scroller.current) aimTip(b, scroller.current)
  }

  const bar = (p: PlacedSlot, venueName: string, top: boolean) => {
    const s = p.slot
    const { left, width } = barBox(p.start, p.end)
    const wide = width >= BAR_WIDE
    const ok = s.status === 'APPROVED'
    // PENDING only (PO): an approved bar stays calm green. No red ring, chip, bubble or clash text.
    const clash = clashLabel(s, clashesOf(s, pool))
    return (
      <button
        key={s.id}
        type="button"
        className={
          `cal-bar ${ok ? 'cal-bar-ok' : 'cal-bar-wait'}${clash ? ' cal-bar-clash' : ''} tooltip ` +
          `${top ? 'tooltip-bottom' : 'tooltip-top'} ` +
          (clash ? 'tooltip-error' : ok ? 'tooltip-success' : 'tooltip-warning')
        }
        style={{ left, width, top: laneTop(p.lane) }}
        data-tip={barTip(s, venueName, clash)}
        aria-label={barLabel(s, venueName, clash)}
        onClick={() => onOpen(s)}
        onPointerEnter={(e) => aim(e.currentTarget)}
        onFocus={(e) => aim(e.currentTarget)}
      >
        {/* Everything visible sits in ONE clipping label, so the bar itself can let its bubble out. */}
        <span className="cal-bar-label">
          {/* No `title` on the chip: the red bubble already leads with the clash, and a second,
              native tooltip would compete with it. The clash is in the bar's name too. */}
          {clash && (
            <span className="cal-bar-chip">
              <svg
                aria-hidden="true"
                className="cal-bar-ico"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" d="M12 6v7m0 5h.01" />
              </svg>
            </span>
          )}
          <svg
            aria-hidden="true"
            className="cal-bar-ico"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="cal-bar-text">
            <span className="cal-bar-time">{wide ? `${s.start}–${s.end}` : s.start}</span>
            {wide && ` · ${s.purpose}`}
          </span>
        </span>
      </button>
    )
  }

  return (
    <div
      ref={scroller}
      role="region"
      aria-label={`ไทม์ไลน์การใช้สถานที่ ${thaiDayLong(day)}`}
      tabIndex={0}
      onScroll={onScroll}
      className="cal-timeline-container lg:min-h-0"
    >
      <div ref={grid} className="cal-timeline-grid">
        {/* Every bar's name already carries its own times and venue, so the ruler is decoration. */}
        <div className="cal-tl-head" aria-hidden="true">
          <div className="cal-venue-col-header">สถานที่</div>
          <div className="cal-time-header">
            {HOURS.map((h) => (
              <span
                key={h}
                className="cal-hour"
                // The two ends would hang half outside the ruler if centred, so 00:00 starts at the
                // left edge and 24:00 ends at the right one.
                style={{
                  left: h === 0 ? 6 : h === 24 ? 24 * HOUR_WIDTH - 6 : h * HOUR_WIDTH,
                  translate: h === 0 ? '0 0' : h === 24 ? '-100% 0' : undefined,
                }}
              >
                {pad(h)}:00
              </span>
            ))}
          </div>
        </div>
        <div>
          {rows.map((row, i) => (
            <div
              key={row.venueId}
              className="cal-venue-row"
              style={{ height: rowHeight(row.lanes) }}
            >
              <div className="cal-venue-name" title={row.name}>
                <span>{row.name}</span>
              </div>
              <div className="cal-track">
                {/* Lane 0 of the FIRST row opens its bubble downward: upward it would run out of
                    the top of the scroller. `aimTip` refines this once the operator scrolls. */}
                {row.placed.map((p) => bar(p, row.name, i === 0 && p.lane === 0))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
