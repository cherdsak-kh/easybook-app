/**
 * `ข้อความตอบกลับด่วน` — everything about a canned-reply write that has a return value: the limits,
 * the copy, client validation, the two outcome maps and the local list update (ANNOUNCE-UI-6 design
 * §2.2). PURE, pinned by `tests/unit/.../canned-reply-outcomes.test.ts`; the card and the modal only
 * APPLY what this returns.
 *
 * ⚠️ MATCH ON `code` FIRST, then status (the `announcement-outcomes.ts` rule). A code-less 400 (the
 * pipe's `string[]`) is invalid data, NEVER the limit — only `CANNED_REPLIES_LIMIT_EXCEEDED` is.
 *
 * `SAVE_INVALID` and `WRITE_FAIL` are IMPORTED from the announcement outcomes, so the house wording
 * keeps exactly one spelling.
 */

import { SAVE_INVALID, WRITE_FAIL, type ToastSpec } from './announcement-outcomes'
import type { WriteFailure } from './announcements-api'
import type { CannedReply, CannedReplyErrorCode, CannedReplyInput } from './canned-replies-api'

/* ── limits — mirror the server's constants (`canned-replies.constants.ts`) ─────────────────── */

export const CANNED_REPLIES_MAX = 5
export const CANNED_TITLE_MAX = 100
export const CANNED_TEXT_MAX = 1000

/** Typed against the generated union, so a contract rename breaks the build. */
const LIMIT: CannedReplyErrorCode = 'CANNED_REPLIES_LIMIT_EXCEEDED'
const NOT_FOUND: CannedReplyErrorCode = 'CANNED_REPLY_NOT_FOUND'

/* ── copy ───────────────────────────────────────────────────────────────────────────────────── */

/** The limit race, inline in the modal. A CLIENT constant, byte-equal to the server's `message`. */
export const CANNED_LIMIT = `ข้อความตอบกลับด่วนสามารถมีได้สูงสุดไม่เกิน ${CANNED_REPLIES_MAX} ข้อความ`
/** PATCH 404 — an ERROR toast: the edit the user typed was not saved. */
export const CANNED_NOT_FOUND = 'ไม่พบข้อความนี้ อาจถูกลบไปแล้ว'
/** DELETE 404 — an INFO toast: the user wanted it gone, and it is. */
export const CANNED_DELETED_ALREADY = 'ข้อความนี้ถูกลบไปแล้ว'

export const CANNED_FIELD_ERR = {
  title: 'กรุณากรอกหัวข้อ',
  text: 'กรุณากรอกข้อความ',
} as const

export const createdToast = (title: string) => `เพิ่มข้อความ '${title}' แล้ว`
export const updatedToast = (title: string) => `บันทึกข้อความ '${title}' แล้ว`
export const removedToast = (title: string) => `ลบข้อความ '${title}' แล้ว`

/* ── the form ───────────────────────────────────────────────────────────────────────────────── */

/** RAW, as typed. The counters show the raw length; validation and the payload use the trimmed. */
export interface CannedValues {
  title: string
  text: string
}
export type CannedField = keyof CannedValues
export type CannedErrors = Partial<Record<CannedField, string>>

export const valuesOf = (row: CannedReply | null): CannedValues => ({
  title: row?.title ?? '',
  text: row?.text ?? '',
})

/** Blank or spaces-only → the field's error. Length is capped by `maxLength`, so never checked. */
export function validateCanned(v: CannedValues): CannedErrors {
  const errs: CannedErrors = {}
  if (!v.title.trim()) errs.title = CANNED_FIELD_ERR.title
  if (!v.text.trim()) errs.text = CANNED_FIELD_ERR.text
  return errs
}

/** Where focus goes after a refused save: the title first, in reading order. */
export const firstInvalidCanned = (e: CannedErrors): CannedField | null =>
  e.title ? 'title' : e.text ? 'text' : null

/** Edit with nothing changed (trimmed compare) → close with NO PATCH and no toast (AC-12). */
export const isUnchanged = (v: CannedValues, row: CannedReply): boolean =>
  v.title.trim() === row.title && v.text.trim() === row.text

export const toInput = (v: CannedValues): CannedReplyInput => ({
  title: v.title.trim(),
  text: v.text.trim(),
})

/* ── the list, updated locally before the reconciling GET (D-4) ─────────────────────────────── */

export type CannedChange =
  /** Append at the end — where the server put it (no `sortOrder` sent). */
  | { kind: 'created'; row: CannedReply }
  /** Replace by id, at the SAME index. */
  | { kind: 'updated'; row: CannedReply }
  /** Filter by id. */
  | { kind: 'removed'; id: string }
  /** Nothing to apply locally, just reconcile (the limit race). */
  | { kind: 'none' }

export function applyChange(rows: readonly CannedReply[], c: CannedChange): CannedReply[] {
  switch (c.kind) {
    case 'created':
      // A reconciling GET that already carried the row must not leave a duplicate key behind.
      return rows.some((r) => r.id === c.row.id)
        ? rows.map((r) => (r.id === c.row.id ? c.row : r))
        : [...rows, c.row]
    case 'updated':
      return rows.map((r) => (r.id === c.row.id ? c.row : r))
    case 'removed':
      return rows.filter((r) => r.id !== c.id)
    case 'none':
      return [...rows]
  }
}

/* ── outcome maps ───────────────────────────────────────────────────────────────────────────── */

const isNotFound = (f: WriteFailure) =>
  f.status === 404 && (f.code === undefined || f.code === NOT_FOUND)

const writeFailText = (status: number) => WRITE_FAIL[status] ?? WRITE_FAIL[503]

/** POST / PATCH. */
export type CannedSaveOutcome =
  /** The modal stays open with the inline alert; the typed input is KEPT. */
  | { kind: 'stay'; alert: string; reconcile: boolean }
  /** Close, remove the row locally, reconcile (PATCH 404). */
  | { kind: 'gone'; toast: ToastSpec }
  /** 401 — the session-expired dialog owns it. */
  | { kind: 'none' }

export function cannedSaveOutcome(f: WriteFailure): CannedSaveOutcome {
  if (f.status === 401) return { kind: 'none' }
  // The limit race: the list behind is re-read, so the header reads the server's count.
  if (f.code === LIMIT) return { kind: 'stay', alert: CANNED_LIMIT, reconcile: true }
  // Any other 400: a pipe `string[]`, `UPDATE_EMPTY`, or a code this build does not know.
  if (f.status === 400) return { kind: 'stay', alert: SAVE_INVALID, reconcile: false }
  if (isNotFound(f)) return { kind: 'gone', toast: { kind: 'error', text: CANNED_NOT_FOUND } }
  return { kind: 'stay', alert: writeFailText(f.status), reconcile: false }
}

/** DELETE. The `ConfirmModal` has no inline region, so every non-401 outcome closes it. */
export type CannedDeleteOutcome =
  /** 404: info toast, remove locally, reconcile. */
  | { kind: 'gone'; toast: ToastSpec }
  /** 403 / 503 / 0 / anything else: error toast, the item STAYS, no reconcile. */
  | { kind: 'kept'; toast: ToastSpec }
  /** 401: close the confirm, no toast. */
  | { kind: 'none' }

export function cannedDeleteOutcome(f: WriteFailure): CannedDeleteOutcome {
  if (f.status === 401) return { kind: 'none' }
  if (isNotFound(f)) return { kind: 'gone', toast: { kind: 'info', text: CANNED_DELETED_ALREADY } }
  return { kind: 'kept', toast: { kind: 'error', text: writeFailText(f.status) } }
}
