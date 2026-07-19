import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { UI_STRINGS } from '@/constants/ui-strings-backend'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

/**
 * The protected dashboard shell: a persistent sidebar on md+ screens and a
 * slide-in drawer on mobile (the LINE webview's primary case), a sticky header,
 * and an `<Outlet/>` for the nested page (`line-users` / `staff`).
 */
export function DashboardLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="flex flex-col min-h-screen bg-base-200">
      <Header onMenuToggle={() => setMobileNavOpen((o) => !o)} />

      <div className="mx-auto flex w-full max-w-7xl flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 border-r border-base-300 md:block">
          <div className="sticky top-14">
            <Sidebar />
          </div>
        </aside>

        {/* Mobile drawer */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-30 md:hidden">
            <button
              type="button"
              aria-label={UI_STRINGS.nav.closeMenu}
              className="absolute inset-0 bg-neutral/50"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-64 bg-base-100 shadow-xl">
              <Sidebar onNavigate={() => setMobileNavOpen(false)} />
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
