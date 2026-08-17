/**
 * The sidebar: brand, menu, and the identity card that doubles as the account menu.
 *
 * ⚠️ THE MENU HOLDS 25 OF THE 31 DESTINATIONS, AND THAT IS THE DESIGN, not an omission.
 *  · `บัญชีผู้ใช้งาน`'s five leaves live in the account menu at the bottom of this column.
 *    They are the only screens scoped to *the signed-in person* rather than to the system, so
 *    they belong to the identity control and not to the site nav.
 *  · `ดูการแจ้งเตือนทั้งหมด` is reached from the notification panel (P2-B2), for the same
 *    reason: it is the "see all" of that panel, not a place you set out for.
 *
 * `SIDEBAR_SECTIONS` below is the only place that knows this, and it is presentation — the
 * route table stays a flat list of destinations and does not learn where the chrome puts them.
 *
 * The drawer is a checkbox + `peer-checked`, exactly as the prototype measured it, rather than
 * a JS-positioned panel: the transform, the scrim and the `lg:` reset are all CSS, so nothing
 * can leave the sidebar half-open in a state React has to recover from. React only owns
 * *whether* the box is checked — which is what lets a navigation close it.
 */

import { Link, useLocation } from 'react-router-dom'
import { NavGroup, NavRow, NavSection } from './NavRow'
import { NavIcon } from './nav-icons'
import { ROLE_LABEL, type SystemRole } from '../../labels'
import { usePopupMenu } from '../../lib/use-popup-menu'
import type { Acl } from '../../lib/use-acl'
import {
  ADMIN_PORTAL_ROUTES,
  urlOf,
  type AdminRouteEntry,
  type AdminRouteLabel,
} from '../../routes'

/**
 * How the flat route table is arranged in the column.
 *
 * `heading` is the section label above the rows; `fold` turns the section into a `<details>`
 * disclosure under that summary.
 *
 * ⚠️ `การตั้งค่า` (heading) and `การตั้งค่าระบบ` (fold summary) are DIFFERENT STRINGS on
 * purpose. The breadcrumb parent is the summary — one crumb, not two, because "การตั้งค่า >
 * การตั้งค่าระบบ" says the same word twice — which is why `group` in the route table is the
 * summary and the heading exists only here.
 *
 * The settings leaves are folded because 13 of them were 40% of v1's scroll height while being
 * the least-visited screens in the product.
 */
const SIDEBAR_SECTIONS: readonly {
  heading: string | null
  group: string
  fold?: AdminRouteLabel | 'การตั้งค่าระบบ'
}[] = [
  { heading: null, group: '' },
  { heading: 'การบริหารจัดการ', group: 'การบริหารจัดการ' },
  { heading: 'รายงานและสถิติ', group: 'รายงานและสถิติ' },
  { heading: 'การตั้งค่า', group: 'การตั้งค่าระบบ', fold: 'การตั้งค่าระบบ' },
  { heading: 'ช่วยเหลือ', group: 'ช่วยเหลือ' },
]

/**
 * Counts that mean "somebody is waiting", painted as attention rather than information.
 *
 * A calendar's 12 bookings is a fact; 3 unanswered requests is a queue. Toning them the same
 * would make the amber stop meaning anything.
 */
const ALERT_COUNT_LABELS: readonly AdminRouteLabel[] = [
  'คำขอจองสถานที่',
  'การลงทะเบียน',
]

/** The five personal destinations, in the order the prototype lists them. */
const ACCOUNT_LABELS: readonly AdminRouteLabel[] = [
  'โปรไฟล์',
  'เปลี่ยนรหัสผ่าน',
  'ตั้งค่าการแจ้งเตือน',
  'ความเป็นส่วนตัว',
  'ประวัติการเข้าสู่ระบบ',
]

export interface SidebarUser {
  name: string
  role: SystemRole
  avatarUrl: string | null
}

const rowsOf = (group: string): AdminRouteEntry[] =>
  ADMIN_PORTAL_ROUTES.filter((r) => r.group === group)

