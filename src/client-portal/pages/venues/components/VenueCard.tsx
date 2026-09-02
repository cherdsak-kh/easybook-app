import { Link } from 'react-router-dom'
import { LIcon } from '@/client-portal/icons/LucideIcon'
import { VIcon } from '@/client-portal/icons/VenueIcon'
import type { Venue } from '@/lib/api-client'

/**
 * One venue in the catalogue grid. Prototype `vnCard` (3348) / `vnBody` (3311).
 *
 * ── 🔴 THE WHOLE CARD IS THE TARGET, AND IT IS A REAL `<Link>` ──
 * The "ดูรายละเอียดและขอจอง" button that used to sit at the bottom was deleted (1 ก.ย. 2569), and
 * not for looks: a card with a button inside it means **the other 90 % of the card does nothing**,
 * which is the opposite of what a thumb does automatically. As a link the browser supplies for free
 * everything a click handler would have to reimplement — context menu, open-in-new-tab, keyboard
 * focus, and a cursor that says "link".
 *
 * ── 🔴 A CLOSED VENUE IS NOT A LINK ──
 * It renders as a `<div aria-disabled="true">`, so it cannot be opened from here at all. Note the
 * consequence, which is deliberate and worth knowing: **there is no route to โรงยิม 2's detail
 * screen from this screen** — `/venue/v2` typed directly still works, and still renders, because
 * `isOpen` means "accepts no new requests", not "is hidden".
 *
 * ⚠️ THE SCRIM IS ON THE PHOTO, NOT ON THE CARD. The name, location and capacity have to stay
 * readable: "where is โรงยิม 2 and how many people fit" does not stop being a question while it is
 * shut. Keeping the photo visible underneath is also what makes the card read as *a closed venue*
 * rather than as *an alert box*.
 */

/** Prototype `VN_TAG` behaviour — the amenity pill, dimmed when the venue is closed. */
function amenityTag(open: boolean): string {
  return `badge badge-xs border-none ${open ? 'bg-base-200 text-base-content/70' : 'bg-base-300 text-base-content/50'}`
}

function Cover({ venue, open }: { venue: Venue; open: boolean }) {
  const cover = venue.photos.find((p) => p.position === 0) ?? venue.photos[0]
  if (!cover) {
    /* ⚠️ A PLACEHOLDER, NOT AN `<img>` WITH AN EMPTY `src`. Two venues in the dataset genuinely
       have no photos; an empty `src` makes the browser draw its own broken-image glyph, which
       reads as "this failed to load" rather than "no photo yet". `strokeWidth` 1.4 and the
       heroicons `photoDetailed` are the admin card's, imported not redrawn. */
    return (
      <span
        className={`flex h-full w-full items-center justify-center ${open ? 'bg-base-200' : 'bg-base-300'}`}
      >
        <VIcon names="photoDetailed" strokeWidth={1.4} className="h-10 w-10 text-base-content/30" />
      </span>
    )
  }
  /* `alt=""` and not the venue name: the name is on the very next line of the same link, and
     repeating it makes a screen reader announce the venue twice per card. */
  return (
    <img
      src={cover.url}
      alt=""
      className={`h-full w-full object-cover${open ? '' : ' grayscale-[40%]'}`}
    />
  )
}

