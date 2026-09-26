/**
 * The `/backend` shell.
 *
 * It renders only for an authenticated session — `BackendGate` in `BackendRoutes` owns that
 * decision, so nothing in here has a signed-out variant to get wrong.
 *
 * The identity and the ACL both come from the ONE `/auth/system/me` response. When P2-B built
 * this against a placeholder, the placeholder was declared here, once, and passed down as a
 * prop rather than faked inside a component — which is why switching to the real user was a
 * one-line change and nothing below noticed.
 *
 * `data-theme` is stamped here rather than on `<html>` so the back-office's two themes stay
 * scoped to the back-office. The LIFF client has its own pair on its own wrapper, and neither
 * surface can repaint the other.
 */

import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ToastProvider } from './components/feedback/Toast'
import { Sidebar, type SidebarUser } from './components/shell/Sidebar'
import { Topbar } from './components/shell/Topbar'
import { NotificationsProvider } from './lib/NotificationsProvider'
import { RealtimeProvider } from './lib/RealtimeProvider'
import { useAcl, type Acl } from './lib/use-acl'
import { usePendingBookings } from './lib/use-pending-bookings'
import { usePendingRegistrations } from './lib/use-pending-registrations'
import { useTheme, type ThemeChoice } from './lib/use-theme'
import { useAuth } from './lib/auth-context'
import type { SystemUser } from '@/lib/api-client'
import { ADMIN_PORTAL_ROUTES, HOME_PATH, urlOf } from './routes'

/**
 * The identity card's view of `/auth/system/me`.
 *
 * ⚠️ The name is built HERE and nowhere else. It appears on the one control that is on screen
 * every second of every session, and an early prototype pass hardcoded it — so the sidebar kept
 * claiming one thing while the profile page said another. A user with neither name falls back
 * to the email rather than to an empty card, because a blank identity control reads as a broken
 * session.
 */
