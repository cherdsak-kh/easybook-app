import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  bookingState,
  canCancelSlot,
  cancelRouteFor,
  crossesDay,
  isHistory,
  liveSlots,
  type BookingDetail,
  type BookingSlot,
  type BookingState,
} from './booking-state'
import {
  cancelSlot,
  cancelWholeBooking,
  getMyBookingDetail,
  isNotFound,
  messageFor,
} from './bookings-api'
import { BookingSubject, StateBadge } from './components/BookingCard'
import { useToast } from '@/client-portal/components/feedback/toast-context'
import { SCREEN_WIDTH, ScreenHeader } from '@/client-portal/components/ui/ScreenHeader'
import { LIcon } from '@/client-portal/icons/LucideIcon'
import type { LIconName } from '@/client-portal/icons/licon'
import { TH_DOW_FULL, fmtD, fmtSlot, fmtT, fmtTe } from '@/client-portal/lib/formatters'

/**
 * `#/booking/:id` — one booking, and the only place in the portal anything is cancelled.
 * Prototype 1618–1634 and `paintBookingDetail` (4950).
 *
 * ── 🔴 THE SIX STATES DIFFER IN THE **ORDER AND NUMBER OF BOXES**, NOT IN ONE BOX'S TEXT ──
 * Which is why the whole body is composed here rather than written as fixed markup with six sets of
 * `hidden` to keep in step. A rejected booking puts the reason **above** the details, because
 * somebody opening a rejected request did not come to re-read which room they asked for.
 *
 * ── ⚠️ DOCKLESS, AND NOTHING HERE SAYS SO ──
 * `NAV_SCREENS` omits `booking-detail` and `LiffShell` reads that table, so the dock cannot disagree
 * with the routes file. The way back is the breadcrumb (`D-C14`) plus a labelled link at the end of
 * the content — never a back arrow, which would race LIFF's own (`D-C3`).
 *
 * ── ⚠️ EVERY `alert-soft` SPAN CARRIES `text-base-content` ──
 * Phase 5b measured daisyUI's soft alerts in the LIGHT theme: success 3.45, warning **2.04**, error
 * 4.36 — all under AA, all passing in dark, which is why it hid for two phases. The fix goes on the
 * `<span>`, never on the alert container: on the container it greys the icon too and the three
 * levels stop being distinguishable at a glance.
 */

/** The standing note each state gets under its heading. Prototype `BD_NOTE` (4941). */
const STATE_NOTE: Partial<
  Record<BookingState, { kind: string; icon: LIconName; text: string }>
> = {
  pending: {
    kind: 'alert-warning',
    icon: 'clock',
    text: 'เจ้าหน้าที่กำลังตรวจสอบคำขอของคุณ ผลการพิจารณาจะแจ้งเตือนผ่าน LINE Official Account',
  },
  approved: {
    kind: 'alert-info',
    icon: 'info',
    text: 'กรุณาแสดงหน้านี้ต่อเจ้าหน้าที่ดูแลอาคารก่อนเข้าใช้สถานที่',
  },
  done: {
    kind: 'alert-info',
    icon: 'history',
    text: 'การใช้งานสถานที่นี้เสร็จสิ้นสมบูรณ์แล้ว',
  },
  expired: {
    kind: 'alert-warning',
    icon: 'clock',
    text: 'คำขอนี้เลยกำหนดการใช้งานไปแล้วโดยยังไม่ได้รับการพิจารณา',
  },
  cancelled: {
    kind: 'alert-info',
    icon: 'circleX',
    text: 'คำขอนี้ถูกยกเลิกแล้ว ช่วงเวลาดังกล่าวถูกปล่อยว่างให้ผู้อื่นขอใช้ได้',
  },
}

/** What the confirmation sheet is about to release. `slot: null` means the whole request. */
type Pending = { slot: BookingSlot | null }

