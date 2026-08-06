// Replaces the DashWind template's binary `swap swap-rotate` Sun/Moon control in the
// replica navbar (`AdminPortalHeader`) — MIT (c) 2022 Dashwind. See THIRD_PARTY_NOTICES.md
//
// A daisyUI `dropdown dropdown-end` + `menu` offering THREE explicit preferences
// (สว่าง / มืด / ตามระบบ) instead of a two-state toggle, because "System" has no honest
// representation in a checkbox and an unlabelled Sun/Moon never told an operator which
// state they were actually in.
//
// Open/close is React-controlled through daisyUI's OWN `dropdown-open` / `dropdown-close`
// modifiers rather than the CSS `:focus-within` behaviour the sibling bell/profile
// dropdowns rely on. That is a deliberate, scoped deviation: `:focus-within` cannot close
// on Esc at all (no browser blurs a focused element on Escape), and its only way to close
// on selection is `document.activeElement.blur()`, which drops keyboard focus to `<body>`
// and loses the user's place in the tab order. The controlled version closes on selection,
// on Esc and on click-away, and hands focus BACK to the trigger every time — using only
// React-local handlers, so it still adds zero `document`-level listeners.
import { useCallback, useRef, useState } from 'react'
import type { ComponentType, SVGProps } from 'react'
import CheckIcon from '@heroicons/react/24/outline/CheckIcon'
import ComputerDesktopIcon from '@heroicons/react/24/outline/ComputerDesktopIcon'
import MoonIcon from '@heroicons/react/24/outline/MoonIcon'
import SunIcon from '@heroicons/react/24/outline/SunIcon'
import { ADMIN_THEME_STRINGS } from '@/constants/ui-strings-admin-theme'
import {
  ADMIN_PORTAL_THEME_PREFERENCES,
  useAdminPortalTheme,
  type AdminPortalThemePreference,
} from './admin-portal-theme'

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>

/** Option glyphs, keyed by preference. Copy itself lives in `ui-strings-admin-theme.ts`. */
const OPTION_ICONS: Record<AdminPortalThemePreference, IconComponent> = {
  light: SunIcon,
  dark: MoonIcon,
  system: ComputerDesktopIcon,
}

/**
 * Shared chrome for BOTH icon-only navbar controls (this trigger and the hamburger in
 * `AdminPortalHeader`), so the two cannot drift apart.
 *
 *  - `btn-ghost` = transparent at rest; daisyUI's own hover fill is derived from
 *    `base-200`, i.e. a NEUTRAL overlay. No `primary`/`accent`/`secondary` fill is added —
 *    a bright hamburger was the thing the PO flagged.
 *  - `btn-square btn-md` renders 40x40, which is UNDER the 44px floor an age-inclusive
 *    tap target needs, so `min-h-11 min-w-11` (44px) is the explicit floor on top —
 *    `min-*` wins over `btn-square`'s `width`/`height`. Same technique as the sidebar
 *    rows' `min-h-11`.
 *  - the focus ring is pinned to `base-content` (by definition readable on `base-100` in
 *    any theme) rather than left to the UA's `outline: auto`, which cannot be recoloured.
 */
export const NAVBAR_ICON_BUTTON_CLASS =
  'btn btn-ghost btn-square btn-md min-h-11 min-w-11 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-base-content ' +
  'motion-reduce:transition-none'

/**
 * The navbar theme selector. Reads `{ preference, setPreference, theme }` from
 * `AdminPortalThemeLayout`; the trigger glyph tracks the **resolved** theme (so under
 * "ตามระบบ" it shows whatever the OS currently resolves to, not a third glyph), while the
 * checkmark tracks the **preference** (so "ตามระบบ" stays visibly selected).
 */
