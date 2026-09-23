/**
 * `WriteFailure` → what the compose dialog does about it. PURE: every row of plan D-3 / D-4 (design
 * §3) is a return value here, pinned by `tests/unit/.../announcement-outcomes.test.ts`, and the dialog
 * only APPLIES the result.
 *
 * ⚠️ MATCH ON `code` FIRST. Status is only the fallback — for the code-less 503, 403, 401, and the
 * unknown outcomes. An unknown `code` on a known status counts as UNKNOWN, never as the nearest
 * known row: a future 502 code must not be read as "LINE refused, nothing sent".
 *
 * ⚠️ "UNKNOWN" IS NOT "FAILED". A dropped connection during a send of up to ~90 s is exactly the case
 * where the server may already have sent (phase 2 D-A). The unknown-outcome copy therefore NEVER says
 * `ยังไม่ได้ส่ง` — saying so could lead to a double broadcast.
 */

import type { ToastKind } from '../../lib/toast-context'
import { FIELD_ERR, type FieldKey } from './announcement-form'
import type {
  Announcement,
  AnnouncementErrorCode,
  WriteFailure,
  WriteResult,
} from './announcements-api'

export type AlertTone = 'error' | 'warn' | 'info'
export interface AlertSpec {
  tone: AlertTone
  text: string
}
export interface ToastSpec {
  kind: ToastKind
  text: string
}

/** Why a `GET :id` follows — each settles the re-read differently (`afterReread`). */
export type RereadReason = 'already-sent' | 'partial' | 'immutable' | 'unknown'

export type Outcome =
  /** The dialog closes; the toast says why. */
  | { kind: 'close'; toast: ToastSpec }
  /** Stays open with a field error. `alert` also states it when a save just happened (prefix). */
  | { kind: 'field'; field: FieldKey; text: string; refetchDepts: boolean; alert: AlertSpec | null }
  /** Stays open with the always-mounted result region. */
  | { kind: 'alert'; alert: AlertSpec }
  /** Shows `alert`, then `GET :id` decides (`afterReread`). */
  | { kind: 'reread'; reason: RereadReason; alert: AlertSpec; acceptedCount?: number }
  /** 401 — `AuthProvider`'s watcher raises the session-expired dialog; nothing inline (A-13). */
  | { kind: 'none' }

/* ── copy ───────────────────────────────────────────────────────────────────────────────────── */

/** Prepended when THIS attempt created or changed the draft before the send failed (plan D-2). */
export const SAVED_PREFIX = 'บันทึกเป็นฉบับร่างแล้ว แต่'

export const NOT_FOUND = 'ไม่พบประกาศนี้ อาจถูกลบไปแล้ว'
export const ALREADY_SENT = 'ประกาศนี้ถูกส่งไปแล้ว'
/**
 * PATCH-only since ANNOUNCE-API-5: a SENT row can be deleted now, so this no longer says `หรือลบ`
 * (ANNOUNCE-UI-6 D-1).
 */
export const SENT_ELSEWHERE = 'ประกาศนี้ถูกส่งไปแล้วโดยผู้ใช้อื่น จึงแก้ไขไม่ได้'
export const SENT_ELSEWHERE_ALERT = `${SENT_ELSEWHERE} · การแก้ไขของคุณยังไม่ได้บันทึก`
/** DELETE 404 — the goal is met. The wording follows the record's status (ANNOUNCE-UI-6 S-2). */
export const DELETED_ALREADY = 'ฉบับร่างนี้ถูกลบไปแล้ว'
export const SENT_DELETED_ALREADY = 'ประกาศนี้ถูกลบไปแล้ว'
/** DELETE 409 — a send (or another write) holds the row. Retrying after it finishes succeeds. */
export const DELETE_IN_PROGRESS = 'ประกาศนี้กำลังถูกส่งอยู่ ยังไม่ได้ลบ รอสักครู่แล้วลองใหม่'

