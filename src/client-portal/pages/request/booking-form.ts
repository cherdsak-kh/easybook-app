import {
  fmtDShort,
  fmtSlot,
  fmtT,
  fmtTe,
  midnight,
} from '@/client-portal/lib/formatters'
import { overlaps, type VenueSlot } from '@/client-portal/pages/venues/venue-availability'

/**
 * Everything `#/request/:id` decides, with no React in it. Prototype 4118–4305.
 *
 * Same split as `pages/register/registration-form.ts`, for the same reason: the rules a form
 * enforces are the part worth reading on their own, and `CONVENTIONS.md` §2 permits a spec for a
 * function here while forbidding one for the screen that renders it.
 *
 * ── 🔴 THE TWO MODES ARE ONE CODE PATH, AND THAT IS `D-C13` RULE 2 ──
 * "Continuous single span" and "repeat across several days" *"differ ONLY in how many slots they
 * produce. They are not two kinds of request, and must not become two code paths."* {@link
 * buildSlots} is the only place the distinction exists; everything downstream — the checker, the
 * renderer, the submitter — receives one array of `{start, end}` and never asks which mode made it.
 */

export type BookingMode = 'cont' | 'rep'

/** One requested span, before it becomes a `BookingSlot` row. */
export type DraftSlot = { start: Date; end: Date }

/** What the form holds. The DOM is not the store here, unlike the prototype — React is. */
export type BookingValues = {
  purpose: string
  /** Kept as the raw string so "12a" can be rejected rather than silently becoming `12`. */
  attendees: string
  mode: BookingMode
  /** Mode 1. `YYYY-MM-DD`, straight off `<input type="date">`. */
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  /** Mode 2 — one time pair applied to every chosen day. */
  repStartTime: string
  repEndTime: string
  /** Mode 2's chosen days, sorted ascending, no duplicates. Local midnights. */
  days: Date[]
}

/**
 * 🔴 MINUTES STEP BY **ONE**, ALL SIXTY (PO, 2 ก.ย. 2569). An earlier round used 15 on the argument
 * that "school bookings never start at 09:07" — user testing reversed it: the common times are
 * class periods (`08:30`, `09:20`, `10:10`), which do not land on quarter hours, and a reader who
 * cannot find their time picks a *nearby* one instead. That makes the request wrong at source,
 * which is worse than scrolling.
 *
 * ⚠️ ONE CONSTANT FOR ALL FOUR TIME FIELDS. Change it here and every picker moves together.
 */
export const MINUTE_STEP = 1

/** `500` — the column's length. A form that accepts what the database will silently truncate lies. */
export const PURPOSE_MAX = 500

/** `08` not `8`: two digits so the option column does not jitter down a 24-row list. */
function two(n: number): string {
  return (n < 10 ? '0' : '') + n
}

export const HOUR_OPTIONS: readonly string[] = Array.from({ length: 24 }, (_, i) => two(i))
export const MINUTE_OPTIONS: readonly string[] = Array.from(
  { length: Math.ceil(60 / MINUTE_STEP) },
  (_, i) => two(i * MINUTE_STEP),
)

/** `YYYY-MM-DD` for an `<input type="date">` value, in LOCAL time. */
export function isoDate(dt: Date): string {
  return `${dt.getFullYear()}-${two(dt.getMonth() + 1)}-${two(dt.getDate())}`
}

/**
 * `('2026-09-10', '09:00')` → a local `Date`. Prototype 3521 (`parseDT`).
 *
 * ⚠️ BUILT FIELD BY FIELD, never `new Date('2026-09-10T09:00')`. The string form is parsed as UTC
 * or as local depending on the exact shape and the engine; this is unambiguous, and every date in
 * this portal is a local wall-clock time the user typed.
 */
export function parseDT(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null
  const [y, mo, d] = dateStr.split('-').map(Number)
  const [h, mi] = timeStr.split(':').map(Number)
  if ([y, mo, d, h, mi].some((n) => !Number.isFinite(n))) return null
  return new Date(y, mo - 1, d, h, mi)
}

/**
 * The requested spans, rebuilt from the current values every time anybody asks.
 *
 * ⚠️ NOT STORED. Deriving it means the checker, the summary and the payload can never be looking at
 * three different versions of the same answer.
 */
export function buildSlots(v: BookingValues): DraftSlot[] {
  if (v.mode === 'cont') {
    const start = parseDT(v.startDate, v.startTime)
    const end = parseDT(v.endDate, v.endTime)
    return start && end ? [{ start, end }] : []
  }
  return v.days.flatMap((day) => {
    const start = parseDT(isoDate(day), v.repStartTime)
    const end = parseDT(isoDate(day), v.repEndTime)
    return start && end ? [{ start, end }] : []
  })
}

