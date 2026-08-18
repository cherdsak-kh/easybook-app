/**
 * แก้ไขข้อมูลการลงทะเบียน — an admin correcting what a user submitted.
 *
 * `PATCH /line-users/:id/registration`. Deliberately NOT a second copy of the detail dialog: that
 * one reviews and transitions state, this one edits the record's data. One surface, one job.
 *
 * ⚠️ THE LINE IDENTITY IS SHOWN AND NEVER EDITABLE — the display name belongs to LINE, not to us,
 * and `lineUserId` is immutable on the server. The strip says so in as many words rather than
 * leaving an operator to infer it from the absence of a field.
 *
 * ⚠️ สถานะ IS SUPER_ADMIN-ONLY, and its absence for everyone else is the design. Regular staff
 * change state through the guided transitions in the detail dialog (อนุมัติ / ส่งคืน / ระงับ),
 * which only ever offer the moves that are legal from where the record currently is. A free select
 * can jump a record to ANY state, so it belongs to the role trusted to do that and nowhere else.
 * Its labels are action-voiced ("อนุมัติ", not "อนุมัติแล้ว"): picking an option is a thing you do,
 * not a state you describe — which is also why the badge and this select are not the same strings.
 *
 * ⚠️ PROPS ONLY. `onSubmit` receives the values and the diff; the confirm dialog, the PATCH and
 * the refetch belong to the page.
 */

import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Btn } from '../../../components/ui/Btn'
import { FormField, SelectField } from '../../../components/ui/FormField'
import { InlineAlert } from '../../../components/feedback/InlineAlert'
import { Modal } from '../../../components/ui/Modal'
import { Spinner } from '../../../components/feedback/Spinner'
import { ACCESS_LABEL, ACCESS_TONE, type AppAccess } from '../../../labels'
import type { RegistrationOption, RegistrationRecord } from '../registration-record'

export interface RegistrationEditValues {
  firstName: string
  lastName: string
  personnelRoleId: number
  departmentId: number
  phone: string
  access: AppAccess
}

export type RegistrationDiff = { label: string; from: string; to: string; warn?: boolean }[]

/**
 * Action-voiced, and in the order the prototype offers them.
 *
 * ⚠️ NOT `ACCESS_LABEL`. That map is state-voiced ("อนุมัติแล้ว", "ถูกระงับการใช้งาน") because it
 * labels a badge; these label a CHOICE. Reusing one for the other is how a select silently falls
 * back to its first option and a save rewrites the record's state.
 */
const ACTION_LABEL: Record<AppAccess, string> = {
  PENDING: 'รออนุมัติ',
  ALLOWED: 'อนุมัติ',
  REJECTED: 'ส่งคืนแล้ว',
  BLOCKED: 'ระงับการใช้งาน',
  UNREGISTERED: 'ยังไม่ลงทะเบียน',
}

const ACCESS_ORDER: AppAccess[] = ['PENDING', 'ALLOWED', 'REJECTED', 'BLOCKED', 'UNREGISTERED']

const SAVE_ICON =
  'M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9'

const nameOf = (rows: RegistrationOption[], id: number) => rows.find((r) => r.id === id)?.name ?? ''

