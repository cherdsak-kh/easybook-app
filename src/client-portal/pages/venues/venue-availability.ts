/**
 * What a venue's calendar is made of: slots, the day they fall on, and their share of a 24-hour bar.
 *
 * Ported from the prototype's `venueSlots` (3640), `vdOn` (3714) and `vdSpan` (3735). Pure
 * functions over `Date`s — no React, no fetching, so a spec for anything here would be testing a
 * function rather than a rendering (`CONVENTIONS.md` §2 permits that; it forbids component specs).
 *
 * ── 🔴 THE DATA THIS FILE SHAPES DOES NOT EXIST YET ──
 * `TRANSPORT.md` §3.1 puts "`GET` venue availability for a date range" under **`CLIENT-BOOKING-1`**,
 * which is **Phase 5a** and unbuilt: `easybook-service` has the Prisma models (`BookingRequest` /
 * `BookingSlot`, added 2 ก.ย. 2569) but no `src/bookings/` module and no route. So in production
 * every day is empty today, and the screen answers "ไม่มีรายการจองในวันนี้" — which is a *correct*
 * screen, not a broken one, and is the state the empty-day card was designed for. See
 * `venues-api.ts` for the seam this arrives through.
 */

/**
 * ⚠️ APPROVED AND PENDING ARE DIFFERENT FACTS AND MUST NOT BE COLLAPSED (`TRANSPORT.md` §3.1).
 * A pending request holds nothing — several people may ask for the same hours and all of them get
 * `PENDING` (P2 rule 1, prototype 1230). Painting the two the same colour misinforms in both
 * directions: it tells a reader a free slot is taken, and it tells them an approved booking is
 * merely proposed.
 */
export type SlotStatus = 'approved' | 'pending'

/** One booked span on one venue, already resolved to local `Date`s. */
export type VenueSlot = {
  id: string
  start: Date
  end: Date
  status: SlotStatus
  /** What the room was asked for. Shown as the slot card's heading. */
  purpose: string
  /** Who asked. `D-C13` — an UNAPPROVED request never reveals this, so it is blank for `pending`. */
  requester: string
  /** `true` when the signed-in LINE user is the requester; draws the `คุณ` badge. */
  mine: boolean
}

export const DAY_MS = 86_400_000

/** Local midnight at the start of `dt`'s day. */
export function midnight(dt: Date): Date {
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
}

export function addDays(dt: Date, n: number): Date {
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n)
}

/**
 * Do two spans overlap? Prototype 3639 (`overlaps`), and the single definition of the predicate
 * every screen in this portal asks about.
 *
 * 🔴 HALF-OPEN, `[start, end)` — a span ending 12:00 and one starting 12:00 do NOT overlap. The
 * schema comment on `BookingSlot` says the same thing and gives the reason: writing one of the
 * several copies of this predicate with `<=` produces phantom conflicts nobody can reproduce. This
 * is that one copy.
 */
export function overlaps(
  a: { start: Date; end: Date },
  b: { start: Date; end: Date },
): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime()
}

/**
 * How far back and forward a screen asks the availability endpoint to look.
 *
 * ⚠️ ONE WINDOW PER SCREEN VISIT, NOT ONE PER CALENDAR PAGE. The endpoint defaults to the current
 * month, which is exactly what the calendar opens on — and then the first press of the "next month"
 * arrow would show an empty month that is not empty. Fetching per page would fix that with a
 * request on every arrow press and a spinner over a grid that was already correct; fetching a wide
 * window once costs one query for a few dozen rows of one venue.
 *
 * ⚠️ IT STARTS IN THE PAST ON PURPOSE. A span that began yesterday still occupies today, and the
 * server matches on OVERLAP rather than containment — so a window starting at today's midnight
 * would drop a two-day camp from the day it is still running on.
 *
 * ⚠️ Well inside the server's 366-day ceiling (this is ~7 months), which is a 400 rather than a
 * truncation. Widening it past a year turns every calendar into an error state.
 */
