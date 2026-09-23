import { useEffect, useMemo, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { recallSent, type BookingRequest } from './booking-api'
import { LIcon } from '@/client-portal/icons/LucideIcon'
import { fmtDDow, fmtT, fmtTe, hmDur, midnight } from '@/client-portal/lib/formatters'

/**
 * `#/sent/:code` — the receipt. Prototype 1458–1506 and 4483–4565.
 *
 * ── 🔴 NO HEADER AND NO BREADCRUMBS, DELIBERATELY (1 ก.ย. 2569) ──
 * Unlike the other two screens of this flow. Breadcrumbs name the way back INTO a corridor, and
 * this corridor has ended — offering a route back to the form that was just submitted is an
 * invitation to submit it twice. Both exits are buttons that go FORWARD.
 *
 * ── The layout is "one thing to read", not "content to scroll" ──
 * `pad-safe grid place-items-center` — the same centred card as the gate and registration screens,
 * because that is the shape of a screen with a single message on it.
 *
 * ── ⚠️ THE CHECKMARK IS PURE CSS AND ALL THREE LAYERS ARE UNDER `motion-safe:` ──
 * A ring that pings, a disc that pops, and a stroke that draws itself. Somebody whose device asks
 * for reduced motion sees a still checkmark that reads exactly the same; what is removed is the
 * movement, not the mark. `.sent-pop` / `.sent-draw` are already in `index.css` (P1), and the
 * `prefers-reduced-motion` guard there is written as an OPT-IN — no animation by default, added for
 * devices that did not ask to reduce it — so an engine that does not know the media query gets the
 * still version rather than the moving one.
 *
 * ⚠️ THE PATH IS `M4 12l5 5L20 6`, NOT `M20 6L9 17l-5-5`. A `stroke-dashoffset` animation always
 * draws in the order the path is written, so the mirrored form grows the tick BACKWARDS — from the
 * top-right tip down and then left, which is not the direction a hand draws one.
 */

/** Route state passed by the form, so the common path needs no storage read at all. */
type SentState = { request?: BookingRequest }

export function BookingSentPage() {
  const { id: code } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  /**
   * Two sources, in order: what the form handed over, then the session stash.
   *
   * 🔴 THERE IS NO THIRD, AND THE MISSING ONE IS THE SERVER. The prototype re-reads the request by
   * its id so that a refresh and LIFF's back button both land on the same receipt (`D-C3`); that
   * needs `GET /line-users/bookings/:id`, which `TRANSPORT.md` §4 assigns to `CLIENT-BOOKING-1` and
   * Phase 5a did not build. `recallSent` covers both of those cases through `sessionStorage`
   * instead — see the note on it. When the endpoint lands, it belongs here as the last resort.
   *
   * ⚠️ Router state is checked FIRST because it is the state the user just created; the stash is
   * the same object and only matters after a reload.
   */
  const request = useMemo<BookingRequest | null>(() => {
    if (!code) return null
    const fromState = (location.state as SentState | null)?.request
    if (fromState && fromState.code === code) return fromState
    return recallSent(code)
  }, [code, location.state])

  /**
   * ⚠️ AN UNKNOWN CODE GOES TO THE CATALOGUE, never to an empty receipt. The prototype returns
   * `false` here for exactly this reason: a broken link that draws a blank confirmation reads as a
   * request that vanished out of the system.
   */
  useEffect(() => {
    if (!request) void navigate('/venues', { replace: true })
  }, [request, navigate])

  if (!request) return null

  const live = request.slots.filter((s) => !s.isCancelled)
  const first = live[0]
  const start = first ? new Date(first.startAt) : null
  const end = first ? new Date(first.endAt) : null
  /* A span ending exactly at midnight belongs to the day that just finished — otherwise a
     09:00–24:00 booking reads as if it ran into tomorrow. */
  const endDay = end ? midnight(new Date(end.getTime() - 1)) : null
  const crossesMidnight = !!(start && endDay && midnight(start).getTime() !== endDay.getTime())
  const repeats = live.length > 1

  const rows: { label: string; value: ReactNode }[] = [
    /* 🔴 PURPOSE FIRST, NOT THE VENUE. Somebody reopening this later is looking for WHICH request,
       and the purpose is what answers that. The room and the time are details of the one they
       have already found. */
    { label: 'วัตถุประสงค์', value: request.purpose },
    /* 🔴 THE VENUE NAME ALONE, with no location appended (2 ก.ย. 2569). Two real venues carry
       parentheses in their own names, and a suffixed location produced
       `โดมเขียว (สนามฟุตซอล) (สนามฟุตซอลหลังอาคาร 4)`. A receipt answers "what did I submit", and
       the reader chose that room thirty seconds ago. */
    { label: 'สถานที่', value: request.venueName },
    { label: 'จำนวนผู้เข้าร่วม', value: `${request.attendees.toLocaleString('th-TH')} คน` },
  ]

  if (start && end && endDay) {
    /* 🔴 DURATION IS ITS OWN ROW, not a parenthetical on the end of the time row. It is a number
       people come back to re-read, and hung off the longest string in the table it was the first
       thing to wrap out of sight. Split out, the time row stops wrapping too. */
    if (repeats) {
      rows.push({ label: 'รูปแบบ', value: `ใช้ซ้ำ (${live.length} วัน)` })
      rows.push({ label: 'เวลาประจำวัน', value: `${fmtT(start)} – ${fmtTe(end)} น.` })
      rows.push({ label: 'ระยะเวลา', value: `วันละ ${sentDur(start, end)}` })
    } else if (crossesMidnight) {
      rows.push({ label: 'รูปแบบ', value: 'ต่อเนื่องข้ามวัน' })
      rows.push({ label: 'เริ่มต้น', value: `${fmtDDow(start)} เวลา ${fmtT(start)} น.` })
      rows.push({ label: 'สิ้นสุด', value: `${fmtDDow(endDay)} เวลา ${fmtTe(end)} น.` })
      rows.push({ label: 'ระยะเวลา', value: sentDur(start, end) })
    } else {
      rows.push({ label: 'รูปแบบ', value: 'ใช้ต่อเนื่องครั้งเดียว' })
      rows.push({
        label: 'วันและเวลา',
        /* ⚠️ THE `<br className="sm:hidden">` IS MEASURED, not decoration. At 390px the right
           column has ~200px, which does not fit a date plus a time span — left alone it wraps
           mid-span (`09:00 –` / `12:00 น.`). Breaking here yields date above, time below: two
           groups that each read on their own. */
        value: (
          <>
            {fmtDDow(start)}
            <br className="sm:hidden" /> · {fmtT(start)} – {fmtTe(end)} น.
          </>
        ),
      })
      rows.push({ label: 'ระยะเวลา', value: sentDur(start, end) })
    }
  }

  return (
    <section className="pad-safe grid min-h-dvh place-items-center">
      <div className="w-full max-w-sm px-4">
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-6 text-center text-base">
            <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-success/30 opacity-75 motion-safe:animate-ping"
              />
              <span
                aria-hidden="true"
                className="sent-pop relative flex h-16 w-16 items-center justify-center rounded-full bg-success text-success-content shadow-md"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-8 w-8"
                >
                  <path
                    className="sent-draw"
                    strokeDasharray="24"
                    strokeDashoffset="0"
                    d="M4 12l5 5L20 6"
                  />
                </svg>
              </span>
            </div>

            <h1 className="mt-4 text-xl font-semibold">ยื่นคำขอเรียบร้อยแล้ว</h1>
            {/* ⚠️ `font-mono` — this is a string somebody reads out character by character to type
                it into the search box or quote over the phone, and equal character widths let the
                digits be counted without squinting. */}
            <p className="mt-1 font-mono text-xs text-base-content/60">รหัสคำขอ: {request.code}</p>

            <div className="mt-1.5 flex justify-center">
              {/* ⚠️ The faded formula — `/20` fill, `/40` border, `base-content` text — not a solid
                  `badge-warning`, whose own content colour is not guaranteed readable per theme. */}
              <span className="badge badge-sm gap-1 border-warning/40 bg-warning/20 font-medium text-base-content">
                <LIcon name="clock" className="h-3 w-3 shrink-0" />
                อยู่ระหว่างพิจารณา
              </span>
            </div>

            <div className="mt-5 rounded-box bg-base-200/60 p-4 text-start text-xs">
              <p className="mb-2 text-xs font-semibold text-base-content/60">สรุปข้อมูลคำขอ</p>
              {/* ⚠️ NO `space-y-*` HERE. The gap between rows comes from each row's own `py-1.5`,
                  so the divider meets the top and bottom of the gap exactly. Adding both leaves the
                  line floating in the middle of the space. */}
              <dl>
                {rows.map((row) => (
                  /* ⚠️ `border-base-300`, NOT `base-200/60`: this card's own ground is
                     `bg-base-200/60`, so a divider of the same token computes to exactly the
                     background and the whole line disappears — measured at `borderBottomWidth: 1px`
                     with nothing visible. A line that cannot be seen is not a thin line.
                     ⚠️ `items-center`, not `items-start`: a wrapped value (a long purpose) centres
                     its label against its own height, which reads as a pair. */
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-4 border-b border-base-300 py-1.5 last:border-none"
                  >
                    <dt className="shrink-0 text-start font-normal text-base-content/60">
                      {row.label}
                    </dt>
                    <dd className="min-w-0 text-end font-medium text-base-content">{row.value}</dd>
                  </div>
                ))}
                {repeats ? (
                  /* ⚠️ FULL WIDTH AND CENTRED, unlike every other row. Several chips squeezed into
                     the right half wrap into a narrow column; left-aligned across the full width
                     the last, partly-filled row tips the whole block leftward in a card whose other
                     rows are balanced two-column pairs. */
                  <div className="pt-2">
                    <dt className="text-xs font-normal text-base-content/60">วันที่ขอใช้</dt>
                    <dd className="mt-2 flex flex-wrap justify-center gap-1.5">
                      {live.map((slot) => {
                        const day = new Date(slot.startAt)
                        return (
                          <span
                            key={slot.id}
                            className="badge badge-sm border-none bg-base-200 font-medium text-base-content/80"
                          >
                            {fmtDDow(day).replace(` ${day.getFullYear() + 543}`, '')}
                          </span>
                        )
                      })}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>

            <div role="alert" className="alert alert-warning alert-soft mt-4 text-start text-xs">
              <LIcon name="triangleAlert" className="h-4 w-4 shrink-0" />
              {/* `text-base-content` — `alert-warning alert-soft` measures **2.04:1** in the light
                  theme, the worst reading in the portal. On the words only; the icon keeps the
                  colour that says which level this is. */}
              <span className="text-base-content">
                ระบบจะส่งการแจ้งเตือนผลการพิจารณาคำขอผ่านทาง LINE Official Account
                เมื่อเจ้าหน้าที่ดำเนินการแล้ว
              </span>
            </div>

            {/* 🔴 BOTH EXITS GO FORWARD. Neither returns to the form that was just submitted. */}
            <div className="mt-6 flex flex-col gap-2">
              <Link to="/bookings" className="btn btn-app btn-primary w-full shadow-sm">
                ดูรายการคำขอของฉัน
              </Link>
              {/* 🟠 `/venues`, WHERE THE PROTOTYPE SAYS `#/home`. `home` is one of the six screens
                  `Q-C7` leaves unassigned to any phase, so it is still a stand-in — a "back to the
                  start" button that lands on an under-construction notice is worse than one that
                  lands on the catalogue this flow began at. Revert when `#/home` is built. */}
              <Link to="/venues" className="btn btn-app btn-ghost w-full">
                กลับหน้าแรก
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * ⚠️ THE FULL WORD `ชั่วโมง`, ON THIS SCREEN ONLY. Everywhere else uses `ชม.` because it sits in a
 * narrow card or a calendar row where every character competes; a receipt has room, and the full
 * word reads as a formal record.
 *
 * ⚠️ IT REWRITES `hmDur`'s OUTPUT RATHER THAN COMPUTING ITS OWN. A span over a day must still read
 * `1 วัน 8 ชั่วโมง`, never `32 ชั่วโมง` — a second formula here is how this screen and the booking
 * detail start reporting different durations for the same row.
 */
function sentDur(start: Date, end: Date): string {
  return hmDur(start, end).replace('ชม.', 'ชั่วโมง')
}
