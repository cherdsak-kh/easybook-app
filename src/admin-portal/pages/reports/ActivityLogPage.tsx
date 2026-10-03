/**
 * `ประวัติการทำรายการ`: `/backend/reports/activity`, Hub 5. Ports prototype
 * `[data-route="reports-activity"]` (markup L8727–9049, module L25846–26487, dialog L12387–12481)
 * onto `GET /reports/activity` (+ `/kpis`, `/actors`, `/csv`) (`02_design_log.md` §2.4, §3.5).
 *
 * The audit trail: who approved, rejected, cancelled or changed what, and when. READ-ONLY, nothing here
 * writes anything except a CSV file.
 *
 * ⚠️ THE KPIs FOLLOW THE RANGE ONLY; THE TOOLBAR NARROWS THE TABLE ONLY. They are separate requests (the
 * KPI route takes dates and nothing else), so a keystroke in the search box cannot move a KPI and does
 * not refetch one. See `useLogFeed`.
 *
 * ⚠️ WHAT THE SOURCE CANNOT RECORD IS NOT DRAWN. Under synthesis (OQ-P3-1) there is no IP or device, no
 * venue-edit history and no rejecter; the page reads `capabilities` and `actor: null` and says so: the
 * IP column, the IP search and the IP rows of the dialog are absent, KPI 3 is `—` with its reason, and an
 * unknown actor reads `ไม่ได้บันทึกผู้กระทำ`. The PO's ruling for Phase 3 is "synthesis only".
 *
 * ⚠️ THE CSV IS THE SERVER'S: `ส่งออก CSV` downloads EVERY row the filters match (not this page) through
 * `GET /reports/activity/csv`, with the same filters, so the file cannot disagree with the table.
 *
 * ⚠️ PERMISSION IS NOT CHECKED HERE. `BackendLayout` redirects a role that may not reach this route
 * before this page mounts (so it fires no request), and `@Roles` on the API is the control.
 */

import { useEffect, useRef, useState } from 'react'
import {
  activityCsvUrl,
  downloadFile,
  getActivity,
  getActivityActors,
  getActivityKpis,
  ApiError,
  type AuditAction,
  type AuditActorOption,
  type AuditPage,
  type AuditEvent,
  type AuditKpis,
} from '@/lib/api-client'
import { EmptyState } from '../../components/feedback/EmptyState'
import { LoadError } from '../../components/feedback/LoadError'
import { Spinner } from '../../components/feedback/Spinner'
import { PageHeading } from '../../components/shell/PageHeading'
import { PaginationBar, PaginationBarSkeleton } from '../../components/ui/PaginationBar'
import { AUDIT_ACTION, AUDIT_ACTION_ORDER } from '../../labels'
import { useBusy } from '../../lib/use-busy'
import { useToast } from '../../lib/toast-context'
import type { AdminRoute } from '../../routes'
import { ActivityDetailDialog } from './components/ActivityDetailDialog'
import { ActivityKpiCards } from './components/ActivityKpiCards'
import { ActivityCards, ActivityTable } from './components/ActivityRows'
import { LogRangeCard } from './components/LogRangeCard'
import { LogPageSkeleton, RowsSkeleton, ToolbarSkeleton } from './components/LogSkeletons'
import { filtersActive, noMatchDesc, searchLabel, searchPlaceholder } from './activity-view'
import { LOG_PRESET_LABEL, clockOf, logRangeEcho, type LogPreset } from './log-range'
import { useLogFeed } from './use-log-feed'
import { useLogRange } from './use-log-range'

/** Hub 5's presets: the four quick ones and กำหนดเอง (it alone has ภาคเรียนปัจจุบัน). */
const PRESETS: readonly LogPreset[] = ['today', '7d', '30d', 'term', 'custom']

const REFRESH_D =
  'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99'
const CSV_D = 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3'
const SEARCH_D = 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
const CLOCK_D = 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z'
const CLOSE_D = 'M6 18L18 6M6 6l12 12'

type Limit = 10 | 20 | 50