export const SEND_TEXT = {
  inProgress: 'ประกาศนี้กำลังถูกส่งอยู่ รอสักครู่แล้วตรวจสอบสถานะในรายการ',
  /**
   * ⚠️ MAIN-THREAD RULING (design flag F-1), overriding the approved D-3 copy. The server deliberately
   * does NOT claim nothing was delivered — a timed-out request may have landed, and the retry keys
   * make a resend of the UNCHANGED draft within 24 h safe. So this must not say it did not reach
   * anyone.
   */
  lineFailed:
    'ส่งประกาศไม่สำเร็จ หรือไม่สามารถยืนยันผลการส่งได้ ประกาศยังเป็นฉบับร่าง — ลองส่งอีกครั้งได้ (ระบบป้องกันการส่งซ้ำให้แล้ว)',
  notConfigured: 'ยังไม่ได้เชื่อมต่อ LINE Official Account กับระบบ · แจ้งผู้ดูแลระบบ · ยังไม่ได้ส่ง',
  rateLimited: 'LINE จำกัดการส่งชั่วคราว หรือโควตาข้อความของเดือนนี้หมดแล้ว · ยังไม่ได้ส่ง ลองใหม่ภายหลัง',
  /** The session store — it must NOT mention LINE, because it is not a LINE problem. */
  noCode: 'ระบบขัดข้องชั่วคราว ยังไม่ได้ส่ง ลองใหม่อีกครั้ง',
  csrf: 'เซสชันความปลอดภัยหมดอายุ ยังไม่ได้ส่ง โปรดรีเฟรชหน้าแล้วลองใหม่',
  /** ⚠️ Never `ยังไม่ได้ส่ง` — see the header. */
  unknown: 'ไม่ทราบผลการส่ง การเชื่อมต่อขาดระหว่างส่ง ตรวจสอบสถานะก่อนลองส่งใหม่',
} as const

/** Any other 400 on a save (a pipe `string[]`, `UPDATE_EMPTY`). Client validation should pre-empt it. */
export const SAVE_INVALID = 'ข้อมูลไม่ถูกต้อง ยังไม่ได้บันทึก ตรวจสอบแล้วลองใหม่'

/**
 * Whole-form failures that leave the dialog open with everything typed intact — BYTE-IDENTICAL to
 * the house copies in StaffPage / VenuesPage / OptionsPage. Declared here rather than extracted
 * (design §3.2: a shared module is out of scope).
 */
export const WRITE_FAIL: Record<number, string> = {
  403: 'เซสชันความปลอดภัยหมดอายุ ยังไม่ได้บันทึกอะไร โปรดรีเฟรชหน้าแล้วลองใหม่',
  503: 'ระบบขัดข้องชั่วคราว ยังไม่ได้บันทึกอะไร ลองใหม่อีกครั้ง',
  0: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ยังไม่ได้บันทึกอะไร ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่',
}

/** The three phase-1 department 400s, matched EXACTLY (phase 1 design §3.1). Bodies carry no `code`. */
export const DEPARTMENT_MESSAGES: readonly string[] = [
  'departmentId is required when audience is DEPARTMENT.',
  'departmentId must be null when audience is ALL.',
  'The selected department does not exist or is not available.',
]

const th = (n: number | undefined) => (typeof n === 'number' ? n.toLocaleString('th-TH') : '—')

export const partialText = (accepted?: number, targeted?: number) =>
  `ส่งได้บางส่วน: LINE รับไว้ ${th(accepted)} จาก ${th(targeted)} คน ประกาศนี้ถูกบันทึกว่าส่งแล้วและส่งซ้ำไม่ได้ หากต้องการส่งถึงคนที่เหลือ ให้สร้างประกาศใหม่`

export const savedToast = (title: string) => `บันทึกฉบับร่าง '${title}' แล้ว`
/** The wording follows the record's status, never the dialog's mode (ANNOUNCE-UI-6 S-2). */
export const deletedToast = (title: string, status: Announcement['status']) =>
  status === 'SENT' ? `ลบประกาศ '${title}' แล้ว` : `ลบฉบับร่าง '${title}' แล้ว`
