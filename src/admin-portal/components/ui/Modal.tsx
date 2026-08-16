/**
 * The <dialog> shell behind all nine of the prototype's modals.
 *
 * Native <dialog> + `showModal()`, not a div. The platform gives focus trapping, Esc to
 * close, an inert background and focus returned to the trigger — four things a hand-rolled
 * modal gets wrong, usually the last one.
 *
 * ⚠️ `open` is driven through `showModal()` in an effect, NEVER by rendering `<dialog open>`.
 * The `open` ATTRIBUTE shows a non-modal dialog: no top layer, no focus trap, no backdrop,
 * no Esc. It looks correct until the first keyboard user tabs straight out of it.
 *
 * `onClose` is bound to the dialog's own `close` event rather than only to the ✕ button, so
 * Esc and a backdrop dismissal report through the same path the button does — otherwise
 * React's state says open while the platform says closed, and the next `showModal()` throws.
 *
 * Clicking the backdrop closes. The check is `event.target === dialogEl`: the backdrop is not
 * a child element, so a click that lands on it has the <dialog> itself as its target, while
 * any click inside the panel targets something deeper. Comparing against a bounding box is
 * the usual attempt and it misdetects clicks in the panel's rounded corners.
 */

import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 560,
  dismissable = true,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** Panel max width in px — the prototype uses 460 / 560 / 640. */
  width?: number
  /**
   * A confirm dialog mid-write sets this false: closing it would leave the operator unsure
   * whether the thing they asked for happened.
   */
  dismissable?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    else if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        // Esc. Suppressed while non-dismissable — the platform would otherwise close a
        // dialog whose ✕ we deliberately removed.
        if (!dismissable) e.preventDefault()
      }}
      onClick={(e) => {
        if (dismissable && e.target === ref.current) onClose()
      }}
    >
      <div
        className="mx-auto overflow-hidden rounded-card bg-base-100 shadow-e2"
        style={{ width: `min(${width}px, calc(100vw - 24px))` }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-base-300 px-5 py-4">
          <h2 id={titleId} className="text-[18px] font-semibold text-base-content th-tight">
            {title}
          </h2>
          {dismissable && (
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิด"
              data-tip="ปิด"
              data-tip-pos="bottom"
              className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-base-content/70 transition-colors hover:bg-base-content/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* 70dvh, not vh — on mobile Safari `vh` counts the space behind the URL bar, so the
            last row of a full modal sits under browser chrome and cannot be reached. */}
        <div className="max-h-[70dvh] overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-base-300 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </dialog>
  )
}
