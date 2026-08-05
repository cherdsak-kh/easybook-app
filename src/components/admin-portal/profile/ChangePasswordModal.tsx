import { useCallback, useState, type Ref } from 'react'
import EyeIcon from '@heroicons/react/24/outline/EyeIcon'
import EyeSlashIcon from '@heroicons/react/24/outline/EyeSlashIcon'
import {
  ApiError,
  changeOwnPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '@/lib/api-client'
import { PROFILE_STRINGS } from '@/constants/ui-strings-profile'

const T = PROFILE_STRINGS

/**
 * Voluntary password change — available to EVERY role, STAFF included.
 *
 * That last part is deliberate and is the one place this page overrides the STAFF
 * prototype: this app has no `ForcePasswordChangePage`, so a STAFF user issued a
 * temporary password would otherwise have no way to change it anywhere in the UI.
 *
 * Error handling, stated precisely because it is easy to get wrong: a WRONG
 * `currentPassword` comes back as **400, never 401**. It renders inline and must NOT
 * be treated as session death. Only a real 401 expires the session.
 *
 * The confirm field is client-side only — `changeOwnPassword` receives exactly
 * `(currentPassword, newPassword)` and the confirmation value is never transmitted.
 */
export function ChangePasswordModal({
  ref,
  onClose,
  onRequestClose,
  onExpireSession,
}: {
  readonly ref: Ref<HTMLDialogElement>
  /** Native `close` — resets every field so re-opening shows a blank form. */
  readonly onClose: () => void
  readonly onRequestClose: () => void
  readonly onExpireSession: () => void
}) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const reset = useCallback(() => {
    setCurrent('')
    setNext('')
    setConfirm('')
    setSubmitting(false)
    setError(null)
    setSuccess(false)
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  const submit = useCallback(async () => {
    setError(null)
    setSuccess(false)

    // Client-side guards run FIRST and never reach the network — fast feedback only;
    // the server re-validates and stays the authority.
    if (current.length === 0 || next.length === 0 || confirm.length === 0) {
      setError(T.password.required)
      return
    }
    if (next !== confirm) {
      setError(T.password.mismatch)
      return
    }
    if (next.length < PASSWORD_MIN_LENGTH) {
      setError(T.password.tooShort(PASSWORD_MIN_LENGTH))
      return
    }
    if (next.length > PASSWORD_MAX_LENGTH) {
      setError(T.password.tooLong(PASSWORD_MAX_LENGTH))
      return
    }

    setSubmitting(true)
    try {
      await changeOwnPassword(current, next)
      setSubmitting(false)
      setSuccess(true)
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (err: unknown) {
      setSubmitting(false)
      if (err instanceof ApiError && err.status === 401) {
        // A genuine 401 here means the SESSION died — not a bad current password.
        onExpireSession()
        return
      }
      if (err instanceof ApiError && err.status === 400) {
        setError(T.password.wrongCurrent)
        return
      }
      setError(T.password.failed)
    }
  }, [current, next, confirm, onExpireSession])

  return (
    <dialog
      ref={ref}
      className="modal modal-bottom sm:modal-middle"
      aria-labelledby="profile-password-title"
      onClose={handleClose}
      onCancel={(e) => {
        if (submitting) e.preventDefault()
      }}
    >
      <div className="modal-box p-4 sm:p-6">
        <button
          type="button"
          onClick={onRequestClose}
          disabled={submitting}
          aria-label={T.actions.close}
          className="btn btn-circle btn-ghost btn-sm absolute top-2 right-2 focus-visible:ring-2 focus-visible:ring-base-content"
        >
          ✕
        </button>
        <h3 id="profile-password-title" className="mb-4 text-lg font-bold">
          {T.password.title}
        </h3>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!submitting) void submit()
          }}
        >
          <PasswordField
            id="profile-password-current"
            label={T.password.current}
            placeholder={T.password.currentPlaceholder}
            autoComplete="current-password"
            value={current}
            disabled={submitting}
            onChange={setCurrent}
          />
          <PasswordField
            id="profile-password-new"
            label={T.password.next}
            placeholder={T.password.nextPlaceholder}
            autoComplete="new-password"
            value={next}
            disabled={submitting}
            describedBy="profile-password-hint"
            onChange={setNext}
          />
          <p id="profile-password-hint" className="text-xs text-base-content/60">
            {T.password.hint(PASSWORD_MIN_LENGTH)}
          </p>
          <PasswordField
            id="profile-password-confirm"
            label={T.password.confirm}
            placeholder={T.password.confirmPlaceholder}
            autoComplete="new-password"
            value={confirm}
            disabled={submitting}
            onChange={setConfirm}
          />

          {error && (
            <div role="alert" className="alert alert-error alert-soft text-sm">
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div role="status" className="alert alert-success alert-soft text-sm">
              <span>{T.password.success}</span>
            </div>
          )}

          <div className="modal-action flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onRequestClose}
              disabled={submitting}
              className="btn btn-ghost order-last w-full sm:order-first sm:w-auto"
            >
              {T.actions.cancel}
            </button>
            <button
              type="submit"
              disabled={submitting}
              aria-busy={submitting}
              className="btn btn-primary w-full sm:w-auto focus-visible:ring-2 focus-visible:ring-base-content"
            >
              {submitting && <span className="loading loading-spinner loading-xs" aria-hidden />}
              {submitting ? T.password.submitting : T.password.submit}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button aria-label={T.actions.closeBackdrop} disabled={submitting}>
          {T.actions.close}
        </button>
      </form>
    </dialog>
  )
}