/**
 * `sentCount` comes from the RESPONSE, never estimated (plan D-3). `0` is a SUCCESS since
 * ANNOUNCE-API-5 — the row is SENT, nobody eligible was found, and LINE was never called.
 */
export const sentToast = (title: string, sentCount: number) =>
  sentCount === 0
    ? `ส่งประกาศ '${title}' แล้ว (ไม่มีผู้รับที่เปิดรับการแจ้งเตือน)`
    : `ส่งประกาศ '${title}' ถึง ${sentCount.toLocaleString('th-TH')} คนแล้ว`

/* ── mapping ────────────────────────────────────────────────────────────────────────────────── */

const notFoundClose: Outcome = { kind: 'close', toast: { kind: 'error', text: NOT_FOUND } }

const alertOf = (tone: AlertTone, text: string): Outcome => ({ kind: 'alert', alert: { tone, text } })

const writeFail = (status: number): Outcome =>
  alertOf('error', WRITE_FAIL[status] ?? WRITE_FAIL[503])

/**
 * `POST :id/send`, after any save in the same attempt succeeded. `savedNow` — this attempt created or
 * changed the draft — prefixes the inline text with `บันทึกเป็นฉบับร่างแล้ว แต่`.
 *
 * The prefix is NOT applied to `partial` or `already-sent`: the record is SENT by then, so "saved as a
 * draft" would be untrue.
 */
export function sendOutcome(f: WriteFailure, savedNow: boolean): Outcome {
  if (f.status === 401) return { kind: 'none' }
  const pre = (text: string) => (savedNow ? `${SAVED_PREFIX}${text}` : text)
  const field = (field: FieldKey, text: string, refetchDepts: boolean): Outcome => ({
    kind: 'field',
    field,
    text,
    refetchDepts,
    // With the prefix the saved state must be stated somewhere — the field error cannot say it.
    alert: savedNow ? { tone: 'error', text: pre(text) } : null,
  })

  // ⚠️ THE CAST IS A TRIPWIRE, NOT A NARROWING (design S-1). `code` is read at runtime and may be
  // anything; casting the switch to the generated union makes a `case` for a code the contract has
  // dropped a compile error (TS2678). An unknown code still falls through to the tail below.
  switch (f.code as AnnouncementErrorCode | undefined) {
    case 'ANNOUNCEMENT_BODY_REQUIRED':
      return field('body', FIELD_ERR.bodyRequired, false)
    case 'ANNOUNCEMENT_DEPARTMENT_INVALID':
      return field('departmentId', FIELD_ERR.departmentInvalid, true)
    case 'ANNOUNCEMENT_NOT_FOUND':
      return notFoundClose
    case 'ANNOUNCEMENT_ALREADY_SENT':
      return { kind: 'reread', reason: 'already-sent', alert: { tone: 'info', text: ALREADY_SENT } }
    case 'ANNOUNCEMENT_SEND_IN_PROGRESS':
      return alertOf('error', pre(SEND_TEXT.inProgress))
    case 'ANNOUNCEMENT_PARTIALLY_SENT':
      return {
        kind: 'reread',
        reason: 'partial',
        alert: { tone: 'warn', text: partialText(f.acceptedCount, f.targetedCount) },
        acceptedCount: f.acceptedCount,
      }
    case 'LINE_SEND_FAILED':
      return alertOf('error', pre(SEND_TEXT.lineFailed))
    case 'LINE_NOT_CONFIGURED':
      return alertOf('error', pre(SEND_TEXT.notConfigured))
    case 'LINE_RATE_LIMITED':
      return alertOf('error', pre(SEND_TEXT.rateLimited))
  }

  // No code, or one this build does not know.
  if (f.code === undefined) {
    if (f.status === 404) return notFoundClose
    if (f.status === 403) return alertOf('error', pre(SEND_TEXT.csrf))
    if (f.status === 503) return alertOf('error', pre(SEND_TEXT.noCode))
  }
  return { kind: 'reread', reason: 'unknown', alert: { tone: 'error', text: pre(SEND_TEXT.unknown) } }
}

