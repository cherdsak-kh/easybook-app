/**
 * `บันทึกข้อผิดพลาด`: `/backend/reports/error-log`, Hub 6. Ports prototype
 * `[data-route="reports-error-log"]` (markup L9069–9363, module L26489–27053, inspector L12483–12565)
 * onto `GET /reports/error-log` (+ `/kpis`, `/csv`, `/detail/:id`, `DELETE /reports/error-log`)
 * (`02_design_log.md` §2.5, §3.5).
 *
 * The technical console: unhandled 5xx, database deadlocks, and failures of LINE, Cloudflare R2 and
 * Redis, each with its trace id (the request's `X-Request-Id`), its stack and its context.
 *
 * ⚠️ SUPER_ADMIN ONLY, and not checked here. `BackendLayout` redirects ADMIN and VIEWER before this page
 * mounts, so it fires no request; `@Roles(SUPER_ADMIN)` on every Hub 6 route is the control.
 *
 * ⚠️ HUB 5'S SPLIT, ONE FOR ONE: the range drives the KPIs (their own request, dates only), the toolbar
 * narrows the table only, the pager is server-side, the table starts at `xl`. What differs: the log is
 * BOUNDED, not permanent (the echo line says `เก็บย้อนหลังสูงสุด 90 วัน หรือ 5,000 รายการ`), and the page
 * can poll and purge.
 *
 * ⚠️ LIVE REFRESH (D-25) runs only while the toggle is on, the page is mounted, the tab is visible and
 * the session is alive: a poll answering 401 turns the toggle off and stops (the shell owns the sign-in
 * dialog). It never starts a second poll behind a slow one and never resets the page or the filters.
 *
 * ⚠️ PURGE IS DESTRUCTIVE: outlined in error, confirmed through the portal's shared `ConfirmModal` that
 * names the count and the cut-off date, disabled (with its reason as a `title`) when nothing is older
 * than the 30 วันล่าสุด window. A failure closes the dialog and says so in a toast: never a silent no-op.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ApiError,
  downloadFile,
  errorLogCsvUrl,
  getErrorLog,
  getErrorLogKpis,
  purgeStaleIncidents,
  type IncidentComponent,
  type IncidentKpis,
  type IncidentPage,
  type IncidentSeverity,
  type IncidentSummary,
} from '@/lib/api-client'
import { LoadError } from '../../components/feedback/LoadError'
import { ConfirmModal } from '../../components/feedback/ConfirmModal'
import { Spinner } from '../../components/feedback/Spinner'
import { PageHeading } from '../../components/shell/PageHeading'
import { PaginationBar, PaginationBarSkeleton } from '../../components/ui/PaginationBar'
import {
  INCIDENT_COMPONENT_LABEL,
  INCIDENT_COMPONENT_ORDER,
  INCIDENT_SEVERITY_ORDER,
} from '../../labels'
import { useBusy } from '../../lib/use-busy'
import { useToast } from '../../lib/toast-context'
import type { AdminRoute } from '../../routes'
import { IncidentDialog } from './components/IncidentDialog'
import { IncidentKpiCards } from './components/IncidentKpiCards'
import { IncidentCards, IncidentTable } from './components/IncidentRows'
import { LogRangeCard } from './components/LogRangeCard'
import { LogPageSkeleton, RowsSkeleton } from './components/LogSkeletons'
import { purgeOf, retentionNote } from './error-log-view'
import { clockOf, logRangeEcho, type LogPreset } from './log-range'
import { useLivePoll } from './use-live-poll'
import { useLogFeed } from './use-log-feed'
import { useLogRange } from './use-log-range'

/** Hub 6's presets: no ภาคเรียนปัจจุบัน (an error log is about now, not a term). */
const PRESETS: readonly LogPreset[] = ['today', '7d', '30d', 'custom']

const REFRESH_D =
  'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99'
const CSV_D = 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3'
const TRASH_D =
  'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.2v.916m7.5 0a48.667 48.667 0 00-7.5 0'
const SEARCH_D = 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
const OK_D = 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
const CLOSE_D = 'M6 18L18 6M6 6l12 12'

type Limit = 10 | 20 | 50

