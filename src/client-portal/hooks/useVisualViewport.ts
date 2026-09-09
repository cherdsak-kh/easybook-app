import { useEffect } from 'react'

/**
 * Keeps `--vvh` on `<html>` equal to `window.visualViewport.height`.
 *
 * ── What reads it ──
 * The "Dialog geometry" block in `index.css`: `dialog.modal:not(.modal-bottom) { height:
 * var(--vvh, 100dvh) }` (`:498`) and `dialog.modal:not(.modal-bottom) .modal-box { max-height:
 * calc(var(--vvh, 100dvh) - 5em) }` (`:508`). Until this hook existed both ran on the `100dvh`
 * fallback, so every centred dialog was sized from the layout viewport.
 *
 * ── 🔴 THE COMBOBOX BOTTOM SHEET IS DELIBERATELY OUTSIDE THIS MECHANISM ──
 * `:not(.modal-bottom)` is a guard, not decoration. `.cbx-sheet` is the only `modal-bottom`
 * dialog in `src/`, and it is excluded on purpose (9 Sep 2026): it is `fixed; inset: 0` with
 * `align-items: flex-end` and a box capped at a fixed `80dvh`, and it leaves the keyboard to the
 * browser's own visual-viewport panning, which brings the focused search field into view. Do NOT
 * "restore" a `--vvh` height for it — binding the height AND letting the browser pan is the
 * double-displacement that threw that sheet's header off the top of the screen. The reasoning
 * lives in `Combobox.tsx`'s header and the `.cbx-sheet` block in `index.css`; this hook is for
 * every OTHER dialog, all of which are centred.
 *
 * ── 🔴 WHY NOT `100dvh` ──
 * `dvh` tracks the browser's *layout* viewport, which the virtual keyboard does not shrink. Open
 * the keyboard on a `100dvh` dialog and the box keeps its full height with the bottom half —
 * including its buttons — underneath the keys. `visualViewport.height` is the only value that
 * subtracts the keyboard, so it is the only one a dialog can be sized from.
 *
 * ── ⚠️ BOTH `resize` AND `scroll`, AND THE SECOND IS NOT REDUNDANT ──
 * iOS reports the keyboard by *offsetting* the visual viewport as much as by resizing it: while
 * the keyboard animates in, Safari fires `scroll` on `visualViewport` with the height still
 * settling. Listening to `resize` alone leaves the property one frame — sometimes one whole
 * animation — behind, and the dialog visibly re-sizes after the keyboard has finished arriving.
 *
 * ⚠️ WHEN THERE IS NO `visualViewport` THE PROPERTY IS NEVER WRITTEN, on purpose. Every rule
 * that reads it passes `100dvh` as the fallback, so an unsupported browser gets the layout
 * viewport — which is exactly right. Writing `window.innerHeight` here instead would look like a
 * measurement and be the same number the fallback already provides.
 */
export function useVisualViewport(): void {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const apply = () => {
      document.documentElement.style.setProperty('--vvh', `${vv.height}px`)
    }
    apply()

    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    return () => {
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
      /* Remove rather than freeze. A stale height left behind by an unmounted shell would size
         the admin portal's dialogs to whatever the client last saw. */
      document.documentElement.style.removeProperty('--vvh')
    }
  }, [])
}
