/**
 * ข้อความตอบกลับด่วน — snippets to paste into LINE's own chat console. Prototype 6893–6922; since
 * ANNOUNCE-UI-6 the list comes from `GET /api/v1/canned-replies` and writers manage it (D-3…D-5).
 *
 * ── Independent of the page (D-5) ──
 * The card owns its state (`useCannedReplies`): its own GET on mount, in parallel with the list,
 * the counts and the bot info. Loading shows item-shaped skeletons; a failure shows an alert with
 * ลองอีกครั้ง — and the rest of the page works whatever state this card is in.
 *
 * ── Three roles (D-3) ──
 * A VIEWER reads and copies: no counter, no add, no pencil, no trash — RENDERED OR NOT, never hidden
 * with CSS. A writer (`acl.write`) also sees `(n/5)`, `เพิ่มข้อความ` and the two icon buttons, but
 * only once the list has loaded. The server's `@Roles` is the control.
 *
 * ── The dialogs live HERE, once (design S-4) ──
 * `CannedReplyModal` and the delete `ConfirmModal` are rendered at card level, never inside an item:
 * an item removed with its `<dialog>` open would unmount with no `close` event and drop focus on
 * `<body>`.
 *
 * ── Focus return (D-4, design §2.6) ──
 * `Modal` restores focus to its opener. When that opener is gone (its item was deleted) or disabled
 * (the 5th add disabled เพิ่มข้อความ), the card heading takes focus instead — in a timeout, so it runs
 * after `Modal`'s own restore whichever order they land in.
 */

import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { ConfirmModal } from '../../../components/feedback/ConfirmModal'
import { InlineAlert } from '../../../components/feedback/InlineAlert'
import { Skeleton, SkeletonRegion } from '../../../components/feedback/Skeleton'
import { Spinner } from '../../../components/feedback/Spinner'
import { Btn } from '../../../components/ui/Btn'
import { COPY_SELECT_MESSAGE, useCopy } from '../../../lib/use-copy'
import { useToast } from '../../../lib/toast-context'
import { ICON } from '../announcement-icons'
import { deleteCannedReply, type CannedReply } from '../canned-replies-api'
import { CANNED_REPLIES_MAX, cannedDeleteOutcome, removedToast } from '../canned-reply-outcomes'
import { useCannedReplies } from '../use-canned-replies'
import { Glyph } from './AnnouncementGlyph'
import { CannedReplyModal } from './CannedReplyModal'

/** How long the button reads `คัดลอกแล้ว` after a real copy. */
const COPIED_MS = 1500

/**
 * `.btn-ghost2` in primary text. The portal has no daisyUI `.btn` (design S-6), and `.btn-ghost2`
 * has no disabled style, so the disabled look is spelled out: the note below says WHY it is off.
 */
const ADD_BTN =
  'btn-ghost2 min-h-9 shrink-0 gap-1.5 border-transparent bg-transparent px-3 text-[13px] text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:text-base-content/70 disabled:hover:bg-transparent'

/**
 * `open: false` KEEPS `seq` and `target`, so the same modal instance stays mounted for the close
 * commit (the `Modal` rule: `close` fires and the opener gets focus back). The next open re-keys it.
 */
type FormState = { open: boolean; seq: number; target: CannedReply | null }

/** Same rule: `row` outlives `open`, so the confirm's `who` does not go blank while it closes. */
type DeleteState = { open: boolean; row: CannedReply | null }

