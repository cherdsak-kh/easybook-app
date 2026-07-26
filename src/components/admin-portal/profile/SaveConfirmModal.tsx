import type { Ref } from 'react'
import { PROFILE_STRINGS } from '@/constants/ui-strings-profile'

const T = PROFILE_STRINGS

/**
 * "Save these changes?" — the last step before the two PATCHes fire.
 *
 * A native `<dialog className="modal">` opened with `showModal()` (skill:
 * components/modal.md), which buys a real focus trap, Esc handling and return-focus.
 * Deliberately NOT the prototypes' `<form method="dialog">` submit button: that
 * closes the dialog *before* the async save resolves, so the spinner, the disabled
 * state and every error path would be invisible. Dismissal goes back to edit mode
 * with the draft intact; while `saving` both actions are disabled so a second click
 * cannot fire a second request.
 */
export function SaveConfirmModal({
  ref,
  saving,
  onConfirm,
  onClose,
  onRequestClose,
}: {
  readonly ref: Ref<HTMLDialogElement>
  readonly saving: boolean
  readonly onConfirm: () => void
  /** Native `close` (Esc / backdrop / Cancel) — the single dismissal path. */
  readonly onClose: () => void
  readonly onRequestClose: () => void
}) {
  return (
    <dialog
      ref={ref}
      className="modal modal-bottom sm:modal-middle"
      aria-labelledby="profile-save-confirm-title"
      onClose={onClose}
      onCancel={(e) => {
        // Esc must not tear the dialog down mid-request.
        if (saving) e.preventDefault()
      }}
    >
      <div className="modal-box p-4 sm:p-6">
        <h3 id="profile-save-confirm-title" className="text-lg font-bold">
          {T.save.confirmTitle}
        </h3>
        <p className="py-4">{T.save.confirmBody}</p>
        <div className="modal-action flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onRequestClose}
            disabled={saving}
            className="btn btn-ghost order-last w-full sm:order-first sm:w-auto"
          >
            {T.actions.cancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            aria-busy={saving}
            className="btn btn-success w-full sm:w-auto focus-visible:ring-2 focus-visible:ring-success"
          >
            {saving && <span className="loading loading-spinner loading-xs" aria-hidden />}
            {saving ? T.actions.saving : T.actions.confirm}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button aria-label={T.actions.closeBackdrop} disabled={saving}>
          {T.actions.close}
        </button>
      </form>
    </dialog>
  )
}
