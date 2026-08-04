// Ported from DashWind (daisyui-admin-dashboard-template) — MIT (c) 2022 Dashwind. See THIRD_PARTY_NOTICES.md
// Interactive WITHOUT Redux/`theme-change`: the Sun/Moon toggle drives `AdminPortalThemeLayout`'s
// theme via context, and the bell panel is a CSS-only daisyUI dropdown (focus-driven open/close,
// click-away + Esc handled by the browser — deliberately no document listeners).
import { Link, useNavigate } from 'react-router-dom'
import Bars3Icon from '@heroicons/react/24/outline/Bars3Icon'
import BellIcon from '@heroicons/react/24/outline/BellIcon'
import MoonIcon from '@heroicons/react/24/outline/MoonIcon'
import SunIcon from '@heroicons/react/24/outline/SunIcon'
import UserIcon from '@heroicons/react/24/outline/UserIcon'
import { ADMIN_PORTAL_ROUTES } from './routes'
import { ADMIN_PORTAL_DRAWER_ID } from './nav-config'
import { useAdminPortalTheme } from './admin-portal-theme'
import { useAuth } from '@/auth/useAuth'
import { PROFILE_STRINGS } from '@/constants/ui-strings-profile'

interface HeaderNotification {
  readonly id: number
  readonly text: string
  /** Unread rows get a subtle highlight + count into the bell badge. */
  readonly unread: boolean
}

/** Mock notifications, verbatim-style from the template's demo drawer. */
const NOTIFICATIONS: readonly HeaderNotification[] = [
  { id: 1, text: 'Your sales has increased by 30% yesterday', unread: true },
  { id: 2, text: 'Total likes for instagram post - New launch this week, has crossed 100k', unread: true },
  { id: 3, text: 'Your sales has increased by 30% yesterday', unread: false },
  { id: 4, text: 'Total likes for instagram post - New launch this week, has crossed 100k', unread: false },
  { id: 5, text: 'Your sales has increased by 30% yesterday', unread: false },
]

const UNREAD_COUNT = NOTIFICATIONS.filter((n) => n.unread).length

/** Closes any open CSS-only dropdown by blurring the focused trigger/item. */
function closeMenus() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
}

/**
 * Replica top bar (daisyUI `navbar`): a mobile drawer toggle, a working light/dark
 * Sun/Moon toggle, a notification dropdown and a profile dropdown. The hamburger is a
 * `<label htmlFor>` bound to the drawer checkbox. "Logout" tears down the real cookie
 * session via `useAuth().logout` before navigating back to the replica login.
 *
 * **There is no page title here** (PO review). The template's
 * `<h1 class="ml-2 truncate text-2xl">{pageTitle}</h1>` was removed for ALL pages at ALL
 * breakpoints — in the narrow LINE webview the hamburger sat on top of it — and
 * `usePageTitle`/`TITLE_BY_PATH` went with it, since nothing else consumed them. The
 * `<main>` landmark in `AdminPortalLayout` carries an explicit accessible name so the
 * page content region is still announced on the stub pages that have no `<h1>` of their
 * own; pages that own a real `<h1>` (e.g. Profile) are unaffected.
 */
