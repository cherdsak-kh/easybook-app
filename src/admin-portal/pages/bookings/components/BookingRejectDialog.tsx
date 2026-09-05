/**
 * ปฏิเสธคำขอจอง — a refusal, with a reason that is DELIVERED.
 *
 * ⚠️ THAT IS WHY THE REASON IS MANDATORY HERE AND WHY THE HINT SAYS SO. The ระงับ reason on
 * การลงทะเบียน is filed internally and its subject never reads it; this one arrives on the
 * requester's phone as a LINE message and on their My Bookings screen, RAW. An operator writes very
 * differently once they know that — it is the difference between "ห้องไม่ว่าง" and "ไม่ผ่าน".
 *
 * ⚠️ THE CONFIRM BUTTON IS NEVER DISABLED FOR AN EMPTY REASON. Pressing it with an empty box is how
 * the operator finds out; a disabled button cannot fire `click`, so there is no moment at which to
 * say anything, and it reads as broken. `guard()` shows the field error, moves focus into the field
 * and refuses the write — the prototype's behaviour, in this portal's error style rather than a
 * native bubble.
 *
 * ⚠️ TWO THINGS DO DISABLE IT, AND NEITHER CONTRADICTS THAT RULE. `busy` is a state in which pressing
 * again WOULD be wrong. `stale` (`ADMIN-REALTIME-BOOKINGS-1`) is one in which the write cannot land
 * at all — the socket has said this request is no longer PENDING. The empty-reason case is different
 * from both because the button has NOTHING TO SAY for itself there; these two arrive with the
 * sentence that explains them already on screen, in `alert` right above.
 *
 * ⚠️ NO DISMISS BUTTON IN THE FOOTER (PO). See the approve dialog.
 */

import { useEffect, useRef, useState } from 'react'
import { InlineAlert } from '../../../components/feedback/InlineAlert'
import { Modal } from '../../../components/ui/Modal'
import { Btn } from '../../../components/ui/Btn'
import { Spinner } from '../../../components/feedback/Spinner'
import { DISARMED, requestLine } from '../booking-detail'
import { ReasonField } from './ReasonField'
import { Glyph } from './BookingGlyph'
import { ICON } from './booking-icons'
import type { BookingRequestDetail } from '@/lib/api-client'

const MISSING = 'ต้องระบุเหตุผล เพราะระบบจะส่งข้อความนี้ให้ผู้ขอจองอ่าน'

export function BookingRejectDialog({
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
  /** The socket says this record's status moved under the dialog. See the header. */
  stale?: boolean
  /** The trimmed reason. Trimmed again in `api-client`, and again by the server before it checks. */
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const [missing, setMissing] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)

  /*
   * ⚠️ RESET ON OPEN, NOT ON CLOSE. A dialog reopened for a DIFFERENT request must not inherit the
   * last one's typed reason, nor the error it left behind — which would greet the next record before
   * anybody had done anything wrong.
   *
   * ⚠️ AND IT IS KEYED ON `open` ALONE, which is what makes the `returnTo` contract work: a FAILED
   * write leaves this dialog open, so this effect does not run and every keystroke survives.
   */
  useEffect(() => {
    if (open) {
      setReason('')
      setMissing(false)
    }
  }, [open])

  if (!detail) {
    return (
      <Modal open={false} onClose={onClose} title="ปฏิเสธคำขอจอง">
        {null}
      </Modal>
    )
  }

  const guard = () => {
    if (reason.trim().length > 0) return true
    setMissing(true)
    // Focus follows the complaint. Saying "this is required" while the caret is elsewhere makes the
    // operator hunt for the field the dialog is already pointing at.
    taRef.current?.focus()
    return false
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissable={!busy}
      title="ปฏิเสธคำขอจอง"
      footerClassName="flex flex-col gap-2 sm:flex-row sm:justify-end"
      footer={
        <Btn
          variant="warn-solid"
          className={`w-full sm:w-auto ${DISARMED}`}
          disabled={busy || stale}
          aria-busy={busy || undefined}
          aria-label={busy ? 'กำลังบันทึกการปฏิเสธ' : undefined}
          onClick={() => {
            if (!guard()) return
            onConfirm(reason.trim())
          }}
        >
          {busy ? <Spinner /> : <Glyph d={ICON.reject} className="cm-btn-ico" />}
          ยืนยันการปฏิเสธ
        </Btn>
      }
    >
      <InlineAlert message={alert} />

      <div className="flex items-start gap-3.5">
        <span aria-hidden="true" className="cm-icon-shell cm-tone-sky">
          <Glyph d={ICON.reject} className="cm-icon-glyph" />
        </span>
        <div className="min-w-0 pt-0.5">
          <p className="mb-1 text-[15px] font-medium text-base-content">{requestLine(detail)}</p>
          <p className="text-[14px] leading-[1.6] text-base-content/80">
            คำขอจะถูกปิดเป็น “ปฏิเสธ” และช่วงเวลานี้จะว่างให้คนอื่นจองได้ · ผู้ขอจองส่งคำขอใหม่ได้
          </p>
        </div>
      </div>

      <ReasonField
        className="mt-4"
        id="rq-rj-reason"
        label="เหตุผลที่ปฏิเสธ"
        hint="ระบบจะส่งข้อความนี้ให้ผู้ขอจองทาง LINE — เขียนให้เขาเข้าใจว่าทำไม และควรทำอย่างไรต่อ"
        placeholder="เช่น ช่วงเวลานี้มีกิจกรรมของโรงเรียนอยู่แล้ว ขอให้เลือกวันอื่น"
        value={reason}
        onChange={(next) => {
          setReason(next)
          if (missing) setMissing(false)
        }}
        error={missing ? MISSING : ''}
        inputRef={taRef}
      />
    </Modal>
  )
}
