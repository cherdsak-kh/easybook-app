import { Link } from 'react-router-dom'
import {
  STATE_BADGE,
  bookingState,
  isHistory,
  type Booking,
  type BookingDetail,
  type BookingState,
} from '../booking-state'
import { SlotCapsule } from './SlotCapsule'
import { LIcon } from '@/client-portal/icons/LucideIcon'
import { fmtD } from '@/client-portal/lib/formatters'

/**
 * One booking in the `#/bookings` list. Prototype `mbCard` (4767).
 *
 * ── 🔴 THE WHOLE CARD IS THE TARGET, AND IT CARRIES NO BUTTONS ──
 * Cancellation used to live in this footer and was moved to `#/booking/:id` wholesale
 * (2 ก.ย. 2569), for two reasons that are still true:
 *   1. the card body is already a link that navigates, so a destructive button inside it means a
 *      finger that misses by 8 px turns "open this" into "open the cancel sheet";
 *   2. this list is for **scanning**, not for deciding — cancelling needs context a summary card
 *      cannot show (when it was submitted, every slot, the refusal reason).
 * The footer therefore says *where* to cancel rather than falling silent, or somebody who came here
 * to cancel would find a list on which nothing can be done.
 *
 * ── ⚠️ `grayscale` FOR HISTORY, AND **NOT** `opacity-80` ──
 * The prototype writes `opacity-80 grayscale`; `CHECKLIST.md` Phase 6 says grayscale, **never**
 * opacity, and the checklist wins here because it states a measurement: opacity multiplies down the
 * whole tree, so `text-base-content/60` inside an 80 %-opaque card renders at an effective 0.48 and
 * drops under AA. `grayscale` removes the colour without touching any contrast ratio. Measured on
 * both, both themes — see the phase log.
 *
 * ── ⚠️ THE SHADOW STAYS ON HISTORY CARDS ──
 * `base-100` on `base-200` measures **1.05** in the light theme. The shadow is the only thing making
 * a card a card; removing it does not flatten the card, it deletes it.
 */

export function BookingCard({ booking }: { booking: Booking }) {
  const state = bookingState(booking)
  const past = isHistory(state)

  return (
    <article
      className={`card overflow-hidden bg-base-100 shadow-sm${
        past ? ' grayscale' : ' motion-safe:transition-shadow hover:shadow-md'
      }`}
    >
      <Link
        to={`/booking/${booking.id}`}
        className="block focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <div className="flex items-center justify-between gap-2 border-b border-base-300/60 px-4 py-2.5 text-xs">
          <div className="flex min-w-0 items-baseline gap-1.5">
            {/* `font-mono` on the code and nowhere else: it is the one string on this screen a
                person reads aloud or types back in, and a monospace run is what makes `0` and `O`
                distinguishable while doing it. */}
            <span className="shrink-0 font-mono font-semibold text-base-content/80">
              #{booking.code}
            </span>
            {/* Pure decoration between two labelled items — hidden from the reader that would
                otherwise announce it, which is also why its contrast is not a text requirement. */}
            <span aria-hidden="true" className="shrink-0 text-base-content/40">
              ·
            </span>
            <span className="truncate text-base-content/60">
              ยื่นเมื่อ {fmtD(new Date(booking.createdAt))}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <StateBadge state={state} />
            <LIcon name="chevronRight" className="h-3.5 w-3.5 text-base-content/60" />
          </div>
        </div>
        <div className="card-body gap-0 p-4 text-base">
          <BookingSubject booking={booking} state={state} />
        </div>
      </Link>
      <CardFooter booking={booking} state={state} />
    </article>
  )
}

/** The faded badge, all six states. See {@link STATE_BADGE} for why none of them is solid. */
export function StateBadge({ state, size = 'badge-sm' }: { state: BookingState; size?: string }) {
  const badge = STATE_BADGE[state]
  return (
    <span
      className={`badge ${size} shrink-0 gap-1 whitespace-nowrap font-medium ${badge.cls}`}
    >
      <LIcon name={badge.icon} className={`h-3 w-3 shrink-0 ${badge.tone}`} />
      {badge.label}
    </span>
  )
}

