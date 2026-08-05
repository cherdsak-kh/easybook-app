// Local light/dark theme state for the isolated `/admin-portal` DashWind replica
// (Phase 3.5 — interactivity polish). This is a SELF-CONTAINED React context: it
// imports nothing from the client portal's `src/components/client-portal/ThemeLayout.tsx`
// / `src/hooks/useResolvedTheme.ts`, which stay the single authority for the REAL
// portals and are provably unmodified. `AdminPortalThemeLayout` owns the state and
// provides it here; the header's Sun/Moon toggle consumes `toggleTheme` (design note in
// `AdminPortalThemeLayout.tsx`). No Redux, no `theme-change`.
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

export interface AdminPortalThemeContextValue {
  /** Active theme — mirrors the `data-theme` on the wrapper `<div>`. */
  readonly theme: AdminPortalTheme
  /** Flip light <-> dark. In-memory only (no localStorage) — a demo prototype. */
  readonly toggleTheme: () => void
}

/** Null default so `useAdminPortalTheme` can detect a missing provider. */
export const AdminPortalThemeContext = createContext<AdminPortalThemeContextValue | null>(null)

/**
 * Reads the replica's local theme state. Must be called inside
 * `AdminPortalThemeLayout` — throws otherwise to surface a wiring mistake early
 * rather than silently reading a stale default.
 */
export function useAdminPortalTheme(): AdminPortalThemeContextValue {
  const ctx = useContext(AdminPortalThemeContext)
  if (ctx === null) {
    throw new Error('useAdminPortalTheme must be used within <AdminPortalThemeLayout>')
  }
  return ctx
}
