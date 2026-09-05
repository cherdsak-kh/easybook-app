/**
 * The five status tabs, with their counts.
 *
 * ⚠️ A `tablist`, NOT five toggle buttons. The five sets are mutually exclusive and `aria-selected`
 * says so; five independent `aria-pressed` buttons would claim they can be on at once. Same
 * reasoning as the ขนาดการ์ด radiogroup on สถานที่จัดกิจกรรม.
 *
 * ⚠️ `ทั้งหมด` LEADS AND `รอพิจารณา` IS STILL WHERE THE SCREEN OPENS. Reading order and default
 * state are different questions (PO): the strip runs superset → subsets, which is how a filter row
 * is read, while the page's initial `status` is `PENDING`, because the queue is the job. This
 * component renders the order; the page owns the default.
 *
 * ── 🔴 THE CENTRING TRAP, measured at 375px ──
 * `mx-auto` on the INNER TRACK, never `justify-center` on the scroller. The strip needs 420px in a
 * 333px box; centring the scroller itself pushed `ทั้งหมด` 87px past the left edge, and `scrollLeft`
 * cannot go below 0 — so the FIRST TAB WAS PERMANENTLY UNREACHABLE ON A PHONE. An auto margin
 * resolves to 0 when there is no free space, so one declaration centres on a desktop and
 * left-aligns-and-scrolls on a phone. Do not "simplify" this into `justify-center`.
 *
 * ── The counts ──
 * ⚠️ THEY DO NOT CHANGE WHEN A TAB IS SELECTED, and that is the server's decision, not a caching
 * bug: `counts` is computed with `search` and `venueId` applied but WITHOUT `status`. One fact,
 * rendered once. Nothing here recounts the page it is holding.
 *
 * ⚠️ THE PILLS ARE OPAQUE FILLS (`.rq-tab-n-*`), not `/15` washes. A pill on the selected tab sits
 * on that tab's own `bg-primary/10`, which sits on base-100 — three translucent layers — and the
 * amber wash measured 4.44:1 that way. The full reasoning is on the CSS rules.
 */

import type { BookingStatus } from '@/lib/api-client'
import { BOOKING_STATUS_LABEL } from '../../../labels'

/** `null` is the ทั้งหมด tab — "no `status` on the query", which is not a value the enum has. */
export type StatusTab = BookingStatus | null

/**
 * The strip, in reading order, each with the count key it displays and its pill hue.
 *
 * ⚠️ THE HUES MATCH `BOOKING_STATUS_TONE`, and they have to: a count pill that says ปฏิเสธ in sky
 * must name the same set as the sky badge in the สถานะ column, or the strip is describing a table
 * it does not match. ทั้งหมด is neutral because it is not a status.
 */
const TABS: {
  key: StatusTab
  label: string
  count: 'all' | 'pending' | 'approved' | 'rejected' | 'cancelled'
  pill: string
}[] = [
  { key: null, label: 'ทั้งหมด', count: 'all', pill: 'rq-tab-n-slate' },
  { key: 'PENDING', label: BOOKING_STATUS_LABEL.PENDING, count: 'pending', pill: 'rq-tab-n-amber' },
  {
    key: 'APPROVED',
    label: BOOKING_STATUS_LABEL.APPROVED,
    count: 'approved',
    pill: 'rq-tab-n-emerald',
  },
  { key: 'REJECTED', label: BOOKING_STATUS_LABEL.REJECTED, count: 'rejected', pill: 'rq-tab-n-sky' },
  {
    key: 'CANCELLED',
    label: BOOKING_STATUS_LABEL.CANCELLED,
    count: 'cancelled',
    pill: 'rq-tab-n-rose',
  },
]

export function RequestStatusTabs({
  active,
  counts,
  onSelect,
}: {
  active: StatusTab
  /** `null` while the first page is loading — the pills render `—` rather than a stale or fake 0. */
  counts: Record<'all' | 'pending' | 'approved' | 'rejected' | 'cancelled', number> | null
  onSelect: (tab: StatusTab) => void
}) {
  return (
    <div className="shrink-0 border-b border-base-300 px-2 pt-2 sm:px-3 lg:px-4">
      <div className="nav-scroll flex overflow-x-auto pb-2">
        {/* 🔴 The inner track. See the header — this `mx-auto w-max` pair is the whole fix. */}
        <div
          role="tablist"
          aria-label="กรองตามสถานะคำขอ"
          className="mx-auto flex w-max items-center gap-1"
        >
          {TABS.map((t) => (
            <button
              key={t.count}
              type="button"
              role="tab"
              aria-selected={t.key === active}
              onClick={() => onSelect(t.key)}
              className="rq-tab"
            >
              <span>{t.label}</span>
              {/* The number is inside the tab's accessible name by being inside the button, so
                  "รอพิจารณา 7" announces as one control rather than as a label and a stray digit. */}
              <span className={`rq-tab-n ${t.pill}`}>{counts ? counts[t.count] : '—'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
