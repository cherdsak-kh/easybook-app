import { useEffect, useRef, useState } from 'react'
import { UI_STRINGS } from '@/constants/ui-strings-backend'

const UI = UI_STRINGS.staff.tempPassword

export interface TempPasswordDialogProps {
  /**
   * The one-time plaintext. Held ONLY for this dialog's lifetime — never write
   * it to storage, a query string, a log, or any state that outlives the dialog.
   */
  password: string
  /** Who it belongs to, e.g. "Ada Lovelace (ada@easybook.local)". */
  userLabel: string
  /** Which action produced it — the copy differs slightly. */
  reason: 'created' | 'reset'
  onClose: () => void
}

/**
 * Shows a server-issued temporary password EXACTLY ONCE (AC-F3).
 *
 * The backend returns the plaintext in the create / reset-password response and
 * never again — it is argon2id-hashed at rest and is not retrievable. So this
 * dialog:
 *  - states plainly that it will not be shown again,
 *  - offers copy-to-clipboard for out-of-band delivery (there is no mailer),
 *  - never auto-dismisses, and requires an explicit acknowledgement to close.
 */
export function TempPasswordDialog({
  password,
  userLabel,
  reason,
  onClose,
}: TempPasswordDialogProps) {
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  async function copy() {
    setCopyFailed(false)
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
    } catch {
      // Clipboard is unavailable (insecure context / denied permission). The
      // password is on screen and selectable, so this is a soft failure.
      setCopyFailed(true)
    }
  }

  const titleId = 'temp-password-title'
  const descId = 'temp-password-desc'

  return (
    // Deliberately NOT dismissible by backdrop click or Escape: this is the only
    // time this value is ever visible, so closing it must be a conscious act.
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-neutral/60" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative z-10 w-full max-w-md rounded-t-2xl bg-base-100 p-5 shadow-xl sm:rounded-2xl"
      >
        <h2 id={titleId} className="text-lg font-bold text-base-content">
          {reason === 'created' ? UI.createdTitle : UI.resetTitle}
        </h2>

        <p id={descId} className="mt-1 text-sm text-base-content/70">
          {UI.introBefore} <span className="font-medium">{userLabel}</span>
          {UI.introAfter}
        </p>

        <div className="alert alert-warning mt-3 py-2 text-sm font-medium">{UI.warning}</div>

        <div className="mt-3 flex items-center gap-2">
          <code
            data-testid="temp-password-value"
            className="min-w-0 flex-1 select-all break-all rounded-lg border border-base-300 bg-base-200 px-3 py-2 font-mono text-base text-base-content"
          >
            {password}
          </code>
          <button
            type="button"
            onClick={copy}
            className="btn btn-outline btn-sm shrink-0 focus-visible:ring-2 focus-visible:ring-primary"
          >
            {copied ? UI.copied : UI.copy}
          </button>
        </div>

        {/* Reserve the line so the dialog doesn't jump when a status appears. */}
        <p className="mt-2 min-h-[1.25rem] text-xs" role="status">
          {copied && <span className="text-emerald-700 dark:text-emerald-400">{UI.copySuccess}</span>}
          {copyFailed && <span className="text-red-700 dark:text-red-400">{UI.copyFailed}</span>}
        </p>

        <div className="flex justify-end pt-2">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="btn btn-primary btn-sm focus-visible:ring-2 focus-visible:ring-primary"
          >
            {UI.acknowledge}
          </button>
        </div>
      </div>
    </div>
  )
}