/**
 * POST (`create`) or PATCH (`patch`) — a plain save, or the save step inside a send. Phase-1 bodies
 * carry NO `code`: branch on status, and for a 400 match `message` against the three constants.
 */
export function saveOutcome(f: WriteFailure, op: 'create' | 'patch'): Outcome {
  if (f.status === 401) return { kind: 'none' }
  if (f.status === 400) {
    return f.message !== undefined && DEPARTMENT_MESSAGES.includes(f.message)
      ? {
          kind: 'field',
          field: 'departmentId',
          text: FIELD_ERR.departmentInvalid,
          refetchDepts: true,
          alert: null,
        }
      : alertOf('error', SAVE_INVALID)
  }
  if (op === 'patch' && f.status === 404) return notFoundClose
  if (op === 'patch' && f.status === 409) {
    return { kind: 'reread', reason: 'immutable', alert: { tone: 'warn', text: SENT_ELSEWHERE_ALERT } }
  }
  return writeFail(f.status)
}

/**
 * DELETE of a DRAFT or (since ANNOUNCE-API-5) a SENT row. `status` is the RECORD's, and picks the
 * wording (ANNOUNCE-UI-6 D-1, S-2).
 *
 *   · 404 (any body) — an INFO toast: the user wanted it gone, and it is.
 *   · ANY 409 — the send lock (`ANNOUNCEMENT_SEND_IN_PROGRESS`). DELETE can no longer answer "sent
 *     elsewhere", so there is NO re-read: the send may still be running, and a retry after it
 *     finishes succeeds because a SENT row is deletable.
 */
export function deleteOutcome(f: WriteFailure, status: Announcement['status']): Outcome {
  if (f.status === 401) return { kind: 'none' }
  if (f.status === 404) {
    const text = status === 'SENT' ? SENT_DELETED_ALREADY : DELETED_ALREADY
    return { kind: 'close', toast: { kind: 'info', text } }
  }
  if (f.status === 409) return alertOf('error', DELETE_IN_PROGRESS)
  return writeFail(f.status)
}

/* ── the follow-up GET ──────────────────────────────────────────────────────────────────────── */

export type Settled =
  /** Switch to `view` on this record; the reread's alert stays. */
  | { kind: 'view'; record: Announcement }
  /** Keep the mode (and the alert). `record` replaces the snapshot when the GET returned one. */
  | { kind: 'stay'; record: Announcement | null }
  | { kind: 'close'; toast: ToastSpec }

/**
 * What a `GET :id` after a `reread` outcome settles into.
 *
 *   · A readable record: SENT → `view`; still DRAFT → stay on it (the server is the truth).
 *   · 404: close with the not-found toast — it is gone.
 *   · Any other failure:
 *       partial      → `view` LOCALLY with `status SENT`, `sentCount = acceptedCount`, `sentAt null`.
 *                      The 502 already said it is SENT, and a resend must never be offered.
 *       already-sent → close, info toast `ประกาศนี้ถูกส่งไปแล้ว` (A-12)
 *       immutable    → close, error toast (A-11): there is no truthful record to show
 *       unknown      → stay; the alert already says to check before resending
 */
export function afterReread(
  reason: RereadReason,
  get: WriteResult<Announcement>,
  rec: Announcement,
  acceptedCount?: number,
): Settled {
  if (get.ok) {
    return get.value.status === 'SENT'
      ? { kind: 'view', record: get.value }
      : { kind: 'stay', record: get.value }
  }
  if (reason === 'partial') {
    return {
      kind: 'view',
      record: { ...rec, status: 'SENT', sentCount: acceptedCount ?? rec.sentCount, sentAt: null },
    }
  }
  if (get.status === 404) return { kind: 'close', toast: { kind: 'error', text: NOT_FOUND } }
  if (reason === 'already-sent') return { kind: 'close', toast: { kind: 'info', text: ALREADY_SENT } }
  if (reason === 'immutable') return { kind: 'close', toast: { kind: 'error', text: SENT_ELSEWHERE } }
  return { kind: 'stay', record: null }
}
