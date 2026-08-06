/**
 * User-facing copy for the **admin-portal navbar theme selector** — the dropdown
 * trigger's accessible name and the three preference options (สว่าง / มืด / ตามระบบ).
 *
 * Part of the **centralized-but-modularized** UI-string architecture: each
 * feature/surface owns a `src/constants/ui-strings-<feature>.ts` module exporting named
 * `as const` objects, so a component and its tests read the SAME literal. This is a
 * **back-office** module: never import it from a client/LIFF component.
 *
 * It is a module of its own rather than a section inside `ui-strings-admin-nav.ts`
 * because that module's docstring scopes it explicitly to the **side menu** (its labels
 * are shared with `routes.ts`'s stub titles, and it is deliberately dependency-free for
 * chunk-weight reasons). The navbar's theme control is a different surface with a
 * different consumer, so it gets its own module instead of widening that one's ownership.
 *
 * **The three visible option labels are Thai-only** (PO review, 2026-08-06): they render
 * exactly `สว่าง`, `มืด`, `ตามระบบ` — no parenthesised English gloss, so this module does
 * NOT follow the `{ th, en }` bilingual convention the profile page uses. The two
 * `aria-label` strings below deliberately keep an English gloss because they are *not*
 * visible text: they name icon-only controls for assistive tech, where the extra word
 * costs no screen space.
 *
 * This is **not** i18n: no locale, no `t()`, no switch. Thai literals, as everywhere else
 * in the back office.
 */
export const ADMIN_THEME_STRINGS = {
  /**
   * Accessible name of the navbar trigger. The trigger renders an icon only (Sun/Moon),
   * so this `aria-label` is its ONLY accessible name — without it the control is
   * announced as an unnamed button. Never rendered as visible text.
   */
  triggerLabel: 'ธีม (Theme)',

  /**
   * Accessible name of the option list itself, announced before the three choices.
   * Never rendered as visible text.
   */
  menuLabel: 'เลือกธีม (Select theme)',

  /**
   * The three preference options, in the order the PO specified. Keyed by the same
   * literal as `AdminPortalThemePreference`, so a new preference cannot be added without
   * its copy. These ARE the visible labels — Thai only.
   */
  options: {
    light: 'สว่าง',
    dark: 'มืด',
    system: 'ตามระบบ',
  },
} as const satisfies {
  readonly triggerLabel: string
  readonly menuLabel: string
  readonly options: Record<'light' | 'dark' | 'system', string>
}
