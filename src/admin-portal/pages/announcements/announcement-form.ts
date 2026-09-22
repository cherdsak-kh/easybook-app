/**
 * The compose dialog's form model — PURE, so every rule here is a return value a spec can pin
 * (`tests/unit/admin-portal/pages/announcements/announcement-form.test.ts`).
 *
 * ⚠️ THE RAW STRINGS ARE KEPT AS TYPED. Trimming happens only in `toPayload`, `isDirty`, `validate`
 * and the preview — the places that must agree with the server, which trims both fields on write. The
 * counters show the raw length, which `maxLength` caps.
 */

import type { AnnouncementAudience, AnnouncementFormat } from '../../labels'
import { thaiDateTime } from '../../lib/thai-date'
import type { Announcement } from './announcements-api'

export type DialogMode = 'create' | 'edit' | 'view'

/** Mirrors `ANNOUNCEMENT_TITLE_MAX` / `ANNOUNCEMENT_BODY_MAX` on the server (after trimming there). */
export const TITLE_MAX = 100
export const BODY_MAX = 1000

export interface FormValues {
  title: string
  body: string
  format: AnnouncementFormat
  audience: AnnouncementAudience
  /**
   * ⚠️ SURVIVES A SWITCH TO `ALL` AND BACK (plan edge case). Only `toPayload` nulls it for `ALL`, so
   * DEPARTMENT → ALL → DEPARTMENT still shows the department that was picked.
   */
  departmentId: number | null
}

/** What POST and PATCH both send: the FULL set, so a PATCH is never `{}` (`UPDATE_EMPTY`). */
export interface AnnouncementPayload {
  title: string
  body: string
  format: AnnouncementFormat
  audience: AnnouncementAudience
  departmentId: number | null
}

/** The three fields that can carry an error, in DOM order — focus goes to the first invalid one. */
export type FieldKey = 'title' | 'departmentId' | 'body'
export const FIELD_ORDER: readonly FieldKey[] = ['title', 'departmentId', 'body']
export type FieldErrors = Partial<Record<FieldKey, string>>

/** The element each field's focus lands on. `an-dept` is the `Combobox` TRIGGER's id. */
export const FIELD_ID: Record<FieldKey, string> = {
  title: 'an-title',
  departmentId: 'an-dept',
  body: 'an-body',
}

export const FIELD_ERR = {
  titleRequired: 'กรุณากรอกหัวข้อประกาศ',
  departmentRequired: 'กรุณาเลือกกลุ่ม/ฝ่าย',
  /** Also the server's three department 400s and the send's `ANNOUNCEMENT_DEPARTMENT_INVALID`. */
  departmentInvalid: 'กลุ่ม/ฝ่ายนี้ถูกลบหรือไม่พร้อมใช้งานแล้ว โปรดเลือกใหม่',
  /** Also the send's `ANNOUNCEMENT_BODY_REQUIRED`. */
  bodyRequired: 'กรุณากรอกเนื้อหาก่อนส่งประกาศ',
} as const

/** `create` defaults (plan D-2) for `null`; otherwise the record as stored. */
export function fromRecord(r: Announcement | null): FormValues {
  if (!r) return { title: '', body: '', format: 'TEXT', audience: 'ALL', departmentId: null }
  return {
    title: r.title,
    body: r.body,
    format: r.format,
    audience: r.audience,
    departmentId: r.department?.id ?? null,
  }
}

/** Trimmed, with `departmentId: null` for `ALL` (phase 1 D-3 accepts `null` and clears the column). */
export function toPayload(f: FormValues): AnnouncementPayload {
  return {
    title: f.title.trim(),
    body: f.body.trim(),
    format: f.format,
    audience: f.audience,
    departmentId: f.audience === 'DEPARTMENT' ? f.departmentId : null,
  }
}

/**
 * Does the form differ from the LAST-SAVED snapshot (the record as the server last returned it)?
 * `null` — nothing saved yet — is always dirty.
 *
 * ⚠️ WHY IT MATTERS: phase 2's retry keys hash `updatedAt`. Resending an UNCHANGED draft after a
 * `LINE_SEND_FAILED` reuses the same keys, and LINE de-duplicates within 24 h — so an unchanged draft
 * must skip the PATCH, or a pointless write throws that protection away (plan D-2, design A-9).
 */
export function isDirty(f: FormValues, r: Announcement | null): boolean {
  if (!r) return true
  const p = toPayload(f)
  const storedDept = r.audience === 'DEPARTMENT' ? (r.department?.id ?? null) : null
  return (
    p.title !== r.title ||
    p.body !== r.body ||
    p.format !== r.format ||
    p.audience !== r.audience ||
    p.departmentId !== storedDept
  )
}

/**
 * Client validation before a save (`บันทึกฉบับร่าง`) or a send (`ส่งประกาศ`). EVERY failing field
 * is reported at once (the `BookingCancelDialog` precedent); the caller focuses the first.
 *
 * `deptUnavailable` — the chosen department is not in the list this user may pick from right now
 * (soft-deleted, or reserved and outside an ADMIN's list). The server would 400 it anyway (D-9).
 */
export function validate(
  f: FormValues,
  intent: 'save' | 'send',
  deptUnavailable: boolean,
): FieldErrors {
  const errors: FieldErrors = {}
  if (f.title.trim() === '') errors.title = FIELD_ERR.titleRequired
  if (f.audience === 'DEPARTMENT') {
    if (f.departmentId === null) errors.departmentId = FIELD_ERR.departmentRequired
    else if (deptUnavailable) errors.departmentId = FIELD_ERR.departmentInvalid
  }
  if (intent === 'send' && f.body.trim() === '') errors.body = FIELD_ERR.bodyRequired
  return errors
}

/** The first invalid field in DOM order, or `null` when there is none. */
export function firstInvalid(errors: FieldErrors): FieldKey | null {
  return FIELD_ORDER.find((k) => errors[k] !== undefined) ?? null
}

/**
 * What LINE shows for a TEXT announcement — `buildAnnouncementText` on the server:
 * `${title}\n\n${body}` of the TRIMMED values. The preview's bubble renders its three parts (title,
 * this gap, body) so an empty part can be a placeholder; with both filled its `textContent` equals
 * `previewText` exactly (AC-4).
 */
export const TEXT_GAP = '\n\n'
export function previewText(f: Pick<FormValues, 'title' | 'body'>): string {
  return `${f.title.trim()}${TEXT_GAP}${f.body.trim()}`
}

/**
 * The FLEX message's `altText` — the phone's notification line. The server's
 * `toAltText('ประกาศ: ' + title)`: every run of `•` and whitespace becomes one space, so a `•` in a
 * title really does show as a space in LINE. The 400-character cap cannot be reached (8 + 100).
 */
export function altTextOf(title: string): string {
  return `ประกาศ: ${title}`.replace(/[•\s]+/g, ' ').trim()
}

/**
 * The Flex card's footer time — the server's `${thaiShortDate} ${HH:MM} น.`, e.g. `22 ก.ย. 2569 14:05 น.`.
 * A SENT record prints its `sentAt`; a draft prints NOW, because the real card is stamped at send.
 */
export function cardTime(sentAt: string | null, now: Date): string {
  return `${thaiDateTime(sentAt ?? now)} น.`
}
