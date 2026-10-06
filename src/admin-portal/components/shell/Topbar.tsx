/**
 * The topbar: the command-palette trigger, then the utility cluster — theme, settings shortcut, bell, a
 * divider, and the account control.
 *
 * Order left→right is appearance, configuration, alerts, then identity. **The account control is
 * right-most**, the corner a signed-in name conventionally lives in, and it is here rather than in
 * the sidebar because below `lg` the sidebar is a drawer and used to hide who was signed in. The
 * bell is still the only control that ever demands attention; the others are things you go looking
 * for.
 *
 * ⚠️ NO "โหมดอ่านอย่างเดียว" CHIP, and it must not come back as a smaller version of itself.
 * It answered a question the product does not ask: a VIEWER is not a session in a degraded mode
 * waiting to be upgraded, it is a JOB held by the same person every day, and the chip told them
 * on every page that theirs is the account without the buttons. Everything it covered is
 * covered closer to the thing itself — the actions column says ดูข้อมูล in its header, the
 * write-only pages are not in their sidebar at all, and each dialog explains its own refusal.
 * A permanent banner is what you reach for when nothing local can carry the message.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CommandPalette } from './CommandPalette'
import { NavIcon } from './nav-icons'
import { NotifGlyph } from './notif-icons'
import { NotifReadAll, NotifRow } from './NotifRow'
import { Skeleton } from '../feedback/Skeleton'
import { Avatar } from '../ui/Avatar'
import type { SidebarUser } from './Sidebar'
import { closeAllMenus, usePopupMenu } from '../../lib/use-popup-menu'
import {
  TONE_KEY,
  actionTarget,
  badgeText,
  bellLabel,
  relativeTime,
  type Notification,
} from '../../lib/notifications'
import type { AdminNotification } from '../../lib/notifications-api'
import { useNotifications } from '../../lib/notifications-context'
import { useToast } from '../../lib/toast-context'
import type { Acl } from '../../lib/use-acl'
import type { ThemeChoice } from '../../lib/use-theme'
import {
  ADMIN_PORTAL_ROUTES,
  urlOf,
  type AdminRouteEntry,
  type AdminRouteLabel,
} from '../../routes'

const ICON = 'h-5 w-5'

/**
 * A mark-read that failed. The prototype cannot fail this write, so it has no copy for it; this
 * follows its `deleteNotif` failure line (design deviation 4) — what happened, that nothing changed,
 * and what to do.
 */
const READ_FAIL = 'ทำเครื่องหมายว่าอ่านแล้วไม่สำเร็จ — สถานะการอ่านยังเหมือนเดิม ลองใหม่อีกครั้ง'

/**
 * DTO → the panel row's view-model. `NotifRow` and `Notification` are unchanged (design A-8), so the
 * Showcase's static fixture keeps compiling. `body` goes in VERBATIM (D-1): attribution is a data
 * rule, and the UI neither parses nor decorates it.
 */
const toBellItem = (n: AdminNotification): Notification => ({
  id: n.id,
  tone: TONE_KEY[n.tone] ?? 'slate',
  icon: <NotifGlyph name={n.icon} />,
  title: n.title,
  detail: n.body,
  time: relativeTime(n.createdAt),
  read: n.isRead,
})

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

/** The three personal destinations, in the order the prototype lists them. */
const ACCOUNT_LABELS: readonly AdminRouteLabel[] = [
  'โปรไฟล์',
  'เปลี่ยนรหัสผ่าน',
  'ประวัติการเข้าสู่ระบบ',
]

/**
 * The palette must not open over something that owns the keyboard — a native modal, whose own
 * Escape handling would fight ours. `dialog[open]` includes the session-expired dialog.
 */
const dialogIsOpen = () => document.querySelector('dialog[open]') !== null

