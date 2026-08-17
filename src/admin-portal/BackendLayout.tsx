/**
 * The `/backend` shell.
 *
 * ⚠️ P2-A STUB. Today this is the theme wrapper and the content column, and nothing else — no
 * sidebar, no topbar, no drawer. **P2-B fills the chrome in without touching the router**, which
 * is the point of splitting them: the route table can be walked and verified end to end before
 * any of the navigation around it exists, so a broken route and a broken menu can never be
 * mistaken for each other.
 *
 * `data-theme` is stamped HERE rather than on `<html>` so the back-office's two themes stay
 * scoped to the back-office. The LIFF client has its own pair on its own wrapper, and neither
 * surface can repaint the other.
 */

import { Outlet } from 'react-router-dom'
import { useTheme } from './lib/use-theme'

export function BackendLayout() {
  const { resolved } = useTheme()

  return (
    <div
      data-theme={resolved}
      className="min-h-screen bg-base-200 text-base-content lg:h-screen lg:overflow-hidden"
    >
      {/* P2-B: sidebar + topbar wrap this column. The padding is the content inset the shell
          will own — kept here so the stub looks like the real thing at the edges rather than
          flush against the viewport, which would make every heading look misaligned. */}
      <div className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col px-4 py-5 sm:px-6 lg:h-screen lg:min-h-0 lg:py-6">
        <Outlet />
      </div>
    </div>
  )
}
