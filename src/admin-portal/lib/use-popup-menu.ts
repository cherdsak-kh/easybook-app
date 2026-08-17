/**
 * ONE popup-menu implementation for all of them — the account menu, the theme menu, the
 * settings menu, the notification panel.
 *
 * Written once because the fiddly parts are exactly the parts that get written slightly
 * differently each time: `aria-expanded`, click-outside, Escape, and returning focus to the
 * trigger. Four hand-rolled copies means one of them is keyboard-untrappable and nobody knows
 * which.
 *
 * ⚠️ ONE OPEN AT A TIME, ACROSS ALL OF THEM. Two panels hanging off the same bar reads as a
 * rendering bug, and on a phone the second lands on top of the first. That is enforced by a
 * module-level registry rather than by a context, deliberately: these menus do not share a
 * parent — the account menu is at the bottom of the sidebar and the rest hang off the topbar —
 * so a provider would have to wrap the whole shell to express something none of them needs a
 * provider for.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react'

/** Every mounted menu's close function. */
const OPEN_MENUS = new Set<() => void>()

export interface PopupMenu {
  open: boolean
  close: () => void
  /** Spread onto the trigger `<button>`. */
  triggerProps: {
    ref: React.RefObject<HTMLButtonElement | null>
    'aria-expanded': boolean
    'aria-controls': string
    'aria-haspopup': true
    onClick: (e: React.MouseEvent) => void
  }
  /** Spread onto the panel element. */
  menuProps: {
    ref: React.RefObject<HTMLDivElement | null>
    id: string
    hidden: boolean
    onClick: (e: React.MouseEvent) => void
  }
}

export function usePopupMenu(): PopupMenu {
  const id = useId()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  /**
   * Close, and rescue focus if it was inside the panel.
   *
   * ⚠️ MEASURED, NOT ASSUMED. Without the rescue, an outside click leaves
   * `document.activeElement` on a link inside a `display:none` panel —
   * `getClientRects().length === 0`, i.e. focus parked on something that is not on screen. The
   * next Tab then starts from a place the user cannot see, and a screen reader is sitting on a
   * hidden element. The prototype has this bug too; it is the design authority, which does not
   * make it the accessibility authority.
   *
   * The `contains` check is what keeps this from STEALING focus: when another menu opens, this
   * one closes too, but focus has already moved to that menu's trigger (buttons focus on
   * mousedown, before the click handler runs), so the branch is skipped. Reading
   * `activeElement` before `setOpen` matters for the same reason — after the re-render the
   * panel is gone and the answer is always "no".
   */
  const close = useCallback(() => {
    const focusWasInside = menuRef.current?.contains(document.activeElement)
    setOpen(false)
    if (focusWasInside) triggerRef.current?.focus()
  }, [])

  /** Escape and menu-item activation: return focus unconditionally — the user is on the keyboard. */
  const closeAndReturnFocus = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

  // Register so the other menus can close this one.
  useEffect(() => {
    if (!open) return
    OPEN_MENUS.add(close)
    return () => {
      OPEN_MENUS.delete(close)
    }
  }, [open, close])

  useEffect(() => {
    if (!open) return

    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (!menuRef.current?.contains(t) && !triggerRef.current?.contains(t)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAndReturnFocus()
    }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close, closeAndReturnFocus])

  // Focus on open, AFTER the panel has rendered.
  useEffect(() => {
    if (!open) return
    const panel = menuRef.current
    if (!panel) return

    // ⚠️ VISIBLE candidates only. `querySelector` will happily hand back a control inside a
    // `hidden` subtree — measured in the prototype's notification panel: in the empty state it
    // returned a row from the hidden list, `.focus()` did nothing, and `document.activeElement`
    // was BODY with an open panel.
    const candidates = Array.from(
      panel.querySelectorAll<HTMLElement>(
        '[data-menu-focus], a[href], button:not(:disabled), input:not(:disabled)',
      ),
    ).filter((el) => el.getClientRects().length > 0)

    // ⚠️ `data-menu-focus` overrides "first focusable", and it is not a nicety: in the
    // notification panel the first control is "อ่านทั้งหมด", so landing there means one Enter
    // wipes every unread marker. Skipped when that element is hidden, where the scan is right
    // again — which is why the filter runs before this pick and not after.
    const preferred = candidates.find((el) => el.hasAttribute('data-menu-focus'))
    ;(preferred ?? candidates[0])?.focus()
  }, [open])

  return {
    open,
    close,
    triggerProps: {
      ref: triggerRef,
      'aria-expanded': open,
      'aria-controls': id,
      'aria-haspopup': true,
      onClick: (e) => {
        // Without this the document listener installed by an ALREADY-open menu sees this same
        // click bubble up and treats it as an outside click.
        e.stopPropagation()
        const willOpen = !open
        OPEN_MENUS.forEach((closeOther) => {
          if (closeOther !== close) closeOther()
        })
        setOpen(willOpen)
      },
    },
    menuProps: {
      ref: menuRef,
      id,
      hidden: !open,
      onClick: (e) => {
        // `.menu-item` covers the list-shaped menus. Notification ROWS are records rather than
        // nav choices, so they opt in with `data-menu-close`; the panel's own head controls
        // deliberately do NOT, or marking everything read would also dismiss the panel you were
        // reading.
        if ((e.target as HTMLElement).closest('.menu-item, [data-menu-close]')) {
          closeAndReturnFocus()
        }
      },
    },
  }
}
