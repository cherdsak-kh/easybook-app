/**
 * The topbar: global search, then the utility cluster — theme, settings shortcut, bell.
 *
 * Order left→right is mode, appearance, configuration, alerts. **The bell stays right-most**
 * because it is the only control here that ever demands attention; the others are things you go
 * looking for.
 *
 * ⚠️ NO "โหมดอ่านอย่างเดียว" CHIP, and it must not come back as a smaller version of itself.
 * It answered a question the product does not ask: a VIEWER is not a session in a degraded mode
 * waiting to be upgraded, it is a JOB held by the same person every day, and the chip told them
 * on every page that theirs is the account without the buttons. Everything it covered is
 * covered closer to the thing itself — the actions column says ดูข้อมูล in its header, the
 * write-only pages are not in their sidebar at all, and each dialog explains its own refusal.
 * A permanent banner is what you reach for when nothing local can carry the message.
 */

import { Link } from 'react-router-dom'
import { NavIcon } from './nav-icons'
import { NotifReadAll, NotifRow } from './NotifRow'
import { Skeleton } from '../feedback/Skeleton'
import { usePopupMenu } from '../../lib/use-popup-menu'
import { bellLabel, unreadCount, type Notification } from '../../lib/notifications'
import type { Acl } from '../../lib/use-acl'
import type { ThemeChoice } from '../../lib/use-theme'
import { ADMIN_PORTAL_ROUTES, urlOf, type AdminRouteEntry } from '../../routes'
import { useRef } from 'react'

const ICON = 'h-5 w-5'

const SunIcon = () => (
  <svg className={ICON} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
    />
  </svg>
)

const MoonIcon = () => (
  <svg className={ICON} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
    />
  </svg>
)

const SystemIcon = () => (
  <svg className={ICON} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25"
    />
  </svg>
)

const TickIcon = () => (
  <svg
    className="menu-ico text-primary"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
)

/**
 * Three explicit choices, NOT a two-state toggle.
 *
 * "ตามระบบ" cannot be expressed by a switch: it is not a third brightness, it is "stop deciding
 * and follow the OS", and it has to survive as its own stored value — otherwise the app freezes
 * at whatever the OS happened to be the moment it was saved.
 */
const THEME_CHOICES: readonly {
  value: ThemeChoice
  label: string
  Icon: () => React.ReactElement
}[] = [
  { value: 'light', label: 'สว่าง', Icon: SunIcon },
  { value: 'dark', label: 'มืด', Icon: MoonIcon },
  { value: 'system', label: 'ตามระบบ', Icon: SystemIcon },
]

