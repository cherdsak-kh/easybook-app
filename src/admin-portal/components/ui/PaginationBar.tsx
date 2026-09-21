/**
 * แสดง x–y จากทั้งหมด z · « ‹ 1 2 3 › » · แถวต่อหน้า — the ONE pager bar under every admin list
 * (#ISSUE-12).
 *
 * ⚠️ LIFTED FROM คำขอจองสถานที่, NOT DESIGNED HERE. `BookingRequestsPage` had the only complete version —
 * the range summary, the windowed `Pagination long`, and a 44px page-size select — while การลงทะเบียน
 * and เจ้าหน้าที่ระบบ had a two-part bar with no size control, and สถานที่จัดกิจกรรม and the four
 * option screens had a count and no pager at all. The markup and every class below are that page's,
 * moved rather than retyped, so the five screens cannot drift apart again by being edited one at a
 * time.
 *
 * ── The three segments, and why the ORDER differs by width ──
 *   1. the summary  (`order-1`)
 *   2. the pager    (`order-3` below `lg`)
 *   3. the size     (`order-2` below `lg`)
 * On a phone the numbers are read first and the buttons are reached for last, and the reach should be
 * nearest the thumb — so the pager drops under the size select. From `lg` the bar is one row in
 * source order, `justify-between`.
 *
 * ⚠️ IT OWNS NO DATA. Server-paged screens (bookings, registrations, staff) pass `meta.total`;
 * client-paged ones (venues, the option tables) pass the length of the FILTERED array they slice.
 * Either way `total` is "what the filter matched", never "what the table holds" — a bar that counted
 * the unfiltered set would contradict the rows under it.
 *
 * ⚠️ THE CALLER CLAMPS `page`. When the total shrinks under the current page — a delete on the last
 * page, another operator's write — the screen must move back rather than render an empty page under a
 * pager that insists there are rows. The bar also clamps what it DISPLAYS, so the one render between
 * the shrink and the caller's correction never prints a range like "31–30".
 */

import type { ReactNode } from 'react'
import { Skeleton } from '../feedback/Skeleton'
import { Pagination } from './Pagination'

export interface PaginationBarProps {
  page: number
  pageSize: number
  total: number
  /** The counting word after the total — `รายการ`, `บัญชี`, `แห่ง`… Defaults to `รายการ`. */
  unit?: string
  /** Defaults to `[10, 20, 50]`. A `pageSize` outside the list is still offered, so it can show. */
  pageSizeOptions?: readonly number[]
  onPageChange: (page: number) => void
  /** The caller resets `page` to 1 — a new size makes the old page number mean different rows. */
  onPageSizeChange: (pageSize: number) => void
  /** The pager `<nav>`'s accessible name, e.g. `แบ่งหน้ารายการคำขอจอง`. */
  ariaLabel?: string
  className?: string
  /** Appended inside the summary line, after the unit — e.g. ` · รอพิจารณา 3 รายการ`. */
  extraSummary?: ReactNode
}

const DEFAULT_PAGE_SIZES: readonly number[] = [10, 20, 50]

const BAR = 'flex shrink-0 flex-col items-center gap-3 border-t border-base-300 p-4 lg:flex-row lg:justify-between lg:px-5'

export function PaginationBar({
  page,
  pageSize,
  total,
  unit = 'รายการ',
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  onPageChange,
  onPageSizeChange,
  ariaLabel,
  className = '',
  extraSummary,
}: PaginationBarProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(1, page), pages)
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1
  const to = Math.min(current * pageSize, total)
  const sizes = pageSizeOptions.includes(pageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, pageSize].sort((a, b) => a - b)

  return (
    <div className={`${BAR} ${className}`.trim()}>
      {/* The RANGE is what is on screen; the TOTAL is what the FILTER matched, not what the table
          holds. Printing the latter would have this bar contradict the rows above it. */}
      <p className="order-1 text-[14px] text-base-content/70 lg:order-none">
        แสดง{' '}
        <span className="font-medium text-base-content/90 tabular-nums">
          {total === 0 ? '0' : `${from}–${to}`}
        </span>{' '}
        จากทั้งหมด{' '}
        <span className="font-medium text-base-content/90 tabular-nums">{total}</span> {unit}
        {extraSummary}
      </p>

      {/* Order-3 on a phone so the numbers sit above the buttons: the summary is what you read, the
          buttons are what you reach for, and the reach should be nearest the thumb. */}
      {pages > 1 && (
        <div className="order-3 lg:order-none">
          <Pagination page={current} pages={pages} onGo={onPageChange} label={ariaLabel} long />
        </div>
      )}

      <label className="order-2 flex items-center gap-2 text-[14px] text-base-content/70 lg:order-none">
        <span className="shrink-0">แถวต่อหน้า</span>
        {/* A plain daisyUI `select`, NO shell and NO drawn caret. The old `.form-select` forced
            `appearance-none`, which is what made Chromium fall back to the square OS popup; daisyUI
            opts into `appearance: base-select` where it is supported, so the list opens as the
            rounded popover with a ✓ on the current size. ⛔ Do not add `appearance-none` back.
            ⚠️ `select-sm` is 32px (12px type): this control no longer carries the 44px floor that
            `.form-select`'s `min-h-11` gave it. Chosen on purpose in the 2026-09-21 select refactor;
            if the floor is reinstated, the skeleton below must change with it. */}
        <select
          aria-label="จำนวนแถวต่อหน้า"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="select select-sm w-20 tabular-nums"
        >
          {sizes.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

/**
 * The bar's stand-in while a list loads — same outer geometry and the same three segments in the
 * same responsive order, so the card does not change height when the real bar replaces it.
 *
 * ⚠️ IT ASSUMES A PAGER. Whether there is more than one page is unknown until the rows arrive, and
 * reserving the space is the cheaper mistake: a bar that shrinks on arrival moves nothing below the
 * card's bottom edge, one that grows pushes the page down under the cursor.
 */
export function PaginationBarSkeleton({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`${BAR} ${className}`.trim()}>
      <Skeleton className="order-1 h-3.5 lg:order-none" width="12rem" />
      <span className="order-3 flex items-center gap-1.5 lg:order-none">
        <Skeleton variant="box" className="h-11 w-20 rounded-control" />
        <Skeleton variant="box" className="h-11 w-11 rounded-control" />
        <Skeleton variant="box" className="h-11 w-11 rounded-control" />
        <Skeleton variant="box" className="h-11 w-20 rounded-control" />
      </span>
      <span className="order-2 flex items-center gap-2 lg:order-none">
        <Skeleton variant="soft" className="h-3.5" width="4.5rem" />
        {/* = the real `select select-sm w-20`: 32px × 80px. */}
        <Skeleton variant="box" className="h-8 w-20 rounded-control" />
      </span>
    </div>
  )
}
