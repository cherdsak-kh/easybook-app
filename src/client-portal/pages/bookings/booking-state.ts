import type { LIconName } from '@/client-portal/icons/licon'
import { midnight } from '@/client-portal/lib/formatters'
import type { components } from '@/lib/api-types'

/**
 * Everything `#/bookings` and `#/booking/:id` DERIVE, with no React in sight.
 *
 * ── 🔴 SIX STATES ON SCREEN, FIVE IN THE DATABASE, AND ONLY `done` IS DERIVED ──
 * The server ships `PENDING | APPROVED | REJECTED | CANCELLED | EXPIRED`. `หมดเวลาพิจารณา` is the
 * STORED `EXPIRED`, written by the server's expiry job when a request is still pending at its first
 * slot's start (`#ISSUE-06`, PO 2026-09-14, superseding D-C13's computed rule). It is the ONLY
 * definition of "expired": nothing here compares the phone's clock to a slot to decide it. A pending
 * request past its start that the job has not swept yet IS still `pending` (accepted gap, ≤60 s).
 * `สิ้นสุดแล้ว` (`done`) is the one state still derived, because it has no stored status.
 *
 * ⚠️ THE STATUS FILTER IS `?state=`, AND THE SERVER MIRRORS {@link bookingState} RULE FOR RULE
 * (`CLIENT-PAGINATION-1`). The list is paginated, so bucketing page 1 of 5 in the browser would give
 * a wrong count and a "load more" that never ends. `state=pending|approved|history` is bucketed by
 * `stateWhere()` in `easybook-service`'s `bookings.service.ts`; the old stored-enum `status`
 * parameter is gone (a 400). **This file still decides every BADGE**, on the phone's clock — the two
 * clocks may disagree for a moment at a booking's last minute, which is accepted and self-correcting.
 * Do NOT re-filter server rows with `bookingState()`: that reintroduces the wrong totals.
 */

export type Booking = components['schemas']['BookingListItemDto']
export type BookingDetail = components['schemas']['BookingDetailResponseDto']
export type BookingSlot = components['schemas']['BookingSlotResponseDto']

/** The four sort values, spelled exactly as the endpoint and the prototype's `MB_SORTS` spell them. */
export type BookingSort = 'created-desc' | 'created-asc' | 'event-asc' | 'event-desc'

/**
 * The six badges. `done` is computed; the other five are the stored statuses lowercased.
 *
 * ⚠️ `done` AND `expired` ARE NOT THE SAME EVENT WEARING TWO LABELS. `done` is an approved booking
 * whose day has passed — it happened. `expired` is a request nobody ruled on before its day passed
 * — it did not happen, and nobody said no. Collapsing them would tell a user their event took place.
 */
export type BookingState = 'pending' | 'approved' | 'done' | 'expired' | 'rejected' | 'cancelled'

/**
 * The note an `expired` request shows when its stored `rejectReason` is somehow empty. Byte-equal to
 * the server's `AUTO_EXPIRED_REASON` (`01_plan_log.md` AC-8.7). The stored reason is what renders
 * normally; this only covers a null so the card never prints an empty note.
 */
export const EXPIRED_REASON_FALLBACK =
  'คำขอหมดอายุโดยอัตโนมัติ เนื่องจากเลยกำหนดเวลาเริ่มต้นใช้งานโดยยังไม่ได้รับการพิจารณา'

/** The four buckets the status dropdown offers. `history` is the union of the last four states. */
export type StatusFilter = '' | 'pending' | 'approved' | 'history'

export const STATUS_LABEL: Record<StatusFilter, string> = {
  '': 'ทุกสถานะ',
  pending: 'รอพิจารณา',
  approved: 'อนุมัติแล้ว',
  history: 'ประวัติ/สิ้นสุดแล้ว',
}