export function RegistrationEditDialog({
  open,
  onClose,
  record,
  initial,
  positions,
  departments,
  canEditAccess = false,
  alert = null,
  busy = false,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  /** Read-only context for the identity strip. */
  record: RegistrationRecord | null
  initial: RegistrationEditValues
  positions: RegistrationOption[]
  departments: RegistrationOption[]
  /** SUPER_ADMIN. Shows the free สถานะ select — see the header. */
  canEditAccess?: boolean
  alert?: string | null
  busy?: boolean
  onSubmit: (values: RegistrationEditValues, diff: RegistrationDiff) => void
}) {
  const [values, setValues] = useState<RegistrationEditValues>(initial)
  const [errors, setErrors] = useState<Partial<Record<keyof RegistrationEditValues, string>>>({})

  useEffect(() => {
    if (!open) return
    setValues(initial)
    setErrors({})
  }, [open, initial])

  const set = <K extends keyof RegistrationEditValues>(k: K, v: RegistrationEditValues[K]) => {
    setValues((s) => ({ ...s, [k]: v }))
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e))
  }

  const trimmed = useMemo<RegistrationEditValues>(
    () => ({
      ...values,
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      phone: values.phone.trim(),
    }),
    [values],
  )

  /**
   * ⚠️ THE FIELD ORDER HERE IS THE ORDER THE CONFIRM LISTS THEM IN, and it matches the order of
   * the inputs above — an operator reading the confirmation should be scanning the same sequence
   * they just typed.
   *
   * ⚠️ A FIELD THIS ROLE CANNOT EDIT CANNOT HAVE CHANGED. สถานะ is excluded outright when the
   * select is not rendered, rather than compared against a value the form never showed.
   */
  const diff = useMemo<RegistrationDiff>(() => {
    const out: RegistrationDiff = []
    const cmp = (label: string, from: string, to: string, warn?: boolean) => {
      if (from !== to) out.push({ label, from: from || '—', to: to || '—', warn })
    }
    cmp('ชื่อ', initial.firstName, trimmed.firstName)
    cmp('นามสกุล', initial.lastName, trimmed.lastName)
    cmp('ตำแหน่ง', nameOf(positions, initial.personnelRoleId), nameOf(positions, trimmed.personnelRoleId))
    cmp('กลุ่ม/ฝ่าย', nameOf(departments, initial.departmentId), nameOf(departments, trimmed.departmentId))
    cmp('เบอร์โทรศัพท์', initial.phone, trimmed.phone)
    if (canEditAccess)
      cmp('สถานะ', ACTION_LABEL[initial.access], ACTION_LABEL[trimmed.access], true)
    return out
  }, [initial, trimmed, positions, departments, canEditAccess])

  function submit() {
    // Every field is required, so the checks read in the same order the form does.
    const next: Partial<Record<keyof RegistrationEditValues, string>> = {}
    if (!trimmed.firstName) next.firstName = 'กรอกชื่อ'
    else if (!trimmed.lastName) next.lastName = 'กรอกนามสกุล'
    else if (!trimmed.phone) next.phone = 'กรอกเบอร์โทรศัพท์'
    setErrors(next)
    if (Object.keys(next).length) return
    onSubmit(trimmed, diff)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="แก้ไขข้อมูลการลงทะเบียน"
      width={600}
      dismissable={!busy}
      footerClassName="flex flex-col gap-2 sm:flex-row sm:justify-end"
      footer={
        <Btn
          variant="primary"
          className="w-full sm:w-auto"
          disabled={busy}
          aria-busy={busy || undefined}
          aria-label={busy ? 'กำลังบันทึก' : undefined}
          onClick={submit}
        >
          {busy ? (
            <Spinner />
          ) : (
            <svg
              aria-hidden="true"
              className="h-4.5 w-4.5 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={SAVE_ICON} />
            </svg>
          )}
          บันทึก
        </Btn>
      }
    >
      <InlineAlert message={alert} />

      {/* ⚠️ OUTLINED, NOT FILLED, and the reason was measured: the avatar tile inside used to be a
          10% wash, and a wash composites against whatever is UNDER it — on a `bg-base-200` strip
          that dragged the letter to 4.35:1 against 5.0 on base-100. The tile is opaque now
          (`ava-fill`), so the hazard is gone at the source, but the outline stays: it is also what
          keeps this strip from reading as a third panel in a dialog that already has a form. */}
      {record && (
        <div className="mb-5 flex items-center gap-3 rounded-control border border-base-300 bg-base-100 px-3.5 py-3">
          {record.pictureUrl ? (
            <span className="h-11 w-11 shrink-0 rounded-control border border-base-300 bg-base-100">
              <img
                src={record.pictureUrl}
                alt=""
                className="h-full w-full rounded-control object-cover"
              />
            </span>
          ) : (
            <span className="ava-fill flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-[16px] font-semibold text-primary">
              {(values.firstName || record.displayName || '?').trim().charAt(0) || '?'}
            </span>
          )}
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[15px] font-medium text-base-content">
              LINE: {record.displayName ?? record.lineUserId}
            </span>
            <span className="text-[13px] text-base-content/70">บัญชี LINE ที่เชื่อมอยู่ (แก้ไขไม่ได้)</span>
          </span>
          <Badge tone={ACCESS_TONE[record.access]} className="ml-auto shrink-0">
            {ACCESS_LABEL[record.access]}
          </Badge>
        </div>
      )}

      {/* Every field is required, so per-field asterisks carry no information — five stars that
          never differ is just noise. One statement says it once, and it sits BEFORE the inputs:
          a rule you only meet at the bottom is a rule you read too late. */}
      <p className="mb-4 text-[13px] text-base-content/80">ทุกช่องจำเป็นต้องกรอก</p>

      <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
        <FormField
          label="ชื่อ"
          value={values.firstName}
          error={errors.firstName}
          onChange={(e) => set('firstName', e.target.value)}
        />
        <FormField
          label="นามสกุล"
          value={values.lastName}
          error={errors.lastName}
          onChange={(e) => set('lastName', e.target.value)}
        />

        <SelectField
          label="ตำแหน่ง"
          value={values.personnelRoleId}
          onChange={(e) => set('personnelRoleId', Number(e.target.value))}
        >
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="กลุ่ม/ฝ่าย"
          value={values.departmentId}
          onChange={(e) => set('departmentId', Number(e.target.value))}
        >
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </SelectField>

        <FormField
          label="เบอร์โทรศัพท์"
          type="tel"
          inputMode="numeric"
          placeholder="08x-xxx-xxxx"
          className=""
          value={values.phone}
          error={errors.phone}
          onChange={(e) => set('phone', e.target.value)}
        />

        {canEditAccess && (
          <SelectField
            label="สถานะ"
            value={values.access}
            onChange={(e) => set('access', e.target.value as AppAccess)}
            hint="แก้ไขได้เฉพาะผู้ดูแลระบบสูงสุด"
          >
            {ACCESS_ORDER.map((a) => (
              <option key={a} value={a}>
                {ACTION_LABEL[a]}
              </option>
            ))}
          </SelectField>
        )}
      </div>
    </Modal>
  )
}
