/**
 * `ข้อเสนอแนะเพื่อลดจุดคอขวด` — up to three sentences built from the numbers above (prototype
 * ~L8017–8025, `rv-tpl-rec` ~L8130–8138, AC-V13). All copy is the prototype's; the alternatives in
 * recommendation 1 are SAME-TYPE only (D-18). See `recommendations()` in `report-venues-view.ts`.
 */

import type { ReportsVenues } from '@/lib/api-client'
import { recommendations, type RecommendationIcon } from '../report-venues-view'

const ICON: Record<RecommendationIcon, string> = {
  move: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
  clock: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  space:
    'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21',
  ok: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
}

export function VenueRecommendations({ data }: { data: ReportsVenues }) {
  const recs = recommendations(data)
  return (
    <section
      className="card border border-base-300 bg-base-100 shadow-sm xl:col-span-3"
      aria-labelledby="rv-rec-h"
    >
      <div className="card-body">
        <div>
          <h2 id="rv-rec-h" className="card-title">
            ข้อเสนอแนะเพื่อลดจุดคอขวด
          </h2>
          <p className="m-0 mt-0.5 text-[13px] text-base-content/70">
            สร้างจากตัวเลขในช่วงเวลาที่เลือก · สำหรับผู้บริหารพิจารณา
          </p>
        </div>
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {recs.map((r) => (
            <li key={r.key} className="flex items-start gap-3 rounded-control bg-base-200 p-3.5">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-base-100 ${r.tone}`}
              >
                <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={ICON[r.icon]} />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="m-0 text-[13px] font-medium text-base-content/70">{r.key}</p>
                <p className="m-0 mt-0.5 text-[14px] leading-[1.6] text-base-content">{r.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
