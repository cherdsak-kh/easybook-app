/**
 * `วัตถุประสงค์การใช้พื้นที่` — share of used hours by purpose (prototype ~L8304–8312, `ro-tpl-bar`
 * ~L8464–8471, AC-O9).
 *
 * ⚠️ THE CATEGORIES ARE A KEYWORD GUESS over free text (D-22, R-3): the schema has no purpose
 * category, so the server classifies the purpose text. The footnote is the only mitigation and must
 * stay. One colour for all bars — each carries its own label, and this theme has no `secondary` /
 * `accent` tokens (those classes would paint daisyUI's default pink and purple).
 */

import type { ReportsOperations } from '@/lib/api-client'
import { PURPOSE_CATEGORY_LABEL } from '../../../labels'
import { hrs, pct1 } from '../report-operations-view'

export function PurposeBars({ data }: { data: ReportsOperations }) {
  // The four real categories always show; OTHER only when it has anything (DV-3: hours count too,
  // or a series attributed outside the range could hide hours and break the visible total).
  const rows = data.purposes.filter((p) => p.category !== 'OTHER' || p.requests > 0 || p.heldHours > 0)
  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm" aria-labelledby="ro-pur-h">
      <div className="card-body">
        <div>
          <h2 id="ro-pur-h" className="card-title">
            วัตถุประสงค์การใช้พื้นที่
          </h2>
          <p className="m-0 mt-0.5 text-[13px] text-base-content/70">สัดส่วนตามชั่วโมงที่ใช้จริง</p>
        </div>
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {rows.map((p) => {
            const name = PURPOSE_CATEGORY_LABEL[p.category]
            return (
              <li key={p.category} className="min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="m-0 min-w-0 text-[14px] font-medium text-base-content">{name}</p>
                  <p className="m-0 shrink-0 text-[13px] text-base-content/70 tabular-nums">
                    {hrs(p.heldHours)} ชม. · {p.requests} คำขอ ·{' '}
                    <b className="font-semibold text-base-content">{pct1(p.sharePercent)}</b>
                  </p>
                </div>
                <progress
                  className="progress progress-primary mt-1.5"
                  value={Math.round(p.sharePercent * 10) / 10}
                  max={100}
                  aria-label={`สัดส่วน${name} ${pct1(p.sharePercent)}`}
                />
              </li>
            )
          })}
        </ul>
        <p className="m-0 text-[12px] text-base-content/70">จัดหมวดจากข้อความวัตถุประสงค์โดยอัตโนมัติ อาจคลาดเคลื่อน</p>
      </div>
    </section>
  )
}
