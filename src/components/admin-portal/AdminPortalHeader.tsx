// Ported from DashWind (daisyui-admin-dashboard-template) — MIT (c) 2022 Dashwind. See THIRD_PARTY_NOTICES.md
// Interactive WITHOUT Redux/`theme-change`: the theme dropdown drives `AdminPortalThemeLayout`'s
// preference via context, and the bell panel is a CSS-only daisyUI dropdown (focus-driven
// open/close — deliberately no document listeners).
import { Link, useNavigate } from 'react-router-dom'
import Bars3Icon from '@heroicons/react/24/outline/Bars3Icon'
import BellIcon from '@heroicons/react/24/outline/BellIcon'
import UserIcon from '@heroicons/react/24/outline/UserIcon'
import { ADMIN_PORTAL_ROUTES } from './routes'
import { ADMIN_PORTAL_DRAWER_ID } from './nav-config'
import { AdminPortalThemeMenu, NAVBAR_ICON_BUTTON_CLASS } from './AdminPortalThemeMenu'
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
 * Replica top bar (daisyUI `navbar`): a mobile drawer toggle, a 3-option theme dropdown
 * (สว่าง / มืด / ตามระบบ — see `AdminPortalThemeMenu`), a notification dropdown and a
 * profile dropdown. The hamburger is a `<label htmlFor>` bound to the drawer checkbox.
 * "Logout" tears down the real cookie session via `useAuth().logout` before navigating
 * back to the replica login.
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
  const { logout, user } = useAuth()

  return (
    <div className="navbar sticky top-0 z-20 bg-base-100 shadow-md">
      <div className="flex-1">
        {/* Ghost, not `btn-primary` (PO review): the drawer toggle is navigation chrome,
            not the page's primary action, so it sits transparent on the navbar and only
            picks up daisyUI's neutral `base-200`-derived overlay on hover. It shares
            `NAVBAR_ICON_BUTTON_CLASS` with the theme trigger — including the 44px tap
            floor and the `base-content` focus ring — so the two icon controls in this bar
            cannot drift apart. */}
        <label
          htmlFor={ADMIN_PORTAL_DRAWER_ID}
          aria-label="Open menu"
          className={`${NAVBAR_ICON_BUTTON_CLASS} drawer-button lg:hidden`}
        >
          <Bars3Icon aria-hidden className="h-6 w-6" />
        </label>
      </div>

      <div className="flex-none">
        {/* 3-option theme preference dropdown (persisted; `system` tracks the OS live). */}
        <AdminPortalThemeMenu />

        {/* Notification dropdown — CSS-only (focus-driven open/close). */}
        <div className="dropdown dropdown-end ml-4">
          <div
            tabIndex={0}
            role="button"
            aria-label={`Notifications, ${UNREAD_COUNT} unread`}
            // `btn-circle` is 40x40 (`--size-field * 10`). `min-h-11 min-w-11` lifts it to
            // the same 44px tap floor the hamburger and theme trigger now meet — tap target
            // ONLY: the ghost-circle appearance, the badge and the panel are untouched.
            className="btn btn-ghost btn-circle min-h-11 min-w-11"
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
          {/* Same 44px tap floor as the bell — appearance and contents unchanged. */}
          <div
            tabIndex={0}
            role="button"
            aria-label="Profile menu"
            className="btn btn-ghost btn-circle avatar min-h-11 min-w-11"
          >
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
