/**
 * `5 สถานที่ที่ใช้งานมากที่สุด` — prototype `[data-route="reports-overview"]` ~L7568–7577.
 *
 * `data.venues` is already ranked by held hours desc, then name (design §2.5) and may hold MORE
 * than 5 rows (the full list backs AC-R11's Σ = occupancy.heldHours check) — this component takes
 * the first 5, per AC-R11's own wording ("the client shows the first 5").
 */

import type { ReportVenueUsage } from '@/lib/api-client'
import { pct1 } from '../report-presets'

export function ReportTopVenues({ venues }: { venues: ReportVenueUsage[] }) {
  const top = venues.slice(0, 5)
  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm" aria-labelledby="rp-top-h">
      <div className="card-body">
        <div>
          <h2 id="rp-top-h" className="card-title">
            5 สถานที่ที่ใช้งานมากที่สุด
          </h2>
          <p className="m-0 mt-0.5 text-[13px] text-base-content/70">
            เรียงตามชั่วโมงที่ถูกจองจริง · แถบคืออัตราการใช้ของห้องนั้น
          </p>
        </div>
        {top.length === 0 ? (
          <p className="m-0 py-4 text-center text-[14px] text-base-content/70">ยังไม่มีการใช้สถานที่ในช่วงนี้</p>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-3.5 p-0">
            {top.map((v) => {
              const name = v.name + (v.isDeleted ? ' (ลบแล้ว)' : '')
              return (
                <li key={v.venueId}>
                  <div className="flex items-center justify-between gap-2 text-[14px]">
                    <span className="min-w-0 truncate font-medium text-base-content">
                      {v.rank}. {name}
                    </span>
                    <span className="shrink-0 text-base-content/70 tabular-nums">
                      {Math.round(v.heldHours * 10) / 10} ชม. · {pct1(v.sharePercent)}
                    </span>
                  </div>
                  <progress
                    className="progress progress-primary mt-1.5 h-1.5"
                    max={100}
                    value={Math.round(v.sharePercent * 10) / 10}
                    aria-label={`อัตราการใช้ ${name} ${pct1(v.sharePercent)}`}
                  />
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </section>
  )
}