/**
 * One labelled password input **with a show/hide eye toggle**, ported from
 * `AdminPortalLoginPage.tsx`: same `relative` wrapper, same overlaid
 * `btn btn-ghost btn-sm btn-square` on the input's right edge, same `pr-10` so typed
 * text clears the icon, and the same `EyeIcon` / `EyeSlashIcon` heroicons. The input
 * keeps every one of its own attributes (label association, `aria-describedby`).
 *
 * The one deliberate divergence from the login screen is the accessible NAME. The login
 * form has a single password box, so its bare "แสดงรหัสผ่าน" is unambiguous; this modal
 * has three, and three buttons sharing one name is a dead end for a screen-reader user.
 * Each toggle is therefore named after its own field — "แสดงรหัสผ่านเดิม",
 * "แสดงรหัสผ่านใหม่", "แสดงยืนยันรหัสผ่านใหม่" — which also keeps every `getByRole('button')`
 * query in the suite scoped to exactly one control.
 *
 * daisyUI v4's `form-control` + `label-text` wrapper is gone in v5 — a plain
 * `<label htmlFor>` + `input input-sm` is the v5 shape (skill: components/input.md,
 * button.md), and it keeps the label/control association real rather than positional.
 */
function PasswordField({
  id,
  label,
  placeholder,
  autoComplete,
  value,
  disabled,
  describedBy,
  onChange,
}: {
  readonly id: string
  readonly label: string
  readonly placeholder: string
  readonly autoComplete: 'current-password' | 'new-password'
  readonly value: string
  readonly disabled: boolean
  readonly describedBy?: string
  readonly onChange: (value: string) => void
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          className="input input-sm w-full pr-9 focus-visible:ring-2 focus-visible:ring-base-content"
        />
        {/* `btn-xs` (24px), not the login screen's `btn-sm` (32px): this modal's boxes
            are `input-sm`, which is itself 32px tall, so a 32px toggle would fill the
            field edge to edge. */}
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          disabled={disabled}
          aria-label={visible ? T.password.hide(label) : T.password.show(label)}
          aria-pressed={visible}
          className="btn btn-ghost btn-xs btn-square absolute top-1/2 right-1 -translate-y-1/2 text-base-content/60 focus-visible:ring-2 focus-visible:ring-base-content"
        >
          {visible ? (
            <EyeSlashIcon className="h-4 w-4" aria-hidden="true" />
          ) : (
            <EyeIcon className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  )
}
