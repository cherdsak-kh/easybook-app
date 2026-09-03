import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { messageFor as bookingMessageFor, rememberSent, submitBooking } from './booking-api'
import {
  addDay,
  blockedReason,
  buildSlots,
  CHECK_ALERT,
  CHECK_ICON,
  checkSlot,
  emptyValues,
  fieldErrors,
  isoDate,
  parseDT,
  PURPOSE_MAX,
  slotLabel,
  type BookingValues,
  type SlotCheck,
} from './booking-form'
import { TimeSelect } from './components/TimeSelect'
import { Skeleton } from '@/client-portal/components/feedback/Skeleton'
import { Breadcrumbs } from '@/client-portal/components/ui/Breadcrumbs'
import { LIcon } from '@/client-portal/icons/LucideIcon'
import { RXIcon } from '@/client-portal/icons/RemixIcon'
import { fmtD } from '@/client-portal/lib/formatters'
import { availabilityWindow, type VenueSlot } from '@/client-portal/pages/venues/venue-availability'
import {
  getVenue,
  isNotFound,
  listAvailability,
  messageFor as venueMessageFor,
} from '@/client-portal/pages/venues/venues-api'
import type { Venue } from '@/lib/api-client'

/**
 * `#/request/:id` — the booking request form. Prototype 1235–1457 and 4108–4475.
 *
 * ── 🔴 THIS SCREEN'S WHOLE ARGUMENT, IN THE BOX AT THE TOP ──
 * `D-C13` rules 1 and 4 are two halves of one fact, and the reader needs BOTH before they fill
 * anything in: overlapping requests are allowed, *and* an overlapping request loses automatically
 * the moment a competing one is approved. Knowing only the first makes people submit believing they
 * have the room. That is why the info alert is above the fields rather than in a footnote.
 *
 * ── The three-level checker ──
 * Red blocks, amber does not, green is free — {@link checkSlot} owns the rule and this file only
 * paints it. Collapsing amber into either neighbour is the failure `TRANSPORT.md` §3.1 names.
 *
 * ⚠️ THE CHECK IS A CONVENIENCE AND THE SERVER IS THE GUARANTEE. Availability is read once when the
 * screen opens; somebody else's request can be approved while this form is being filled in, and the
 * `409` that follows is handled at the bottom of `submit` rather than treated as impossible.
 *
 * ── 🟠 NO IN-PAGE BACK ARROW (`D-C3`) ──
 * The way back is the breadcrumb, which names its destination (`D-C14`).
 *
 * ⚠️ DOCKLESS, and nothing here says so: `NAV_SCREENS` omits `request` and `LiffShell` reads that
 * table. A screen that opted out by hand would be a second place the answer lives.
 */

/** The two mode buttons, as data, so the pair cannot drift apart. Prototype 4307. */
const MODES = [
  {
    key: 'cont' as const,
    label: 'ใช้ต่อเนื่องครั้งเดียว',
    note: 'ใช้ครั้งเดียวตั้งแต่วันเวลาเริ่มจนถึงวันเวลาสิ้นสุด — ข้ามวันได้',
  },
  {
    key: 'rep' as const,
    label: 'ใช้ซ้ำหลายวัน',
    note: 'ใช้เวลาเดิมซ้ำในหลายวันที่ — เลือกวันได้ไม่จำกัดจำนวน',
  },
]

