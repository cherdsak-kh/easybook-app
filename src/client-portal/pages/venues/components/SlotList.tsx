import { slotsOn, type VenueSlot } from '../venue-availability'
import { LIcon } from '@/client-portal/icons/LucideIcon'
import { fmtSlot, fmtT, fmtTe, hmDur, midnight } from '@/client-portal/lib/formatters'

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
        /* 🔴 `midnight(end − 1ms)` IS WHAT DECIDES "CROSS-DAY", not `midnight(end)`. A span ending
           exactly at 00:00 belongs to the day that just finished, so the naive comparison calls an
           ordinary evening booking a cross-day one. Same rule `fmtSlot` folds on internally. */
        const endDay = midnight(new Date(slot.end.getTime() - 1))
        const cross = midnight(slot.start).getTime() !== endDay.getTime()
        /* ⚠️ SAME-DAY OMITS THE DATE ON PURPOSE — the reader picked the active day in the picker
           directly above, so `13 ก.ย. 2569 · 09:00–12:00` spends the line's width repeating their
           own input instead of telling them how long the room is taken.
           ⚠️ A CROSS-DAY SPAN PRINTS VIA `fmtSlot` AND GETS **NO** `(N ชม.)` — it is measured in
           days, and `hmDur` would append `2 วัน 8 ชม.`, which merely restates what the two printed
           dates already said. (Prototype 3898–3903.) */
        const when = cross
          ? fmtSlot(slot.start, slot.end)
          : `${fmtT(slot.start)}–${fmtTe(slot.end)} (${hmDur(slot.start, slot.end)})`
        return (
          <article key={slot.id} className="card bg-base-100 border border-base-200/80 shadow-sm">
            <div className="card-body gap-1.5 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-base-content/80">
                  <LIcon
                    name="clock"
                    className={`h-4 w-4 shrink-0 ${approved ? 'text-primary' : 'text-warning'}`}
                  />
                  <span className="min-w-0">{when}</span>
                </p>
                {/* ⚠️ GREEN, NOT RED, for an approved booking — and the two are not interchangeable
                    just because the calendar bar above uses red. Red on the bar means "you cannot
                    ask for these hours"; this badge means "this activity was approved", which is a
                    different sentence about the same fact. */}
                {/* 🔴 THIS IS THE PROTOTYPE'S CLASS LIST EXACTLY (3927–3930) — DO NOT PIN GEOMETRY
                    BACK ON. A previous round added `h-5 px-2 border` + `mr-1.5` believing the two
                    daisyUI builds differed; they do not. The badge was rendering at **27.5px /
                    0 border / 10px padding / 13px / gap 0** because the admin portal's UNLAYERED
                    `.badge` override reached it through `index.css`'s global import of
                    `admin-portal.css`. It is now scoped to `[data-theme^="easybook-admin"]` there.
                    Those utilities could never have fixed it — the `utilities` layer loses to an
                    unlayered rule — and `mr-1.5` would now STACK on daisyUI's real 4px gap.
                    ⚠️ `whitespace-nowrap` and `shrink-0` STAY, both load-bearing: daisyUI fixes the
                    badge height and sets no `white-space`, so squeezed in this `justify-between`
                    row the Thai text wraps and the second line is clipped by that fixed height. */}
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
                {/* ⚠️ THE FALLBACK IS NOT DEAD CODE. `purpose` is nullable on the wire and
                    `venues-api` flattens that to `''`; an empty `<h3>` is a 20 px gap above the
                    requester line that reads as a card that failed to load. */}
                <h3 className="text-sm font-semibold leading-snug text-base-content">
                  {slot.purpose || 'ไม่ระบุวัตถุประสงค์'}
                </h3>
                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-base-content/70">
                  {/* 🔴 THE REQUESTER LINE IS PRINTED FOR **EVERY** SLOT (`#ISSUE-01`, 12 ก.ย.
                      2569). It used to be approved-only, mirroring `D-C13`'s redaction in the
                      server's `toAvailabilityDto` — and the two together produced a pending card
                      with a blank heading and no second line at all, which reads as breakage. The
                      prototype has always drawn both (3933–3943) and the server now sends both, so
                      this renders both.
                      ⚠️ IT IS NOT GATED ON `slot.requester` EITHER. An unnamed staff booking
                      (`D-C18`) still gets the icon and the neutral word, because the row's shape
                      must not change with whether somebody's name happens to be on it. */}
                  <LIcon name="user" className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0">{slot.requester || 'ผู้ขอใช้งาน'}</span>
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
          </article>
        )
      })}
    </>
  )
}
