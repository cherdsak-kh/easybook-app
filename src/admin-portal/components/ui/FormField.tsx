/**
 * label + shell + control + error, wired together.
 *
 * The wiring is the reason this is a component rather than three classes. Every field in the
 * prototype carries the same four-part relationship — `for`/`id`, `aria-describedby` pointing
 * at the error paragraph, `form-shell-err` on the shell when invalid, and the error kept in
 * the DOM rather than conditionally created — and each of those was got wrong at least once
 * while it was hand-written per form.
 *
 * ⚠️ The error <p> is ALWAYS rendered and hidden with `hidden`, never mounted on demand. An
 * assistive technology announces a live region only if it already existed when the text
 * arrived; a paragraph that appears at the same moment as its message is silent. The same
 * rule governs `#login-alert` and `#dm-alert` in the prototype.
 *
 * Forms using this must be `noValidate`. The browser's own bubble cannot be styled, cannot be
 * translated, and cannot be tied to `aria-describedby` — the prototype renders its own
 * messages for exactly those three reasons.
 */

import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

/** The 16×16 alert glyph every field error carries. */
function ErrIcon() {
  return (
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
  )
}

/**
 * The shared frame. Exposed on its own so a field with an unusual control — the avatar
 * picker, a two-input date range — gets the same label/error treatment without pretending
 * to be an <input>.
 */
export function Field({
  label,
  error,
  hint,
  htmlFor,
  errorId,
  children,
  className = '',
}: {
  label: ReactNode
  error?: string
  hint?: ReactNode
  htmlFor: string
  errorId: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label className="form-label" htmlFor={htmlFor}>
        {label}
      </label>
      <div className={`form-shell ${error ? 'form-shell-err' : ''}`.trim()}>{children}</div>
      {hint && <p className="m-0 mt-1 text-[12px] text-base-content/70 th-tight">{hint}</p>}
      {/* Always present, hidden when empty — see the note at the top of this file. */}
      <p id={errorId} className={`form-err ${error ? '' : 'hidden'}`.trim()}>
        <ErrIcon />
        <span>{error}</span>
      </p>
    </div>
  )
}

export function FormField({
  label,
  error,
  hint,
  className,
  id,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode
  error?: string
  hint?: ReactNode
}) {
  const auto = useId()
  const fieldId = id ?? auto
  const errorId = `${fieldId}-err`
  return (
    <Field
      label={label}
      error={error}
      hint={hint}
      htmlFor={fieldId}
      errorId={errorId}
      className={className}
    >
      <input
        id={fieldId}
        className="form-input"
        aria-describedby={errorId}
        aria-invalid={error ? true : undefined}
        {...input}
      />
    </Field>
  )
}

export function SelectField({
  label,
  error,
  hint,
  className,
  id,
  children,
  ...select
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: ReactNode
  error?: string
  hint?: ReactNode
}) {
  const auto = useId()
  const fieldId = id ?? auto
  const errorId = `${fieldId}-err`
  return (
    <Field
      label={label}
      error={error}
      hint={hint}
      htmlFor={fieldId}
      errorId={errorId}
      className={className}
    >
      <select
        id={fieldId}
        className="form-select"
        aria-describedby={errorId}
        aria-invalid={error ? true : undefined}
        {...select}
      >
        {children}
      </select>
      {/* Decorative: `appearance-none` removed the UA's own arrow, so the field would
          otherwise read as a text input that mysteriously opens a list. */}
      <svg
        aria-hidden="true"
        className="pointer-events-none -ml-6 h-4 w-4 shrink-0 text-base-content/60"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
      </svg>
    </Field>
  )
}
