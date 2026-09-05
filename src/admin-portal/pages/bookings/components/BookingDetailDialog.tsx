/**
 * รายละเอียดคำขอจอง — the read surface, and the hub the other three dialogs are reached from.
 *
 * 🔴 EVERY WRITE ON THIS SCREEN PASSES THROUGH THIS FOOTER, and that is a safety decision rather
 * than a tidy-up. อนุมัติ / ปฏิเสธ / ยกเลิก used to sit on the table row as 44px icons, which put
 * the two most consequential writes in the product — one of which auto-rejects OTHER PEOPLE'S
 * requests under ADR-001 — one mis-aimed click away, from a row showing neither the slot list nor
 * the conflicts. Routing them through here makes READING THE RECORD A PRECONDITION OF ACTING ON IT.
 *
 * The consequence worth stating: this footer is now the SINGLE guard on "is this transition legal
 * from this state". The row has no status branching left at all, so it cannot offer an illegal one —
 * it offers none.
 *
 * ⚠️ AND THERE IS NO ปิดหน้าต่าง (PO, after user testing). The ✕, the backdrop and Escape close this
 * three other ways, so a footer button whose only job is "close" competed with the real actions.
 * Which means a REJECTED or CANCELLED record — and EVERY record a VIEWER opens — has nothing to put
 * in the bar at all: `footer={null}`, so the strip is absent rather than rendered empty. A VIEWER
 * gets no action bar, not disabled buttons; a greyed control promises a capability the role will
 * never be granted.
 *
 * ⚠️ THE SLOT LIST SHOWS CANCELLED SPANS. See `BookingSlotList` — the dialog's job is to say that
 * Wednesday was dropped and why, which is precisely what the table cell cannot.
 */

import type { ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Btn } from '../../../components/ui/Btn'
import { FieldRow } from '../../../components/ui/FieldRow'
import { InlineAlert } from '../../../components/feedback/InlineAlert'
import { Modal } from '../../../components/ui/Modal'
import { Skeleton, SkeletonRegion } from '../../../components/feedback/Skeleton'
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_TONE } from '../../../labels'
import { NO_VALUE, thaiDate, thaiTime } from '../../../lib/thai-date'
import { attendeesText, liveSlots } from '../booking-detail'
import { BookingSlotList } from './BookingSlotList'
import { Glyph } from './BookingGlyph'
import { ICON } from './booking-icons'
import type { BookingRequestDetail, BookingRequestListItem } from '@/lib/api-client'

/** The three transitions this dialog can ask for. Named for the WRITE, not for the button. */
export type BookingAction = 'approve' | 'reject' | 'cancel'

/**
 * ⚠️ ONE TABLE, NOT A ROLE TEST INSIDE THREE BRANCHES. `PENDING` may be refused or approved;
 * `APPROVED` may be cancelled; `REJECTED` and `CANCELLED` are closed records and offer nothing —
 * the way back from an approval is ยกเลิก, and the way back from a refusal is a new request, which
 * is the requester's move and not ours.
 *
 * The order is the prototype's: the destructive option first and the constructive one last, so the
 * button nearest the thumb on a phone (and nearest the eye at the end of a row on a desktop) is the
 * one that grants rather than the one that refuses.
 */
const TRANSITIONS: Record<
  BookingRequestDetail['status'],
  { action: BookingAction; label: string; variant: 'primary' | 'warn-solid' | 'danger'; icon: string }[]
> = {
  PENDING: [
    { action: 'reject', label: 'ปฏิเสธคำขอ', variant: 'warn-solid', icon: ICON.reject },
    { action: 'approve', label: 'อนุมัติคำขอ', variant: 'primary', icon: ICON.check },
  ],
  APPROVED: [{ action: 'cancel', label: 'ยกเลิกการจอง', variant: 'danger', icon: ICON.ban }],
  REJECTED: [],
  CANCELLED: [],
}

