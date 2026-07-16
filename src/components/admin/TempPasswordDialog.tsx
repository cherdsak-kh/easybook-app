import { useEffect, useRef, useState } from 'react'

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
      <div className="absolute inset-0 bg-slate-900/60" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl dark:bg-slate-900"
      >
        <h2 id={titleId} className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {reason === 'created' ? 'Staff member created' : 'Password reset'}
        </h2>

        <p id={descId} className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Temporary password for <span className="font-medium">{userLabel}</span>. They must change
          it the first time they sign in.
        </p>

        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          Copy it now — this is the only time it will be shown. It cannot be retrieved again.
        </p>

        <div className="mt-3 flex items-center gap-2">
          <code
            data-testid="temp-password-value"
            className="min-w-0 flex-1 select-all break-all rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-base text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {password}
          </code>
          <button
            type="button"
            onClick={copy}
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        {/* Reserve the line so the dialog doesn't jump when a status appears. */}
        <p className="mt-2 min-h-[1.25rem] text-xs" role="status">
          {copied && (
            <span className="text-emerald-700 dark:text-emerald-400">
              Copied to the clipboard. Deliver it to them directly — never by an unsecured channel.
            </span>
          )}
          {copyFailed && (
            <span className="text-red-700 dark:text-red-400">
              Could not copy automatically. Select the password above and copy it manually.
            </span>
          )}
        </p>

        <div className="flex justify-end pt-2">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            I have saved it
          </button>
        </div>
      </div>
    </div>
  )
}
