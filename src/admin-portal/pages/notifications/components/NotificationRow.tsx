/**
 * One notification on การแจ้งเตือน — the prototype's `#nt-row-tpl` (6780–6827).
 *
 * THE SAME VOCABULARY AS THE BELL, ONE SIZE UP: `.notif-tone-*`, `.notif-title*` and `.notif-sub` are
 * the panel's classes reused, and only what genuinely differs gets an `.nt-*` name. Two vocabularies
 * for one idea is how the peek and the page end up disagreeing about what "unread" looks like.
 *
 * ⚠️ A PLAIN <li>, NOT A <button>. The bell's row is one big button because it has no controls inside
 * it; this one holds a checkbox and two buttons, and nesting interactive elements inside a button is
 * invalid HTML that browsers resolve by dropping the inner ones. The keyboard paths are the controls;
 * the click-anywhere-to-mark-read on the row body is a MOUSE convenience layered on top of them.
 *
 * ⚠️ `body` IS RENDERED VERBATIM (D-1). Attribution (`ชื่อ-นามสกุล · ตำแหน่ง · กลุ่ม/ฝ่าย`) is a data
 * rule owned by whoever calls the server's `create()`; this component does not parse, reorder or
 * decorate it.
 *
 * ⚠️ UNREAD IS MARKED THREE WAYS — the wash, the weight and the leading dot — plus an sr-only word,
 * because colour and weight reach neither a screen reader nor a colour-blind reader. The dot is
 * `invisible` on a read row, never removed: the 8px rail has to stay, or every title on the page
 * shifts sideways depending on whether it has been read.
 */

import type { MouseEvent } from 'react'
import { NotifGlyph } from '../../../components/shell/notif-icons'
import { NOTIF_CATEGORY_LABEL } from '../../../labels'
import { TONE_KEY, relativeTime } from '../../../lib/notifications'
import type { AdminNotification } from '../../../lib/notifications-api'
import { thaiDateTime } from '../../../lib/thai-date'
import { ICON } from '../notification-icons'

export function NotificationRow({
  item,
  picked,
  onPick,
  ctaTarget,
  onCta,
  onMenu,
  onBodyClick,
  menuOpen,
  menuId,
}: {
  item: AdminNotification
  picked: boolean
  onPick: (checked: boolean) => void
  /**
   * Where the CTA goes, already resolved against this role by `actionTarget` — `null` hides it
   * (D-14): no `actionUrl`, or a screen the role cannot open. Hidden, not disabled.
   */
  ctaTarget: string | null
  onCta: () => void
  onMenu: (button: HTMLButtonElement) => void
  onBodyClick: () => void
  menuOpen: boolean
  /** The shared ⋯ menu's id, for `aria-controls`. */
  menuId: string
}) {
  const read = item.isRead
  const tone = TONE_KEY[item.tone] ?? 'slate'
  const state = read ? 'อ่านแล้ว' : 'ยังไม่อ่าน'

  // The guard is what keeps the convenience from firing on the way to a control the operator
  // actually aimed at — the label included, because clicking it toggles the checkbox.
  const onRowClick = (e: MouseEvent<HTMLLIElement>) => {
    if ((e.target as HTMLElement).closest('button, a, label, input')) return
    onBodyClick()
  }

  return (
    <li
      className={`nt-row ${read ? '' : 'nt-row-unread'} ${picked ? 'nt-row-picked' : ''}`.trim()}
      onClick={onRowClick}
    >
      {/* A 44px-tall target in a 36px column: `.chk-box` draws the box, the LABEL carries the hit
          area. The name says WHICH notification and its read state — a column of boxes all called
          "เลือก" is a column a screen-reader user cannot navigate. */}
      <label className="nt-pick">
        <input
          type="checkbox"
          className="sr-only"
          checked={picked}
          onChange={(e) => onPick(e.target.checked)}
        />
        <span className="chk-box" aria-hidden="true">
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={ICON.tick} />
          </svg>
        </span>
        <span className="sr-only">{`เลือก: ${item.title} · ${state}`}</span>
      </label>

      <span className={`nt-dot ${read ? 'nt-dot-read' : ''}`.trim()} aria-hidden="true" />

      <span className={`notif-ico notif-ico-lg notif-tone-${tone}`} aria-hidden="true">
        <NotifGlyph name={item.icon} size="lg" />
      </span>

      {/* ⚠️ `basis-48` (192px) IS A MEASURED NUMBER (prototype 6795): at 375px the row has 329px of
          content box, the checkbox + dot + tile + gaps take 108, and 221 is left. `basis-56` is three
          pixels too wide and drops the whole text block under the tile. Do not round it. */}
      <div className="min-w-0 flex-1 basis-48">
        <p className={`notif-title ${read ? '' : 'notif-title-unread'}`.trim()}>
          {!read && <span className="sr-only">ยังไม่อ่าน · </span>}
          <span>{item.title}</span>
        </p>
        <p className="notif-sub">{item.body}</p>
        <p className="nt-meta">
          <span>{relativeTime(item.createdAt)}</span>
          <span className="nt-meta-sep" aria-hidden="true">
            ·
          </span>
          <time dateTime={item.createdAt} className="tabular-nums">
            {thaiDateTime(item.createdAt)}
          </time>
          <span className="nt-cat">{NOTIF_CATEGORY_LABEL[item.category] ?? item.category}</span>
        </p>
      </div>

      <div className="nt-actions">
        {ctaTarget && item.actionLabel && (
          <button
            type="button"
            className="nt-cta"
            aria-label={`${item.actionLabel}: ${item.title}`}
            onClick={onCta}
          >
            <span>{item.actionLabel}</span>
            <svg
              aria-hidden="true"
              className="h-4 w-4 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" d={ICON.chevronRight} />
            </svg>
          </button>
        )}
        <button
          type="button"
          className="nt-kebab"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={(e) => {
            // ⚠️ STOPPED, and it is not tidiness: the open menu's outside-click listener sits on the
            // document, and this same click reaching it would close the menu it just opened.
            e.stopPropagation()
            onMenu(e.currentTarget)
          }}
        >
          {/* `: <title>` is a flagged a11y deviation from the prototype's static name (design §1.6)
              — the checkbox's own argument: a column of identical names cannot be navigated. */}
          <span className="sr-only">{`ตัวเลือกเพิ่มเติม: ${item.title}`}</span>
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={ICON.dots} />
          </svg>
        </button>
      </div>
    </li>
  )
}