function Body({ venue, open }: { venue: Venue; open: boolean }) {
  const dim = open ? 'text-base-content/70' : 'text-base-content/60'
  const shown = venue.amenities.slice(0, 3)
  const over = venue.amenities.length - shown.length

  return (
    <div className="card-body gap-1.5 p-4">
      <div className="flex items-start justify-between gap-2">
        <h2
          className={`flex min-w-0 items-center gap-1.5 text-base font-semibold leading-snug ${open ? 'text-base-content' : 'text-base-content/80'}`}
        >
          <LIcon
            name="building2"
            className={`h-4 w-4 shrink-0 ${open ? 'text-primary' : 'text-base-content/50'}`}
          />
          <span className="truncate">{venue.name}</span>
        </h2>
        <span
          className={`badge badge-sm shrink-0 font-medium ${open ? 'border-base-content/20 bg-base-200 text-base-content/80' : 'border-base-content/20 bg-base-300 text-base-content/60'}`}
        >
          {venue.venueType.name}
        </span>
      </div>

      {/* ⚠️ TWO LINES, NOT ONE. Location and capacity answer different questions ("where do I go"
          vs "do my people fit"), and side by side they get truncated together.
          ⚠️ `truncate` IS ON THE LOCATION ONLY. `รองรับ 900 คน` clipped to `รองรับ 9…` is not a
          shorter string, it is a WRONG NUMBER. */}
      <p className={`flex items-center gap-1.5 text-xs ${dim}`}>
        <LIcon name="mapPin" className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{venue.location || '—'}</span>
      </p>
      <p className={`flex items-center gap-1.5 text-xs ${dim}`}>
        <LIcon name="users" className="h-3.5 w-3.5 shrink-0" />
        {/* 🔴 `คน`, NEVER `ที่นั่ง` (PO, 2 ก.ย. 2569). Half the venues have no chairs at all —
            "รองรับ 800 ที่นั่ง" for an outdoor courtyard is wrong data, not merely an odd word. */}
        <span>รองรับ {venue.capacity.toLocaleString('th-TH')} คน</span>
      </p>

      {/* Three amenities then a count — the eleventh is not what anyone is scanning for. A closed
          card gets no `+N`, because it is not an option being compared. */}
      {shown.length > 0 ? (
        <div
          className={`mt-1 flex flex-wrap gap-1 border-t pt-2.5 ${open ? 'border-base-200/80' : 'border-base-300/80'}`}
        >
          {shown.map((a) => (
            <span key={a.id} className={amenityTag(open)}>
              {a.name}
            </span>
          ))}
          {open && over > 0 ? (
            <span className="badge badge-xs border-none bg-base-200 text-base-content/50">
              +{over}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function VenueCard({ venue }: { venue: Venue }) {
  if (!venue.isOpen) {
    return (
      <div
        aria-disabled="true"
        className="card cursor-not-allowed select-none overflow-hidden border border-base-300 bg-base-200/60 text-start opacity-70 shadow-none"
      >
        <figure className="relative aspect-video w-full overflow-hidden bg-base-300">
          <Cover venue={venue} open={false} />
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral/80 p-3 text-center text-neutral-content backdrop-blur-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-error px-2.5 py-1 text-xs font-semibold text-error-content shadow-xs">
              <LIcon name="circleAlert" className="h-3.5 w-3.5 shrink-0" />
              ปิดปรับปรุง
            </span>
            {venue.closedReason ? (
              <p className="mt-1.5 line-clamp-2 max-w-[90%] text-xs font-normal leading-relaxed text-neutral-content/90">
                หมายเหตุ: {venue.closedReason}
              </p>
            ) : null}
          </div>
        </figure>
        <Body venue={venue} open={false} />
      </div>
    )
  }

  return (
    <Link
      to={`/venue/${venue.id}`}
      className="card overflow-hidden border border-base-300 bg-base-100 text-start shadow-sm hover:border-base-content/20 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.99] motion-safe:transition-all"
    >
      <figure className="relative aspect-video w-full overflow-hidden bg-base-200">
        <Cover venue={venue} open />
        {/* Only when there is more than one — "1 รูป" says nothing the visible photo has not
            already said, and it implies there is more to swipe, which is untrue.
            ⚠️ `/90`, not `/95`: token alphas in this build come in steps of ten, and `/95` matches
            no rule at all — the badge would silently render fully opaque. */}
        {venue.photos.length > 1 ? (
          <span className="badge badge-sm absolute right-2.5 top-2.5 gap-1 border-base-content/20 bg-base-100/90 font-medium text-base-content backdrop-blur-xs">
            <LIcon name="image" className="h-3.5 w-3.5 shrink-0" />
            {venue.photos.length} รูป
          </span>
        ) : null}
      </figure>
      <Body venue={venue} open />
    </Link>
  )
}
