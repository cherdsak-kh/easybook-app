import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AvailabilityCalendar, type CalendarView } from './components/AvailabilityCalendar'
import { SlotList } from './components/SlotList'
import { VenueCarousel } from './components/VenueCarousel'
import { addDays, availabilityWindow, midnight, type VenueSlot } from './venue-availability'
import { getVenue, isNotFound, listAvailability, messageFor } from './venues-api'
import { Skeleton } from '@/client-portal/components/feedback/Skeleton'
import { Breadcrumbs } from '@/client-portal/components/ui/Breadcrumbs'
import { LIcon } from '@/client-portal/icons/LucideIcon'
import { TH_DOW_FULL, fmtD } from '@/client-portal/lib/formatters'
import type { Venue } from '@/lib/api-client'

/**
 * `#/venue/:id` — one venue, its availability, and the way into a request. Prototype 1058–1234.
 *
 * ── 🟠 NO IN-PAGE BACK ARROW, ANYWHERE (`D-C3` rule 2) ──
 * LIFF draws its own. A second one is a second answer to the same question, and the two disagree
 * the moment history and layout do. The way back is the breadcrumb (`D-C14`), which names its own
 * destination — which is exactly why it can coexist with LIFF's arrow without contradicting it.
 *
 * ── ⚠️ THE TRAIL IS TWO LEVELS, NOT THREE ──
 * `จองสถานที่ › ชื่อสถานที่` (prototype 3955). The brief asks for a `หน้าแรก` root; the prototype
 * does not have one here, and adding it would claim this screen was reached through the home
 * screen, which it was not — it is reached from the catalogue, which is what the trail says.
 *
 * ── 🔴 A CLOSED VENUE IS READ-ONLY, NOT HIDDEN ──
 * The alert sits ABOVE the photo, not below it: somebody arriving by deep link needs to know they
 * cannot book before they start reading how good the room is. The CTA is **disabled, not removed**
 * — a button that has vanished makes the screen look half-loaded, whereas one that is present and
 * unpressable, with the reason written on its face, answers "why can't I". And it is `disabled` for
 * real, not merely `btn-disabled`: the class only makes it *look* unpressable while keyboard and
 * screen-reader users can still activate it.
 *
 * ── 🔴 THE CALENDAR HAS NO DATA SOURCE YET, AND THIS IS NOT A BUG IN THIS SCREEN ──
 * `listAvailability()` is a seam over an endpoint that `TRANSPORT.md` §3.1 assigns to
 * `CLIENT-BOOKING-1` — Phase 5a, unbuilt. In production it resolves to `[]`, so every day renders
 * the empty-day card, which is a true statement about what this app can currently read.
 */

