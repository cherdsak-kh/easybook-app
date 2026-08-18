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
  subtitle,
  children,
  footer,
  footerClassName = 'flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end',
  width = 560,
  dismissable = true,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  /**
   * A lead sentence under the title, inside the header block.
   *
   * Only รหัสผ่านชั่วคราว has one, and it needs it there rather than at the top of the body: the
   * body is the scrolling region, so a lead placed inside it scrolls away from the heading it
   * belongs to. It cannot ride inside `title` either — that slot is the `<h2>`, and a `<p>` inside
   * a heading is not markup any screen reader can make sense of.
   */
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /**
   * The action bar's LAYOUT only — the border, the `bg-base-200` and the padding are fixed below,
   * because all nine of the prototype's dialogs share them exactly.
   *
   * ⚠️ THE DEFAULT IS THE PROTOTYPE'S OWN `FOOTER_BASE` CONSTANT, and the part that matters is
   * `flex-col` under `sm`. The first port wrote `flex flex-wrap items-center justify-end` for
   * every dialog, which on a phone leaves buttons at their content width wrapping onto two ragged
   * lines instead of stacking full-width — and it silently cancelled `ConfirmModal`'s documented
   * "the confirm lands on top, under the thumb", since `flex-col-reverse` was never in the
   * markup that comment describes. The `bg-base-200` was missing too: without it the action bar
   * is the same colour as the body and stops reading as a separate strip.
   *
   * Three dialogs vary and say so at the call site: `ConfirmModal` reverses, the session dialog
   * is one full-width button, and the avatar dialog splits ลบรูปโปรไฟล์ away from the commit pair.
   */
  footerClassName?: string
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
  /**
   * Who to give focus back to.
   *
   * ⚠️ THE PLATFORM'S OWN RESTORE IS NOT ENOUGH HERE, and that was measured rather than assumed:
   * after บันทึกรูปภาพ the avatar dialog closed and focus was on `<body>` — a keyboard user
   * dropped at the top of the document, mid-task, with a toast they will never reach. `<dialog>`
   * returns focus to whatever was focused when `showModal()` ran, but a write that re-renders on
   * the way out (here `refresh()`, repainting the header the trigger lives in) can leave that
   * anchor stale. The prototype does not rely on it either — its avatar dialog calls
   * `openBtn.focus()` on every close.
   */
  const opener = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      // ⚠️ `<body>` IS AN HTMLElement AND IS NOT AN ANCHOR. It is what `document.activeElement`
      // reports whenever the dialog was opened without the trigger being focused first — a click
      // that moved focus nowhere, or a programmatic open. Storing it makes the restore a
      // `body.focus()`, which silently does nothing and looks exactly like having no restore at
      // all. `null` is the honest answer: let the platform decide.
      const from = document.activeElement
      opener.current = from instanceof HTMLElement && from !== document.body ? from : null
      el.showModal()
    } else if (!open && el.open) {
      el.close()
    }
  }, [open])

  /*
   * ⚠️ THERE IS NO UNMOUNT-TIME RESTORE HERE, AND THAT IS DELIBERATE — it was tried and removed.
   *
   * A caller that stops rendering this component while the dialog is open removes the node without
   * ever closing it, so `close` never fires and focus is left on `<body>`. The obvious fix is a
   * cleanup on `[]` that focuses `opener`. It does not work: StrictMode double-invokes effects in
   * dev, so that cleanup runs once while the dialog is very much alive and consumes `opener` — and
   * the effect above cannot re-arm it, because its guard is `open && !el.open` and the dialog is
   * open by then. Net effect: every dialog in the portal loses its restore, in dev only, silently.
   * Guarding on `el.isConnected` to tell a rehearsal from a real unmount did not save it either;
   * React's deletion order does not make that a reliable signal.
   *
   * So the rule is on the CALLER: drive `open` to false and keep the component mounted for that
   * commit. `close` then fires, this handler runs, and focus goes back. `AccountEditor` documents
   * the same rule from the other side.
   */
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Bound to the dialog's own `close` event, so EVERY exit lands here — the ✕, a footer
      // button, Esc, the backdrop, and React setting `open` to false. Restoring focus anywhere
      // else would cover some of those and silently miss the rest.
      onClose={() => {
        onClose()
        const back = opener.current
        opener.current = null
        // `isConnected` because the trigger may not have survived the write this dialog just
        // performed — focusing a detached node moves focus nowhere at all, with no error.
        if (back?.isConnected) back.focus()
      }}
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
          {/* `min-w-0` so a long title truncates rather than pushing the ✕ off the panel. The
              wrapper is a flex item hugging its content, so a header WITHOUT a subtitle measures
              exactly as it did when the <h2> was the direct child. */}
          <div className="min-w-0">
            <h2 id={titleId} className="text-[18px] font-semibold text-base-content th-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="m-0 mt-1 text-[14px] leading-[1.55] text-base-content/70">{subtitle}</p>
            )}
          </div>
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
          <div
            className={`border-t border-base-300 bg-base-200 px-5 py-4 ${footerClassName}`.trim()}
          >
            {footer}
          </div>
        )}
      </div>
    </dialog>
  )
}
