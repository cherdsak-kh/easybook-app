// Isolated theme wrapper for the DashWind replica. Our own analog of the client portal's
// `src/components/client-portal/ThemeLayout.tsx` — it deliberately COPIES (does NOT import) the tiny
// `prefers-color-scheme` resolver so the shared `ThemeLayout`/`useResolvedTheme` stay
// the single authority for the REAL portals and are provably unmodified.
//
// This wrapper is the SINGLE owner of the portal's `data-theme`. It holds a tri-state
// PREFERENCE (`light | dark | system`), persists it to one namespaced `localStorage` key,
// and resolves it to the theme actually stamped. It REPLACES the previous "init once from
// `prefers-color-scheme`, then never listen again" mechanism — the OS is now consulted
// continuously, but ONLY while the preference is `system`, so a manual light/dark choice
// is still never clobbered by an OS change (the property the old code protected).
//
// The `matchMedia` listener is mounted/torn down by preference, so exactly zero listeners
// exist while the preference is `light` or `dark`, and exactly one while it is `system`.
//
// Every surface under this wrapper restyles purely through daisyUI semantic tokens (CSS),
// so flipping `data-theme` here is enough — no descendant has to be remounted to pick the
// new theme up, and nothing ever needs a page reload.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import {
  AdminPortalThemeContext,
  DARK_COLOR_SCHEME_QUERY,
  prefersDarkColorScheme,
  readStoredThemePreference,
  resolveAdminPortalTheme,
  writeStoredThemePreference,
  type AdminPortalThemeContextValue,
  type AdminPortalThemePreference,
} from './admin-portal-theme'

/**
 * Owns the portal's theme and stamps `data-theme="cupcake" | "dashwind-dark"` on a
 * wrapping `<div>` around its `<Outlet/>`, so the WHOLE admin subtree (login,
 * LandingIntro, shell, profile, stub pages) adopts one daisyUI theme — see
 * `AdminPortalTheme` for why light is `cupcake` and dark is still `dashwind-dark`.
 * `{ preference, setPreference, theme }` is shared with descendants via
 * `AdminPortalThemeContext`.
 */
export function AdminPortalThemeLayout() {
  const [preference, setStoredPreference] =
    useState<AdminPortalThemePreference>(readStoredThemePreference)
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(prefersDarkColorScheme)

  // Live OS tracking, mounted ONLY while the preference is `system`. Re-reading
  // `mql.matches` on subscribe closes the gap between first render and effect, and covers
  // a scheme change that happened while the tab was backgrounded.
  useEffect(() => {
    if (preference !== 'system') return
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const mediaQuery = window.matchMedia(DARK_COLOR_SCHEME_QUERY)
    const onChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches)
    setSystemPrefersDark(mediaQuery.matches)
    mediaQuery.addEventListener('change', onChange)
    return () => mediaQuery.removeEventListener('change', onChange)
  }, [preference])

  const setPreference = useCallback((next: AdminPortalThemePreference) => {
    // Re-read the OS synchronously when switching TO `system` so the first painted frame
    // is already correct, rather than flashing the previous theme until the effect runs.
    if (next === 'system') setSystemPrefersDark(prefersDarkColorScheme())
    setStoredPreference(next)
    writeStoredThemePreference(next)
  }, [])

  const theme = resolveAdminPortalTheme(preference, systemPrefersDark)

  const value = useMemo<AdminPortalThemeContextValue>(
    () => ({ preference, setPreference, theme }),
    [preference, setPreference, theme],
  )

  return (
    <AdminPortalThemeContext.Provider value={value}>
      <div data-theme={theme} className="min-h-screen bg-base-200 text-base-content">
        <Outlet />
      </div>
    </AdminPortalThemeContext.Provider>
  )
}
