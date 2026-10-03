/**
 * `การใช้สถานที่และช่วงเวลา` — `/backend/reports/venues`, Hub 2. Ports prototype
 * `[data-route="reports-venues"]` (markup ~L7803–8140, module ~L24699–25200) onto
 * `GET /reports/venues` (`02_design_log.md` §2.5, §3.3).
 *
 * Three questions a director asks about space: which rooms are full and which sit empty, which hours
 * of the school week are the crush, and where ADR-001 turned requests away.
 *
 * ⚠️ `ส่งออกรายงาน` (Phase 3): SUPER_ADMIN and ADMIN only, ABSENT FROM THE DOM for a VIEWER. It opens
 * Hub 4 แบบ 3 (สถิติรายสถานที่) on this hub's current range — see `ExportReportButton`.
 *
 * ⚠️ AN INVALID RANGE MAKES NO REQUEST (AC-V2), and a range CHANGE clears the data so the skeleton
 * shows rather than the previous range under the new echo line. รีเฟรช keeps the data on screen.
 *
 * ⚠️ THE VENUE SELECTOR IS LOCAL STATE (`scope`) — every venue's cells are already in the response, so
 * changing it never refetches (AC-V10). It survives รีเฟรช while the venue is still in the table.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, getReportsVenues, type ReportsVenues } from '@/lib/api-client'
import { EmptyState } from '../../components/feedback/EmptyState'
import { LoadError, type LoadErrorKind } from '../../components/feedback/LoadError'
import { Skeleton, SkeletonRegion } from '../../components/feedback/Skeleton'
import { PageHeading } from '../../components/shell/PageHeading'
import { useToast } from '../../lib/toast-context'
import type { AdminRoute } from '../../routes'
import { ExportReportButton } from './components/ExportReportButton'
import { ReportFilterBar } from './components/ReportFilterBar'
import { VenueClashByType } from './components/VenueClashByType'
import { VenueHeatmap } from './components/VenueHeatmap'
import { VenueRecommendations } from './components/VenueRecommendations'
import { VenueUsageTable } from './components/VenueUsageTable'
import { VenuesKpiCards } from './components/VenuesKpiCards'
import { HUB_EXPORT_TEMPLATE } from './export-params'
import { rangeEcho, thaiDateOf } from './report-presets'
import { ALL_SCOPE, isVenuesEmpty, pct1 } from './report-venues-view'
import { useReportRange } from './use-report-range'

const kindOf = (err: unknown): LoadErrorKind => {
  const status = err instanceof ApiError ? err.status : 0
  if (status === 0) return 'network'
  if (status === 403) return 'forbidden'
  return 'server'
}

const REFRESH_D =
  'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99'

export function ReportsVenuesPage({ route }: { route: AdminRoute }) {
  const toast = useToast()
  const {
    mode,
    presetId,
    from,
    to,
    presets,
    validationError,
    selectPreset,
    selectMode,
    editFrom,
    editTo,
    resetToCurrentTerm,
  } = useReportRange()

  const [data, setData] = useState<ReportsVenues | null>(null)
  const [error, setError] = useState<LoadErrorKind | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [live, setLive] = useState('')
  const [scope, setScope] = useState(ALL_SCOPE)

  const seq = useRef(0)

  /** Resolves `true` when it committed data, so รีเฟรช knows whether to say `อัปเดตข้อมูลแล้ว`. */
  const load = useCallback(async (f: string, t: string, keepData: boolean): Promise<boolean> => {
    const mine = ++seq.current
    setError(null)
    if (!keepData) setData(null)
    try {
      const res = await getReportsVenues({ startDate: f, endDate: t })
      if (mine !== seq.current) return false
      setData(res)
      setLive(
        isVenuesEmpty(res)
          ? 'ไม่มีการใช้สถานที่ในช่วงเวลาที่เลือก'
          : `แสดงการใช้สถานที่ ${thaiDateOf(f)} ถึง ${thaiDateOf(t)} อัตราการใช้งานเฉลี่ย ${pct1(res.occupancy.occupancyPercent)}`,
      )
      return true
    } catch (err) {
      if (mine !== seq.current) return false
      setData(null)
      setError(kindOf(err))
      return false
    }
  }, [])

  // Re-fetch whenever a VALID range is on screen (AC-V2: an invalid range makes NO request).
  useEffect(() => {
    if (validationError) return
    void load(from, to, false)
  }, [from, to, validationError, load])

  const refresh = async () => {
    setRefreshing(true)
    const ok = await load(from, to, true)
    setRefreshing(false)
    if (ok) toast('success', 'อัปเดตข้อมูลแล้ว')
  }

  const echo = data
    ? rangeEcho({ from, to, dataUntilDate: data.range.dataUntilDate, schoolDays: data.range.schoolDays })
    : ''

  // A venue that vanished from the table (deleted, or emptied by a new range) falls back to all.
  const activeScope = data && data.venues.some((v) => v.venueId === scope) ? scope : ALL_SCOPE
  const empty = data ? isVenuesEmpty(data) : false

  return (
    <div className="card-shell rp-page lg:overflow-y-auto">
      <PageHeading
        route={route}
        title="การใช้สถานที่และช่วงเวลา"
        desc="วิเคราะห์อัตราการครองพื้นที่ สล็อตเวลาที่มีการใช้งานหนาแน่น และจุดคอขวดที่คำขอถูกชนเวลา"
        descAtEveryWidth
        actions={
          <div className="flex w-full gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing || validationError !== null}
              className="btn flex-1 sm:flex-none"
            >
              {refreshing ? (
                <span aria-hidden="true" className="loading loading-spinner loading-xs" />
              ) : (
                <svg aria-hidden="true" className="h-4.5 w-4.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={REFRESH_D} />
                </svg>
              )}
              รีเฟรช
            </button>
            <ExportReportButton
              template={HUB_EXPORT_TEMPLATE.venues}
              mode={mode}
              presetId={presetId}
              from={from}
              to={to}
              disabled={validationError !== null}
            />
          </div>
        }
      />

      <ReportFilterBar
        mode={mode}
        onModeChange={selectMode}
        presets={presets}
        presetId={presetId}
        onPresetChange={selectPreset}
        from={from}
        to={to}
        onFromChange={editFrom}
        onToChange={editTo}
        echo={validationError ?? echo}
        echoError={validationError !== null}
      />

      <p role="status" aria-live="polite" className="sr-only">
        {live}
      </p>

      {error && <LoadError kind={error} onRetry={() => void load(from, to, false)} />}

      {!error && !data && !validationError && (
        <SkeletonRegion label="กำลังโหลดข้อมูลการใช้สถานที่">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
            {[
              ['8rem', '5rem', '10rem', 'h-8'],
              ['7rem', '6rem', '9rem', 'h-8'],
              ['7rem', '10rem', '11rem', 'h-6'],
              ['7rem', '4rem', '8rem', 'h-8'],
            ].map(([a, b, c, h]) => (
              <div key={a + b} className="rounded-card border border-base-300 bg-base-100 p-5">
                <Skeleton variant="soft" className="h-3.5" width={a} />
                <Skeleton variant="box" className={`mt-3 ${h}`} width={b} />
                <Skeleton variant="soft" className="mt-3 h-3" width={c} />
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-card border border-base-300 bg-base-100 p-5" aria-hidden="true">
            <Skeleton className="h-4" width="14rem" />
            <div className="mt-5 grid grid-cols-5 gap-1.5">
              {Array.from({ length: 20 }, (_, i) => (
                <Skeleton key={i} variant="box" className="h-11" />
              ))}
            </div>
          </div>
          <div className="mt-4 rounded-card border border-base-300 bg-base-100 p-5" aria-hidden="true">
            <Skeleton className="h-4" width="12rem" />
            <Skeleton variant="soft" className="mt-5 h-3" width="100%" />
            <Skeleton variant="soft" className="mt-4 h-3" width="83%" />
            <Skeleton variant="soft" className="mt-4 h-3" width="100%" />
            <Skeleton variant="soft" className="mt-4 h-3" width="66%" />
          </div>
        </SkeletonRegion>
      )}

      {!error && data && empty && (
        <div className="card border border-base-300 bg-base-100 shadow-sm">
          <EmptyState
            icon={
              <svg aria-hidden="true" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21"
                />
              </svg>
            }
            title="ไม่มีการใช้สถานที่ในช่วงเวลานี้"
            description="ช่วงที่เลือกยังไม่มีการจองสถานที่ หรืออยู่ในช่วงปิดภาคเรียน ลองเลือกภาคเรียนปัจจุบันหรือขยายช่วงวันที่"
            actions={
              <button type="button" className="btn btn-primary" onClick={resetToCurrentTerm}>
                ดูภาคเรียนปัจจุบัน
              </button>
            }
          />
        </div>
      )}

      {!error && data && !empty && (
        <>
          <VenuesKpiCards data={data} />
          <VenueHeatmap data={data} scope={activeScope} onScopeChange={setScope} />
          <VenueUsageTable data={data} />
          <div className="mt-4 grid gap-4 xl:grid-cols-5">
            <VenueClashByType data={data} />
            <VenueRecommendations data={data} />
          </div>
        </>
      )}
    </div>
  )
}
