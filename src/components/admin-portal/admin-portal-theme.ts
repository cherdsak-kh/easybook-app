// Local light/dark theme state for the isolated `/admin-portal` DashWind replica
// (Phase 3.5 — interactivity polish). This is a SELF-CONTAINED React context: it
// imports nothing from the shared `src/components/ThemeLayout.tsx` /
// `src/hooks/useResolvedTheme.ts`, which stay the single authority for the REAL
// portals and are provably unmodified. `AdminPortalThemeLayout` owns the state and
// provides it here; the header's Sun/Moon toggle consumes `toggleTheme`, and the
// dashboard page reads `theme` to remount the reused charts on a flip (design note in
// `AdminPortalThemeLayout.tsx`). No Redux, no `theme-change`.
import { createContext, useContext } from 'react'

/** The two pinned daisyUI themes the replica wrapper stamps as `data-theme`. */
export type AdminPortalTheme = 'dashwind-light' | 'dashwind-dark'

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
