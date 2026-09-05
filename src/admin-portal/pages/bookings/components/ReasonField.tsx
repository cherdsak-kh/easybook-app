/**
 * The mandatory reason box — ปฏิเสธ types one, ยกเลิก types one, and they are the same field.
 *
 * ⚠️ THE CONFIRM BUTTON BESIDE IT IS NEVER DISABLED, and this component is half of why. A disabled
 * button is the one control that cannot explain itself: it fires no `click`, so there is no moment
 * at which to say what is missing, and the operator reads it as broken rather than as "you have not
 * filled this in" — reported by the PO on the venues/line-users round, and recorded at length on
 * `ConfirmModal.guard`. The prototype never disabled it either. So the caller presses, is told
 * HERE, and lands in the field: `form-shell-err`, `form-err`, `aria-invalid`, `aria-describedby`,
 * and focus moved by the caller's own guard.
 *
 * ⚠️ THE ERROR PARAGRAPH IS ALWAYS IN THE DOM, hidden when empty. An assistive technology announces
 * a live region only if it already existed when the text arrived — the same rule `FormField`,
 * `InlineAlert` and the prototype's `#login-alert` all record.
 *
 * ⚠️ TRIMMED IS THE ONLY DEFINITION OF EMPTY. Four spaces satisfy `required`, satisfy a
 * `value.length` counter, and are a 400 from the server, which trims before it checks. The caller's
 * guard tests `.trim()`; this component only ever reports what was typed.
 */

import type { ReactNode, Ref } from 'react'
import { Glyph } from './BookingGlyph'
import { ICON } from './booking-icons'

/**
 * The server's own ceiling (`BOOKING_REASON_MAX`), so `maxLength` refuses the 501st character rather
 * than letting the operator write a paragraph and lose it to a 400.
 */
const REASON_MAX = 500

export function ReasonField({
  id,
  label,
  hint,
  placeholder,
  value,
  onChange,
  error,
  inputRef,
  className = '',
}: {
  id: string
  label: string
  /** Where this text ENDS UP. It is delivered to the requester, and people write differently once
   *  they know that — which is exactly the sort of thing to say before typing, not after. */
  hint: ReactNode
  placeholder: string
  value: string
  onChange: (next: string) => void
  /** The message under the field. Empty string = valid; the paragraph stays mounted regardless. */
  error?: string
  /** So the caller's guard can put the caret where the complaint is. */
  inputRef?: Ref<HTMLTextAreaElement>
  className?: string
}) {
  const hintId = `${id}-hint`
  const errId = `${id}-err`

  return (
    <div className={className}>
      <label className="form-label !mb-0.5" htmlFor={id}>
        {label}
      </label>
      <p id={hintId} className="mb-2 text-[13px] leading-[1.5] text-base-content/70">
        {hint}
      </p>
      <div className={`form-shell !px-0 ${error ? 'form-shell-err' : ''}`.trim()}>
        <textarea
          ref={inputRef}
          id={id}
          name="reason"
          maxLength={REASON_MAX}
          rows={4}
          value={value}
          // Cleared on the first keystroke, not on blur: a red ring that outlives the fix teaches
          // people to ignore red rings.
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          // BOTH descriptions, always — the hint is not something to hear only after getting it
          // wrong.
          aria-describedby={`${hintId} ${errId}`}
          autoCorrect="on"
          spellCheck
          autoComplete="off"
          autoCapitalize="sentences"
          placeholder={placeholder}
          className="min-h-11 w-full resize-y border-none bg-transparent px-3.5 py-2.5 text-[15px] leading-[1.6] text-base-content/90 outline-none placeholder:text-base-content/70"
        />
      </div>
      {/* Counter above the error, which is the prototype's order on these four dialogs — the count
          belongs to the box it sits under, and the correction belongs above the button. */}
      <p className="mt-1.5 text-right text-[13px] text-base-content/70">
        <span className="tabular-nums">{value.length}</span>/{REASON_MAX}
      </p>
      <p id={errId} role="alert" className={`form-err ${error ? '' : 'hidden'}`.trim()}>
        <Glyph d={ICON.alert} className="form-err-ico" />
        <span>{error}</span>
      </p>
    </div>
  )
}
