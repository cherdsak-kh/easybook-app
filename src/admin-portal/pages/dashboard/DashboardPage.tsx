/**
 * `ภาพรวมระบบ` — `/backend/dashboard`, `Q1`'s `HOME_PATH`. Ports prototype `[data-route="dashboard"]`
 * (markup ~L3343–3544, module "ภาพรวมระบบ (Hub 7)" ~L27055–27357) onto the four real endpoints
 * `02_design_log.md` §2 specifies: `GET /dashboard/vitals`, `GET /dashboard/venues-live`,
 * `GET /system/health`, and the existing `GET /notifications?limit=…` (via the shared
 * `NotificationsProvider`, D-17 — no new endpoint).
 *
 * ⚠️ THIS PAGE OWNS ALMOST NOTHING. Approving a request and creating a direct booking both go
 * through the SAME dialogs `คำขอจองสถานที่` uses (`BookingDetailDialog`/`BookingApproveDialog`/
 * `BookingRejectDialog`/`BookingDirectCreateDialog`) — ADR-001's auto-reject list is computed in
 * exactly one place, and this page only refetches after a write lands (AC-D13/AC-D14).
 *
 * ⚠️ THE PROTOTYPE'S `SCHEDULE` MOCK AND PINNED 13:40 CLOCK DO NOT SHIP (D-2). Every room state,
 * every countdown and the header's own clock come from the server's `serverTime` on each response —
 * this page never calls `new Date()` for anything but "is the tab visible" (polling only).
 *
 * ── Polling (D-16, AC-D21) ──
 * Vitals + venues-live + health load in parallel on mount, on รีเฟรช, every 60s while the route is
 * mounted AND the tab is visible, immediately on becoming visible, and after a successful approve/
 * reject/create from this page's dialogs. Each of the three fails INDEPENDENTLY (AC-D22) — a failed
 * `venues-live` never blanks the queue, and vice versa. `NotificationsProvider` is invalidated on
 * the same cadence rather than fetched a second time (D-17: "there is no new endpoint").
 *
 * ── Roles (D-15) ──
 * VIEWER: the system strip is not mounted at all, and `อนุมัติ`/`จองห้องนี้ทันที` are never rendered
 * (removed from the DOM, not disabled) — `RoomOccupancyCard`/`PendingQueueCard` take `canWrite`.
 * ADMIN: the strip renders, one word per service. SUPER_ADMIN: the strip's numeric chips — the
 * server never builds those numbers into an ADMIN/VIEWER response, so there is nothing to hide here
 * that the wire does not already withhold.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ApiError,
  approveBookingRequest,
  createDirectBooking,
  getBookingRequest,
  getDashboardVenuesLive,
  getDashboardVitals,
  getSystemHealth,
  rejectBookingRequest,
  type BookingRequestDetail,
  type CreateDirectBookingBody,
  type DashboardVenuesLive,
  type DashboardVitals,
  type SystemHealth,
} from '@/lib/api-client'
import { PageHeading } from '../../components/shell/PageHeading'
import { useAcl } from '../../lib/use-acl'
import { useAuth } from '../../lib/auth-context'
import { useNotifications } from '../../lib/notifications-context'
import { useToast } from '../../lib/toast-context'
import type { AdminRoute } from '../../routes'
import { BookingApproveDialog } from '../bookings/components/BookingApproveDialog'
import { BookingDetailDialog, type BookingAction } from '../bookings/components/BookingDetailDialog'
import { BookingDirectCreateDialog } from '../bookings/components/BookingDirectCreateDialog'
import { BookingRejectDialog } from '../bookings/components/BookingRejectDialog'
import { useCreateOptions } from '../bookings/use-create-options'
import { useVenueOptions } from '../bookings/use-venue-options'
import { PendingQueueCard } from './components/PendingQueueCard'
import { RoomOccupancyCard } from './components/RoomOccupancyCard'
import { SystemStatusStrip } from './components/SystemStatusStrip'
import { VitalCards } from './components/VitalCards'
import { serverDateHeading, updatedAtLine } from './dashboard-format'
import type { LoadErrorKind } from '../../components/feedback/LoadError'

/** Long enough to be a real cadence, short enough that "just now" stays true (AC-D21). */
const POLL_MS = 60_000

const REFRESH_TOAST = 'อัปเดตข้อมูลภาพรวมแล้ว'