export function AdminPortalHeader() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useAdminPortalTheme()
  const { logout, user } = useAuth()
  const isDark = theme === 'dashwind-dark'

  return (
    <div className="navbar sticky top-0 z-20 bg-base-100 shadow-md">
      <div className="flex-1">
        <label
          htmlFor={ADMIN_PORTAL_DRAWER_ID}
          aria-label="Open menu"
          className="btn btn-primary drawer-button lg:hidden"
        >
          <Bars3Icon aria-hidden className="h-5 w-5" />
        </label>
      </div>

      <div className="flex-none">
        {/* Working light/dark toggle. Controlled by the wrapper's local theme state
            (context) — the crossfade tracks the real `data-theme`, and the visually
            hidden checkbox stays keyboard-operable (Space) with a visible focus ring. */}
        <label
          className="btn btn-ghost btn-circle swap swap-rotate focus-within:ring-2 focus-within:ring-primary"
          title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          <input
            type="checkbox"
            checked={isDark}
            onChange={toggleTheme}
            aria-label="Toggle light and dark theme"
          />
          <SunIcon aria-hidden className="swap-on h-6 w-6 fill-current" />
          <MoonIcon aria-hidden className="swap-off h-6 w-6 fill-current" />
        </label>

        {/* Notification dropdown — CSS-only (focus-driven open/close). */}
        <div className="dropdown dropdown-end ml-4">
          <div
            tabIndex={0}
            role="button"
            aria-label={`Notifications, ${UNREAD_COUNT} unread`}
            className="btn btn-ghost btn-circle"
          >
            <div className="indicator">
              <BellIcon aria-hidden className="h-6 w-6" />
              {UNREAD_COUNT > 0 && (
                <span className="indicator-item badge badge-secondary badge-sm">{UNREAD_COUNT}</span>
              )}
            </div>
          </div>
          <div
            tabIndex={0}
            className="card dropdown-content z-30 mt-3 w-80 rounded-box bg-base-100 shadow"
          >
            <div className="card-body p-0">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-base font-semibold">Notifications</span>
                <span className="badge badge-secondary badge-sm">{UNREAD_COUNT} new</span>
              </div>
              <div className="divider my-0" />
              <ul aria-label="Notifications" className="max-h-72 space-y-2 overflow-y-auto px-3 pb-3">
                {NOTIFICATIONS.map((notification) => (
                  <li
                    key={notification.id}
                    className={`card rounded-box p-3 text-sm ${
                      notification.unread ? 'bg-primary/10' : 'bg-base-200'
                    }`}
                  >
                    {notification.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Profile dropdown. The trigger shows the SIGNED-IN user's real avatar when they
            have one, falling back to the icon placeholder otherwise — and because it reads
            `useAuth().user`, the `refresh()` the profile page fires after a successful
            avatar upload repaints it immediately, with no hard refresh and no new global
            store. daisyUI `avatar` structure per the skill: `.avatar > div > img`. The
            image is `alt=""` because the button already carries "Profile menu"; a duplicate
            name on the child would just be announced twice. */}
        <div className="dropdown dropdown-end ml-4">
          <div tabIndex={0} role="button" aria-label="Profile menu" className="btn btn-ghost btn-circle avatar">
            {user?.profilePictureUrl ? (
              <div className="h-10 w-10 rounded-full">
                <img
                  src={user.profilePictureUrl}
                  alt=""
                  className="h-full w-full rounded-full object-cover"
                />
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-base-300 text-base-content">
                <UserIcon aria-hidden className="h-6 w-6" />
              </div>
            )}
          </div>
          <ul
            tabIndex={0}
            className="menu dropdown-content menu-sm z-30 mt-3 w-52 rounded-box bg-base-100 p-2 shadow"
          >
            <li>
              {/* A real `<Link>`, not the template's inert button: this item NAVIGATES, so
                  it must be a link (middle-click, focus order, `role="link"`). It points at
                  the real page — the deleted `settings-profile` stub is a 404 by design.
                  The DashWind "New" badge is dropped: it was demo decoration and it
                  polluted the item's accessible name. */}
              <Link
                to={ADMIN_PORTAL_ROUTES.profile}
                className="cursor-pointer"
                onClick={closeMenus}
              >
                {PROFILE_STRINGS.navLabel}
              </Link>
            </li>
            <li>
              <button type="button" className="cursor-pointer" onClick={closeMenus}>
                Bill History
              </button>
            </li>
            <div className="divider mb-0 mt-0" />
            <li>
              <button
                type="button"
                className="cursor-pointer"
                onClick={async () => {
                  closeMenus()
                  await logout()
                  navigate(ADMIN_PORTAL_ROUTES.login)
                }}
              >
                Logout
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
