/**
 * Copy text the page does NOT display (Hub 5's event JSON, Hub 6's Trace ID) to the clipboard.
 *
 * `useCopy` is the portal's three-tier copier, but its last tier SELECTS the visible text so the user can
 * press Ctrl+C: it needs an element holding the text. This text may not be on screen (the event JSON is
 * the whole API object, and the dialog shows it as sections), so there is nothing to select, and the
 * honest end state is a failure the caller can toast.
 *
 * ⚠️ THE FALLBACK TEXTAREA IS APPENDED INSIDE THE OPEN DIALOG, as the prototype does (`dlg.appendChild`).
 * A modal `<dialog>` makes everything outside it inert, and an inert element cannot be focused or
 * selected, so a textarea appended to `<body>` copies nothing while the dialog is up: the failure that
 * looks exactly like the line not being there.
 *
 * Resolves `true` when the text reached the clipboard. Never throws.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Falls through: an existing clipboard API is not a working one (measured in this project).
    }
  }
  const host = document.activeElement?.closest('dialog') ?? document.body
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.cssText = 'position:fixed;left:-9999px;top:0'
  host.appendChild(ta)
  ta.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  ta.remove()
  return ok
}

export const COPY_FAILED = 'คัดลอกไม่สำเร็จ เบราว์เซอร์ไม่อนุญาตให้เข้าถึงคลิปบอร์ด'
