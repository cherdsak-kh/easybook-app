/**
 * `ภาพรวมสถิติ` — `/backend/reports/overview`, Hub 1. Ports prototype
 * `[data-route="reports-overview"]` (markup ~L7374–7801, module ~L23867–24550) onto
 * `GET /reports/overview` (`02_design_log.md` §2.5).
 *
 * ⚠️ PHASE 1 OMITS THREE PANELS ENTIRELY (D-11, no placeholders): จุดคอขวด, ข้อสังเกตสำคัญ, and the
 * สรุปรายการ table. They are Hub 2/3 analytics and ship with those phases. `ส่งออกรายงาน` (D-12,
 * this task's PO ruling 4) is likewise never rendered, for any role.
 *
 * ⚠️ THE API IS STATELESS AND DATE-ONLY (D-13/AC-R4): every preset here (`report-presets.ts`) is
 * client-side sugar that resolves to a plain `{ startDate, endDate }` before the request is sent —
 * no term/month concept, no `venueId`/`departmentId` (Phase 1's filter bar has neither picker,
 * OQ-7), ever crosses the wire.
 *
 * ⚠️ THE PREVIOUS-PERIOD Δ IS A SECOND, INDEPENDENT REQUEST (D-10) — it only feeds the occupancy
 * KPI's trend badge and never blocks or replaces the main range's data; a failure there falls back
 * to the badge's own neutral "ไม่มีข้อมูลช่วงก่อนหน้าให้เทียบ" copy rather than erroring the page.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, getReportsOverview, type ReportsOverview } from '@/lib/api-client'
import { EmptyState } from '../../components/feedback/EmptyState'
import { LoadError, type LoadErrorKind } from '../../components/feedback/LoadError'
import { Skeleton, SkeletonRegion } from '../../components/feedback/Skeleton'
import { PageHeading } from '../../components/shell/PageHeading'
import type { AdminRoute } from '../../routes'
import { ReportFilterBar } from './components/ReportFilterBar'
import { ReportKpiCards } from './components/ReportKpiCards'
import { ReportTopVenues } from './components/ReportTopVenues'
import { ReportTrendChart } from './components/ReportTrendChart'
import {
  monthPresets,
  occupancyTrend,
  previousRangeOf,
  rangeEcho,
  termPresets,
  validateRange,
  type RangePreset,
  type ReportMode,
} from './report-presets'

/** Bangkok-assumed local date, `YYYY-MM-DD` — the same convention `thai-date.ts` runs on. */
function todayIsoLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const kindOf = (err: unknown): LoadErrorKind => {
  const status = err instanceof ApiError ? err.status : 0
  if (status === 0) return 'network'
  if (status === 403) return 'forbidden'
  return 'server'
}

