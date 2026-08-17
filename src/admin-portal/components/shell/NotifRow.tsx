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
}: {
  item: Notification
  onRead: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onRead(item.id)}
      className={`notif-row w-full text-left ${item.read ? '' : 'notif-row-unread'}`.trim()}
    >
      {item.read ? (
        // Holds the dot's column so titles stay aligned down the list once some are read.
        <span aria-hidden="true" className="mt-[7px] h-2 w-2 shrink-0" />
      ) : (
        <span aria-hidden="true" className="notif-dot" />
      )}
      <span className={`notif-ico notif-tone-${item.tone}`}>{item.icon}</span>
      <span className="min-w-0 flex-1">
        <span
          className={`notif-title block ${item.read ? '' : 'notif-title-unread'}`.trim()}
        >
          {item.title}
          {!item.read && <span className="sr-only"> · ยังไม่อ่าน</span>}
        </span>
        {item.detail && <span className="notif-sub block">{item.detail}</span>}
        <span className="notif-time block">{item.time}</span>
      </span>
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
}: {
  count: number
  onReadAll: () => void
  /** The panel's row container. Focus lands on its first row after the sweep. */
  listRef: React.RefObject<HTMLElement | null>
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
        onReadAll()
      }}
      className="min-h-11 rounded-control px-3 text-[13px] font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:text-base-content/50 disabled:hover:bg-transparent"
    >
      ทำเครื่องหมายว่าอ่านแล้วทั้งหมด
    </button>
  )
}
