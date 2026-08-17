/**
 * One row in the notification panel.
 *
 * ⚠️ THE UNREAD COUNT HAS EXACTLY ONE SOURCE — the rows. `unreadCount` and `bellLabel` in
 * `lib/notifications.ts` both derive from the same array; nothing here keeps its own tally.
 *
 * ⚠️ Opening the panel does NOT mark everything read. Seeing that three things happened is
 * not the same as having dealt with them, and an operator who glances at the bell mid-task
 * would lose the list they came back for. Reading happens per row, on click.
 *
 * The unread state is carried three ways on purpose — a tinted background, a bolder title,
 * and a dot — because the first two are colour and weight, which a screen reader gets
 * neither of. The `sr-only` word is what actually says it.
 */

import type { Notification } from '../../lib/notifications'

export function NotifRow({
  item,
  onRead,
  preferFocus = false,
}: {
  item: Notification
  onRead: (id: string) => void
  /**
   * ⚠️ SET THIS ON THE FIRST ROW OF A POPUP PANEL. Without it the panel's first focusable
   * control is "ทำเครื่องหมายว่าอ่านแล้วทั้งหมด", so opening the bell and pressing Enter wipes
   * every unread marker — measured, on the first build of the topbar, by the same person who
   * had written the warning into `usePopupMenu` an hour earlier.
   *
   * It is a per-ROW flag rather than something the panel does to its container because the
   * empty and loading states have no rows, and there the default "first visible focusable"
   * scan is the right answer.
   */
  preferFocus?: boolean
}) {
  return (
    <button
      type="button"
      data-menu-focus={preferFocus ? '' : undefined}
      data-menu-close=""
      onClick={() => onRead(item.id)}
      className={`notif-row w-full text-left ${item.read ? '' : 'notif-row-unread'}`.trim()}
    >
      {/* ⚠️ ORDER IS ICON → TEXT → DOT, matching the prototype. The dot sits at the row's
          TRAILING edge, not before the tile: an unread marker in front of the icon pushes every
          title 20px right and un-aligns the list the moment one row is read. Read rows therefore
          need no spacer at all — `flex-1` on the text already holds the shape. */}
      <span aria-hidden="true" className={`notif-ico notif-tone-${item.tone}`}>
        {item.icon}
      </span>
      <span className="min-w-0 flex-1">
        {/* BEFORE the title, not after: a screen reader announcing the whole sentence and then
            "ยังไม่อ่าน" makes the listener re-file what they just heard. */}
        {!item.read && <span className="sr-only">ยังไม่อ่าน · </span>}
        <span className={`notif-title block ${item.read ? '' : 'notif-title-unread'}`.trim()}>
          {item.title}
        </span>
        {item.detail && <span className="notif-sub block">{item.detail}</span>}
        <span className="notif-time block">{item.time}</span>
      </span>
      {!item.read && <span aria-hidden="true" className="notif-dot" />}
    </button>
  )
}

/**
 * The "mark all read" control, in the same file because it and the rows are the two halves of
 * one count.
 *
 * ⚠️ IT MOVES FOCUS ITSELF, and that is the whole reason `listRef` is a required prop.
 * The button disables the instant the last unread row clears, and focus left on a control
 * that just went disabled drops the keyboard user out of the panel entirely — measured: after
 * a read-all, `document.activeElement` had fallen through to an unrelated heading elsewhere
 * on the page.
 *
 * The first draft documented this as something the CALLER must do. The showcase — written by
 * the same person, in the same hour — did not do it, which is the whole argument against
 * requirements that live in prose: make the component impossible to use wrongly instead.
 */
export function NotifReadAll({
  count,
  onReadAll,
  listRef,
  onAnnounce,
}: {
  count: number
  onReadAll: () => void
  /** The panel's row container. Focus lands on its first row after the sweep. */
  listRef: React.RefObject<HTMLElement | null>
  /**
   * Says out loud what the sweep did.
   *
   * ⚠️ Without it the ONLY feedback is dots vanishing, which a screen-reader user cannot see.
   * A toast is the wrong tool: the panel is still open and focus is inside it, so the message
   * belongs in a live region within the panel — which is what the prototype does and what this
   * port had dropped.
   */
  onAnnounce: (message: string) => void
}) {
  return (
    <button
      type="button"
      disabled={count === 0}
      onClick={() => {
        // ⚠️ FOCUS FIRST, THEN SWEEP — deliberately this order.
        // The obvious version marks everything read and then chases the new focus target
        // inside `requestAnimationFrame`. Measured: focus still landed nowhere, because the
        // frame can run before React has committed the re-render, and by then the button
        // holding focus had already disabled itself. The first row exists in both states, so
        // moving focus BEFORE the sweep needs no scheduling at all and cannot race.
        listRef.current?.querySelector<HTMLElement>('button')?.focus()
        onAnnounce(`ทำเครื่องหมายอ่านแล้ว ${count} รายการ`)
        onReadAll()
      }}
      className="ml-auto flex min-h-11 shrink-0 items-center rounded-control px-2 text-[13px] font-medium text-primary transition-colors hover:bg-primary/10 disabled:pointer-events-none disabled:text-base-content/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      อ่านทั้งหมด
    </button>
  )
}
