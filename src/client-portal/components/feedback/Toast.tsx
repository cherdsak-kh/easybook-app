import { useCallback, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { ToastContext, type ToastKind } from './toast-context'

/**
 * The floating feedback toast. Ported from `liveToast()`, prototype 5564–5572, and its container
 * at 2160. The hook that reads it lives in `./toast-context.ts`.
 *
 * ── Why this exists at all ──
 * The PO's ruling is that the client portal is real-time throughout. Under rules that do not
 * reserve a time slot, what arrives over the socket is not news — it changes what the reader was
 * about to do. So an approval landing has to (a) say so, (b) repaint the calendar and (c)
 * re-check any span the user has half-entered. This component is (a).
 *
 * ── An imperative call, deliberately ──
 * `liveToast(text, kind)` was called from event handlers and from the socket listener, not
 * rendered from state. `useToast()` keeps that shape: a screen calls `show(...)` from wherever
 * the event reached it, and does not have to hold a queue of its own.
 *
 * ⚠️ `aria-live="assertive"` + `aria-atomic`. Assertive because the whole point is that it
 * interrupts — a polite region waits for a pause that someone reading a form never gives. The
 * live region is the CONTAINER and it is ALWAYS MOUNTED; a region that appears at the same moment
 * as its content is frequently not announced at all.
 *
 * ⚠️ SEVEN SECONDS, not the usual three. These are Thai sentences about a specific booking, not
 * one-word confirmations, and they are read rather than glanced at.
 *
 * ⚠️ `toast-top toast-center`, NOT bottom. The same reasoning as every dialog in this portal
 * (`DECISIONS.md` §3.5): the bottom edge is contested by the home indicator, the URL bar, LINE's
 * toolbar and the dock — and the dock is ours and is definitely there.
 */

type ToastItem = { id: number; text: string; kind: ToastKind }

/** How long a toast stays up. The prototype's 7000ms, unchanged. */
const TOAST_MS = 7000

const ALERT_KIND: Record<ToastKind, string> = {
  info: 'alert-info',
  success: 'alert-success',
  warning: 'alert-warning',
  error: 'alert-error',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  /* A ref, not `items.length` — two toasts arriving in the same tick would otherwise be handed
     the same key and React would collapse them into one row. */
  const nextId = useRef(0)

  const show = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = nextId.current++
    setItems((prev) => [...prev, { id, text, kind }])
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, TOAST_MS)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <ToastViewport items={items} />
    </ToastContext.Provider>
  )
}

/**
 * The live region itself. Always mounted, even with nothing in it — see the note above about
 * regions that appear at the same instant as their content.
 *
 * Exported so a screen that already owns its own stack can place the viewport itself.
 */
export function ToastViewport({ items }: { items: readonly ToastItem[] }) {
  return (
    <div
      className="toast toast-top toast-center z-50 w-full max-w-sm px-4"
      aria-live="assertive"
      aria-atomic="true"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={`alert ${ALERT_KIND[t.kind]} w-full text-sm shadow-lg`}
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}