export function Topbar({
  me,
  onLogout,
  acl,
  isDark,
  themeChoice,
  onThemeChange,
}: {
  me: SidebarUser
  onLogout: () => void
  acl: Acl
  isDark: boolean
  themeChoice: ThemeChoice
  onThemeChange: (t: ThemeChoice) => void
}) {
  const theme = usePopupMenu()
  const settings = usePopupMenu()
  const notif = usePopupMenu()
  const account = usePopupMenu()
  const listRef = useRef<HTMLDivElement>(null)
  const [readAllAnnouncement, setReadAllAnnouncement] = useState('')
  const navigate = useNavigate()
  const toast = useToast()
  const { unread, bell, invalidate, markRead, markManyRead } = useNotifications()

  /**
   * ⚠️ `GET /unread-count`'s total, NEVER a count of `bell` (D-10) — the panel holds only the newest
   * five, so its rows would under-report the moment a sixth arrived. `null` = not loaded yet: the
   * badge and chip stay hidden and the name is the bare `การแจ้งเตือน`, rather than a zero nobody
   * measured.
   */
  const unreadTotal = unread?.total ?? null

  /**
   * The panel has three shapes and they are not interchangeable. `null` is "never loaded", which
   * keeps the skeleton — including after a failed first fetch, until the next trigger succeeds.
   * Opening the panel IS a trigger (below), so the reader is never stuck on it for long. The
   * prototype has no bell error state, and none is invented here.
   */
  const notifState: 'list' | 'empty' | 'loading' =
    bell === null ? 'loading' : bell.length === 0 ? 'empty' : 'list'

  // The operator is about to read the panel, so read the server first (D-9). Opening marks NOTHING
  // read (AC-17) — seeing that three things happened is not having dealt with them.
  useEffect(() => {
    if (notif.open) invalidate()
  }, [notif.open, invalidate])

  /**
   * A panel row (D-15): mark it read if it is unread, and go where it points WITHOUT awaiting the
   * write — SPA navigation does not cancel the request, and the provider revalidates when it
   * settles. A row with no reachable target (null `actionUrl`, or a screen this role is denied) only
   * marks read; `data-menu-close` on the row closes the panel either way.
   */
  const openFromBell = (n: AdminNotification) => {
    if (!n.isRead) void markRead(n.id).catch(() => toast('error', READ_FAIL))
    const to = actionTarget(n.actionUrl, acl.can)
    if (to) void navigate(to)
  }

  // ⚠️ The SAME rows as the sidebar's การตั้งค่าระบบ group, read from the SAME table. Copying the
  // list is how the two drift and the sidebar quietly grows an eighth item this menu never gets.
  const settingsRows: AdminRouteEntry[] = ADMIN_PORTAL_ROUTES.filter(
    (r) => r.group === 'การตั้งค่าระบบ' && acl.can(r.label),
  )

  const notifRoute = ADMIN_PORTAL_ROUTES.find((r) => r.label === 'ดูการแจ้งเตือนทั้งหมด')!

  // ── Command palette ──────────────────────────────────────────────────────
  const [paletteOpen, setPaletteOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  /** `restoreFocus`: Escape, backdrop and the close button return to the trigger; a CHOICE does not. */
  const closePalette = useCallback((restoreFocus: boolean) => {
    setPaletteOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  const openPalette = () => {
    if (paletteOpen || dialogIsOpen()) return
    // An open topbar menu would otherwise survive behind the scrim and race it for Escape.
    closeAllMenus()
    setPaletteOpen(true)
  }

  // Ctrl/Cmd+K toggles; "/" opens. Bubble phase on `document`; the palette's own Escape/Tab
  // listener is capture-phase and only exists while it is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // `code`, not only `key`: on a Thai layout `key` is ก/า, so Ctrl+K reports a different letter.
      const isK =
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        !e.shiftKey &&
        (e.code === 'KeyK' || e.key?.toLowerCase() === 'k')
      if (isK) {
        if (paletteOpen) {
          e.preventDefault()
          closePalette(true)
        } else if (!dialogIsOpen()) {
          e.preventDefault()
          closeAllMenus()
          setPaletteOpen(true)
        } // else leave the browser's own Ctrl+K alone
        return
      }
      if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
      if (e.key !== '/' && e.code !== 'Slash') return
      if (paletteOpen) return
      const t = e.target as HTMLElement | null
      const tag = t?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return
      if (dialogIsOpen()) return
      // Only when it actually opened, or the "/" would be typed into the field we just focused.
      e.preventDefault()
      closeAllMenus()
      setPaletteOpen(true)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [paletteOpen, closePalette])

  return (
    <header className="mb-3 flex shrink-0 items-center gap-3 rounded-card border border-base-300/70 bg-base-100 px-3 py-2.5 shadow-e1 lg:mb-4 lg:px-5 lg:py-3">
      <label
        htmlFor="nav-toggle"
        aria-label="เปิดเมนู"
        data-tip="เปิดเมนู"
        data-tip-pos="bottom"
        className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-control text-base-content/70 hover:bg-base-content/10 lg:hidden"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </label>

      {/* ═══ Command palette trigger ═══
          Replaced a "search everything" field that searched nothing: there is no cross-entity
          index, so the box promised a capability the product does not have, and it took 45-105px
          of a phone bar for a placeholder that still clipped. What operators actually need across
          26 pages is to JUMP, so this opens a page navigator (Ctrl/Cmd+K, or "/").

          ONE responsive button rather than a pill plus an icon button: one id, one aria-label,
          one focus target to restore, and no way for the two to drift apart. Below `sm` it is the
          44px square (text and kbd hidden); from `sm` up the same element widens into the pill. */}
      <button
        ref={triggerRef}
        type="button"
        id="cmd-trigger"
        aria-haspopup="dialog"
        aria-label="ค้นหาหน้าเมนูและคำสั่ง (Ctrl+K)"
        onClick={openPalette}
        className="group flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-control border border-base-300/80 bg-base-200/60 text-base-content/70 transition-all hover:border-primary/40 hover:bg-base-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-60 sm:justify-between sm:gap-2.5 sm:px-3 sm:text-left md:w-72 lg:w-80"
      >
        <svg
          aria-hidden="true"
          className="h-5 w-5 shrink-0 sm:h-4 sm:w-4 sm:text-base-content/60"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="hidden min-w-0 flex-1 truncate text-[13px] text-base-content/60 sm:block">
          ค้นหาหน้าเมนูหรือคำสั่ง...
        </span>
        <kbd
          aria-hidden="true"
          className="kbd kbd-sm hidden shrink-0 border-base-300 bg-base-100 font-mono text-[11px] text-base-content/70 sm:inline-flex"
        >
          Ctrl K
        </kbd>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {/* ── Theme ─────────────────────────────────────────────────────── */}
        <div className="relative">
          <button
            type="button"
            {...theme.triggerProps}
            aria-label="ธีมการแสดงผล"
            data-tip="ธีมการแสดงผล"
            data-tip-pos="bottom"
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
              data-tip="การตั้งค่าระบบ"
              data-tip-pos="bottom"
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
            aria-label={bellLabel(unreadTotal)}
            // The tooltip is a NAME, the aria-label is a SENTENCE, and they are different on
            // purpose: a hover bubble reading "การแจ้งเตือน 3 รายการที่ยังไม่อ่าน" repeats a
            // count already painted on the badge two pixels away. `[data-tip]` hides itself
            // while `aria-expanded="true"`, so the bubble never sits on top of the open panel.
            data-tip="การแจ้งเตือน"
            data-tip-pos="bottom"
            className="relative flex h-11 w-11 items-center justify-center rounded-control text-base-content/70 transition-colors hover:bg-base-content/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-expanded:bg-primary/10 aria-expanded:text-primary"
          >
            <NavIcon label="การแจ้งเตือน" className={ICON} />
            {/* aria-hidden: the count is already a sentence in the trigger's accessible name.
                Left readable it announces a bare "3" straight after it. */}
            {unreadTotal ? (
              <span
                aria-hidden="true"
                className="absolute right-1.5 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-error px-1 text-[12px] font-semibold tabular-nums text-error-content"
              >
                {/* 9+, not 99+ — see `badgeText`. The exact number is the panel's chip. */}
                {badgeText(unreadTotal)}
              </span>
            ) : null}
          </button>

          <div
            {...notif.menuProps}
            aria-label="การแจ้งเตือน"
            className="fixed left-2 right-2 top-[84px] z-50 flex max-h-[calc(100dvh-96px)] flex-col overflow-hidden rounded-card border border-base-300 bg-base-100 shadow-e2 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-1 sm:max-h-[30rem] sm:w-[380px]"
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-base-300 px-3.5 py-2">
              <h2 className="m-0 text-[15px] font-semibold text-base-content">การแจ้งเตือน</h2>
              {unreadTotal ? (
                <span className="nav-count nav-count-alert ml-0">{unreadTotal} ใหม่</span>
              ) : null}
              {/* Already in the DOM before it has anything to say — a live region created at the
                  same moment as its text is not announced. `NotifReadAll` fills it. */}
              <span role="status" className="sr-only">
                {readAllAnnouncement}
              </span>
              {/* `POST /read-all` with NO body: every visible unread row, not just the five on
                  screen (AC-14). Its focus-first order and live sentence are `NotifReadAll`'s. */}
              <NotifReadAll
                count={unreadTotal ?? 0}
                onReadAll={() => void markManyRead().catch(() => toast('error', READ_FAIL))}
                listRef={listRef}
                onAnnounce={setReadAllAnnouncement}
              />
            </div>

            <div className="nav-scroll min-h-0 flex-1 overflow-y-auto">
              {notifState === 'list' && bell && (
                <div ref={listRef} className="divide-y divide-base-300/60">
                  {bell.map((n, i) => (
                    <NotifRow
                      key={n.id}
                      item={toBellItem(n)}
                      onRead={() => openFromBell(n)}
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

        {/* ── Account ────────────────────────────────────────────────────
            The identity control, right-most. A real <button> carrying aria-expanded +
            aria-controls, NOT <details>/<summary>, which can carry neither. The panel opens
            DOWNWARD from the bar, aligned to the right edge so it cannot run off the screen.

            No chevron: the avatar is the affordance, and below `lg` it is the whole control. */}
        <div className="mx-2 hidden h-6 w-px bg-base-300 sm:block" aria-hidden="true" />

        <div className="relative">
          <button
            type="button"
            {...account.triggerProps}
            aria-label="เมนูบัญชีผู้ใช้"
            className="group flex min-h-11 min-w-11 items-center justify-end gap-3 rounded-control px-2 py-1.5 text-right transition-colors hover:bg-base-content/10 aria-expanded:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:pl-3.5 lg:pr-2"
          >
            <span className="hidden flex-col items-end text-right lg:flex">
              <span className="text-[14px] font-semibold leading-tight text-base-content/90 transition-colors group-hover:text-primary">
                {me.name}
              </span>
              {/* ⚠️ THE POSITION (ตำแหน่ง), NEVER THE ROLE. Ported wrong on the first pass — it
                  printed `ROLE_LABEL[me.role]`, which the prototype's ACL module rejects in as
                  many words:

                    "The identity card carries the POSITION, not the role. It is the only line
                     about you that is on screen at all times, and the thing a person recognises
                     themselves by is their job title — หัวหน้าฝ่ายบริหารงานทั่วไป, not VIEWER."

                  It is also the second half of the SUPER_ADMIN-only rule the profile page already
                  honours: the RBAC enum stays off every screen for everyone but a SUPER_ADMIN, and
                  a control that is on screen every second of every session is the last place it
                  may leak from. Printing the role here would have re-opened, in the most visible
                  control in the portal, exactly the confusion `ProfilePage`'s header comment
                  exists to prevent — that a job title and a permission are the same kind of thing.

                  Presentation only. `me.role` still gates the menu through `useAcl`. */}
              <span className="text-[12px] leading-tight text-base-content/70">{me.position}</span>
            </span>
            {/* The fallback is the operator's INITIAL, never the product logo — `Avatar` carries
                the argument. This control is on screen every second of every session, so whatever
                sits here is the most-seen image in the portal. The `<img>`'s hairline and backdrop
                come from `Avatar`'s own `chrome` / `backdrop` defaults, deliberately NOT repeated
                in `className`: `className` also reaches the initial's disc, which must carry no
                border and must keep `.ava-fill`'s opaque tint. */}
            <Avatar
              src={me.avatarUrl}
              name={me.name}
              className="h-10 w-10 rounded-control object-cover ring-1 ring-base-300 transition-shadow group-hover:ring-primary/40 group-aria-expanded:ring-2 group-aria-expanded:ring-primary text-[15px]"
            />
          </button>

          <div
            {...account.menuProps}
            aria-label="บัญชีผู้ใช้งาน"
            className="absolute right-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-card border border-base-300 bg-base-100 p-1.5 shadow-e2"
          >
            <p className="px-2.5 pb-1.5 pt-1 text-[12px] font-semibold text-base-content/60">
              บัญชีผู้ใช้งาน
            </p>
            {ACCOUNT_LABELS.map((label) => {
              const route = ADMIN_PORTAL_ROUTES.find((r) => r.label === label)!
              return (
                <Link key={label} to={urlOf(route)} className="menu-item">
                  <NavIcon label={label} className="menu-ico" />
                  {label}
                </Link>
              )
            })}

            <div className="my-1.5 border-t border-base-300" />
            {/* Logout lives here because the identity control is the only place it belongs —
                there is no navbar avatar dropdown in this design. */}
            <button type="button" className="menu-item menu-item-danger" onClick={onLogout}>
              <NavIcon label="ออกจากระบบ" className="menu-ico" />
              ออกจากระบบ
            </button>
          </div>
        </div>
      </div>
      <CommandPalette open={paletteOpen} onClose={closePalette} acl={acl} />
    </header>
  )
}
