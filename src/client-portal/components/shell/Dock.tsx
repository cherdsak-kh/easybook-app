import type { ReactNode } from 'react'

/**
 * The floating bottom navigation pill. Prototype 2201–2243.
 *
 * ── 🔴 THIS IS NOT daisyUI'S `dock` COMPONENT, AND THE DIFFERENCE IS THE DESIGN ──
 * daisyUI's `dock` is a full-width bar pinned to the bottom edge. `D-C5` calls for a FLOATING
 * CARD: `justify-center` on a `pointer-events-none` `<nav>` gives the pill its content width and
 * leaves the gaps either side clickable through to the page. Composing this by hand is what
 * rule 4 of the daisyUI usage guide is for — the component that exists is a different shape, not
 * this one with different colours. The earlier full-width `grid grid-cols-4` version is exactly
 * what the PO rejected from real-device screenshots.
 *
 * ⚠️ `pointer-events-none` ON THE `<nav>`, `pointer-events-auto` ON THE `<ul>`. Without the
 * pair, an invisible full-width strip eats every tap in that row.
 *
 * ⚠️ `.dock-pill` MUST STAY ON THE `<ul>`. It is not a utility; it is the hook for the
 * `@supports not (backdrop-filter)` rule in `index.css` that restores an opaque background where
 * blur is unavailable. Remove it and a 90%-transparent pill floats over photographs with nothing
 * behind it, silently.
 *
 * ⚠️ `bg-base-100/90` — NOT `/85`, which the spec asked for and which DOES NOT EXIST. daisyUI's
 * token alpha steps run `/10` … `/90` in tens (`D-C11`); a step with no rule behind it renders
 * at full opacity with no error. `/90` rounds in the direction the spec intended (more opaque)
 * and matches every header in the portal, so the pill and the bars are the same material — which
 * matters most here, where 12px Thai labels with stacked tone marks sit over moving content.
 *
 * ── All four labels show at every width ──
 * 🕰️ KANIT-ERA FIGURE, NOT RE-VERIFIED AS A TOTAL. Measured from the font file (Kanit 500 advance
 * widths at 12px), the four items came to roughly 303px including gaps, padding and border; at
 * 375px the `<nav>` offers 343px, so nothing wraps. The app moved to Noto Sans Thai on
 * 6 ก.ย. 2569 and that 303px total was NOT recomputed — its padding/gap accounting could not be
 * reproduced from the current markup, so it is kept as history rather than restated with a number
 * nobody measured. Treat it as "was true in Kanit", and re-measure in the browser before leaning
 * on it for a new label.
 * What WAS re-measured, same method, both faces, LABELS ONLY at 12px/500: the four come to
 * 196.1px in Kanit and 194.1px in Noto Sans Thai (widest single label, การจองของฉัน: 73.7px →
 * 73.3px). Thai text is ~1% narrower in the new face, so the swap moves this fit in the safe
 * direction — but note the reverse holds for digits and Latin, which run 5–8% WIDER.
 * The earlier "four labels overflow" figure was computed from the old horizontal layout, where an
 * item was icon PLUS label wide; stacked, it is max(icon, label), and the labels are free.
 *
 * Rendered only for an `ALLOWED` user, and hidden on `venue` / `request` / `sent` — those are
 * one-way-in steps, and a nav bar there invites abandoning a half-filled form.
 */
export function Dock({ children }: { children: ReactNode }) {
  return (
    <nav
      aria-label="เมนูหลัก"
      className="dock-float pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4"
    >
      <ul className="dock-pill pointer-events-auto flex w-full items-center justify-center gap-1 rounded-full border border-base-content/10 bg-base-100/90 px-4 py-2 shadow-2xl backdrop-blur-xl sm:gap-10 lg:gap-20">
        {children}
      </ul>
    </nav>
  )
}
