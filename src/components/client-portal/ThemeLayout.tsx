import { Outlet } from 'react-router-dom'
import { useResolvedTheme, type Portal } from '@/hooks/useResolvedTheme'

/**
 * A presentational-only layout route that stamps the portal's daisyUI
 * `data-theme` onto a wrapping `<div>` so the whole subtree adopts the right
 * identity (admin emerald vs. client LINE-green) and light/dark pairing. It
 * changes no URL, route match, guard, or handler — it only wraps `<Outlet/>`.
 *
 * `data-theme` cascades to descendants, and the redefined `dark` variant in
 * `index.css` keys off the `-dark` suffix, so migrated (daisyUI-token) and
 * not-yet-migrated (`dark:`) screens under this wrapper stay in the same mode.
 */
export function ThemeLayout({ portal }: { portal: Portal }) {
  const theme = useResolvedTheme(portal)
  return (
    <div data-theme={theme} className="min-h-screen bg-base-200 text-base-content">
      <Outlet />
    </div>
  )
}
