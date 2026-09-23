/**
 * ตัวดูรูปภาพ — the report's photos, one at a time, over the detail dialog (prototype 9436–9454).
 *
 * ⚠️ AN ABSOLUTE LAYER INSIDE THE DIALOG PANEL, NOT A SECOND <dialog> (AC-51). Two stacked modals
 * paint `::backdrop` twice and on a phone leave two cards fighting for 375px. `Modal`'s `overlay`
 * slot mounts this as the panel's last child; `.fb-lightbox` is `absolute inset-0 z-20`. On a phone
 * the panel is the screen, so this is effectively full-screen there.
 *
 * ── Keys, owned while it is open ──
 * One CAPTURE-phase listener on the document takes Escape, ←/→ and Tab before anything else sees
 * them:
 *  · Escape closes THIS, not the dialog (AC-50). `preventDefault()` on the keydown is what stops
 *    the platform turning it into the dialog's `cancel`; `stopPropagation()` keeps it from any
 *    other listener. A second Escape — with this unmounted — reaches the dialog as normal.
 *  · ←/→ step through the photos; the buttons are disabled at the ends and so are the keys.
 *  · Tab cycles between this layer's buttons only. The dialog's own controls are still in the
 *    tab order underneath, and focus wandering under an opaque layer is focus nobody can see.
 *
 * Focus lands on ✕ when it opens; the caller returns it to the thumbnail that opened it.
 */

import { useEffect, useRef } from 'react'
import { ICON } from '../feedback-icons'
import { Glyph } from './FeedbackGlyph'

export function FeedbackLightbox({
  photos,
  index,
  code,
  onIndex,
  onClose,
}: {
  photos: readonly string[]
  /** Zero-based. */
  index: number
  /** The report's code, for the image's alt text. */
  code: string
  onIndex: (next: number) => void
  onClose: () => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const n = photos.length
  const atStart = index <= 0
  const atEnd = index >= n - 1

  // Open = mount: the close button takes focus, so Escape and Enter both have somewhere to land.
  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  // ⚠️ `disabled` BLURS the element it lands on. Stepping to the last photo with the → button
  // focused disables that button and drops focus on <body>; put it back on ✕ instead.
  useEffect(() => {
    const root = rootRef.current
    if (root && !root.contains(document.activeElement)) closeRef.current?.focus()
  }, [index])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        e.stopPropagation()
        if (e.key === 'ArrowLeft' && !atStart) onIndex(index - 1)
        if (e.key === 'ArrowRight' && !atEnd) onIndex(index + 1)
        return
      }
      if (e.key === 'Tab') {
        const root = rootRef.current
        if (!root) return
        const stops = [...root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
        if (!stops.length) return
        e.preventDefault()
        e.stopPropagation()
        const at = stops.indexOf(document.activeElement as HTMLButtonElement)
        const step = e.shiftKey ? -1 : 1
        stops[(at + step + stops.length) % stops.length].focus()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [atEnd, atStart, index, onClose, onIndex])

  return (
    <div
      ref={rootRef}
      className="fb-lightbox"
      role="group"
      aria-roledescription="ตัวดูรูปภาพ"
      aria-label="ดูรูปภาพแนบ"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 text-white">
        {/* Polite, so stepping with ← / → is announced as a position as well as a new alt text. */}
        <p aria-live="polite" className="m-0 px-1 text-[14px] font-medium tabular-nums">
          {index + 1} / {n}
        </p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="fb-lb-btn"
          aria-label="ปิดตัวดูรูปภาพ"
        >
          <Glyph d={ICON.close} className="h-6 w-6" strokeWidth={2} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center gap-2">
        <button
          type="button"
          onClick={() => onIndex(index - 1)}
          disabled={atStart}
          className="fb-lb-btn"
          aria-label="รูปก่อนหน้า"
        >
          <Glyph d={ICON.prev} className="h-6 w-6" strokeWidth={2} />
        </button>
        {/* A dead URL (the object was removed) renders the browser's broken-image box with its
            alt text intact; navigation keeps working and nothing throws (E-4). */}
        <img
          src={photos[index]}
          alt={`รูปภาพแนบที่ ${index + 1} ของเรื่อง ${code}`}
          className="mx-auto max-h-full min-w-0 flex-1 rounded-control object-contain"
        />
        <button
          type="button"
          onClick={() => onIndex(index + 1)}
          disabled={atEnd}
          className="fb-lb-btn"
          aria-label="รูปถัดไป"
        >
          <Glyph d={ICON.next} className="h-6 w-6" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
