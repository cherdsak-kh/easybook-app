/**
 * Pure helpers the feedback screen's row, card and dialog share — so the three render one person,
 * one date and one status the same way.
 *
 * ⚠️ NO `if (type === …)` LIVES HERE. Everything type- or status-dependent reads `FEEDBACK_TYPE` /
 * `FEEDBACK_STATUS` in `labels.ts` (AC-35).
 */

import { FEEDBACK_STATUS, type FeedbackStatus, type FeedbackType } from '../../labels'
import { thaiDate, thaiTime } from '../../lib/thai-date'
import type { FeedbackReporter, FeedbackUpdateStatus } from './feedback-api'

/** Missing registration AND no LINE display name (D-8, OQ-4). Practically unreachable. */
export const NO_REPORTER = 'ไม่พบข้อมูลผู้ลงทะเบียน'

/** A log whose author account was hard-deleted (OQ-3). A soft-deleted author still resolves. */
export const NO_AUTHOR = 'ไม่พบข้อมูลเจ้าหน้าที่'

/** The status a record shows, named for ITS type — `RESOLVED` reads differently per type. */
export function statusLabel(status: FeedbackStatus, type: FeedbackType): string {
  return FEEDBACK_STATUS[status].label[type]
}

/** The three statuses a save may send. `DISMISSED` is never offered (OQ-1). */
const UPDATABLE: readonly FeedbackStatus[] = ['PENDING', 'IN_PROGRESS', 'RESOLVED']

export function isUpdatable(status: FeedbackStatus): status is FeedbackUpdateStatus {
  return UPDATABLE.includes(status)
}

/** The design log's order: registered name → LINE display name → the fallback. */
export function reporterName(r: FeedbackReporter): string {
  if (r.firstName && r.lastName) return `${r.firstName} ${r.lastName}`
  return r.lineDisplayName || NO_REPORTER
}

/** Whether the name above came from a real source, i.e. is worth making initials from. */
export function hasReporterName(r: FeedbackReporter): boolean {
  return Boolean((r.firstName && r.lastName) || r.lineDisplayName)
}

/**
 * `ตำแหน่ง · กลุ่ม/ฝ่าย`, dropping whichever half is missing. `null` when both are — a missing
 * registration omits the line entirely rather than printing a lone `·` (D-8).
 */
export function reporterRoleLine(r: FeedbackReporter): string | null {
  const parts = [r.personnelRoleName, r.departmentName].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

/**
 * Up to two characters of initials: the first character of each of the first two words.
 *
 * ⚠️ THAI LEADING VOWELS (เ แ โ ใ ไ) are written BEFORE the consonant they follow, so a bare first
 * character turns "เชิดศักดิ์" into "เ". A word that starts with one takes two characters (the
 * prototype's rule, 20631–20638). Spread into code points so an emoji display name is not cut in
 * half.
 */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => {
      const chars = [...w]
      return (/^[เแโใไ]/.test(w) ? chars.slice(0, 2) : chars.slice(0, 1)).join('')
    })
    .join('')
    .toUpperCase()
}

/** The table's one-line snippet: every run of whitespace, newlines included, as one space. */
export function snippet(description: string): string {
  return description.replace(/\s+/g, ' ').trim()
}

/** `21 ก.ย. 2569 14:05 น.` — the card's and the log's timestamp. */
export function thaiAt(iso: string): string {
  return `${thaiDate(iso)} ${thaiTime(iso)} น.`
}
