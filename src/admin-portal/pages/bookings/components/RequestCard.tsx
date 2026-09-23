/**
 * The phone card — THE SAME CARD เจ้าหน้าที่ระบบ and การลงทะเบียน render: one full-width target,
 * the record's actions inside the dialog it opens.
 *
 * A row with a 44px button bolted to its right edge leaves ~150px for a Thai name at 375px —
 * measured on the directory, and the fix is not worth re-learning here. It is also the only honest
 * order, since you should read a request before deciding it.
 *
 * The one addition over the directory's card is the last line: this list is scanned for WHEN, so
 * the date span sits where the directory puts a job title.
 *
 * ⚠️ FOUR OF THE EIGHT COLUMNS ARE DROPPED, deliberately — ลำดับ, วันที่ยื่น, กลุ่ม/ฝ่าย and
 * เบอร์โทร. A numbered list of cards you scroll is counting something nobody is pointing at, and
 * the other three are in the dialog one tap away.
 *
 * ⚠️ VISIBILITY IS THE CALLER'S `lg:hidden` ON THE <ul>, AND NOTHING HERE TOUCHES IT. The `hidden`
 * CLASS is the breakpoint's; the `hidden` PROPERTY is emptiness. Mixing them on one element is what
 * turned the eight-column table on at 375px in the prototype, twice, and once in the venues port.
 */

import { Badge } from '../../../components/ui/Badge'
import { BOOKING_ORIGIN_LABEL, BOOKING_STATUS_LABEL, BOOKING_STATUS_TONE } from '../../../labels'
import { NO_VALUE } from '../../../lib/thai-date'
import { spanSummary, timeSummary } from '../booking-summary'
import { Glyph } from './BookingGlyph'
import { ICON } from './booking-icons'
import type { BookingRequestListItem } from '@/lib/api-client'

export function RequestCard({
  request,
  flash = false,
  onView,
}: {
  request: BookingRequestListItem
  /**
   * Same rail as the desktop row, and it lands on the same element by the same rule: `.row-flash`
   * styles `> :first-child`, which is the `<tr>`'s first `<td>` there and this card's `<button>`
   * here. One CSS rule, two layouts, no second vocabulary.
   */
  flash?: boolean
  onView: () => void
}) {
  const who = request.requester.name ?? NO_VALUE
  const label = BOOKING_STATUS_LABEL[request.status]

  return (
    <li className={flash ? 'row-flash' : undefined}>
      <button
        type="button"
        onClick={onView}
        aria-label={`ดูรายละเอียดคำขอ ${request.code} ของ ${who} สถานะ ${label}`}
        className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-base-content/5 active:bg-base-content/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="rq-code truncate">{request.code}</span>
            <Badge tone={BOOKING_STATUS_TONE[request.status]} className="shrink-0">
              {label}
            </Badge>
          </span>
          <span className="mt-1 flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[15px] font-medium text-base-content">{who}</span>
            <span
              className={`rq-src ${request.origin === 'LINE' ? 'rq-src-line' : 'rq-src-staff'}`}
            >
              {BOOKING_ORIGIN_LABEL[request.origin]}
            </span>
          </span>
          <span className="block truncate text-[13px] text-base-content/70">
            {request.venue.name}
          </span>
          <span className="block truncate text-[13px] text-base-content/70">
            {spanSummary(request.slots)} ·{' '}
            <span className="tabular-nums">{timeSummary(request.slots)}</span>
          </span>
        </span>
        <Glyph d={ICON.chevron} className="mt-1 h-5 w-5 shrink-0 text-base-content/40" />
      </button>
    </li>
  )
}
