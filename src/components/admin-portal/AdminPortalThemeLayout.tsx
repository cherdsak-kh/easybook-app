// Isolated theme wrapper for the DashWind replica. Our own analog of the client portal's
// `src/components/client-portal/ThemeLayout.tsx` — it deliberately COPIES (does NOT import) the tiny
// `prefers-color-scheme` resolver so the shared `ThemeLayout`/`useResolvedTheme` stay
// the single authority for the REAL portals and are provably unmodified.
//
// Phase 3.5: this wrapper now OWNS the replica's light/dark state (Phase 3 left the
// header swap inert) so the header's Sun/Moon toggle can flip it. The state is
// INITIALISED once from `prefers-color-scheme`, then the local toggle is the sole
// authority (in-memory, no localStorage) — there is deliberately NO live OS listener,
// so a manual choice always sticks instead of being clobbered on the next OS change.
//
// Every surface under this wrapper now restyles purely through daisyUI semantic tokens
// (CSS), so flipping `data-theme` here is enough — no descendant has to be remounted to
// pick the new theme up. (The DashWind mock dashboard used to be the exception: its
// Chart.js canvases read chrome colours off the themed DOM once at mount, so the page
// remounted each chart with a `theme`-keyed React `key`. That page and its whole
// mock-component directory were deleted along with the mock data, and the caveat went
// with them.)
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
 * Owns the portal's theme and stamps `data-theme="cupcake" | "dashwind-dark"` on a
 * wrapping `<div>` around its `<Outlet/>`, so the WHOLE admin subtree (login,
 * LandingIntro, shell, profile, stub pages) adopts one daisyUI theme — see
 * `AdminPortalTheme` for why light is `cupcake` and dark is still `dashwind-dark`.
 * The theme + `toggleTheme` are shared with descendants via `AdminPortalThemeContext`.
 */
export function AdminPortalThemeLayout() {
  const [theme, setTheme] = useState<AdminPortalTheme>(() =>
    matchDark() ? 'dashwind-dark' : 'cupcake',
  )

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dashwind-dark' ? 'cupcake' : 'dashwind-dark'))
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