export function AdminPortalThemeMenu() {
  const { preference, setPreference, theme } = useAdminPortalTheme()
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const isDark = theme === 'dashwind-dark'

  const close = useCallback((returnFocus: boolean) => {
    setIsOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }, [])

  return (
    <div
      // `dropdown-close` beats daisyUI's `:focus-within` rule, which is what lets focus
      // sit on the trigger with the menu shut instead of being thrown to <body>.
      className={`dropdown dropdown-end ${isOpen ? 'dropdown-open' : 'dropdown-close'}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && isOpen) {
          event.stopPropagation()
          close(true)
        }
      }}
      // React's onBlur is `focusout`, so it bubbles: tabbing or clicking anywhere outside
      // this subtree closes the menu. `relatedTarget` is null for a click on inert page
      // chrome, which is exactly the click-away case.
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false)
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        // Icon-only: `aria-label` is the trigger's ONLY accessible name.
        aria-label={ADMIN_THEME_STRINGS.triggerLabel}
        title={ADMIN_THEME_STRINGS.triggerLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={NAVBAR_ICON_BUTTON_CLASS}
        onClick={() => setIsOpen((open) => !open)}
      >
        {isDark ? (
          <MoonIcon aria-hidden className="h-6 w-6" />
        ) : (
          <SunIcon aria-hidden className="h-6 w-6" />
        )}
      </button>

      <ul
        role="menu"
        aria-label={ADMIN_THEME_STRINGS.menuLabel}
        // daisyUI's stock `menu-active` fill is `neutral`, which measures 1.22:1 against
        // `base-100` on `dashwind-dark` — invisible, and short of the 3:1 a state
        // indicator owes (WCAG 1.4.11). Both themes' `base-content` is by definition the
        // readable foreground for `base-100`, so the selected row is inverted to it. Still
        // semantic tokens; these two custom properties are daisyUI's own menu hooks.
        className={
          'menu dropdown-content z-30 mt-3 w-56 rounded-box bg-base-100 p-2 shadow ' +
          '[--menu-active-bg:var(--color-base-content)] [--menu-active-fg:var(--color-base-100)]'
        }
      >
        {ADMIN_PORTAL_THEME_PREFERENCES.map((option) => {
          const OptionIcon = OPTION_ICONS[option]
          const label = ADMIN_THEME_STRINGS.options[option]
          const isSelected = option === preference

          return (
            // `role="none"` because a `role="menu"` may only own menuitem* children —
            // the <li>'s implicit `listitem` role would be invalid here.
            <li key={option} role="none">
              <button
                type="button"
                role="menuitemradio"
                // The selection is announced programmatically, never by colour alone —
                // it is ALSO carried by the checkmark and the bolder label.
                aria-checked={isSelected}
                className={[
                  // daisyUI lays a menu row out as `display:grid` with `align-items:center`
                  // but `align-content:flex-start`, so the single row track is packed to the
                  // TOP: `min-h-11`'s extra height all landed below it and the whole
                  // icon/label/check block sat a measured 4px above the button's centre.
                  // `content-center` centres the track; `items-center` is stated explicitly
                  // rather than inherited so the cross-axis rule is visible at the call site.
                  'min-h-11 content-center items-center text-base motion-reduce:transition-none',
                  // daisyUI forces `outline-style:none` on a focused menu row, so a
                  // keyboard user got only the background tint — measured 1.21:1 (cupcake)
                  // / 1.11:1 (dark) against the menu, and NOTHING at all on the already
                  // filled selected row. A box-shadow ring survives that reset (the same
                  // reason the sidebar rows use one) and reads at 15.92:1 / 7.03:1.
                  'focus-visible:ring-2 focus-visible:ring-base-content',
                  'focus-visible:ring-offset-2 focus-visible:ring-offset-base-100',
                  isSelected
                    ? 'menu-active font-semibold'
                    : // daisyUI's stock hover/focus fill is `base-content` at 10%, which
                      // LIGHTENS the row on `dashwind-dark`. Re-measured after the English
                      // gloss was dropped: the Thai label clears AA either way (5.83:1
                      // stock), so this pin is no longer load-bearing for AA — it is kept
                      // because `base-300` still measures materially better on the label
                      // (7.83:1 dark / 13.18:1 cupcake vs 5.83 / 12.89) at an equivalent
                      // background delta, and it matches the sidebar rows' convention.
                      'hover:bg-base-300 focus-visible:bg-base-300',
                ].join(' ')}
                onClick={() => {
                  setPreference(option)
                  close(true)
                }}
              >
                <OptionIcon aria-hidden className="h-5 w-5 shrink-0" />
                {/* Thai only (PO review) — no parenthesised English gloss. */}
                <span>{label}</span>
                {/* The checkmark IS the state indicator; the placeholder reserves its
                    column so moving the selection never reflows the menu. */}
                {isSelected ? (
                  <CheckIcon aria-hidden className="h-5 w-5 shrink-0" />
                ) : (
                  <span aria-hidden className="h-5 w-5 shrink-0" />
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
