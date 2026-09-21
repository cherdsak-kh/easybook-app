/**
 * One agenda card on ปฏิทินการจอง: one SLOT, in three lines. The markup is the prototype's
 * `#cal-item-tpl`.
 *
 *   line 1  🕒 start – end น.   📍 venue (truncates)   [status]   ›
 *   line 2  purpose (truncates, full text in `title`)
 *   line 3  👤 requester name
 *
 * The code, the venue type, the requester's position and group all live in the detail dialog, which
 * the whole card opens.
 *
 * ⚠️ THE WHOLE CARD IS THE TARGET. The chevron button is 24px, but its `::after` covers the card
 * (`.cal-item` is `relative`), so a click anywhere opens the booking. Its focus ring is drawn on the
 * CARD (`.cal-item:has(.cal-item-open:focus-visible)`, unlayered in `admin-portal.css`), because a
 * ring around a 24px chevron does not say "this card". The code and the slot number are not on the
 * card. They are in the button's name, which is what a screen reader announces for it.
 *
 * ⚠️ THE BADGE'S `px-2! py-0.5! text-[12px]!` ARE `!important`, AND MUST BE. In the prototype `.badge`
 * sits in `@layer components`, so these utilities win and the pill is 12px. Here `.badge` is an
 * UNLAYERED scoped rule (see the long note above it in `admin-portal.css`), and an unlayered rule
 * beats every utility. Without `!` the pill renders at 13px with `px-2.5 py-1`. That takes about 8px
 * from the venue name, which at 1024px has roughly 70px to truncate in.
 */

import { BOOKING_STATUS_LABEL } from '../../../labels'
import { NO_VALUE } from '../../../lib/thai-date'
import { clashLabel } from '../calendar-model'
import type { CalendarBookingSlot } from '@/lib/api-client'

export function CalendarItem({
  slot,
  clashes,
  onOpen,
}: {
  slot: CalendarBookingSlot
  /** The other slots holding this room at the same time, computed over the UNFILTERED window. */
  clashes: readonly CalendarBookingSlot[]
  onOpen: () => void
}) {
  const approved = slot.status === 'APPROVED'

  /* PENDING only (PO): an approved card never carries the banner, whatever is filed against it. The
     wording is the timeline bar's too (`clashLabel`). */
  const clashText = clashLabel(slot, clashes)

  const openLabel =
    `ดูรายละเอียด ${slot.code}` +
    (slot.slotCount > 1 ? ` ช่วงที่ ${slot.slotIndex} จาก ${slot.slotCount}` : '') +
    ` · ${slot.purpose}`

  return (
    <li className={`cal-item ${approved ? 'cal-item-ok' : 'cal-item-wait'}`}>
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex shrink-0 items-center gap-1.5">
          <svg
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0 text-base-content/60"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-[14px] font-semibold text-base-content tabular-nums">
            {slot.start} – {slot.end} น.
          </span>
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          {/* The client portal's `mapPin`, character for character. One school, two portals. */}
          <svg
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0 text-base-content/60"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"
            />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span className="min-w-0 truncate text-[13px] text-base-content/80" title={slot.venueName}>
            {slot.venueName}
          </span>
        </span>
        <span
          className={`badge shrink-0 px-2! py-0.5! text-[12px]! ${approved ? 'badge-emerald' : 'badge-amber'}`}
        >
          {BOOKING_STATUS_LABEL[slot.status]}
        </span>
        <button type="button" className="cal-item-open" aria-label={openLabel} onClick={onOpen}>
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>
      <h3
        className="mt-1 truncate text-[14px] font-medium leading-5 text-base-content"
        title={slot.purpose}
      >
        {slot.purpose}
      </h3>
      <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
        <svg
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 text-base-content/60"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
          />
        </svg>
        {/* `null` is legitimate (plan §3). `—` says "nobody named", where an empty line reads as a
            rendering fault. `||` also covers an empty string. */}
        <p className="min-w-0 truncate text-[13px] leading-[18px] text-base-content/70">
          {slot.requesterName || NO_VALUE}
        </p>
      </div>
      {clashText && (
        <p className="cal-clash mt-1.5">
          <svg
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
          <span>{clashText}</span>
        </p>
      )}
    </li>
  )
}
