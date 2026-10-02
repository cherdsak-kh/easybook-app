/**
 * `สถิติตามฝ่ายและการดำเนินงาน` — `/backend/reports/operations`, Hub 3. Ports prototype
 * `[data-route="reports-operations"]` (markup ~L8142–8489, module ~L25165–25480) onto
 * `GET /reports/operations` (`02_design_log.md` §2.6, §3.4).
 *
 * Three governance questions: is space shared fairly between กลุ่มสาระ/ฝ่าย, how fast do staff rule on
 * requests, and who cancels late.
 *
 * ⚠️ NO `ส่งออกรายงาน` BUTTON FOR ANY ROLE (D-3), NO NO-SHOW DATA (D-12), NO REQUESTER NAMES (D-26).
 * ⚠️ Same fetch discipline as Hub 2: an invalid range makes no request; a range change clears the
 * data; รีเฟรช keeps it on screen behind a spinner and toasts on success.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, getReportsOperations, type ReportsOperations } from '@/lib/api-client'
import { EmptyState } from '../../components/feedback/EmptyState'
import { LoadError, type LoadErrorKind } from '../../components/feedback/LoadError'
import { Skeleton, SkeletonRegion } from '../../components/feedback/Skeleton'
import { PageHeading } from '../../components/shell/PageHeading'
import { useToast } from '../../lib/toast-context'
import type { AdminRoute } from '../../routes'
import { DepartmentTable } from './components/DepartmentTable'
import { LateCancellationRegistry } from './components/LateCancellationRegistry'
import { OperationsKpiCards } from './components/OperationsKpiCards'
import { PurposeBars } from './components/PurposeBars'
import { ReportFilterBar } from './components/ReportFilterBar'
import { SlaCard } from './components/SlaCard'
import { isOperationsEmpty } from './report-operations-view'
import { rangeEcho, thaiDateOf } from './report-presets'
import { useReportRange } from './use-report-range'

const kindOf = (err: unknown): LoadErrorKind => {
  const status = err instanceof ApiError ? err.status : 0
  if (status === 0) return 'network'
  if (status === 403) return 'forbidden'
  return 'server'
}

const REFRESH_D =
  'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99'

export function ReportsOperationsPage({ route }: { route: AdminRoute }) {
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

  const [data, setData] = useState<ReportsOperations | null>(null)
  const [error, setError] = useState<LoadErrorKind | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [live, setLive] = useState('')

  const seq = useRef(0)

  const load = useCallback(async (f: string, t: string, keepData: boolean): Promise<boolean> => {
    const mine = ++seq.current
    setError(null)
    if (!keepData) setData(null)
    try {
      const res = await getReportsOperations({ startDate: f, endDate: t })
      if (mine !== seq.current) return false
      setData(res)
      setLive(
        isOperationsEmpty(res)
          ? 'ไม่มีคำขอจองในช่วงเวลาที่เลือก'
          : `แสดงสถิติตามฝ่าย ${thaiDateOf(f)} ถึง ${thaiDateOf(t)} คำขอ ${res.requests.total} รายการ`,
      )
      return true
    } catch (err) {
      if (mine !== seq.current) return false
      setData(null)
      setError(kindOf(err))
      return false
    }
  }, [])

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
  const empty = data ? isOperationsEmpty(data) : false

  return (
    <div className="card-shell rp-page lg:overflow-y-auto">
      <PageHeading
        route={route}
        title="สถิติตามฝ่ายและการดำเนินงาน"
        desc="วิเคราะห์การจัดสรรพื้นที่ตามกลุ่มสาระ/ฝ่ายงาน ประสิทธิภาพการพิจารณาคำขอ (SLA) และวินัยการใช้งาน"
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
        <SkeletonRegion label="กำลังโหลดสถิติตามฝ่ายและการดำเนินงาน">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
            {[
              ['8rem', '10rem', '10rem', 'h-6'],
              ['7rem', '5rem', '9rem', 'h-8'],
              ['6rem', '4rem', '11rem', 'h-8'],
              ['7rem', '11rem', '8rem', 'h-6'],
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
            <Skeleton variant="soft" className="mt-5 h-3" width="100%" />
            <Skeleton variant="soft" className="mt-4 h-3" width="83%" />
            <Skeleton variant="soft" className="mt-4 h-3" width="100%" />
            <Skeleton variant="soft" className="mt-4 h-3" width="66%" />
            <Skeleton variant="soft" className="mt-4 h-3" width="75%" />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2" aria-hidden="true">
            {['10rem', '11rem'].map((w) => (
              <div key={w} className="rounded-card border border-base-300 bg-base-100 p-5">
                <Skeleton className="h-4" width={w} />
                <Skeleton variant="soft" className="mt-5 h-3" width="75%" />
                <Skeleton variant="box" className="mt-2 h-2" width="100%" />
                <Skeleton variant="soft" className="mt-5 h-3" width="66%" />
                <Skeleton variant="box" className="mt-2 h-2" width="83%" />
              </div>
            ))}
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
                  d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                />
              </svg>
            }
            title="ไม่มีคำขอจองในช่วงเวลานี้"
            description="ช่วงที่เลือกยังไม่มีคำขอจองจากกลุ่มสาระหรือฝ่ายงานใด ลองเลือกภาคเรียนปัจจุบันหรือขยายช่วงวันที่"
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
          <OperationsKpiCards data={data} />
          <DepartmentTable data={data} />
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <PurposeBars data={data} />
            <SlaCard data={data} />
          </div>
          <LateCancellationRegistry data={data} />
        </>
      )}
    </div>
  )
}
