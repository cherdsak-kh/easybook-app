// Layout/structure adapted from DashWind (daisyui-admin-dashboard-template),
// https://github.com/robbins23/daisyui-admin-dashboard-template — MIT (c) 2022 Dashwind.
// See THIRD_PARTY_NOTICES.md. Folds DashWind's Layout.js + PageContent.js.
import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { UI_STRINGS } from '@/constants/ui-strings-backend'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { SIDEBAR_DRAWER_ID } from './nav-config'

/**
 * The protected dashboard shell. A daisyUI `drawer`: on `lg+` the sidebar is
 * persistently visible (`lg:drawer-open`); on mobile (the LINE webview's primary
 * case) it is a slide-in drawer whose open/closed state is held by a visually
 * hidden `drawer-toggle` checkbox — no `useState`, no fixed-overlay div. The
 * hamburger, the scrim and the ✕ button are all `<label>`s/clicks pointed at the
 * same checkbox id.
 *
 * The `drawer-content` column carries the sticky `<Header/>` and a scrollable
 * `<main>` that renders the nested page via `<Outlet/>` (our router owns routing;
 * there is no nested `<Routes>`). `<main>` scrolls back to top on navigation.
 */
export function DashboardLayout() {
  const mainRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()

  // Reset scroll on navigation, keyed on the pathname. Instant (no smooth): a
  // visible scroll animation on route change is unwanted in the narrow webview.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="drawer lg:drawer-open">
      <input
        id={SIDEBAR_DRAWER_ID}
        type="checkbox"
        className="drawer-toggle"
        aria-label={UI_STRINGS.nav.label}
      />
      <div className="drawer-content flex min-h-screen flex-col bg-base-200">
        <Header />
        <main ref={mainRef} className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
      <Sidebar />
    </div>
  )
}
