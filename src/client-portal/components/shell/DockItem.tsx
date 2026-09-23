import { Link } from 'react-router-dom'
import { LIcon } from '@/client-portal/icons/LucideIcon'
import type { LIconName } from '@/client-portal/icons/licon'

/**
 * One tab in the fluid floating dock. Prototype: `client_portal_prototype.html` 2210–2214 (four
 * of these, byte-identical apart from the destination, the icon and the label).
 *
 * ── Geometry ──
 * - `w-full min-h-12` — fills its 25% grid column, and 48px is the floor for the tap target
 *   (WCAG 2.5.5). The height is DECLARED here, not inferred from padding plus font metrics, so
 *   it survives a change to the label size or the line-height.
 * - `py-1 text-[11px] sm:text-[12px]` — 11px keeps การจองของฉัน on one line inside a 25% column
 *   at 360px; 12px from `sm` up, where there is room for it.
 *
 * ⚠️ `aria-label` STAYS EVEN THOUGH THE LABEL IS VISIBLE. It overrides the name computed from
 * the content, so it must match the visible text character for character (WCAG 2.5.3) — both
 * come from the same `label` prop precisely so they cannot drift, which is what the prototype
 * has to enforce by hand across four copies.
 *
 * ⚠️ THE CURRENT-TAB TINT IS BOUND TO `aria-current="page"`, not to a class
 * (`.dock-item[aria-current="page"]` in `index.css`). Colour and what a screen reader announces
 * come from one value and cannot end up in different states. It is a NEUTRAL wash, not
 * `primary`: this portal reads neutral by design.
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
        className="dock-item flex min-h-12 w-full flex-col items-center justify-center gap-1 rounded-full py-1 text-[11px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 motion-safe:transition-colors sm:text-[12px]"
      >
        <LIcon name={icon} className="h-5 w-5 shrink-0" />
        <span className="whitespace-nowrap">{label}</span>
      </Link>
    </li>
  )
}
