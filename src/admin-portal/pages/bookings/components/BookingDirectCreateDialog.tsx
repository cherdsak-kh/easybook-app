/**
 * `สร้างคำจองสถานที่` (`#rq-create-modal`) — the screen's SECOND job.
 *
 * ⚠️ THIS FORM DOES NOT CREATE A REQUEST. It creates an APPROVED booking, with
 * `approvedById = createdById`, and the footer says so where the commit happens. The alternative —
 * land it as PENDING and make the operator approve their own row — is a review by the person who
 * wrote the thing being reviewed, which costs a click and proves nothing.
 *
 * ── TWO REQUESTER MODES, and the second one is the whole point ──
 * Half the bookings a school office raises are for people who are not in LINE at all: the district
 * office ringing for the hall, a temple committee, a parent association. Mode (A) links the booking
 * to a real `LineUser`, so the requester gets the LINE notifications; mode (B) stores the name, the
 * phone and the department on the booking itself. A form that only offered (A) would push those
 * bookings into "book it under my own name", and then nobody can tell whose event it was.
 * ⛔ THE TWO SHAPES ARE MUTUALLY EXCLUSIVE ON THE WIRE — sending `lineUserId` together with any of
 * the three override fields is a 400. `bodyOf` builds one shape or the other and never spreads both.
 *
 * ⚠️ Mode (B) rows get NO LINE NOTIFICATION — there is no account to send to. The form says so, and
 * makes the phone number mandatory, rather than letting the operator find out when a cancellation
 * message goes nowhere.
 *
 * ── The field order IS a decision ──
 * ผู้ขอจอง → สถานที่ → วัตถุประสงค์ → จำนวนผู้เข้าร่วม → วัน-เวลา → แถบตรวจการชนเวลา.
 * 🔴 วัตถุประสงค์ SITS ABOVE วัน-เวลา, moved there by the PO after user testing. The old order asked
 * WHEN before WHAT, which is not how the decision is made: an operator on the phone to a department
 * knows the event before they know which of three candidate days is free, and a form that opens with
 * a date picker makes them park the thing they actually have in their head. It also makes the
 * conflict banner honest — by the time the dates are in, the purpose is already on screen, so
 * "this is what you are about to reject" has something to sit under. ⛔ Do not restore the old order.
 *
 * ── 🔴 ONE OWNER FOR THE SUBMIT BUTTON'S `disabled` ──
 * Two INDEPENDENT reasons can block this button — an APPROVED booking already holds the slot, and
 * the head count exceeds the room — and in the prototype they were discovered by different functions
 * on different events, so whichever ran last won and fixing the capacity silently re-armed a button
 * the conflict check had disabled. Here both are DERIVED VALUES read by one `blockReason`, which is
 * the only thing the button and the footer note ever consult. There is no event ordering to get
 * wrong because there are no events: React recomputes both from state on every render.
 *
 * ── 🔴 THE CAPACITY CHECK IS TWO-WAY, STRUCTURALLY ──
 * The same violation arrives from either end: typing 350 into a 250-seat hall, or picking a 250-seat
 * hall with 350 already typed. The prototype needed listeners on BOTH fields (and on `input`, not
 * just `change`, because a number field fires `change` on blur and a breach nobody can see until
 * they tab away is one they have already finished typing past). `capacityError` below is derived
 * from `venueId` and `attendees` together, so neither direction can be the one that was forgotten.
 * The capacity itself is read LIVE from the venue list on every render and never captured on
 * selection — สถานที่จัดกิจกรรม can be edited while this dialog sits open, and a ceiling captured at
 * click time goes on enforcing a number the other screen has already changed.
 *
 * ── 🔴 THE LIVE PREFLIGHT IS A FORECAST ──
 * `POST /booking-requests/preflight`, debounced, refired whenever the venue or the spans change. It
 * answers BEFORE submit because "the room is taken" is the one answer that makes the rest of the
 * form pointless — learning it from the submit response means retyping a purpose and a head count.
 * ⚠️ A REPLY WHOSE QUESTION HAS CHANGED IS DISCARDED (`seq`), or a slow answer about yesterday's
 * dates paints over a fresh one. ⚠️ AND IT IS NEVER THE REPORT: what happened is what `direct`
 * answered — the page reports `autoRejected`, exactly as the approve dialog does.
 *
 * ⚠️ NO `<form>` ELEMENT, and that is not an oversight. `<form method="dialog">` does not close a
 * `<dialog>` under React 19 (recorded on 2 ก.ย. 2569), and nesting it inside another form hides that
 * it is broken. Every one of this screen's five dialogs commits through a button handler instead.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ApiError,
  preflightBooking,
  type BookingPreflight,
  type CreateDirectBookingBody,
  type Department,
  type LineUser,
  type Venue,
} from '@/lib/api-client'
import { InlineAlert, InlineNote } from '../../../components/feedback/InlineAlert'
import { Spinner } from '../../../components/feedback/Spinner'
import { Btn } from '../../../components/ui/Btn'
import { Combobox, type ComboboxOption } from '../../../components/ui/Combobox'
import { Modal } from '../../../components/ui/Modal'
import {
  HOUR_OPTIONS,
  MINUTE_OPTIONS,
  MULTI_DAYS_MAX,
  buildSlots,
  pinsMinutes,
  plusDaysIso,
  thaiDayLabel,
  todayIso,
  whenError,
  type WhenState,
} from '../booking-slots'
import { Glyph } from './BookingGlyph'
import { ICON } from './booking-icons'

/** `BOOKING_PURPOSE_MAX` on the server — refuse the 501st character here rather than at the 400. */
const PURPOSE_MAX = 500

/**
 * `BOOKING_ATTENDEES_MAX` on the server.
 *
 * ⚠️ IT IS THE FORM'S OWN SANITY BOUND, NOT THE ROOM'S. When a venue is selected the field's `max`
 * becomes that venue's capacity — for the spinner and the mobile keypad, not as the enforcement:
 * there is no `required`/`min` validation running (nothing here is a native form), so
 * `capacityError` is what actually blocks.
 */
const ATTENDEES_MAX = 10_000

/** Long enough that typing a date does not fire a request per digit; short enough to feel live. */
const PREFLIGHT_DEBOUNCE = 350

