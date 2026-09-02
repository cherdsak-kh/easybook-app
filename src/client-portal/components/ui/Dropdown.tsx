import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * A `<details>`-based menu that closes when you click elsewhere or press Escape.
 * Ported from the prototype's document-level handlers at 2605–2623.
 *
 * ── 🔴 ONE LISTENER FOR EVERY MENU IN THE APP, NEVER ONE PER MENU ──
 * The prototype's four menus (`hm-type-dd` `vn-type-dd` `mb-status-dd` `mb-sort-dd`) live on
 * different screens and arrived one at a time over several rounds. A per-menu listener
 * guarantees the fifth one is forgotten on the day somebody adds it. The module-level registry
 * below keeps that property: the pair of listeners is installed when the first `Dropdown` mounts
 * and removed when the last one unmounts, no matter how many exist in between.
 *
 * ⚠️ THE PROTOTYPE SELECTED `details.dropdown`, NOT EVERY `<details>`, and the reason still
 * binds: the changelog screen uses `<details class="collapse">` for content accordions, and
 * collapsing something the reader deliberately opened is not the same behaviour at all. Here the
 * registry replaces the selector — only components that ARE this one can ever be closed by it —
 * which makes the guarantee structural rather than dependent on a class staying accurate.
 *
 * ⚠️ ESCAPE IS NOT `preventDefault`ed, AND THE HANDLER RETURNS EARLY WHEN NOTHING IS OPEN.
 * Escape is also `<dialog>`'s close key (the combobox sheet, the cancel confirmation).
 * Swallowing it here would leave those unclosable from a keyboard.
 *
 * ⚠️ FOCUS GOES BACK TO THE `<summary>` ON ESCAPE. Someone who presses Escape while focused
 * inside the menu that just vanished is otherwise left with focus on `<body>`, and has to Tab
 * from the top of the page again.
 *
 * ⚠️ Clicking a menu's OWN summary does not fight this. The handler skips any dropdown that
 * contains the click target — that one toggles itself as usual — while every other open menu is
 * closed.
 */

type Entry = {
  /** Is the click inside this dropdown's own subtree? Then leave it alone. */
  contains: (target: Node) => boolean
  close: () => void
  focusSummary: () => void
}

/** Every currently-OPEN dropdown. Closed ones deregister, so the handlers stay cheap. */
const open = new Set<Entry>()
let listening = false

function onDocumentClick(e: MouseEvent) {
  if (open.size === 0) return
  const target = e.target
  if (!(target instanceof Node)) return
  for (const entry of [...open]) {
    if (!entry.contains(target)) entry.close()
  }
}

function onDocumentKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (open.size === 0) return
  for (const entry of [...open]) {
    entry.close()
    entry.focusSummary()
  }
}

function register(entry: Entry) {
  open.add(entry)
  if (!listening) {
    document.addEventListener('click', onDocumentClick)
    document.addEventListener('keydown', onDocumentKeydown)
    listening = true
  }
}

function deregister(entry: Entry) {
  open.delete(entry)
  if (open.size === 0 && listening) {
    document.removeEventListener('click', onDocumentClick)
    document.removeEventListener('keydown', onDocumentKeydown)
    listening = false
  }
}

export function Dropdown({
  trigger,
  children,
  align = 'end',
  contentClassName = 'w-52',
  /**
   * The prototype's filter-button shape, verbatim (prototype 898 / 989): 48 × 48, icon-only
   * below `sm` and label-bearing above it.
   *
   * ⚠️ `h-12 min-h-12` AS UTILITIES, AND DO NOT REPLACE THEM WITH `min-h-11`. Utilities are a
   * single class and land in a later cascade layer than daisyUI's `.btn`, so they win — but a
   * TWO-CLASS rule like `.btn.btn-app-sm` (48px's smaller sibling, `index.css`) beats any single
   * utility and silently wins instead. That is exactly what happened here first time round: a
   * `min-h-11` sat on this summary reading like a 44px guarantee while the control measured 36.
   * Dead CSS that still reads like a guarantee is worse than no guarantee at all.
   */
  triggerClassName = 'btn h-12 min-h-12 w-12 border-base-300 bg-base-100 px-0 font-normal shadow-2xs hover:bg-base-200/60 sm:w-auto sm:gap-2 sm:px-4',
  label,
}: {
  /** What sits inside the `<summary>` — text, an icon, or both. */
  trigger: ReactNode
  /** The menu rows. Wrapped in the `dropdown-content menu` shell below. */
  children: ReactNode
  align?: 'start' | 'end'
  contentClassName?: string
  triggerClassName?: string
  /** Announced name for the trigger, when the visible content is an icon alone. */
  label?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDetailsElement>(null)
  const contentId = useId()

  const close = useCallback(() => setIsOpen(false), [])

  useEffect(() => {
    if (!isOpen) return
    const entry: Entry = {
      contains: (t) => rootRef.current?.contains(t) ?? false,
      close,
      focusSummary: () => rootRef.current?.querySelector('summary')?.focus(),
    }
    register(entry)
    return () => deregister(entry)
  }, [isOpen, close])

  return (
    <details
      ref={rootRef}
      open={isOpen}
      /* `onToggle` rather than a click handler on the summary: `<details>` also opens from the
         keyboard and from `open` being set elsewhere, and a click handler misses both. */
      onToggle={(e) => setIsOpen(e.currentTarget.open)}
      className={`dropdown ${align === 'end' ? 'dropdown-end' : 'dropdown-start'}`}
    >
      {/* `list-none` kills the disclosure triangle Safari and Firefox still draw; the caret in
          the trigger content is the affordance. The tap-target floor comes from
          `triggerClassName` — see the note on its default about why it cannot come from a
          `min-h-*` utility appended here. */}
      <summary
        aria-label={label}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className={`${triggerClassName} list-none`}
      >
        {trigger}
      </summary>
      <ul
        id={contentId}
        className={`dropdown-content menu z-40 mt-2 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg ${contentClassName}`}
      >
        {children}
      </ul>
    </details>
  )
}
