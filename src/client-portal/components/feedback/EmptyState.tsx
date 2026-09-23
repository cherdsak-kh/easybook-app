import type { ReactNode } from 'react'

/**
 * The card that stands in for a list with nothing in it. Prototype: the venue search empty state
 * (1027–1036), the bookings list (4890–4909) and the venue-detail day with no bookings
 * (`paintVenueSlots`, 3932–3943).
 *
 * ── 🔴 THERE ARE TWO EMPTY STATES AND THEY ARE NOT THE SAME MESSAGE ──
 *   · **Nothing exists yet** — an invitation. "ยังไม่มีคำขอใช้สถานที่" with a filled CTA that
 *     starts the thing the screen is for.
 *   · **Nothing matches the filters** — a dead end the user built themselves, and it needs a way
 *     back out. "ไม่พบคำขอที่ตรงกับเงื่อนไข" plus a button that clears every filter at once.
 *     Telling someone "no results" and leaving them to switch off four filters one at a time
 *     puts the work on the reader when the filters are the entire cause.
 * The distinction is the caller's to make; this component only refuses to make it impossible.
 * ⚠️ A "clear filters" action must reset the VISIBLE controls too, not only the state behind
 * them, or the search box still shows a query while the full list is back.
 *
 * ── 🔴 IT IS A CARD, OF THE SAME FAMILY AS A FULL ONE ──
 * "No bookings today" is the most common answer on the venue-detail screen, and as bare text
 * under a calendar it reads like a screen that has not finished loading. Same `card bg-base-100
 * shadow-sm`, so an empty day and a busy day are visibly the same kind of thing.
 * ⚠️ The shared `SLOT_ROW` / `AMEN_TAG` constants that used to enforce this were deleted from
 * the prototype with their last caller. The RULE survives; the identifiers do not — do not
 * reintroduce a constant nothing calls.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  /** `true` for the compact form used inside a day panel; `false` for a whole-list placeholder. */
  compact = false,
}: {
  /** Sized by the caller: `h-5 w-5` in the compact form, `h-6`/`h-7` otherwise. */
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  compact?: boolean
}) {
  return (
    <div className="card bg-base-100 shadow-sm">
      <div
        className={`card-body items-center text-center ${compact ? 'gap-1.5 p-6' : 'gap-0 p-8'}`}
      >
        {icon ? (
          <span
            aria-hidden="true"
            className={`flex items-center justify-center rounded-full bg-base-200 ${
              compact ? 'h-10 w-10 text-primary' : 'h-14 w-14 text-base-content/60'
            }`}
          >
            {icon}
          </span>
        ) : null}

        <p className={compact ? 'text-sm font-semibold' : 'mt-4 font-medium'}>{title}</p>
        {description ? (
          <p
            className={
              compact ? 'text-xs text-base-content/60' : 'mt-1 text-sm text-base-content/60'
            }
          >
            {description}
          </p>
        ) : null}
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  )
}