const kindOf = (err: unknown): LoadErrorKind => {
  const status = err instanceof ApiError ? err.status : 0
  if (status === 0) return 'network'
  if (status === 403) return 'forbidden'
  return 'server'
}

type DialogView = 'detail' | 'approve' | 'reject' | null

export function DashboardPage({ route }: { route: AdminRoute }) {
  const { user } = useAuth()
  const acl = useAcl(user!.role)
  const toast = useToast()
  const notifications = useNotifications()

  const [vitals, setVitals] = useState<DashboardVitals | null>(null)
  const [vitalsError, setVitalsError] = useState<LoadErrorKind | null>(null)
  const [venuesLive, setVenuesLive] = useState<DashboardVenuesLive | null>(null)
  const [venuesError, setVenuesError] = useState<LoadErrorKind | null>(null)
  const [health, setHealth] = useState<(SystemHealth & { apiLatencyMs: number }) | null>(null)
  const [healthError, setHealthError] = useState(false)
  const [live, setLive] = useState('')

  const loadVitals = useCallback(async () => {
    try {
      const res = await getDashboardVitals()
      setVitals(res)
      setVitalsError(null)
    } catch (err) {
      setVitalsError(kindOf(err))
    }
  }, [])

  const loadVenues = useCallback(async () => {
    try {
      const res = await getDashboardVenuesLive()
      setVenuesLive(res)
      setVenuesError(null)
    } catch (err) {
      setVenuesError(kindOf(err))
    }
  }, [])

  const loadHealth = useCallback(async () => {
    try {
      const res = await getSystemHealth()
      setHealth(res)
      setHealthError(false)
    } catch {
      setHealthError(true)
    }
  }, [])

  const pollAll = useCallback(async () => {
    await Promise.all([loadVitals(), loadVenues(), loadHealth()])
    notifications.invalidate()
  }, [loadVitals, loadVenues, loadHealth, notifications])

  /* ── D-16 / AC-D21: initial load, 60s while visible, immediate on becoming visible ────────── */
  useEffect(() => {
    void pollAll()
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void pollAll()
    }, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void pollAll()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pollAll's identity already tracks every input it reads
  }, [])

  const refresh = async () => {
    await pollAll()
    setLive(REFRESH_TOAST)
    toast('success', REFRESH_TOAST)
  }

  /* ── ดูรายละเอียด / อนุมัติ / ปฏิเสธ — the SAME dialogs คำขอจองสถานที่ uses (AC-D13) ─────────── */

  const [view, setView] = useState<DialogView>(null)
  const [targetCode, setTargetCode] = useState<string | null>(null)
  const [detail, setDetail] = useState<BookingRequestDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailFailed, setDetailFailed] = useState(false)
  const [dialogAlert, setDialogAlert] = useState<string | null>(null)
  const [writing, setWriting] = useState(false)
  const wanted = useRef<string | null>(null)
  const anchor = useRef<HTMLElement | null>(null)

  const loadDetail = useCallback(async (id: string) => {
    wanted.current = id
    setDetailLoading(true)
    setDetailFailed(false)
    try {
      const res = await getBookingRequest(id)
      if (wanted.current !== id) return
      setDetail(res)
    } catch {
      if (wanted.current !== id) return
      setDetail(null)
      setDetailFailed(true)
    } finally {
      if (wanted.current === id) setDetailLoading(false)
    }
  }, [])

  /** `initialView`: `'detail'` for ดูรายละเอียด, `'approve'` for the queue's own อนุมัติ shortcut —
   *  either way the fetch runs exactly once. */
  const openDetail = (id: string, code: string, initialView: Exclude<DialogView, null> = 'detail') => {
    const from = document.activeElement
    anchor.current = from instanceof HTMLElement && from !== document.body ? from : null
    setTargetCode(code)
    setDetail(null)
    setDetailFailed(false)
    setDialogAlert(null)
    setView(initialView)
    void loadDetail(id)
  }

  useEffect(() => {
    if (view !== null) return
    const back = anchor.current
    anchor.current = null
    if (back?.isConnected) back.focus()
  }, [view])

  const closeDetail = () => {
    if (view !== 'detail') return
    setView(null)
  }
  const backToDetail = (from: Exclude<DialogView, 'detail' | null>) => () => {
    if (view !== from) return
    setDialogAlert(null)
    setView('detail')
  }

  const finishWrite = async (message: string) => {
    setView(null)
    setDialogAlert(null)
    toast('success', message)
    await pollAll()
  }

  const WRITE_FAILED = 'บันทึกไม่สำเร็จ ยังไม่มีอะไรเปลี่ยนแปลง · ลองใหม่อีกครั้ง'
  const failWrite = async (err: unknown, conflictMsg: string) => {
    const status = err instanceof ApiError ? err.status : 0
    if (status === 404 || status === 409 || status === 403) {
      setView(null)
      toast(
        'error',
        status === 403
          ? 'บัญชีของคุณไม่มีสิทธิ์ดำเนินการนี้ · โปรดติดต่อผู้ดูแลระบบ'
          : status === 404
            ? 'ไม่พบคำขอนี้ในระบบแล้ว · ระบบดึงข้อมูลล่าสุดให้แล้ว'
            : conflictMsg,
      )
      await pollAll()
      return
    }
    setDialogAlert(WRITE_FAILED)
  }

  const runApprove = async () => {
    if (!detail || writing) return
    setWriting(true)
    setDialogAlert(null)
    try {
      const res = await approveBookingRequest(detail.id)
      const n = res.autoRejected.length
      await finishWrite(
        n > 0
          ? `อนุมัติคำขอ ${res.booking.code} แล้ว · ปฏิเสธคำขอที่เวลาชนกันอัตโนมัติ ${n} คำขอ`
          : `อนุมัติคำขอ ${res.booking.code} แล้ว`,
      )
    } catch (err) {
      await failWrite(err, 'คำขอนี้ถูกพิจารณาไปแล้ว หรือช่วงเวลานี้ถูกจองไปก่อนหน้าแล้ว · ระบบดึงข้อมูลล่าสุดให้แล้ว')
    } finally {
      setWriting(false)
    }
  }

  const runReject = async (reason: string) => {
    if (!detail || writing) return
    setWriting(true)
    setDialogAlert(null)
    try {
      const res = await rejectBookingRequest(detail.id, reason)
      await finishWrite(`ปฏิเสธคำขอ ${res.code} แล้ว`)
    } catch (err) {
      await failWrite(err, 'คำขอนี้ไม่ได้อยู่ในสถานะรอพิจารณาแล้ว · ระบบดึงข้อมูลล่าสุดให้แล้ว')
    } finally {
      setWriting(false)
    }
  }

  /* ── จองห้องนี้ทันที (AC-D8) — the SAME create dialog สร้างคำจองสถานที่ uses, venue pre-picked ── */

  const [createOpen, setCreateOpen] = useState(false)
  const [createOpenKey, setCreateOpenKey] = useState(0)
  const [createVenueId, setCreateVenueId] = useState<string | undefined>(undefined)
  const [createBusy, setCreateBusy] = useState(false)
  const [createAlert, setCreateAlert] = useState<string | null>(null)
  const [createRecheck, setCreateRecheck] = useState(0)
  const [venueReloadKey, setVenueReloadKey] = useState(0)
  const venueOptions = useVenueOptions(venueReloadKey)
  const createOptions = useCreateOptions(createOpenKey, createOpen)

  const openCreate = (venueId: string) => {
    setCreateAlert(null)
    setCreateVenueId(venueId)
    setCreateOpenKey((k) => k + 1)
    setCreateOpen(true)
  }

  const runCreate = async (body: CreateDirectBookingBody) => {
    if (createBusy) return
    setCreateBusy(true)
    setCreateAlert(null)
    try {
      const res = await createDirectBooking(body)
      setCreateOpen(false)
      const n = res.autoRejected.length
      toast(
        'success',
        `สร้างการจอง ${res.booking.code} แล้ว (อนุมัติทันที)` +
          (n > 0 ? ` · ปฏิเสธคำขอที่เวลาชนกันอัตโนมัติ ${n} คำขอ` : ''),
      )
      await pollAll()
    } catch (err) {
      const code = err instanceof ApiError ? err.status : 0
      if (code === 403) {
        setCreateOpen(false)
        toast('error', 'บัญชีของคุณไม่มีสิทธิ์ดำเนินการนี้ · โปรดติดต่อผู้ดูแลระบบ')
        return
      }
      setCreateAlert(
        code === 409
          ? 'ช่วงเวลานี้ถูกจองไปก่อนหน้าแล้ว · ยังไม่มีการบันทึกใด ๆ · เปลี่ยนวัน เวลา หรือสถานที่แล้วลองอีกครั้ง'
          : code === 404
            ? 'ไม่พบสถานที่นี้ในระบบแล้ว · ระบบดึงรายชื่อสถานที่ล่าสุดให้แล้ว · เลือกสถานที่อีกครั้ง'
            : code === 400 && err instanceof ApiError
              ? err.message
              : WRITE_FAILED,
      )
      setCreateRecheck((k) => k + 1)
      if (code === 404) setVenueReloadKey((k) => k + 1)
    } finally {
      setCreateBusy(false)
    }
  }

  const serverTime = vitals?.serverTime ?? venuesLive?.serverTime ?? null

  return (
    <div className="card-shell relative lg:overflow-y-auto">
      <PageHeading
        route={route}
        desc="สรุปคำขอจอง การใช้งานสถานที่ และสถานะของระบบในหน้าเดียว"
        descAtEveryWidth
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <p className="m-0 flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-control border border-base-300 bg-base-100 px-3 text-[13px] text-base-content/80 sm:flex-none">
              {serverTime ? (
                <span className="min-w-0">
                  <span className="font-medium text-base-content">{serverDateHeading(serverTime)}</span>{' '}
                  · <span className="whitespace-nowrap tabular-nums">{updatedAtLine(serverTime)}</span>
                </span>
              ) : (
                <span className="min-w-0 text-base-content/60">กำลังโหลด…</span>
              )}
            </p>
            <button type="button" onClick={() => void refresh()} className="btn btn-sm btn-ghost whitespace-nowrap">
              รีเฟรช
            </button>
          </div>
        }
      />
      <p role="status" aria-live="polite" className="sr-only">
        {live}
      </p>

      <VitalCards
        acl={acl}
        vitals={vitals}
        vitalsError={vitalsError !== null}
        venuesLive={venuesLive}
        venuesError={venuesError !== null}
        health={health}
        healthError={healthError}
      />

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
        <RoomOccupancyCard
          data={venuesLive}
          error={venuesError}
          onRetry={() => void loadVenues()}
          canWrite={acl.write}
          onBookNow={(venueId) => openCreate(venueId)}
        />
        <PendingQueueCard
          data={vitals}
          error={vitalsError}
          onRetry={() => void loadVitals()}
          canWrite={acl.write}
          onViewDetail={(id) => {
            const item = vitals?.pendingQueue.find((q) => q.id === id)
            openDetail(id, item?.code ?? '')
          }}
          onApprove={(id) => {
            const item = vitals?.pendingQueue.find((q) => q.id === id)
            openDetail(id, item?.code ?? '', 'approve')
          }}
          notifications={notifications.bell}
        />
      </div>

      {acl.role !== 'VIEWER' && <SystemStatusStrip health={health} error={healthError} />}

      {/* ── The three dialogs — mounted always, closed rather than unrendered (Modal's own rule) ── */}
      <BookingDetailDialog
        open={view === 'detail'}
        onClose={closeDetail}
        row={targetCode ? { code: targetCode } : null}
        detail={detail}
        loading={detailLoading}
        failed={detailFailed}
        onRetry={() => {
          if (detail) void loadDetail(detail.id)
        }}
        canWrite={acl.write}
        alert={dialogAlert}
        onAction={(action: BookingAction) => {
          if (!detail) return
          setDialogAlert(null)
          setView(action === 'approve' ? 'approve' : action === 'reject' ? 'reject' : 'detail')
        }}
      />
      <BookingApproveDialog
        open={view === 'approve'}
        onClose={backToDetail('approve')}
        detail={detail}
        alert={dialogAlert}
        busy={writing}
        onConfirm={() => void runApprove()}
      />
      <BookingRejectDialog
        open={view === 'reject'}
        onClose={backToDetail('reject')}
        detail={detail}
        alert={dialogAlert}
        busy={writing}
        onConfirm={(reason) => void runReject(reason)}
      />
      <BookingDirectCreateDialog
        open={createOpen}
        onClose={() => {
          if (createBusy) return
          setCreateOpen(false)
        }}
        venues={venueOptions.venues}
        venuesError={venueOptions.error}
        users={createOptions.users}
        usersError={createOptions.usersError}
        usersTruncated={createOptions.usersTruncated}
        departments={createOptions.departments}
        departmentsError={createOptions.departmentsError}
        alert={createAlert}
        busy={createBusy}
        recheckKey={createRecheck}
        initialVenueId={createVenueId}
        onSubmit={(body) => void runCreate(body)}
        onCreateDepartment={createOptions.createDepartment}
        onOpenDepartments={createOptions.refreshDepartments}
      />
    </div>
  )
}
