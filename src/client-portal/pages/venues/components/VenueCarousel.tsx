import { useCallback, useEffect, useRef, useState } from 'react'
import { LIcon } from '@/client-portal/icons/LucideIcon'
import { VIcon } from '@/client-portal/icons/VenueIcon'
import type { VenuePhoto } from '@/lib/api-client'

/**
 * The venue photo gallery. Prototype 1085–1096 and `paintVenueChrome` (3975–4000).
 *
 * ── 🟠 THERE ARE NO PREV/NEXT BUTTONS AND NO DOTS, AND THAT IS THE DESIGN ──
 * The brief and `CHECKLIST.md` both ask for "carousel dots, 44 × 44". The prototype **replaced the
 * dot row with the `2/3` badge in the bottom-right corner** (1084): dots cost a whole extra row of
 * height to say what the counter already says in space that exists, and past five or six they stop
 * being countable at a glance. This is a **swipe** gallery — `overflow-x` with scroll-snap, which
 * is what a thumb does on a photo — so there is no control to size at 44 px. The tap-target rule is
 * not being waived; there is nothing here it applies to.
 *
 * ── 🔴 RESETTING TO THE FIRST PHOTO MUST BE A JUMP, NOT A SCROLL ──
 * daisyUI's `.carousel` sets `scroll-behavior: smooth` on itself, so `scrollLeft = 0` **animates**.
 * Measured in the prototype: moving from a venue whose third photo was showing to a venue with two
 * photos left the animation running, `scroll-snap` caught it midway, and the counter — which reads
 * real `scrollLeft` — printed `2/2` on a gallery that had just opened. The fix is to switch
 * `scroll-behavior` off **inline and temporarily**, never permanently: smooth is still what should
 * happen when the reader swipes.
 *
 * ⚠️ Reading `offsetWidth` between the writes forces layout at that point. Without it the three
 * statements can be collapsed into one style resolution, and the restored `scroll-behavior` wins
 * over the jump it was supposed to let through.
 */
export function VenueCarousel({ photos, venueName }: { photos: readonly VenuePhoto[]; venueName: string }) {
  const railRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  const ordered = [...photos].sort((a, b) => a.position - b.position)
  const count = ordered.length

  /* Jump back to the first photo whenever the venue changes. Keyed on the name rather than on the
     array, which is a new object on every render. */
  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    rail.style.scrollBehavior = 'auto'
    rail.scrollLeft = 0
    void rail.offsetWidth
    rail.style.scrollBehavior = ''
    setIndex(0)
  }, [venueName])

  /* The counter reads the real scroll position rather than tracking taps, so it stays honest when
     the reader flings the rail past two photos at once. */
  const onScroll = useCallback(() => {
    const rail = railRef.current
    if (!rail || rail.clientWidth === 0) return
    setIndex(Math.round(rail.scrollLeft / rail.clientWidth))
  }, [])

  return (
    <div className="relative w-full overflow-hidden rounded-box bg-base-200">
      {/* ⚠️ `no-sb` here but NOT on the home screen's 7-day strip: there the scrollbar is the only
          hint that the row scrolls, whereas here the `2/3` badge already says so, and a bar drawn
          across the middle of a photograph is surplus.
          ⚠️ `cursor-grab` affects the mouse only, and it is not decoration — on a desktop with no
          finger it is the sole indication that the rail can be dragged. */}
      <div
        ref={railRef}
        onScroll={onScroll}
        className="no-sb carousel aspect-video w-full cursor-grab select-none"
      >
        {count === 0 ? (
          /* ⚠️ VENUES WITH NO PHOTOS ARE REAL (`โรงยิม 3`, `ลานหน้าเสาธง`). The gallery must still
             have exactly one slide, or the box collapses to zero height. Same placeholder as the
             catalogue card, just larger. */
          <div className="carousel-item w-full shrink-0">
            <span className="flex h-full w-full items-center justify-center bg-base-200">
              <VIcon
                names="photoDetailed"
                strokeWidth={1.4}
                className="h-12 w-12 text-base-content/30"
              />
            </span>
          </div>
        ) : (
          ordered.map((p) => (
            <div key={p.id} className="carousel-item w-full shrink-0">
              {/* ⚠️ `draggable={false}`: without it, dragging on a desktop starts the browser's own
                  image drag and the gallery never moves. That is every `<img>`'s default. */}
              <img
                src={p.url}
                alt=""
                draggable={false}
                className="h-full w-full object-cover"
              />
            </div>
          ))
        )}
      </div>

      {/* ⚠️ Only from two photos up. `1/1` adds nothing the visible photo has not said, and it
          implies there is more to swipe to, which is false. */}
      {count > 1 ? (
        <span className="badge badge-sm absolute bottom-3 right-3 gap-1 border-base-content/20 bg-base-100/90 font-medium text-base-content backdrop-blur-xs">
          <LIcon name="image" className="h-3.5 w-3.5 shrink-0" />
          {Math.min(index + 1, count)}/{count}
        </span>
      ) : null}
    </div>
  )
}