export function BookingDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const showToast = useToast()

  const [booking, setBooking] = useState<BookingDetail | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    let cancelled = false
    setFailure(null)
    void (async () => {
      try {
        const row = await getMyBookingDetail(id)
        if (!cancelled) setBooking(row)
      } catch (error) {
        if (cancelled) return
        /* 🔴 A BAD `:id` GOES TO `/bookings`, NOT TO AN ERROR SCREEN (`PAGE_INDEX.md` §2.3). The
           404 also covers "this is somebody else's booking" — the server answers both identically
           because `code` is guessable — so there is nothing to explain here that would be true in
           both cases, and the list is where a reader looking for their own request belongs. */
        if (isNotFound(error)) {
          navigate('/bookings', { replace: true })
          return
        }
        console.warn('[booking] detail failed:', error)
        setFailure(messageFor(error))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, navigate])

  const ask = useCallback((slot: BookingSlot | null) => {
    setPending({ slot })
    dialogRef.current?.showModal()
  }, [])

  /**
   * 🔴 WHICH ENDPOINT IS DECIDED BY THE **STATUS**, NEVER BY WHICH BUTTON WAS PRESSED. A single-slot
   * APPROVED booking draws one full-width "ยกเลิกการจองนี้" that looks exactly like the PENDING
   * one above it — but `PATCH /:id/cancel` is `PENDING`-only server-side and would answer 422. The
   * per-slot route reaches the identical end state, because the server flips the request to
   * `CANCELLED` when its last live slot goes. `cancelRouteFor()` is the one place that is decided.
   */
  const confirm = useCallback(async () => {
    if (!booking || !pending || busy) return
    const state = bookingState(booking)
    const route = cancelRouteFor(state)
    const target = pending.slot ?? liveSlots(booking)[0]
    setBusy(true)
    try {
      const updated =
        route === 'whole'
          ? await cancelWholeBooking(booking.id)
          : await cancelSlot(booking.id, (pending.slot ?? target).id)

      dialogRef.current?.close()
      setBooking(updated)
      /* ⚠️ THE TOAST REPORTS WHAT HAPPENED, NOT WHICH BUTTON WAS PRESSED. Cancelling the last live
         day of a repeat cancels the whole request, and saying "that day was cancelled" would be
         technically true and materially misleading — so the RESPONSE decides the wording. */
      const wholeGone = updated.status === 'CANCELLED'
      showToast(
        wholeGone
          ? `ยกเลิก ${updated.code} เรียบร้อยแล้ว`
          : `ยกเลิกวันที่เลือกของ ${updated.code} เรียบร้อยแล้ว`,
        'success',
      )
    } catch (error) {
      console.warn('[booking] cancel failed:', error)
      dialogRef.current?.close()
      showToast(messageFor(error), 'error')
      /* A 422 means the state moved underneath this render. Re-reading is the only honest recovery:
         the screen must not keep offering a button the server has just refused. */
      try {
        setBooking(await getMyBookingDetail(id))
      } catch {
        /* Leave the stale render rather than blanking the screen; the toast already said why. */
      }
    } finally {
      setBusy(false)
      setPending(null)
    }
  }, [booking, pending, busy, id, showToast])

  if (failure) {
    return (
      <Shell>
        <div role="alert" className="rounded-box border border-error/40 bg-base-100 p-4">
          <p className="text-sm font-medium text-base-content">{failure}</p>
          <Link to="/bookings" className="btn btn-app btn-outline mt-3">
            กลับหน้ารายการ
          </Link>
        </div>
      </Shell>
    )
  }

  if (!booking) {
    return (
      <Shell>
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg text-base-content/40" />
          <span className="sr-only">กำลังโหลดรายละเอียดคำขอ</span>
        </div>
      </Shell>
    )
  }

  const state = bookingState(booking)
  const live = liveSlots(booking)
  const lead = booking.cancelLeadMinutes
  const note = STATE_NOTE[state]
  /* One slot, still cancellable → one full-width button. Otherwise the per-day buttons in the
     capsule carry it, or there is nothing to offer at all. */
  const single = booking.slots.length === 1 && canCancelSlot(booking.slots[0], state, lead)
  const tooClose =
    booking.slots.length === 1 && (state === 'approved' || state === 'pending') && !single
  const terminal = state === 'rejected' || state === 'done' || state === 'expired' || state === 'cancelled'

  return (
    <Shell code={booking.code}>
      {/* ─── Code + badge ────────────────────────────────────────────────────────────── */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-1">
          <p className="font-mono text-xs text-base-content/70">รหัสคำขอ: {booking.code}</p>
          <CopyCode code={booking.code} />
        </div>
        <div className="mt-1.5 flex justify-center">
          <StateBadge state={state} size="badge-md" />
        </div>
      </div>

      {/* 🔴 THE REFUSAL REASON SITS **ABOVE** THE DETAILS. It is the only thing this screen exists
          to say to somebody opening a rejected request: they did not come to re-read which room
          they asked for, they came to read why they did not get it. */}
      {state === 'rejected' ? (
        <div role="alert" className="alert alert-error alert-soft mt-4 items-start text-start text-sm">
          <LIcon name="triangleAlert" className="h-5 w-5 shrink-0" />
          <span className="text-base-content">
            <span className="font-semibold">เหตุผลจากเจ้าหน้าที่:</span>{' '}
            {booking.rejectReason || 'ไม่ได้ระบุเหตุผล'}
            <span className="mt-1 block text-xs text-base-content/70">
              คุณสามารถยื่นคำขอใหม่ในช่วงเวลาอื่นได้
            </span>
          </span>
        </div>
      ) : note ? (
        <div
          role="alert"
          className={`alert ${note.kind} alert-soft mt-4 items-start text-start text-sm`}
        >
          <LIcon name={note.icon} className="h-5 w-5 shrink-0" />
          <span className="text-base-content">{note.text}</span>
        </div>
      ) : null}

      {/* ─── The booking itself ──────────────────────────────────────────────────────── */}
      <div className={`card mt-4 bg-base-100 shadow-sm${isHistory(state) ? ' grayscale' : ''}`}>
        <div className="card-body gap-0 p-4">
          <BookingSubject
            booking={booking}
            state={state}
            leadMinutes={lead}
            /* ⚠️ Handed in only when there is more than one slot. A single-slot booking's cancel
                lives below the divider as a full-width button, because a lone "ยกเลิกวันนี้" tucked
                into a one-row list is a primary action wearing a footnote's clothes. */
            onCancelSlot={booking.slots.length > 1 ? (slot) => ask(slot) : undefined}
          />
          <p className="mt-3 border-t border-base-200/80 pt-2.5 text-xs text-base-content/70">
            ยื่นคำขอเมื่อ {fmtD(new Date(booking.createdAt))} เวลา{' '}
            {fmtT(new Date(booking.createdAt))} น.
            {booking.approvedAt
              ? ` · อนุมัติเมื่อ ${fmtD(new Date(booking.approvedAt))}`
              : ''}
          </p>
        </div>
      </div>

      {/* ─── Why you can (or cannot) cancel ──────────────────────────────────────────── */}
      {/* ⚠️ THE PER-DAY RULE IS STATED **UNDER** THE CARD, not inside the capsule — inside, it reads
          as an explanation of one row, when it is the rule for the whole booking. */}
      {state === 'approved' && booking.slots.length > 1 ? (
        <div role="alert" className="alert alert-info alert-soft mt-4 items-start text-start text-xs">
          <LIcon name="info" className="h-4 w-4 shrink-0" />
          <span className="text-base-content">
            สามารถเลือกยกเลิกเฉพาะวันที่ไม่สะดวกได้ก่อนถึงเวลาเริ่มกิจกรรมอย่างน้อย {lead} นาที
          </span>
        </div>
      ) : tooClose ? (
        /* 🔴 "WHY IS THERE NO BUTTON" HAS TO BE ANSWERED HERE (`DECISIONS.md` §3.4: every "you
           cannot do this" says why AND what to do instead). A screen somebody opened in order to
           cancel, with no button and no sentence, reads as broken rather than as a rule. */
        <div
          role="alert"
          className="alert alert-warning alert-soft mt-4 items-start text-start text-xs"
        >
          <LIcon name="info" className="h-4 w-4 shrink-0" />
          <span className="text-base-content">
            ใกล้เวลาเริ่มกิจกรรมแล้ว — ยกเลิกเองได้ก่อนเริ่มอย่างน้อย {lead} นาที
            หากจำเป็นต้องยกเลิก กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลสถานที่โดยตรง
          </span>
        </div>
      ) : null}

      {/* ─── Actions ─────────────────────────────────────────────────────────────────── */}
      {/* ⚠️ "กลับหน้ารายการ" IS ON EVERY VARIANT. A screen with one way in must always offer at
          least one tappable way out, or a deep link lands the reader in a dead end. */}
      <div className="mt-6 flex flex-col gap-2">
        {single ? (
          /* ⚠️ Solid `btn-error`, not an outline: it is the only action on the screen, and an
              outlined destructive button next to a ghost link reads as the secondary of the two. */
          <button
            type="button"
            onClick={() => ask(null)}
            className="btn btn-app btn-error w-full shadow-sm"
          >
            {state === 'pending' ? 'ยกเลิกคำขอนี้' : 'ยกเลิกการจองนี้'}
          </button>
        ) : terminal ? (
          booking.venue.isOpen ? (
            <Link
              to={`/request/${booking.venue.id}`}
              className="btn btn-app btn-primary w-full shadow-sm"
            >
              {state === 'rejected' ? 'ยื่นคำขอจองใหม่' : 'จองสถานที่นี้อีกครั้ง'}
            </Link>
          ) : (
            /* The venue closed after this booking was made. Offering the CTA anyway would send the
               reader to a form whose submit button is disabled, with no explanation on the way. */
            <p className="rounded-box bg-base-200 p-3 text-center text-xs text-base-content/70">
              ขณะนี้ {booking.venue.name} ปิดรับคำขอจองชั่วคราว
            </p>
          )
        ) : null}
        <Link to="/bookings" className="btn btn-app btn-ghost w-full">
          กลับหน้ารายการ
        </Link>
      </div>

      <ConfirmDialog
        ref={dialogRef}
        booking={booking}
        state={state}
        pending={pending}
        live={live}
        busy={busy}
        onConfirm={() => void confirm()}
        onDismiss={() => {
          dialogRef.current?.close()
          setPending(null)
        }}
      />
    </Shell>
  )
}

/**
 * The two-tier header and the body column, shared by the loading, error and loaded renders so the
 * header does not appear, vanish and reappear while the read is in flight.
 *
 * ⚠️ THE LAST CRUMB IS `รายละเอียดคำขอ`, NOT THE BOOKING CODE. `BR-25690903-001` is fourteen
 * characters of monospace in a 12 px row that already holds a parent link and a separator; the code
 * is printed at full size as the first thing in the body, where it can be read and copied.
 */
function Shell({ children, code }: { children: React.ReactNode; code?: string }) {
  return (
    <section className="pb-safe min-h-dvh">
      <ScreenHeader
        title="รายละเอียดคำขอจอง"
        breadcrumbs={[
          { label: 'การจองของฉัน', to: '/bookings' },
          { label: code ? 'รายละเอียดคำขอ' : 'กำลังโหลด' },
        ]}
      />
      <div className={`${SCREEN_WIDTH} pt-4`}>
        <div className="pb-8">{children}</div>
      </div>
    </section>
  )
}

/**
 * Copy the booking number.
 *
 * ⚠️ NOT IN THE PROTOTYPE — added because the code's whole job is to be quoted elsewhere (into a
 * LINE message to a colleague, into this portal's own search box), and selecting fourteen monospace
 * characters with a thumb is the part people give up on. It fails quietly closed: a webview that
 * refuses clipboard access says so rather than pretending it worked.
 */
function CopyCode({ code }: { code: string }) {
  const showToast = useToast()
  return (
    <button
      type="button"
      aria-label="คัดลอกรหัสคำขอ"
      onClick={() => {
        void navigator.clipboard
          ?.writeText(code)
          .then(() => showToast('คัดลอกรหัสคำขอแล้ว', 'success'))
          .catch(() => showToast('คัดลอกไม่สำเร็จ กรุณาคัดลอกด้วยตนเอง', 'warning'))
      }}
      className="btn btn-ghost btn-xs h-11 min-h-11 w-11 px-0 text-base-content/70"
    >
      <LIcon name="fileText" className="h-4 w-4 shrink-0" />
    </button>
  )
}

/**
 * "Are you sure" — and, more importantly, "sure about *what*".
 *
 * 🔴 THE SUMMARY BOX IS NOT DECORATION. A repeat booking puts several cancel buttons on one screen,
 * and asking "are you sure?" without naming which day is the trap where a mis-tap is only noticed
 * afterwards. Cancellation is not undoable from the user's side: they may submit again, but the
 * original is gone and the hour may be taken within seconds.
 *
 * ⚠️ NO `<form method="dialog">` ANYWHERE IN HERE. Under React 19 that form never closes the dialog
 * — the submit does not reach React's synthetic handling and the native behaviour is swallowed — so
 * both dismiss paths call `close()` explicitly. `onCancel` covers Escape and the backdrop.
 */
const ConfirmDialog = ({
  ref,
  booking,
  state,
  pending,
  live,
  busy,
  onConfirm,
  onDismiss,
}: {
  ref: React.Ref<HTMLDialogElement>
  booking: BookingDetail
  state: BookingState
  pending: Pending | null
  live: BookingSlot[]
  busy: boolean
  onConfirm: () => void
  onDismiss: () => void
}) => {
  const whole = pending?.slot == null
  const slots = whole ? live : [pending.slot as BookingSlot]
  /**
   * 🔴 THE SENTENCE FOR "THIS ONE TAKES THE WHOLE REQUEST WITH IT".
   *
   * Shown whenever an APPROVED booking has exactly one live slot left — which is BOTH cases the
   * checklist asks about, and they look different on screen:
   *   · a genuinely single-slot booking, where the full-width button reads "ยกเลิกการจองนี้" but
   *     the body line only promises to free a time slot;
   *   · the last surviving day of a repeat, where the reader is pressing a per-day button and would
   *     otherwise have no reason to think this one is different from the two before it.
   * Not shown for `pending`, where the body already says the request itself is being withdrawn.
   * Verified live in both shapes.
   */
  const collapses = live.length === 1 && state !== 'pending'

  return (
    <dialog ref={ref} className="modal modal-middle" onCancel={onDismiss} onClose={onDismiss}>
      <div className="modal-box max-w-sm">
        <div
          aria-hidden="true"
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-error/20 text-error"
        >
          <LIcon name="triangleAlert" className="h-6 w-6" />
        </div>
        <h3 className="mt-3 text-center text-base font-semibold">
          {state === 'pending' ? 'ยืนยันการยกเลิกคำขอ' : 'ยืนยันการยกเลิกการจอง'}
        </h3>
        <p className="mt-1 text-center text-xs text-base-content/70">
          {state === 'pending'
            ? 'คำขอนี้จะถูกถอนออกจากการพิจารณา และไม่สามารถเรียกคืนได้'
            : 'ช่วงเวลาดังกล่าวจะถูกปล่อยว่างเพื่อให้ผู้อื่นสามารถขอจองใช้งานได้'}
        </p>

        <div className="mt-4 space-y-1 rounded-box bg-base-200 p-3 text-xs">
          <p className="flex items-start gap-1.5">
            <span aria-hidden="true" className="text-base-content/50">
              •
            </span>
            <span className="font-medium">{booking.venue.name}</span>
          </p>
          {slots.map((slot) => {
            const start = new Date(slot.startAt)
            const end = new Date(slot.endAt)
            return (
              <p key={slot.id} className="flex items-start gap-1.5">
                <span aria-hidden="true" className="text-base-content/50">
                  •
                </span>
                <span>
                  {crossesDay(slot)
                    ? fmtSlot(start, end)
                    : `${TH_DOW_FULL[start.getDay()]}ที่ ${fmtD(start)} เวลา ${fmtT(start)} – ${fmtTe(end)} น.`}
                </span>
              </p>
            )
          })}
        </div>

        {collapses ? (
          <p className="mt-3 text-center text-xs font-medium text-base-content">
            คำขอนี้มีช่วงเวลาเดียว การยกเลิกช่วงนี้จะทำให้คำขอถูกยกเลิกทั้งหมด
          </p>
        ) : null}

        <div className="modal-action mt-6 flex gap-2">
          <button type="button" onClick={onDismiss} className="btn btn-app btn-ghost grow">
            ไม่ใช่ตอนนี้
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="btn btn-app btn-error grow shadow-sm"
          >
            {busy ? <span className="loading loading-spinner loading-sm" /> : 'ยืนยันยกเลิก'}
          </button>
        </div>
      </div>
      {/* The backdrop is a plain button rather than daisyUI's `<form method="dialog">`, for the
          React 19 reason in the component note above. */}
      <button
        type="button"
        aria-label="ปิด"
        onClick={onDismiss}
        className="modal-backdrop cursor-default"
      />
    </dialog>
  )
}
