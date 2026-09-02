import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loadOptions, messageFor, submitRegistration } from './registration-api'
import {
  firstInvalid,
  validate,
  valuesFrom,
  type RegistrationErrors,
  type RegistrationField,
  type RegistrationValues,
} from './registration-form'
import { Combobox, type ComboboxOption } from '@/client-portal/components/ui/Combobox'
import { useGate } from '@/client-portal/hooks/gate-context'
import { getProfile } from '@/lib/liff'
import type { RegistrationOptions } from '@/lib/api-client'

/**
 * `#/register` — the five-field registration form, and the same form again for every later edit.
 * Prototype 577–705 (markup) and 2634–2726 (rules).
 *
 * ── 🔴 ONE FORM, THREE ENTRANCES, AND THAT IS THE DESIGN ──
 * `UNREGISTERED` arrives with it empty, `PENDING` arrives to change something, `REJECTED` arrives
 * to answer an operator's note. `ALLOWED_SCREENS` lets exactly those three reach `register`. There
 * is no second "resubmit" screen and no second endpoint: a re-submit flips the record back to
 * `PENDING` server-side and clears the reason (`TRANSPORT.md` §3.1). A second copy of five fields
 * is how two copies of five fields start disagreeing.
 *
 * ── 🔴 THE NEXT SCREEN IS READ FROM THE RESPONSE, NEVER INFERRED FROM THE ACTION ──
 * On success this page hands the returned status to `applyStatus` and navigates to `/`, which is
 * the gate — `GateLanding` then sends the user to `LANDING[access]`. So the destination is never
 * named here. Writing `navigate('/pending')` would work today and would be a lie the first time
 * the backend answers with anything else, and it is exactly the inference `TRANSPORT.md` §3.1
 * forbids.
 *
 * ── 🟠 `editOrigin` IS DERIVED FROM `access`, NOT CARRIED IN THE URL OR IN ROUTER STATE ──
 * The brief asks for an `editOrigin` passed from the screen the user came from. It is computed
 * from the gate instead, and the two are PROVABLY the same value: `ALLOWED_SCREENS.pending` is
 * `['pending', 'register']` and `.rejected` is `['rejected', 'register']`, so the only screen a
 * `PENDING` user can have come from is `/pending`, and likewise for `/rejected`. Deriving it buys
 * two things a passed parameter cannot: it survives a reload (router state does not), and it
 * cannot disagree with the truth — which matters here more than usual, because the prototype's
 * own note (2655) names the failure it is guarding against as *"a REJECTED user who backs out onto
 * Pending has been told their status changed when it did not"*. Same argument as `#/gate-error`
 * reading its reason from `access` rather than from `?reason=`.
 *
 * ── ⚠️ `noValidate` + `required` TOGETHER (`FORM-A11Y-1`) ──
 * `required` on its own makes the browser cancel the submit EVENT, so every hand-written Thai
 * message below becomes dead code and the reader gets the browser's own bubble in whatever
 * language the browser is set to. `required` stays because it is what tells a screen reader the
 * field is mandatory; `noValidate` is what lets our messages run.
 */

/** Field → the id of the element the caret should land on. */
const FOCUS_ID: Record<RegistrationField, string> = {
  firstName: 'rg-first',
  lastName: 'rg-last',
  /* 🔴 THE TRIGGER, NOT THE FIELD. `Combobox` is a button that owns a value; focusing anything
     else would put the caret somewhere invisible, which is worse than not focusing at all. */
  personnelRoleId: 'rg-role-btn',
  departmentId: 'rg-dept-btn',
  phone: 'rg-phone',
}

/** `{ id, name }` from the API → what `Combobox` speaks. Ids are stringified, never re-sorted. */
function toOptions(rows: readonly { id: number; name: string }[]): ComboboxOption[] {
  return rows.map((row) => ({ value: String(row.id), label: row.name }))
}

