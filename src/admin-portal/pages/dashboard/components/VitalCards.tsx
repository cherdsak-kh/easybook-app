/**
 * The 4 vital cards — prototype `[data-route="dashboard"]` ~L3385–3421.
 *
 * ⚠️ EACH CARD'S SECTION FAILS INDEPENDENTLY (AC-D22, DV-4): card 1/2/queue come from `vitals`,
 * card 3 from `venues-live`, card 4 from `system/health`. A card whose source failed shows `—`
 * rather than a stale or invented number, and its link ALWAYS stays live (the destination screen
 * has its own data and its own error handling).
 *
 * ⚠️ A card's `href` disappears when the role cannot open its destination (prototype `paintLinks`)
 * — never a disabled-looking link that would lead to a 403.
 */

import { Link } from 'react-router-dom'
import type { DashboardVenuesLive, DashboardVitals, SystemHealth } from '@/lib/api-client'
import { Skeleton } from '../../../components/feedback/Skeleton'
import type { Acl } from '../../../lib/use-acl'
import { routeOf, urlOf, type AdminRouteLabel } from '../../../routes'
import { healthCardDesc, todayActivityDesc } from '../dashboard-format'

function KpiLink({
  acl,
  label,
  children,
}: {
  acl: Acl
  label: AdminRouteLabel
  children: React.ReactNode
}) {
  const route = routeOf(label)
  const can = route && acl.can(label)
  const cls = 'stats db-kpi border border-base-300 bg-base-100 shadow-sm'
  // A card whose destination this role cannot open loses its href, not just its cursor — the
  // prototype's own rule for card 1–3 (they never lead to a 403).
  if (!can || !route) return <div className={cls}>{children}</div>
  return (
    <Link to={urlOf(route)} className={cls}>
      {children}
    </Link>
  )
}

export function VitalCards({
  acl,
  vitals,
  vitalsError,
  venuesLive,
  venuesError,
  health,
  healthError,
}: {
  acl: Acl
  vitals: DashboardVitals | null
  vitalsError: boolean
  venuesLive: DashboardVenuesLive | null
  venuesError: boolean
  health: (SystemHealth & { apiLatencyMs: number }) | null
  healthError: boolean
}) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      <KpiLink acl={acl} label="คำขอจองสถานที่">
        <div className="stat">
          <div className="stat-figure bg-warning/10 text-warning">
            <ClockIcon />
          </div>
          <div className="stat-title whitespace-normal">คำขอจองรอพิจารณา</div>
          <div className="stat-value">
            {vitalsError ? (
              <span className="text-warning">—</span>
            ) : vitals ? (
              <span className="text-warning">{vitals.pendingRequests}</span>
            ) : (
              <Skeleton width="2.5rem" />
            )}
            <span className="stat-unit">รายการ</span>
          </div>
          <div className="stat-desc">รอการตรวจสอบและอนุมัติ</div>
        </div>
      </KpiLink>

      <KpiLink acl={acl} label="การลงทะเบียน">
        <div className="stat">
          <div className="stat-figure bg-primary/10 text-primary">
            <UserPlusIcon />
          </div>
          <div className="stat-title whitespace-normal">ผู้ใช้ LINE รอตรวจสอบ</div>
          <div className="stat-value">
            {vitalsError ? (
              <span className="text-primary">—</span>
            ) : vitals ? (
              <span className="text-primary">{vitals.pendingLineUsers}</span>
            ) : (
              <Skeleton width="2.5rem" />
            )}
            <span className="stat-unit">รายการ</span>
          </div>
          <div className="stat-desc">สมาชิกลงทะเบียนใหม่</div>
        </div>
      </KpiLink>

      <KpiLink acl={acl} label="ปฏิทินการจอง">
        <div className="stat">
          <div className="stat-figure bg-info/10 text-info">
            <CalendarIcon />
          </div>
          <div className="stat-title whitespace-normal">กิจกรรมวันนี้</div>
          <div className="stat-value">
            {venuesError ? '—' : venuesLive ? venuesLive.todayBookings : <Skeleton width="2.5rem" />}
            <span className="stat-unit">รายการ</span>
          </div>
          <div className="stat-desc">
            {venuesError ? 'โหลดไม่สำเร็จ' : venuesLive ? todayActivityDesc(venuesLive.inUseNow) : <Skeleton width="70%" />}
          </div>
        </div>
      </KpiLink>

      <div className="stats db-kpi border border-base-300 bg-base-100 shadow-sm">
        <div className="stat">
          <div className="stat-figure bg-success/10 text-success">
            <CheckShieldIcon />
          </div>
          <div className="stat-title whitespace-normal">สถานะสุขภาพระบบ</div>
          <div className="stat-value">
            {healthError ? (
              <span className="badge badge-error whitespace-nowrap text-[14px]">ตรวจสอบสถานะไม่สำเร็จ</span>
            ) : health ? (
              <span
                className={`badge whitespace-nowrap text-[14px] ${
                  health.overall === 'OK' ? 'badge-success' : 'badge-warning'
                }`}
              >
                {health.overall === 'OK' ? '● ปกติ' : '● มีปัญหาบางส่วน'}
              </span>
            ) : (
              <Skeleton width="6rem" />
            )}
          </div>
          <div className="stat-desc">
            {healthError ? 'ลองรีเฟรชอีกครั้ง' : health ? healthCardDesc(health, health.apiLatencyMs) : <Skeleton width="80%" />}
          </div>
        </div>
      </div>
    </div>
  )
}

function ClockIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
function UserPlusIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z"
      />
    </svg>
  )
}
function CalendarIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
      />
    </svg>
  )
}
function CheckShieldIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
      />
    </svg>
  )
}
