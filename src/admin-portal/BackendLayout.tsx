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
import { Topbar } from './components/shell/Topbar'
import { useAcl } from './lib/use-acl'
import { useTheme } from './lib/use-theme'
import type { Notification } from './lib/notifications'
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
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [notifications, setNotifications] = useState(PLACEHOLDER_NOTIFICATIONS)
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
