import {
  canCancelSlot,
  crossesDay,
  type BookingSlot,
  type BookingState,
} from '../booking-state'
import { LIcon } from '@/client-portal/icons/LucideIcon'
import { RXIcon } from '@/client-portal/icons/RemixIcon'
import {
  TH_DOW_FULL,
  fmtD,
  fmtDDow,
  fmtT,
  fmtTe,
  hmDur,
  midnight,
} from '@/client-portal/lib/formatters'

/**
 * The grey time box shared by the list card and the detail screen. Prototype `mbCapsule` (4655).
 *
 * ── ⚠️ THREE SHAPES, AND THEY REFLECT THREE REAL KINDS OF BOOKING ──
 * Not three sizes of one box:
 *   · **one day** → full date + time range + duration;
 *   · **crossing midnight** → a tag, an *enter* line and a *leave* line. There is no "time range"
 *     to speak of, because it runs through the night;
 *   · **repeating** → a tag, the time it happens each day, then the list of days.
 *
 * ── 🔴 THE PER-DAY CANCEL BUTTONS EXIST ONLY ON THE DETAIL SCREEN ──
 * `withCancel` is false on the list card, and the reason is HTML rather than taste: the whole card
 * is an `<a>`, a `<button>` inside an `<a>` is invalid, and what actually happens is that tapping
 * the button navigates instead of cancelling. The card's footer says where to go to cancel instead.
 */

const TAG = 'badge badge-xs border-none bg-base-200 text-base-content/70'
const ROW = 'flex items-center gap-2'

export function SlotCapsule({
  slots,
  state,
  leadMinutes,
  onCancel,
}: {
  slots: BookingSlot[]
  state: BookingState
  /** From `app_settings` via the detail response (`Q-C4` ①). Only read when `onCancel` is given. */
  leadMinutes?: number
  /** Present = the detail screen. Absent = the list card, which draws no buttons at all. */
  onCancel?: (slot: BookingSlot) => void
}) {
  const live = slots.filter((s) => !s.isCancelled)
  const box = 'mt-3 space-y-1.5 rounded-box bg-base-200/50 p-3 text-xs'

  // ── Repeating across days ────────────────────────────────────────────────────
  if (slots.length > 1) {
    const one = live[0] ?? slots[0]
    return (
      <div className={box}>
        <div className={ROW}>
          <span className={`${TAG} gap-1`}>
            <LIcon name="repeat" className="h-3 w-3 shrink-0" />
            ใช้ซ้ำ {live.length} วัน
          </span>
        </div>
        <div className={`${ROW} text-base-content/70`}>
          <LIcon name="clock" className="h-4 w-4 shrink-0 text-base-content/60" />
          <span>
            {fmtT(new Date(one.startAt))} – {fmtTe(new Date(one.endAt))} น. (วันละ{' '}
            {hmDur(new Date(one.startAt), new Date(one.endAt))})
          </span>
        </div>
        <div className="space-y-1 border-t border-base-300/60 pt-2">
          {slots.map((slot) => (
            <SlotRow
              key={slot.id}
              slot={slot}
              state={state}
              leadMinutes={leadMinutes}
              onCancel={onCancel}
            />
          ))}
        </div>
      </div>
    )
  }

  const only = slots[0]
  if (!only) return null
  const start = new Date(only.startAt)
  const end = new Date(only.endAt)

  // ── One span, crossing midnight ──────────────────────────────────────────────
  if (crossesDay(only)) {
    /* The end is folded back a millisecond before its day is read: a span ending at 00:00 belongs
       to the day that just finished, and printing the raw day yields `3 ก.ย. 24:00` — a pair that
       does not exist. */
    const endDay = midnight(new Date(end.getTime() - 1))
    return (
      <div className={box}>
        <div className={ROW}>
          <span className={TAG}>ต่อเนื่องข้ามวัน (รวม {hmDur(start, end)})</span>
        </div>
        <div className={ROW}>
          <RXIcon name="enter" className="h-4 w-4 shrink-0 text-success" />
          <span className="font-medium">
            {fmtDDow(start)} เวลา {fmtT(start)} น.
          </span>
        </div>
        <div className={ROW}>
          <RXIcon name="leave" className="h-4 w-4 shrink-0 text-error" />
          <span className="font-medium">
            {fmtDDow(endDay)} เวลา {fmtTe(end)} น.
          </span>
        </div>
      </div>
    )
  }

  // ── One span, one day ────────────────────────────────────────────────────────
  /* ⚠️ A FINISHED BOOKING PRINTS "(เสร็จสิ้น)" WHERE ITS DURATION WOULD GO. A duration is planning
     information, and there is nothing left to plan about something that already happened. An
     expired or rejected request does NOT get this word — it did not finish, it never started. */
  const tail = state === 'done' ? '(เสร็จสิ้น)' : `(${hmDur(start, end)})`
  return (
    <div className={box}>
      <div className={ROW}>
        <LIcon name="calendar" className="h-4 w-4 shrink-0 text-base-content/60" />
        <span className="font-medium">
          {TH_DOW_FULL[start.getDay()]}ที่ {fmtD(start)}
        </span>
      </div>
      <div className={`${ROW} text-base-content/70`}>
        <LIcon name="clock" className="h-4 w-4 shrink-0 text-base-content/60" />
        <span>
          {fmtT(start)} – {fmtTe(end)} น. {tail}
        </span>
      </div>
    </div>
  )
}