/** Two labels per sort, and they are not the same words abbreviated — see the note in `MyBookingsPage`. */
export const SORTS: readonly { value: BookingSort; long: string; short: string }[] = [
  { value: 'created-desc', long: 'วันที่ยื่นคำขอ: ล่าสุด – เก่าสุด', short: 'ยื่นล่าสุด' },
  { value: 'created-asc', long: 'วันที่ยื่นคำขอ: เก่าสุด – ล่าสุด', short: 'ยื่นเก่าสุด' },
  { value: 'event-asc', long: 'วันที่ใช้งาน: เร็วที่สุดก่อน', short: 'ใช้วันเร็วสุด' },
  { value: 'event-desc', long: 'วันที่ใช้งาน: ช้าที่สุดก่อน', short: 'ใช้วันช้าสุด' },
]

/** The slots that still occupy a calendar. Everything downstream counts these, not `slots.length`. */
export function liveSlots(b: { slots: BookingSlot[] }): BookingSlot[] {
  return b.slots.filter((s) => !s.isCancelled)
}

/**
 * When this booking is over: the LATEST end across **every** slot, cancelled ones included.
 *
 * 🔴 COMPUTED FROM THE SLOTS, NOT READ FROM `lastEndAt`. The column is recomputed server-side over
 * the *surviving* slots on every cancellation, so a request whose last day was dropped would report
 * an earlier end and jump into the history bucket while its remaining days are still ahead. A row
 * with every slot cancelled would report the window of whichever slot went last. The slots are on
 * the payload, so the honest number is free.
 *
 * ⚠️ THE LATEST, NOT THE FIRST (`CHECKLIST.md`). A three-day repeat has not finished until day three.
 */
export function lastEnd(b: { slots: BookingSlot[] }): number {
  return b.slots.reduce((max, s) => Math.max(max, new Date(s.endAt).getTime()), 0)
}

/**
 * The badge this booking wears right now. Prototype `mbState` (4609), rule for rule.
 *
 * The order of the tests is the ruling:
 *   · cancelled — or every slot cancelled — stays `cancelled` whether or not the day has passed;
 *   · rejected stays `rejected` for the same reason: the refusal reason still has to be readable;
 *   · stored `EXPIRED` is `expired` — read from the status, never from the clock;
 *   · past its last end → approved becomes `done`; pending stays `pending` until the server expires it;
 *   · otherwise, what the server stored.
 *
 * ⚠️ `!liveSlots.length` IS A BELT TO THE SERVER'S BRACES. The cancel endpoint flips the request
 * when its last live slot goes, so the two agree today — but the admin surface (unbuilt) will also
 * write these rows, and a request rendered as `APPROVED` with nothing live would sit in the
 * approved bucket looking like something that is still going to happen.
 */
export function bookingState(b: Booking | BookingDetail, now = Date.now()): BookingState {
  if (b.status === 'CANCELLED' || liveSlots(b).length === 0) return 'cancelled'
  if (b.status === 'REJECTED') return 'rejected'
  if (b.status === 'EXPIRED') return 'expired'
  if (b.status === 'APPROVED' && now > lastEnd(b)) return 'done'
  return b.status === 'APPROVED' ? 'approved' : 'pending'
}

/** The four states that are over. All four are greyed, because what a reader needs from them is one thing: nothing left to do. */
export function isHistory(state: BookingState): boolean {
  return state === 'done' || state === 'expired' || state === 'rejected' || state === 'cancelled'
}

/**
 * Badge presentation for all six.
 *
 * 🔴 GREEN FOR `approved` ON THIS SCREEN, WHERE THE VENUE CALENDAR PAINTS THE SAME FACT RED
 * (`Q-C4` ④). There, red means *you cannot ask for this*; here it is **your own booking, granted**.
 * The colour answers a different question on each screen because the reader is a different party to
 * the same row.
 *
 * ⚠️ THE FADED FORMULA ON ALL SIX: `/20` fill, `/40` border, `text-base-content` — never a solid
 * `badge-success`. A mix of solid and faded badges in one list reads as two ranks of importance
 * that nothing in the data supports, and daisyUI's solid `badge-*` puts white on a mid-tone in the
 * light theme, which is where AA goes.
 */
export const STATE_BADGE: Record<
  BookingState,
  { cls: string; icon: LIconName; tone: string; label: string }
