/**
 * ช่วงเวลาที่ขอใช้ — every slot of one booking, enumerated.
 *
 * ⚠️ THE TABLE SUMMARISES AND THIS DOES NOT, and that is the trade the whole screen rests on. A
 * three-day request can hold three DIFFERENT time ranges; an operator who only ever saw
 * `10–12 ก.ย. 69 (3 วัน)` would be agreeing to hours nobody showed them. This list is what earns the
 * row the right to be one line.
 *
 * ⚠️ CANCELLED SPANS ARE SHOWN, NOT FILTERED OUT — the one place the real contract and the
 * prototype's model differ. There, cancelling part of a booking SPLIT the record, so a dialog only
 * ever saw live spans; here `isCancelled` keeps them on the same request, and this component's job
 * is to say that Wednesday was dropped AND why. Hiding them would leave the requester holding a LINE
 * message about a day that appears nowhere in the record it names.
 *
 * ⚠️ THE REASON IS A `<dd>` OF ITS OWN ON ITS OWN LINE (`w-full` inside `.rq-slot`'s wrap), not a
 * `title` and not a truncation: it is the sentence the requester was sent, so it is read here in the
 * same words they got.
 */

import { Badge } from '../../../components/ui/Badge'
import { BOOKING_CANCELLED_BY_LABEL } from '../../../labels'
import { NO_VALUE, thaiDate } from '../../../lib/thai-date'
import { slotTime } from '../booking-detail'
import type { BookingRequestSlot } from '@/lib/api-client'

export function BookingSlotList({ slots }: { slots: readonly BookingRequestSlot[] }) {
  // A booking with no slots at all is not a state the contract produces, but a dl with nothing in it
  // renders as a heading followed by white space — which reads as a failed load rather than as data.
  if (slots.length === 0) {
    return <p className="m-0 py-2 text-[14px] text-base-content/70">{NO_VALUE}</p>
  }

  return (
    <dl className="m-0">
      {slots.map((s) => (
        <div key={s.id} className="rq-slot">
          <dt className="rq-slot-day">{thaiDate(s.startAt)}</dt>
          <dd className="rq-slot-time m-0">{slotTime(s)}</dd>
          {s.isCancelled && (
            <>
              {/* Rose, the same hue the ยกเลิก badge and tab pill carry — one colour for one fact,
                  wherever it is rendered. In its own <dd> rather than tucked inside the time cell:
                  `.rq-slot` is the flex row, and a badge nested in `.rq-slot-time` would inherit
                  `tabular-nums` and sit inside the cell it is meant to qualify. */}
              <dd className="m-0">
                <Badge tone="rose">ยกเลิกแล้ว</Badge>
              </dd>
              <dd className="m-0 w-full text-[13px] leading-[1.5] text-base-content/70">
                เหตุผล: {s.cancelReason || NO_VALUE}
                {s.cancelledAt && <> · ยกเลิกเมื่อ {thaiDate(s.cancelledAt)}</>}
                {s.cancelledByRole && <> · โดย{BOOKING_CANCELLED_BY_LABEL[s.cancelledByRole]}</>}
              </dd>
            </>
          )}
        </div>
      ))}
    </dl>
  )
}