export function Sidebar({
  me,
  acl,
  counts = {},
  drawerOpen,
  onDrawerChange,
  onLogout,
}: {
  me: SidebarUser
  acl: Acl
  /** Pending counts by label. Absent or `0` renders no pill at all. */
  counts?: Partial<Record<AdminRouteLabel, number>>
  drawerOpen: boolean
  onDrawerChange: (open: boolean) => void
  onLogout: () => void
}) {
  const { pathname } = useLocation()
  const account = usePopupMenu()

  const isActive = (route: AdminRouteEntry) => pathname === urlOf(route)
  const closeDrawer = () => onDrawerChange(false)

  const row = (route: AdminRouteEntry, sub = false) => (
    <NavRow
      key={route.path}
      to={urlOf(route)}
      label={route.label}
      icon={sub ? undefined : <NavIcon label={route.label} />}
      sub={sub}
      active={isActive(route)}
      count={counts[route.label]}
      alert={ALERT_COUNT_LABELS.includes(route.label)}
      // Navigating on a phone must close the drawer, or the destination is rendered behind the
      // menu that was covering it and nothing appears to have happened.
      onSelect={closeDrawer}
    />
  )

  return (
    <>
      {/* The drawer's state. `sr-only`, not `hidden`: a hidden input cannot be checked. */}
      <input
        id="nav-toggle"
        type="checkbox"
        className="peer sr-only"
        checked={drawerOpen}
        onChange={(e) => onDrawerChange(e.target.checked)}
        aria-label="เปิด/ปิดเมนู"
      />

      {/* Scrim. `lg:!hidden` because `peer-checked:block` would otherwise keep it painted over
          the desktop layout the moment the box is checked on a narrow window and then widened. */}
      <label
        htmlFor="nav-toggle"
        aria-hidden="true"
        className="fixed inset-0 z-30 hidden bg-[rgb(2_6_23_/_0.5)] backdrop-blur-[2px] peer-checked:block lg:!hidden"
      />

      {/* ⚠️ NO `peer-checked:translate-x-0` HERE, deliberately. What slides this open is the
          `body:has(#nav-toggle:checked) aside { translate: 0 }` rule in `admin-portal.css`,
          ported with the rest of the prototype's CSS — where its comment records why the peer
          variant could not do the job and why the property must be `translate` and not
          `transform`. Adding the class back would put two mechanisms on one property, and the
          one that loses is the one nobody notices until they disagree.

          The scrim keeps `peer-checked:block`: it IS a sibling of the checkbox, that variant
          works, and rewriting a working rule to match another one's fix is pure ceremony. */}
      <aside
        className="fixed inset-y-0 left-0 z-40 flex w-[288px] -translate-x-full flex-col bg-base-100 transition-transform duration-300
                   lg:static lg:m-4 lg:translate-x-0 lg:rounded-card lg:border lg:border-base-300/70 lg:shadow-e1"
      >
        {/* ═══ Brand ═══
            The real mark carries its own fixed colours and MUST keep them in both themes — a
            logo that recolours with the theme is not a logo. This is the documented exception
            to "semantic tokens only", and it works because the file is `-no-bg`.

            `pt-5 pb-8`, never `py-8`: the crowding is entirely below (the brand's bottom edge
            and the first row's top edge were touching at 0px), while the top half only pushes
            the logo's centre out of line with the topbar's search field — measured 6px at
            `py-5`, 18px at `py-8`.

            `px-6` matches nav `px-3` + row `px-3`, so the logo sits on the same leading edge as
            every icon under it. */}
        <div className="flex shrink-0 items-center gap-3 px-6 pb-8 pt-5">
          <img
            src="/logo/easybook-logo-512px-no-bg.svg"
            alt="โลโก้ EasyBook"
            width={40}
            height={40}
            className="h-10 w-10 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[18px] font-semibold leading-tight tracking-wide text-base-content">
              EasyBook
            </p>
            {/* The SHORT wording. Measured at 12px Kanit the full name is 290px against a 196px
                column, so it wraps to three lines in the one piece of chrome on screen every
                second of every session. The boot screen states it in full. */}
            <p className="m-0 mt-0.5 text-[12px] leading-snug text-base-content/70 th-tight">
              ระบบจองสถานที่จัดกิจกรรม
            </p>
          </div>
          <label
            htmlFor="nav-toggle"
            aria-label="ปิดเมนู"
            data-tip="ปิดเมนู"
            data-tip-pos="bottom"
            className="-mr-2 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-control text-base-content/60 hover:bg-base-content/10 lg:hidden"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </label>
        </div>

        <nav
          className="nav-scroll nav-mask min-h-0 flex-1 overflow-y-auto px-3 pb-2"
          aria-label="เมนูหลัก"
        >
          {SIDEBAR_SECTIONS.map((section) => {
            // ⚠️ The ACL filters the ROWS, and a section whose rows are all denied renders
            // nothing at all — heading included. A bare heading over empty space is the menu
            // announcing a category the account cannot reach, which is worse than the rows it
            // was hiding.
            const visible = rowsOf(section.group).filter((r) => acl.can(r.label))
            if (visible.length === 0) return null

            return (
              <div
                key={section.group || 'top'}
                // ⚠️ 2px more under ภาพรวมระบบ, and it is the prototype's `mb-1` on that row
                // rather than a nicety: it is the ONE row with no section heading above it, so
                // without the extra step it reads as the first item of การบริหารจัดการ instead
                // of as the menu's own home. Every row below sat 2px high until this was found —
                // which is how it was found, by diffing the two sidebars' row positions.
                //
                // ⚠️ PADDING, NOT MARGIN. `mb-0.5` here measured 2px, not 4: with no padding or
                // border on this wrapper the row's own bottom margin COLLAPSES through it and the
                // two 2px margins become one. Padding does not collapse, so it actually adds.
                className={section.heading === null ? 'pb-0.5' : undefined}
              >
                {section.heading && <NavSection>{section.heading}</NavSection>}
                {section.fold ? (
                  <NavGroup
                    icon={<NavIcon label={section.fold} />}
                    label={section.fold}
                    // Open when you are standing inside it — otherwise the active row is
                    // invisible and the sidebar looks like it is pointing at nothing.
                    defaultOpen={visible.some(isActive)}
                  >
                    {visible.map((r) => row(r, true))}
                  </NavGroup>
                ) : (
                  visible.map((r) => row(r))
                )}
              </div>
            )
          })}
        </nav>

        {/* ═══ Identity card — pinned, never scrolls away ═══
            A real <button> carrying aria-expanded + aria-controls, NOT <details>/<summary>,
            which can carry neither. The panel opens UPWARD because the card is pinned to the
            bottom of the viewport and a downward menu would be off-screen. */}
        <div className="relative shrink-0 p-3">
          <div
            {...account.menuProps}
            className="absolute bottom-full left-3 right-3 z-50 mb-1 overflow-hidden rounded-card border border-base-300 bg-base-100 p-1.5 shadow-e2"
          >
            <p className="px-2.5 pb-1.5 pt-1 text-[12px] font-semibold text-base-content/60">
              บัญชีผู้ใช้งาน
            </p>
            {ACCOUNT_LABELS.map((label) => {
              const route = ADMIN_PORTAL_ROUTES.find((r) => r.label === label)!
              return (
                <Link key={label} to={urlOf(route)} className="menu-item" onClick={closeDrawer}>
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

          <button
            type="button"
            {...account.triggerProps}
            className="flex w-full items-center gap-3 rounded-control border border-base-300 bg-base-200 p-2.5 text-left transition-colors hover:bg-base-content/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-expanded:border-primary/40 aria-expanded:bg-primary/10"
          >
            <img
              src={me.avatarUrl ?? '/logo/easybook-logo-512px-no-bg.svg'}
              alt=""
              className="h-10 w-10 shrink-0 rounded-control border border-base-300 bg-base-100 object-cover"
            />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[14px] font-semibold text-base-content/90">
                {me.name}
              </span>
              {/* The signed-in role, from ONE place. It was a hardcoded string in an early
                  prototype pass, so the sidebar kept claiming ผู้ดูแลระบบสูงสุด while the
                  profile page said something else — on the one control that is on screen at
                  all times. */}
              <span className="truncate text-[12px] text-base-content/70">
                {ROLE_LABEL[me.role]}
              </span>
            </span>
            <svg
              aria-hidden="true"
              className={`ml-auto h-4 w-4 shrink-0 text-base-content/60 transition-transform ${
                account.open ? 'rotate-180' : ''
              }`.trim()}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" d="M18 15l-6-6-6 6" />
            </svg>
          </button>
        </div>
      </aside>
    </>
  )
}