export function CannedRepliesCard({ canWrite }: { canWrite: boolean }) {
  const toast = useToast()
  const { state, retry, commit } = useCannedReplies()
  const [form, setForm] = useState<FormState>({ open: false, seq: 0, target: null })
  const [del, setDel] = useState<DeleteState>({ open: false, row: null })

  /** The add button, a pencil or a trash — whoever opened the last dialog. */
  const opener = useRef<HTMLButtonElement | null>(null)
  const headRef = useRef<HTMLHeadingElement>(null)
  /** The delete lock; `ConfirmModal`'s own `useBusy` is the second guard. */
  const inFlight = useRef(false)
  const previous = useRef(state.status)

  /**
   * A successful ลองอีกครั้ง unmounts the button that had focus; the heading takes it (the
   * `LineOaCard` effect). ONLY on failed → ok, never on the first load.
   */
  useEffect(() => {
    if (previous.current === 'failed' && state.status === 'ok') headRef.current?.focus()
    previous.current = state.status
  }, [state.status])

  const rows = state.status === 'ok' ? state.rows : null
  const failed = state.status === 'failed' ? state : null
  const n = rows?.length ?? 0
  /** The counter, the add button and the icon buttons: a writer, after a successful load (D-3). */
  const manage = canWrite && rows !== null
  const full = manage && n >= CANNED_REPLIES_MAX

  /* ── focus after a dialog closes (design §2.6) ── */

  const refocusLater = () => {
    setTimeout(() => {
      const o = opener.current
      if (!o?.isConnected || o.disabled) headRef.current?.focus()
    }, 0)
  }

  /* ── create / edit ── */

  const openCreate = (e: MouseEvent<HTMLButtonElement>) => {
    opener.current = e.currentTarget
    setForm((f) => ({ open: true, seq: f.seq + 1, target: null }))
  }

  const openEdit = (row: CannedReply, el: HTMLButtonElement) => {
    opener.current = el
    setForm((f) => ({ open: true, seq: f.seq + 1, target: row }))
  }

  /** ⚠️ IDEMPOTENT: `Modal` calls `onClose` twice (the ✕ or ยกเลิก, then its `close` event). */
  const closeForm = () => {
    setForm((f) => (f.open ? { ...f, open: false } : f))
    refocusLater()
  }

  /* ── delete ── */

  const openDelete = (row: CannedReply, el: HTMLButtonElement) => {
    opener.current = el
    setDel({ open: true, row })
  }

  /** Idempotent, like `closeForm`. */
  const closeDelete = () => {
    setDel((d) => (d.open ? { ...d, open: false } : d))
    refocusLater()
  }

  /** Never throws. Every non-401 outcome closes the confirm — it has no inline region (D-4). */
  const runDelete = async () => {
    const row = del.row
    if (inFlight.current || !del.open || !row) return
    inFlight.current = true
    try {
      const r = await deleteCannedReply(row.id)
      if (r.ok) {
        commit({ kind: 'removed', id: row.id })
        closeDelete()
        toast('success', removedToast(row.title))
        return
      }
      const o = cannedDeleteOutcome(r)
      // 404: gone already — drop it locally now (design S-3), then reconcile.
      if (o.kind === 'gone') commit({ kind: 'removed', id: row.id })
      closeDelete()
      if (o.kind !== 'none') toast(o.toast.kind, o.toast.text)
    } finally {
      inFlight.current = false
    }
  }

  return (
    <section aria-labelledby="an-canned-h" className="pf-card flex min-w-0 flex-col">
      <div className="pf-body flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {/* `tabIndex={-1}`: focus lands here when the button that opened a dialog is gone or
                disabled, and after a successful retry. */}
            <h2
              id="an-canned-h"
              ref={headRef}
              tabIndex={-1}
              className="pf-title flex items-center gap-2 outline-none"
            >
              <Glyph d={ICON.chat} className="h-5 w-5 shrink-0 text-base-content/60" />
              ข้อความตอบกลับด่วน
              {/* A WRITER concern (D-3): `n/5` tells you how many more you may add. Plain text,
                  never `.badge` (design §4.1). The leading space keeps the text content readable. */}
              {manage && (
                <span className="tabular-nums">
                  {' '}
                  ({n}/{CANNED_REPLIES_MAX})
                </span>
              )}
            </h2>
            <p className="m-0 mt-1 text-[13px] leading-[1.55] text-base-content/70">
              คัดลอกแล้วนำไปวางในห้องแชท LINE OA
            </p>
          </div>
          {manage && (
            // Disabled, not hidden, at the limit: its absence would not explain itself; the note does.
            <button
              type="button"
              onClick={openCreate}
              disabled={full}
              aria-describedby={full ? 'an-canned-limit' : undefined}
              className={ADD_BTN}
            >
              <Glyph d={ICON.plus} className="h-4 w-4 shrink-0" strokeWidth={2} />
              เพิ่มข้อความ
            </button>
          )}
        </div>

        {full && (
          <p id="an-canned-limit" className="m-0 text-[13px] text-base-content/70">
            ครบขีดจำกัดสูงสุด {CANNED_REPLIES_MAX} ข้อความแล้ว
          </p>
        )}

        {/* ALWAYS MOUNTED, empty unless the load failed: a live region created at the same moment
            as its text is not announced (the `LineOaCard` rule). */}
        <InlineAlert message={failed ? 'โหลดข้อความตอบกลับด่วนไม่สำเร็จ' : null} className="mb-0" />
        {failed && (
          // Not `disabled` while retrying: that would blur the button the keyboard is on. The hook
          // keeps only the newest read, so a second press is harmless. A failed retry keeps it.
          <Btn
            variant="ghost"
            className="self-start"
            onClick={retry}
            aria-busy={failed.retrying || undefined}
            aria-label={failed.retrying ? 'กำลังโหลดข้อความตอบกลับด่วน' : undefined}
          >
            {failed.retrying ? <Spinner /> : <Glyph d={ICON.refresh} />}
            ลองอีกครั้ง
          </Btn>
        )}

        {state.status === 'loading' && (
          <SkeletonRegion label="กำลังโหลดข้อความตอบกลับด่วน" className="flex flex-col gap-2.5">
            {/* Item-shaped: the same border and padding, a 36px title row (the copy button's
                height) and two 20px text lines, so nothing jumps when the rows land. */}
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                aria-hidden="true"
                className="block rounded-control border border-base-300 p-3"
              >
                <span className="flex min-h-9 items-center">
                  <Skeleton className="h-4 w-32" />
                </span>
                <span className="mt-1 flex flex-col gap-2 py-1">
                  <Skeleton variant="soft" className="h-3" />
                  <Skeleton variant="soft" className="h-3 w-3/4" />
                </span>
              </span>
            ))}
          </SkeletonRegion>
        )}

        {rows !== null &&
          (rows.length === 0 ? (
            <div className="flex flex-col gap-1">
              <p className="m-0 text-[14px] text-base-content">ยังไม่มีข้อความตอบกลับด่วน</p>
              {canWrite && (
                <p className="m-0 text-[13px] leading-[1.55] text-base-content/70">
                  กด + เพิ่มข้อความ เพื่อสร้างข้อความแรก
                </p>
              )}
            </div>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {/* Keyed by `id`, never by title: duplicate titles are legal. */}
              {rows.map((r) => (
                <CannedReplyItem
                  key={r.id}
                  row={r}
                  canWrite={canWrite}
                  onEdit={openEdit}
                  onDelete={openDelete}
                />
              ))}
            </ul>
          ))}
      </div>

      {/* ── Card level, never inside an item (design S-4) ── */}
      {form.seq > 0 && (
        <CannedReplyModal
          key={form.seq}
          open={form.open}
          target={form.target}
          onClose={closeForm}
          onCommitted={commit}
        />
      )}
      <ConfirmModal
        open={del.open}
        onClose={closeDelete}
        onConfirm={runDelete}
        tone="danger"
        title="ลบข้อความตอบกลับด่วนนี้?"
        who={<span className="wrap-anywhere">{del.row?.title}</span>}
        description="ลบแล้วกู้คืนไม่ได้"
        confirmLabel="ลบข้อความ"
        busyLabel="กำลังลบ…"
      />
    </section>
  )
}

