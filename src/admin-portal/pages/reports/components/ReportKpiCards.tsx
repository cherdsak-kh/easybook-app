/**
 * The 4 KPI cards — prototype `[data-route="reports-overview"]` ~L7475–7532.
 *
 * ⚠️ PO ruling (this task's brief, ruling 1): the total-requests card shows FOUR badges —
 * อนุมัติ/ปฏิเสธ/ยกเลิก/หมดอายุ — so they sum to 100% (`breakdown.*Percent`, OQ-2's enlargement of
 * the wire contract). The prototype only drew three; this is a deliberate departure from it,
 * following the PO ruling over the older prototype markup per the geofencing note on ruling
 * precedence.
 *
 * ⚠️ D-9: "ไม่มาใช้" is ALWAYS `—`, never `0` — the API sends `noShows: null` because 0 would claim
 * a measurement that does not exist. The `title` attribute states why, for anyone who hovers it.
 */

import { Link } from 'react-router-dom'
import type { ReportsOverview } from '@/lib/api-client'
import { routeOf, urlOf } from '../../../routes'
import type { OccupancyTrend } from '../report-presets'
import { pct1 } from '../report-presets'

const REQUESTS_URL = urlOf(routeOf('คำขอจองสถานที่')!)

const TREND_BADGE_CLASS: Record<OccupancyTrend['tone'], string> = {
  success: 'badge-success',
  error: 'badge-error',
  neutral: 'badge-neutral',
}

export function ReportKpiCards({
  data,
  occupancyTrend,
}: {
  data: ReportsOverview
  occupancyTrend: OccupancyTrend
}) {
  const { requests, occupancy, discipline, pendingBacklog } = data

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="stats border border-base-300 bg-base-100 shadow-sm">
        <div className="stat">
          <div className="stat-figure bg-primary/10 text-primary">
            <DocsIcon />
          </div>
          <div className="stat-title">คำขอจองทั้งหมด</div>
          <div className="stat-value">
            {requests.total.toLocaleString('en-US')}
            <span className="stat-unit">รายการ</span>
          </div>
          <div className="stat-desc flex flex-wrap gap-1.5">
            {/* ⚠️ A LITERAL SPACE, NOT JUST `gap-1` — the admin theme's unlayered `.badge` rule
                (admin-portal.css, the same fix-round-1 note as the `.stats`/`.label` block) sets
                `gap-0` to win the `.badge` layer fight, which silently zeroes any `gap-*` utility
                on the same element too (unlayered outranks utilities). Fix round 1 (F3). */}
            <span className="badge badge-success badge-sm">
              อนุมัติ {Math.round(requests.approvedPercent)}%
            </span>
            <span className="badge badge-error badge-sm">
              ปฏิเสธ {Math.round(requests.rejectedPercent)}%
            </span>
            <span className="badge badge-neutral badge-sm">
              ยกเลิก {Math.round(requests.cancelledPercent)}%
            </span>
            <span className="badge badge-neutral badge-sm">
              หมดอายุ {Math.round(requests.expiredPercent)}%
            </span>
          </div>
        </div>
      </div>

      <div className="stats border border-base-300 bg-base-100 shadow-sm">
        <div className="stat">
          <div className="stat-figure bg-info/10 text-info">
            <PieIcon />
          </div>
          <div className="stat-title">อัตราการใช้งานสถานที่</div>
          <div className="stat-value">{pct1(occupancy.occupancyPercent)}</div>
          <div className="stat-desc">
            <span className={`badge badge-sm ${TREND_BADGE_CLASS[occupancyTrend.tone]}`}>
              {occupancyTrend.text}
            </span>
            <span className="mt-1 block">
              เทียบกับเวลาเปิดให้จอง จ.–ศ. 08:30–16:30 · {occupancy.schoolDays} วันทำการ × {occupancy.venueCount} สถานที่
            </span>
          </div>
        </div>
      </div>

      <div className="stats border border-base-300 bg-base-100 shadow-sm">
        <div className="stat">
          <div className="stat-figure bg-warning/10 text-warning">
            <AlertIcon />
          </div>
          <div className="stat-title">วินัยการใช้งาน</div>
          <div className="stat-value">
            {discipline.lateCancellations}
            <span className="stat-unit">ครั้ง</span>
          </div>
          <div className="stat-desc">
            <span className="block">
              ยกเลิกกระชั้นชิด{' '}
              <b className="font-semibold text-base-content/90">{discipline.lateCancellations}</b> · ไม่มาใช้{' '}
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
          <div className="stat-figure bg-error/10 text-error">
            <ClockIcon />
          </div>
          <div className="stat-title">คำขอรอพิจารณา</div>
          <div className="stat-value">
            {pendingBacklog}
            <span className="stat-unit">รายการ</span>
          </div>
          <div className="stat-desc">ณ ตอนนี้ · ไม่ขึ้นกับช่วงเวลาที่เลือก</div>
          <div className="stat-actions">
            <Link to={REQUESTS_URL} className="btn btn-ghost btn-sm -ml-3 text-primary">
              ไปที่คำขอจองสถานที่
              <ChevronIcon />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function DocsIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
      />
    </svg>
  )
}
function PieIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
    </svg>
  )
}
function AlertIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
      />
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
function ChevronIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}
