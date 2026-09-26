/**
 * The first-load skeleton — the prototype's `data-panel="loading"` (6308–6384).
 *
 * It mirrors the REAL row's geometry — the 36px checkbox column, the 40px tile, three text lines and
 * a 44px control block — so the card does not resize the moment data lands. The selection bar and
 * the pager are stood in for too: they are `shrink-0` rows above and below the list, and leaving them
 * out would let the list start 48px higher and jump down on arrival.
 *
 * ⚠️ THE FIVE ROWS ARE SPELT OUT, not mapped from an array of width classes built at runtime:
 * Tailwind's scanner reads source text, and a width class that only exists inside a joined string can
 * come out ungenerated — silently, in the one place nobody looks at for more than a second. The
 * literals below are all whole class names, which the scanner does read.
 */

import { Skeleton } from '../../../components/feedback/Skeleton'
import { PaginationBarSkeleton } from '../../../components/ui/PaginationBar'

const ROWS = [
  { a: 'w-3/5', b: 'w-4/5', c: 'w-2/5' },
  { a: 'w-4/5', b: 'w-3/5', c: 'w-1/3' },
  { a: 'w-1/2', b: 'w-full', c: 'w-2/5' },
  { a: 'w-2/3', b: 'w-3/4', c: 'w-1/3' },
  { a: 'w-3/4', b: 'w-1/2', c: 'w-2/5' },
] as const

export function NotificationsSkeleton() {
  return (
    <div className="card-shell" aria-busy="true">
      <span className="sr-only" role="status">
        กำลังโหลดรายการแจ้งเตือน
      </span>
      <div className="nt-selbar" aria-hidden="true">
        <Skeleton variant="box" className="h-5 w-5 shrink-0 rounded-[6px]" />
        <Skeleton variant="soft" className="h-3.5 w-40" />
      </div>
      <div className="card-scroll nav-scroll">
        <ul className="m-0 list-none divide-y divide-base-300/60 p-0" aria-hidden="true">
          {ROWS.map(({ a, b, c }) => (
            <li
              key={`${a}-${b}-${c}`}
              className="flex items-start gap-2 px-2.5 py-3.5 sm:gap-3 sm:px-4 lg:px-5"
            >
              <Skeleton variant="box" className="mt-0.5 h-5 w-5 shrink-0 rounded-[6px]" />
              <Skeleton variant="box" className="h-10 w-10 shrink-0" />
              <span className="min-w-0 flex-1">
                <Skeleton className={`h-3.5 ${a}`} />
                <Skeleton variant="soft" className={`mt-2.5 h-3 ${b}`} />
                <Skeleton variant="soft" className={`mt-2.5 h-2.5 ${c}`} />
              </span>
              {/* Wrapped, because `Skeleton` always carries `block`, and two display utilities on one
                  element resolve by generated-CSS order, which nothing here controls. */}
              <span className="hidden shrink-0 sm:block">
                <Skeleton variant="box" className="h-11 w-28" />
              </span>
            </li>
          ))}
        </ul>
      </div>
      <PaginationBarSkeleton />
    </div>
  )
}
