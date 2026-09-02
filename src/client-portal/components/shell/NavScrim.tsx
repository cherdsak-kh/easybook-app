/**
 * The fade behind the floating dock. Prototype 2172.
 *
 * ── What it fixes ──
 * Without it, content scrolls under the dock with a hard edge and nothing says where the list
 * ends. The gradient runs from opaque `base-100` at the bottom of the screen to transparent at
 * 60px, so the line about to pass under the pill fades out instead of being cut off.
 *
 * ⚠️ `aria-hidden` AND `pointer-events-none`. It is decoration only and must never eat a click
 * meant for the content behind it — a full-width invisible layer that swallows taps is the
 * failure mode here, and it is invisible in review by definition.
 *
 * ⚠️ THE GRADIENT LIVES IN `.nav-scrim` IN `index.css`, NOT IN UTILITIES. In the prototype's CDN
 * build no `from-`/`via-`/`to-` utilities existed for daisyUI token colours, so the spec's
 * gradient compiled to nothing and the fade was silently 100% transparent. It stays as CSS here
 * because that rule is what was reviewed on real devices, `color-mix` in oklab included.
 *
 * ⚠️ `h-15` (60px) is the PO's own adjustment down from `h-24`. `.pad-nav`'s 7rem bottom padding
 * is computed to clear this scrim rather than the dock, because the scrim is the taller of the
 * two — so if this height changes, that padding has to be re-checked.
 *
 * Rendered together with `Dock`, on the same condition: only for an `ALLOWED` user, and never on
 * `venue` / `request` / `sent`.
 */
export function NavScrim() {
  return (
    <div
      className="nav-scrim pointer-events-none fixed inset-x-0 bottom-0 z-30 h-15"
      aria-hidden="true"
    />
  )
}
