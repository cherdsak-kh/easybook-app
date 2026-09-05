/**
 * อนุมัติคำขอจอง — 🔴 ADR-001 IS THE WHOLE REASON THIS DIALOG EXISTS.
 *
 * Approving one request auto-rejects every PENDING request whose slots overlap it on the same venue.
 * A UI that is honest about a rule which refuses OTHER PEOPLE'S records on the operator's behalf is
 * one that NAMES THEM BEFORE THE CLICK — so each loser is listed with the three facts its requester
 * would quote back: the code, who, and when. It is `warning`, not `error`: nobody did anything
 * wrong, the operator is choosing between people who asked for the same room, which is the decision
 * this screen exists to make.
 *
 * The other kind of overlap is a different KIND of thing and is a wall. When an APPROVED booking
 * already holds the slot the server answers 409, so the confirm is disabled and the reason is stated
 * immediately above it. ⚠️ That is not the disabled-button trap the reason fields avoid: a disabled
 * control is only dishonest when it cannot explain itself, and this one is bolted to the sentence
 * that explains it. It is also NOT the boundary — `conflicts` is read outside the deciding
 * transaction, and the transaction refuses again.
 *
 * ⚠️ NO DISMISS BUTTON IN THE FOOTER (PO, after user testing). The ✕, the backdrop and Escape all
 * close this three other ways; the footer holds constructive actions only, so the button under the
 * operator's hand is always the one that commits.
 *
 * ⚠️ WHAT THIS DIALOG SHOWS IS A FORECAST, AND THE TOAST AFTERWARDS IS THE FACT. The page reports
 * `autoRejected` from the response, never this list — see the page's `runApprove`.
 *
 * 🔴 `stale` IS THE SECOND WALL, AND IT IS THE ONE THIS SCREEN WAS ALWAYS GOING TO NEED
 * (`ADMIN-REALTIME-BOOKINGS-1`). ADR-001 cuts both ways: while this dialog is open, ANOTHER operator
 * may approve an overlapping request and this one is auto-rejected underneath it. The socket says so
 * the moment it happens, and the confirm is disarmed — pressing อนุมัติ on a record that is already
 * REJECTED must not be reachable, and "the server would 409 anyway" is not an answer when we already
 * know. Same treatment as `blocked` for the same reason: the sentence explaining it is right there.
 */

import { InlineAlert } from '../../../components/feedback/InlineAlert'
import { Modal } from '../../../components/ui/Modal'
import { Btn } from '../../../components/ui/Btn'
import { Spinner } from '../../../components/feedback/Spinner'
import { NO_VALUE, dayNumber, thaiDateShort, thaiTime } from '../../../lib/thai-date'
import { DISARMED, attendeesText, requestLine } from '../booking-detail'
import { BookingSlotList } from './BookingSlotList'
import { Glyph } from './BookingGlyph'
import { ICON } from './booking-icons'
import type { BookingConflictItem, BookingRequestDetail } from '@/lib/api-client'

/**
 * When a losing request happens, in the words its own requester would use.
 *
 * ⚠️ THE CONTRACT SENDS BOUNDS, NOT SLOTS (`firstStartAt` / `lastEndAt`), so a multi-day loser
 * prints its first and last day and NO hours — the per-day ranges are not in the payload and
 * inventing "08:30–12:00" from the outer bounds would be a summary that is wrong rather than short.
 * A same-day request prints its actual hours, because there the bounds ARE the slot.
 */
function conflictWhen(item: BookingConflictItem): string {
  const from = dayNumber(item.firstStartAt)
  const to = dayNumber(item.lastEndAt)
  if (from !== null && to !== null && from === to) {
    return `${thaiDateShort(item.firstStartAt)} · ${thaiTime(item.firstStartAt)}–${thaiTime(item.lastEndAt)} น.`
  }
  return `${thaiDateShort(item.firstStartAt)} – ${thaiDateShort(item.lastEndAt)}`
}

