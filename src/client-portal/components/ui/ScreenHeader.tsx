import type { ReactNode } from 'react'
import { Breadcrumbs, type Crumb } from './Breadcrumbs'

/**
 * The sticky blurred bar at the top of ten screens (eleven headers — `#/venue/:id` and
 * `#/request/:id` each carry a two-tier one). Prototype 786 · 954 · 1065 · 1236 · 1531 · 1619 ·
 * 1666 · 1702 · 1958 · 2095 · 2121, all eleven byte-identical in their outer class list.
 *
 * ── 🔴 THERE IS NO BACK BUTTON, AND THAT IS A RULING, NOT AN OMISSION ──
 * `D-C3`: no in-page back arrow anywhere in this portal. LIFF draws one already, and a second
 * one competes with real history — pressing the wrong one is how a user ends up somewhere the
 * app did not send them. `DECISIONS.md` §4 lists it among the standing prohibitions. Screens
 * that need a named way back take `breadcrumbs` (`D-C14`) or put a labelled link at the end of
 * their content; neither of those is an arrow that races the platform's own.
 *
 * ── Two tiers or one, decided by whether there are breadcrumbs ──
 * The one-tier form (`#/home`, `#/settings`, `#/venues`, `#/bookings`) is a title, optionally
 * with a subtitle, over `pt-safe`. The two-tier form (`#/booking/:id`, `#/issues`, `#/manual`,
 * `#/rules`, `#/version`) puts a breadcrumb row above the title with its own hairline divider,
 * over `pt-safe-lg` — the extra 8px top is a measured fix for those screens reading cramped at
 * 49px with a single line squeezed between 12px above and below.
 *
 * ⚠️ THE TITLE SIZE DIFFERS BETWEEN THE TWO and it is not decoration: a tab-level screen gets
 * `text-xl`, a screen you drilled into gets `text-lg`, so the two levels are distinguishable
 * before the words are read.
 *
 * ⚠️ `bg-base-100/90` — NOT `/95`. daisyUI's token alpha steps exist only at `/10` … `/90`
 * (`D-C11`). A step that matches no rule does not error; it silently renders at FULL opacity,
 * and the header quietly stops being translucent. `.hdr-blur` carries no styling of its own: it
 * is the hook for the `@supports not (backdrop-filter)` rule in `index.css` that restores an
 * opaque plate where blur is unavailable, because a 90%-transparent bar with no blur behind it
 * is unreadable rather than merely softer.
 *
 * ⚠️ SUBTITLES ARE NOT OPTIONAL DECORATION EITHER. `#/settings` gained one so that all four
 * dock destinations have equal-height headers — otherwise the content below jumps every time
 * the user switches tabs, which reads as a stutter rather than as a different screen. A
 * subtitle should say what can be DONE here, not restate the title in other words.
 */

/**
 * The width ladder every client screen shares, exported because the body below the header must
 * use the identical one or the header's contents and the page's contents fall out of alignment.
 *
 * ⚠️ THE FIRST STEP IS `sm:`, NOT `md:`, AND THAT IS MEASURED. The target tablet reports 670 CSS
 * px, which is BELOW `md`. A ladder that starts at `md` leaves that device on the phone layout.
 */
export const SCREEN_WIDTH = 'mx-auto w-full max-w-md px-4 sm:max-w-2xl md:max-w-4xl lg:max-w-5xl'

export function ScreenHeader({
  title,
  subtitle,
  breadcrumbs,
  action,
  children,
}: {
  title: ReactNode
  /** One line saying what can be done here. Renders only in the one-tier form. */
  subtitle?: ReactNode
  /** Present = the two-tier layout. `D-C14`: this is the named way back, not an arrow. */
  breadcrumbs?: readonly Crumb[]
  /** Trailing control on the title row — a filter button, a menu. Keep it ≥ 44 × 44. */
  action?: ReactNode
  /** Anything that must sit under the title inside the sticky bar (a search row, chips). */
  children?: ReactNode
}) {
  const twoTier = breadcrumbs !== undefined && breadcrumbs.length > 0

  return (
    <header className="hdr-blur sticky top-0 z-30 border-b border-base-300 bg-base-100/90 shadow-xs backdrop-blur-md">
      {twoTier && (
        /* A second, fainter divider under the crumbs — `/60` so the two rows read as one bar
           with an internal seam, not as two stacked bars. */
        <div className="border-b border-base-300/60">
          <div className={`${SCREEN_WIDTH} pb-2.5 pt-safe-lg`}>
            <Breadcrumbs trail={breadcrumbs} className="text-xs text-base-content/60" />
          </div>
        </div>
      )}

      <div className={`${SCREEN_WIDTH} ${twoTier ? 'py-3' : 'pb-3 pt-safe'}`}>
        <div className="flex items-center gap-3">
          {/* `min-w-0` on the text column, or `truncate` on the title silently does nothing —
              a flex item's default `min-width: auto` refuses to shrink below its content. */}
          <div className="min-w-0 grow">
            <h1
              className={
                twoTier
                  ? 'truncate text-lg font-semibold leading-snug'
                  : 'truncate text-xl font-semibold'
              }
            >
              {title}
            </h1>
            {!twoTier && subtitle ? (
              <p className="mt-0.5 text-xs text-base-content/60">{subtitle}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        {children}
      </div>
    </header>
  )
}
