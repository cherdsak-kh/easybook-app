import { Link } from 'react-router-dom'
import { LIcon } from '@/client-portal/icons/LucideIcon'
import type { LIconName } from '@/client-portal/icons/licon'

/**
 * One tab in the floating dock. Prototype 2238–2241 (four of these, byte-identical apart from
 * the destination, the icon and the label).
 *
 * ── The geometry, measured rather than estimated ──
 * `pt-2` (8) + icon `h-5` (20) + `gap-1` (4) + a 12px label line at Tailwind's 1.5 line-height
 * (18) + `pb-1` (4) = **54px**, comfortably over the 44px floor. `min-h-11` is therefore a NET,
 * not the thing that sets the height: it catches the day someone edits the label size or the
 * line-height and the box quietly shrinks. That is a guarantee that does not depend on font
 * metrics.
 *
 * ⚠️ THE PROTOTYPE'S `.dock-item::after` WAS DELETED AND MUST NOT COME BACK. It was a 2.75rem
 * pseudo-element that pushed a 36px item up to a 44px target, back when the icon and label sat
 * side by side. With the vertical layout the item is already larger than it, so keeping it would
 * leave a 44px box INSIDE a 54px item — dead CSS that still reads like a guarantee, which is
 * worse than no guarantee at all.
 *
 * ⚠️ `aria-label` STAYS EVEN THOUGH THE LABEL IS VISIBLE. It overrides the name computed from
 * the content, so it must match the visible text character for character (WCAG 2.5.3) — this
 * component derives both from the same `label` prop precisely so they cannot drift, which is
 * what the prototype had to enforce by hand across four copies.
 *
 * ⚠️ THE CURRENT-TAB TINT IS BOUND TO `aria-current="page"`, not to a class
 * (`.dock-item[aria-current="page"]` in `index.css`). Colour and what a screen reader announces
 * come from one value and cannot end up in different states. It is a NEUTRAL wash, not
 * `primary`: this portal reads neutral by design.
 *
 * ⚠️ NOW A ROUTER `Link` (P2, 2 ก.ย. 2569) — it was a bare `<a href>` while there was no router
 * to bind to, and the geometry above is untouched by the swap. `Link` still renders a real
 * `<a href>`, so `D-C3`'s point stands: the destination is a URL that can be middle-clicked,
 * copied and restored by LINE. What changes is that following it no longer reloads the SPA and
 * re-runs the whole gate.
 *
 * ⚠️ `NavLink` WAS NOT USED, DELIBERATELY. It would compute `active` from the URL itself — but
 * the dock's rule is not "this tab's path equals the URL": `/venue/3` highlights จองสถานที่ and
 * `/version` highlights ตั้งค่า (`NAV_TAB`). One table decides, and it is not this component.
 */
export function DockItem({
  href,
  label,
  icon,
  active = false,
}: {
  href: string
  /** The visible text. Also becomes the `aria-label`, so the two can never disagree. */
  label: string
  icon: LIconName
  active?: boolean
}) {
  return (
    <li>
      <Link
        to={href}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        className="dock-item flex min-h-11 w-[90px] min-w-[56px] flex-col items-center justify-center gap-1 rounded-full px-4 pb-1 pt-2 text-[12px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 motion-safe:transition-colors sm:w-[120px]"
      >
        <LIcon name={icon} className="h-5 w-5 shrink-0" />
        <span className="whitespace-nowrap">{label}</span>
      </Link>
    </li>
  )
}