/**
 * Purpose, venue, attendees, then the time capsule. Shared by the card and the detail screen —
 * prototype `mbSubject` (4710), which is shared for the same reason.
 *
 * ⚠️ **PURPOSE FIRST.** Somebody scanning seven of their own requests remembers *what they were
 * organising*, not the reference number.
 *
 * ⚠️ VENUE AND LOCATION ARE SEPARATED BY `·`, NEVER BY PARENTHESES. Two venues in this dataset have
 * brackets inside their own names (`ลานกิจกรรม (ข้างพระนเรศวร)`), and wrapping the location in a
 * second pair produces nesting nobody can parse.
 */
export function BookingSubject({
  booking,
  state,
  leadMinutes,
  onCancelSlot,
}: {
  booking: Booking | BookingDetail
  state: BookingState
  leadMinutes?: number
  onCancelSlot?: (slot: Booking['slots'][number]) => void
}) {
  return (
    <>
      <div>
        <span className="block text-xs font-normal text-base-content/60">วัตถุประสงค์:</span>
        <h2 className="mt-0.5 text-sm font-semibold leading-snug text-base-content">
          {booking.purpose}
        </h2>
      </div>
      <div className="mt-2 space-y-1 text-xs">
        <p className="flex items-start gap-1.5 text-base-content/80">
          <LIcon name="building2" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="min-w-0">
            {booking.venue.name}
            {booking.venue.location ? (
              <span className="text-base-content/70"> · {booking.venue.location}</span>
            ) : null}
          </span>
        </p>
        <p className="flex items-center gap-1.5 text-base-content/70">
          <LIcon name="users" className="h-3.5 w-3.5 shrink-0" />
          {/* 🔴 `คน`, never `ที่นั่ง` (PO, 2 ก.ย. 2569) — half these venues have no chairs. */}
          <span>ผู้เข้าร่วม {booking.attendees.toLocaleString('th-TH')} คน</span>
        </p>
      </div>
      <SlotCapsule
        slots={booking.slots}
        state={state}
        leadMinutes={leadMinutes}
        onCancel={onCancelSlot}
      />
    </>
  )
}

/**
 * The footnote under the divider. Prototype `mbFooter` (4746).
 *
 * ⚠️ ONE ICON FOR ALL SIX STATES (`info`). The prototype cycled five and removed them: the icon
 * competed with the status badge at the top of the same card, which already says the same thing in
 * both colour and words. A second symbol that changes adds decoding work and no information.
 *
 * ── 🟠 THE "WHY CAN'T I CANCEL" LINE IS THE ONE THING THIS CARD CANNOT SAY ──
 * The prototype prints `ยกเลิกเองได้ก่อนเริ่มอย่างน้อย 30 นาที` here, from a module-level constant.
 * In the real app that number is a row in `app_settings` and it arrives on the **detail** response
 * only — `BookingListItemDto` does not carry `cancelLeadMinutes`, so this footer genuinely does not
 * know it. Hard-coding 30 would print a number that goes wrong the first time an operator edits the
 * row, which is worse than not printing one. The note therefore points at the screen that does know,
 * and that screen states the rule in full. Closing this properly is one integer on the list DTO —
 * recorded as a Phase 6a follow-up rather than guessed at here.
 */
function CardFooter({ booking, state }: { booking: Booking; state: BookingState }) {
  const note = (text: string) => (
    <div className="border-t border-base-300/60 px-4 py-2 text-xs">
      <p className="flex min-h-8 items-center gap-1.5 text-base-content/70">
        <LIcon name="info" className="h-3.5 w-3.5 shrink-0" />
        <span>{text}</span>
      </p>
    </div>
  )

  if (state === 'done') return note('การใช้งานสถานที่นี้เสร็จสิ้นแล้ว')
  if (state === 'expired') return note('คำขอนี้เลยกำหนดการใช้งานโดยยังไม่ได้รับการพิจารณา')
  if (state === 'rejected') return note('คำขอนี้ไม่ได้รับอนุมัติ')
  if (state === 'cancelled') return note('คำขอนี้ถูกยกเลิกแล้ว')
  if (booking.slots.length > 1)
    return note('แตะที่การ์ดเพื่อดูรายละเอียด หรือยกเลิกเฉพาะวันที่ไม่สะดวก')
  if (state === 'pending') return note('แตะที่การ์ดเพื่อดูรายละเอียด หรือยกเลิกคำขอนี้')
  return note('แตะที่การ์ดเพื่อดูรายละเอียดและเงื่อนไขการยกเลิกการจอง')
}