export function BookingDetailDialog({
  open,
  onClose,
  row,
  detail,
  loading,
  failed,
  onRetry,
  canWrite,
  alert = null,
  onAction,
}: {
  open: boolean
  onClose: () => void
  /**
   * The row this was opened from. It carries the code before the fetch lands, so the dialog can name
   * the record it is loading instead of showing a headed rectangle of bars.
   */
  row: BookingRequestListItem | null
  /** `null` while loading or after a failure — never a half-filled record. */
  detail: BookingRequestDetail | null
  loading: boolean
  /** The detail fetch failed. A retry is offered because retrying can genuinely change the answer. */
  failed: boolean
  onRetry: () => void
  /** A VIEWER reads everything here and gets NO action bar. The server answers 403 regardless. */
  canWrite: boolean
  /** A failed write on THIS record, or a note about it. Cleared by the caller on reopen. */
  alert?: string | null
  onAction: (action: BookingAction) => void
}) {
  const live = detail ? liveSlots(detail.slots) : []
  const dropped = detail ? detail.slots.length - live.length : 0

  /*
   * ⚠️ THE ACTIONS NEED THE DETAIL, not the row. `status` is on both, but the record may have moved
   * between the list load and this fetch, and the footer must offer transitions from the state the
   * SERVER just described — not from the one the table happened to be painted with.
   *
   * The `live.length` guard on ยกเลิก is the contract's, not a preference: `cancel` answers 409 when
   * every slot is already cancelled, and arming a button that can only fail is the screen pretending
   * it does not know that. In practice the server turns such a request CANCELLED, so this is a
   * belt-and-braces branch that should never be reachable.
   */
  const acts =
    canWrite && detail
      ? (TRANSITIONS[detail.status] ?? []).filter(
          (t) => t.action !== 'cancel' || live.length > 0,
        )
      : []

  const footer: ReactNode = acts.length === 0 ? null : (
    <>
      {acts.map((a) => (
        <Btn
          key={a.action}
          variant={a.variant}
          className="w-full sm:w-auto"
          onClick={() => onAction(a.action)}
        >
          <Glyph d={a.icon} className="cm-btn-ico" />
          {a.label}
        </Btn>
      ))}
    </>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="รายละเอียดคำขอจอง"
      width={620}
      footerClassName="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end"
      footer={footer}
    >
      <InlineAlert message={alert} />

      {failed ? (
        /* ⚠️ NOT `<LoadError>`. That panel is a full-height page state with its own <h2> and its own
           focus move — inside a dialog that already has a heading it announces a second one and
           fights the dialog for the focus the platform just placed. What a failed fetch needs here
           is one sentence and one button. */
        <div className="py-6 text-center">
          <p className="m-0 text-[15px] font-medium text-base-content">โหลดรายละเอียดไม่สำเร็จ</p>
          <p className="mt-1.5 text-[14px] leading-[1.6] text-base-content/70">
            ระบบดึงข้อมูลคำขอ {row?.code ?? ''} ไม่ได้ · ข้อมูลในระบบยังอยู่ครบ ลองใหม่อีกครั้ง
          </p>
          <Btn variant="primary" className="mt-4" onClick={onRetry}>
            <Glyph d={ICON.refresh} className="cm-btn-ico" />
            ลองใหม่อีกครั้ง
          </Btn>
        </div>
      ) : loading || !detail ? (
        /* Shaped like the record it replaces — the code line, eight field rows and three slot rows —
           so nothing jumps sideways when the data lands, which is the only reason a skeleton earns
           its place. */
        <SkeletonRegion
          label={`กำลังโหลดรายละเอียดคำขอ ${row?.code ?? ''}`.trim()}
        >
          <div className="mb-4 flex items-center gap-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-5 w-20" variant="soft" />
          </div>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="field-row">
              <Skeleton className="h-3.5 w-24" variant="soft" />
              <Skeleton className="h-3.5 w-48" />
            </div>
          ))}
          <div className="mt-5 flex flex-col gap-3">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3.5 w-56" variant="soft" />
            <Skeleton className="h-3.5 w-56" variant="soft" />
          </div>
        </SkeletonRegion>
      ) : (
        <>
          {/* The code LEADS, because it is the handle: this dialog is usually open because somebody
              read a code out over the phone. */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="rq-code text-[15px]">{detail.code}</span>
            <Badge tone={BOOKING_STATUS_TONE[detail.status]}>
              {BOOKING_STATUS_LABEL[detail.status]}
            </Badge>
            {/* ⚠️ FULLER WORDS THAN THE TABLE'S CHIP (`LINE` / `เจ้าหน้าที่`), deliberately: the
                column had 176px and a header above it, and this has a line to itself. Inline copy,
                not `labels.ts` — these are sentences about the record, not a translation of the
                enum, and `BOOKING_ORIGIN_LABEL` stays the one spelling of the enum itself. */}
            <span
              className={`rq-src ${detail.origin === 'LINE' ? 'rq-src-line' : 'rq-src-staff'}`}
            >
              {detail.origin === 'LINE' ? 'ส่งผ่าน LINE' : 'เจ้าหน้าที่สร้าง'}
            </span>
          </div>

          <div>
            <FieldRow label="ผู้ขอจอง">{detail.requester.name || NO_VALUE}</FieldRow>
            <FieldRow label="กลุ่ม/ฝ่าย">{detail.requester.departmentName || NO_VALUE}</FieldRow>
            <FieldRow label="เบอร์โทรศัพท์">
              <span className="tabular-nums">{detail.requester.phone || NO_VALUE}</span>
            </FieldRow>
            <FieldRow label="สถานที่">{detail.venue.name}</FieldRow>
            {/* วัตถุประสงค์ IS NOT A TABLE COLUMN — at the width the row could spare it rendered as
                ~94px of two-line clamped Thai, which is not enough of a sentence to decide anything
                on. It is here, in full, on the surface where the decision is taken. */}
            <FieldRow label="วัตถุประสงค์">{detail.purpose}</FieldRow>
            <FieldRow label="จำนวนผู้เข้าร่วม">{attendeesText(detail.attendees)}</FieldRow>
            <FieldRow label="วันที่ยื่นคำขอ">
              {thaiDate(detail.createdAt)} เวลา{' '}
              <span className="tabular-nums">{thaiTime(detail.createdAt)}</span> น.
            </FieldRow>
            {/* ⚠️ ONE LABEL, NOT THREE. The prototype flipped between ผู้อนุมัติ / ผู้ปฏิเสธ /
                ผู้ยกเลิก because its record held a single `by` field for whoever last touched it.
                The contract is narrower and more honest: `approvedBy` is who APPROVED it, and it
                stays set on a booking that was later cancelled — while a cancellation is recorded
                per SLOT and deliberately exposes a role rather than a person (see `BookingSlotList`).
                Labelling this row ผู้ยกเลิก would name the approver as the canceller. */}
            {detail.approvedBy && (
              <FieldRow label="ผู้อนุมัติ">
                {detail.approvedBy.firstName} {detail.approvedBy.lastName}
                {detail.approvedAt && ` · ${thaiDate(detail.approvedAt)}`}
              </FieldRow>
            )}
            {/* Only ever present on an ADMIN-origin booking, and it is what the source chip above
                cannot say: "เจ้าหน้าที่สร้าง" names a domain, this names the person to ask. */}
            {detail.createdBy && (
              <FieldRow label="ผู้บันทึกคำขอ">
                {detail.createdBy.firstName} {detail.createdBy.lastName}
              </FieldRow>
            )}
          </div>

          <div className="mt-5">
            <h3 className="mb-1 text-[14px] font-semibold text-base-content">
              ช่วงเวลาที่ขอใช้{' '}
              <span className="font-normal text-base-content/70">
                (<span className="tabular-nums">{detail.slots.length}</span> ช่วง
                {/* The count of dropped days belongs in the HEADING, not only in the list: a
                    five-slot booking with four cancelled reads as an intact booking until the eye
                    reaches the fourth badge. */}
                {dropped > 0 && (
                  <>
                    {' · ยกเลิกแล้ว '}
                    <span className="tabular-nums">{dropped}</span> ช่วง
                  </>
                )}
                )
              </span>
            </h3>
            <BookingSlotList slots={detail.slots} />
          </div>

          {/* The refusal, in the words the requester was sent. An auto-rejection under ADR-001 lands
              here too, carrying the system's own wording — which names nobody, by design. */}
          {detail.rejectReason && (
            <p className="mt-4 rounded-control bg-base-200 px-4 py-3 text-[14px] leading-[1.55] text-base-content/80">
              เหตุผลที่ปฏิเสธ: {detail.rejectReason}
            </p>
          )}
        </>
      )}
    </Modal>
  )
}
