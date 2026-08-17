/**
 * A password input with a reveal toggle — `__wireEye` in the prototype, used by four inputs
 * across the two password screens.
 *
 * Three things the toggle has to get right, all of which were bugs first:
 *
 *  1. `type="button"`. A bare <button> inside a <form> defaults to submit, so revealing the
 *     password would submit the form. This is why `Btn`/`IconBtn` default the same way.
 *  2. `aria-pressed` carries the STATE, and the label names the next ACTION. Announcing
 *     "แสดงรหัสผ่าน, pressed" is how a screen-reader user knows both what the control does
 *     and where it currently stands; using the label alone to carry state means it reads as
 *     the wrong one half the time.
 *  3. `aria-controls` points at the input, so the relationship survives the toggle being
 *     visually adjacent but structurally a sibling.
 *
 * ⚠️ The CURRENT-password field gets a reveal too, not just the new one. The temp password is
 * 16 random characters read off a note — nobody has memorised it, and masking a string
 * someone is transcribing turns one typo into three attempts.
 */

import { useId, useState } from 'react'
import type { InputHTMLAttributes, ReactNode, Ref } from 'react'
import { Field } from './FormField'

export function PasswordField({
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
  /**
   * Reaches the `<input>` through the prop spread below — React 19 hands `ref` to a function
   * component as an ordinary prop, so no `forwardRef` is needed. Declared here rather than left
   * to flow silently: the login screen puts the caret back in this field after a 401, and a
   * capability that only works because of an implementation detail is one somebody removes
   * while "tidying" the spread.
   */
  ref?: Ref<HTMLInputElement>
}) {
  const auto = useId()
  const fieldId = id ?? auto
  const errorId = `${fieldId}-err`
  const [shown, setShown] = useState(false)

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
        type={shown ? 'text' : 'password'}
        maxLength={128}
        className="form-input"
        aria-describedby={errorId}
        aria-invalid={error ? true : undefined}
        {...input}
      />
      <button
        type="button"
        className="login-eye"
        aria-pressed={shown}
        aria-label={shown ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
        aria-controls={fieldId}
        onClick={() => setShown((v) => !v)}
      >
        {shown ? (
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
            />
          </svg>
        ) : (
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )}
      </button>
    </Field>
  )
}
