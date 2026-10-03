/**
 * Hub 3's 4 KPI cards — prototype `[data-route="reports-operations"]` ~L8221–8268 (AC-O3…O6).
 *
 * ⚠️ D-12: `ไม่มาใช้` is ALWAYS `—`, never `0` — the system has no attendance record, so
 * `discipline.noShows` is `null` and a 0 would claim a measurement that does not exist. The `title`
 * says why. The two name KPIs (top ฝ่าย, top purpose) wrap at 18px (`stat-value-name-sm`, see
 * `admin-portal.css` C-3) — never truncated.
 */

import type { ReportsOperations } from '@/lib/api-client'
import { PURPOSE_CATEGORY_LABEL } from '../../../labels'
import {
  departmentName,
  hrs,
  pct1,
  slaBadge,
  topDepartment,
  topPurpose,
} from '../report-operations-view'

function Icon({ d }: { d: string }) {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

const GROUP =
  'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z'
const CLOCK = 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z'
const SHIELD =
  'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z'
const CAP =
  'M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5'

export function OperationsKpiCards({ data }: { data: ReportsOperations }) {
  const { sla, discipline } = data
  const dept = topDepartment(data.departments)
  const purpose = topPurpose(data.purposes)
  const badge = slaBadge(sla)

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="stats border border-base-300 bg-base-100 shadow-sm">
        <div className="stat">
          <div className="stat-figure bg-info/10 text-info">
            <Icon d={GROUP} />
          </div>
          <div className="stat-title">กลุ่ม/ฝ่ายที่ใช้งานสูงสุด</div>
          <div className="stat-value stat-value-name-sm">
            <span className="min-w-0 break-words" title={dept ? departmentName(dept) : undefined}>
              {dept ? departmentName(dept) : '—'}
            </span>
          </div>
          <div className="stat-desc">
            {dept && (
              <span className="flex items-center gap-2">
                <progress
                  className="progress progress-info"
                  value={Math.round(dept.sharePercent * 10) / 10}
                  max={100}
                  aria-label={`สัดส่วนการใช้พื้นที่ของ${departmentName(dept)} ${pct1(dept.sharePercent)}`}
                />
                <b className="shrink-0 font-semibold text-info tabular-nums">{pct1(dept.sharePercent)}</b>
              </span>
            )}
            <span className="mt-1 block">
              {dept ? `${hrs(dept.heldHours)} ชม. จากทั้งหมด ${hrs(data.heldHours)} ชม.` : 'ยังไม่มีการใช้สถานที่'}
            </span>
          </div>
        </div>
      </div>

      <div className="stats border border-base-300 bg-base-100 shadow-sm">
        <div className="stat">
          <div className="stat-figure bg-primary/10 text-primary">
            <Icon d={CLOCK} />
          </div>
          <div className="stat-title">ระยะเวลาพิจารณาเฉลี่ย</div>
          <div className="stat-value">
            {sla.averageHours == null ? '—' : sla.averageHours.toFixed(1)}
            <span className="stat-unit">ชม.</span>
          </div>
          <div className="stat-desc">
            <span className={`badge badge-sm ${badge.cls}`}>{badge.text}</span>
            {sla.decided > 0 && sla.medianHours != null && (
              <span className="mt-1 block">
                ค่ากลาง {sla.medianHours.toFixed(1)} ชม. · จาก {sla.decided} คำขอที่เจ้าหน้าที่พิจารณา
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="stats border border-base-300 bg-base-100 shadow-sm">
        <div className="stat">
          <div className="stat-figure bg-warning/10 text-warning">
            <Icon d={SHIELD} />
          </div>
          <div className="stat-title">วินัยการใช้งาน</div>
          <div className="stat-value">
            {discipline.lateCancellations}
            <span className="stat-unit">ครั้ง</span>
          </div>
          <div className="stat-desc">
            <span className="block">
              ยกเลิกกระชั้นชิด <b className="font-semibold text-base-content/90">{discipline.lateCancellations}</b> ·
              ไม่มาใช้{' '}
              <b className="font-semibold text-base-content/90" title="ระบบยังไม่มีการบันทึกการเข้าใช้จริง">
                —
              </b>
            </span>
            <span className="block">{pct1(discipline.lateCancellationPercent)} ของการจองที่อนุมัติ</span>
          </div>
        </div>
      </div>

      <div className="stats border border-base-300 bg-base-100 shadow-sm">
        <div className="stat">
          <div className="stat-figure bg-success/10 text-success">
            <Icon d={CAP} />
          </div>
          <div className="stat-title">วัตถุประสงค์หลัก</div>
          <div className="stat-value stat-value-name-sm">
            <span className="min-w-0 break-words">{purpose ? PURPOSE_CATEGORY_LABEL[purpose.category] : '—'}</span>
          </div>
          <div className="stat-desc">
            {purpose
              ? `${pct1(purpose.sharePercent)} ของชั่วโมงที่ใช้ทั้งหมด · ${hrs(purpose.heldHours)} ชม. จาก ${purpose.requests} คำขอ`
              : 'ยังไม่มีการใช้สถานที่'}
          </div>
        </div>
      </div>
    </div>
  )
}