export function availabilityWindow(now = new Date()): { from: Date; to: Date } {
  return {
    from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    to: new Date(now.getFullYear(), now.getMonth() + 6, 1),
  }
}

/**
 * Every slot that overlaps `day`, ordered by when it becomes visible **on that day**.
 *
 * ⚠️ A SPAN THAT CROSSES MIDNIGHT APPEARS ON EVERY DAY IT TOUCHES. A two-day scout camp has to be
 * findable from the second day as well as the first.
 *
 * ⚠️ THE SORT KEY IS `max(start, day-start)`, NOT `start`. A camp that began yesterday occupies
 * today from 00:00, so it belongs above a 09:00 meeting — sorting on the real start would drop it
 * to the bottom of a list it dominates.
 *
 * ⚠️ `approved` is collected before `pending` so that, at equal visible start times, the certain
 * fact is listed first. The bar below reverses this for painting; see {@link BAR_PAINT_ORDER}.
 */
export function slotsOn(slots: readonly VenueSlot[], day: Date): VenueSlot[] {
  const d0 = day.getTime()
  const d1 = d0 + DAY_MS
  const out: VenueSlot[] = []
  for (const status of ['approved', 'pending'] as const) {
    for (const s of slots) {
      if (s.status !== status) continue
      if (s.start.getTime() < d1 && s.end.getTime() > d0) out.push(s)
    }
  }
  return out.sort(
    (a, b) => Math.max(a.start.getTime(), d0) - Math.max(b.start.getTime(), d0),
  )
}

/**
 * 🔴 THE FLOOR A SEGMENT ON THE DAY BAR MAY SHRINK TO, AS A PERCENTAGE. Prototype 3734.
 *
 * A half-hour booking is 2.08 % of a day, which on a 44 px calendar cell is **0.9 px** — a hair
 * nobody sees, on the one mark that says the day is not free.
 */
export const BAR_MIN_PCT = 8

/**
 * Where one slot sits on `day`'s 24-hour bar, as `{ left, width }` percentages, or `null` when it
 * does not touch the day at all.
 *
 * ⚠️ THE SPAN IS CLIPPED TO THE DAY FIRST. A camp that started at 15:00 yesterday must fill today's
 * bar **from the far left**, not begin at 62.5 % where its real start time falls.
 *
 * 🔴 THE 8 % FLOOR GROWS THE BAR IN BOTH DIRECTIONS, NOT JUST RIGHTWARD. Widening only the right
 * edge sends a 23:30–24:00 span past 100 %, where `overflow-hidden` clips it straight back to the
 * width it started with — so when the right edge hits the end, the left edge is pulled back
 * instead.
 *
 * ⚠️ Accepted knowingly: a very short booking reads *longer* than it is. This bar is an index that
 * invites a tap, not a timetable to read values off — the real times are in the cards below the
 * calendar.
 */
export function barSpan(slot: VenueSlot, day: Date): { left: number; width: number } | null {
  const d0 = day.getTime()
  const start = Math.max(slot.start.getTime(), d0)
  const end = Math.min(slot.end.getTime(), d0 + DAY_MS)
  if (end <= start) return null

  let left = ((start - d0) / DAY_MS) * 100
  let width = ((end - start) / DAY_MS) * 100
  if (width < BAR_MIN_PCT) {
    width = BAR_MIN_PCT
    if (left + width > 100) left = 100 - width
  }
  return { left, width }
}

/**
 * 🔴 PAINT `pending` FIRST, `approved` SECOND — the later one wins where they overlap.
 *
 * The two genuinely can overlap (P2 rule 1: a pending request holds nothing), and "approved" is the
 * more certain fact, so it must be the colour a reader sees when both cover the same minutes.
 */
export const BAR_PAINT_ORDER: readonly SlotStatus[] = ['pending', 'approved']

/** How many of each status fall on `day` — for the cell's `aria-label`. */
export function countsOn(slots: readonly VenueSlot[], day: Date): { approved: number; pending: number } {
  const rows = slotsOn(slots, day)
  const approved = rows.filter((r) => r.status === 'approved').length
  return { approved, pending: rows.length - approved }
}
