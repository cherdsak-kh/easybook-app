/**
 * One sidebar destination, and the disclosure group that folds several of them.
 *
 * ⚠️ ONE ACTIVE ROW AT A TIME, and the prototype shipped this broken: ภาพรวมระบบ carried the
 * full active treatment written as raw utilities while การลงทะเบียน carried `.nav-row-active`,
 * so the sidebar pointed at two current pages at once — and every later pass that tidied the
 * active state walked straight past the hand-written one. That is why `active` is a prop with
 * one class behind it and callers never spell the treatment themselves.
 *
 * `aria-current="page"` rides with it. The active row is otherwise distinguished by colour and
 * a rail, neither of which reaches a screen reader.
 *
 * ⚠️ `to` MAKES IT A REAL `<a href>`, and the shell always passes it. That is not cosmetic:
 * operators middle-click and ⌘-click menu rows, copy link addresses, and read the status bar
 * before committing to a navigation — a `<button>` offers none of that, and no amount of
 * `role`/`onKeyDown` gives it back. The `<button>` form survives only for the showcase, which
 * demonstrates the row with no destination behind it.
 */

import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

export function NavRow({
  icon,
  label,
  count,
  active = false,
  sub = false,
  alert = false,
  to,
  onSelect,
}: {
  /** Destination. Present → renders an `<a href>`; absent → a `<button>` (showcase only). */
  to?: string
  /** Omitted on sub-rows — they sit under their group's icon and get an indent instead. */
  icon?: ReactNode
  label: string
  /** A pending count. `undefined` hides the pill; `0` is still hidden — see below. */
  count?: number
  active?: boolean
  sub?: boolean
  /** Paints the count as attention-worthy rather than informational. */
  alert?: boolean
  onSelect?: () => void
}) {
  const className =
    `nav-row w-full ${sub ? 'nav-row-sub' : ''} ${active ? 'nav-row-active' : ''} th-tight`.trim()

  const inner = (
    <>
      {icon && <span className="nav-ico shrink-0">{icon}</span>}
      <span className="min-w-0 flex-1 text-left">{label}</span>
      {/* A zero is not news. Rendering "0" beside a menu row trains the eye to stop reading
          the number, which is the one thing it exists to be read for. */}
      {count !== undefined && count > 0 && (
        <span className={`nav-count ${alert ? 'nav-count-alert' : ''}`.trim()}>
          {count > 99 ? '99+' : count}
        </span>
      )}
    </>
  )

  if (to) {
    return (
      <Link to={to} onClick={onSelect} aria-current={active ? 'page' : undefined} className={className}>
        {inner}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onSelect} aria-current={active ? 'page' : undefined} className={className}>
      {inner}
    </button>
  )
}

/**
 * A folded group of destinations — `<details>`/`<summary>`, deliberately.
 *
 * Real disclosure semantics, keyboard-operable, and no JavaScript at all: the open/closed
 * state is the browser's. A div-plus-onClick reimplementation would need `aria-expanded`,
 * `aria-controls`, Enter/Space handling and a focus model, and would get one of them wrong.
 *
 * ⚠️ The account menu deliberately does NOT use this, and that is not an inconsistency:
 * `<summary>` can carry neither `aria-expanded` nor `aria-controls`, and that menu needs both
 * because it opens a panel positioned outside its own flow.
 *
 * The chevron rotates via `details[open] .chev` in CSS, not via a state prop — which is what
 * keeps it correct when the browser toggles the element without React knowing.
 */
export function NavGroup({
  icon,
  label,
  defaultOpen = false,
  children,
}: {
  icon: ReactNode
  label: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <details open={defaultOpen}>
      <summary className="nav-row cursor-pointer">
        <span className="nav-ico shrink-0">{icon}</span>
        <span className="min-w-0 flex-1 text-left">{label}</span>
        <svg
          aria-hidden="true"
          className="chev h-4 w-4 shrink-0 text-base-content/40"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      {/* The rail is what says "these belong to the row above" once the group is open. */}
      <div className="mt-0.5 ml-[26px] border-l border-base-300 pl-2.5">{children}</div>
    </details>
  )
}

/** A section heading between groups of rows. Not focusable, not a link — it names, it does not go. */
export function NavSection({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 pb-1.5 pt-4 text-[12px] font-semibold text-base-content/60">{children}</p>
  )
}
