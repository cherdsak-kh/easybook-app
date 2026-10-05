/**
 * ประวัติการเข้าสู่ระบบ — `/backend/profile/sessions`, `GET /auth/system/sessions` and
 * `GET /auth/system/login-history`.
 *
 * A PERSONAL security view, reached by every role: it answers "where is MY account signed in?",
 * not "who approved what" (that is ประวัติการทำรายการ). A SUPER_ADMIN looking at SOMEONE ELSE's
 * sessions does that from the เจ้าหน้าที่ระบบ detail dialog, never from here — nothing on this page
 * takes an account id.
 *
 * Three cards, one shell (`.pf-card`, as โปรไฟล์ and เปลี่ยนรหัสผ่าน):
 *   1 · this device   — read-only. Ending the session you are typing in is ออกจากระบบ in the
 *       account menu, not a row here, so the server's 400 for "your own handle" is unreachable.
 *   2 · other devices — the only place anything is written, and both writes go through
 *       `ConfirmModal`. The list is ALWAYS refetched afterwards: handles are opaque and the server
 *       is the only thing that knows which sessions are still alive.
 *   3 · login history — read-only, 90 days, failed attempts included (a failed attempt is the line
 *       a person scans for). Paged by the portal's own `PaginationBar`, never daisyUI `.join`.
 *
 * ⚠️ NO LOCATION ROW. The prototype draws ตำแหน่งโดยประมาณ on card 1 and a location line on each
 * device in card 2. That needs GeoIP, which sends addresses to a third party and was ruled out
 * (OQ-3, PO/CTO 2026-10-04). Recorded deviation from the design authority — no empty row stands in
 * for it.
 *
 * ⚠️ E3's 404 IS SUCCESS. The device was already gone (expired, or ended from another tab), which is
 * what the operator asked for. It refetches and toasts the same line as a 200.
 *
 * ⚠️ THE TWO REQUESTS FAIL INDEPENDENTLY. Card 3's table can be down while cards 1 and 2 are fine,
 * and a whole-page error panel would hide the part that worked, so each card carries its own.
 *
 * ⚠️ THE TABLE STARTS AT `xl`, the same split and the same breakpoint as ประวัติการทำรายการ, measured
 * there: six columns do not fit the 671px content area at 1024. Below `xl` every attempt is a card.
 *
 * Page and size are component state, so leaving the page resets both without any code saying so
 * (prototype `__sessionsReset`).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ApiError,
  getLoginHistory,
  getSessions,
  revokeOtherSessions,
  revokeSession,
  type LoginHistoryItem,
  type LoginHistoryLimit,
  type LoginHistoryPage,
  type SessionItem,
  type SessionList,
} from '@/lib/api-client'
import { ConfirmModal } from '../../components/feedback/ConfirmModal'
import { LoadError, type LoadErrorKind } from '../../components/feedback/LoadError'
import { Skeleton } from '../../components/feedback/Skeleton'
import { PageHeading } from '../../components/shell/PageHeading'
import { PaginationBar, PaginationBarSkeleton } from '../../components/ui/PaginationBar'
import {
  browserLabel,
  DEVICE_ICON,
  deviceAndOs,
  HISTORY_STATUS,
  ipLabel,
  osLabel,
  otherDeviceTitle,
} from '../../lib/session-labels'
import { thaiDate, thaiDateTime, thaiTime } from '../../lib/thai-date'
import { useToast } from '../../lib/toast-context'
import { HOME_PATH, type AdminRoute } from '../../routes'

const PAGE_SIZES: readonly LoginHistoryLimit[] = [10, 20, 50]
const DEFAULT_SIZE: LoginHistoryLimit = 10

/** The `d` of the empty state's tick (card 2). */
const TICK_D = 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z'

/** `ApiError` → which of the three error panels. A non-`ApiError` is a request that never arrived. */
const kindOf = (err: unknown): LoadErrorKind => {
  const status = err instanceof ApiError ? err.status : 0
  if (status === 0) return 'network'
  if (status === 403) return 'forbidden'
  return 'server'
}

