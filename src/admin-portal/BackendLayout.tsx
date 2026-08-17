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
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar, type SidebarUser } from './components/shell/Sidebar'
import { Topbar } from './components/shell/Topbar'
import { useAcl } from './lib/use-acl'
import { useTheme } from './lib/use-theme'
import type { Notification } from './lib/notifications'
import { useAuth } from './lib/auth-context'
import type { SystemUser } from '@/lib/api-client'
import type { AdminRouteLabel } from './routes'

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
    icon: null,
    title: 'มีคำขอลงทะเบียนใหม่ 1 รายการ',
    detail: 'รอการตรวจสอบจากเจ้าหน้าที่',
    time: '5 นาทีที่แล้ว',
    read: false,
  },
  {
    id: 'n2',
    tone: 'sky',
    icon: null,
    title: 'คำขอจองสถานที่ 3 รายการรอการอนุมัติ',
    detail: 'ห้องประชุมใหญ่ · โรงอาหาร',
    time: '1 ชั่วโมงที่แล้ว',
    read: false,
  },
  {
    id: 'n3',
    tone: 'rose',
    icon: null,
    title: 'การเชื่อมต่อ LINE ขัดข้องชั่วคราว',
    detail: 'ระบบกลับมาทำงานปกติแล้ว',
    time: 'เมื่อวาน',
    read: false,
  },
  {
    id: 'n4',
    tone: 'emerald',
    icon: null,
    title: 'อนุมัติการลงทะเบียนแล้ว 4 รายการ',
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

  return (
    <div
      data-theme={resolved}
      className="bg-base-200 text-base-content"
    >
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
    </div>
  )
}
