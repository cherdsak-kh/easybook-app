/**
 * Pure helpers for one announcement row — so the audience and the date read the same way in the
 * list and in the compose/edit/view dialog.
 *
 * ⚠️ The Thai WORDS for enum values live in `labels.ts`; this file only composes them with data.
 */

import { ANNOUNCEMENT_AUDIENCE } from '../../labels'
import { NO_VALUE, thaiDateTime } from '../../lib/thai-date'
import type { Announcement } from './announcements-api'

/** A DEPARTMENT row whose department was HARD-deleted — the API answers `department: null`. */
export const DEPARTMENT_GONE = '(ถูกลบแล้ว)'

/**
 * `บุคลากรทั้งหมด` · `กลุ่ม/ฝ่าย · ฝ่ายกิจการนักเรียน` · `กลุ่ม/ฝ่าย · (ถูกลบแล้ว)`.
 *
 * A DEPARTMENT row never prints the bare prefix: an audience that names no group reads as a bug,
 * while `(ถูกลบแล้ว)` says what actually happened to it.
 */
export function audienceLabel(a: Pick<Announcement, 'audience' | 'department'>): string {
  if (a.audience === 'ALL') return ANNOUNCEMENT_AUDIENCE.ALL
  return `${ANNOUNCEMENT_AUDIENCE.DEPARTMENT} · ${a.department?.name ?? DEPARTMENT_GONE}`
}

/**
 * `ส่งเมื่อ 8 ก.ค. 2569 10:00` for SENT; `สร้างเมื่อ …` for DRAFT.
 *
 * ⚠️ DRAFT READS `createdAt`, NOT `updatedAt` (plan D-6). The list is sorted `createdAt DESC`, and a
 * date that disagrees with the order the rows are in looks like a sorting bug. A SENT row with a
 * null `sentAt` cannot happen through the API; `thaiDateTime` answers `—` for it rather than throw.
 */
export function whenLabel(a: Pick<Announcement, 'status' | 'sentAt' | 'createdAt'>): string {
  return a.status === 'SENT'
    ? `ส่งเมื่อ ${thaiDateTime(a.sentAt)}`
    : `สร้างเมื่อ ${thaiDateTime(a.createdAt)}`
}

/** `ชื่อ นามสกุล`, or `—` when the staff account was HARD-deleted (`createdBy: null`). */
export function authorName(a: Pick<Announcement, 'createdBy'>): string {
  return a.createdBy ? `${a.createdBy.firstName} ${a.createdBy.lastName}` : NO_VALUE
}

/**
 * The dialog's metadata line (phase 4 D-11), exactly:
 *   · SENT        `ส่งเมื่อ … · ส่งออก 1,248 คน · ผู้เขียน …`
 *   · DRAFT view  `ฉบับร่าง · สร้างเมื่อ … · ผู้เขียน …`
 *   · DRAFT edit  the draft line, then ` · แก้ไขล่าสุด …`
 *
 * `ส่งออก`, never `ส่งถึง`: `sentCount` is what LINE ACCEPTED, not what was delivered (phase 3 D-4).
 */
export function metaLine(a: Announcement, mode: 'edit' | 'view'): string {
  if (a.status === 'SENT') {
    return `ส่งเมื่อ ${thaiDateTime(a.sentAt)} · ส่งออก ${a.sentCount.toLocaleString('th-TH')} คน · ผู้เขียน ${authorName(a)}`
  }
  const draft = `ฉบับร่าง · สร้างเมื่อ ${thaiDateTime(a.createdAt)} · ผู้เขียน ${authorName(a)}`
  return mode === 'edit' ? `${draft} · แก้ไขล่าสุด ${thaiDateTime(a.updatedAt)}` : draft
}
