/**
 * `สถานะห้องจัดกิจกรรมวันนี้` — section A of ภาพรวมระบบ (Hub 7). Prototype markup
 * `[data-route="dashboard"]` ~L3425–3442, `#db-tpl-room` ~L3488–3514; states/copy from
 * `computeRoomStates` (`AC-D6…D11`) via `dashboard-format.ts`.
 *
 * ⚠️ EVERY STATE COMES FROM THE SERVER'S OWN PASS AT `serverTime` (D-2) — this component never
 * recomputes busy/free/off, an elapsed percentage or a countdown; it only paints the fields
 * `DashboardVenueDto` already carries.
 *
 * Tabs follow the APG tabs pattern (arrow-key roving focus, manual activation, `aria-selected`) —
 * AC-D10.
 */

import { useMemo, useRef, useState } from 'react'
import type { DashboardVenue, DashboardVenuesLive } from '@/lib/api-client'
import { LoadError, type LoadErrorKind } from '../../../components/feedback/LoadError'
import { SkeletonRegion, Skeleton } from '../../../components/feedback/Skeleton'
import {
  busySlotRangeText,
  freeWindowHeadline,
  nextSlotText,
  remainingText,
  roomMetaText,
  roomsSubtitle,
} from '../dashboard-format'

type Tab = 'all' | 'busy' | 'free'

const TAB_LABEL: Record<Tab, string> = { all: 'ทั้งหมด', busy: 'กำลังใช้งาน', free: 'ว่างขณะนี้' }
const TABS: Tab[] = ['all', 'busy', 'free']