const toSidebarUser = (u: SystemUser): SidebarUser => ({
  name: [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email,
  // ⚠️ `personnelRole.name`, the JOB TITLE — see `SidebarUser.position`. Non-null in the DTO
  // (`SystemUserOptionDto`, not nullable), so no fallback: a blank line here would be a contract
  // violation to investigate, not a case to paper over.
  position: u.personnelRole.name,
  role: u.role,
  avatarUrl: u.profilePictureUrl ?? null,
})

export function BackendLayout() {
  const { resolved, choice, setTheme, isDark } = useTheme()
  const { pathname } = useLocation()
  const { user, signOut } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  // Non-null by construction: `BackendGate` renders this only while authenticated. Asserting it
  // here rather than threading an optional user through the whole shell keeps every component
  // below from having to render a "signed out" variant that can never appear.
  const me = toSidebarUser(user!)
  const acl = useAcl(me.role)

  // Any navigation closes the drawer — including the ones the sidebar does not originate, such
  // as the browser's back button, which would otherwise change the page behind an open menu.
  useEffect(() => setDrawerOpen(false), [pathname])

  /**
   * Standing on a destination this role may not reach.
   *
   * ⚠️ THIS IS NOT THE CONTROL, and it must never be mistaken for one. `@Roles` on the server
   * plus `system-users.policy.ts` are the boundary; a route that forgets to list a role fails
   * CLOSED there. Deleting everything below would leave the portal exactly as secure and merely
   * wrong-looking — someone would sit on a page whose every request answers 403.
   *
   * It covers TWO arrivals with one rule, which is why it lives here rather than in a link
   * handler: a deep link or a bookmark typed straight into the bar, and a role that CHANGED
   * under a session that was already standing there. The second is the one a per-link check
   * would miss entirely.
   *
   * `replace`, never a push: the denied URL must not stay in history, or Back returns to it,
   * bounces again, and the Back button is dead for as long as the operator keeps pressing it.
   */
  const here = ADMIN_PORTAL_ROUTES.find((r) => urlOf(r) === pathname)
  if (here && !acl.can(here.label)) {
    return <Navigate to={HOME_PATH} replace />
  }

  return (
    /*
     * ⚠️ `data-acl` IS A STYLING HOOK AND NOTHING ELSE — `use-acl.ts` says so at `ACL_ATTR`, and
     * the CSS says so where it reads it. Deleting this attribute changes three colours and hides
     * nothing that was protecting anything.
     *
     * It sits on the SAME wrapper as `data-theme`, for the same reason: the prototype puts both on
     * `<html>` because in a one-page file `<html>` is the portal, and here it is not — this app
     * also serves the LIFF client. The cover-colour rules set CUSTOM PROPERTIES, which inherit, so
     * any ancestor of the profile page works; the two visibility rules are descendant selectors,
     * which also work from here. `<html>` would additionally have to be un-stamped on the way out.
     */
    <div
      data-theme={resolved}
      data-acl={acl.attr}
      className="bg-base-200 text-base-content"
    >
      {/* Toasts are SHELL chrome, not a page's. `__toast` in the prototype is global, and the first
          screen to need one (โปรไฟล์, after an avatar upload) must not be the one that owns the
          stack — the next page to say "บันทึกแล้ว" would then either mount a second provider or
          find itself outside this one. It wraps the whole shell so a toast raised anywhere,
          including from a dialog in the top layer, lands in the same corner. */}
      <ToastProvider>
        {/* ⚠️ THE SOCKET BELONGS TO THE SHELL, NOT TO ANY ONE PAGE — see `realtime-context.ts`.
            BOTH sidebar counts have to move while the operator is on another page, which a
            page-scoped connection cannot do; and one connection per session is also one handshake
            and one revalidation entry per session instead of one per visit. Two live tables now
            depend on that (การลงทะเบียน and คำขอจองสถานที่) and they SUBSCRIBE — neither opens a
            socket of its own, and neither may be given one.
            `acl.write` is the gateway's own rule mirrored: `isRealtimeEligible` admits SUPER_ADMIN
            and ADMIN only, so starting one for a VIEWER would open a socket guaranteed to be
            refused. They still read every screen over HTTP. */}
        <RealtimeProvider enabled={acl.write}>
          <ShellBody
            me={me}
            acl={acl}
            drawerOpen={drawerOpen}
            onDrawerChange={setDrawerOpen}
            onLogout={() => void signOut()}
            isDark={isDark}
            themeChoice={choice}
            onThemeChange={setTheme}
          />
        </RealtimeProvider>
      </ToastProvider>
    </div>
  )
}

/**
 * The shell's chrome, split out for ONE reason: the two pending-count hooks subscribe to the socket,
 * so they have to be called from INSIDE `RealtimeProvider`, and `BackendLayout` is what renders the
 * provider. Everything here was inline until the first count became real.
 */
function ShellBody({
  me,
  acl,
  drawerOpen,
  onDrawerChange,
  onLogout,
  isDark,
  themeChoice,
  onThemeChange,
}: {
  me: SidebarUser
  acl: Acl
  drawerOpen: boolean
  onDrawerChange: (open: boolean) => void
  onLogout: () => void
  isDark: boolean
  themeChoice: ThemeChoice
  onThemeChange: (next: ThemeChoice) => void
}) {
  /**
   * ⚠️ TWO REAL COUNTS NOW, AND ปฏิทินการจอง'S IS STILL GONE RATHER THAN LEFT AS DECORATION.
   * ปฏิทินการจอง's "12" and คำขอจองสถานที่'s "3" were fixtures for pages that did not exist; a menu
   * that carries one true number beside two invented ones teaches the operator that none of them are
   * worth reading. คำขอจองสถานที่'s came back when its SCREEN did — as a fetched number, wired to the
   * same socket — which is the only way any of them may return. ปฏิทินการจอง waits its turn.
   *
   * ⚠️ EACH HOOK ASKS ITS OWN ENDPOINT AND NEITHER DERIVES FROM THE OTHER. They are two facts about
   * two queues that happen to be rendered as two pills of the same colour.
   */
  const pendingBookings = usePendingBookings()
  const pendingRegistrations = usePendingRegistrations()

  return (
    /* ⚠️ THE NOTIFICATION SOURCE WRAPS BOTH THE BELL AND THE PAGE (D-9). The topbar and the
       `<Outlet/>` read the same three server answers from it, and every write on either surface
       revalidates both — which is what keeps the badge and the page's pills in agreement without a
       second counter. It sits inside `ToastProvider` and the router, both of which it needs. */
    <NotificationsProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          me={me}
          acl={acl}
          counts={{ 'คำขอจองสถานที่': pendingBookings, 'การลงทะเบียน': pendingRegistrations }}
          drawerOpen={drawerOpen}
          onDrawerChange={onDrawerChange}
          onLogout={onLogout}
        />

        <div className="flex min-w-0 flex-1 flex-col p-3 lg:py-4 lg:pl-0 lg:pr-4">
          <Topbar
            acl={acl}
            isDark={isDark}
            themeChoice={themeChoice}
            onThemeChange={onThemeChange}
          />

          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </NotificationsProvider>
  )
}