export function RegistrationPage() {
  const { access, status, applyStatus } = useGate()
  const navigate = useNavigate()

  const registration = status?.registration ?? null

  /* ⚠️ THE VERB FOLLOWS THE RECORD, THE CANCEL DESTINATION FOLLOWS THE ACCESS, and they are
     deliberately not the same question. `POST` vs `PATCH` is "does a row exist"; the way back is
     "which screen is this person's home right now". */
  const isEdit = access === 'pending' || access === 'rejected'
  const cancelTo = access === 'rejected' ? '/rejected' : '/pending'

  const [values, setValues] = useState<RegistrationValues>(() => valuesFrom(registration))
  const [errors, setErrors] = useState<RegistrationErrors>({})
  const [options, setOptions] = useState<RegistrationOptions | null>(null)
  const [optionsFailed, setOptionsFailed] = useState(false)
  const [reload, setReload] = useState(0)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)

  /* Both comboboxes come from ONE call — the server returns them together and caches them under
     `opt:liff`, so two requests would be two round trips for one screen's worth of data. */
  useEffect(() => {
    let cancelled = false
    setOptionsFailed(false)
    void (async () => {
      try {
        const loaded = await loadOptions()
        if (!cancelled) setOptions(loaded)
      } catch (error) {
        console.warn('[register] registration options failed:', error)
        if (!cancelled) setOptionsFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reload])

  /* The LINE display name, for the greeting on a FIRST registration only. Fails soft to `null`
     (a dev browser, a profile call that throws), and the greeting simply drops the name rather
     than printing an empty one. Not fetched in edit mode — that copy has no name in it. */
  useEffect(() => {
    if (isEdit) return
    let cancelled = false
    void getProfile().then((profile) => {
      if (!cancelled) setDisplayName(profile?.displayName ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [isEdit])

  const set = (field: RegistrationField, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }))
    /* Clear only THIS field's message as it is corrected. Re-running the whole validation on
       every keystroke would light up fields the reader has not reached yet. */
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return

    const found = validate(values)
    setErrors(found)
    const bad = firstInvalid(found)
    if (bad) {
      document.getElementById(FOCUS_ID[bad])?.focus()
      return
    }

    setSaving(true)
    setSubmitError(null)
    try {
      const next = await submitRegistration(
        {
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          phone: values.phone.trim(),
          personnelRoleId: Number(values.personnelRoleId),
          departmentId: Number(values.departmentId),
        },
        registration !== null,
      )
      applyStatus(next)
      /* To the GATE, not to a screen — see the note at the top of this file. */
      void navigate('/', { replace: true })
    } catch (error) {
      console.warn('[register] submit failed:', error)
      setSubmitError(messageFor(error))
      setSaving(false)
    }
  }

  /* 🔴 `options === null`, NOT "still loading". Measured 2 ก.ย. 2569: with the lists failed the
     submit button was enabled, and pressing it answered `โปรดเลือกตำแหน่ง` — an instruction the
     reader cannot follow, because the picker they are being told to use is disabled two rows
     above. A control that can only ever produce an impossible demand should not be pressable. */
  const busy = saving || options === null

  return (
    /* ⚠️ NOT `place-items-center` — unlike the other five, this screen is a tall form, and
       centring it would push the first field below the fold on a short phone. `landscape:max-w-lg`
       is the prototype's: in landscape the two name fields share a row and the card can afford it. */
    <section className="pad-safe min-h-dvh">
      <div className="mx-auto w-full max-w-md landscape:max-w-lg">
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-6 text-base">
            <h1 className="text-xl font-semibold">
              {isEdit ? 'แก้ไขข้อมูลลงทะเบียน' : 'กรอกข้อมูลลงทะเบียน'}
            </h1>
            <p className="mt-1 text-base-content/70">
              {isEdit
                ? 'อัปเดตข้อมูลของคุณด้านล่าง และส่งเพื่อขออนุมัติอีกครั้ง'
                : displayName
                  ? `สวัสดี ${displayName}! โปรดระบุข้อมูลของคุณ เพื่อให้เจ้าหน้าที่พิจารณาอนุมัติสิทธิ์การเข้าใช้งาน`
                  : 'โปรดระบุข้อมูลของคุณ เพื่อให้เจ้าหน้าที่พิจารณาอนุมัติสิทธิ์การเข้าใช้งาน'}
            </p>

            {/* ⚠️ THE FORM STAYS ON SCREEN WHEN THE OPTION LISTS FAIL. Replacing it with a
                full-card error would throw away anything already typed, and the two text fields
                and the phone are perfectly usable meanwhile — only the two pickers and the submit
                are actually blocked. `role="alert"` because it appears after the reader has
                started reading the form. */}
            {optionsFailed ? (
              <div role="alert" className="mt-4 rounded-box border border-error/40 bg-base-200 p-4">
                <p className="text-sm font-medium">
                  โหลดรายการตำแหน่งและกลุ่ม/ฝ่ายไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและลองใหม่อีกครั้ง
                </p>
                <button
                  type="button"
                  onClick={() => setReload((n) => n + 1)}
                  /* ⚠️ `btn-app` (48px), not `btn-app-sm`. Measured at 130 × 36 with the small
                     class — under the 44px floor, on the one control a reader reaches for when
                     something has already gone wrong. */
                  className="btn btn-app btn-outline mt-3"
                >
                  โหลดรายการใหม่
                </button>
              </div>
            ) : null}

            <form className="mt-6 space-y-4" noValidate onSubmit={(e) => void onSubmit(e)}>
              {/* The two names share a row from `sm:` up. They are one question asked twice, and
                  splitting them across two full-width rows makes the form look twice as long as
                  it is. */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  id="rg-first"
                  label="ชื่อจริง"
                  value={values.firstName}
                  onChange={(v) => set('firstName', v)}
                  error={errors.firstName}
                  autoComplete="given-name"
                  enterKeyHint="next"
                />
                <TextField
                  id="rg-last"
                  label="นามสกุล"
                  value={values.lastName}
                  onChange={(v) => set('lastName', v)}
                  error={errors.lastName}
                  autoComplete="family-name"
                  enterKeyHint="next"
                />
              </div>

              {/* 🔴 ตำแหน่ง BEFORE กลุ่ม/ฝ่าย — the Thai civil-service order, and the order the
                  back-office already holds. See `registration-form.ts`.
                  ⚠️ Disabled until the lists arrive: a picker that opens onto nothing reads as a
                  broken control rather than as one that is still loading. */}
              <Combobox
                id="rg-role"
                label="ตำแหน่ง"
                placeholder="เลือกตำแหน่ง"
                options={options ? toOptions(options.personnelRoles) : []}
                value={values.personnelRoleId}
                onChange={(v) => set('personnelRoleId', v)}
                error={errors.personnelRoleId}
                disabled={options === null}
              />
              <Combobox
                id="rg-dept"
                label="กลุ่ม/ฝ่าย"
                placeholder="เลือกกลุ่ม/ฝ่าย"
                options={options ? toOptions(options.departments) : []}
                value={values.departmentId}
                onChange={(v) => set('departmentId', v)}
                error={errors.departmentId}
                disabled={options === null}
              />

              <TextField
                id="rg-phone"
                label="เบอร์โทรศัพท์"
                value={values.phone}
                onChange={(v) => set('phone', v)}
                error={errors.phone}
                /* ⚠️ `type="tel"`, NOT `inputMode="numeric"` (`KEYBOARD-1`): `tel` raises the
                   phone keypad, which carries the characters a number is actually written with.
                   `spellCheck={false}` belongs here and is FORBIDDEN on the Thai name fields —
                   in Safari it also switches autocorrection off. */
                type="tel"
                autoComplete="tel"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="done"
              />

              {submitError ? (
                <p role="alert" className="text-sm font-medium text-error">
                  {submitError}
                </p>
              ) : null}

              <div className="flex gap-3 pt-2">
                {/* ⚠️ ยกเลิก only in edit mode: there is nothing for a first-time registrant to
                    cancel back TO — `ALLOWED_SCREENS.unregistered` is `['register']`, so the
                    button would have no legal destination. */}
                {isEdit ? (
                  <Link to={cancelTo} className="btn btn-app btn-outline flex-1">
                    ยกเลิก
                  </Link>
                ) : null}
                <button type="submit" disabled={busy} className="btn btn-app btn-primary flex-1">
                  {saving ? 'กำลังส่งข้อมูล...' : isEdit ? 'บันทึกข้อมูล' : 'ยืนยันการลงทะเบียน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * One labelled text input with its Thai error line. Local to this screen on purpose: three
 * callers, all in this file. `CONVENTIONS.md` §4 rule 1 promotes a component to
 * `client-portal/components/` when a SECOND SCREEN calls it, not when a second caller exists —
 * predicting the second screen is how a shared folder fills up with single-use parts.
 *
 * ⚠️ `aria-describedby` is attached only when there IS a message. Pointing at an element that is
 * not rendered leaves a dangling reference, and some screen readers announce nothing for it while
 * others announce the id.
 */
function TextField({
  id,
  label,
  value,
  onChange,
  error,
  type = 'text',
  ...input
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  type?: 'text' | 'tel'
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id' | 'value' | 'onChange' | 'type'>) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={error ? `${id}-err` : undefined}
        aria-invalid={error ? true : undefined}
        className={`input input-lg w-full ${error ? 'input-error' : ''}`.trim()}
        {...input}
      />
      {error ? (
        <p id={`${id}-err`} className="mt-1 text-xs text-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}