export function VenueDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [venue, setVenue] = useState<Venue | null>(null)
  const [slots, setSlots] = useState<readonly VenueSlot[]>([])
  const [failure, setFailure] = useState<string | null>(null)

  const today = midnight(new Date())
  const [picked, setPicked] = useState<Date>(today)
  const [view, setView] = useState<CalendarView>('week')
  const [anchor, setAnchor] = useState({
    week: addDays(today, -today.getDay()),
    month: new Date(today.getFullYear(), today.getMonth(), 1),
  })

  /* ⚠️ THE SELECTED DAY RESETS ONLY WHEN THE VENUE CHANGES — keyed on `id`. Re-entering the same
     screen (pressing back out of `#/request/:id`, say) must return the day the reader had chosen,
     not snap to today and throw away what they just did. */
  useEffect(() => {
    const t = midnight(new Date())
    setPicked(t)
    setView('week')
    setAnchor({ week: addDays(t, -t.getDay()), month: new Date(t.getFullYear(), t.getMonth(), 1) })
  }, [id])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setVenue(null)
    setFailure(null)
    void (async () => {
      try {
        const found = await getVenue(id)
        if (cancelled) return
        setVenue(found)
        /* Availability is fetched separately and its failure is NOT this screen's failure: the
           venue's own facts (where it is, how many fit) are still worth showing when the schedule
           cannot be read. */
        try {
          /* ⚠️ AN EXPLICIT WINDOW, not the endpoint's default. Its default is the current month,
             which is what the calendar opens on — and the first press of the "next month" arrow
             would then draw an empty month that is not empty. See `availabilityWindow`. */
          const { from, to } = availabilityWindow()
          const rows = await listAvailability(id, from, to)
          if (!cancelled) setSlots(rows)
        } catch (error) {
          console.warn('[venue] availability failed:', error)
        }
      } catch (error) {
        if (cancelled) return
        /* 🔴 A BAD `:id` GOES BACK TO THE CATALOGUE, NEVER TO A BLANK SCREEN (`PAGE_INDEX.md`
           §2.3). The reader is looking for *a venue*; dropping them on the welcome screen makes
           them navigate again. `replace`, so pressing back does not walk into the 404 they just
           left. A 404 and a soft-deleted venue are byte-identical here by design. */
        if (isNotFound(error)) {
          void navigate('/venues', { replace: true })
          return
        }
        console.warn('[venue] load failed:', error)
        setFailure(messageFor(error))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, navigate])

  if (failure) {
    return (
      <section className="pb-safe grid min-h-dvh place-items-center px-4">
        <div role="alert" className="w-full max-w-sm rounded-box border border-error/40 bg-base-100 p-6 text-center">
          <p className="text-sm font-medium">{failure}</p>
          <Link to="/venues" className="btn btn-app btn-outline mt-4 w-full">
            กลับสู่รายการสถานที่
          </Link>
        </div>
      </section>
    )
  }

  /* ⚠️ `pb-safe`, NOT `pad-nav` — this screen is not in `NAV_SCREENS`, so no dock appears and there
     is nothing to reserve room for. Reserving it anyway leaves 7 rem of empty space under the CTA. */
  return (
    <section className="pb-safe min-h-dvh">
      <header className="hdr-blur sticky top-0 z-30 border-b border-base-300 bg-base-100/90 shadow-xs backdrop-blur-md">
        <div className="border-b border-base-300/60">
          <div className="mx-auto w-full max-w-md px-4 pb-2.5 pt-safe-lg sm:max-w-2xl md:max-w-4xl lg:max-w-5xl">
            {/* ⚠️ The venue name appears twice on purpose — at the end of the trail and as the
                `<h1>`. The trail says where you came FROM; the heading says where you ARE. */}
            <Breadcrumbs
              className="text-xs text-base-content/60"
              trail={[{ label: 'จองสถานที่', to: '/venues' }, { label: venue?.name ?? '…' }]}
            />
          </div>
        </div>
        <div className="mx-auto w-full max-w-md px-4 py-3 sm:max-w-2xl md:max-w-4xl lg:max-w-5xl">
          <h1 className="truncate text-lg font-semibold leading-snug">
            {venue?.name ?? <Skeleton className="h-6 w-2/3" />}
          </h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-md px-4 pt-4 sm:max-w-2xl md:max-w-4xl lg:max-w-5xl">
        {venue === null ? (
          <div className="space-y-4">
            <Skeleton className="aspect-video w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            {/* ⚠️ ABOVE THE PHOTO, not below it — see the header note. */}
            {/* 🔴 `text-base-content` ON THE WORDS, NOT ON THE ALERT (P5b). daisyUI's
                  `alert-soft` colours its text with the semantic token, and in the LIGHT theme
                  that measures **2.04:1** for `warning` — the worst reading in this portal, and it
                  shipped in P4 unnoticed. The full sweep: success 3.45 · warning 2.04 · error 4.36
                  · info 4.64, against 16.0–17.0 once the text is `base-content`. Dark passes on its
                  own (4.97–7.76), which is why it hid.
                  ⚠️ THE CLASS GOES ON THE `<span>` so the ICON KEEPS the semantic colour — moving
                  it to the container greys the icon out and the alert levels stop being
                  distinguishable at a glance. The icon is `aria-hidden` and decorative: the Thai
                  beside it says the same thing, and the level is also carried by the background. */}
            {!venue.isOpen ? (
                <div role="alert" className="alert alert-warning alert-soft mb-4 text-sm">
                <LIcon name="circleAlert" className="h-5 w-5 shrink-0" />
                <span className="text-base-content">
                  <span className="font-semibold">ปิดปรับปรุงชั่วคราว</span> —{' '}
                  {venue.closedReason || 'ปิดปรับปรุงชั่วคราว'}
                </span>
              </div>
            ) : null}

            <VenueCarousel photos={venue.photos} venueName={venue.name} />

            {/* ─── One card for "what is this room like" ────────────────────────────────
                🔴 CATEGORY · LOCATION · CAPACITY · DESCRIPTION · AMENITIES IN A SINGLE CARD. They
                used to be several boxes each with its own border, which made a screen holding
                little information read as several unrelated headings. All five answer one question.
                ⚠️ THE AMENITY BADGES DEPEND ON THIS CARD'S `bg-base-100` (`DECISIONS.md` §3.3). A
                `base-200` pill on a `base-200` page surface measures **1.05** in light and simply
                dissolves into plain words; the fix was the SURFACE, not the badge, which is why the
                tags must never be lifted out of a `bg-base-100` container. */}
            <div className="card mt-4 bg-base-100 shadow-sm">
              <div className="card-body gap-2.5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="badge badge-sm border-base-content/20 bg-base-200 font-medium text-base-content/80">
                    {venue.venueType.name}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-base-content/70">
                  <p className="flex items-center gap-1.5">
                    <LIcon name="mapPin" className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 font-medium text-base-content/90">
                      {venue.location || '—'}
                    </span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <LIcon name="users" className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0">
                      รองรับ {venue.capacity.toLocaleString('th-TH')} คน
                    </span>
                  </p>
                </div>
                {venue.description ? (
                  <p className="mt-1 text-sm leading-relaxed text-base-content/80">
                    {venue.description}
                  </p>
                ) : null}

                {/* ⚠️ NOT TRUNCATED AT THREE HERE, unlike the catalogue card. A card in a list is
                    scanned against its neighbours, so the eleventh amenity is not what anyone is
                    looking for; this screen is where the decision is made, and "is there a
                    microphone" is asked here and nowhere else. */}
                {venue.amenities.length > 0 ? (
                  <div className="mt-2 border-t border-base-200/80 pt-3">
                    <p className="mb-2 text-xs font-semibold text-base-content/60">
                      สิ่งอำนวยความสะดวก
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {venue.amenities.map((a) => (
                        /* Identical to the catalogue card's tag, to the character (PO,
                           27 ส.ค. 2569) — the same badge in two screens must be the same, not
                           similar. */
                        <span
                          key={a.id}
                          className="badge badge-xs border-none bg-base-200 text-base-content/70"
                        >
                          {a.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* ─── Availability ────────────────────────────────────────────────────────
                ⚠️ THE SECTION HEADING EXISTS BECAUSE THE CALENDAR USED TO FOLLOW THE INFO CARD
                with nothing between them, so it read as a continuation of the card above. The
                sub-line says what can be done here rather than restating the heading: this calendar
                answers two questions at once, and the coloured bar under each date is only legible
                once the reader knows what they are looking at. */}
            <div className="mb-2 mt-6">
              <h2 className="text-base font-semibold text-base-content">
                ปฏิทินความพร้อมและการใช้สถานที่
              </h2>
              <p className="mt-0.5 text-xs text-base-content/60">
                ตรวจสอบช่วงเวลาว่าง หรือกิจกรรมที่ได้รับอนุมัติแล้ว
              </p>
            </div>
            <AvailabilityCalendar
              slots={slots}
              view={view}
              onViewChange={setView}
              anchorWeek={anchor.week}
              anchorMonth={anchor.month}
              onAnchorChange={setAnchor}
              selected={picked}
              onSelect={setPicked}
              today={today}
            />

            {/* ⚠️ THE HEADING NAMES THE SELECTED DAY IN FULL. The calendar is directly above, but
                once the page is scrolled the reader can no longer see which cell is chosen. */}
            <div className="mt-6">
              <h2 className="font-semibold">ตารางการใช้งาน</h2>
              <p className="mt-0.5 text-sm text-base-content/60">
                {TH_DOW_FULL[picked.getDay()]}ที่ {fmtD(picked)}
              </p>
            </div>
            <div className="mt-3 space-y-3">
              <SlotList slots={slots} day={picked} />
            </div>

            {/* ─── CTA ─────────────────────────────────────────────────────────────────
                ⚠️ THE LINE UNDER THE BUTTON IS NOT IN THE WAY. It states P2 rule 2 ("this is a
                REQUEST") *after* the button, not before: somebody who has already decided can press
                straight away, and somebody who has not learns it before the next screen. */}
            <div className="mb-8 mt-6">
              {venue.isOpen ? (
                <Link to={`/request/${venue.id}`} className="btn btn-app btn-primary w-full shadow-sm">
                  ยื่นคำขอใช้สถานที่
                </Link>
              ) : (
                <button type="button" disabled className="btn btn-app btn-disabled w-full shadow-sm">
                  สถานที่ปิดปรับปรุงชั่วคราว
                </button>
              )}
              {venue.isOpen ? (
                <p className="mt-2 text-center text-xs text-base-content/60">
                  คำขอจะถูกส่งให้เจ้าหน้าที่พิจารณา ยังไม่ถือเป็นการจองที่ได้รับอนุมัติ
                </p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
