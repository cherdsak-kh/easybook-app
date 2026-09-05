/**
 * The three facts the four dialogs of คำขอจองสถานที่ keep asking a request for.
 *
 * They live here rather than in `booking-summary.ts` because that module answers ONE question — how
 * a slot array collapses into a table cell — and these answer a different one: how a single record
 * introduces itself inside a dialog. Mixing them would put "the row's summary" and "the dialog's
 * detail" in one file, which is the distinction the whole screen is built on.
 *
 * ⚠️ NO COMPONENT LIVES HERE. `.ts`, so the constants and helpers can be imported without tripping
 * `react/only-export-components` — the same split `booking-icons.ts` / `BookingGlyph.tsx` records.
 */

import type { BookingRequestDetail, BookingRequestSlot } from '@/lib/api-client'
import { NO_VALUE, thaiDate, thaiTime } from '../../lib/thai-date'

/**
 * The spans this booking still holds.
 *
 * ⚠️ IT IS NOT A DISPLAY FILTER. Cancelled slots stay on the record and the detail dialog shows
 * every one of them — that is the whole reason the contract returns them. This answers the other
 * question, the one three controls need: which spans are still LIVE, and therefore which ones
 * `cancel` may name (naming an already-cancelled slot is a 409), how many "ยกเลิกทั้งการจอง" is
 * about, and whether there is anything left to cancel at all.
 */
export function liveSlots(slots: readonly BookingRequestSlot[]): BookingRequestSlot[] {
  return slots.filter((s) => !s.isCancelled)
}

/** `10 ก.ย. 2569 · 08:30–12:00 น.` — one slot on one line, for the cancel dialog's tick list. */
export function slotLine(slot: BookingRequestSlot): string {
  return `${thaiDate(slot.startAt)} · ${thaiTime(slot.startAt)}–${thaiTime(slot.endAt)} น.`
}

/** `08:30–12:00 น.` — the clock half on its own, for the `.rq-slot-time` cell. */
export function slotTime(slot: BookingRequestSlot): string {
  return `${thaiTime(slot.startAt)}–${thaiTime(slot.endAt)} น.`
}

/**
 * `BR-25690903-001 · สุภาพร แก้วมณี · หอประชุมวารณ` — the line every action dialog leads with.
 *
 * Three facts and this order, because that is the order they are quoted in: the code is what the
 * requester reads out over the phone, the name is who is affected, and the venue is what is being
 * competed for. ⚠️ It names the record the operator is about to WRITE to, so a dialog that shows
 * anything else at the top is a dialog that can act on the wrong row without ever saying so.
 */
export function requestLine(detail: BookingRequestDetail): string {
  return `${detail.code} · ${detail.requester.name ?? NO_VALUE} · ${detail.venue.name}`
}

/** `120 คน` — Thai digit grouping, and the unit as text rather than a placeholder. */
export function attendeesText(attendees: number): string {
  return `${attendees.toLocaleString('th-TH')} คน`
}