/**
 * One day of a repeating booking, with its own answer to "can this one be dropped?".
 *
 * 🔴 EACH ROW DECIDES FOR ITSELF (`Q-C4` ②). A three-day request whose Monday has already begun can
 * still have its Tuesday and Wednesday cancelled — the lead time is measured against *this slot's*
 * start, never the request's first.
 */
function SlotRow({
  slot,
  state,
  leadMinutes,
  onCancel,
}: {
  slot: BookingSlot
  state: BookingState
  leadMinutes?: number
  onCancel?: (slot: BookingSlot) => void
}) {
  const start = new Date(slot.startAt)
  const end = new Date(slot.endAt)
  const can = onCancel !== undefined && canCancelSlot(slot, state, leadMinutes ?? 0)

  return (
    <div className="flex min-h-8 items-center justify-between gap-2">
      {/* ⚠️ `/70`, NOT `/50`. A cancelled day must read as quieter, and `/50` measured **3.39:1** on
          the capsule's `bg-base-200/50` in the light theme — under AA. The strike-through already
          carries "this one is off"; the alpha only has to say "secondary", and `/70` does that at
          4.63. Measured, not guessed. */}
      <span className={`min-w-0 ${slot.isCancelled ? 'text-base-content/70 line-through' : ''}`}>
        {/* The year is dropped here and only here: every row repeats it, and the card above
            already carries the full date once. */}
        {fmtDDow(start).replace(` ${start.getFullYear() + 543}`, '')}{' '}
        <span className="text-base-content/60">
          ({fmtT(start)}–{fmtTe(end)})
        </span>
      </span>
      {slot.isCancelled ? (
        <span className="shrink-0 text-base-content/60">ยกเลิกแล้ว</span>
      ) : can ? (
        /* ⚠️ `h-11 min-h-11` — 44 px, where the prototype draws `h-8` (32). This is the one
           DESTRUCTIVE control in a dense list of near-identical rows, and it sits directly beneath
           the row above it: `Q-C6`'s ruling is that a text label buys a control width to compensate
           with, which is why a 36 px chip passes, but nothing in that ruling covers a destructive
           control whose neighbours are 8 px away. The prototype's 32 arrives with no comment, unlike
           its 32 px sort button, which argues its case. Raised deliberately, and measured. */
        <button
          type="button"
          onClick={() => onCancel?.(slot)}
          className="btn btn-ghost btn-xs h-11 min-h-11 shrink-0 px-2.5 text-error"
        >
          ยกเลิกวันนี้
        </button>
      ) : null}
    </div>
  )
}