export function ReportsOverviewPage({ route }: { route: AdminRoute }) {
  const today = useMemo(() => todayIsoLocal(), [])
  const terms = useMemo(() => termPresets(today), [today])
  const months = useMemo(() => monthPresets(today, terms[terms.length - 1].from), [today, terms])

  const [mode, setMode] = useState<ReportMode>('term')
  const [presetId, setPresetId] = useState(terms[0].id)
  const [from, setFrom] = useState(terms[0].from)
  const [to, setTo] = useState(terms[0].to)

  const presets: RangePreset[] = mode === 'month' ? months : terms
  const activePreset = presets.find((p) => p.id === presetId) ?? null
  const validationError = validateRange(from, to)

  const [data, setData] = useState<ReportsOverview | null>(null)
  const [error, setError] = useState<LoadErrorKind | null>(null)
  const [prevOccupancyPercent, setPrevOccupancyPercent] = useState<number | null>(null)
  const [prevRangeTo, setPrevRangeTo] = useState<string>('')
  const [prevLabel, setPrevLabel] = useState('')

  const seq = useRef(0)

  const load = useCallback(
    async (f: string, t: string, preset: RangePreset | null, m: ReportMode) => {
      const mine = ++seq.current
      setError(null)
      try {
        const res = await getReportsOverview({ startDate: f, endDate: t })
        if (mine !== seq.current) return
        setData(res)

        // D-10's previous-period comparison — independent, best-effort, never blocks the page.
        const prev = previousRangeOf(m, f, t, preset)
        setPrevRangeTo(prev.to)
        setPrevLabel(prev.label)
        try {
          const prevRes = await getReportsOverview({ startDate: prev.from, endDate: prev.to })
          if (mine !== seq.current) return
          setPrevOccupancyPercent(prevRes.occupancy.occupancyPercent)
        } catch {
          if (mine !== seq.current) return
          setPrevOccupancyPercent(null)
        }
      } catch (err) {
        if (mine !== seq.current) return
        setData(null)
        setError(kindOf(err))
      }
    },
    [],
  )

  // Re-fetch whenever a VALID range is on screen — every preset pick, every edited date, and the
  // mode switch that comes with a preset pick (AC-R2: an invalid range makes NO request at all).
  useEffect(() => {
    if (validationError) return
    void load(from, to, activePreset, mode)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `activePreset`'s identity is derived from presetId/mode/presets each render; re-running on it too would double-fetch
  }, [from, to, mode, presetId, validationError, load])

  const selectPreset = (id: string) => {
    const p = presets.find((x) => x.id === id)
    if (!p) return
    setPresetId(id)
    setFrom(p.from)
    setTo(p.to)
  }

  const selectMode = (m: ReportMode) => {
    setMode(m)
    if (m !== 'custom') {
      const list = m === 'month' ? months : terms
      setPresetId(list[0].id)
      setFrom(list[0].from)
      setTo(list[0].to)
    }
  }

  // §4.1 Custom Override — editing either date means the preset no longer describes the range.
  const editFrom = (v: string) => {
    setMode('custom')
    setFrom(v)
  }
  const editTo = (v: string) => {
    setMode('custom')
    setTo(v)
  }

  const resetToCurrentTerm = () => {
    setMode('term')
    setPresetId(terms[0].id)
    setFrom(terms[0].from)
    setTo(terms[0].to)
  }

  const echo = data
    ? rangeEcho({ from, to, dataUntilDate: data.range.dataUntilDate, schoolDays: data.range.schoolDays })
    : ''

  const trend = data
    ? occupancyTrend(
        data.occupancy.occupancyPercent,
        prevOccupancyPercent,
        prevRangeTo,
        prevLabel,
        data.range.dataStartDate,
      )
    : null

  return (
    <div className="card-shell lg:overflow-y-auto">
      <PageHeading
        route={route}
        title="ภาพรวมสถิติเชิงบริหาร"
        desc="สรุปการใช้สถานที่ คำขอจอง และจุดคอขวดของโรงเรียนในช่วงเวลาที่เลือก สำหรับผู้บริหารและผู้กำกับดูแล"
        descAtEveryWidth
        actions={
          <button
            type="button"
            onClick={() => void load(from, to, activePreset, mode)}
            className="btn flex-1 sm:flex-none"
          >
            รีเฟรช
          </button>
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

      {error && <LoadError kind={error} onRetry={() => void load(from, to, activePreset, mode)} />}

      {!error && !data && !validationError && (
        <SkeletonRegion label="กำลังโหลดสถิติ" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="stats border border-base-300 bg-base-100 p-4 shadow-sm">
              <Skeleton width="60%" />
              <Skeleton variant="soft" className="mt-3" width="40%" />
              <Skeleton variant="box" className="mt-3 h-12 w-full" />
            </div>
          ))}
        </SkeletonRegion>
      )}

      {!error && data && data.requests.total === 0 && (
        <EmptyState
          icon={
            <svg aria-hidden="true" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z"
              />
            </svg>
          }
          title="ไม่มีคำขอจองในช่วงเวลานี้"
          actions={
            <button type="button" className="btn-primary2" onClick={resetToCurrentTerm}>
              ดูภาคเรียนปัจจุบัน
            </button>
          }
        />
      )}

      {!error && data && data.requests.total > 0 && trend && (
        <>
          <ReportKpiCards data={data} occupancyTrend={trend} />
          <div className="mt-4 grid gap-4 xl:grid-cols-5">
            <ReportTrendChart key={data.serverTime} data={data} />
            <div className="grid content-start gap-4 xl:col-span-2">
              <ReportTopVenues venues={data.venues} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