/** What the footer says when the button CAN be pressed. `blockReason` replaces it when it cannot. */
const FOOTER_NOTE = 'บันทึกแล้วจะเป็นการจองที่อนุมัติแล้วทันที โดยผู้อนุมัติคือคุณ'

/** Every field that can carry a message, in the order they are read down the dialog. */
const FIELD_ORDER = ['user', 'name', 'phone', 'venue', 'purpose', 'people', 'when'] as const
type FieldKey = (typeof FIELD_ORDER)[number]
type Errors = Partial<Record<FieldKey, string>>

/** The four ids that never change. `when` resolves at focus time — see `focusFirst`. */
const FOCUS_ID: Record<Exclude<FieldKey, 'when'>, string> = {
  user: 'rq-cr-user',
  name: 'rq-cr-name',
  phone: 'rq-cr-phone',
  venue: 'rq-cr-venue',
  purpose: 'rq-cr-purpose',
  people: 'rq-cr-people',
}

/**
 * Move the caret to the field that is wrong.
 *
 * ⚠️ BY ID RATHER THAN BY REF, and deliberately: three of these seven controls are `Combobox`, whose
 * focusable element is a `<button>` it owns and does not hand out. The ids are unique because
 * exactly one instance of this dialog is ever mounted, and the same lookup is what the prototype's
 * `fieldErr` returns.
 */
function focusField(id: string): void {
  const el = document.getElementById(id)
  if (el instanceof HTMLElement) el.focus()
}

/** How a `LineUser` reads in the picker. Registration is present for every ALLOWED account; the
 *  fallback exists so a data anomaly shows a name rather than an empty row. */
function userLabel(u: LineUser): string {
  const r = u.registration
  if (!r) return u.displayName ?? u.lineUserId
  return `${r.firstName} ${r.lastName} · ${r.department}`
}

/**
 * ONE bound of the clock — two `<select>`s, a colon and `น.`
 *
 * ⚠️ IT IS DEFINED ONCE AND *MOVED* BETWEEN THE TWO DATE LAYOUTS, NEVER DUPLICATED. Mode 1 wants
 * each bound beside its own date; mode 2 wants both stacked full width under the daily-window
 * heading. The obvious spelling is two copies with a `hidden` on each — which is four more selects
 * carrying the same four ids (invalid HTML) or two sets of values to keep in step, and then reading
 * a time means asking which mode is on first. Here the caller builds ONE element per bound and drops
 * it into whichever layout is active; the values live in the parent's state, so switching modes
 * changes where the control is drawn and nothing else.
 *
 * ⚠️ `24` PINS THE MINUTES. It is a boundary, not an hour: the minute select is set to `00` and
 * DISABLED rather than left live and rejected later. A disabled control that visibly reads `00` says
 * why it cannot be changed; an enabled one that silently refuses to save does not.
 */
function ClockGroup({
  idBase,
  legend,
  hourLabel,
  minuteLabel,
  hour,
  minute,
  onHour,
  onMinute,
}: {
  idBase: string
  legend: string
  hourLabel: string
  minuteLabel: string
  hour: string
  minute: string
  onHour: (next: string) => void
  onMinute: (next: string) => void
}) {
  const pinned = pinsMinutes(hour)
  const described = 'rq-cr-when-err rq-cr-clock-hint'
  return (
    <div className="min-w-0">
      {/* A <span>, not a <label>: it names a PAIR of controls, and a label may only point at one.
          Each select carries its own sr-only label so neither is announced as a bare number. */}
      <span className="form-label">{legend}</span>
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`${idBase}-h`}>
          {hourLabel}
        </label>
        <div className="form-shell relative min-w-0 flex-1">
          <select
            id={`${idBase}-h`}
            className="form-select tabular-nums"
            aria-describedby={described}
            value={hour}
            onChange={(e) => onHour(e.target.value)}
          >
            {HOUR_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          <Glyph
            d={ICON.caret}
            className="pointer-events-none absolute right-3.5 h-4 w-4 text-base-content/70"
          />
        </div>
        <span aria-hidden="true" className="shrink-0 text-[15px] font-semibold text-base-content/60">
          :
        </span>
        <label className="sr-only" htmlFor={`${idBase}-m`}>
          {minuteLabel}
        </label>
        <div className={`form-shell relative min-w-0 flex-1 ${pinned ? 'opacity-60' : ''}`.trim()}>
          <select
            id={`${idBase}-m`}
            className="form-select tabular-nums"
            aria-describedby={described}
            disabled={pinned}
            value={pinned ? '00' : minute}
            onChange={(e) => onMinute(e.target.value)}
          >
            {MINUTE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <Glyph
            d={ICON.caret}
            className="pointer-events-none absolute right-3.5 h-4 w-4 text-base-content/70"
          />
        </div>
        <span aria-hidden="true" className="shrink-0 text-[14px] text-base-content/70">
          น.
        </span>
      </div>
    </div>
  )
}

/** The error paragraph every field on this form uses. Always in the DOM, hidden when empty — an
 *  assistive technology announces a region only if it existed BEFORE the text arrived. */
function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <p id={id} role="alert" className={`form-err ${message ? '' : 'hidden'}`.trim()}>
      <Glyph d={ICON.alert} className="form-err-ico" />
      <span>{message ?? ''}</span>
    </p>
  )
}

/** What the live banner currently knows. `checking` is a real state and says so — an unfinished
 *  check must never render as "these hours are free". */
type Preflight =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok'; data: BookingPreflight }
  /** A 400 from preflight PREDICTS a 400 from submit — same validator, same spans. Never swallowed. */
  | { kind: 'invalid'; message: string }
  /** Offline, 5xx, anything that is not a verdict. Advisory only: it must not block the write. */
  | { kind: 'failed' }

