import type { ReactNode } from 'react'

/**
 * The floating bottom navigation pill (fluid 4-column capsule).
 * Prototype: `client_portal_prototype.html` 2204–2209.
 *
 * ── Geometry ──
 * - `w-full max-w-md` — fluid at 100% on a phone, capped at 448px so the capsule stops
 *   stretching into an oversized bar on tablet/desktop.
 * - `grid grid-cols-4` — four equal 25% columns. Nothing in here is measured in px, which is
 *   what removes the overflow and the clipped Thai labels at 360–375px.
 * - `p-1.5 gap-1` — compact internal padding; the touch surface belongs to the items.
 *
 * ── 🔴 NOT daisyUI'S `dock` COMPONENT, AND THE DIFFERENCE IS THE DESIGN ──
 * daisyUI's `dock` is a full-width bar pinned to the bottom edge, built from `<button>` +
 * `dock-label`. This is a FLOATING, WIDTH-CAPPED CARD of router links: `justify-center` on a
 * `pointer-events-none` `<nav>` centres it and leaves the gaps either side clickable through to
 * the page. Composing it by hand is what rule 4 of the daisyUI usage guide is for — the
 * component that exists is a different shape, not this one with different colours.
 *
 * ⚠️ `pointer-events-none` ON THE `<nav>`, `pointer-events-auto` ON THE `<ul>`. Without the
 * pair, an invisible full-width strip eats every tap in that row.
 *
 * ⚠️ `.dock-pill` MUST STAY ON THE `<ul>`. It is not a utility; it is the hook for the
 * `@supports not (backdrop-filter)` rule in `index.css` that restores an opaque background where
 * blur is unavailable. Remove it and a 90%-transparent pill floats over photographs with nothing
 * behind it, silently.
 *
 * ⚠️ `bg-base-100/90` — NOT `/85`, which does not exist. daisyUI's token alpha steps run
 * `/10` … `/90` in tens; a step with no rule behind it renders at full opacity with no error.
 * `/90` also matches every header in the portal, so the pill and the bars are the same material.
 */
export function Dock({ children }: { children: ReactNode }) {
  return (
    <nav
      aria-label="เมนูหลัก"
      className="dock-float pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3"
    >
      <ul className="dock-pill pointer-events-auto grid w-full max-w-md grid-cols-4 items-center gap-1 rounded-full border border-base-content/10 bg-base-100/90 p-1.5 shadow-2xl backdrop-blur-xl">
        {children}
      </ul>
    </nav>
  )
}
