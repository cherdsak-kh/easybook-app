// Theme PREFERENCE state for the isolated `/admin-portal` DashWind replica. This is a
// SELF-CONTAINED React context: it imports nothing from the client portal's
// `src/components/client-portal/ThemeLayout.tsx` / `src/hooks/useResolvedTheme.ts`, which
// stay the single authority for the REAL portals and are provably unmodified.
// `AdminPortalThemeLayout` owns the state and provides it here; the navbar's
// `AdminPortalThemeMenu` consumes `{ preference, setPreference, theme }`.
// No Redux, no `theme-change`.
import { createContext, useContext } from 'react'

/**
 * The two pinned daisyUI themes the wrapper stamps as `data-theme`.
 *
 * Light is daisyUI's built-in `cupcake` (enabled via the `themes:` list on the
 * `@plugin "daisyui"` invocation in `index.css`); it replaced `dashwind-light` for the
 * whole portal, not just the sidebar — a sidebar-only override would need a second
 * `data-theme` wrapper and would leave a pastel menu against a DashWind-indigo header.
 *
 * Dark stays `dashwind-dark` for now because `cupcake` is light-only. **The `-dark` suffix
 * is load-bearing**: `index.css` defines `@custom-variant dark` as `[data-theme$="-dark"]`,
 * so any dark theme named otherwise silently stops matching. A pastel-family dark
 * counterpart is a tracked follow-up (`THEME-DARK-1`), not this change.
 *
 * `dashwind-light` is now unreferenced by the portal; its `@plugin "daisyui/theme"` block
 * stays in `index.css` (theme blocks are additive and not edited — deleting it is a
 * separate cleanup).
 */
export type AdminPortalTheme = 'cupcake' | 'dashwind-dark'

/**
 * What the USER chose, which is not the same thing as what gets stamped. `system` defers
 * to `prefers-color-scheme` continuously (see `AdminPortalThemeLayout`), the other two
 * pin the theme and are never clobbered by an OS change.
 */
export type AdminPortalThemePreference = 'light' | 'dark' | 'system'

/** Render order of the navbar dropdown: สว่าง · มืด · ตามระบบ (PO-specified). */
export const ADMIN_PORTAL_THEME_PREFERENCES = [
  'light',
  'dark',
  'system',
] as const satisfies readonly AdminPortalThemePreference[]

/**
 * Default for a user with NO stored preference — light, **even on a dark-mode OS**.
 * This is a deliberate behaviour change from the previous init-once mechanism (which
 * seeded itself from `prefers-color-scheme`): the portal now opens in its pastel light
 * identity until the user explicitly asks for anything else.
 */
export const DEFAULT_ADMIN_PORTAL_THEME_PREFERENCE: AdminPortalThemePreference = 'light'

/**
 * The ONE `localStorage` key. Namespaced (`easybook.` + surface) so the admin portal's
 * preference can never collide with anything the client/LIFF surface stores on the same
 * origin.
 */
export const ADMIN_PORTAL_THEME_STORAGE_KEY = 'easybook.admin-portal.theme'

/** The media query `system` mode follows. */
export const DARK_COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)'

/** Narrows an unknown (e.g. a hand-edited `localStorage` value) to a real preference. */
export function isAdminPortalThemePreference(
  value: unknown,
): value is AdminPortalThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

/**
 * Reads `prefers-color-scheme: dark`. Guarded for `typeof window`/`matchMedia` because
 * jsdom (unit tests) implements neither — an unguarded read would crash every suite that
 * mounts the portal chrome.
 */
export function prefersDarkColorScheme(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(DARK_COLOR_SCHEME_QUERY).matches
  )
}

/**
 * Reads the persisted preference. Every access is `try/catch`-guarded: `localStorage` is
 * a *throwing* API in Safari private mode, in LINE's in-app webview and in a
 * cookie-blocked iframe — and a theme preference must never take the portal down. An
 * unknown/corrupt value is treated as "no preference" and falls back to light.
 */
export function readStoredThemePreference(): AdminPortalThemePreference {
  try {
    if (typeof window === 'undefined') return DEFAULT_ADMIN_PORTAL_THEME_PREFERENCE
    const stored = window.localStorage.getItem(ADMIN_PORTAL_THEME_STORAGE_KEY)
    return isAdminPortalThemePreference(stored)
      ? stored
      : DEFAULT_ADMIN_PORTAL_THEME_PREFERENCE
  } catch {
    // Storage unavailable — fall back to the default for this session.
    return DEFAULT_ADMIN_PORTAL_THEME_PREFERENCE
  }
}

/** Persists the preference. Same `try/catch` contract as the read: never throws. */
export function writeStoredThemePreference(preference: AdminPortalThemePreference): void {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(ADMIN_PORTAL_THEME_STORAGE_KEY, preference)
  } catch {
    // Storage unavailable — the choice still applies for this session, just not the next.
  }
}

/** Preference + current OS scheme -> the theme actually stamped as `data-theme`. */
export function resolveAdminPortalTheme(
  preference: AdminPortalThemePreference,
  systemPrefersDark: boolean,
): AdminPortalTheme {
  if (preference === 'system') return systemPrefersDark ? 'dashwind-dark' : 'cupcake'
  return preference === 'dark' ? 'dashwind-dark' : 'cupcake'
}

export interface AdminPortalThemeContextValue {
  /** What the user chose. Persisted; drives which option is marked selected. */
  readonly preference: AdminPortalThemePreference
  /** Selects a preference: re-stamps `data-theme` immediately AND persists. */
  readonly setPreference: (preference: AdminPortalThemePreference) => void
  /** Resolved theme — mirrors the `data-theme` on the wrapper `<div>`. */
  readonly theme: AdminPortalTheme
}

/** Null default so `useAdminPortalTheme` can detect a missing provider. */
export const AdminPortalThemeContext = createContext<AdminPortalThemeContextValue | null>(null)

/**
 * Reads the replica's theme state. Must be called inside `AdminPortalThemeLayout` —
 * throws otherwise to surface a wiring mistake early rather than silently reading a
 * stale default.
 */
export function useAdminPortalTheme(): AdminPortalThemeContextValue {
  const ctx = useContext(AdminPortalThemeContext)
  if (ctx === null) {
    throw new Error('useAdminPortalTheme must be used within <AdminPortalThemeLayout>')
  }
  return ctx
}
