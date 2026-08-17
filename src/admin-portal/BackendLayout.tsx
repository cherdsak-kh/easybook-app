/**
 * The `/backend` shell.
 *
 * ⚠️ P2-B1: the sidebar is real; the topbar is a stub holding only the drawer trigger. P2-B2
 * replaces that strip with search, theme, notifications and nothing else moves — the same seam
 * P2-A left for the sidebar, and for the same reason: a broken menu and a broken route must
 * never be able to look like each other.
 *
 * ⚠️ THE SIGNED-IN USER IS A PLACEHOLDER until P2-C. It is declared HERE, once, marked, and
 * passed down as a prop — never faked inside a component. When `/auth/system/me` arrives it is
 * this one binding that changes, and nothing below it knows the difference.
 *
 * `data-theme` is stamped here rather than on `<html>` so the back-office's two themes stay
 * scoped to the back-office. The LIFF client has its own pair on its own wrapper, and neither
 * surface can repaint the other.
 */

import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar, type SidebarUser } from './components/shell/Sidebar'
import { useAcl } from './lib/use-acl'
import { useTheme } from './lib/use-theme'
import type { AdminRouteLabel } from './routes'

/**
 * ⚠️ PLACEHOLDER — P2-C replaces this with the `/auth/system/me` response.
 *
 * `SUPER_ADMIN` deliberately: it is the role that sees the WHOLE menu, so building the shell
 * against it means every row is on screen while it is being built. P2-D adds the role switcher
 * and proves the other two hide what they should.
 */
const PLACEHOLDER_ME: SidebarUser = {
  name: 'ยังไม่ได้เข้าสู่ระบบ',
  role: 'SUPER_ADMIN',
  avatarUrl: null,
}

/**
 * ⚠️ PLACEHOLDER — P4 feeds these from the list endpoints' `meta.total`.
 *
 * Kept non-empty on purpose: a count pill that only ever renders in the prototype is a piece of
 * chrome nobody looks at again until it is wrong in production.
 */
const PLACEHOLDER_COUNTS: Partial<Record<AdminRouteLabel, number>> = {
  ปฏิทินการจอง: 12,
  คำขอจองสถานที่: 3,
  การลงทะเบียน: 1,
}

export function BackendLayout() {
  const { resolved } = useTheme()
  const { pathname } = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const acl = useAcl(PLACEHOLDER_ME.role)

  // Any navigation closes the drawer — including the ones the sidebar does not originate, such
  // as the browser's back button, which would otherwise change the page behind an open menu.
  useEffect(() => setDrawerOpen(false), [pathname])

  return (
    <div
      data-theme={resolved}
      className="bg-base-200 text-base-content"
    >
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          me={PLACEHOLDER_ME}
          acl={acl}
          counts={PLACEHOLDER_COUNTS}
          drawerOpen={drawerOpen}
          onDrawerChange={setDrawerOpen}
          onLogout={() => {
            // P2-C: POST /auth/system/logout, then land on the login screen.
          }}
        />

        <div className="flex min-w-0 flex-1 flex-col p-3 lg:py-4 lg:pl-0 lg:pr-4">
          {/* ⚠️ P2-B2 STUB. Only the drawer trigger, because without it the menu is
              unreachable on a phone and the sidebar could not be verified at all. A `<label>`
              rather than a button: it drives the same checkbox the CSS drawer runs on, so
              there is exactly one source of truth for whether the menu is open. */}
          <header className="mb-3 flex shrink-0 items-center gap-3 rounded-card border border-base-300/70 bg-base-100 px-3 py-2.5 shadow-e1 lg:mb-4 lg:px-5 lg:py-3">
            <label
              htmlFor="nav-toggle"
              aria-label="เปิดเมนู"
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-control text-base-content/70 hover:bg-base-content/10 lg:hidden"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </label>
            <span className="text-[13px] text-base-content/60">แถบเครื่องมือ — P2-B2</span>
          </header>

          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
