/**
 * The toast stack — `__toast(kind, message)` in the prototype.
 *
 * The confirm dialog asks "are you about to do this?"; the toast answers "did it happen?".
 * Without it, confirming just makes a modal disappear and the operator is left inferring the
 * outcome from a table that may not have refreshed yet.
 *
 * Four behaviours here are load-bearing, and each is a decision rather than a default:
 *
 *  1. **Errors never auto-dismiss.** A success is a receipt for something that already
 *     happened and the table shows it anyway; an error means the thing the operator asked
 *     for did NOT happen, and a message that vanishes before it is read leaves them
 *     believing it did.
 *  2. **`role` is fixed when the toast is created**, never swapped on a shared element — an
 *     assistive technology announces a live region as whatever it was when the text arrived.
 *     `alert` (assertive, interrupts) for failures, `status` (polite) for the rest.
 *  3. **The timer pauses on hover AND on focus.** WCAG 2.2.1 requires a time limit be
 *     pausable; `focusin` is the half people forget, and without it a keyboard user who has
 *     tabbed to the close button watches the control time out from under their own hand.
 *  4. **Three at once, oldest evicted first.** A fourth message is a log, not a
 *     notification — and evicting the newest would drop the one thing just reported.
 *
 * ⚠️ `popover="manual"` is not decoration. `showModal()` puts a <dialog> in the TOP LAYER
 * and nothing in the normal stacking context reaches it — `z-index: 99999` still renders
 * behind. The top layer is ordered by INSERTION, so the stack re-shows itself on each new
 * toast to move back in front of a dialog opened after it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ToastContext } from '../../lib/toast-context'
import type { ToastKind } from '../../lib/toast-context'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

/** A fourth message is a log, not a notification. */
const MAX = 3
/** 0 = never auto-dismiss. See note 1 above. */
const LIFE: Record<ToastKind, number> = { success: 4000, info: 4000, error: 0 }

const PATHS: Record<ToastKind, string> = {
  success: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  error: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z',
  info: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z',
}

function ToastRow({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const life = LIFE[item.kind]
  const timer = useRef<number | null>(null)
  const left = useRef(life)
  const startedAt = useRef(0)

  const start = useCallback(() => {
    if (!life || timer.current !== null) return
    startedAt.current = Date.now()
    timer.current = window.setTimeout(() => onDismiss(item.id), left.current)
  }, [life, item.id, onDismiss])

  const stop = useCallback(() => {
    if (timer.current === null) return
    window.clearTimeout(timer.current)
    timer.current = null
    left.current -= Date.now() - startedAt.current
  }, [])

  useEffect(() => {
    start()
    return stop
  }, [start, stop])

  return (
    <div
      className={`toast-item toast-${item.kind} is-in`}
      // Fixed at creation — see note 2 at the top of this file.
      role={item.kind === 'error' ? 'alert' : 'status'}
      onMouseEnter={stop}
      onMouseLeave={start}
      onFocus={stop}
      onBlur={start}
    >
      <svg
        aria-hidden="true"
        className={`toast-ico toast-ico-${item.kind}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={PATHS[item.kind]} />
      </svg>
      <p className="toast-msg">{item.message}</p>
      <button
        type="button"
        className="toast-x"
        aria-label="ปิดการแจ้งเตือน"
        onClick={() => onDismiss(item.id)}
      >
        <svg
          aria-hidden="true"
          className="toast-x-ico"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const stackRef = useRef<HTMLDivElement>(null)
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((kind: ToastKind, message: string) => {
    setItems((list) => {
      // Oldest out first, so the newest message is never the one pushed off.
      const kept = list.length >= MAX ? list.slice(list.length - MAX + 1) : list
      return [...kept, { id: nextId.current++, kind, message }]
    })
  }, [])

  // Re-show to return to the front of the top layer, which is ordered by insertion — a
  // dialog opened after the stack appeared would otherwise cover it. Wrapped because
  // showPopover() throws when already open, and the whole API is absent in older browsers
  // (where the stack is a plain fixed element and this is a harmless no-op).
  useEffect(() => {
    const el = stackRef.current
    if (!el?.showPopover) return
    if (!items.length) {
      try {
        el.hidePopover()
      } catch {
        /* already hidden */
      }
      return
    }
    try {
      el.hidePopover()
    } catch {
      /* was not open */
    }
    try {
      el.showPopover()
    } catch {
      /* already open */
    }
  }, [items])

  const value = useMemo(() => toast, [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div id="toast-stack" ref={stackRef} popover="manual">
        {items.map((item) => (
          <ToastRow key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