/**
 * 🔴 THREE LEVELS, AND THE MIDDLE ONE IS THE WHOLE OF `D-C13` RULE 4.
 *
 * | | Means | Submittable |
 * |---|---|---|
 * | `error` | overlaps an **approved** booking — the slot has a real owner | ❌ |
 * | `warning` | overlaps a **pending** request — which holds nothing | ✅ |
 * | `success` | free | ✅ |
 *
 * ⚠️ Collapse amber into red and the reader retreats from a day nothing is holding them off.
 * Collapse it into green and they submit without knowing they are competing, which changes what
 * they expect the outcome to be. Both directions are wrong, which is why there are three.
 *
 * ⚠️ THE PAST IS REFUSED AT SPAN LEVEL AGAINST THE REAL CLOCK (`D-C16`) — `now`, never midnight.
 * It is 09:00 and this afternoon is still bookable. The backend checks the same way, so a form that
 * checked against `TODAY` would refuse what the server accepts.
 *
 * ⚠️ THIS IS A CONVENIENCE, NOT THE GUARANTEE. The server is authoritative and answers `409` on an
 * approved clash regardless of what this function concluded a second earlier — availability is read
 * once and someone else may be approved in between.
 */
export type SlotCheck = { kind: 'success' | 'warning' | 'error'; msg: string }

