/**
 * The trail above a screen title. Ported from `crumbs()`, prototype 3658–3664.
 *
 * ⚠️ THIS IS NOT A BACK BUTTON, AND THAT IS WHY IT MAY EXIST (`D-C14`). `D-C3` bans an in-page
 * back arrow anywhere in this portal — LIFF already draws one, and a second one competes with
 * browser history. Breadcrumbs do something a back arrow cannot: they NAME the destination they
 * return to. That is what lets them sit alongside LIFF's own control without the two arguing.
 *
 * Used by `#/version` `#/issues` `#/manual` `#/rules` `#/booking/:id`.
 *
 * ⚠️ The LAST crumb is the current screen and is deliberately not a link. It is rendered with
 * full `text-base-content` while the trail around it is dimmed by the container, so "where you
 * are" is the one item at full contrast.
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
       keeps a long venue name from widening the header — hence `max-w-full`. `py-0` because the
       header row already owns the vertical rhythm here. */
    <nav aria-label="เส้นทางนำทาง" className={`breadcrumbs max-w-full py-0 ${className}`.trim()}>
      <ul>
        {trail.map((c) => (
          <li key={c.label}>
            {c.to ? (
              <a href={c.to} className="truncate">
                {c.label}
              </a>
            ) : (
              /* `aria-current="page"` says in the accessibility tree what the weight and the
                 colour say visually — the same "one value drives both" rule the dock and the
                 theme buttons follow. */
              <span aria-current="page" className="truncate font-medium text-base-content">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}