/** The prototype's `revokeSession` / `revokeOthers` copy (L14578–14589) and result lines (L14660–14663). */
const CONFIRM = {
  one: {
    title: 'ยืนยันการออกจากระบบอุปกรณ์นี้',
    desc: 'อุปกรณ์เครื่องนั้นจะถูกออกจากระบบทันที และต้องเข้าสู่ระบบใหม่จึงจะใช้งานต่อได้ · อุปกรณ์ที่คุณใช้อยู่ตอนนี้ไม่ได้รับผลกระทบ',
    label: 'ออกจากระบบ',
    busy: 'กำลังออกจากระบบ…',
    ok: (n: string) => `ออกจากระบบ ${n} แล้ว`,
    fail: (n: string) => `ออกจากระบบ ${n} ไม่สำเร็จ — อุปกรณ์นั้นยังเข้าสู่ระบบอยู่ ลองใหม่อีกครั้ง`,
  },
  all: {
    title: 'ยืนยันการออกจากระบบอุปกรณ์อื่นทั้งหมด',
    desc: 'ทุกอุปกรณ์ที่เข้าสู่ระบบบัญชีนี้อยู่ ยกเว้นเครื่องที่คุณใช้อยู่ตอนนี้ จะถูกออกจากระบบทันที และต้องเข้าสู่ระบบใหม่จึงจะใช้งานต่อได้',
    label: 'ออกจากระบบทั้งหมด',
    busy: 'กำลังออกจากระบบ…',
    ok: (n: string) => `ออกจากระบบ${n}แล้ว`,
    fail: (n: string) => `ออกจากระบบ${n}ไม่สำเร็จ — อุปกรณ์เหล่านั้นยังเข้าสู่ระบบอยู่ ลองใหม่อีกครั้ง`,
  },
} as const

type Asking = { kind: 'one'; item: SessionItem } | { kind: 'all'; count: number }