> = {
  approved: {
    cls: 'border-success/40 bg-success/20 text-base-content',
    icon: 'circleCheck',
    tone: 'text-success',
    label: 'อนุมัติแล้ว',
  },
  pending: {
    cls: 'border-warning/40 bg-warning/20 text-base-content',
    icon: 'clock',
    tone: 'text-warning',
    label: 'รอพิจารณา',
  },
  done: {
    cls: 'border-base-content/20 bg-base-200 text-base-content/70',
    icon: 'history',
    tone: '',
    label: 'สิ้นสุดแล้ว',
  },
  expired: {
    cls: 'border-base-content/20 bg-base-200 text-base-content/70',
    icon: 'clock',
    tone: '',
    label: 'หมดเวลาพิจารณา',
  },
  rejected: {
    cls: 'border-error/40 bg-error/20 text-base-content',
    icon: 'circleX',
    tone: 'text-error',
    label: 'ไม่ได้รับอนุมัติ',
  },
  cancelled: {
    cls: 'border-base-content/20 bg-base-200 text-base-content/70',
    icon: 'circleX',
    tone: '',
    label: 'ยกเลิกแล้ว',
  },
}

/**
 * May the reader cancel this slot themselves? Prototype `mbCanCancel` (4634).
 *
 * 🔴 THE LEAD TIME APPLIES TO `approved` ONLY, and that is `Q-C4` read together with `D-C13` rule 4
 * rather than leniency: a pending request **holds nothing for anybody**, so withdrawing it releases
 * nothing that an operator needs warning about. There is nothing for a lead time to protect.
 *
 * ⚠️ MEASURED AGAINST THE **START**, never the end. Cancelling halfway through an event is not a
 * cancellation, and comparing against the end would offer the button right up to the final minute.
 *
 * ⚠️ `leadMinutes` IS PASSED IN, NEVER A CONSTANT HERE (`Q-C4` ①). It is a row in `app_settings`
 * that an operator may change, and it reaches this screen on the detail response. A default written
 * here would go stale silently the first time that row is edited.
 */
export function canCancelSlot(
  slot: BookingSlot,
  state: BookingState,
  leadMinutes: number,
  now = Date.now(),
): boolean {
  if (slot.isCancelled) return false
  if (state === 'pending') return new Date(slot.endAt).getTime() > now
  if (state !== 'approved') return false
  return new Date(slot.startAt).getTime() - now >= leadMinutes * 60_000
}

/** Does this slot run past midnight? Its end is folded back a millisecond first — 24:00 belongs to the day that finished. */
export function crossesDay(slot: BookingSlot): boolean {
  const start = new Date(slot.startAt)
  const end = new Date(new Date(slot.endAt).getTime() - 1)
  return midnight(start).getTime() !== midnight(end).getTime()
}

/**
 * 🔴 WHICH ENDPOINT CANCELS THIS BOOKING — decided by its STATUS, never by which button was pressed.
 *
 * This is the one place the screen and the API disagree in shape, and getting it wrong is a 422 the
 * user reads as a broken button:
 *
 * | Booking | The button the prototype draws | The call that works |
 * |---|---|---|
 * | `PENDING`, one slot | one full-width "ยกเลิกคำขอนี้" | `PATCH /:id/cancel` |
 * | `APPROVED`, one slot | one full-width "ยกเลิกการจองนี้" | **`PATCH /:id/slots/:slotId/cancel`** |
 * | `APPROVED`, many slots | one per row, "ยกเลิกวันนี้" | `PATCH /:id/slots/:slotId/cancel` |
 *
 * The middle row is the trap: the button looks like the one above it and cancels the whole booking
 * from the user's point of view, but `PATCH /:id/cancel` is `PENDING`-only server-side. The per-slot
 * route reaches the identical end state — the server flips the request to `CANCELLED` when its last
 * live slot goes — so the outcome the user sees is the same and the request is legal.
 */
export function cancelRouteFor(
  state: BookingState,
): 'whole' | 'slot' {
  return state === 'pending' ? 'whole' : 'slot'
}