function RoomCard({
  venue,
  canWrite,
  onBookNow,
}: {
  venue: DashboardVenue
  canWrite: boolean
  onBookNow: (venueId: string, venueName: string) => void
}) {
  const isOff = venue.state === 'OFF'
  return (
    <li
      data-db-room={venue.state}
      className={`db-room ${
        venue.state === 'BUSY' ? 'db-room-busy' : venue.state === 'FREE' ? 'db-room-free' : 'db-room-off'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 text-[15px] font-semibold leading-snug text-base-content">{venue.name}</p>
          <p className="m-0 mt-0.5 text-[12px] text-base-content/70">
            {roomMetaText(venue.capacity, venue.todaySlotCount, isOff)}
          </p>
        </div>
        <span
          className={`badge badge-sm shrink-0 whitespace-nowrap ${
            venue.state === 'BUSY' ? 'badge-warning' : venue.state === 'FREE' ? 'badge-success' : 'badge-neutral'
          }`}
        >
          {venue.state === 'BUSY' ? '● กำลังใช้งาน' : venue.state === 'FREE' ? '● ว่าง' : 'ปิดปรับปรุงชั่วคราว'}
        </span>
      </div>

      {venue.state === 'BUSY' && venue.current && (
        <div className="mt-3">
          <p className="m-0 flex flex-wrap items-baseline justify-between gap-x-2 text-[13px]">
            <span className="font-semibold text-base-content tabular-nums">
              {busySlotRangeText(
                venue.current.startAt,
                venue.current.endAt,
                venue.current.startsBeforeToday,
                venue.current.endsAfterToday,
              )}
            </span>
            <span className="text-base-content/70">{remainingText(venue.current.remainingMinutes)}</span>
          </p>
          <progress
            className="progress progress-warning mt-1.5 h-1.5"
            max={100}
            value={venue.current.elapsedPercent}
            aria-label={`ผ่านไปแล้ว ${venue.current.elapsedPercent}% ของช่วงเวลาที่จอง`}
          />
          <p className="m-0 mt-2.5 text-[14px] font-medium leading-snug text-base-content">
            {venue.current.purpose}
          </p>
          <p className="m-0 mt-1 text-[13px] text-base-content/70">
            {venue.current.requesterName ?? 'ไม่ระบุ'} · {venue.current.departmentName ?? 'ไม่ระบุ'}
          </p>
          <p className="m-0 mt-1 text-[13px] text-base-content/70">
            ผู้เข้าร่วม {venue.current.attendees.toLocaleString('th-TH')} คน
          </p>
        </div>
      )}

      {venue.state === 'FREE' && (
        <div className="mt-3">
          <p className="m-0 text-[14px] font-medium text-base-content">
            {freeWindowHeadline(venue.freeWindow, venue.freeUntil)}
          </p>
          <p className="m-0 mt-1 text-[13px] text-base-content/70">{nextSlotText(venue.next)}</p>
          {canWrite && (
            <button
              type="button"
              className="btn btn-sm mt-3 w-full"
              aria-label={`จอง${venue.name}ทันที`}
              onClick={() => onBookNow(venue.id, venue.name)}
            >
              จองห้องนี้ทันที
            </button>
          )}
        </div>
      )}

      {isOff && (
        <p className="m-0 mt-3 text-[13px] leading-[1.55] text-base-content/70">
          {venue.closedReason ?? 'สถานที่นี้ปิดรับการจองชั่วคราว'}
        </p>
      )}
    </li>
  )
}

export function RoomOccupancyCard({
  data,
  error,
  onRetry,
  canWrite,
  onBookNow,
}: {
  data: DashboardVenuesLive | null
  error: LoadErrorKind | null
  onRetry: () => void
  canWrite: boolean
  onBookNow: (venueId: string, venueName: string) => void
}) {
  const [tab, setTab] = useState<Tab>('all')
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ all: null, busy: null, free: null })

  const shown = useMemo(() => {
    if (!data) return []
    if (tab === 'all') return data.venues
    return data.venues.filter((v) => (tab === 'busy' ? v.state === 'BUSY' : v.state === 'FREE'))
  }, [data, tab])

  const onTabKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const i = TABS.indexOf(tab)
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]
    setTab(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <section
      className="card border border-base-300 bg-base-100 shadow-sm lg:col-span-7"
      aria-labelledby="db-rooms-h"
    >
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 id="db-rooms-h" className="card-title">
              สถานะห้องจัดกิจกรรมวันนี้
            </h2>
            {data && (
              <p className="m-0 mt-0.5 text-[13px] text-base-content/70">
                {roomsSubtitle(data.withinOperatingHours, data.serverTime)}
              </p>
            )}
          </div>
          {data && (
            <div
              role="tablist"
              aria-label="กรองสถานะห้อง"
              className="tabs tabs-box db-tabs"
              onKeyDown={onTabKeyDown}
            >
              {TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  ref={(el) => {
                    tabRefs.current[t] = el
                  }}
                  tabIndex={tab === t ? 0 : -1}
                  className={`tab ${tab === t ? 'tab-active' : ''}`}
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                >
                  <span>
                    {TAB_LABEL[t]} ({t === 'all' ? data.counts.all : t === 'busy' ? data.counts.busy : data.counts.free})
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <LoadError kind={error} onRetry={onRetry} />}

        {!error && !data && (
          <SkeletonRegion label="กำลังโหลดสถานะห้อง" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="db-room">
                <Skeleton width="60%" />
                <Skeleton variant="soft" className="mt-2" width="40%" />
                <Skeleton variant="box" className="mt-3 h-16 w-full" />
              </div>
            ))}
          </SkeletonRegion>
        )}

        {!error && data && (
          <>
            <ul
              role="list"
              aria-live="polite"
              className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"
            >
              {shown.map((v) => (
                <RoomCard key={v.id} venue={v} canWrite={canWrite} onBookNow={onBookNow} />
              ))}
            </ul>
            {shown.length === 0 && (
              <p className="m-0 rounded-box border border-dashed border-base-300 px-4 py-8 text-center text-[14px] text-base-content/70">
                {tab === 'busy' ? 'ขณะนี้ไม่มีห้องที่กำลังใช้งาน' : 'ขณะนี้ไม่มีห้องว่าง'}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  )
}