export function BookingApproveDialog({
  open,
  onClose,
  detail,
  alert = null,
  busy,
  stale = false,
  onConfirm,
}: {
  open: boolean
  /** Dismissal HANDS BACK to the detail dialog — the operator said "not now" to the action, not to
   *  the record. The page owns that; this only reports the dismissal. */
  onClose: () => void
  detail: BookingRequestDetail | null
  /** A failed attempt on this record. The dialog stays open so the operator can read it and retry. */
  alert?: string | null
  busy: boolean
  /** The socket says this record's status moved under the dialog. See the header — second wall. */
  stale?: boolean
  onConfirm: () => void
}) {
  if (!detail) {
    // Mounted and closed rather than unmounted, so `Modal` still gets the `close` event that hands
    // focus back. Same rule the other dialogs in this portal follow.
    return (
      <Modal open={false} onClose={onClose} title="อนุมัติคำขอจอง">
        {null}
      </Modal>
    )
  }

  const losers = detail.conflicts.pendingLosers
  const blocked = detail.conflicts.approvedClash

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="อนุมัติคำขอจอง"
      // Closing mid-write would leave the operator unsure whether the approval happened — and this
      // is the one write that also changes other people's records.
      dismissable={!busy}
      footerClassName="flex flex-col gap-2 sm:flex-row sm:justify-end"
      footer={
        <Btn
          variant="primary"
          className={`w-full sm:w-auto ${DISARMED}`}
          disabled={blocked || stale || busy}
          aria-busy={busy || undefined}
          aria-label={busy ? 'กำลังบันทึกการอนุมัติ' : undefined}
          onClick={onConfirm}
        >
          {busy ? <Spinner /> : <Glyph d={ICON.check} className="cm-btn-ico" />}
          ยืนยันการอนุมัติ
        </Btn>
      }
    >
      <InlineAlert message={alert} />

      <div className="flex items-start gap-3.5">
        <span aria-hidden="true" className="cm-icon-shell cm-tone-emerald">
          <Glyph d={ICON.check} className="cm-icon-glyph" />
        </span>
        <div className="min-w-0 pt-0.5">
          <p className="mb-1 text-[15px] font-medium text-base-content">{requestLine(detail)}</p>
          <p className="text-[14px] leading-[1.6] text-base-content/80">
            {detail.purpose} · {attendeesText(detail.attendees)}
          </p>
        </div>
      </div>

      {/* The hours being locked, spelled out again here rather than assumed read: this is the last
          surface before the write, and the summary in the row was never the thing being approved. */}
      <div className="mt-4 rounded-control border border-base-300 px-3.5 py-1">
        <BookingSlotList slots={detail.slots} />
      </div>

      {losers.length > 0 && (
        <div className="mt-4">
          <div className="inline-warn !mb-2">
            <Glyph d={ICON.warning} className="inline-warn-ico" />
            <p className="m-0">
              การอนุมัตินี้จะ<strong className="font-semibold">ปฏิเสธคำขอที่เวลาชนกันโดยอัตโนมัติ</strong>{' '}
              <span className="tabular-nums">{losers.length}</span> คำขอ ·
              ระบบจะแจ้งผู้ขอจองแต่ละคนผ่าน LINE พร้อมเหตุผลว่ามีผู้จองช่วงเวลานี้แล้ว
            </p>
          </div>
          {/* A list, not a sentence: these are RECORDS about to be refused on the operator's behalf,
              and prose is what gets skimmed. */}
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {losers.map((r) => (
              <li key={r.id} className="rq-conflict">
                <span className="rq-code">{r.code}</span>
                <span className="text-base-content/90">{r.requesterName || NO_VALUE}</span>
                <span className="tabular-nums text-base-content/70">{conflictWhen(r)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {blocked && (
        <div className="mt-4">
          {/* ⚠️ NO LIST UNDER THIS ONE, unlike the prototype's. `conflicts.approvedClash` is a
              BOOLEAN — the contract does not name the booking that holds the slot, and the way to
              find it is the ปฏิทินการจอง / the ทั้งหมด tab filtered by this venue. Printing a made-up
              row here would be worse than the sentence. */}
          <div className="inline-alert !mb-0">
            <Glyph d={ICON.alert} className="inline-alert-ico" />
            <p className="m-0">
              ช่วงเวลานี้มีการจองที่<strong className="font-semibold">อนุมัติแล้ว</strong>อยู่ก่อน
              จึงอนุมัติคำขอนี้ไม่ได้ · ต้องยกเลิกการจองเดิมก่อน หรือปฏิเสธคำขอนี้
            </p>
          </div>
        </div>
      )}
    </Modal>
  )
}
