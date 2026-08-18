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
import { NotifGlyph } from './components/shell/notif-icons'
import { ToastProvider } from './components/feedback/Toast'
import { Sidebar, type SidebarUser } from './components/shell/Sidebar'
import { Topbar } from './components/shell/Topbar'
import { useAcl } from './lib/use-acl'
import { useTheme } from './lib/use-theme'
import type { Notification } from './lib/notifications'
import { useAuth } from './lib/auth-context'
import type { SystemUser } from '@/lib/api-client'
import { ADMIN_PORTAL_ROUTES, HOME_PATH, urlOf, type AdminRouteLabel } from './routes'

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
  role: u.role,
  avatarUrl: u.profilePictureUrl ?? null,
})

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

/**
 * ⚠️ PLACEHOLDER — P4 replaces this with the realtime feed the gateway already broadcasts.
 *
 * Held in layout state rather than as a constant so read/read-all actually mutate something:
 * a panel whose rows cannot change is a panel whose focus and count behaviour cannot be
 * verified, and those are the two parts of it that have already been wrong once.
 */
const PLACEHOLDER_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    tone: 'amber',
    icon: <NotifGlyph name="user-plus" />,
    title: 'ผู้ใช้ลงทะเบียนใหม่ 2 ราย รออนุมัติ',
    detail: 'เชิดศักดิ์ คำไล้ และอีก 1 ราย',
    time: '5 นาทีที่แล้ว',
    read: false,
  },
  {
    id: 'n2',
    tone: 'sky',
    icon: <NotifGlyph name="calendar" />,
    title: 'คำขอจองห้องประชุมใหม่ 1 รายการ',
    detail: 'ฝ่ายวิชาการ · 12 ส.ค. 2569 เวลา 09:00–12:00',
    time: '18 นาทีที่แล้ว',
    read: false,
  },
  {
    id: 'n3',
    tone: 'rose',
    icon: <NotifGlyph name="warning" />,
    title: 'เชื่อมต่อ LINE Messaging API ไม่สำเร็จ',
    detail: 'ระบบจะลองใหม่อัตโนมัติภายใน 5 นาที',
    time: '1 ชั่วโมงที่แล้ว',
    read: false,
  },
  {
    id: 'n4',
    tone: 'emerald',
    icon: <NotifGlyph name="check" />,
    title: 'อนุมัติคำขอจองสนามกีฬาแล้ว',
    detail: 'ดำเนินการโดย สมชาย ใจดี',
    time: 'เมื่อวาน 16:40',
    read: true,
  },
  // ⚠️ FIVE, not four, and the fifth is what makes the panel SCROLL. Its `max-h-[30rem]` and the
  // list's overflow are only exercised past four rows, so a four-row fixture reviews a panel
  // whose scrolling nobody has ever seen.
  {
    id: 'n5',
    tone: 'slate',
    icon: <NotifGlyph name="cancel" />,
    title: 'ผู้จองยกเลิกคำขอ 1 รายการ',
    detail: 'ห้องโสตทัศนศึกษา · 10 ส.ค. 2569',
    time: '2 วันที่แล้ว',
    read: true,
  },
]

export function BackendLayout() {
  const { resolved, choice, setTheme, isDark } = useTheme()
  const { pathname } = useLocation()
  const { user, signOut } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [notifications, setNotifications] = useState(PLACEHOLDER_NOTIFICATIONS)
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
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          me={me}
          acl={acl}
          counts={PLACEHOLDER_COUNTS}
          drawerOpen={drawerOpen}
          onDrawerChange={setDrawerOpen}
          onLogout={() => void signOut()}
        />

        <div className="flex min-w-0 flex-1 flex-col p-3 lg:py-4 lg:pl-0 lg:pr-4">
          <Topbar
            acl={acl}
            isDark={isDark}
            themeChoice={choice}
            onThemeChange={setTheme}
            notifications={notifications}
            onReadNotification={(id) =>
              setNotifications((xs) => xs.map((x) => (x.id === id ? { ...x, read: true } : x)))
            }
            onReadAll={() => setNotifications((xs) => xs.map((x) => ({ ...x, read: true })))}
          />

          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
      </ToastProvider>
    </div>
  )
}