export function Topbar({
  acl,
  isDark,
  themeChoice,
  onThemeChange,
  notifications,
  notifState = 'list',
  onReadNotification,
  onReadAll,
}: {
  acl: Acl
  isDark: boolean
  themeChoice: ThemeChoice
  onThemeChange: (t: ThemeChoice) => void
  notifications: Notification[]
  /** The panel has three shapes and they are not interchangeable — see the panel below. */
  notifState?: 'list' | 'empty' | 'loading'
  onReadNotification: (id: string) => void
  onReadAll: () => void
}) {
  const theme = usePopupMenu()
  const settings = usePopupMenu()
  const notif = usePopupMenu()
  const listRef = useRef<HTMLDivElement>(null)

  const unread = unreadCount(notifications)

  // ⚠️ The SAME rows as the sidebar's การตั้งค่าระบบ group, read from the SAME table. Copying the
  // list is how the two drift and the sidebar quietly grows an eighth item this menu never gets.
  const settingsRows: AdminRouteEntry[] = ADMIN_PORTAL_ROUTES.filter(
    (r) => r.group === 'การตั้งค่าระบบ' && acl.can(r.label),
  )

  const notifRoute = ADMIN_PORTAL_ROUTES.find((r) => r.label === 'ดูการแจ้งเตือนทั้งหมด')!

  return (
    <header className="mb-3 flex shrink-0 items-center gap-3 rounded-card border border-base-300/70 bg-base-100 px-3 py-2.5 shadow-e1 lg:mb-4 lg:px-5 lg:py-3">
      <label
        htmlFor="nav-toggle"
        aria-label="เปิดเมนู"
        className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-control text-base-content/70 hover:bg-base-content/10 lg:hidden"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </label>

      {/* ═══ Global search ═══
          A real field rather than an icon button, because a text input stretches to fill this
          bar and a short label never will.

          ⚠️ There are deliberately TWO search fields on a data screen, and the placeholders are
          what say which is which: this one searches the whole back office, the card toolbar's
          filters that table only. Without the wording they read as one control duplicated. */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-control border border-transparent bg-base-200 px-3.5 transition-all focus-within:border-primary/40 focus-within:bg-base-100 focus-within:ring-4 focus-within:ring-primary/10 lg:max-w-md">
        <svg
          aria-hidden="true"
          className="h-5 w-5 shrink-0 text-base-content/60"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <label htmlFor="global-search" className="sr-only">
          ค้นหาทั้งระบบ
        </label>
        <input
          id="global-search"
          type="search"
          placeholder="ค้นหาทั้งระบบ"
          className="min-h-11 w-full min-w-0 border-none bg-transparent text-[15px] text-base-content/90 outline-none placeholder:text-base-content/70"
        />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {/* ── Theme ─────────────────────────────────────────────────────── */}
        <div className="relative">
          <button
            type="button"
            {...theme.triggerProps}
            aria-label="ธีมการแสดงผล"
            className="flex h-11 w-11 items-center justify-center rounded-control text-base-content/70 transition-colors hover:bg-base-content/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-expanded:bg-primary/10 aria-expanded:text-primary"
          >
            {/* The RESOLVED theme, not the choice: under "ตามระบบ" the button has to show what
                you are actually looking at, or it reports a preference while the screen
                disagrees with it. */}
            {isDark ? <MoonIcon /> : <SunIcon />}
          </button>

          <div
            {...theme.menuProps}
            role="radiogroup"
            aria-label="ธีมการแสดงผล"
            className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-card border border-base-300 bg-base-100 p-1.5 shadow-e2"
          >
            <p className="px-2.5 pb-1.5 pt-1 text-[12px] font-semibold text-base-content/60">
              ธีมการแสดงผล
            </p>
            {THEME_CHOICES.map(({ value, label, Icon }) => (
              <label key={value} className="menu-item menu-item-radio cursor-pointer">
                <input
                  type="radio"
                  name="theme"
                  className="sr-only"
                  checked={themeChoice === value}
                  onChange={() => onThemeChange(value)}
                />
                <Icon />
                <span className="flex-1">{label}</span>
                {themeChoice === value && <TickIcon />}
              </label>
            ))}
          </div>
        </div>

        {/* ── Settings shortcut ──────────────────────────────────────────
            The same leaves as the sidebar's collapsed การตั้งค่าระบบ group, on purpose: that
            group sits closed at the bottom of a 25-item scroll, which is right for screens you
            visit rarely and wrong for screens you need mid-task.

            Hidden below `sm`. The shortcut buys a saved trip through a long scroll on a wide
            screen; on a phone it costs 44px of a topbar that has none to give, and the drawer
            is already one tap away. That is refusing to pay desktop convenience out of the
            phone's budget, not dropping a route. */}
        {settingsRows.length > 0 && (
          <div className="relative hidden sm:block">
            <button
              type="button"
              {...settings.triggerProps}
              aria-label="การตั้งค่าระบบ"
              className="flex h-11 w-11 items-center justify-center rounded-control text-base-content/70 transition-colors hover:bg-base-content/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-expanded:bg-primary/10 aria-expanded:text-primary"
            >
              <NavIcon label="การตั้งค่าระบบ" className={ICON} />
            </button>

            <div
              {...settings.menuProps}
              aria-label="การตั้งค่าระบบ"
              className="absolute right-0 top-full z-50 mt-1 w-60 overflow-hidden rounded-card border border-base-300 bg-base-100 p-1.5 shadow-e2"
            >
              <p className="px-2.5 pb-1.5 pt-1 text-[12px] font-semibold text-base-content/60">
                การตั้งค่าระบบ
              </p>
              {settingsRows.map((route) => (
                <Link key={route.path} to={urlOf(route)} className="menu-item">
                  <NavIcon label={route.label} className="menu-ico" />
                  {route.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Notifications ──────────────────────────────────────────────
            MOBILE IS A DIFFERENT SHAPE, NOT A NARROWER ONE. A 380px dropdown does not fit a
            375px screen, and squeezing it to 359px leaves ~200px for a two-line Thai sentence.
            On a phone the panel is full-bleed under the bar with 8px gutters; from `sm` up it
            anchors to the bell. Same DOM, same behaviour — only the box moves. */}
        <div className="relative">
          <button
            type="button"
            {...notif.triggerProps}
            aria-label={bellLabel(unread)}
            className="relative flex h-11 w-11 items-center justify-center rounded-control text-base-content/70 transition-colors hover:bg-base-content/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-expanded:bg-primary/10 aria-expanded:text-primary"
          >
            <NavIcon label="ตั้งค่าการแจ้งเตือน" className={ICON} />
            {/* aria-hidden: the count is already a sentence in the trigger's accessible name.
                Left readable it announces a bare "3" straight after it. */}
            {unread > 0 && (
              <span
                aria-hidden="true"
                className="absolute right-1.5 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-error px-1 text-[12px] font-semibold tabular-nums text-error-content"
              >
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>

          <div
            {...notif.menuProps}
            aria-label="การแจ้งเตือน"
            className="fixed left-2 right-2 top-[84px] z-50 flex max-h-[calc(100dvh-96px)] flex-col overflow-hidden rounded-card border border-base-300 bg-base-100 shadow-e2 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-1 sm:max-h-[30rem] sm:w-[380px]"
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-base-300 px-3.5 py-2">
              <h2 className="m-0 text-[15px] font-semibold text-base-content">การแจ้งเตือน</h2>
              {unread > 0 && <span className="nav-count nav-count-alert ml-0">{unread} ใหม่</span>}
              <span className="ml-auto" />
              <NotifReadAll count={unread} onReadAll={onReadAll} listRef={listRef} />
            </div>

            <div className="nav-scroll min-h-0 flex-1 overflow-y-auto">
              {notifState === 'list' && (
                <div ref={listRef} className="divide-y divide-base-300/60">
                  {notifications.map((item, i) => (
                    <NotifRow
                      key={item.id}
                      item={item}
                      onRead={onReadNotification}
                      // The panel's first focusable is otherwise the read-all button, and one
                      // Enter on open would clear every unread marker.
                      preferFocus={i === 0}
                    />
                  ))}
                </div>
              )}

              {/* Says what WILL appear here, not merely that nothing has. "ไม่มีข้อมูล" leaves
                  the reader unsure whether the feature is broken or simply quiet. */}
              {notifState === 'empty' && (
                <div className="flex flex-col items-center gap-1.5 px-6 py-12 text-center">
                  <svg
                    aria-hidden="true"
                    className="mb-1 h-8 w-8 text-base-content/40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.6}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7M9.344 3.071a6.002 6.002 0 018.395 5.492M14.857 17.082a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0M3 3l18 18M4.5 8.25c0-.399.039-.789.113-1.167m-.851 8.689A8.967 8.967 0 006 9.75"
                    />
                  </svg>
                  <p className="m-0 text-[14px] font-medium text-base-content">ยังไม่มีการแจ้งเตือน</p>
                  <p className="m-0 text-[13px] leading-[1.45] text-base-content/70">
                    เมื่อมีคำขอจอง การลงทะเบียนใหม่
                    <br />
                    หรือปัญหาของระบบ จะแจ้งที่นี่
                  </p>
                </div>
              )}

              {/* Mirrors the real row's geometry (36px tile, three text lines) so the panel does
                  not resize the moment data lands. */}
              {notifState === 'loading' && (
                <div aria-hidden="true" className="divide-y divide-base-300/60">
                  {[
                    ['w-4/5', 'w-3/5'],
                    ['w-3/5', 'w-4/5'],
                    ['w-2/3', 'w-1/2'],
                  ].map(([a, b]) => (
                    <div key={a + b} className="flex items-start gap-3 px-3.5 py-3">
                      <Skeleton variant="box" className="h-9 w-9 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <Skeleton className={`block h-3.5 ${a}`} />
                        <Skeleton variant="soft" className={`mt-2 block h-3 ${b}`} />
                        <Skeleton variant="soft" className="mt-2 block h-2.5 w-16" />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Link
              to={urlOf(notifRoute)}
              data-menu-close
              className="flex min-h-11 shrink-0 items-center justify-center gap-1.5 border-t border-base-300 px-3.5 text-[14px] font-medium text-base-content/80 transition-colors hover:bg-base-content/5 hover:text-base-content focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
            >
              ดูการแจ้งเตือนทั้งหมด
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
