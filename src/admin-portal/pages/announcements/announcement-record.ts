/**
 * Pure helpers for one announcement row — so the audience and the date read the same way in the
 * list now and in the phase-4 dialog later.
 *
 * ⚠️ The Thai WORDS for enum values live in `labels.ts`; this file only composes them with data.
 */

import { ANNOUNCEMENT_AUDIENCE } from '../../labels'
import { thaiDateTime } from '../../lib/thai-date'
import type { Announcement } from './announcements-api'

/** A DEPARTMENT row whose department was HARD-deleted — the API answers `department: null`. */
export const DEPARTMENT_GONE = '(ถูกลบแล้ว)'

/**
 * `ผู้ใช้ LINE ทั้งหมด` · `กลุ่ม/ฝ่าย · ฝ่ายกิจการนักเรียน` · `กลุ่ม/ฝ่าย · (ถูกลบแล้ว)`.
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
