/**
 * Copy to clipboard, in three tiers — and the third is the one that matters.
 *
 * ⚠️ MEASURED IN THE PROTOTYPE: `window.isSecureContext` was true and
 * `navigator.clipboard.writeText` EXISTED, and it still rejected —
 * `document.execCommand('copy')` returned false too. A copy button that silently did nothing
 * would have shipped, and the operator would have closed a temp-password dialog they can
 * never reopen, believing they had the password.
 *
 * So when both writers fail, this does the one thing that always works: it SELECTS the text
 * and says so. Ctrl+C then does what the button could not, without the operator having to aim
 * at 16 characters of random string. "คัดลอกเอง" as advice is not a fallback — it is the
 * failure restated.
 *
 * ⚠️ The selection fallback needs the element the READER CAN SEE, which is why this takes a
 * ref rather than a plain string. Selecting an off-screen copy leaves them looking at one
 * thing while a different one is selected — that is how a copy button starts lying.
 *
 * `reset()` exists because a dialog reopened over a DIFFERENT value must not still read
 * "คัดลอกแล้ว": that is a receipt for something that never happened.
 */

import { useCallback, useRef, useState } from 'react'

export type CopyState = 'idle' | 'copied' | 'select-yourself'

const SELECT_MESSAGE =
  'เบราว์เซอร์ไม่อนุญาตให้คัดลอกอัตโนมัติ · เลือกข้อความให้แล้ว กด Ctrl+C (หรือ Cmd+C) เพื่อคัดลอก'
const OK_MESSAGE = 'คัดลอกไปยังคลิปบอร์ดแล้ว'

export function useCopy() {
  const ref = useRef<HTMLElement>(null)
  const [state, setState] = useState<CopyState>('idle')

  const selectIt = useCallback(() => {
    const el = ref.current
    if (!el) return
    const range = document.createRange()
    range.selectNodeContents(el)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }, [])

  const copy = useCallback(async () => {
    const text = ref.current?.textContent ?? ''
    // Tier 1 — the modern API.
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text)
        setState('copied')
        return
      } catch {
        // Falls through. See the measured note at the top: existing is not working.
      }
    }
    // Tier 2 — the legacy command, which needs the text selected first anyway.
    selectIt()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    // Tier 3 — leave it selected and say so.
    setState(ok ? 'copied' : 'select-yourself')
  }, [selectIt])

  const reset = useCallback(() => setState('idle'), [])

  return {
    /** Put this on the element holding the visible text. */
    ref,
    copy,
    reset,
    state,
    /** Button face: swaps to "คัดลอกแล้ว" only on a real success. */
    label: state === 'copied' ? 'คัดลอกแล้ว' : 'คัดลอก',
    /**
     * What the live region should say. Render it in a `role="status"` that is ALREADY in the
     * DOM — a region created at the same moment as its text is not announced.
     */
    announcement:
      state === 'copied' ? OK_MESSAGE : state === 'select-yourself' ? SELECT_MESSAGE : '',
  }
}
