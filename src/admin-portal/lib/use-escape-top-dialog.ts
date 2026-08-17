/**
 * Escape closes the TOP-MOST open dialog, and only that one.
 *
 * A modal <dialog> is supposed to do this by itself — the UA fires `cancel`. ⚠️ Measured in
 * the prototype's preview: a trusted Escape keydown reached the document, no `cancel` fired,
 * and the dialog stayed open. The UA close watcher is not always running, depending on how
 * the page is embedded. Rather than ship a dialog whose most basic dismissal depends on where
 * it happens to be rendered, close it explicitly. Harmless where the native behaviour works:
 * `close()` on an already-closed dialog is a no-op, and `Modal`'s own `onCancel` handler and
 * this one agree about who may close.
 *
 * ⚠️ ONLY THE LAST ONE, never all of them. Closing every open dialog makes a single Escape
 * blow past a confirm AND the dialog that raised it — the opposite of what a confirm step is
 * for.
 *
 * Two opt-outs, both read off the element so a dialog can refuse without this hook knowing
 * anything about it:
 *   · `data-busy`      — a write is in flight, and Escape must not hide it.
 *   · `data-nodismiss` — the session-expired dialog. Escape is the one dismissal a modal is
 *     expected to honour, which is exactly why it has to be refused there: closing it hands
 *     back a shell where every click is a 401.
 */

import { useEffect } from 'react'

export function useEscapeTopDialog() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const open = document.querySelectorAll<HTMLDialogElement>('dialog[open]')
      if (!open.length) return
      const top = open[open.length - 1]
      if (top.dataset.busy !== undefined) return
      if (top.dataset.nodismiss !== undefined) return
      top.close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])
}