export function BookingRequestPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [venue, setVenue] = useState<Venue | null>(null)
  const [taken, setTaken] = useState<readonly VenueSlot[]>([])
  const [failure, setFailure] = useState<string | null>(null)

  const [values, setValues] = useState<BookingValues>(() => emptyValues())
  const [dayDraft, setDayDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  /**
   * ⚠️ ERRORS APPEAR ONLY AFTER A FIELD HAS BEEN LEFT (`rqTouched`, prototype 4265). A blank form
   * that turns every field red on arrival is telling somebody off for not having done anything yet.
   * Pressing submit marks all three at once, because pressing submit is the claim that it is done.
   */
  const [touched, setTouched] = useState({ purpose: false, attendees: false, when: false })

  const set = <K extends keyof BookingValues>(key: K, value: BookingValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }))

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setVenue(null)
    setFailure(null)
    /* A different venue is a different request. Re-entering the SAME one keeps what was typed —
       pressing back out of the confirmation screen must not empty the form (prototype 4322). */
    setValues(emptyValues())
    setTouched({ purpose: false, attendees: false, when: false })

    void (async () => {
      try {
        const found = await getVenue(id)
        if (cancelled) return
        setVenue(found)
        /* Availability failing is not this screen's failure. Without it the checker cannot promise
           a slot is free, but the form still submits and the SERVER still refuses a real clash —
           which is the only guarantee either way. */
        try {
          const { from, to } = availabilityWindow()
          const rows = await listAvailability(id, from, to)
          if (!cancelled) setTaken(rows)
        } catch (error) {
          console.warn('[request] availability failed:', error)
        }
      } catch (error) {
        if (cancelled) return
        /* 🔴 A BAD `:id` GOES BACK TO THE CATALOGUE (`PAGE_INDEX.md` §2.3), never to a blank form
           for a room that does not exist. `replace`, so back does not walk into it again. */
        if (isNotFound(error)) {
          void navigate('/venues', { replace: true })
          return
        }
        console.warn('[request] venue load failed:', error)
        setFailure(venueMessageFor(error))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, navigate])

  /**
   * ⚠️ A CLOSED VENUE HAS NO FORM. The catalogue makes its card unclickable and the detail screen
   * disables the CTA, but `/request/:id` is a URL and can be typed or restored by LINE — and the
   * server answers `409` to a submission against it. Bouncing to the venue, which explains WHY it
   * is closed, is the only screen that answers the question the reader now has.
   */
  useEffect(() => {
    if (venue && !venue.isOpen) void navigate(`/venue/${venue.id}`, { replace: true })
  }, [venue, navigate])

  const slots = useMemo(() => buildSlots(values), [values])
  /* Rechecked on every keystroke against the availability read once at open. Cheap: at most 60
     spans against a few dozen rows. */
  const checks: SlotCheck[] = useMemo(
    () => slots.map((s) => checkSlot(s, taken)),
    [slots, taken],
  )

  const errors = venue
    ? fieldErrors(values, venue)
    : { purpose: '', attendees: '' }
  const blocked = venue ? blockedReason(values, venue, checks) : 'กำลังโหลดข้อมูลสถานที่'
  const canSubmit = !blocked && !saving

  function addChosenDay() {
    setTouched((t) => ({ ...t, when: true }))
    const day = parseDT(dayDraft, '00:00')
    if (!day) {
      document.getElementById('rq-rdate')?.focus()
      return
    }
    set('days', addDay(values.days, day))
    setDayDraft('')
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    /* Pressing submit declares the form finished, so every field becomes touched at once. The
       button is already disabled when it is not — this is the net under `Enter` in the textarea,
       which fires submit without going near the button. */
    setTouched({ purpose: true, attendees: true, when: true })
    if (!venue) return

    if (blocked) {
      /* ⚠️ FOCUS GOES TO THE THING THAT IS WRONG, in the order it can be fixed: the bad field
         first, because focus lands where the correction is made; the check list last, because that
         is where a time clash lives and there is no field to send them to. A press that moves
         nothing is a dead end for a keyboard or screen-reader user (prototype 4444). */
      const target = errors.purpose
        ? 'rq-purpose'
        : errors.attendees
          ? 'rq-attendees'
          : 'rq-slots'
      document.getElementById(target)?.focus()
      return
    }

    setSaving(true)
    setSubmitError(null)
    try {
      const created = await submitBooking(
        venue.id,
        values.purpose.trim(),
        Number.parseInt(values.attendees.trim(), 10),
        slots,
      )
      /* Stash BEFORE navigating: the confirmation screen reads by code, so that a refresh and
         LIFF's back button both find it (`D-C3`). See `rememberSent`. */
      rememberSent(created)
      void navigate(`/sent/${created.code}`, { replace: true, state: { request: created } })
    } catch (error) {
      console.warn('[request] submit failed:', error)
      setSubmitError(bookingMessageFor(error))
      setSaving(false)
    }
  }

  if (failure) {
    return (
      <section className="pb-safe grid min-h-dvh place-items-center px-4">
        <div
          role="alert"
          className="w-full max-w-sm rounded-box border border-error/40 bg-base-100 p-6 text-center"
        >
          <p className="text-sm font-medium">{failure}</p>
          <button
            type="button"
            onClick={() => void navigate('/venues')}
            className="btn btn-app btn-outline mt-4 w-full"
          >
            กลับสู่รายการสถานที่
          </button>
        </div>
      </section>
    )
  }

  const today = isoDate(new Date())
  const modeNote = MODES.find((m) => m.key === values.mode)?.note ?? ''

  /* ⚠️ `pb-safe`, NOT `pad-nav` — dockless, so there is nothing to reserve room for. */
  return (
    <section className="pb-safe min-h-dvh">
      <header className="hdr-blur sticky top-0 z-30 border-b border-base-300 bg-base-100/90 shadow-xs backdrop-blur-md">
        <div className="border-b border-base-300/60">
          <div className="mx-auto w-full max-w-md px-4 pb-2.5 pt-safe-lg sm:max-w-2xl md:max-w-4xl lg:max-w-5xl">
            <Breadcrumbs
              className="text-xs text-base-content/60"
              trail={[
                { label: 'จองสถานที่', to: '/venues' },
                { label: venue?.name ?? '…', to: venue ? `/venue/${venue.id}` : undefined },
                { label: 'ยื่นคำขอ' },
              ]}
            />
          </div>
        </div>
        <div className="mx-auto w-full max-w-md px-4 py-3 sm:max-w-2xl md:max-w-4xl lg:max-w-5xl">
          <h1 className="truncate text-lg font-semibold leading-snug">ยื่นคำขอใช้สถานที่</h1>
        </div>
      </header>

      {/* ⚠️ A REAL `<form>`, not a `<div>` with a button: Enter in the textarea must submit, and
          "the set of fields that travel together" is a fact only this element states.
          ⚠️ `noValidate` because the browser's own validation speaks the SYSTEM's language, not the
          Thai this form is written in, and it appears as a bubble that vanishes after five
          seconds. Ours sit under the fields and stay. */}
      <form
        noValidate
        onSubmit={(e) => void submit(e)}
        className="mx-auto w-full max-w-md px-4 pt-4 sm:max-w-2xl md:max-w-4xl lg:max-w-5xl"
      >
        <div className="flex items-center gap-2 text-base font-medium text-base-content">
          <LIcon name="building2" className="h-5 w-5 shrink-0 text-primary" />
          {venue ? (
            /* ⚠️ SEPARATED BY `·`, NOT PARENTHESES. Two real venue names carry parentheses inside
               themselves, and a second pair around the location yields
               `ลานกิจกรรม (ข้างพระนเรศวร) (ข้างพระบรมราชานุสาวรีย์)`. */
            <span className="truncate">
              {venue.name}
              {venue.location ? ` · ${venue.location}` : ''}
            </span>
          ) : (
            <Skeleton className="h-5 w-2/3" />
          )}
        </div>

        <div role="alert" className="alert alert-info alert-soft mt-3 text-sm">
          <LIcon name="info" className="h-5 w-5 shrink-0" />
          {/* `text-base-content` — see the note on `VenueDetailPage`'s closed alert: daisyUI's
              `alert-soft` text fails AA in the LIGHT theme (info 4.64, success 3.45, error 4.36,
              warning 2.04). On the words only, so the icon keeps its level colour. */}
          <span className="text-base-content">
            นี่คือ<strong>การยื่นคำขอใช้สถานที่</strong> เจ้าหน้าที่จะเป็นผู้พิจารณาอนุมัติ ·
            ช่วงเวลาเดียวกันสามารถยื่นคำขอซ้อนได้ เมื่อมีคำขอใดได้รับอนุมัติ
            คำขออื่นที่มีช่วงเวลาซ้อนกันจะไม่ได้รับอนุมัติโดยอัตโนมัติ
          </span>
        </div>

        {/* ─── Card 1 · what the approver rules on ───────────────────────────── */}
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-base-content">รายละเอียดประกอบการพิจารณา</h2>
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-3 p-4">
              <label className="block">
                <span className="mb-1 block text-xs text-base-content/70">
                  วัตถุประสงค์การใช้สถานที่ <span className="text-error">*</span>
                </span>
                <textarea
                  id="rq-purpose"
                  rows={3}
                  maxLength={PURPOSE_MAX}
                  value={values.purpose}
                  onChange={(e) => set('purpose', e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, purpose: true }))}
                  aria-invalid={touched.purpose && !!errors.purpose}
                  className={`textarea w-full text-base ${touched.purpose && errors.purpose ? 'textarea-error' : ''}`}
                  placeholder="เช่น ประชุมผู้ปกครองระดับชั้น ป.6 ภาคเรียนที่ 1"
                />
                {touched.purpose && errors.purpose ? (
                  <span className="mt-1 block text-xs text-error">{errors.purpose}</span>
                ) : null}
              </label>

              <label className="block">
                {/* 🔴 THE CEILING IS PRINTED BESIDE THE LABEL, not produced as an error after the
                    reader has already exceeded it — that would be one guess for no reason. */}
                <span className="mb-1 flex flex-wrap items-center justify-between gap-x-2 text-xs text-base-content/70">
                  <span>
                    จำนวนผู้เข้าร่วมกิจกรรม (คน) <span className="text-error">*</span>
                  </span>
                  {venue ? (
                    <span className="font-medium text-base-content/60">
                      รองรับได้สูงสุด {venue.capacity.toLocaleString('th-TH')} คน
                    </span>
                  ) : null}
                </span>
                <input
                  id="rq-attendees"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={venue?.capacity}
                  value={values.attendees}
                  onChange={(e) => set('attendees', e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, attendees: true }))}
                  aria-invalid={touched.attendees && !!errors.attendees}
                  className={`input input-lg w-full ${touched.attendees && errors.attendees ? 'input-error' : ''}`}
                  placeholder="เช่น 120"
                />
                {touched.attendees && errors.attendees ? (
                  <span className="mt-1 block text-xs text-error">{errors.attendees}</span>
                ) : null}
              </label>
            </div>
          </div>
        </div>

        {/* ─── Card 2 · mode, times, and the result of checking them ──────────
            🔴 ALL THREE IN ONE CARD. An earlier round split them into three boxes, which put the
            check result far from the fields that change it — changing a time must show its result
            without scrolling. */}
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-base-content">รูปแบบและช่วงเวลาที่ขอใช้</h2>
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-0 p-4 text-base">
              {/* 🔴 THE NOTE IS ABOVE THE BUTTONS. Below them it reads as the result of what was
                  just pressed; it is in fact what you need in order to decide which to press. */}
              <div>
                <span className="block text-center text-sm font-medium text-base-content">
                  เลือกรูปแบบการขอใช้
                </span>
                <p className="mb-3 mt-1 text-center text-xs text-base-content/70">{modeNote}</p>
                <div className="join w-full" role="group" aria-label="รูปแบบการขอใช้">
                  {MODES.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      aria-pressed={values.mode === m.key}
                      onClick={() => {
                        setTouched((t) => ({ ...t, when: true }))
                        set('mode', m.key)
                      }}
                      className={`btn btn-app join-item grow ${values.mode === m.key ? 'btn-neutral' : ''}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divider my-3" />

              {values.mode === 'cont' ? (
                <>
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <RXIcon name="enter" className="h-4 w-4 shrink-0 text-success" />
                    วันและเวลาเริ่มเข้าใช้งาน
                  </h3>
                  <div className="mt-3 space-y-3">
                    <label className="block">
                      <span className="mb-1 block text-xs text-base-content/70">เริ่ม — วันที่</span>
                      <input
                        type="date"
                        min={today}
                        value={values.startDate}
                        onChange={(e) => {
                          setTouched((t) => ({ ...t, when: true }))
                          const next = e.target.value
                          /* ⚠️ THE END DATE IS DRAGGED ALONG when it falls behind the start —
                             not a correction, but a refusal to hold a state with no meaning at
                             all. Somebody who really wants a cross-day span moves it on again. */
                          setValues((prev) => ({
                            ...prev,
                            startDate: next,
                            endDate: prev.endDate && prev.endDate < next ? next : prev.endDate,
                          }))
                        }}
                        className="input input-lg w-full"
                      />
                    </label>
                    <TimeSelect
                      id="rq-st"
                      label="เวลาเริ่ม"
                      value={values.startTime}
                      onChange={(v) => {
                        setTouched((t) => ({ ...t, when: true }))
                        set('startTime', v)
                      }}
                    />
                  </div>

                  <div className="divider my-3" />

                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <RXIcon name="leave" className="h-4 w-4 shrink-0 text-error" />
                    วันและเวลาสิ้นสุดการใช้งาน
                  </h3>
                  <div className="mt-3 space-y-3">
                    <label className="block">
                      <span className="mb-1 block text-xs text-base-content/70">สิ้นสุด — วันที่</span>
                      <input
                        type="date"
                        min={values.startDate || today}
                        value={values.endDate}
                        onChange={(e) => {
                          setTouched((t) => ({ ...t, when: true }))
                          set('endDate', e.target.value)
                        }}
                        className="input input-lg w-full"
                      />
                    </label>
                    <TimeSelect
                      id="rq-et"
                      label="เวลาสิ้นสุด"
                      value={values.endTime}
                      onChange={(v) => {
                        setTouched((t) => ({ ...t, when: true }))
                        set('endTime', v)
                      }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <LIcon name="clock" className="h-4 w-4 shrink-0 text-primary" />
                    1. กำหนดช่วงเวลา{' '}
                    <span className="text-xs font-normal text-base-content/60">
                      (เวลาเดิมทุกวันที่เลือก)
                    </span>
                  </h3>
                  <div className="mt-3 space-y-3">
                    <TimeSelect
                      id="rq-rst"
                      label="เวลาเริ่ม"
                      value={values.repStartTime}
                      onChange={(v) => {
                        setTouched((t) => ({ ...t, when: true }))
                        set('repStartTime', v)
                      }}
                    />
                    <TimeSelect
                      id="rq-ret"
                      label="เวลาสิ้นสุด"
                      value={values.repEndTime}
                      onChange={(v) => {
                        setTouched((t) => ({ ...t, when: true }))
                        set('repEndTime', v)
                      }}
                    />
                  </div>

                  <div className="divider my-3" />

                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <LIcon name="calendarPlus" className="h-4 w-4 shrink-0 text-primary" />
                    2. เลือกวันที่ต้องการใช้
                  </h3>
                  <div className="mt-3 space-y-3">
                    {/* ⚠️ `items-end`, not `items-center`: the label sits above the field only, so
                        the button lines up with the FIELD rather than with the labelled block. */}
                    <div className="flex items-end gap-2">
                      <label className="grow">
                        <span className="mb-1 block text-xs text-base-content/70">เพิ่มวันที่</span>
                        <input
                          id="rq-rdate"
                          type="date"
                          min={today}
                          value={dayDraft}
                          onChange={(e) => setDayDraft(e.target.value)}
                          className="input input-lg w-full"
                        />
                      </label>
                      <button type="button" onClick={addChosenDay} className="btn btn-app shrink-0">
                        เพิ่ม
                      </button>
                    </div>
                    {/* 🔴 THERE IS NO SEPARATE CHIP LIST (removed 2 ก.ย. 2569). The chosen days
                        WERE listed twice — removable chips here and status rows below — so the
                        reader had to pair a chip with a row and scroll back up to delete. The
                        delete button now lives in the status row: one list that both reports and
                        removes. */}
                  </div>
                </>
              )}

              {/* ⚠️ THE WHOLE CHECK BLOCK IS HIDDEN WHEN THERE IS NOTHING TO CHECK — a divider left
                  hanging over emptiness reads as content that failed to load.
                  ⚠️ `tabIndex={-1}` so a failed submit can land focus here when the problem is a
                  time clash and there is no field to send anyone to. */}
              {slots.length > 0 || values.mode === 'rep' ? (
                <>
                  <div className="divider my-3" />
                  <div id="rq-slots" tabIndex={-1} className="space-y-2" aria-live="polite">
                    {slots.length === 0 ? (
                      <div role="status" className="alert alert-info alert-soft text-xs">
                        <LIcon name="info" className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 text-base-content">ยังไม่ได้เลือกวันที่ — เลือกอย่างน้อยหนึ่งวัน</span>
                      </div>
                    ) : (
                      slots.map((slot, i) => {
                        const check = checks[i]
                        const label = slotLabel(slot, values.mode)
                        const body = (
                          /* `text-base-content`: the three levels are told apart by the icon and
                             the background tint, never by the text colour — which fails AA in the
                             light theme on three of the four (see `VenueDetailPage`). */
                          <span className="min-w-0 text-base-content">
                            {label ? <span className="font-medium">{label}</span> : null}
                            {label ? ' · ' : ''}
                            {check.msg}
                          </span>
                        )
                        if (values.mode !== 'rep') {
                          return (
                            <div
                              key={slot.start.getTime()}
                              role="status"
                              className={`alert ${CHECK_ALERT[check.kind]} alert-soft text-xs`}
                            >
                              <LIcon name={CHECK_ICON[check.kind]} className="h-4 w-4 shrink-0" />
                              {body}
                            </div>
                          )
                        }
                        return (
                          <div
                            key={slot.start.getTime()}
                            role="status"
                            /* ⚠️ `flex` OVERRIDES `.alert`, which is `display:grid`. It wins
                               because Tailwind v4 puts utilities in a later cascade layer than
                               daisyUI's components — not because of specificity. */
                            className={`alert ${CHECK_ALERT[check.kind]} alert-soft flex items-center justify-between gap-2 px-3 py-2 text-xs`}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <LIcon name={CHECK_ICON[check.kind]} className="h-4 w-4 shrink-0" />
                              {body}
                            </span>
                            {/* ⚠️ 28×24, BELOW THE 44px FLOOR, AND THAT IS THE PROTOTYPE'S OWN
                                DECISION (4243): the row is 40px tall, so a 44px button makes every
                                row taller and a five-day list outruns the screen. A mis-tap here is
                                instantly undoable by adding the date back, unlike a cancel button.
                                The `aria-label` names the exact date, so it is not an unnamed
                                control for a screen reader. */}
                            <button
                              type="button"
                              aria-label={`ลบ ${fmtD(slot.start)} ออก`}
                              onClick={() => {
                                setTouched((t) => ({ ...t, when: true }))
                                set(
                                  'days',
                                  values.days.filter((_, di) => di !== i),
                                )
                              }}
                              className="btn btn-ghost btn-xs shrink-0 gap-1 px-1.5 text-base-content/70 hover:text-error"
                            >
                              <LIcon name="x" className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">ลบออก</span>
                            </button>
                          </div>
                        )
                      })
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {submitError ? (
          <div role="alert" className="alert alert-error alert-soft mt-6 text-sm">
            <LIcon name="circleX" className="h-5 w-5 shrink-0" />
            <span className="text-base-content">{submitError}</span>
          </div>
        ) : null}

        <div className="mt-6">
          <button
            type="submit"
            disabled={!canSubmit}
            aria-describedby="rq-note"
            className="btn btn-app btn-primary w-full shadow-sm"
          >
            {saving ? 'กำลังยื่นคำขอ…' : 'ยื่นคำขอใช้สถานที่'}
          </button>
          {/* 🔴 ONE LINE, AND IT SWAPS. While the button is live it is the standing caveat that a
              request is not an approved booking; while the button is dead it says what is missing.
              `aria-describedby` on the button, so the explanation reaches a screen reader that
              lands on a disabled control instead of leaving it silent. */}
          <p
            id="rq-note"
            /* ⚠️ `text-base-content`, NOT `text-warning`. The first attempt used the warning token
               and measured **2.05:1** in the light theme — the reason-for-a-dead-button is the one
               line on this screen that MUST be readable, so colouring it "cautionary" made it the
               least readable thing here. Weight carries the emphasis instead: `font-medium` at full
               strength against the `/60` of the standing note. Red was never an option either — the
               prototype deleted its red panel because it made a half-filled form read as broken. */
            className={`mb-8 mt-2 text-center text-xs ${blocked ? 'font-medium text-base-content' : 'text-base-content/60'}`}
          >
            {blocked || 'คำขอจะถูกส่งให้เจ้าหน้าที่พิจารณา ยังไม่ถือเป็นการจองที่ได้รับอนุมัติ'}
          </p>
        </div>
      </form>
    </section>
  )
}
