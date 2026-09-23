/**
 * What the queue looks like while a page is in flight, at both widths.
 *
 * ⚠️ EIGHT CELLS, IN THE TABLE'S OWN ORDER. A skeleton with a different column count from the
 * table it stands in for makes every row jump sideways the moment the data lands, which is the one
 * thing a skeleton exists to prevent — it was wrong twice in the prototype, once at nine cells and
 * once at seven. The `th`s are the real ones, so the header does not resize either.
 *
 * ⚠️ THE PAGER BAR HAS A STAND-IN. It lives inside the list panel, so without one the card is ~71px
 * shorter while loading and everything below it jumps up and back down.
 *
 * Six rows, not ten: the prototype's number. It fills the card without pretending to predict how
 * many rows the filter will actually return — a ten-bar skeleton followed by three rows reads as
 * seven rows disappearing.
 */

import { Skeleton } from '../../../components/feedback/Skeleton'

/**
 * The six middle cells: ragged widths, so the block reads as text rather than as a grid of
 * identical bars.
 *
 * ⚠️ KEYED BY COLUMN, NOT BY WIDTH. `w-28` appears twice — รหัสคำขอ and ผู้ขอจอง happen to want the
 * same bar — and keying on the class string made React see two children with one key and warn. The
 * column ordinal is the identity here; the width is a property of it.
 */
const CELLS = [
  { col: 'code', w: 'w-28' },
  { col: 'submitted', w: 'w-16' },
  { col: 'requester', w: 'w-32' },
  { col: 'venue', w: 'w-28' },
  { col: 'when', w: 'w-24' },
  { col: 'status', w: 'w-20' },
] as const
const ROWS = [0, 1, 2, 3, 4, 5]

export function RequestsSkeleton({ actionsLabel }: { actionsLabel: string }) {
  return (
    <div className="card-shell" aria-busy="true">
      <span className="sr-only" role="status">
        กำลังโหลดรายการคำขอจอง
      </span>

      <div className="card-scroll nav-scroll">
        <div className="hidden lg:block" aria-hidden="true">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th scope="col" className="th-cell th-cell-tight w-14 text-center">
                  ลำดับ
                </th>
                <th scope="col" className="th-cell th-cell-tight whitespace-nowrap">
                  รหัสคำขอ
                </th>
                <th scope="col" className="th-cell th-cell-tight whitespace-nowrap">
                  วันที่ยื่น
                </th>
                <th scope="col" className="th-cell th-cell-tight">
                  ผู้ขอจอง
                </th>
                <th scope="col" className="th-cell th-cell-tight">
                  สถานที่
                </th>
                <th scope="col" className="th-cell th-cell-tight">
                  วัน-เวลาใช้งาน
                </th>
                <th scope="col" className="th-cell th-cell-tight text-center">
                  สถานะ
                </th>
                <th scope="col" data-col="actions" className="th-cell th-cell-tight text-center">
                  {actionsLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((i) => (
                <tr key={i} className="border-b border-base-300/60">
                  <td className="td-cell td-cell-tight">
                    <Skeleton className="mx-auto h-3.5 w-4" />
                  </td>
                  {CELLS.map((c) => (
                    <td key={c.col} className="td-cell td-cell-tight">
                      <Skeleton className={`h-3.5 ${c.w}`} />
                    </td>
                  ))}
                  <td className="td-cell td-cell-tight">
                    {/* 36px, matching the `icon-btn` that replaces it — a skeleton 8px shorter than
                        its real content is a skeleton that jumps. */}
                    <Skeleton className="mx-auto h-9 w-9" variant="box" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="m-0 list-none divide-y divide-base-300/60 p-0 lg:hidden" aria-hidden="true">
          {ROWS.map((i) => (
            <li key={i} className="p-4">
              <span className="flex flex-col gap-2">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-40" variant="soft" />
                <Skeleton className="h-3 w-28" variant="soft" />
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div
        className="flex shrink-0 flex-col items-center justify-between gap-3 border-t border-base-300 p-4 sm:flex-row lg:px-5"
        aria-hidden="true"
      >
        <Skeleton className="h-3.5 w-40" variant="soft" />
        <Skeleton className="h-3.5 w-28" variant="soft" />
      </div>
    </div>
  )
}