export function checkSlot(
  slot: DraftSlot,
  taken: readonly VenueSlot[],
  now: Date = new Date(),
): SlotCheck {
  if (slot.end.getTime() <= slot.start.getTime())
    return { kind: 'error', msg: 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม' }
  if (slot.start.getTime() <= now.getTime())
    return { kind: 'error', msg: 'เลือกช่วงเวลาที่ยังมาไม่ถึง — ย้อนหลังไม่ได้' }

  const approved = taken.filter((t) => t.status === 'approved' && overlaps(t, slot))
  if (approved.length)
    return {
      kind: 'error',
      msg: `ช่วงนี้มีการจองที่อนุมัติแล้ว ${approved.length} รายการ — ยื่นซ้อนไม่ได้`,
    }

  const pending = taken.filter((t) => t.status === 'pending' && overlaps(t, slot))
  if (pending.length)
    return {
      kind: 'warning',
      msg: `มีคำขออื่นรออนุมัติอยู่ ${pending.length} รายการ — ยื่นซ้อนได้`,
    }

  return { kind: 'success', msg: 'ช่วงเวลานี้ว่าง พร้อมยื่นคำขอ' }
}

/**
 * Which of the three icons a check gets.
 *
 * ⚠️ `circleX`, NOT `ban`. The rest of this form's glyphs are the `circle-*` family, and `ban`
 * reads as "you are forbidden" rather than "this span cannot be requested".
 */
export const CHECK_ICON = {
  success: 'circleCheck',
  warning: 'triangleAlert',
  error: 'circleX',
} as const

/**
 * The daisyUI alert class for each level, written out in full.
 *
 * ⚠️ NOT `alert-${kind}`. daisyUI ships its component CSS whole, so the interpolated form would in
 * fact work today — but it is invisible to any tool that scans source for class names, and this
 * project's stylesheet is a hand-ported `@layer components` block where "which classes are actually
 * used" is a question somebody will have to answer. Three literals cost nothing and stay greppable.
 */
export const CHECK_ALERT = {
  success: 'alert-success',
  warning: 'alert-warning',
  error: 'alert-error',
} as const

/**
 * The label in front of a check row, saying which span the row is about.
 *
 * ⚠️ Mode 2 has several rows, and "ช่วงนี้ไม่ว่าง" with no date is a sentence the reader has to
 * count rows to place. Mode 1 has one row, so it prints the times alone unless the span crosses
 * midnight — in which case it needs both dates and `fmtSlot` already knows how to write that.
 */
export function slotLabel(slot: DraftSlot, mode: BookingMode): string {
  if (mode === 'rep') return `${fmtDShort(slot.start)} ${fmtT(slot.start)}–${fmtTe(slot.end)}`
  const endDay = midnight(new Date(slot.end.getTime() - 1))
  return midnight(slot.start).getTime() === endDay.getTime()
    ? `${fmtT(slot.start)}–${fmtTe(slot.end)} น.`
    : fmtSlot(slot.start, slot.end)
}

/**
 * The two field errors, or `''` for a field that is fine.
 *
 * 🔴 THE CAPACITY CEILING IS CHECKED HERE BECAUSE `max` ON `<input type="number">` DOES NOT BLOCK
 * TYPING — it only bounds the spinner arrows. A field carrying `max="200"` that accepts a typed
 * `500` is a field that claims to validate and does not.
 *
 * ⚠️ The ceiling is also printed BESIDE THE LABEL, before anything is typed. A number that appears
 * only after the reader has already exceeded it makes them guess once for no reason.
 */
export function fieldErrors(
  v: BookingValues,
  venue: { name: string; capacity: number },
): { purpose: string; attendees: string } {
  const purpose = v.purpose.trim()
  const raw = v.attendees.trim()
  const n = Number.parseInt(raw, 10)

  return {
    purpose: !purpose
      ? 'กรุณาระบุวัตถุประสงค์การใช้สถานที่'
      : purpose.length > PURPOSE_MAX
        ? `ยาวเกินไป — ไม่เกิน ${PURPOSE_MAX} ตัวอักษร (ตอนนี้ ${purpose.length})`
        : '',
    attendees: !raw
      ? 'กรุณาระบุจำนวนผู้เข้าร่วมกิจกรรม'
      : !/^\d+$/.test(raw) || n < 1
        ? 'จำนวนผู้เข้าร่วมต้องเป็นตัวเลขตั้งแต่ 1 คนขึ้นไป'
        : n > venue.capacity
          ? `เกินความจุของสถานที่ — ${venue.name} รองรับได้สูงสุด ${venue.capacity.toLocaleString('th-TH')} คน`
          : '',
  }
}

/**
 * Why the submit button is off, or `''` when it is on.
 *
 * ── 🔴 THE PROTOTYPE DELETED ITS RED SUMMARY BOX, AND THIS IS NOT IT ──
 * `#rq-block` (2 ก.ย. 2569) printed *"ยังยื่นไม่ได้ — ตรวจสอบ: วัตถุประสงค์ · จำนวนผู้เข้าร่วม"*,
 * word for word what the message under each field already said, minus the part that said what was
 * wrong. It was removed because a full-width red panel above the primary button makes a
 * half-filled form read as a broken screen.
 *
 * What this returns instead is **one quiet line under the button**, replacing the standing
 * *"คำขอจะถูกส่งให้เจ้าหน้าที่พิจารณา…"* note only while the button is off. The checklist rule it
 * satisfies is *"Submit button disabled **with a stated reason** — a dead button that does not say
 * what is missing is the bug this rule exists to prevent"*, and a disabled control with no
 * accessible explanation is exactly that bug. It names the SECTION to go to, never repeats the
 * field's own sentence, and it is `aria-describedby` on the button so a screen reader gets it
 * without hunting.
 */
export function blockedReason(
  v: BookingValues,
  venue: { name: string; capacity: number },
  checks: readonly SlotCheck[],
): string {
  const errors = fieldErrors(v, venue)
  const missing: string[] = []
  if (errors.purpose) missing.push('วัตถุประสงค์')
  if (errors.attendees) missing.push('จำนวนผู้เข้าร่วม')
  if (!checks.length) missing.push(v.mode === 'rep' ? 'วันที่ที่ขอใช้' : 'วันและเวลา')

  if (missing.length) return `ยังกรอกไม่ครบ — ${missing.join(' · ')}`

  const blocked = checks.filter((c) => c.kind === 'error').length
  if (blocked)
    return v.mode === 'rep'
      ? `มี ${blocked} วันที่ยังยื่นไม่ได้ — แก้เวลาหรือลบวันนั้นออก`
      : 'ช่วงเวลาที่เลือกยังยื่นไม่ได้ — แก้วันหรือเวลาด้านบน'

  return ''
}

/**
 * A fresh form for `venue`.
 *
 * ⚠️ THE DEFAULT DATE IS **TOMORROW**, NOT TODAY. Today is always partly gone, so a form that opens
 * on today opens on a value its own checker rejects — telling the reader off before they have
 * touched anything.
 */
export function emptyValues(now = new Date()): BookingValues {
  const tomorrow = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
  return {
    purpose: '',
    attendees: '',
    mode: 'cont',
    startDate: tomorrow,
    startTime: '09:00',
    endDate: tomorrow,
    endTime: '12:00',
    repStartTime: '15:00',
    repEndTime: '17:00',
    days: [],
  }
}

/**
 * Add a day to mode 2's list. Returns the same array when the day is already there.
 *
 * ⚠️ DUPLICATES ARE REFUSED HERE, NOT AT SUBMIT. The same day twice is two spans that overlap each
 * other by 100 %, and the checker would then report the request as clashing with itself.
 *
 * ⚠️ ALWAYS SORTED ASCENDING, never in the order they were pressed — the check rows below are this
 * list, and a list you have to read whole to find the first date is a list that is not ordered.
 */
export function addDay(days: readonly Date[], day: Date): Date[] {
  if (days.some((d) => d.getTime() === day.getTime())) return [...days]
  return [...days, day].sort((a, b) => a.getTime() - b.getTime())
}