export function SessionsPage({ route }: { route: AdminRoute }) {
  const navigate = useNavigate()
  const toast = useToast()

  const [sessions, setSessions] = useState<SessionList | null>(null)
  const [sessionsError, setSessionsError] = useState<LoadErrorKind | null>(null)

  const [history, setHistory] = useState<LoginHistoryPage | null>(null)
  const [historyError, setHistoryError] = useState<LoadErrorKind | null>(null)
  const [historyBusy, setHistoryBusy] = useState(false)
  const [page, setPage] = useState(1)
  const [size, setSize] = useState<LoginHistoryLimit>(DEFAULT_SIZE)

  const [asking, setAsking] = useState<Asking | null>(null)

  const loadSessions = useCallback(async () => {
    setSessionsError(null)
    try {
      setSessions(await getSessions())
    } catch (err) {
      setSessions(null)
      setSessionsError(kindOf(err))
    }
  }, [])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  /** Only the NEWEST history request may write state — paging quickly must not land page 2 over page 3. */
  const historyReq = useRef(0)
  const loadHistory = useCallback(async () => {
    const mine = ++historyReq.current
    setHistoryError(null)
    setHistoryBusy(true)
    try {
      const res = await getLoginHistory({ page, limit: size })
      if (mine !== historyReq.current) return
      // Clamp instead of committing an over-page answer: it is empty by definition, and painting it
      // would flash the empty panel under a pager that insists there are rows.
      const last = Math.max(1, Math.ceil(res.meta.total / size))
      if (page > last) {
        setPage(last)
        return
      }
      setHistory(res)
    } catch (err) {
      if (mine !== historyReq.current) return
      setHistory(null)
      setHistoryError(kindOf(err))
    } finally {
      if (mine === historyReq.current) setHistoryBusy(false)
    }
  }, [page, size])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const confirm = async () => {
    if (!asking) return
    const cfg = CONFIRM[asking.kind]
    const who =
      asking.kind === 'one' ? otherDeviceTitle(asking.item.device) : `อุปกรณ์อื่น ${asking.count} เครื่อง`
    try {
      if (asking.kind === 'one') {
        try {
          await revokeSession(asking.item.handle)
        } catch (err) {
          // Already gone — see the header. Anything else is a real failure.
          if (!(err instanceof ApiError && err.status === 404)) throw err
        }
      } else {
        await revokeOtherSessions()
      }
      setAsking(null)
      await loadSessions()
      toast('success', cfg.ok(who))
    } catch {
      // The dialog closes on a failure too (a confirm that stays open after a refusal reads as
      // "still working"); the list is refetched so what is on screen is what the server holds.
      setAsking(null)
      await loadSessions()
      toast('error', cfg.fail(who))
    }
  }

  const others = sessions?.others ?? []
  const noOthers = sessions !== null && others.length === 0

  return (
    <div className="card-shell lg:overflow-y-auto">
      <PageHeading
        route={route}
        desc="ตรวจสอบอุปกรณ์ เวลา และประวัติการเข้าสู่ระบบของบัญชีคุณ เพื่อความปลอดภัย"
      />

      <div className="flex w-full max-w-[1016px] flex-col gap-4 pb-1">
        {/* ══ 1 · อุปกรณ์นี้ ══ */}
        <section className="pf-card" aria-labelledby="ss-cur-title">
          <div className="pf-head">
            <div className="min-w-0">
              <h2 id="ss-cur-title" className="pf-title">
                เซสชันปัจจุบัน
              </h2>
              <p className="pf-note">อุปกรณ์ที่คุณใช้เปิดหน้านี้อยู่ตอนนี้</p>
            </div>
            {sessions && <span className="badge badge-success shrink-0">อุปกรณ์นี้ (กำลังใช้งาน)</span>}
          </div>
          <div className="pf-body">
            {sessionsError ? (
              <LoadError
                kind={sessionsError}
                onRetry={() => void loadSessions()}
                onLeave={() => void navigate(HOME_PATH)}
              />
            ) : sessions === null ? (
              <div aria-busy="true">
                <span className="sr-only" role="status">
                  กำลังโหลดเซสชันปัจจุบัน
                </span>
                <div className="grid gap-x-8 sm:grid-cols-2" aria-hidden="true">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="field-row">
                      <Skeleton variant="soft" className="h-3.5" width="7rem" />
                      <Skeleton className="h-4" width="10rem" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <dl className="m-0 grid gap-x-8 sm:grid-cols-2">
                <div className="field-row">
                  <dt className="field-label">อุปกรณ์ / ระบบ</dt>
                  <dd className="field-value m-0">{deviceAndOs(sessions.current.device)}</dd>
                </div>
                <div className="field-row">
                  <dt className="field-label">เบราว์เซอร์</dt>
                  <dd className="field-value m-0">{browserLabel(sessions.current.device)}</dd>
                </div>
                <div className="field-row">
                  <dt className="field-label">หมายเลข IP</dt>
                  <dd className="field-value m-0 font-mono tabular-nums">
                    {ipLabel(sessions.current.ipAddress)}
                  </dd>
                </div>
                <div className="field-row">
                  <dt className="field-label">เข้าสู่ระบบเมื่อ</dt>
                  <dd className="field-value m-0 tabular-nums">
                    {thaiDateTime(sessions.current.loginAt)}
                  </dd>
                </div>
              </dl>
            )}
          </div>
        </section>

        {/* ══ 2 · อุปกรณ์อื่นที่กำลังใช้งาน ══
            `flex-wrap` on the head so the header action drops under the title on a 390px phone
            instead of squeezing it. `hidden` goes on the plain wrapper around the button, never on
            the `.btn` itself — a display utility on the button would beat it. */}
        <section className="pf-card overflow-hidden" aria-labelledby="ss-oth-title">
          <div className="pf-head flex-wrap sm:flex-nowrap">
            <div className="min-w-0">
              <h2 id="ss-oth-title" className="pf-title">
                อุปกรณ์อื่นที่กำลังใช้งาน
              </h2>
              <p className="pf-note">หากพบอุปกรณ์ที่คุณไม่รู้จัก ให้ออกจากระบบทันทีแล้วเปลี่ยนรหัสผ่าน</p>
            </div>
            <div className={`w-full sm:w-auto sm:shrink-0 ${others.length ? '' : 'hidden'}`.trim()}>
              <button
                type="button"
                onClick={() => setAsking({ kind: 'all', count: others.length })}
                className="btn btn-outline btn-error btn-sm min-h-11 w-full sm:w-auto"
              >
                ออกจากระบบอุปกรณ์อื่นทั้งหมด
              </button>
            </div>
          </div>

          {sessionsError ? (
            /* The same request failed for card 1, which carries the panel and the retry button. A
               second panel here would be two headings both grabbing focus for one failure. */
            <p className="m-0 px-4 py-6 text-center text-[14px] text-base-content/70 sm:px-5">
              โหลดรายการอุปกรณ์อื่นไม่สำเร็จ · ลองใหม่ได้ที่การ์ดเซสชันปัจจุบันด้านบน
            </p>
          ) : sessions === null ? (
            <div aria-busy="true">
              <span className="sr-only" role="status">
                กำลังโหลดอุปกรณ์อื่น
              </span>
              <ul className="m-0 list-none divide-y divide-base-300 p-0" aria-hidden="true">
                {[0, 1].map((i) => (
                  <li key={i} className="flex items-start gap-3.5 px-4 py-4 sm:px-5">
                    <Skeleton variant="box" className="h-9 w-9 shrink-0 rounded-control" />
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <Skeleton className="h-3.5" width="11rem" />
                      <Skeleton variant="soft" className="h-3" width="16rem" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : noOthers ? (
            <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-base-200">
                <svg
                  aria-hidden="true"
                  className="h-7 w-7 text-base-content/60"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={TICK_D} />
                </svg>
              </div>
              <h3 className="m-0 text-[16px] font-semibold text-base-content th-tight">
                ไม่มีอุปกรณ์อื่นที่กำลังใช้งาน
              </h3>
              <p className="mt-1.5 max-w-sm text-[14px] leading-[1.6] text-base-content/70 th-tight">
                บัญชีของคุณเข้าสู่ระบบอยู่เฉพาะอุปกรณ์เครื่องนี้เท่านั้น
              </p>
            </div>
          ) : (
            <ul className="m-0 list-none divide-y divide-base-300 p-0">
              {others.map((s) => {
                const title = otherDeviceTitle(s.device)
                return (
                  <li
                    key={s.handle}
                    className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5"
                  >
                    <span className="flex min-w-0 flex-1 items-start gap-3.5">
                      <span className="pf-row-ico">
                        <svg
                          aria-hidden="true"
                          className="h-4.5 w-4.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d={DEVICE_ICON[s.device.deviceType]}
                          />
                        </svg>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium text-base-content/90">{title}</span>
                        <span className="mt-0.5 block text-[13px] leading-[1.5] text-base-content/70">
                          IP {ipLabel(s.ipAddress)} · ใช้งานล่าสุด {thaiDateTime(s.lastActiveAt)}
                        </span>
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setAsking({ kind: 'one', item: s })}
                      aria-label={`ออกจากระบบ ${title}`}
                      className="btn btn-ghost btn-sm min-h-11 w-full text-error sm:w-auto"
                    >
                      ออกจากระบบ
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* ══ 3 · ประวัติการเข้าสู่ระบบ ══ */}
        <section className="pf-card overflow-hidden" aria-labelledby="ss-his-title">
          <div className="pf-head">
            <div className="min-w-0">
              <h2 id="ss-his-title" className="pf-title">
                ประวัติการเข้าสู่ระบบ
              </h2>
              <p className="pf-note">รวมทั้งครั้งที่เข้าสู่ระบบไม่สำเร็จ · เก็บย้อนหลัง 90 วัน</p>
            </div>
          </div>

          {historyError ? (
            <LoadError
              kind={historyError}
              onRetry={() => void loadHistory()}
              onLeave={() => void navigate(HOME_PATH)}
            />
          ) : history === null ? (
            <div aria-busy="true">
              <span className="sr-only" role="status">
                กำลังโหลดประวัติการเข้าสู่ระบบ
              </span>
              <ul className="m-0 list-none divide-y divide-base-300 p-0" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((i) => (
                  <li key={i} className="flex flex-col gap-2 px-4 py-4 sm:px-5">
                    <span className="flex items-center justify-between gap-2">
                      <Skeleton variant="soft" className="h-3.5" width="9rem" />
                      <Skeleton variant="box" className="h-6 rounded-full" width="5rem" />
                    </span>
                    <Skeleton className="h-3.5" width="12rem" />
                    <Skeleton variant="soft" className="h-3" width="8rem" />
                  </li>
                ))}
              </ul>
              <PaginationBarSkeleton />
            </div>
          ) : history.meta.total === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
              <h3 className="m-0 text-[16px] font-semibold text-base-content th-tight">
                ยังไม่มีประวัติการเข้าสู่ระบบ
              </h3>
              <p className="mt-1.5 max-w-sm text-[14px] leading-[1.6] text-base-content/70 th-tight">
                ระบบเก็บประวัติเฉพาะการเข้าสู่ระบบหลังเปิดใช้ฟีเจอร์นี้ ย้อนหลังไม่เกิน 90 วัน
              </p>
            </div>
          ) : (
            <>
              <div aria-busy={historyBusy || undefined} className={historyBusy ? 'opacity-60' : ''}>
                <HistoryTable items={history.data} offset={(history.meta.page - 1) * history.meta.limit} />
                <HistoryCards items={history.data} />
              </div>

              <PaginationBar
                page={history.meta.page}
                pageSize={size}
                total={history.meta.total}
                pageSizeOptions={PAGE_SIZES}
                onPageChange={setPage}
                onPageSizeChange={(n) => {
                  setSize(n as LoginHistoryLimit)
                  setPage(1)
                }}
                ariaLabel="แบ่งหน้าประวัติการเข้าสู่ระบบ"
                sizeSelectClassName="select select-bordered select-sm min-h-11 w-20 tabular-nums"
              />
            </>
          )}
        </section>
      </div>

      <ConfirmModal
        open={asking !== null}
        onClose={() => setAsking(null)}
        onConfirm={confirm}
        title={asking ? CONFIRM[asking.kind].title : ''}
        who={
          asking
            ? asking.kind === 'one'
              ? `${otherDeviceTitle(asking.item.device)}${
                  asking.item.ipAddress ? ` · ${asking.item.ipAddress}` : ''
                }`
              : `อุปกรณ์อื่น ${asking.count} เครื่อง`
            : undefined
        }
        description={asking ? CONFIRM[asking.kind].desc : ''}
        tone="danger"
        confirmLabel={asking ? CONFIRM[asking.kind].label : ''}
        busyLabel={asking ? CONFIRM[asking.kind].busy : undefined}
      />
    </div>
  )
}

/** The table from `xl` — see the page header for why not `lg`. */
function HistoryTable({ items, offset }: { items: LoginHistoryItem[]; offset: number }) {
  return (
    <div className="hidden overflow-x-auto xl:block">
      <table className="table">
        <thead>
          <tr>
            <th scope="col" className="w-14 text-center">
              ลำดับ
            </th>
            <th scope="col" className="whitespace-nowrap">
              วัน-เวลา
            </th>
            <th scope="col">อุปกรณ์ / เบราว์เซอร์</th>
            <th scope="col" className="whitespace-nowrap">
              หมายเลข IP
            </th>
            <th scope="col">สถานะ</th>
            <th scope="col">รายละเอียด</th>
          </tr>
        </thead>
        <tbody>
          {items.map((h, i) => {
            const st = HISTORY_STATUS[h.status]
            return (
              <tr key={h.id}>
                <td className="w-14 text-center tabular-nums text-base-content/70">{offset + i + 1}</td>
                <td className="whitespace-nowrap">
                  <span className="block text-[14px] text-base-content/90">{thaiDate(h.createdAt)}</span>
                  <span className="block text-[12px] text-base-content/60 tabular-nums">
                    {thaiTime(h.createdAt)}
                  </span>
                </td>
                <td>
                  <span className="block text-[14px] text-base-content/90">
                    {h.device ? browserLabel(h.device) : '—'}
                  </span>
                  <span className="block text-[12px] text-base-content/60">
                    {h.device ? osLabel(h.device) : '—'}
                  </span>
                </td>
                <td>
                  <span className="whitespace-nowrap font-mono text-[13px] text-base-content/80">
                    {ipLabel(h.ipAddress)}
                  </span>
                </td>
                <td>
                  <span className={`badge ${st.badge}`}>{st.label}</span>
                </td>
                <td>
                  <span className="text-[13px] leading-[1.55] text-base-content/80">
                    {st.note(h.isCurrentSession)}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Below `xl`: one card per attempt. */
function HistoryCards({ items }: { items: LoginHistoryItem[] }) {
  return (
    <ul className="m-0 list-none divide-y divide-base-300 p-0 xl:hidden">
      {items.map((h) => {
        const st = HISTORY_STATUS[h.status]
        return (
          <li key={h.id} className="flex flex-col gap-1.5 px-4 py-4 sm:px-5">
            <span className="flex w-full items-center justify-between gap-2">
              <span className="text-[13px] text-base-content/70 tabular-nums">
                {thaiDate(h.createdAt)} {thaiTime(h.createdAt)}
              </span>
              <span className={`badge shrink-0 ${st.badge}`}>{st.label}</span>
            </span>
            <span className="text-[14px] font-medium text-base-content/90">
              {h.device ? `${browserLabel(h.device)} · ${osLabel(h.device)}` : '—'}
            </span>
            <span className="font-mono text-[13px] text-base-content/70">IP {ipLabel(h.ipAddress)}</span>
            <span className="text-[13px] leading-[1.55] text-base-content/80">
              {st.note(h.isCurrentSession)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
