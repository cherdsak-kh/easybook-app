/**
 * One desktop row of the queue — EIGHT columns, 92px tall.
 *
 * The columns, and why each one earns its width:
 *   ลำดับ           a shared handle for "the third one down", across a phone call.
 *   รหัสคำขอ         the record's own handle, and the one that never moves.
 *   วันที่ยื่น        who has been waiting longest.
 *   ผู้ขอจอง         who to call — and, through the source chip, whether there is anyone to call
 *                   at all (a เจ้าหน้าที่ row was raised by the operator).
 *   สถานที่          which room is being competed for.
 *   วัน-เวลาใช้งาน   the thing that actually collides. SUMMARISED, never enumerated.
 *   สถานะ           which tab you are looking at, restated per row — ทั้งหมด mixes all four.
 *   จัดการ           the work.
 *
 * ⚠️ วัตถุประสงค์ IS NOT A COLUMN (PO, after user testing). At the width this table can spare it,
 * purpose rendered as ~94px of two-line clamped Thai, which is not enough of a sentence to decide
 * anything on, and it was the widest single reason the eight-column layout kept overflowing. The
 * head count went with it: it only ever meant something NEXT TO a purpose and a capacity. Both are
 * in the detail dialog, in full, on the surface where the decision is actually taken.
 *
 * ⚠️ ONE BUTTON, AND THAT IS A SAFETY DECISION, not a tidy-up. อนุมัติ / ปฏิเสธ / ยกเลิก used to
 * sit here as 44px icons in a 2×2 grid, which meant the two most consequential writes in the
 * product — one of which auto-rejects OTHER PEOPLE'S requests under ADR-001 — were one mis-aimed
 * click away, from a row that shows neither the slot list nor the conflicts. Routing every write
 * through the detail dialog makes READING THE RECORD A PRECONDITION OF ACTING ON IT. The cost is
 * one extra click per decision and it buys the only guarantee this screen actually needed.
 *
 * The consequence for this component is worth stating: there is NO status-dependent branching in a
 * row, so a row cannot offer a transition that is illegal from the state it is in — it offers none
 * at all. That whole class of bug lives in exactly one place, the dialog's footer.
 *
 * ⚠️ NO `data-write-only` EITHER — ตรวจสอบข้อมูล is a READ, and a VIEWER keeps it. That is why the
 * column header flips to "ดูข้อมูล" for that role rather than emptying out.
 */

import { Badge } from '../../../components/ui/Badge'
import { BOOKING_ORIGIN_LABEL, BOOKING_STATUS_LABEL, BOOKING_STATUS_TONE } from '../../../labels'
import { NO_VALUE, thaiDateShort, thaiTime } from '../../../lib/thai-date'
import { spanSummary, timeSummary } from '../booking-summary'
import { Glyph } from './BookingGlyph'
import { ICON } from './booking-icons'
import type { BookingRequestListItem } from '@/lib/api-client'

