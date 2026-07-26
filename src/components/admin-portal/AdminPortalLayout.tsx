// Layout/structure adapted from DashWind (daisyui-admin-dashboard-template),
// https://github.com/robbins23/daisyui-admin-dashboard-template — MIT (c) 2022 Dashwind.
// See THIRD_PARTY_NOTICES.md. Folds the template's `containers/Layout.js` +
// `containers/PageContent.js`. Stripped: Redux (`useDispatch`/`useSelector`),
// `react-notifications` (NotificationContainer/Manager), `RightSidebar`,
// `ModalLayout`, `Suspense`/`lazy`/`SuspenseContent`, and the nested `<Routes>` +
// `routes` map — the app router owns routing, so the page renders via `<Outlet/>`.
import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AdminPortalHeader } from './AdminPortalHeader'
import { AdminPortalSidebar } from './AdminPortalSidebar'
import { ADMIN_PORTAL_DRAWER_ID } from './nav-config'

/**
 * The replica dashboard shell. A daisyUI `drawer`: on `lg+` the sidebar is
 * persistently visible (`lg:drawer-open`); on mobile it is a slide-in drawer whose
 * open/closed state is held by a visually hidden `drawer-toggle` checkbox. The
 * hamburger, the scrim and the ✕ button are all `<label>`s/clicks pointed at the
 * same checkbox id (`ADMIN_PORTAL_DRAWER_ID`, distinct from the live shell's id).
 *
 * The `drawer-content` column carries the sticky `<AdminPortalHeader/>` and a
 * scrollable `<main>` that renders the nested page via `<Outlet/>`; `<main>` scrolls
 * back to top on navigation (keyed on `pathname`, instant — no smooth animation in
 * the narrow webview).
 */
export function AdminPortalLayout() {
  const mainRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="drawer lg:drawer-open">
      <input
        id={ADMIN_PORTAL_DRAWER_ID}
        type="checkbox"
        className="drawer-toggle"
        aria-label="Sidebar navigation"
      />
      <div className="drawer-content flex min-h-screen flex-col bg-base-200">
        <AdminPortalHeader />
        <main ref={mainRef} className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
      <AdminPortalSidebar />
    </div>
  )
}
