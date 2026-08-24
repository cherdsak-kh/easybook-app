/**
 * The single gate in front of every write — the prototype's `confirm-modal`.
 *
 * ⚠️ It exists to show WHAT CHANGES, not to ask "are you sure?". A confirm step that says
 * "บันทึกหรือไม่?" adds a click and no information: the operator already pressed บันทึก.
 * Listing the diff makes the extra step earn its place, and catches the fat-finger edit that
 * a blind yes/no would have waved straight through. That is why `diff` exists and why a
 * caller with nothing to show should question whether it needs this dialog at all.
 *
 * Two footer buttons, not one. Other dialogs here dropped their footer ✕ because a control
 * whose only job is "close" competed with the real actions — but ยกเลิก is not a close
 * button, it is the other half of the question. A confirm dialog whose only footer control is
 * the destructive one puts the escape hatch in the far corner from the hand about to commit.
 *
 * `flex-col-reverse` on mobile: the confirm lands on TOP, under the thumb, and cancel below.
 *
 * The tinted glyph is the fastest read in the dialog — green grants, red takes away. It is
 * `aria-hidden` because the title already says the same thing in words.
 */

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Modal } from '../ui/Modal'
import { Btn } from '../ui/Btn'
import { Spinner } from './Spinner'
import { useBusy } from '../../lib/use-busy'

export type ConfirmTone = 'primary' | 'danger' | 'warn'

const TONE_TILE: Record<ConfirmTone, string> = {
  primary: 'bg-success/10 text-success',
  danger: 'bg-error/10 text-error',
  warn: 'bg-info/10 text-info',
}

const TONE_BTN: Record<ConfirmTone, 'primary' | 'danger-solid' | 'warn-solid'> = {
  primary: 'primary',
  danger: 'danger-solid',
  warn: 'warn-solid',
}

const TONE_ICON: Record<ConfirmTone, string> = {
  primary: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  danger:
    'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  warn: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z',
}

