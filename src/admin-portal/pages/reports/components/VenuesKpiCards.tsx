/**
 * Hub 2's 4 KPI cards — prototype `[data-route="reports-venues"]` ~L7885–7930 (AC-V4…V7).
 *
 * ⚠️ THE TOP-VENUE NAME NEVER TRUNCATES (AC-V6): it is the one fact that card exists to state, so it
 * wraps (`stat-value-name`, 20px — see `admin-portal.css` C-3) and carries a `title`.
 *
 * ⚠️ A LITERAL SPACE between text and number inside a badge/line, not a `gap-*`: the admin theme's
 * unlayered `.badge` sets `gap-0` (Phase 1 fix round 1, F3).
 */

import type { ReportsVenues } from '@/lib/api-client'
import { hrs, pct1 } from '../report-venues-view'

function Icon({ d }: { d: readonly string[] }) {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      {d.map((p) => (
        <path key={p} strokeLinecap="round" strokeLinejoin="round" d={p} />
      ))}
    </svg>
  )
}

const PIE = ['M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z', 'M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z']
const CLOCK = ['M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z']
const BUILDING = [
  'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21',
]
const ALERT = [
  'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
]

export function VenuesKpiCards({ data }: { data: ReportsVenues }) {
  const { occupancy, requests, range, clashPercent } = data
  // `venues` arrives sorted occupancy desc, so the first row with hours IS the busiest room.
  const top = data.venues.find((v) => v.heldHours > 0) ?? null
  const topPct = top?.occupancyPercent ?? 0

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="stats border border-base-300 bg-base-100 shadow-sm">
        <div className="stat">
          <div className="stat-figure bg-primary/10 text-primary">
            <Icon d={PIE} />
          </div>
          <div className="stat-title">อัตราการใช้งานเฉลี่ยรวม</div>
          <div className="stat-value">{pct1(occupancy.occupancyPercent)}</div>
          <div className="stat-desc">
            ชั่วโมงที่ถูกจอง ÷ เวลาเปิดให้จอง จ.–ศ. 08:30–16:30 · {occupancy.schoolDays} วันทำการ × {occupancy.venueCount} สถานที่
          </div>
        </div>
      </div>

      <div className="stats border border-base-300 bg-base-100 shadow-sm">
        <div className="stat">
          <div className="stat-figure bg-info/10 text-info">
            <Icon d={CLOCK} />
          </div>
          <div className="stat-title">ชั่วโมงใช้งานสะสม</div>
          <div className="stat-value">
            {hrs(occupancy.heldHours)}
            <span className="stat-unit">ชม.</span>
          </div>
          <div className="stat-desc">
            {range.schoolDays > 0
              ? `เฉลี่ย ${hrs(occupancy.heldHours / range.schoolDays)} ชม. ต่อวันทำการ · จาก ${range.schoolDays} วันทำการ`
              : 'ยังไม่มีวันทำการในช่วงนี้'}
          </div>
        </div>
      </div>

      <div className="stats border border-base-300 bg-base-100 shadow-sm">
        <div className="stat">
          <div className="stat-figure bg-success/10 text-success">
            <Icon d={BUILDING} />
          </div>
          <div className="stat-title">สถานที่ใช้งานสูงสุด</div>
          <div className="stat-value stat-value-name">
            <span className="min-w-0 break-words" title={top ? top.name : undefined}>
              {top ? top.name + (top.isDeleted ? ' (ลบแล้ว)' : '') : '—'}
            </span>
          </div>
          <div className="stat-desc">
            {top && (
              <span className="flex items-center gap-2">
                <progress
                  className="progress progress-primary"
                  value={Math.round(topPct * 10) / 10}
                  max={100}
                  aria-label={`อัตราการครองห้องของสถานที่ใช้งานสูงสุด ${pct1(top.occupancyPercent)}`}
                />
                <b className="shrink-0 font-semibold text-primary tabular-nums">{pct1(top.occupancyPercent)}</b>
              </span>
            )}
            <span className="mt-1 block">
              {top ? `${hrs(top.heldHours)} ชม. · อนุมัติ ${top.approved} การจอง` : 'ยังไม่มีการใช้สถานที่'}
            </span>
          </div>
        </div>
      </div>

      <div className="stats border border-base-300 bg-base-100 shadow-sm">
        <div className="stat">
          <div className="stat-figure bg-error/10 text-error">
            <Icon d={ALERT} />
          </div>
          <div className="stat-title">อัตราคำขอชนเวลา</div>
          <div className="stat-value">{pct1(clashPercent)}</div>
          <div className="stat-desc">
            <span className="block">
              ปฏิเสธอัตโนมัติ <b className="font-semibold text-base-content/90">{requests.autoRejected}</b> จาก{' '}
              <b className="font-semibold text-base-content/90">{requests.total.toLocaleString('en-US')}</b> คำขอ
            </span>
            <span className="block">ความต้องการที่ไม่ได้รับ (ADR-001)</span>
          </div>
        </div>
      </div>
    </div>
  )
}
