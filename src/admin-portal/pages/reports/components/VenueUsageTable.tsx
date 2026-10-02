/**
 * `อัตราการใช้งานรายสถานที่` — every venue, UNPAGINATED (nine rows are read side by side; page two
 * would hide the comparison). Prototype ~L7974–7999 and row template `rv-tpl-venue` ~L8093–8119
 * (AC-V12).
 *
 * `table rp-table` — the unlayered scoped rule in `admin-portal.css` (C-2) reproduces the
 * prototype's table geometry over daisyUI's. Below `sm` the hidden columns stack into one phone line
 * under the name, so nothing is behind a sideways scroll.
 */

import type { ReportsVenues } from '@/lib/api-client'
import { demandTier, hrs, pct1, venueName } from '../report-venues-view'

export function VenueUsageTable({ data }: { data: ReportsVenues }) {
  const rows = data.venues
  return (
    <section className="card mt-4 border border-base-300 bg-base-100 shadow-sm" aria-labelledby="rv-tbl-h">
      <div className="card-body gap-0 p-0 sm:p-0">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-base-300 p-4 sm:px-5">
          <div className="min-w-0">
            <h2 id="rv-tbl-h" className="card-title">
              อัตราการใช้งานรายสถานที่
            </h2>
            <p className="m-0 mt-0.5 text-[13px] text-base-content/70">
              เรียงจากอัตราการครองห้องสูงไปต่ำ · เทียบกับ {data.range.schoolDays} วันทำการ × 8 ชม. ต่อสถานที่
            </p>
          </div>
          <span className="badge badge-neutral badge-sm shrink-0 tabular-nums">{rows.length} สถานที่</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table rp-table">
            <thead>
              <tr>
                <th scope="col">สถานที่</th>
                <th scope="col" className="hidden text-right sm:table-cell">ชั่วโมงที่ใช้จริง</th>
                <th scope="col" className="w-[30%] sm:w-[24%]">อัตราการครองห้อง</th>
                <th scope="col" className="hidden text-right md:table-cell">การจองที่อนุมัติ</th>
                <th scope="col" className="hidden text-right sm:table-cell">คำขอชนเวลา</th>
                <th scope="col" className="hidden text-center sm:table-cell">สถานะความต้องการ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const tier = demandTier(r)
                const name = venueName(r)
                const hotClash = r.autoRejectedPercent != null && r.autoRejectedPercent >= 20 && r.requests >= 5
                return (
                  <tr key={r.venueId}>
                    <td>
                      <span className="block max-w-40 truncate font-medium sm:max-w-64" title={name}>
                        {name}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-base-content/70">
                        <span>{r.typeName}</span>
                        <span className="badge badge-ghost badge-sm whitespace-nowrap tabular-nums">
                          จุ {r.capacity.toLocaleString('en-US')} คน
                        </span>
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-base-content/70 tabular-nums sm:hidden">
                        <span>
                          {hrs(r.heldHours)} ชม. · อนุมัติ {r.approved} · ชน {r.autoRejected}
                        </span>
                        <span className={`badge badge-sm whitespace-nowrap ${tier.cls}`}>{tier.text}</span>
                      </span>
                    </td>
                    <td className="hidden text-right tabular-nums sm:table-cell">{hrs(r.heldHours)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        {/* Bar colour follows the tier, so the bar and the badge never argue. */}
                        <progress
                          className={`progress min-w-10 ${tier.high ? 'progress-warning' : 'progress-primary'}`}
                          value={Math.round((r.occupancyPercent ?? 0) * 10) / 10}
                          max={100}
                          aria-label={`อัตราการครองห้อง ${name} ${pct1(r.occupancyPercent)}`}
                        />
                        <span className="w-12 shrink-0 text-right text-[13px] font-semibold tabular-nums">
                          {pct1(r.occupancyPercent)}
                        </span>
                      </div>
                    </td>
                    <td className="hidden text-right tabular-nums md:table-cell">{r.approved}</td>
                    <td className="hidden text-right tabular-nums sm:table-cell">
                      <span className={hotClash ? 'text-error' : undefined}>{r.autoRejected}</span>
                      <span className="block text-[12px] text-base-content/60">
                        {r.requests > 0
                          ? `${Math.round(r.autoRejectedPercent ?? 0)}% ของ ${r.requests} คำขอ`
                          : 'ไม่มีคำขอ'}
                      </span>
                    </td>
                    <td className="hidden text-center sm:table-cell">
                      <span className={`badge badge-sm whitespace-nowrap ${tier.cls}`}>{tier.text}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
