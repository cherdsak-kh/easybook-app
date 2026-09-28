/**
 * `สรุปคำขอจอง` (section B) — the pending queue (AC-D12/AC-D13) plus, in the same card, the bell's
 * own latest-three rows (D-17/AC-D15). Prototype markup `[data-route="dashboard"]` ~L3444–3465,
 * `#db-tpl-queue` ~L3517–3531, `#db-tpl-notif` ~L3534–3543.
 *
 * ⚠️ NO WRITE LOGIC LIVES HERE. `ดูรายละเอียด` and `อนุมัติ` hand the row's id up to the page, which
 * opens the SAME `BookingDetailDialog`/`BookingApproveDialog` คำขอจองสถานที่ uses (AC-D13) — ADR-001
 * stays owned in exactly one place.
 */

import { Link } from 'react-router-dom'
import type { DashboardPendingItem, DashboardVitals } from '@/lib/api-client'
import { LoadError, type LoadErrorKind } from '../../../components/feedback/LoadError'
import { Skeleton, SkeletonRegion } from '../../../components/feedback/Skeleton'
import { NotifGlyph } from '../../../components/shell/notif-icons'
import type { AdminNotification } from '../../../lib/notifications-api'
import { TONE_KEY, relativeTime } from '../../../lib/notifications'
import { routeOf, urlOf } from '../../../routes'
import { dayOffsetBadge, slotSpanText, thaiDayShortDate } from '../dashboard-format'

const REQUESTS_URL = urlOf(routeOf('คำขอจองสถานที่')!)
const NOTIFICATIONS_URL = urlOf(routeOf('ดูการแจ้งเตือนทั้งหมด')!)

function QueueItem({
  item,
  canWrite,
  onViewDetail,
  onApprove,
}: {
  item: DashboardPendingItem
  canWrite: boolean
  onViewDetail: (id: string) => void
  onApprove: (id: string) => void
}) {
  const badge = dayOffsetBadge(item.dayOffset, item.firstSlot.startAt)
  const venueName = item.venue.name + (item.venue.isDeleted ? ' (ลบแล้ว)' : '')
  return (
    <li className="rounded-box border border-base-300 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[13px] font-semibold text-base-content">{item.code}</span>
        <span className={`badge badge-sm whitespace-nowrap ${badge.badgeClass}`}>{badge.text}</span>
      </div>
      <p className="m-0 mt-1.5 text-[14px] font-medium text-base-content">
        {item.requesterName ?? 'ไม่ระบุ'} · {item.departmentName ?? 'ไม่ระบุ'}
      </p>
      <p className="m-0 mt-0.5 text-[13px] leading-[1.55] text-base-content/70">
        {venueName} · {item.purpose}
      </p>
      <p className="m-0 mt-0.5 text-[13px] text-base-content/70 tabular-nums">
        {thaiDayShortDate(item.firstSlot.startAt)} · {slotSpanText(item.firstSlot.startAt, item.firstSlot.endAt)}
        {item.activeSlotCount > 1 ? ` (รวม ${item.activeSlotCount} ช่วงเวลา)` : ''}
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="btn btn-sm flex-1 sm:flex-none"
          aria-label={`ดูรายละเอียดคำขอ ${item.code}`}
          onClick={() => onViewDetail(item.id)}
        >
          ดูรายละเอียด
        </button>
        {canWrite && (
          <button
            type="button"
            className="btn btn-sm btn-primary flex-1 sm:flex-none"
            aria-label={`อนุมัติคำขอ ${item.code}`}
            onClick={() => onApprove(item.id)}
          >
            อนุมัติ
          </button>
        )}
      </div>
    </li>
  )
}

export function PendingQueueCard({
  data,
  error,
  onRetry,
  canWrite,
  onViewDetail,
  onApprove,
  notifications,
}: {
  data: DashboardVitals | null
  error: LoadErrorKind | null
  onRetry: () => void
  canWrite: boolean
  onViewDetail: (id: string) => void
  onApprove: (id: string) => void
  /** The bell's own newest-five (D-17); this card shows the first 3. `null` while loading. */
  notifications: AdminNotification[] | null
}) {
  const notifRows = (notifications ?? []).slice(0, 3)

  return (
    <section
      className="card border border-base-300 bg-base-100 shadow-sm lg:col-span-5"
      aria-labelledby="db-queue-h"
    >
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h2 id="db-queue-h" className="card-title">
            <span>คำขอจองล่าสุดที่รออนุมัติ ({data ? data.pendingRequests : 0})</span>
          </h2>
          <Link to={REQUESTS_URL} className="db-link">
            ดูทั้งหมด →
          </Link>
        </div>

        {error && <LoadError kind={error} onRetry={onRetry} />}

        {!error && !data && (
          <SkeletonRegion label="กำลังโหลดคำขอจอง" className="space-y-2.5">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="rounded-box border border-base-300 p-3.5">
                <Skeleton width="40%" />
                <Skeleton variant="soft" className="mt-2" width="70%" />
                <Skeleton variant="soft" className="mt-1" width="55%" />
              </div>
            ))}
          </SkeletonRegion>
        )}

        {!error && data && (
          <>
            <ul role="list" className="m-0 list-none space-y-2.5 p-0">
              {data.pendingQueue.map((item) => (
                <QueueItem
                  key={item.id}
                  item={item}
                  canWrite={canWrite}
                  onViewDetail={onViewDetail}
                  onApprove={onApprove}
                />
              ))}
            </ul>
            {data.pendingQueue.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-box border border-dashed border-base-300 px-4 py-8 text-center">
                <span className="badge badge-success">ไม่มีคำขอค้างพิจารณา</span>
                <p className="m-0 text-[13px] text-base-content/70">คำขอจองทุกรายการได้รับการพิจารณาแล้ว</p>
              </div>
            )}
          </>
        )}

        <div className="border-t border-base-300 pt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <h3 className="m-0 text-[14px] font-semibold text-base-content/80">การแจ้งเตือนล่าสุด</h3>
            <Link to={NOTIFICATIONS_URL} className="db-link">
              ดูทั้งหมด →
            </Link>
          </div>
          {notifications === null ? (
            <SkeletonRegion label="กำลังโหลดการแจ้งเตือน" className="divide-y divide-base-300/60">
              {Array.from({ length: 2 }, (_, i) => (
                <div key={i} className="flex items-start gap-3 py-2.5">
                  <Skeleton variant="box" className="h-8 w-8 shrink-0 rounded-full" />
                  <Skeleton className="flex-1" width="80%" />
                </div>
              ))}
            </SkeletonRegion>
          ) : (
            <ul role="list" className="m-0 list-none divide-y divide-base-300/60 p-0">
              {notifRows.map((n) => (
                <li key={n.id} className="flex items-start gap-3 py-2.5">
                  <span aria-hidden="true" className={`notif-ico notif-tone-${TONE_KEY[n.tone] ?? 'slate'}`}>
                    <NotifGlyph name={n.icon} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium leading-snug text-base-content">
                      {n.title}
                    </span>
                    <span className="block truncate text-[13px] text-base-content/70">{n.body}</span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-[12px] text-base-content/60">
                    {relativeTime(n.createdAt)}
                  </span>
                </li>
              ))}
              {notifRows.length === 0 && (
                <li className="py-2.5 text-[13px] text-base-content/70">ไม่มีการแจ้งเตือนใหม่</li>
              )}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
