/**
 * One venue, as a card in the grid.
 *
 * ── The whole card is ONE <button> ──
 * Not `<li><article>…<button class="icon-btn">`. The photo is 180px tall and is what the eye and the
 * thumb both go to; putting the only affordance in a 44px pencil beside it means the obvious target
 * does nothing. The `<li>` carries the list semantics, the `<button>` inside it is the control — an
 * `<li>` with a click handler is neither.
 *
 * ── ONE card, not one per role ──
 * A ผู้ดูข้อมูล gets exactly this card and exactly the same dialog; what changes is that the dialog
 * opens read-only. Two components would be two places for "what a venue looks like" to drift, and
 * the read path is identical — there is no field an editor sees that a reader must not.
 *
 * ── `aria-label`, not just the visible text ──
 * A screen reader reading this button announces every string inside it in order, which for a closed
 * venue ends "…ปิดชั่วคราว ประเภท โรงยิม ความจุ 500 คน" with no verb anywhere. The label states the
 * ACTION; the inner text is what a sighted operator scans.
 */

import type { Venue } from '@/lib/api-client'
// Its own module because the client portal imports the same six paths — see venue-icons.ts.
import { ICON } from './venue-icons'


/** How many amenity tags fit before the card starts pushing its row-mates around. */
const TAGS_SHOWN = 3

export function VenueCard({
  venue,
  canWrite,
  onOpen,
}: {
  venue: Venue
  canWrite: boolean
  onOpen: () => void
}) {
  const cover = venue.photos[0]
  const shown = venue.amenities.slice(0, TAGS_SHOWN)
  const overflow = venue.amenities.length - shown.length

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${canWrite ? 'แก้ไข' : 'ดูข้อมูล'} ${venue.name}`}
        className="venue-card"
      >
        <span className={`venue-photo ${venue.isOpen ? '' : 'venue-photo-off'}`.trim()}>
          {cover ? (
            /* `alt=""` — the name is the very next thing in the button's own text, so describing
               the picture again would announce the venue twice. */
            <img src={cover.url} alt="" className="h-full w-full object-cover" />
          ) : (
            /* A state the real screen genuinely has: a venue added before its photos are. */
            <span className="venue-ph">
              <svg
                aria-hidden="true"
                className="h-10 w-10"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.4}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={ICON.photoDetailed} />
              </svg>
            </span>
          )}

          {/* Top-LEFT, over the photo, because a closed venue must read as closed before anything
              else on the card is read. */}
          {!venue.isOpen && (
            <span className="venue-chip left-2.5 top-2.5 gap-1 text-warning">
              <svg
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={ICON.closed} />
              </svg>
              ปิดชั่วคราว
            </span>
          )}

          {/* Hidden at 0 and at 1: "1 รูป" on a card that is showing the one photo tells nobody
              anything, and "0 รูป" is already said by the placeholder underneath it. */}
          {venue.photos.length > 1 && (
            <span className="venue-chip right-2.5 top-2.5 gap-1">
              <svg
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={ICON.photo} />
              </svg>
              <span>{venue.photos.length}</span>
            </span>
          )}
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-2 p-3.5">
          <span className="flex min-w-0 items-start justify-between gap-2">
            {/* `line-clamp-2`: a 70-character name wrapped to four lines and grew the card 30px
                past its row-mates. Two lines fits every real venue name and bounds the worst case. */}
            <span className="th-tight line-clamp-2 min-w-0 text-[15px] font-semibold leading-[1.45] text-base-content">
              {venue.name}
            </span>
            {/* ⚠️ SLATE, NOT SKY, WHEN THE CATEGORY IS THE TOMBSTONE — and keyed off `isFallback`,
                never off the name. `ไม่พบประเภทสถานที่` rendered in the same blue as `โรงยิม` reads
                as a category somebody chose; slate is what this portal already uses for "a system
                placeholder, not a real value". */}
            <span
              className={`badge shrink-0 ${
                venue.venueType.isFallback ? 'badge-slate' : 'badge-sky'
              }`}
            >
              {venue.venueType.name}
            </span>
          </span>

          {/* Why the venue is shut, on the card and not only in the dialog. "ปิดชั่วคราว" alone
              makes an operator open all nine to find out which one reopens on Monday. */}
          {!venue.isOpen && venue.closedReason && (
            <span className="rounded-control bg-warning/10 px-2.5 py-1.5 text-[13px] leading-[1.5] text-warning">
              {venue.closedReason}
            </span>
          )}

          <span className="flex flex-col gap-1">
            <span className="venue-meta">
              <svg
                aria-hidden="true"
                className="venue-meta-ico"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={ICON.people} />
              </svg>
              <span>
                ความจุ{' '}
                <span className="font-medium tabular-nums text-base-content/90">
                  {venue.capacity.toLocaleString('th-TH')}
                </span>{' '}
                คน
              </span>
            </span>
            <span className="venue-meta">
              <svg
                aria-hidden="true"
                className="venue-meta-ico"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={ICON.pin} />
                <path strokeLinecap="round" strokeLinejoin="round" d={ICON.pinOuter} />
              </svg>
              {/* An em dash, not an empty cell: ที่ตั้ง is optional, and a blank line where a line
                  is expected reads as data that failed to load. */}
              <span className="min-w-0 truncate">{venue.location || '—'}</span>
            </span>
          </span>

          {/* Three, then a count. Not a wrap: a venue with eleven amenities would grow its card past
              its neighbours and break the grid's row alignment, and the eleventh item is not what
              anybody scans for. */}
          {venue.amenities.length > 0 && (
            <span className="mt-auto flex flex-wrap gap-1 border-t border-base-300/70 pt-2.5">
              {shown.map((a) => (
                <span key={a.id} className="tag">
                  {a.name}
                </span>
              ))}
              {/* /70, not /60. At /60 the overflow tag measured 4.55:1 on the light theme —
                  passing by 0.05, which is a rounding error rather than a margin. It is the
                  lowest-contrast text on the card either way, so it is the one that gets the
                  headroom. */}
              {overflow > 0 && <span className="tag text-base-content/70">+{overflow}</span>}
            </span>
          )}
        </span>
      </button>
    </li>
  )
}

/** One skeleton card. The 16:9 box is the point — see `VenuesPage`'s loading panel. */
export function VenueCardSkeleton() {
  return (
    <li className="overflow-hidden rounded-card border border-base-300 bg-base-100 shadow-e1">
      <span className="sk-box block aspect-[16/9] w-full rounded-none" />
      <span className="block p-3.5">
        <span className="mb-2.5 flex items-center justify-between gap-2">
          <span className="sk-soft block h-4 w-32" />
          <span className="sk-soft block h-5 w-16 rounded-full" />
        </span>
        <span className="sk-soft mb-1.5 block h-3.5 w-24" />
        <span className="sk-soft block h-3.5 w-40" />
      </span>
    </li>
  )
}