const REASON_MAX = 500

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  who,
  description,
  tone = 'primary',
  confirmLabel,
  busyLabel,
  diff,
  reason,
}: {
  open: boolean
  onClose: () => void
  /** Rejecting (throwing) leaves the dialog open — the operator must see it failed. */
  onConfirm: (reason: string) => void | Promise<void>
  title: string
  /** Who or what is being acted on. Bold line above the description. */
  who?: ReactNode
  description: ReactNode
  tone?: ConfirmTone
  confirmLabel: string
  busyLabel?: string
  /**
   * field → [before, after]. Rendered as a <dl>; omit when nothing is changing.
   *
   * `warn` tints one row amber — for the change in the list that is categorically more
   * consequential than the others. การลงทะเบียน's edit form sets it on สถานะ, where the operator
   * is otherwise scanning a surname, a phone number and an access grant in the same grey column
   * at the same weight.
   */
  diff?: { label: string; from: ReactNode; to: ReactNode; warn?: boolean }[]
  /** Present only for actions the system logs a justification for. */
  reason?: { label: string; hint: string; required?: boolean }
}) {
  const [text, setText] = useState('')
  const [missing, setMissing] = useState(false)
  const { busy, run, buttonProps } = useBusy()
  const taRef = useRef<HTMLTextAreaElement>(null)

  // A dialog reopened for a DIFFERENT row must not inherit the last one's typed reason — or the
  // error it left behind, which would greet the next row before anybody had done anything wrong.
  useEffect(() => {
    if (open) {
      setText('')
      setMissing(false)
    }
  }, [open])

  /**
   * The required-reason gate.
   *
   * ⚠️ IT DISABLED THE BUTTON UNTIL 22 ส.ค. 2569, AND THAT WAS THE BUG THE PO REPORTED. Pressing
   * ยืนยันการส่งคืน with an empty box did nothing at all: no movement, no message, no clue which
   * field was at fault. A disabled button is the one control that cannot explain itself — it does
   * not fire `click`, so there is no moment at which to say anything, and hover tells you nothing
   * either. The operator's reading is not "I have missed a field", it is "this is broken".
   *
   * ⚠️ THE PROTOTYPE NEVER DISABLED IT. Its confirm is a real `<form>` whose textarea carries
   * `required` (`ta.required = needsReason`), so a click runs native constraint validation and the
   * browser points at the field. The port replaced that with a `disabled` prop and lost the half
   * that does the talking. What is below is the prototype's BEHAVIOUR — press, be told, be taken
   * to the field — rendered with the portal's own `form-err` / `form-shell-err` error style rather
   * than a native bubble, so the sentence is in Thai and in the design.
   *
   * ⚠️ AND IT ANSWERS THE CURSOR QUESTION BY DISSOLVING IT. There is no disabled state left to
   * choose a cursor for: the button is always pressable, so it is always `cursor: pointer`, which
   * is honest — pressing it always does something now, even when that something is an error.
   */
  const guard = () => {
    if (!reason?.required || text.trim().length > 0) return true
    setMissing(true)
    // Focus follows the complaint. Saying "this is required" while the caret is somewhere else
    // makes the operator hunt for the field the dialog is already pointing at.
    taRef.current?.focus()
    return false
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      // Closing mid-write leaves the operator unsure whether what they asked for happened.
      dismissable={!busy}
      width={520}
      // The `flex-col-reverse` the header paragraph describes: on a phone the confirm sits on
      // top, under the thumb, and ยกเลิก below it.
      footerClassName="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
      footer={
        <>
          <Btn variant="ghost" className="w-full sm:w-auto" disabled={busy} onClick={onClose}>
            ยกเลิก
          </Btn>
          {/* ⚠️ `disabled` is `busy` ONLY. The missing-reason case is handled by `guard()` on
              click, not by taking the button away — see the comment on `guard`. Keep the two
              apart: "a request is in flight" is a state in which pressing again would be wrong,
              while "you have not typed a reason" is a state in which pressing is exactly how the
              operator finds out. */}
          <Btn
            variant={TONE_BTN[tone]}
            className="w-full sm:w-auto"
            {...buttonProps(busyLabel)}
            disabled={busy}
            onClick={() => {
              if (!guard()) return
              void run(() => onConfirm(text))
            }}
          >
            {busy && <Spinner />}
            {confirmLabel}
          </Btn>
        </>
      }
    >
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden="true"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-control ${TONE_TILE[tone]}`}
        >
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={TONE_ICON[tone]} />
          </svg>
        </span>
        <div className="min-w-0 pt-0.5">
          {who && <p className="mb-1 text-[15px] font-medium text-base-content">{who}</p>}
          <p className="text-[14px] leading-[1.6] text-base-content/80">{description}</p>
        </div>
      </div>

      {diff && diff.length > 0 && (
        <dl className="mt-4 rounded-control border border-base-300">
          {diff.map((d) => (
            <div
              key={d.label}
              className={`flex flex-col gap-0.5 border-b border-base-300/60 px-3.5 py-2.5 last:border-0 sm:flex-row sm:items-baseline sm:gap-4 ${
                d.warn ? 'bg-warning/10' : ''
              }`.trim()}
            >
              <dt
                className={`shrink-0 text-[13px] sm:w-32 ${
                  d.warn ? 'text-warning' : 'text-base-content/70'
                }`}
              >
                {d.label}
              </dt>
              <dd className="m-0 min-w-0 text-[14px] text-base-content">
                <span className="text-base-content/60 line-through">{d.from}</span>
                {/* /70, not /50. The contrast sweep measured the arrow at 3.41 against the
                    modal's surface. It is `aria-hidden` — the strikethrough and the bold
                    already carry before/after for a screen reader — but a sighted operator
                    reads it as the word "becomes", and being decorative to one audience does
                    not make it exempt for the other. /70 is what the rest of the portal uses
                    for secondary text and measures comfortably clear. */}
                <span aria-hidden="true" className="px-1.5 text-base-content/70">
                  →
                </span>
                <span className="font-medium">{d.to}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}

      {reason && (
        <div className="mt-4">
          {/* Label names the field; the hint says where the text ends up. Two lines, not one
              long label — at 375px a combined one stranded its last word on its own line. */}
          <label className="form-label !mb-0.5" htmlFor="cm-reason">
            {reason.label}
          </label>
          <p id="cm-reason-hint" className="mb-2 text-[13px] leading-[1.5] text-base-content/70">
            {reason.hint}
          </p>
          {/* `form-shell-err` is the prototype's own red-ring treatment for a field in error —
              the same one the staff form and the option form use. */}
          <div className={`form-shell !px-0 ${missing ? 'form-shell-err' : ''}`.trim()}>
            <textarea
              ref={taRef}
              id="cm-reason"
              name="reason"
              maxLength={REASON_MAX}
              rows={4}
              value={text}
              // Clearing on the first keystroke, not on blur: the complaint is answered the
              // moment it stops being true, and a red ring that outlives the fix trains people
              // to ignore red rings.
              onChange={(e) => {
                setText(e.target.value)
                if (missing) setMissing(false)
              }}
              aria-invalid={missing || undefined}
              // Both descriptions, always. The hint says where this text ends up — it is shown
              // to end users in LINE — which is exactly the sort of thing somebody should hear
              // BEFORE typing, not only after getting it wrong.
              aria-describedby="cm-reason-hint cm-reason-err"
              className="min-h-11 w-full resize-y border-none bg-transparent px-3.5 py-2.5 text-[15px] leading-[1.6] text-base-content/90 outline-none placeholder:text-base-content/70"
              placeholder="ระบุเหตุผลอย่างน้อย 1 ประโยค"
            />
          </div>
          {/* Always in the DOM, hidden when empty — a live region created at the same moment as
              its text is never announced. Same rule as `InlineAlert` and `FormField`'s error. */}
          <p
            id="cm-reason-err"
            role="alert"
            className={`form-err ${missing ? '' : 'hidden'}`.trim()}
          >
            <svg
              aria-hidden="true"
              className="form-err-ico"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
            {/* Names the field rather than saying "required": this dialog has exactly one input,
                but the sentence is what a screen-reader user hears with no view of the layout. */}
            <span>กรุณากรอก{reason.label}ก่อนยืนยัน</span>
          </p>
          <p className="mt-1.5 text-right text-[13px] text-base-content/70">
            {text.length}/{REASON_MAX}
          </p>
        </div>
      )}
    </Modal>
  )
}
