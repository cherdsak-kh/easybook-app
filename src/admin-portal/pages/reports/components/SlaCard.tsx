/**
 * `ประสิทธิภาพการพิจารณาคำขอ` — decision turnaround against the 24-hour SLA (prototype ~L8314–8326,
 * AC-O11).
 *
 * ⚠️ OQ-7 (PO): the 24 hours are WALL-CLOCK, not school hours — a Friday 16:00 request answered on
 * Monday 08:30 is a breach. The note line states what is excluded and that a rejection's turnaround
 * is an estimate (the schema stores no decision time for rejections, D-23).
 */

import type { ReportsOperations } from '@/lib/api-client'
import { SLA_BUCKET_LABEL } from '../../../labels'
import { SLA_BAR_CLASSES, slaNote } from '../report-operations-view'

export function SlaCard({ data }: { data: ReportsOperations }) {
  const { sla } = data
  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm" aria-labelledby="ro-sla-h">
      <div className="card-body">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="ro-sla-h" className="card-title">
              ประสิทธิภาพการพิจารณาคำขอ
            </h2>
            <p className="m-0 mt-0.5 text-[13px] text-base-content/70">
              เวลาตั้งแต่ส่งคำขอจนเจ้าหน้าที่พิจารณา · เกณฑ์ {sla.slaHours} ชม.
            </p>
          </div>
          <span className="badge badge-neutral badge-sm shrink-0 tabular-nums">{sla.decided} คำขอ</span>
        </div>
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {sla.buckets.map((b, i) => {
            const name = SLA_BUCKET_LABEL[b.bucket]
            return (
              <li key={b.bucket} className="min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="m-0 min-w-0 text-[14px] font-medium text-base-content">{name}</p>
                  <p className="m-0 shrink-0 text-[13px] text-base-content/70 tabular-nums">
                    {b.count} คำขอ · <b className="font-semibold text-base-content">{b.percent.toFixed(1)}%</b>
                  </p>
                </div>
                <progress
                  className={`progress mt-1.5 ${SLA_BAR_CLASSES[i] ?? 'progress-primary'}`}
                  value={Math.round(b.percent * 10) / 10}
                  max={100}
                  aria-label={`${name} ${b.count} คำขอ ${b.percent.toFixed(1)}%`}
                />
              </li>
            )
          })}
        </ul>
        {/* OQ-7: the wall-clock basis is stated on screen, so a Monday answer to a Friday request is
            not misread as slow staff. */}
        <p className="m-0 text-[12px] leading-[1.6] text-base-content/70">
          นับเวลาตามนาฬิกาจริงต่อเนื่อง 24 ชม. ไม่ตัดวันหยุดและเวลานอกทำการ
        </p>
        <p className="m-0 text-[12px] leading-[1.6] text-base-content/70">{slaNote(sla)}</p>
      </div>
    </section>
  )
}
