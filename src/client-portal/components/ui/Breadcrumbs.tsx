import { Link } from 'react-router-dom'

/**
 * The trail above a screen title. Ported from `crumbs()`, prototype 3658–3664.
 *
 * ⚠️ THIS IS NOT A BACK BUTTON, AND THAT IS WHY IT MAY EXIST (`D-C14`). `D-C3` bans an in-page
 * back arrow anywhere in this portal — LIFF already draws one, and a second one competes with
 * browser history. Breadcrumbs do something a back arrow cannot: they NAME the destination they
 * return to. That is what lets them sit alongside LIFF's own control without the two arguing.
 *
 * Used by seven screens: `#/version` `#/issues` `#/manual` `#/rules` `#/booking/:id` (all five
 * through `ScreenHeader`'s two-tier form) plus `#/venue/:id` and `#/request/:id`, which build
 * their own two-tier header and call this directly. Four call sites, seven screens.
 *
 * ⚠️ The LAST crumb is the current screen and is deliberately not a link. It is rendered with
 * full `text-base-content` while the trail around it is dimmed by the container, so "where you
 * are" is the one item at full contrast.
 *
 * ⚠️ THE TRAIL IS TWO CRUMBS ON THE SETTINGS SUB-SCREENS (`ตั้งค่า` → title), NOT THREE. No
 * `หน้าแรก` crumb exists anywhere in the prototype; `crumbs()` is called with two everywhere.
 * Do not "restore" a third.
 *
 * ── 🔴 44 px TARGETS THAT COST THE HEADER NOTHING (`CLIENT-BREADCRUMB-1`) ──
 * The crumbs shipped as **26.3–72.6 × 16 px with `padding: 0`** on 7 screens. `Q-C6` sanctions
 * text-labelled controls down to **36 px** (the category chips); 16 px is under half of that and
 * had no exception recorded anywhere, so it was fixed rather than written down.
 *
 * The obvious fix — `min-h-11` on the crumbs and nothing else — was **measured and rejected**:
 * tier 1 of the sticky header went **47 → 75 px**, taking `#/manual` `#/rules` `#/issues` from
 * 96.75 to **124.75 px** and `#/version` from 114.75 to **142.75 px**. That moves the content
 * start of all seven screens and invalidates geometry already measured against the prototype.
 *
 * So the target grows and the LINE BOX DOES NOT: `min-h-11` puts the crumbs at 44 px, and
 * `-my-3.5` on the `<nav>` (−14 px × 2 = the 28 px the 16 px line box just gained) hands the
 * extra height back to the layout. Measured after, at 390 and 820 px in both themes: crumbs
 * **26.33–164.3 × 44 px**, tier 1 still **47 px**, header still **96.75 / 114.75 px** — every
 * crumb WIDTH unchanged to the hundredth of a pixel, so truncation and balance are untouched.
 *
 * 🔴 THE NEGATIVE MARGIN IS ON THE `<nav>`, NOT ON THE CRUMBS, AND THAT IS THE WHOLE TRICK.
 * daisyUI gives `.breadcrumbs` `overflow-x: auto`, and CSS forces `overflow-y` to compute to
 * `auto` alongside it — so the nav is a scroll container that CLIPS. Pulling the crumbs up from
 * inside it (negative margins on the `<a>`, or an `after:` overlay pseudo-element) puts the new
 * hit area outside the nav's padding box, where it is clipped away and untappable: the target
 * would measure 44 px and behave like 16. Growing the nav to 44 and pulling the NAV back leaves
 * nothing overflowing anything.
 *
 * ⚠️ `-my-3.5` assumes the caller renders the trail at `text-xs` (16 px line box); all four
 * call sites do. A caller at a different type scale gets a target still ≥ 44 px, but the row
 * would shift by the line-box difference — pass the size through `className` as `text-xs`.
 */

/** One step in the trail. `to` absent = this is where you are. */
export type Crumb = {
  label: string
  /** A react-router path. Omit on the final crumb. */
  to?: string
}

export function Breadcrumbs({
  trail,
  className = '',
}: {
  trail: readonly Crumb[]
  className?: string
}) {
  return (
    /* daisyUI `breadcrumbs` scrolls its own list when it outgrows the container, which is what
       keeps a long venue name from widening the header — hence `max-w-full`. `py-0` overrides
       daisyUI's own `padding-block: .5rem`, because the header row already owns the vertical
       rhythm here — and `-my-3.5` gives back the 28 px the 44 px crumbs below add to it, so the
       nav still OCCUPIES one 16 px line while its targets are 44 px tall. See the header note. */
    <nav
      aria-label="เส้นทางนำทาง"
      className={`breadcrumbs -my-3.5 max-w-full py-0 ${className}`.trim()}
    >
      <ul>
        {trail.map((c) => (
          <li key={c.label}>
            {c.to ? (
              /* ⚠️ `Link`, NOT `<a href>`. A bare anchor to an in-app path is a FULL PAGE RELOAD:
                 the LIFF boots again, the gate re-runs its four checks, and the reader watches the
                 splash to get back to a screen the router could have shown immediately. It was an
                 `<a>` until `#/venue/:id` became the first real caller (P4). Same correction
                 `DockItem` needed in P2.
                 `min-h-11` is the 44 px target; `items-center` keeps the label on the same
                 baseline it had at 16 px (daisyUI already sets `display:flex` here, so the class
                 costs nothing and states the dependency instead of inheriting it silently). */
              <Link to={c.to} className="min-h-11 items-center truncate">
                {c.label}
              </Link>
            ) : (
              /* `aria-current="page"` says in the accessibility tree what the weight and the
                 colour say visually — the same "one value drives both" rule the dock and the
                 theme buttons follow.
                 ⚠️ It carries `min-h-11` too even though it is NOT tappable: the `<ul>` centres
                 its items, so a 16 px last crumb beside 44 px links would sit on a different
                 optical centre from the separator chevrons. Matching heights is what keeps the
                 row level, not a target requirement. */
              <span
                aria-current="page"
                className="min-h-11 items-center truncate font-medium text-base-content"
              >
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}
