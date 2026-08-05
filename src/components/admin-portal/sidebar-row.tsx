// Ported from DashWind (daisyui-admin-dashboard-template) — MIT (c) 2022 Dashwind. See THIRD_PARTY_NOTICES.md
// The ONE definition of a sidebar row. `AdminPortalSidebar` (top level) and
// `SidebarSubmenu` (nested) both render these two components, so a top-level row and a
// submenu row can never drift in height, type size, icon size, motion or focus treatment —
// which is exactly what happened before, when the nested list used `menu-sm` + `py-2.5` +
// `h-5 w-5` icons and silently fell under the 44px tap target.
import { NavLink } from 'react-router-dom'
import type { NavLeaf, NavSubmenu } from './nav-config'

/**
 * Row chrome for every interactive sidebar control (leaf link AND submenu toggle).
 *
 * Sizing / a11y decisions, all measurable:
 *  - `text-lg` (18px) + `py-3` + `min-h-11` → a rendered row height of ≥44px including the
 *    nested submenu rows. `min-h-11` is the belt to `py-3`'s braces: it holds the floor
 *    even if the theme retunes line-height.
 *  - `rounded-lg` deliberately overrides the theme's `--radius-field` (2rem in `cupcake`,
 *    i.e. a full pill). A pill cannot host a flush left active rail; with `overflow-hidden`
 *    the rail is clipped to this softer corner instead of poking out of it.
 *  - Colour comes from semantic tokens ONLY, and the pairs are chosen so label contrast
 *    clears 4.5:1 in BOTH themes (`cupcake` / `dashwind-dark`) in every state. daisyUI's
 *    stock hover/focus fill (`base-content` at 10%) measures 4.38:1 on `dashwind-dark`,
 *    i.e. it FAILS, so hover and focus are pinned to `base-200` (14.21:1 / 7.44:1) and
 *    active to `base-300` (13.21:1 / 7.83:1) instead.
 *  - the `focus-visible` ring is 2px + a 2px offset in `base-content` over a `base-100`
 *    offset (15.91:1 / 7.03:1). It is a box-shadow ring, not an `outline`, because
 *    daisyUI's menu explicitly sets `outline-style: none` on `:focus-visible` — an outline
 *    would be silently erased.
 *
 * Motion ("playful, not overwhelming"):
 *  - hover = 200ms background + a soft shadow + a 1.02 scale (well inside the menu's own
 *    0.5rem padding, so it neither reflows neighbours nor adds a horizontal scrollbar).
 *  - the scale sits behind `motion-safe:` and the whole transition is dropped under
 *    `motion-reduce:`, so a reduced-motion user keeps the colour/shadow affordance — just
 *    instantly, and with no transform.
 */
function rowClass(isActive: boolean): string {
  return [
    // Positioning context for the active rail, clipped to the row's corners.
    'relative overflow-hidden rounded-lg',
    // Type + tap target.
    'min-h-11 gap-3 py-3 text-lg',
    // Motion, with a reduced-motion opt-out.
    'transition-[background-color,box-shadow,scale] duration-200 ease-out motion-reduce:transition-none',
    'motion-safe:hover:scale-[1.02] hover:shadow-md',
    // Keyboard focus.
    'focus-visible:ring-2 focus-visible:ring-base-content focus-visible:ring-offset-2 focus-visible:ring-offset-base-100',
    // State. Weight carries the active state alongside the tint + rail, so it never
    // depends on colour alone.
    isActive
      ? 'bg-base-300 font-semibold hover:bg-base-300 focus-visible:bg-base-300'
      : 'font-normal hover:bg-base-200 focus-visible:bg-base-200',
  ].join(' ')
}

/**
 * The label cell. `break-words` is the safety net for the two longest Thai labels
 * (`จัดการวันหยุดและวันปิดปรับปรุง`, `ประวัติการเข้าสู่ระบบส่วนตัว`) at `text-lg` in a `w-80`
 * sidebar: the row grows to two lines rather than clipping or ellipsing the meaning away.
 */
const LABEL_CLASS = 'min-w-0 break-words'

interface SidebarLeafLinkProps {
  readonly leaf: NavLeaf
  /** Closes the mobile drawer after a real navigation. */
  readonly onNavigate: () => void
}

/**
 * A live destination row. `end` makes the match EXACT, so
 * `/admin-portal/reports/analytics` never marks its `reports/*` siblings active.
 *
 * The active rail is absolutely positioned, so it is out of flow and never becomes a third
 * column in daisyUI's menu-row grid. `bg-base-content` is the one semantic token that
 * clears 3:1 against the sidebar surface in BOTH themes (`primary` measures 1.40:1 on
 * `cupcake`; `neutral` measures 1.22:1 on `dashwind-dark` — each fails one of them).
 */
export function SidebarLeafLink({ leaf, onNavigate }: SidebarLeafLinkProps) {
  return (
    <NavLink to={leaf.to} end onClick={onNavigate} className={({ isActive }) => rowClass(isActive)}>
      {({ isActive }) => (
        <>
          {leaf.icon}
          <span className={LABEL_CLASS}>{leaf.label}</span>
          {isActive && (
            <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-base-content" />
          )}
        </>
      )}
    </NavLink>
  )
}

interface SidebarSubmenuToggleProps {
  readonly entry: NavSubmenu
  readonly isExpanded: boolean
  /** Id of the `<ul>` this button opens — wired as `aria-controls`. */
  readonly submenuId: string
  readonly onToggle: () => void
}

/**
 * The expand/collapse control for a group. A real `<button>` (so Enter/Space work for free)
 * carrying `aria-expanded` + `aria-controls`, which is precisely why this is NOT daisyUI's
 * `<details>/<summary>` submenu — `<summary>` can carry neither.
 *
 * `menu-dropdown-toggle` is daisyUI's JS-driven counterpart: it draws the chevron via
 * `::after` and rotates it whenever `menu-dropdown-show` is present, so there is no second
 * icon and no hand-rolled rotation state. `motion-reduce:after:transition-none` stops that
 * rotation from animating for a reduced-motion user (the chevron still flips, it just does
 * not sweep).
 */
export function SidebarSubmenuToggle({
  entry,
  isExpanded,
  submenuId,
  onToggle,
}: SidebarSubmenuToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isExpanded}
      aria-controls={submenuId}
      className={[
        'menu-dropdown-toggle w-full motion-reduce:after:transition-none',
        isExpanded ? 'menu-dropdown-show' : '',
        rowClass(false),
      ].join(' ')}
    >
      {entry.icon}
      <span className={LABEL_CLASS}>{entry.label}</span>
    </button>
  )
}
