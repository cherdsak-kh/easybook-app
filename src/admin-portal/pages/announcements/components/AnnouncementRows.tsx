/**
 * One announcement as a list row (`#an-row-tpl`, prototype 6928–6954), its first-load skeleton, and
 * the empty box.
 *
 * ⚠️ THE ROW IS A STATIC <li>, NOT A BUTTON (plan D-3). In the prototype the whole row opens the
 * compose/edit dialog, which is phase 4. A focusable row that does nothing is worse than a plain one,
 * so there is no `tabIndex`, no handler and no hover until that dialog exists.
 *
 * ⚠️ NO OPEN-RATE ANYWHERE (plan D-4). The API has no such figure; the prototype's `เปิดอ่าน %` and
 * its bar are dropped, and "ส่งถึง" is reworded `ส่งออก` because `sentCount` is what LINE ACCEPTED,
 * not what was delivered.
 */

import { Skeleton, SkeletonRegion } from '../../../components/feedback/Skeleton'
import { Badge } from '../../../components/ui/Badge'
import { ANNOUNCEMENT_FORMAT, ANNOUNCEMENT_STATUS } from '../../../labels'
import type { Announcement } from '../announcements-api'
import { audienceLabel, whenLabel } from '../announcement-record'

/**
 * The audience pill — the prototype's `badge badge-sm badge-outline`, written as utilities.
 *
 * ⚠️ NOT `.badge` (design S-3): the portal's unlayered `[data-theme^="easybook-admin"] .badge` sets
 * `border-0`, which would erase the outline, and utilities cannot beat an unlayered rule. The
 * geometry matches the portal `.badge`; the border token is the one FeedbackPage's type chip uses.
 * `truncate` keeps a long department name inside the row at 390px.
 */
const AUDIENCE_PILL =
  'inline-block max-w-full truncate rounded-full border border-base-content/20 px-2.5 py-1 align-middle text-[13px] font-medium text-base-content/80'

/** The right-hand line, both states — one width, so the titles of SENT and DRAFT rows align. */
const TAIL = 'm-0 shrink-0 text-[13px] text-base-content/70 sm:w-44 sm:text-right'

export function AnnouncementRow({ item }: { item: Announcement }) {
  const status = ANNOUNCEMENT_STATUS[item.status]
  const audience = audienceLabel(item)

  return (
    <li className="flex flex-col gap-2 px-3 py-3.5 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {/* `wrap-anywhere`: a 100-character title with no spaces must break inside the row, not
            push it wider than a phone. Clamped to two lines, as the prototype. */}
        <p className="m-0 line-clamp-2 wrap-anywhere text-[15px] font-medium leading-[1.45] text-base-content">
          {item.title}
        </p>
        {/* status · audience · format — the prototype's order (design S-7). */}
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Badge tone={status.tone}>{status.label}</Badge>
          <span className={AUDIENCE_PILL} title={audience}>
            {audience}
          </span>
          <span className="badge badge-ghost">{ANNOUNCEMENT_FORMAT[item.format]}</span>
        </div>
        <p className="m-0 text-[13px] text-base-content/70">{whenLabel(item)}</p>
      </div>
      {/* A partial send's small number is rendered as it is — never hidden or restyled. */}
      {item.status === 'SENT' ? (
        <p className={TAIL}>
          ส่งออก{' '}
          <span className="font-medium tabular-nums text-base-content">
            {item.sentCount.toLocaleString('th-TH')}
          </span>{' '}
          คน
        </p>
      ) : (
        <p className={TAIL}>ยังไม่ได้ส่ง</p>
      )}
    </li>
  )
}

/** The skeleton's ragged bars, spelt out as literals so the class scanner generates every one. */
const SKELETON_BARS = [
  { a: 'w-3/5', b: 'w-2/5' },
  { a: 'w-4/5', b: 'w-1/3' },
  { a: 'w-1/2', b: 'w-2/5' },
  { a: 'w-2/3', b: 'w-1/3' },
  { a: 'w-3/5', b: 'w-2/5' },
] as const

/**
 * The first-load skeleton: five rows in the row's own shape — title, three pills, the date, and the
 * right-hand line from `sm` — so nothing jumps when the rows land. `aria-busy` and ONE announcement.
 * The pager's stand-in is rendered by the page, outside the card body, where the real pager goes.
 */
export function ListSkeleton() {
  return (
    <SkeletonRegion label="กำลังโหลดรายการประกาศ">
      <ul className="-mx-1 my-0 flex list-none flex-col divide-y divide-base-300 p-0" aria-hidden="true">
        {SKELETON_BARS.map(({ a, b }, i) => (
          <li
            key={i}
            className="flex flex-col gap-2 px-3 py-3.5 sm:flex-row sm:items-center sm:gap-4"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              {/* One title line is 15px × 1.45 ≈ 22px; the wrapper holds that height. */}
              <span className="flex h-5.5 items-center">
                <Skeleton className={`h-3.5 ${a}`} />
              </span>
              <span className="flex items-center gap-1.5">
                <Skeleton variant="box" className="h-6 w-16 rounded-full" />
                <Skeleton variant="box" className="h-6 w-16 rounded-full" />
                <Skeleton variant="box" className="h-6 w-16 rounded-full" />
              </span>
              <span className="flex h-5 items-center">
                <Skeleton variant="soft" className={`h-3 ${b}`} />
              </span>
            </span>
            {/* Wrapped, because `Skeleton` always carries `block` and two display utilities on one
                element resolve by generated-CSS order, which nothing here controls. */}
            <span className="hidden shrink-0 sm:block sm:w-44">
              <Skeleton variant="soft" className="ml-auto h-3 w-24" />
            </span>
          </li>
        ))}
      </ul>
    </SkeletonRegion>
  )
}

/**
 * The prototype's dashed box, verbatim. The same box serves an empty table (the pills then read
 * 0 / 0 / 0, which are real numbers) and a search that matched nothing.
 */
export function EmptyBox() {
  return (
    <p className="m-0 rounded-control border border-dashed border-base-300 px-4 py-10 text-center text-[14px] text-base-content/70">
      ไม่พบประกาศที่ตรงกับตัวกรอง
    </p>
  )
}
