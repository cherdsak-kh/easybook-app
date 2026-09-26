/**
 * The per-row ⋯ menu — ONE element for the whole list (prototype `#nt-row-menu`, 6833–6846, and its
 * script 21023–21102), positioned against whichever row's ⋯ was pressed. Ten rows would otherwise
 * mean ten menus in the DOM, ten ids to keep unique and ten outside-click handlers.
 *
 * ⚠️ `fixed`, NOT `absolute` (`.nt-menu`). The rows live inside `.card-scroll`, whose non-visible
 * overflow clips in BOTH axes, so an absolute menu hanging off the last row would be cut at the
 * card's edge — on the row an operator reaches last and clicks most. Fixed takes it out of every
 * scroller; the price is that it cannot follow its row, so any scroll (capture phase — the content
 * region scrolls, and scroll events do not bubble) and any resize close it.
 *
 * ⚠️ NOT `usePopupMenu`. That hook is one trigger to one panel; this menu has N triggers, and which
 * one it hangs off is state the page owns.
 *
 * Rendered at the page root, OUTSIDE the card, so no scroller can clip it and no panel swap (the
 * skeleton, the error) can unmount it mid-use.
 */

import { useEffect, useLayoutEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import type { AdminNotification } from '../../../lib/notifications-api'
import { ICON } from '../notification-icons'

/** px between the menu and the viewport edge, and between it and its button. */
const EDGE = 8
const GAP = 4

export function RowMenu({
  id,
  row,
  anchor,
  onClose,
  onToggleRead,
  onDelete,
}: {
  id: string
  /** The row the menu is open for; `null` = closed. Looked up fresh on every render by the page. */
  row: AdminNotification | null
  anchor: HTMLButtonElement | null
  /** `refocus` = hand focus back to the ⋯ (Escape, and a picked item); an outside click does not. */
  onClose: (refocus: boolean) => void
  onToggleRead: (row: AdminNotification) => void
  onDelete: (row: AdminNotification) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const firstRef = useRef<HTMLButtonElement>(null)
  const open = row !== null && anchor !== null

  /**
   * Placement, measured AFTER the menu is visible so its real size is known (prototype `place()`):
   * right-aligned to the ⋯, clamped into the viewport — at 375px a 240px menu off a button near the
   * right edge would otherwise start at x=-12 — and flipped UP when there is no room below, which is
   * the last row every time.
   */
  useLayoutEffect(() => {
    const menu = ref.current
    if (!open || !menu || !anchor) return
    const r = anchor.getBoundingClientRect()
    const w = menu.offsetWidth
    const h = menu.offsetHeight
    const left = Math.min(Math.max(EDGE, r.right - w), window.innerWidth - w - EDGE)
    let top = r.bottom + GAP
    if (top + h > window.innerHeight - EDGE) top = Math.max(EDGE, r.top - h - GAP)
    menu.style.left = `${left}px`
    menu.style.top = `${top}px`
    // `preventScroll`: the menu is already placed in the viewport, and a scroll here would be read
    // by the capture listener below as "the page moved" and close the menu it just opened.
    firstRef.current?.focus({ preventScroll: true })
  }, [open, anchor])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: globalThis.MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose(false)
    }
    const onDocKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose(true)
      }
    }
    const onMove = () => onClose(false)
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onDocKey)
    document.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onDocKey)
      document.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, onClose])

  /** `role="menu"` promises arrow keys. Two items, so Up and Down both just move to the other one. */
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
    const at = items.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      items[(at + step + items.length) % items.length]?.focus()
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      items[e.key === 'Home' ? 0 : items.length - 1]?.focus()
    } else if (e.key === 'Tab') {
      // Leaving the menu closes it, back on its ⋯ — Tab then carries on from there.
      onClose(true)
    }
  }

  return (
    <div
      ref={ref}
      id={id}
      role="menu"
      aria-label="ตัวเลือกของการแจ้งเตือน"
      hidden={!open}
      className="nt-menu"
      onKeyDown={onKey}
    >
      <button
        ref={firstRef}
        type="button"
        role="menuitem"
        className="nt-menu-item"
        onClick={() => {
          if (!row) return
          onClose(true)
          onToggleRead(row)
        }}
      >
        <svg
          aria-hidden="true"
          className="nt-menu-ico"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={ICON.envelopeOpen} />
        </svg>
        {/* Says what the item WILL DO, not what the row currently is. */}
        <span>{row?.isRead ? 'ทำเครื่องหมายว่ายังไม่อ่าน' : 'ทำเครื่องหมายว่าอ่านแล้ว'}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="nt-menu-item nt-menu-danger"
        onClick={() => {
          if (!row) return
          // Back on the ⋯ FIRST, so the confirm dialog records it as its opener and a cancel lands
          // the keyboard where it started.
          onClose(true)
          onDelete(row)
        }}
      >
        <svg
          aria-hidden="true"
          className="nt-menu-ico"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={ICON.trash} />
        </svg>
        ลบการแจ้งเตือนนี้
      </button>
    </div>
  )
}