export function ErrorLogPage({ route }: { route: AdminRoute }) {
  const toast = useToast()
  const range = useLogRange()

  // ── Toolbar: narrows the TABLE only ────────────────────────────────────────────────────────
  // `?q=<text>` prefills the search ONCE on entry (a link from a notification can name a trace id).
  const [searchParams] = useSearchParams()
  const [initialQ] = useState(() => (searchParams.get('q') ?? '').slice(0, 100))
  const [q, setQ] = useState(initialQ)
  const [qApplied, setQApplied] = useState(initialQ)
  const [severity, setSeverity] = useState<IncidentSeverity | ''>('')
  const [component, setComponent] = useState<IncidentComponent | ''>('')
  const [limit, setLimit] = useState<Limit>(10)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setQApplied(q), 250)
    return () => clearTimeout(t)
  }, [q])

  const filter = { q: qApplied.trim(), severity, component }
  const feed = useLogFeed<IncidentPage, { kpis: IncidentKpis }>({
    from: range.from,
    to: range.to,
    filterKey: `${filter.q}|${severity}|${component}|${limit}`,
    fetchMeta: async (signal) => {
      const k = await getErrorLogKpis({ startDate: range.from, endDate: range.to }, signal)
      return { kpis: k.kpis }
    },
    fetchList: (page, signal) =>
      getErrorLog(
        {
          startDate: range.from,
          endDate: range.to,
          severity: severity || undefined,
          component: component || undefined,
          q: filter.q || undefined,
          page,
          limit,
        },
        signal,
      ),
  })
  const { meta, list } = feed

  const clearFilters = () => {
    setQ('')
    setQApplied('')
    setSeverity('')
    setComponent('')
  }
  const narrowed = q.trim() !== '' || severity !== '' || component !== ''

  // ── Refresh and live ───────────────────────────────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false)
  const refresh = async () => {
    setRefreshing(true)
    const r = await feed.refresh()
    setRefreshing(false)
    if (r.ok) toast('success', `อัปเดตข้อมูลล่าสุดแล้ว เวลา ${clockOf(new Date())} น.`)
  }

  const [live, setLive] = useState(false)
  useLivePoll(live, feed.refresh, () => setLive(false))
  const toggleLive = (on: boolean) => {
    setLive(on)
    if (on) {
      void feed.refresh()
      toast('info', 'เปิดอัปเดตสดแล้ว ระบบจะดึงข้อมูลใหม่ทุก 30 วินาที')
    }
  }

  // ── CSV ────────────────────────────────────────────────────────────────────────────────────
  const csv = useBusy()
  const empty = meta !== null && meta.kpis.inRange === 0
  const csvDisabled = !list || list.total === 0 || empty || csv.busy
  const downloadCsv = () =>
    csv.run(async () => {
      if (!list) return
      try {
        await downloadFile(
          errorLogCsvUrl({
            startDate: range.from,
            endDate: range.to,
            severity: severity || undefined,
            component: component || undefined,
            q: filter.q || undefined,
          }),
          `easybook-error-log_${range.from}_${range.to}.csv`,
        )
        toast('success', `ดาวน์โหลดไฟล์ CSV แล้ว ${list.total.toLocaleString('en-US')} รายการ`)
      } catch (err) {
        toast(
          'error',
          err instanceof ApiError && err.status === 403
            ? 'คุณไม่มีสิทธิ์ส่งออกบันทึกข้อผิดพลาด'
            : 'ดาวน์โหลดไฟล์ไม่สำเร็จ ลองใหม่อีกครั้ง',
        )
      }
    })

  // ── Purge ──────────────────────────────────────────────────────────────────────────────────
  const [purgeOpen, setPurgeOpen] = useState(false)
  const purge = useMemo(() => (list ? purgeOf(list.purgeable) : null), [list])
  const runPurge = async () => {
    const n = list?.purgeable.count ?? 0
    try {
      await purgeStaleIncidents()
      setPurgeOpen(false)
      await feed.refresh()
      toast('success', `ล้างบันทึกเก่ากว่า 30 วันแล้ว ${n.toLocaleString('en-US')} รายการ`)
    } catch (err) {
      setPurgeOpen(false)
      toast(
        'error',
        err instanceof ApiError && err.status === 403
          ? 'คุณไม่มีสิทธิ์ล้างบันทึกข้อผิดพลาด'
          : 'ล้างบันทึกไม่สำเร็จ บันทึกยังอยู่ครบ ลองใหม่อีกครั้ง',
      )
    }
  }

  // ── Inspector: the last incident stays mounted after close so focus can return to its opener ──
  const [selected, setSelected] = useState<IncidentSummary | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const openIncident = (i: IncidentSummary) => {
    setSelected(i)
    setDialogOpen(true)
  }

  const echo = logRangeEcho(range.from, range.to, feed.lastSync, [
    ...(list ? [retentionNote(list.retention)] : []),
    ...(live ? ['อัปเดตสดทุก 30 วินาที'] : []),
  ])

  return (
    <div className="card-shell rp-page relative lg:overflow-y-auto">
      <PageHeading
        route={route}
        title="บันทึกข้อผิดพลาด"
        desc="บันทึกข้อผิดพลาดทางเทคนิคของระบบ เช่น Server 500, Database Deadlocks และ LINE API Timeouts สำหรับทีมเทคนิคและผู้ดูแลระบบ"
        descAtEveryWidth
        actions={
          /* A 2-up grid on a phone (the switch and purge span both columns), a single row from `sm`. */
          <div className="grid w-full grid-cols-2 items-center gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <label className="col-span-2 flex min-h-11 cursor-pointer items-center gap-2 rounded-control px-1 text-[14px] font-medium text-base-content/80 sm:px-2">
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={live}
                onChange={(e) => toggleLive(e.target.checked)}
              />
              อัปเดตสด 30 วิ
            </label>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing || range.error !== null}
              aria-busy={refreshing || undefined}
              className="btn min-h-11 whitespace-nowrap"
            >
              {refreshing ? (
                <Spinner />
              ) : (
                <svg aria-hidden="true" className="h-4.5 w-4.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={REFRESH_D} />
                </svg>
              )}
              รีเฟรช
            </button>
            <button
              type="button"
              onClick={() => void downloadCsv()}
              disabled={csvDisabled}
              aria-busy={csv.busy || undefined}
              className="btn min-h-11 whitespace-nowrap"
            >
              {csv.busy ? (
                <Spinner />
              ) : (
                <svg aria-hidden="true" className="h-4.5 w-4.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={CSV_D} />
                </svg>
              )}
              ส่งออก CSV
            </button>
            {/* Destructive, so outlined in error and confirmed through the shared confirm dialog.
                Disabled, with the reason in its title, when nothing is older than 30 days. */}
            <button
              type="button"
              onClick={() => setPurgeOpen(true)}
              disabled={!purge || purge.disabled}
              title={purge?.title}
              className="btn btn-outline btn-error col-span-2 min-h-11 whitespace-nowrap"
            >
              <svg aria-hidden="true" className="h-4.5 w-4.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={TRASH_D} />
              </svg>
              ล้างบันทึกเก่ากว่า 30 วัน
            </button>
          </div>
        }
      />

      <LogRangeCard idPrefix="errlog" presets={PRESETS} range={range} echo={echo} />

      <p role="status" aria-live="polite" className="sr-only">
        {list ? `แสดงบันทึกข้อผิดพลาด ${list.total} รายการ` : ''}
      </p>

      {feed.metaError ? (
        <div className="card border border-base-300 bg-base-100 shadow-sm">
          <LoadError kind={feed.metaError} onRetry={feed.retry} />
        </div>
      ) : !meta ? (
        <LogPageSkeleton label="กำลังโหลดบันทึกข้อผิดพลาด" />
      ) : empty ? (
        /* A quiet period is GOOD news, so the tile is green and there is no "ล้างตัวกรอง" to reach for. */
        <div className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
              <svg aria-hidden="true" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={OK_D} />
              </svg>
            </div>
            <h2 className="text-[18px] font-semibold text-base-content th-tight">ไม่มีข้อผิดพลาดในช่วงเวลานี้</h2>
            <p className="mt-1.5 max-w-md text-[14px] leading-[1.6] text-base-content/70 th-tight">
              ระบบทำงานปกติตลอดช่วงที่เลือก ไม่มีข้อผิดพลาดใดถูกบันทึกไว้
            </p>
            <button type="button" className="btn mt-5 min-h-11" onClick={range.reset}>
              ดู 30 วันล่าสุด
            </button>
          </div>
        </div>
      ) : (
        <>
          <IncidentKpiCards kpis={meta.kpis} />

          <section className="card mt-4 border border-base-300 bg-base-100 shadow-sm" aria-labelledby="errlog-list-h">
            <h2 id="errlog-list-h" className="sr-only">
              รายการข้อผิดพลาด
            </h2>

            <div className="flex flex-col gap-2.5 border-b border-base-300 p-3 sm:gap-3 sm:p-4 lg:flex-row lg:items-center lg:p-5">
              <label className="input input-bordered flex min-h-11 min-w-0 flex-1 items-center gap-2">
                <svg aria-hidden="true" className="h-4.5 w-4.5 shrink-0 opacity-70" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={SEARCH_D} />
                </svg>
                <input
                  ref={searchRef}
                  type="search"
                  value={q}
                  maxLength={100}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="ค้นหา Trace ID สถานะ เส้นทาง หรือข้อความผิดพลาด"
                  aria-label="ค้นหา Trace ID สถานะและเส้นทาง หรือข้อความผิดพลาด"
                  className="grow"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="search"
                />
              </label>
              <div className="grid grid-cols-2 gap-2.5 lg:flex lg:shrink-0">
                <div className="min-w-0 lg:w-44">
                  <label className="sr-only" htmlFor="errlog-sev">
                    กรองตามความรุนแรง
                  </label>
                  <select
                    id="errlog-sev"
                    className="select select-bordered min-h-11 w-full"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as IncidentSeverity | '')}
                  >
                    <option value="">ทุกระดับความรุนแรง</option>
                    {INCIDENT_SEVERITY_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0 lg:w-48">
                  <label className="sr-only" htmlFor="errlog-comp">
                    กรองตามบริการหรือโมดูล
                  </label>
                  <select
                    id="errlog-comp"
                    className="select select-bordered min-h-11 w-full"
                    value={component}
                    onChange={(e) => setComponent(e.target.value as IncidentComponent | '')}
                  >
                    <option value="">ทุกบริการ / โมดูล</option>
                    {INCIDENT_COMPONENT_ORDER.map((c) => (
                      <option key={c} value={c}>
                        {INCIDENT_COMPONENT_LABEL[c]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {narrowed && (
                <button
                  type="button"
                  className="btn btn-ghost min-h-11 shrink-0"
                  onClick={() => {
                    clearFilters()
                    searchRef.current?.focus()
                  }}
                >
                  <svg aria-hidden="true" className="h-4.5 w-4.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={CLOSE_D} />
                  </svg>
                  ล้างตัวกรอง
                </button>
              )}
            </div>

            {feed.listError ? (
              <LoadError kind={feed.listError} onRetry={feed.retry} />
            ) : !list ? (
              <>
                <RowsSkeleton />
                <PaginationBarSkeleton />
              </>
            ) : list.total === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-base-200">
                  <svg aria-hidden="true" className="h-8 w-8 text-base-content/60" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={SEARCH_D} />
                  </svg>
                </div>
                <h3 className="m-0 text-[18px] font-semibold text-base-content th-tight">
                  ไม่พบข้อผิดพลาดที่ตรงกับเงื่อนไข
                </h3>
                <p className="mt-1.5 max-w-sm text-[14px] leading-[1.6] text-base-content/70 th-tight">
                  ลองล้างตัวกรองหรือขยายช่วงเวลา
                </p>
                <button
                  type="button"
                  className="btn mt-5 min-h-11"
                  onClick={() => {
                    clearFilters()
                    searchRef.current?.focus()
                  }}
                >
                  ล้างตัวกรองทั้งหมด
                </button>
              </div>
            ) : (
              <>
                <div aria-busy={feed.listLoading || undefined} className={feed.listLoading ? 'opacity-60 transition-opacity' : ''}>
                  <IncidentTable items={list.items} page={list.page} limit={list.limit} onOpen={openIncident} />
                  <IncidentCards items={list.items} page={list.page} limit={list.limit} onOpen={openIncident} />
                </div>
                <PaginationBar
                  page={list.page}
                  pageSize={limit}
                  total={list.total}
                  onPageChange={feed.setPage}
                  onPageSizeChange={(n) => setLimit(n as Limit)}
                  ariaLabel="แบ่งหน้ารายการข้อผิดพลาด"
                  sizeSelectClassName="select select-bordered select-sm min-h-11 w-20 tabular-nums"
                />
              </>
            )}
          </section>
        </>
      )}

      <IncidentDialog incident={selected} open={dialogOpen} onClose={() => setDialogOpen(false)} />

      <ConfirmModal
        open={purgeOpen}
        onClose={() => setPurgeOpen(false)}
        onConfirm={runPurge}
        title="ล้างบันทึกเก่ากว่า 30 วัน"
        who={purge?.who}
        description={purge?.description ?? ''}
        tone="danger"
        confirmLabel="ล้างบันทึก"
        busyLabel="กำลังล้างบันทึก"
      />
    </div>
  )
}
