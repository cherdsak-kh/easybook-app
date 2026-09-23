/**
 * ยกเลิกการจอง — the operator's cancel, on a booking that was already approved.
 *
 * P6 already lets the REQUESTER cancel their own booking from LINE. This is the other side of it:
 * the school needs the room back, and the person losing the slot is not the person clicking. That
 * asymmetry is why a reason is required here too, and why the SCOPE control exists — cancelling one
 * day of a five-day booking is the common case (a single day gets rained off), and an
 * all-or-nothing control would push the operator into cancelling the whole thing and asking the
 * requester to book again.
 *
 * ⚠️ RADIOS, AND THE DEFAULT IS THE WHOLE BOOKING. That is what "ยกเลิกการจอง" means to the person
 * who pressed it; a per-day list presented first would make the common case the fiddly one. The day
 * list appears only once its radio is chosen.
 *
 * ⚠️ ONLY LIVE SPANS ARE OFFERED. Naming an already-cancelled slot is a 409, and a tick box that
 * can only produce an error is worse than an absent one — so the picker lists what is still
 * cancellable and SAYS SO when anything is missing from it.
 *
 * ⚠️ CANCELLING EVERY REMAINING SPAN TURNS THE REQUEST `CANCELLED`, AND THE SERVER DECIDES THAT.
 * This dialog never infers it: it reports the scope, and the page re-reads the record afterwards.
 *
 * ⚠️ NO DISMISS BUTTON IN THE FOOTER (PO). See the approve dialog.
 *
 * ⚠️ `stale` DISARMS THE CONFIRM (`ADMIN-REALTIME-BOOKINGS-1`) — somebody else cancelled or moved
 * this booking while the scope was being chosen, so the slot ids ticked below may already be
 * cancelled (a 409) and the whole-booking option may be about a booking that no longer holds
 * anything. The two `MISSING_*` complaints still never disable anything: those are things the
 * operator can fix in this dialog, and this is not.
 */

import { useEffect, useRef, useState } from 'react'
import { InlineAlert } from '../../../components/feedback/InlineAlert'
import { Modal } from '../../../components/ui/Modal'
import { Btn } from '../../../components/ui/Btn'
import { Spinner } from '../../../components/feedback/Spinner'
import { DISARMED, liveSlots, requestLine, slotLine } from '../booking-detail'
import { ReasonField } from './ReasonField'
import { Glyph } from './BookingGlyph'
import { ICON } from './booking-icons'
import type { BookingRequestDetail } from '@/lib/api-client'

const MISSING_REASON = 'ต้องระบุเหตุผล เพราะระบบจะส่งข้อความนี้ให้ผู้จองอ่าน'
const MISSING_SLOTS = 'เลือกอย่างน้อยหนึ่งช่วงเวลาที่ต้องการยกเลิก'

type Scope = 'all' | 'some'