export function ActivityLogPage({ route }: { route: AdminRoute }) {
  const toast = useToast()
  const range = useLogRange()

  // ── Toolbar: narrows the TABLE only ────────────────────────────────────────────────────────
  const [q, setQ] = useState('')
  const [qApplied, setQApplied] = useState('')
  const [action, setAction] = useState<AuditAction | ''>('')
  const [actorId, setActorId] = useState('')
  const [limit, setLimit] = useState<Limit>(10)
  const searchRef = useRef<HTMLInputElement>(null)

  // Server-side search is debounced: a keystroke is not a request.
  useEffect(() => {
    const t = setTimeout(() => setQApplied(q), 250)
    return () => clearTimeout(t)
  }, [q])

  const filter = { q: qApplied.trim(), action, actorId }
  const feed = useLogFeed<AuditPage, { kpis: AuditKpis; actors: AuditActorOption[] }>({
    from: range.from,
    to: range.to,
    filterKey: `${filter.q}|${action}|${actorId}|${limit}`,
    fetchMeta: async (signal) => {
      const r = { startDate: range.from, endDate: range.to }
      const [k, a] = await Promise.all([getActivityKpis(r, signal), getActivityActors(r, signal)])
      return { kpis: k.kpis, actors: a.actors }
    },
    fetchList: (page, signal) =>
      getActivity(
        {
          startDate: range.from,
          endDate: range.to,
          action: action || undefined,
          actorId: actorId || undefined,
          q: filter.q || undefined,
          page,
          limit,
        },
        signal,
      ),
  })
  const { meta, list } = feed

  // An actor chosen under one range may have no events under the next: a filter that can never match
  // is a dead end, so it is dropped rather than left selected against an option that is gone.
  useEffect(() => {
    if (meta && actorId && !meta.actors.some((a) => a.id === actorId)) setActorId('')
  }, [meta, actorId])

  const clearFilters = () => {
    setQ('')
    setQApplied('')
    setAction('')
    setActorId('')
  }

  // ── Refresh and CSV ────────────────────────────────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false)
  const refresh = async () => {
    setRefreshing(true)
    const r = await feed.refresh()
    setRefreshing(false)
    if (r.ok) toast('success', `อัปเดตข้อมูลล่าสุดแล้ว เวลา ${clockOf(new Date())} น.`)
  }

  const csv = useBusy()
  const empty = meta !== null && meta.kpis.total === 0
  const csvDisabled = !list || list.total === 0 || empty || csv.busy
  const downloadCsv = () =>
    csv.run(async () => {
      if (!list) return
      try {
        await downloadFile(
          activityCsvUrl({
            startDate: range.from,
            endDate: range.to,
            action: action || undefined,
            actorId: actorId || undefined,
            q: filter.q || undefined,
          }),
          `easybook-audit_${range.from}_${range.to}.csv`,
        )
        toast('success', `ดาวน์โหลดไฟล์ CSV แล้ว ${list.total.toLocaleString('en-US')} รายการ`)
      } catch (err) {
        toast(
          'error',
          err instanceof ApiError && err.status === 403
            ? 'คุณไม่มีสิทธิ์ส่งออกประวัติการทำรายการ'
            : 'ดาวน์โหลดไฟล์ไม่สำเร็จ ลองใหม่อีกครั้ง',
        )
      }
    })

  // ── Detail dialog: the last event stays mounted after close so focus can return to its opener ──
  const [selected, setSelected] = useState<AuditEvent | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const openEvent = (e: AuditEvent) => {
    setSelected(e)
    setDialogOpen(true)
  }

  const caps = list?.capabilities
  const echo = logRangeEcho(range.from, range.to, feed.lastSync)
  const rangeLabel = range.preset === 'custom' ? 'ช่วงวันที่ที่กำหนด' : LOG_PRESET_LABEL[range.preset]
  const narrowed = filtersActive({ q, action, actorId })

  return (
    <div className="card-shell rp-page relative lg:overflow-y-auto">
      <PageHeading
        route={route}
        title="ประวัติการทำรายการ"
        desc="บันทึกประวัติการเปลี่ยนแปลงข้อมูลและการตัดสินใจของเจ้าหน้าที่ เพื่อความโปร่งใสและการตรวจสอบย้อนหลัง"
        descAtEveryWidth
        actions={
          <div className="flex w-full gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing || range.error !== null}
              aria-busy={refreshing || undefined}
              className="btn min-h-11 flex-1 sm:flex-none"
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
            {/* A CSV of what the filters show (every page, not just this one), labelled as one. */}
            <button
              type="button"
              onClick={() => void downloadCsv()}
              disabled={csvDisabled}
              aria-busy={csv.busy || undefined}
              className="btn btn-primary min-h-11 flex-1 sm:flex-none"
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
          </div>
        }
      />

      <LogRangeCard idPrefix="act" presets={PRESETS} range={range} echo={echo} />

      <p role="status" aria-live="polite" className="sr-only">
        {list ? `แสดงประวัติการทำรายการ ${list.total} รายการ` : ''}
      </p>

      {feed.metaError ? (
        <div className="card border border-base-300 bg-base-100 shadow-sm">
          <LoadError kind={feed.metaError} onRetry={feed.retry} />
        </div>
      ) : !meta ? (
        <LogPageSkeleton label="กำลังโหลดประวัติการทำรายการ" />
      ) : empty ? (
        <div className="card border border-base-300 bg-base-100 shadow-sm">
          <EmptyState
            icon={
              <svg aria-hidden="true" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={CLOCK_D} />
              </svg>
            }
            title="ยังไม่มีการทำรายการในช่วงเวลานี้"
            description="ไม่มีเจ้าหน้าที่คนใดอนุมัติ ปฏิเสธ หรือแก้ไขข้อมูลในช่วงที่เลือก ลองขยายช่วงเวลาให้กว้างขึ้น"
            actions={
              <button type="button" className="btn btn-primary min-h-11" onClick={range.reset}>
                ดู 30 วันล่าสุด
              </button>
            }
          />
        </div>
      ) : (
        <>
          <ActivityKpiCards kpis={meta.kpis} />

          <section className="card mt-4 border border-base-300 bg-base-100 shadow-sm" aria-labelledby="act-log-h">
            <h2 id="act-log-h" className="sr-only">
              บันทึกการทำรายการ
            </h2>

            {/* ── ค้นหาและตัวกรอง ── daisyUI throughout: `label.input` for the search, `.select` for
                both dropdowns (daisyUI draws the chevron; no hand-rolled shell). */}
            {caps ? (
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
                    placeholder={searchPlaceholder(caps.recordsIp)}
                    aria-label={searchLabel(caps.recordsIp)}
                    className="grow"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    enterKeyHint="search"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2.5 lg:flex lg:shrink-0">
                  <div className="min-w-0 lg:w-52">
                    <label className="sr-only" htmlFor="act-type">
                      กรองตามประเภทการกระทำ
                    </label>
                    <select
                      id="act-type"
                      className="select select-bordered min-h-11 w-full"
                      value={action}
                      onChange={(e) => setAction(e.target.value as AuditAction | '')}
                    >
                      <option value="">ทุกประเภทการกระทำ</option>
                      {AUDIT_ACTION_ORDER.filter((a) => caps.actions.includes(a)).map((a) => (
                        <option key={a} value={a}>
                          {AUDIT_ACTION[a].label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0 lg:w-52">
                    <label className="sr-only" htmlFor="act-actor">
                      กรองตามเจ้าหน้าที่
                    </label>
                    <select
                      id="act-actor"
                      className="select select-bordered min-h-11 w-full"
                      value={actorId}
                      onChange={(e) => setActorId(e.target.value)}
                    >
                      <option value="">เจ้าหน้าที่ทุกคน</option>
                      {meta.actors.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                          {a.isDeleted ? ' (ลบแล้ว)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* Shown only while a filter narrows the list. */}
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
            ) : (
              <ToolbarSkeleton />
            )}

            {/* ── The rows: stale while a filter or page loads, so the toolbar never unmounts ── */}
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
                  ไม่พบรายการที่ตรงกับเงื่อนไข
                </h3>
                <p className="mt-1.5 max-w-sm text-[14px] leading-[1.6] text-base-content/70 th-tight">
                  {noMatchDesc(rangeLabel)}
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
                  <ActivityTable
                    items={list.items}
                    page={list.page}
                    limit={list.limit}
                    recordsIp={caps?.recordsIp ?? false}
                    onOpen={openEvent}
                  />
                  <ActivityCards items={list.items} recordsIp={caps?.recordsIp ?? false} onOpen={openEvent} />
                </div>
                <PaginationBar
                  page={list.page}
                  pageSize={limit}
                  total={list.total}
                  onPageChange={feed.setPage}
                  onPageSizeChange={(n) => setLimit(n as Limit)}
                  ariaLabel="แบ่งหน้าประวัติการทำรายการ"
                  sizeSelectClassName="select select-bordered select-sm min-h-11 w-20 tabular-nums"
                />
              </>
            )}
          </section>
        </>
      )}

      <ActivityDetailDialog
        event={selected}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        recordsIp={caps?.recordsIp ?? false}
      />
    </div>
  )
}