/**
 * One snippet with its own `useCopy`, so each button carries its own `คัดลอกแล้ว`.
 *
 * ⚠️ THE TOAST IS DECIDED FROM `copy()`'s RETURN VALUE, never from the hook's state. A second click
 * that lands in the same state would not re-run a state effect, and a refused copy must never
 * produce a success toast (AC-13) — so each click reads its own outcome.
 */
function CannedReplyItem({
  row,
  canWrite,
  onEdit,
  onDelete,
}: {
  row: CannedReply
  canWrite: boolean
  onEdit: (row: CannedReply, el: HTMLButtonElement) => void
  onDelete: (row: CannedReply, el: HTMLButtonElement) => void
}) {
  const copy = useCopy()
  const toast = useToast()
  const timer = useRef<number | undefined>(undefined)
  const { title, text } = row

  // The pending reset dies with the row, rather than firing into an unmounted hook.
  useEffect(() => {
    const pending = timer
    return () => window.clearTimeout(pending.current)
  }, [])

  const onCopy = async () => {
    const outcome = await copy.copy()
    window.clearTimeout(timer.current)
    if (outcome === 'copied') {
      toast('success', `คัดลอกข้อความ "${title}" แล้ว`)
      timer.current = window.setTimeout(copy.reset, COPIED_MS)
    } else {
      // The text is left SELECTED by `useCopy`'s third tier; say so, never claim success. The reset
      // puts the face back to `คัดลอก`, so a second refused click toasts again.
      toast('info', COPY_SELECT_MESSAGE)
      copy.reset()
    }
  }

  return (
    <li className="rounded-control border border-base-300 p-3">
      <div className="flex items-center justify-between gap-2">
        {/* `wrap-anywhere`: a 100-character title with no spaces wraps instead of overflowing. */}
        <h3 className="m-0 min-w-0 flex-1 text-[14px] font-medium text-base-content wrap-anywhere">
          {title}
        </h3>
        <div className="flex shrink-0 items-center gap-1">
          {/* The live region is the toast (`role="status"`); `copy.announcement` is deliberately NOT
              rendered as well, or every copy would be read out twice. */}
          <button
            type="button"
            onClick={() => void onCopy()}
            aria-label={`คัดลอกข้อความ ${title}`}
            className="btn-ghost2 min-h-9 shrink-0 gap-1.5 border-transparent bg-transparent px-3 text-[13px] hover:bg-base-content/5"
          >
            <Glyph d={ICON.copy} className="h-4 w-4 shrink-0" />
            {copy.label}
          </button>
          {/* Rendered only for a writer — never hidden with CSS (D-3). 36px (`h-9 w-9` beats the
              44px `.icon-btn`) so three actions fit the ~300px xl column (design S-7). */}
          {canWrite && (
            <>
              <button
                type="button"
                onClick={(e) => onEdit(row, e.currentTarget)}
                aria-label={`แก้ไขข้อความ ${title}`}
                data-tip="แก้ไข"
                data-tip-pos="left"
                className="icon-btn icon-btn-edit h-9 w-9"
              >
                <Glyph d={ICON.pencil} className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={(e) => onDelete(row, e.currentTarget)}
                aria-label={`ลบข้อความ ${title}`}
                data-tip="ลบ"
                data-tip-pos="left"
                className="icon-btn icon-btn-no h-9 w-9"
              >
                <Glyph d={ICON.trash} className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      </div>
      {/* `useCopy` copies this element's `textContent` — the FULL snippet, even though only two
          lines show — and its fallback selects this element, which is the one the reader sees. */}
      <p
        ref={copy.ref as React.Ref<HTMLParagraphElement>}
        className="m-0 mt-1 line-clamp-2 text-[13px] leading-[1.55] text-base-content/70"
      >
        {text}
      </p>
    </li>
  )
}