export function BookingDirectCreateDialog({
  open,
  onClose,
  venues,
  venuesError,
  users,
  usersError,
  usersTruncated,
  departments,
  departmentsError,
  alert = null,
  busy,
  recheckKey = 0,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  /** The live venue list, `null` while it loads. Read on every render — never copied into state. */
  venues: Venue[] | null
  venuesError: string | null
  /** The ALLOWED LINE accounts, rebuilt on every open. `null` while this open's fetch is in flight. */
  users: LineUser[] | null
  usersError: string | null
  usersTruncated: boolean
  departments: Department[] | null
  departmentsError: string | null
  /** A failed write, shown INSIDE this dialog beside the button that will retry it. */
  alert?: string | null
  busy: boolean
  /** Bumped by the page after a failed write, so the banner re-asks instead of showing the picture
   *  that was true before somebody else took the room. */
  recheckKey?: number
  onSubmit: (body: CreateDirectBookingBody) => void
}) {
  /* ── ผู้ขอจอง ── */
  const [mode, setMode] = useState<'line' | 'manual'>('line')
  const [lineUserId, setLineUserId] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  /** `0` is "ไม่ระบุ" — `departmentId` is optional on the contract, and 0 is never a real id. */
  const [departmentId, setDepartmentId] = useState(0)

  /* ── สถานที่ · วัตถุประสงค์ · จำนวนผู้เข้าร่วม ── */
  const [venueId, setVenueId] = useState('')
  const [purpose, setPurpose] = useState('')
  /** A STRING, so "empty" is representable. `Number('')` is 0, which is a head count nobody typed. */
  const [people, setPeople] = useState('')

  /* ── วัน-เวลา ── */
  const [dmode, setDmode] = useState<'span' | 'multi'>('span')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [day, setDay] = useState('')
  const [days, setDays] = useState<string[]>([])
  const [startH, setStartH] = useState('08')
  const [startM, setStartM] = useState('30')
  const [endH, setEndH] = useState('12')
  const [endM, setEndM] = useState('00')

  const [errors, setErrors] = useState<Errors>({})
  const [pf, setPf] = useState<Preflight>({ kind: 'idle' })
  const bodyRef = useRef<HTMLDivElement>(null)
  /** Which preflight question the answer in flight belongs to. See the header. */
  const seq = useRef(0)

  /**
   * 🔴 THE WHOLE RESET, IN ONE PLACE, ON BOTH EDGES OF `open`.
   *
   * The prototype had to clear the capacity hint, the `max`, the block reason, the footer note and
   * the banner by hand, and warned that three lines kept in step by hand are three lines that will
   * drift. None of those five are state here — every one is DERIVED from the fields below, so
   * putting the fields back is the whole reset, by construction. The only imperative part is the
   * scroll offset, which belongs to the DOM and nothing else can own.
   */
  useEffect(() => {
    setMode('line')
    setLineUserId('')
    setName('')
    setPhone('')
    setDepartmentId(0)
    setVenueId('')
    setPurpose('')
    setPeople('')
    setDmode('span')
    // Tomorrow, not today: a booking raised for the hour you are standing in is not the common case,
    // and an empty date field is one more thing to fill in before the banner can say anything at all.
    const tomorrow = plusDaysIso(todayIso(), 1)
    setFrom(tomorrow)
    setTo(tomorrow)
    setDay('')
    setDays([])
    setStartH('08')
    setStartM('30')
    setEndH('12')
    setEndM('00')
    setErrors({})
    // ⚠️ AFTER the dialog is open, never before: a closed <dialog> is `display: none`, so nothing
    // inside it has a scroll box and the assignment is silently dropped. `Modal`'s `showModal()`
    // effect is a child's, and children's effects run first.
    if (open && bodyRef.current) bodyRef.current.scrollTop = 0
  }, [open])

  /* ── Derived: the venue, its capacity, and the head count ─────────────────────────────────────
     Read LIVE from the list on every render. Never captured on selection — see the header. */
  const venue = useMemo(() => venues?.find((v) => v.id === venueId) ?? null, [venues, venueId])
  const capacity = venue?.capacity ?? 0
  const attendees = Number(people)
  const attendeesGiven = people.trim() !== '' && Number.isFinite(attendees) && attendees >= 1

  /**
   * ⚠️ IT RETURNS THE MESSAGE RATHER THAN RENDERING IT. The same answer is needed in three places —
   * the hint's colour, the field's error, and whether the button may be pressed — and three copies
   * of "is this over capacity" is three chances for the button to disagree with the text beside it.
   */
  const capacityError =
    capacity > 0 && attendeesGiven && attendees > capacity
      ? `จำนวนผู้เข้าร่วมเกินความจุของสถานที่ (รองรับได้สูงสุด ${capacity.toLocaleString('th-TH')} คน)`
      : ''

  const when: WhenState = useMemo(
    () => ({ mode: dmode, from, to, days, startH, startM, endH, endM }),
    [dmode, from, to, days, startH, startM, endH, endM],
  )
  const slots = useMemo(() => buildSlots(when), [when])

  /* ── The live preflight ───────────────────────────────────────────────────────────────────── */
  const canCheck = open && venueId !== '' && slots.length > 0

  useEffect(() => {
    if (!canCheck) {
      // Bump the sequence as well as resetting: an answer already in flight belongs to a question
      // that no longer exists, and must not arrive as a verdict on an emptied form.
      seq.current += 1
      setPf({ kind: 'idle' })
      return
    }
    const mine = (seq.current += 1)
    // The previous verdict describes spans that have changed. Clearing it here is what stops a
    // stale hard block from surviving the edit that fixed it.
    setPf({ kind: 'checking' })
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const data = await preflightBooking({ venueId, slots })
          if (seq.current !== mine) return
          setPf({ kind: 'ok', data })
        } catch (err) {
          if (seq.current !== mine) return
          if (err instanceof ApiError && err.status === 400) {
            setPf({ kind: 'invalid', message: err.message })
          } else {
            setPf({ kind: 'failed' })
          }
        }
      })()
    }, PREFLIGHT_DEBOUNCE)
    return () => clearTimeout(timer)
  }, [canCheck, venueId, slots, recheckKey])

  const clash = pf.kind === 'ok' && pf.data.hasApprovedClash
  const losers = pf.kind === 'ok' ? pf.data.overlappingPendingRequests : []
  /** Informational ONLY. `isOpen` refuses new REQUESTS; a staff lock is not a request, and the
   *  server accepts it. Reachable because the picker's list is a snapshot and this answer is live. */
  const venueClosed = pf.kind === 'ok' && !pf.data.venueIsOpen

  /**
   * 🔴 THE ONE OWNER. Two independent reasons, one value, read by the button AND by the footer note.
   *
   * ⚠️ `checking` DOES NOT BLOCK. The server refuses again inside its own transaction, so blocking
   * on every keystroke's in-flight request would flicker the button for no added safety.
   * ⚠️ `failed` DOES NOT BLOCK EITHER — a preflight that could not be reached is not a verdict, and
   * treating "we could not ask" as "no" would make an offline blip look like a taken room.
   */
  const blockReason =
    (pf.kind === 'invalid'
      ? pf.message
      : clash
        ? `ช่วงเวลานี้มีการจองที่อนุมัติแล้วอยู่ ${pf.kind === 'ok' ? pf.data.approvedClashCount.toLocaleString('th-TH') : ''} ช่วงเวลา · เปลี่ยนวัน เวลา หรือสถานที่ก่อนจึงจะบันทึกได้`
      : '') || capacityError

  /* ── Options ─────────────────────────────────────────────────────────────────────────────── */

  /**
   * ⚠️ ปิดชั่วคราว VENUES ARE ABSENT, NOT DISABLED. A venue that is shut is not a choice being
   * withheld — สถานที่จัดกิจกรรม is where an operator reopens it, and offering it greyed out here
   * sends them looking for a switch this dialog does not have.
   */
  const venueChoices = useMemo<ComboboxOption<string>[]>(
    () => (venues ?? []).filter((v) => v.isOpen).map((v) => ({ id: v.id, name: v.name })),
    [venues],
  )

  const userChoices = useMemo<ComboboxOption<string>[]>(
    () => (users ?? []).map((u) => ({ id: u.id, name: userLabel(u) })),
    [users],
  )

  const departmentChoices = useMemo<ComboboxOption<number>[]>(
    () => [
      { id: 0, name: 'ไม่ระบุกลุ่ม/ฝ่าย' },
      ...(departments ?? [])
        .filter((d) => !d.isFallback)
        .map((d) => ({ id: d.id, name: d.name, reserved: d.isSystemReserved })),
    ],
    [departments],
  )

  const pickedUser = useMemo(
    () => (users ?? []).find((u) => u.id === lineUserId) ?? null,
    [users, lineUserId],
  )

  /* ── Editing ─────────────────────────────────────────────────────────────────────────────── */

  const clear = (key: FieldKey) =>
    setErrors((prev) => (prev[key] ? { ...prev, [key]: '' } : prev))

  const addDay = () => {
    if (!day) {
      setErrors((p) => ({ ...p, when: 'เลือกวันที่ก่อนกดเพิ่ม' }))
      return
    }
    if (days.includes(day)) {
      setErrors((p) => ({ ...p, when: `${thaiDayLabel(day)} อยู่ในรายการแล้ว` }))
      return
    }
    if (days.length >= MULTI_DAYS_MAX) {
      setErrors((p) => ({ ...p, when: `เลือกได้สูงสุด ${MULTI_DAYS_MAX} วันต่อหนึ่งรายการ` }))
      return
    }
    setDays((prev) => [...prev, day].sort())
    setDay('')
    clear('when')
  }

  /** One shape or the other. ⛔ Never both — see the header. */
  const bodyOf = (): CreateDirectBookingBody => {
    const base = {
      venueId,
      purpose: purpose.trim(),
      attendees,
      slots: buildSlots(when),
    }
    if (mode === 'line') return { ...base, lineUserId }
    return {
      ...base,
      requesterName: name.trim(),
      contactPhone: phone.trim(),
      ...(departmentId > 0 ? { departmentId } : {}),
    }
  }

  /**
   * ⚠️ EVERY FIELD IS CHECKED AND ONLY THE FIRST FAILURE TAKES FOCUS. Short-circuiting reports the
   * missing name, the operator fixes it, presses บันทึก, and meets the missing phone they could have
   * fixed in the same pass.
   */
  const submit = () => {
    if (busy) return
    const next: Errors = {}
    const line = mode === 'line'
    if (line && !lineUserId) next.user = 'เลือกผู้ใช้ที่จะจองแทน'
    if (!line && !name.trim()) next.name = 'ระบุชื่อผู้ขอจองหรือหน่วยงาน'
    // Required in mode (B) for a reason mode (A) does not have: there is no LINE account to reach
    // this person through, so the phone number IS the contact channel.
    if (!line && !phone.trim()) {
      next.phone = 'ระบุเบอร์โทรศัพท์ เพราะผู้ขอจองนี้ไม่ได้รับแจ้งทาง LINE'
    }
    if (!venueId) next.venue = 'เลือกสถานที่'
    if (!purpose.trim()) next.purpose = 'ระบุวัตถุประสงค์ของการใช้สถานที่'
    // Two rules on one field, in the order they are useful: "this is not a number" first, then
    // "this number does not fit". The other way round answers a blank field with a sentence about
    // capacity. The ceiling check lives in `capacityError` and is applied below.
    if (!attendeesGiven || !Number.isInteger(attendees)) {
      next.people = 'ระบุจำนวนผู้เข้าร่วมเป็นตัวเลข'
    } else if (attendees > ATTENDEES_MAX) {
      next.people = `จำนวนผู้เข้าร่วมสูงสุด ${ATTENDEES_MAX.toLocaleString('th-TH')} คน`
    }
    const whenMsg = whenError(when)
    if (whenMsg) next.when = whenMsg

    setErrors(next)
    const first = FIELD_ORDER.find((k) => next[k])
    if (first) {
      // Never the clock for `when`: it always holds a legal value, so the thing to correct is
      // whichever date control the current mode is showing.
      focusField(first === 'when' ? (dmode === 'span' ? 'rq-cr-from' : 'rq-cr-day') : FOCUS_ID[first])
      return
    }

    /* The disabled button is the first guard and this is the second. They are NOT redundant:
       `disabled` is a property of the DOM, and this runs on the path that actually writes — which is
       the one that matters if a future edit ever re-enables the button from somewhere else. */
    if (capacityError) {
      focusField('rq-cr-people')
      return
    }
    if (blockReason) return
    if (buildSlots(when).length === 0) {
      setErrors({ when: 'ตรวจสอบวันและเวลาอีกครั้ง' })
      focusField(dmode === 'span' ? 'rq-cr-from' : 'rq-cr-day')
      return
    }
    onSubmit(bodyOf())
  }

  /* ── The clock, built ONCE per bound and placed by the active layout ──────────────────────── */
  const startClock = (
    <ClockGroup
      idBase="rq-cr-start"
      legend="เวลาเริ่ม"
      hourLabel="ชั่วโมงที่เริ่ม"
      minuteLabel="นาทีที่เริ่ม"
      hour={startH}
      minute={startM}
      onHour={(h) => {
        setStartH(h)
        clear('when')
      }}
      onMinute={(m) => {
        setStartM(m)
        clear('when')
      }}
    />
  )
  const endClock = (
    <ClockGroup
      idBase="rq-cr-end"
      legend="เวลาสิ้นสุด"
      hourLabel="ชั่วโมงที่สิ้นสุด"
      minuteLabel="นาทีที่สิ้นสุด"
      hour={endH}
      minute={endM}
      onHour={(h) => {
        setEndH(h)
        clear('when')
      }}
      onMinute={(m) => {
        setEndM(m)
        clear('when')
      }}
    />
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="สร้างคำจองสถานที่"
      width={680}
      tall
      // Closing mid-write leaves the operator unsure whether the booking was made — and this write
      // also auto-rejects other people's requests.
      dismissable={!busy}
      bodyRef={bodyRef}
      /* ⚠️ `flex-col`, NOT `flex-col-reverse`. Reversed, the mobile footer put สร้างคำจองสถานที่
         ABOVE the sentence explaining that pressing it books the venue outright — measured at 375px
         the note fell below the fold with the button already under the thumb. */
      footerClassName="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      footer={
        <>
          {/* ⚠️ TWO JOBS, ONE LINE, ONE WRITER. Normally it states the consequence of pressing the
              button; when the button cannot be pressed it states WHY, because a greyed control with
              no explanation beside it is the thing operators file bugs about. */}
          <p
            role="status"
            className={`m-0 text-[13px] leading-[1.5] ${
              blockReason ? 'font-medium text-error' : 'text-base-content/70'
            }`}
          >
            {blockReason || FOOTER_NOTE}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Btn
              variant="primary"
              className="w-full disabled:cursor-not-allowed disabled:bg-base-300 disabled:text-base-content/70 disabled:hover:brightness-100 sm:w-auto"
              disabled={busy || blockReason !== ''}
              aria-busy={busy || undefined}
              aria-label={busy ? 'กำลังบันทึกการจอง' : undefined}
              onClick={submit}
            >
              {busy ? <Spinner /> : <Glyph d={ICON.save} className="cm-btn-ico" />}
              สร้างการจอง
            </Btn>
          </div>
        </>
      }
    >
      <InlineAlert message={alert} />

      {/* ── ผู้ขอจอง ─────────────────────────────────────────────────────────────────────── */}
      <fieldset className="min-w-0 border-0 p-0">
        <legend className="form-label !mb-2">ผู้ขอจอง</legend>
        <div className="rq-seg">
          <label className="rq-seg-btn">
            <input
              type="radio"
              name="rq-cr-mode"
              value="line"
              className="sr-only"
              checked={mode === 'line'}
              onChange={() => {
                setMode('line')
                setErrors((p) => ({ ...p, user: '', name: '', phone: '' }))
              }}
            />
            <span>เลือกผู้ใช้ LINE ในระบบ</span>
          </label>
          <label className="rq-seg-btn">
            <input
              type="radio"
              name="rq-cr-mode"
              value="manual"
              className="sr-only"
              checked={mode === 'manual'}
              onChange={() => {
                setMode('manual')
                setErrors((p) => ({ ...p, user: '', name: '', phone: '' }))
              }}
            />
            <span>ระบุข้อมูลเอง</span>
          </label>
        </div>

        {mode === 'line' ? (
          <div className="mt-3">
            <Combobox
              id="rq-cr-user"
              label="ผู้ใช้ที่ลงทะเบียนและอนุมัติแล้ว"
              placeholder={users === null ? 'กำลังโหลดรายชื่อ…' : 'เลือกผู้ใช้'}
              options={userChoices}
              value={lineUserId}
              onChange={(id) => {
                setLineUserId(id)
                clear('user')
              }}
              // Loading and failure both have to SAY so: a picker that silently offers nothing reads
              // as a school with no registered users.
              disabled={users === null}
              error={errors.user || usersError || undefined}
            />
            {usersTruncated && (
              <p className="mt-1.5 text-[13px] leading-[1.5] text-base-content/70">
                แสดงรายชื่อได้ไม่ครบทั้งหมด · ถ้าหาไม่พบ ให้เลือก “ระบุข้อมูลเอง”
              </p>
            )}

            {/* What the choice filled in. Read-only, and VISIBLE: an operator picking a name has to
                be able to check that the phone number attached to it is the one they are about to
                promise to call. */}
            {pickedUser?.registration && (
              <div className="mt-2 flex items-center gap-3 rounded-control border border-base-300 bg-base-100 px-3.5 py-2.5">
                <span
                  aria-hidden="true"
                  className="ava-fill flex h-10 w-10 shrink-0 items-center justify-center rounded-control text-[15px] font-semibold text-primary"
                >
                  {pickedUser.registration.firstName.charAt(0)}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[14px] text-base-content/90">
                    {pickedUser.registration.department}
                  </span>
                  <span className="truncate text-[13px] tabular-nums text-base-content/70">
                    {pickedUser.registration.phone}
                  </span>
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="form-label" htmlFor="rq-cr-name">
                ชื่อผู้ขอจอง / หน่วยงาน
              </label>
              <div className={`form-shell ${errors.name ? 'form-shell-err' : ''}`.trim()}>
                <input
                  id="rq-cr-name"
                  type="text"
                  className="form-input"
                  placeholder="เช่น สมาคมผู้ปกครองและครู"
                  autoCorrect="on"
                  spellCheck
                  autoComplete="off"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  maxLength={120}
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby="rq-cr-name-err"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    clear('name')
                  }}
                />
              </div>
              <FieldError id="rq-cr-name-err" message={errors.name} />
            </div>

            <div>
              {/* ⚠️ A PICKER, NOT THE PROTOTYPE'S FREE-TEXT BOX. The contract takes `departmentId`
                  and refuses anything that is not an ACTIVE option with a 400, so a typed string
                  could never have been sent. Same curated vocabulary การลงทะเบียน files people under
                  — which is also what makes "bookings by department" answerable later. */}
              <Combobox
                id="rq-cr-dept"
                label="กลุ่ม/ฝ่าย หรือสังกัด"
                options={departmentChoices}
                value={departmentId}
                onChange={setDepartmentId}
                disabled={departments === null}
                error={departmentsError ?? undefined}
              />
            </div>

            <div>
              <label className="form-label" htmlFor="rq-cr-phone">
                เบอร์โทรศัพท์
              </label>
              <div className={`form-shell ${errors.phone ? 'form-shell-err' : ''}`.trim()}>
                <input
                  id="rq-cr-phone"
                  type="tel"
                  inputMode="tel"
                  className="form-input tabular-nums"
                  placeholder="08x-xxx-xxxx"
                  autoCorrect="off"
                  spellCheck={false}
                  autoCapitalize="none"
                  autoComplete="off"
                  enterKeyHint="next"
                  maxLength={30}
                  aria-invalid={errors.phone ? true : undefined}
                  aria-describedby="rq-cr-phone-err"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    clear('phone')
                  }}
                />
              </div>
              <FieldError id="rq-cr-phone-err" message={errors.phone} />
            </div>

            <InlineNote className="sm:col-span-2">
              <span>
                ผู้ขอจองที่ระบุเอง<strong className="font-semibold">จะไม่ได้รับแจ้งเตือนทาง LINE</strong>{' '}
                เพราะไม่มีบัญชีในระบบ · ต้องติดต่อกลับทางเบอร์โทรศัพท์เอง
              </span>
            </InlineNote>
          </div>
        )}
      </fieldset>

      <hr className="my-5 border-base-300" />

      {/* ── สถานที่ ──────────────────────────────────────────────────────────────────────── */}
      <div>
        <Combobox
          id="rq-cr-venue"
          label="สถานที่"
          placeholder={venues === null ? 'กำลังโหลดสถานที่…' : 'เลือกสถานที่'}
          options={venueChoices}
          value={venueId}
          onChange={(id) => {
            setVenueId(id)
            clear('venue')
          }}
          disabled={venues === null}
          error={errors.venue || venuesError || undefined}
          hint="แสดงเฉพาะสถานที่ที่เปิดให้จองอยู่"
        />
      </div>

      {/* ── วัตถุประสงค์ + จำนวนผู้เข้าร่วม ───────────────────────────────────────────────
          ⚠️ TWO ROWS, NOT TWO COLUMNS. These were a 2:1 grid, which gave วัตถุประสงค์ about 380px of
          a 680px dialog for strings like "อบรมเชิงปฏิบัติการพัฒนาสื่อการสอนกลุ่มสาระวิทยาศาสตร์",
          and a head count a full third of the width for four digits. Stacked, the purpose gets the
          whole width and the number gets a box the size of a number. They are not a pair anyway: one
          is prose the requester dictates, the other an estimate the operator often has to ask for. */}
      <div className="mt-5 flex flex-col gap-4">
        <div>
          <label className="form-label" htmlFor="rq-cr-purpose">
            วัตถุประสงค์การใช้งาน
          </label>
          <div className={`form-shell !px-0 ${errors.purpose ? 'form-shell-err' : ''}`.trim()}>
            <textarea
              id="rq-cr-purpose"
              rows={2}
              maxLength={PURPOSE_MAX}
              className="min-h-11 w-full resize-y border-none bg-transparent px-3.5 py-2.5 text-[15px] leading-[1.6] text-base-content/90 outline-none placeholder:text-base-content/70"
              placeholder="เช่น อบรมเชิงปฏิบัติการพัฒนาสื่อการสอน ภาคเรียนที่ 1"
              autoCorrect="on"
              spellCheck
              autoComplete="off"
              autoCapitalize="sentences"
              aria-invalid={errors.purpose ? true : undefined}
              aria-describedby="rq-cr-purpose-err"
              value={purpose}
              onChange={(e) => {
                setPurpose(e.target.value)
                clear('purpose')
              }}
            />
          </div>
          <FieldError id="rq-cr-purpose-err" message={errors.purpose} />
        </div>

        <div>
          <label className="form-label" htmlFor="rq-cr-people">
            จำนวนผู้เข้าร่วม
          </label>
          {/* Capped rather than full-width: a four-digit field stretched to 640px reads as a text box
              that happens to reject letters, and the "คน" suffix has nothing to sit beside. The unit
              is a <span>, not a placeholder — a placeholder disappears the moment the field is
              filled, which is exactly when the number needs its unit. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <div
              className={`form-shell w-full sm:max-w-[12rem] ${
                errors.people || capacityError ? 'form-shell-err' : ''
              }`.trim()}
            >
              <input
                id="rq-cr-people"
                type="number"
                inputMode="numeric"
                min={1}
                // For the spinner's ceiling and the mobile keypad, not as the enforcement — see
                // `ATTENDEES_MAX`. With no venue chosen it falls back to the form's own bound rather
                // than to a stale one from the venue that was selected a moment ago.
                max={capacity > 0 ? capacity : ATTENDEES_MAX}
                className="form-input tabular-nums"
                placeholder="เช่น 60"
                autoComplete="off"
                enterKeyHint="done"
                aria-invalid={errors.people || capacityError ? true : undefined}
                aria-describedby="rq-cr-people-err rq-cr-capacity-hint"
                value={people}
                onChange={(e) => {
                  setPeople(e.target.value)
                  clear('people')
                }}
              />
            </div>
            <span aria-hidden="true" className="shrink-0 text-[14px] text-base-content/70">
              คน
            </span>
            {/* ⚠️ THE CEILING, STATED BEFORE IT IS HIT, and BESIDE the input rather than under it:
                the comparison is between two numbers, and putting them on one line is what makes it
                a comparison rather than a rule to remember. It wraps to its own line below `sm`,
                where 375px cannot hold both. In `aria-describedby` alongside the error, so a screen
                reader hears the ceiling on arrival at the field, not only after exceeding it. */}
            <span
              id="rq-cr-capacity-hint"
              className={`shrink-0 text-[13px] leading-[1.45] ${
                capacityError ? 'font-medium text-error' : 'text-base-content/70'
              }`}
            >
              {capacity > 0
                ? `ความจุที่รองรับ: สูงสุด ${capacity.toLocaleString('th-TH')} คน`
                : '(เลือกสถานที่เพื่อดูความจุ)'}
            </span>
          </div>
          <FieldError id="rq-cr-people-err" message={errors.people || capacityError} />
        </div>
      </div>

      <hr className="my-5 border-base-300" />

      {/* ── วัน-เวลา ─────────────────────────────────────────────────────────────────────────
          TWO MODES because the two real shapes of a school booking are not the same shape.
          "ค่ายวิทย์ 10–12 ก.ย." is a span, and asking for it day by day is three rows of typing for
          one fact. "ซ้อมกีฬาสี ทุกวันศุกร์" is a set of dates that are not adjacent, and a span
          cannot express it at all. One control that did both would be a date range with holes. */}
      <fieldset className="mt-5 min-w-0 border-0 p-0">
        <legend className="form-label !mb-2">วัน-เวลาที่ใช้งาน</legend>
        <div className="rq-seg">
          <label className="rq-seg-btn">
            <input
              type="radio"
              name="rq-cr-dmode"
              value="span"
              className="sr-only"
              checked={dmode === 'span'}
              onChange={() => {
                setDmode('span')
                clear('when')
              }}
            />
            <span>ช่วงวันต่อเนื่อง</span>
          </label>
          <label className="rq-seg-btn">
            <input
              type="radio"
              name="rq-cr-dmode"
              value="multi"
              className="sr-only"
              checked={dmode === 'multi'}
              onChange={() => {
                setDmode('multi')
                clear('when')
              }}
            />
            <span>เลือกหลายวัน</span>
          </label>
        </div>

        {dmode === 'span' ? (
          /* ── MODE 1 — one continuous span ────────────────────────────────────────────────
             ⚠️ GROUPED BY BOUND, not by field type. The four controls used to read วันเริ่มต้น ·
             วันสิ้นสุด, then เวลาเริ่ม · เวลาสิ้นสุด — so the two halves of "when does it start" sat
             in different rows with the two halves of "when does it end" between them, and the
             pairing an operator has to check was the one the layout broke apart. Now the left column
             is entirely the beginning and the right is entirely the end.
             The divider is what makes that readable rather than merely true: a gap says "these are
             four fields", a rule says "these are two groups". It is a BORDER ON THE RIGHT COLUMN,
             not a spacer <div> — an element that exists only to be a line is one more thing to keep
             in step with the breakpoint. Vertical from `sm`; below that the columns stack and the
             same border moves to the top edge, becoming the horizontal rule the stack needs. */
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-0">
            <div className="flex min-w-0 flex-col gap-4 sm:pr-5">
              <div>
                <label className="form-label" htmlFor="rq-cr-from">
                  วันเริ่มต้น
                </label>
                <div className="form-shell">
                  <input
                    id="rq-cr-from"
                    type="date"
                    className="form-input tabular-nums"
                    aria-describedby="rq-cr-when-err"
                    value={from}
                    onChange={(e) => {
                      setFrom(e.target.value)
                      clear('when')
                    }}
                  />
                </div>
              </div>
              {startClock}
            </div>
            <div className="flex min-w-0 flex-col gap-4 border-t border-base-300 pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
              <div>
                <label className="form-label" htmlFor="rq-cr-to">
                  วันสิ้นสุด
                </label>
                <div className="form-shell">
                  <input
                    id="rq-cr-to"
                    type="date"
                    className="form-input tabular-nums"
                    aria-describedby="rq-cr-when-err"
                    value={to}
                    onChange={(e) => {
                      setTo(e.target.value)
                      clear('when')
                    }}
                  />
                </div>
              </div>
              {endClock}
            </div>
          </div>
        ) : (
          /* ── MODE 2 — a set of dates ─────────────────────────────────────────────────────
             ⚠️ HOURS FIRST, DATES SECOND, and the order is the CAUSALITY rather than a preference.
             This mode sets ONE daily window and applies it to every date in the list, so reading it
             top-down has to say "these are the hours; here are the days they apply to". Built the
             other way round it said "here are some days" and then, under a chip list the operator
             had already finished building, "…and by the way they all run 08:30–12:00" — which is the
             moment somebody discovers the window is wrong and has to go back up past their own work.
             Mode 1 keeps the opposite arrangement for the same reason: there each date has its OWN
             time, so the time belongs beside its date.
             The two groups also STACK here, one per row, which is a width argument: this mode already
             spends the full dialog width on the date adder and its chips, and a two-column time row
             underneath left each hour/minute pair sharing ~150px with a colon and a "น." */
          <div className="mt-3">
            <p className="mb-3 text-[13px] leading-[1.5] text-base-content/70">
              กำหนดช่วงเวลาที่ใช้ในแต่ละวันก่อน แล้วจึงเพิ่มวันด้านล่าง
            </p>
            <div className="flex flex-col gap-4">
              {startClock}
              {endClock}
            </div>
            <div className="mt-4 border-t border-base-300 pt-4">
              <label className="form-label" htmlFor="rq-cr-day">
                เพิ่มวันทีละวัน
              </label>
              <div className="flex flex-wrap items-start gap-2">
                <div className="form-shell min-w-0 flex-1">
                  <input
                    id="rq-cr-day"
                    type="date"
                    className="form-input tabular-nums"
                    aria-describedby="rq-cr-when-err"
                    value={day}
                    onChange={(e) => {
                      setDay(e.target.value)
                      clear('when')
                    }}
                  />
                </div>
                <Btn variant="ghost" className="shrink-0" onClick={addDay}>
                  <Glyph d={ICON.plus} className="h-4.5 w-4.5 shrink-0" />
                  เพิ่มวัน
                </Btn>
              </div>
              <ul className="m-0 mt-2 flex list-none flex-wrap gap-1.5 p-0">
                {days.map((d) => (
                  <li key={d}>
                    <span className="tag">
                      {thaiDayLabel(d)}
                      {/* ⚠️ THE ONE CONTROL ON THIS SCREEN UNDER 44px, and it is the prototype's own
                          size. A 24px target inside a dense chip list meets WCAG 2.5.8; growing it
                          to 44 either breaks the chip or overlaps its neighbour's hit box, and a
                          mis-tap here is undone by re-adding the day. */}
                      <button
                        type="button"
                        aria-label={`เอา ${thaiDayLabel(d)} ออก`}
                        onClick={() => {
                          setDays((prev) => prev.filter((x) => x !== d))
                          clear('when')
                        }}
                        className="-mr-1 ml-0.5 flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-base-content/15 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
                      >
                        <Glyph d={ICON.close} className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              {days.length === 0 && (
                <p className="mt-2 text-[13px] text-base-content/70">ยังไม่ได้เลือกวัน</p>
              )}
            </div>
          </div>
        )}

        <p id="rq-cr-clock-hint" className="mt-1.5 text-[13px] text-base-content/70">
          นาฬิกาแบบ 24 ชั่วโมง · ใช้ <span className="tabular-nums">24:00</span> เมื่อจองถึงสิ้นวัน
        </p>
        {/* ONE time range across every day, in both modes. A per-day time is a real requirement and
            it is deliberately NOT in this form: it turns a six-field dialog into a table editor, and
            an operator who needs it can raise two bookings. Recorded so the next person knows it was
            weighed, not missed. */}
        <p className="mt-1.5 text-[13px] text-base-content/70">
          ใช้เวลาเดียวกันทุกวันที่เลือก · ถ้าต้องการเวลาต่างกัน ให้สร้างเป็นคนละรายการ
        </p>
        <FieldError id="rq-cr-when-err" message={errors.when} />
      </fieldset>

      {/* ── The live conflict row ────────────────────────────────────────────────────────────
          It updates on every change to venue / dates / time, BEFORE submit, because "the room is
          taken" is the one answer that makes everything else on this form pointless.
            idle     not enough filled in to check — which says exactly that, and never "it is free"
            checking the answer on screen belongs to spans that have since changed
            ok       free
            warn     PENDING requests overlap; creating this rejects them (ADR-001) — never a block
            block    an APPROVED booking overlaps, or preflight refused the spans — submit disabled
          `aria-live="polite"` on the wrapper, which is mounted for the whole life of the dialog: a
          live region announces only what arrives AFTER it exists. */}
      <div className="mt-5" aria-live="polite">
        {pf.kind === 'idle' && (
          <InlineNote>
            <span>เลือกสถานที่ วัน และเวลา แล้วระบบจะตรวจให้ว่าช่วงเวลานี้ว่างหรือไม่</span>
          </InlineNote>
        )}

        {pf.kind === 'checking' && (
          <InlineNote>
            <span className="flex items-center gap-2">
              <Spinner />
              กำลังตรวจสอบว่าช่วงเวลานี้ว่างหรือไม่…
            </span>
          </InlineNote>
        )}

        {/* A 400 from preflight is the SAME validator `direct` runs, so it predicts the submit — it
            is surfaced verbatim and it blocks, rather than being swallowed into a generic banner. */}
        {pf.kind === 'invalid' && (
          <div className="inline-alert !mb-0">
            <Glyph d={ICON.alert} className="inline-alert-ico" />
            <p className="m-0">{pf.message}</p>
          </div>
        )}

        {/* Could not ASK. Not a verdict, so it does not block — the server refuses again if it must. */}
        {pf.kind === 'failed' && (
          <InlineNote>
            <span>ตรวจสอบช่วงเวลาอัตโนมัติไม่สำเร็จ · ระบบจะตรวจอีกครั้งตอนกดบันทึก</span>
          </InlineNote>
        )}

        {pf.kind === 'ok' && (
          <>
            {clash ? (
              /* ⚠️ `.inline-alert`, the error tone — matching `#rq-approve-modal`, which states this
                 same fact about this same rule. Two dialogs that disagree tonally about "an APPROVED
                 booking already holds this hour" teach an operator that the colour means nothing.
                 ⚠️ NO LIST UNDER IT: the contract sends a COUNT of slots, not the bookings that hold
                 them, and inventing rows here would be worse than the sentence. */
              <div className="inline-alert !mb-0">
                <Glyph d={ICON.alert} className="inline-alert-ico" />
                <p className="m-0">
                  ช่วงเวลานี้มีการจองที่<strong className="font-semibold">อนุมัติแล้ว</strong>อยู่{' '}
                  <span className="tabular-nums">
                    {pf.data.approvedClashCount.toLocaleString('th-TH')}
                  </span>{' '}
                  ช่วงเวลา · เปลี่ยนวัน เวลา หรือสถานที่ก่อนจึงจะบันทึกได้
                </p>
              </div>
            ) : losers.length > 0 ? (
              <>
                <div className="inline-warn !mb-2">
                  <Glyph d={ICON.warning} className="inline-warn-ico" />
                  <p className="m-0">
                    มีคำขอที่<strong className="font-semibold">รอพิจารณา</strong>ชนช่วงเวลานี้{' '}
                    <span className="tabular-nums">{losers.length}</span> คำขอ ·
                    การสร้างการจองนี้จะปฏิเสธคำขอเหล่านั้นโดยอัตโนมัติ
                  </p>
                </div>
                {/* A list, not a sentence: these are RECORDS about to be refused on the operator's
                    behalf, and prose is what gets skimmed. */}
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {losers.map((r) => (
                    <li key={r.id} className="rq-conflict">
                      <span className="rq-code">{r.code}</span>
                      <span className="text-base-content/90">
                        {r.requesterName ? `${r.requesterName} · ` : ''}
                        {r.purpose}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="inline-ok !mb-0">
                <Glyph d={ICON.check} className="inline-ok-ico" />
                <p className="m-0">
                  ช่วงเวลานี้ว่าง{' '}
                  <span className="tabular-nums">({slots.length} ช่วงเวลา)</span> —
                  ไม่มีการจองหรือคำขออื่นที่ชนกัน
                </p>
              </div>
            )}

            {/* ⚠️ INFORMATIONAL, NEVER A BLOCK. `isOpen` refuses new REQUESTS, and a staff lock is
                not a request — the server accepts this booking. It is reachable because the picker's
                list is a snapshot and this answer is live: a venue closed on the other screen while
                this dialog sat open is still selected here. */}
            {venueClosed && (
              <InlineNote className="mt-2">
                <span>
                  สถานที่นี้ <strong className="font-semibold">ปิดรับคำขอจอง</strong> อยู่ ·
                  เจ้าหน้าที่ยังล็อกเวลาเองได้ และผู้ใช้ LINE จะยื่นคำขอในช่วงนี้ไม่ได้
                </span>
              </InlineNote>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