export function RequestRow({
  request,
  index,
  flash = false,
  onView,
}: {
  request: BookingRequestListItem
  /**
   * ⚠️ THE ABSOLUTE POSITION IN THE FILTERED SET, not the position in this page's slice. Page 2 at
   * ten rows a page starts at 11 — a column that restarts at 1 on every page is counting the DOM
   * rather than the list, and two people comparing "row 3" across a page boundary would be looking
   * at different records. The page computes it; this component only prints it.
   */
  index: number
  /**
   * This row changed underneath the reader a moment ago — somebody else approved it, or ADR-001
   * auto-rejected it. `.row-flash` paints a left rail on it for 2.5s and NOTHING ELSE MOVES: the row
   * is updated in place, in its existing position, because reordering under a hand that is already
   * travelling toward a button is the one thing this screen refuses to do without a click.
   */
  flash?: boolean
  onView: () => void
}) {
  const who = request.requester.name ?? NO_VALUE
  const label = BOOKING_STATUS_LABEL[request.status]

  return (
    <tr
      className={`group border-b border-base-300/60 transition-colors hover:bg-base-content/5 ${
        flash ? 'row-flash' : ''
      }`.trim()}
    >
      <td className="td-cell td-cell-tight text-center text-base-content/70 tabular-nums">
        {index}
      </td>

      <td className="td-cell td-cell-tight whitespace-nowrap">
        {/* The code is a second way into the same record. Underlined rather than styled as a
            button, because it is the record's NAME and reads as one in a column of them. */}
        <button
          type="button"
          onClick={onView}
          aria-label={`ดูรายละเอียดคำขอ ${request.code}`}
          className="rq-code rounded-control px-1 py-0.5 underline decoration-base-content/25 underline-offset-4 transition-colors hover:bg-info/10 hover:text-info hover:decoration-info focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {request.code}
        </button>
      </td>

      <td className="td-cell td-cell-tight">
        <span className="flex flex-col">
          <span className="whitespace-nowrap text-[14px] text-base-content/80">
            {thaiDateShort(request.createdAt)}
          </span>
          <span className="text-[13px] text-base-content/70 tabular-nums">
            {thaiTime(request.createdAt)} น.
          </span>
        </span>
      </td>

      {/* `h-[63px]` on the two multi-line columns, for the reason the other two tables in this
          portal record: one wrapped กลุ่ม/ฝ่าย otherwise makes its row 20px taller than the rest and
          the table looks broken. The `max-w-` caps are MEASURED — the longest requester name in the
          seed renders at 104px and the longest venue name at 87px — and they stay even though the
          budget is no longer tight: removing them was tried once and one long กลุ่มสาระ… took this
          column to 241px. */}
      <td className="td-cell td-cell-tight">
        <span className="flex h-[63px] min-w-0 max-w-[176px] flex-col justify-center gap-0.5">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[14px] font-medium text-base-content">{who}</span>
            <span
              className={`rq-src ${
                request.origin === 'LINE' ? 'rq-src-line' : 'rq-src-staff'
              }`}
            >
              {BOOKING_ORIGIN_LABEL[request.origin]}
            </span>
          </span>
          <span className="truncate text-[13px] text-base-content/70">
            {request.requester.departmentName ?? NO_VALUE}
          </span>
          <span className="truncate text-[13px] text-base-content/70 tabular-nums">
            {request.requester.phone ?? NO_VALUE}
          </span>
        </span>
      </td>

      <td className="td-cell td-cell-tight">
        <span className="flex min-w-0 max-w-[168px] items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-base-content/8 text-base-content/70"
          >
            <Glyph d={ICON.building} className="h-4 w-4" />
          </span>
          <span className="min-w-0 truncate text-[14px] text-base-content/90">
            {request.venue.name}
          </span>
        </span>
      </td>

      <td className="td-cell td-cell-tight">
        <span className="flex h-[63px] min-w-0 flex-col justify-center gap-0.5">
          <span className="text-[14px] leading-[1.4] text-base-content">
            {spanSummary(request.slots)}
          </span>
          <span className="whitespace-nowrap text-[13px] text-base-content/70 tabular-nums">
            {timeSummary(request.slots)}
          </span>
        </span>
      </td>

      <td className="td-cell td-cell-tight text-center">
        <Badge tone={BOOKING_STATUS_TONE[request.status]}>{label}</Badge>
      </td>

      <td data-col="actions" className="td-cell td-cell-tight td-cell-act">
        {/* Centred in a `w-fit` box rather than `.row-actions`' two-slot grid: that grid exists so
            button 1 sits under button 1 when rows offer different numbers of them, and here every
            row offers exactly one. No height on it — `.td-cell`'s `align-middle` centres the button
            in whatever height the two 63px columns set, which is the 92px the row is measured at. */}
        <div className="mx-auto flex w-fit">
          <button
            type="button"
            onClick={onView}
            aria-label={`ตรวจสอบข้อมูลคำขอ ${request.code} ของ ${who}`}
            data-tip="ตรวจสอบข้อมูล"
            data-tip-pos="left"
            className="icon-btn icon-btn-view"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={ICON.eye} />
              <path strokeLinecap="round" strokeLinejoin="round" d={ICON.eyeInner} />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  )
}