export function BookingCancelDialog({
  open,
  onClose,
  detail,
  alert = null,
  busy,
  stale = false,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  detail: BookingRequestDetail | null
  alert?: string | null
  busy: boolean
  /** The socket says this booking moved under the dialog. See the header. */
  stale?: boolean
  /**
   * `slotIds` OMITTED means the whole booking, which is not the same as sending every id: the
   * contract answers 400 to `[]` and to an explicit `null`, and "cancel everything" is expressed by
   * the key being absent.
   */
  onConfirm: (reason: string, slotIds?: string[]) => void
}) {
  const [scope, setScope] = useState<Scope>('all')
  const [picked, setPicked] = useState<string[]>([])
  const [reason, setReason] = useState('')
  const [missingReason, setMissingReason] = useState(false)
  const [missingSlots, setMissingSlots] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const firstSlotRef = useRef<HTMLInputElement>(null)

  /* Reset on OPEN — see the reject dialog's note. A failed write leaves this dialog open, so the
     scope, the ticks and the typed reason all survive it. */
  useEffect(() => {
    if (open) {
      setScope('all')
      setPicked([])
      setReason('')
      setMissingReason(false)
      setMissingSlots(false)
    }
  }, [open])

  if (!detail) {
    return (
      <Modal open={false} onClose={onClose} title="ยกเลิกการจอง">
        {null}
      </Modal>
    )
  }

  const live = liveSlots(detail.slots)
  const dropped = detail.slots.length - live.length

  const submit = () => {
    const chosen = live.filter((s) => picked.includes(s.id))
    // "Cancel some" with nothing ticked and "cancel some" with ALL of them ticked are two different
    // mistakes. The second is not a mistake at all — it IS the whole booking — so it is corrected
    // silently rather than refused.
    const noSlots = scope === 'some' && chosen.length === 0
    const partial = scope === 'some' && chosen.length > 0 && chosen.length < live.length
    const noReason = reason.trim().length === 0

    /* ⚠️ BOTH COMPLAINTS AT ONCE, then focus the first one. The prototype returned after the first
       failure, which sends an operator who left both blank round the loop twice. Showing both is
       strictly more information; the focus order is still the reading order. */
    setMissingSlots(noSlots)
    setMissingReason(noReason)
    if (noSlots) {
      firstSlotRef.current?.focus()
      return
    }
    if (noReason) {
      taRef.current?.focus()
      return
    }

    onConfirm(reason.trim(), partial ? chosen.map((s) => s.id) : undefined)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissable={!busy}
      title="ยกเลิกการจอง"
      footerClassName="flex flex-col gap-2 sm:flex-row sm:justify-end"
      footer={
        <Btn
          variant="danger-solid"
          className={`w-full sm:w-auto ${DISARMED}`}
          disabled={busy || stale}
          aria-busy={busy || undefined}
          aria-label={busy ? 'กำลังบันทึกการยกเลิก' : undefined}
          onClick={submit}
        >
          {busy ? <Spinner /> : <Glyph d={ICON.ban} className="cm-btn-ico" />}
          ยืนยันการยกเลิก
        </Btn>
      }
    >
      <InlineAlert message={alert} />

      <div className="flex items-start gap-3.5">
        <span aria-hidden="true" className="cm-icon-shell cm-tone-rose">
          <Glyph d={ICON.warning} className="cm-icon-glyph" />
        </span>
        <div className="min-w-0 pt-0.5">
          <p className="mb-1 text-[15px] font-medium text-base-content">{requestLine(detail)}</p>
          <p className="text-[14px] leading-[1.6] text-base-content/80">
            ระบบจะแจ้งผู้จองทาง LINE ทันที และช่วงเวลาที่ยกเลิกจะกลับมาว่างให้จองได้
          </p>
        </div>
      </div>

      <fieldset className="mt-5 min-w-0 border-0 p-0">
        <legend className="form-label !mb-2">ต้องการยกเลิกส่วนไหน</legend>
        <div className="flex flex-col gap-2">
          {/* `.chk-radio` — the `.chk` row with a ROUND box. A radio drawn as a square is the one
              place a control lies about its own behaviour: a square promises "tick as many as you
              like", and this is exactly one choice. */}
          <label className="chk chk-radio">
            <input
              type="radio"
              name="rq-cn-scope"
              value="all"
              className="sr-only"
              checked={scope === 'all'}
              onChange={() => {
                setScope('all')
                setMissingSlots(false)
              }}
            />
            <span className="chk-box" aria-hidden="true">
              <Glyph d={ICON.tick} className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">
              ยกเลิกทั้งการจอง{' '}
              <span className="text-base-content/70">
                (<span className="tabular-nums">{live.length}</span> ช่วงเวลา)
              </span>
            </span>
          </label>
          <label className="chk chk-radio">
            <input
              type="radio"
              name="rq-cn-scope"
              value="some"
              className="sr-only"
              checked={scope === 'some'}
              onChange={() => {
                setScope('some')
                setMissingSlots(false)
              }}
            />
            <span className="chk-box" aria-hidden="true">
              <Glyph d={ICON.tick} className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">ยกเลิกเฉพาะบางช่วงเวลา</span>
          </label>
        </div>

        {scope === 'some' && (
          <div className="mt-2 flex flex-col gap-1.5 rounded-control border border-base-300 p-2">
            {live.map((s, i) => (
              <label key={s.id} className="chk">
                <input
                  ref={i === 0 ? firstSlotRef : undefined}
                  type="checkbox"
                  className="sr-only"
                  checked={picked.includes(s.id)}
                  onChange={(e) => {
                    setPicked((p) => (e.target.checked ? [...p, s.id] : p.filter((id) => id !== s.id)))
                    if (missingSlots) setMissingSlots(false)
                  }}
                />
                <span className="chk-box" aria-hidden="true">
                  <Glyph d={ICON.tick} className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">{slotLine(s)}</span>
              </label>
            ))}
            {/* Says why the list is shorter than the record. Without it, a booking whose Wednesday
                was dropped last week looks like a booking that never had one. */}
            {dropped > 0 && (
              <p className="m-0 px-1 pt-0.5 text-[13px] leading-[1.5] text-base-content/70">
                ไม่แสดง <span className="tabular-nums">{dropped}</span> ช่วงเวลาที่ถูกยกเลิกไปแล้ว
              </p>
            )}
          </div>
        )}

        {/* Always in the DOM, hidden when empty — a live region created at the same moment as its
            text is never announced. Same rule as `InlineAlert` and `ReasonField`'s error. */}
        <p
          id="rq-cn-slot-err"
          role="alert"
          className={`form-err ${missingSlots ? '' : 'hidden'}`.trim()}
        >
          <Glyph d={ICON.alert} className="form-err-ico" />
          <span>{missingSlots ? MISSING_SLOTS : ''}</span>
        </p>
      </fieldset>

      <ReasonField
        className="mt-4"
        id="rq-cn-reason"
        label="เหตุผลที่ยกเลิก"
        hint="ระบบจะส่งข้อความนี้ให้ผู้จองทาง LINE และเก็บไว้ในประวัติการจอง"
        placeholder="เช่น โรงเรียนขอใช้สถานที่จัดพิธีในวันดังกล่าว ขออภัยในความไม่สะดวก"
        value={reason}
        onChange={(next) => {
          setReason(next)
          if (missingReason) setMissingReason(false)
        }}
        error={missingReason ? MISSING_REASON : ''}
        inputRef={taRef}
      />
    </Modal>
  )
}
