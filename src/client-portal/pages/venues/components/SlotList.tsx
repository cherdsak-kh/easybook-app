import { slotsOn, type VenueSlot } from '../venue-availability'
import { LIcon } from '@/client-portal/icons/LucideIcon'
import { fmtSlot } from '@/client-portal/lib/formatters'

/**
 * The selected day's bookings. Prototype `paintVenueSlots` (3926) and `vdSlotCard`.
 *
 * ── 🔴 AN EMPTY DAY IS A CARD OF THE SAME FAMILY, NOT BARE TEXT ──
 * "Nothing is booked" is the **most common answer this screen gives**, and as a line of plain text
 * under a heading it reads like a screen that has not finished loading. It gets the same
 * `card bg-base-100 shadow-sm` shell, the same medallion treatment and a second line saying what
 * the reader can do next — so the day that is free looks like an answer rather than an absence.
 *
 * ⚠️ THE SHARED `SLOT_ROW` / `AMEN_TAG` CONSTANTS THAT USED TO ENFORCE THIS WERE DELETED from the
 * prototype on 1 ก.ย. 2569, along with their last caller. The *rule* survives; the identifiers do
 * not, and a constant with no caller must not be reintroduced here to commemorate it.
 */
export function SlotList({ slots, day }: { slots: readonly VenueSlot[]; day: Date }) {
  const rows = slotsOn(slots, day)

  if (rows.length === 0) {
    return (
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body items-center gap-1.5 p-6 text-center">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-base-200 text-primary"
          >
            <LIcon name="calendarCheck2" className="h-5 w-5" />
          </span>
          <p className="text-sm font-semibold">ไม่มีรายการจองในวันนี้</p>
          <p className="text-xs text-base-content/60">พร้อมให้คุณยื่นคำขอจองใช้งานได้ทันที</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {rows.map((slot) => {
        const approved = slot.status === 'approved'
        return (
          <div key={slot.id} className="card bg-base-100 shadow-sm">
            <div className="card-body gap-1.5 p-4">
              <div className="flex items-start justify-between gap-2">
                {/* `fmtSlot` prints a same-day span as `2 ก.ย. 2569 · 08:00–12:00` and a
                    cross-midnight one as `2 ก.ย. 22:00 → 3 ก.ย. 02:00`, and folds a span ending at
                    midnight back onto the day it belongs to so it reads `–24:00` rather than
                    `–00:00`. */}
                <p className="min-w-0 text-sm font-medium">{fmtSlot(slot.start, slot.end)}</p>
                {/* ⚠️ GREEN, NOT RED, for an approved booking — and the two are not interchangeable
                    just because the calendar bar above uses red. Red on the bar means "you cannot
                    ask for these hours"; this badge means "this activity was approved", which is a
                    different sentence about the same fact. */}
                {approved ? (
                  <span className="badge badge-sm shrink-0 gap-1 whitespace-nowrap border-success/40 bg-success/20 font-medium text-base-content">
                    <LIcon name="circleCheck" className="h-3 w-3 shrink-0 text-success" />
                    อนุมัติแล้ว
                  </span>
                ) : (
                  <span className="badge badge-sm shrink-0 gap-1 whitespace-nowrap border-warning/40 bg-warning/20 font-medium text-base-content">
                    <LIcon name="clock" className="h-3 w-3 shrink-0 text-warning" />
                    รอพิจารณา
                  </span>
                )}
              </div>

              <div className="mt-1 border-t border-base-200/80 pt-2">
                <h3 className="text-sm font-semibold leading-snug text-base-content">
                  {slot.purpose}
                </h3>
                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-base-content/70">
                  {/* 🔴 `D-C13` — AN UNAPPROVED REQUEST NEVER REVEALS WHO MADE IT. The requester
                      line is printed for approved bookings only; for a pending one the API sends
                      nothing and this renders nothing. */}
                  {approved && slot.requester ? (
                    <>
                      <LIcon name="user" className="h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0">{slot.requester}</span>
                    </>
                  ) : null}
                  {/* 🔴 `(ขอใช้ซ้อนได้)` IS P2 RULE 1 PRINTED WHERE IT CHANGES A DECISION. A pending
                      request reserves nothing, so a reader who sees the amber band and backs off to
                      another day is retreating from something that was never blocking them. */}
                  {/* ⚠️ `/60`, NOT `/50`. Measured at **3.41:1** in the light theme, which fails AA
                      for text this size; `/60` clears it. `D-C17`'s 2.26 is a documented brand
                      exception on one button — this was not one, it was a miss (P5b). */}
                  {approved ? null : <span className="text-base-content/60">(ขอใช้ซ้อนได้)</span>}
                  {slot.mine ? (
                    <span className="badge badge-sm whitespace-nowrap border-primary/40 bg-primary/20 text-base-content">
                      คุณ
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}
