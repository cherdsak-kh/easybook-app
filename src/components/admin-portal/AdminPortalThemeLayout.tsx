// Isolated theme wrapper for the DashWind replica. Our own analog of the shared
// `src/components/ThemeLayout.tsx` — it deliberately COPIES (does NOT import) the tiny
// `prefers-color-scheme` resolver so the shared `ThemeLayout`/`useResolvedTheme` stay
// the single authority for the REAL portals and are provably unmodified.
//
// Phase 3.5: this wrapper now OWNS the replica's light/dark state (Phase 3 left the
// header swap inert) so the header's Sun/Moon toggle can flip it. The state is
// INITIALISED once from `prefers-color-scheme`, then the local toggle is the sole
// authority (in-memory, no localStorage) — there is deliberately NO live OS listener,
// so a manual choice always sticks instead of being clobbered on the next OS change.
//
// The chart re-render trap (why this needed care): the reused
// `src/components/dashboard/*` charts read their chrome colours off the themed DOM in
// `useChartThemeColors`, but that hook keys its recompute on `useResolvedTheme('admin')`
// (system preference) — NOT on this local toggle, and it is off-limits to edit. So a
// flip here alone would leave chart legend/tick/grid colours stale. The dashboard page
// fixes that from INSIDE this namespace by remounting each chart with a React `key`
// that includes `theme` (see `AdminPortalDashboardPage`): a fresh mount re-runs the
// chart's `useLayoutEffect`, which re-reads the now-updated `--color-*` values off the
// DOM. Nothing under `components/dashboard/*` or the shared hook is touched.
import { useCallback, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import {
  AdminPortalThemeContext,
  type AdminPortalTheme,
  type AdminPortalThemeContextValue,
} from './admin-portal-theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

const matchDark = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(DARK_QUERY).matches

/**
 * Owns the replica's theme and stamps `data-theme="dashwind-light" | "dashwind-dark"`
 * on a wrapping `<div>` around its `<Outlet/>`, so the whole replica subtree (login,
 * LandingIntro, shell, dashboard, team) adopts the pinned `dashwind-*` daisyUI theme.
 * The theme + `toggleTheme` are shared with descendants via `AdminPortalThemeContext`.
 */
export function AdminPortalThemeLayout() {
  const [theme, setTheme] = useState<AdminPortalTheme>(() =>
    matchDark() ? 'dashwind-dark' : 'dashwind-light',
  )

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dashwind-dark' ? 'dashwind-light' : 'dashwind-dark'))
  }, [])

  const value = useMemo<AdminPortalThemeContextValue>(
    () => ({ theme, toggleTheme }),
    [theme, toggleTheme],
  )

  return (
    <AdminPortalThemeContext.Provider value={value}>
      <div data-theme={theme} className="min-h-screen bg-base-200 text-base-content">
        <Outlet />
      </div>
    </AdminPortalThemeContext.Provider>
  )
}
