/**
 * `คำขอชนเวลาตามประเภทสถานที่` — where ADR-001 bites, by kind of room (prototype ~L8004–8015,
 * `rv-tpl-type` ~L8120–8129, AC-V13). Derived from `venues[]`, no extra request.
 */

import type { ReportsVenues } from '@/lib/api-client'
import { typeClashRows } from '../report-venues-view'

export function VenueClashByType({ data }: { data: ReportsVenues }) {
  const rows = typeClashRows(data.venues)
  return (
    <section
      className="card border border-base-300 bg-base-100 shadow-sm xl:col-span-2"
      aria-labelledby="rv-type-h"
    >
      <div className="card-body">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="rv-type-h" className="card-title">
              คำขอชนเวลาตามประเภทสถานที่
            </h2>
            <p className="m-0 mt-0.5 text-[13px] text-base-content/70">
              สัดส่วนคำขอที่ถูกปฏิเสธอัตโนมัติเพราะเวลาชน
            </p>
          </div>
          <span className="badge badge-error badge-sm shrink-0">{data.requests.autoRejected} ครั้ง</span>
        </div>
        {rows.length === 0 ? (
          <p className="m-0 py-4 text-center text-[14px] text-base-content/70">ยังไม่มีคำขอในช่วงนี้</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
            {rows.map((t) => (
              <li key={t.typeName} className="min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="m-0 min-w-0 truncate text-[14px] font-medium text-base-content">{t.typeName}</p>
                  <p className="m-0 shrink-0 text-[13px] text-base-content/70 tabular-nums">
                    ชน {t.autoRejected} จาก {t.requests} ·{' '}
                    <b className="font-semibold text-error">{Math.round(t.rate * 100)}%</b>
                  </p>
                </div>
                <progress
                  className="progress progress-error mt-1.5"
                  value={Math.round(t.rate * 1000) / 10}
                  max={100}
                  aria-label={`อัตราคำขอชนเวลาของ${t.typeName} ${Math.round(t.rate * 100)}%`}
                />
                <p className="m-0 mt-1 truncate text-[12px] text-base-content/60">
                  {t.venues.length > 0 ? `ชนที่ ${t.venues.join(' · ')}` : 'ไม่มีคำขอที่ชนเวลา'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
