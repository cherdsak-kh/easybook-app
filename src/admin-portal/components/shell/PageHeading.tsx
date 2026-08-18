/**
 * The heading block every in-shell page opens with: breadcrumb → `<h1>` → subtitle.
 *
 * One component reading the route table, never forked per page. `group` feeds the breadcrumb
 * parent and `desc` feeds the subtitle, so a page cannot drift from the menu it is reached from.
 *
 * The breadcrumb hides below `sm` and disappears entirely for a top-level destination. A
 * one-item trail would just repeat the `<h1>` in a smaller font, and the group is the ONLY
 * parent — `การตั้งค่าระบบ` is the `<details>` summary, not the "การตั้งค่า" header above it, so
 * it is one crumb and not two saying the same word twice.
 *
 * ⚠️ The parent crumb is TEXT, not a link. A section heading names a group of destinations; it
 * is not a destination itself, and there is nothing to navigate to. Making it look clickable
 * promises a page that does not exist.
 */

import type { AdminRoute } from '../../routes'

export function PageHeading({
  route,
  desc,
  descAtEveryWidth = false,
}: {
  route: AdminRoute
  /**
   * The page's OWN subtitle, replacing the route table's.
   *
   * ⚠️ THE TWO ARE NOT THE SAME SENTENCE, and the prototype is consistent about which goes where:
   * the table's `desc` answers "what is behind this menu row" and appears in the menu, in the
   * coming-soon stand-in and on the table pages (การลงทะเบียน, ตัวเลือกบุคลากร). A DESIGNED page
   * writes its own, addressed to somebody who has already arrived — โปรไฟล์ says
   * "ข้อมูลบัญชีของคุณ และการตั้งค่าที่คุณปรับเองได้" where the menu says
   * "ดูและแก้ไขข้อมูลส่วนตัวของบัญชีคุณ". The first port had no way to say that, so
   * ข้อมูลเวอร์ชันระบบ shipped wearing its menu tooltip.
   *
   * Passing one also makes it visible at every width — see below.
   */
  desc?: string
  /**
   * Keep the subtitle visible on a phone.
   *
   * A TABLE page hides it below `sm`: the table underneath explains the page by being it, and the
   * line is a nicety worth the vertical space only on a wide screen. Everything else keeps it —
   * the coming-soon stand-in because it has no such content at all, and a designed page because
   * the sentence it wrote for itself is part of the design rather than a repeat of the menu.
   * That second case is implied by `desc` rather than asked for twice.
   */
  descAtEveryWidth?: boolean
}) {
  const subtitle = desc ?? route.desc
  const always = descAtEveryWidth || desc !== undefined
  return (
    <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-1 lg:mb-4">
      <div className="min-w-0">
        {route.group && (
          <nav
            aria-label="เส้นทางปัจจุบัน"
            className="mb-3 hidden items-center gap-1 text-[13px] sm:flex"
          >
            <span className="-ml-1.5 px-1.5 py-1 text-base-content/70">{route.group}</span>
            <svg
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0 text-base-content/60"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" d="M9 5l7 7-7 7" />
            </svg>
            <span aria-current="page" className="px-1.5 py-1 font-medium text-base-content/90">
              {route.label}
            </span>
          </nav>
        )}

        <h1 className="text-[18px] font-semibold text-base-content th-tight sm:text-[22px]">
          {route.label}
        </h1>

        <p
          className={`mt-1 text-[14px] text-base-content/70 th-tight ${
            always ? '' : 'hidden sm:block'
          }`.trim()}
        >
          {subtitle}
        </p>
      </div>
    </div>
  )
}
