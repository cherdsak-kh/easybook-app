/**
 * เพิ่ม / จัดการบัญชี — `POST /system-users` and `PATCH /system-users/:id`.
 *
 * SUPER_ADMIN only, at every width. An ADMIN never reaches it, so nothing in here is disabled for
 * a role; the whole dialog is simply absent.
 *
 * ── What is NOT in this form, and why each absence is load-bearing ──
 *  · รหัสผ่าน — `CreateSystemUserDto` has NO `password` field. The server issues a temporary one
 *    and returns it exactly once. An admin-chosen password would be a second credential path
 *    around the forced-reset gate, so the absence IS the enforcement. Operators look for this
 *    field, which is why the note says where the password comes from instead of leaving a hole.
 *  · อีเมล on edit — absent from `UpdateSystemUserDto`, and the `@unique` index spans soft-deleted
 *    rows, so an address is burned permanently once used. Rendered as read-only TEXT with the
 *    reason, not as a disabled input: a greyed field invites clicking, and a disabled control
 *    promises it might enable.
 *  · สถานะ on create — `isActive` defaults true and is not on the create DTO. "Create this account
 *    already suspended" is a control for a state nobody wants and the API cannot set.
 *
 * ⚠️ ON YOUR OWN ROW THE GRANT FIELDSET IS REPLACED, NOT DISABLED. `canPatch` step 5 binds every
 * role including SUPER_ADMIN, so a self-patch carrying `role` or `isActive` is a 403 with a named
 * reason, and `canDelete` / `canResetPassword` deny self outright. Four rules, and the reason is
 * not seniority — it is that the last SUPER_ADMIN demoting or suspending themselves locks the
 * school out of its own system with no endpoint left that could undo it. Disabled controls promise
 * they might enable later; these never will, for anyone. What stays is the pair of FACTS the
 * fieldset was displaying, because hiding the controls must not also hide what they were set to.
 *
 * ⚠️ PROPS ONLY (PO, 18 ส.ค. 2569). No API call, no confirm dialog, no toast. `onSubmit` hands the
 * caller the values AND the diff, because computing that diff needs the form's own before/after
 * and nothing else does. What happens next — confirm, PATCH, refetch — is the page's.
 */

import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Btn } from '../../../components/ui/Btn'
import { Combobox } from '../../../components/ui/Combobox'
import { FormField, SelectField } from '../../../components/ui/FormField'
import { InlineAlert } from '../../../components/feedback/InlineAlert'
import { Modal } from '../../../components/ui/Modal'
import { Spinner } from '../../../components/feedback/Spinner'
import { ROLE_HINT, ROLE_LABEL, type SystemRole } from '../../../labels'
import { STAFF_STATE, type StaffOption, type StaffState } from '../staff-record'
import { RoleChip } from './RoleChip'

export interface StaffFormValues {
  email: string
  firstName: string
  lastName: string
  personnelRoleId: number
  departmentId: number
  phoneNumber: string
  role: SystemRole
  isActive: boolean
}

export type StaffDiff = { label: string; from: string; to: string }[]

/** The three roles, least privilege first — the order the select offers them in. */
const ROLE_ORDER: SystemRole[] = ['VIEWER', 'ADMIN', 'SUPER_ADMIN']

/**
 * Mirrors `@Matches(/^[0-9+\-\s()#.]{6,20}$/)` on the DTO, exactly.
 *
 * ⚠️ Deliberately NOT `@IsPhoneNumber('TH')`. Thai office numbers carry extensions, and validating
 * this as a dialable number would reject the format most of these people actually have. `#` is the
 * one extension marker the pattern allows, which is why the placeholder and the hint both use it —
 * an operator's first instinct is "ต่อ 101", and the pattern admits no letters at all.
 */
const PHONE_RE = /^[0-9+\-\s()#.]{6,20}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * ⚠️ THE TWO-PASS GROUPING THAT USED TO LIVE HERE IS NOW `Combobox`'s, and it moved rather than
 * changed: reserved rows still go under `สงวนของระบบ` at the END of the list (the source list is
 * sorted by name, so a single pass drops that heading into the MIDDLE of ตำแหน่ง, directly under
 * an ordinary "ผู้ดูแลระบบ"), and a tombstone still appears only when it is already the value.
 * One copy, because การลงทะเบียน's edit dialog needs the same rule and two copies means one of
 * them gets the next fix. See `ComboboxOption` and `use-staff-options.ts`.
 */
const nameOf = (rows: StaffOption[], id: number) => rows.find((r) => r.id === id)?.name ?? ''

export function StaffFormDialog({
  open,
  onClose,
  mode,
  self = false,
  initial,
  positions,
  departments,
  currentState,
  alert = null,
  emailError = null,
  busy = false,
  onSubmit,
  onResetPassword,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  /** Editing your own row. Replaces the grant fieldset and removes the danger zone. */
  self?: boolean
  /** Starting values. On create the caller supplies the defaults it wants pre-selected. */
  initial: StaffFormValues
  positions: StaffOption[]
  departments: StaffOption[]
  /** Only read when `self` — the status half of the pair the replaced fieldset kept on screen. */
  currentState?: StaffState
  /** A whole-form failure the caller was told about, e.g. an option that vanished mid-edit. */
  alert?: string | null
  /** The 409. It belongs on the FIELD, because the fix is to type a different address. */
  emailError?: string | null
  busy?: boolean
  onSubmit: (values: StaffFormValues, diff: StaffDiff) => void
  /** EDIT, not self. Separate writes to separate endpoints — see the danger zone. */
  onResetPassword?: () => void
  onDelete?: () => void
}) {
  const [values, setValues] = useState<StaffFormValues>(initial)
  const [errors, setErrors] = useState<Partial<Record<keyof StaffFormValues, string>>>({})

  // Reopening for a DIFFERENT row must not inherit the last one's draft or its errors. The dialog
  // is one element reused, so whatever the previous open left behind is what this one starts from
  // unless it is explicitly reset.
  useEffect(() => {
    if (!open) return
    setValues(initial)
    setErrors({})
  }, [open, initial])

  // A 409 arrives after a submit, so it cannot come through `errors` — but it must clear the
  // moment the operator edits the address, exactly like a local error would.
  const [emailDirty, setEmailDirty] = useState(false)
  useEffect(() => {
    if (open) setEmailDirty(false)
  }, [open, emailError])

  const set = <K extends keyof StaffFormValues>(key: K, v: StaffFormValues[K]) => {
    setValues((s) => ({ ...s, [key]: v }))
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e))
  }

  /**
   * ⚠️ TRIMMED BEFORE COMPARING AND BEFORE SENDING, because the DTOs carry `@Transform(trim)`.
   * Without it, retyping a name with a stray space looks like an edit and is sent as one.
   */
  const trimmed = useMemo<StaffFormValues>(
    () => ({
      ...values,
      email: values.email.trim(),
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      phoneNumber: values.phoneNumber.trim(),
    }),
    [values],
  )

  const diff = useMemo<StaffDiff>(() => {
    if (mode !== 'edit') return []
    const out: StaffDiff = []
    const cmp = (label: string, from: string, to: string) => {
      if (from !== to) out.push({ label, from: from || '—', to: to || '—' })
    }
    cmp('ชื่อ', initial.firstName, trimmed.firstName)
    cmp('นามสกุล', initial.lastName, trimmed.lastName)
    cmp('ตำแหน่ง', nameOf(positions, initial.personnelRoleId), nameOf(positions, trimmed.personnelRoleId))
    cmp('กลุ่ม/ฝ่าย', nameOf(departments, initial.departmentId), nameOf(departments, trimmed.departmentId))
    cmp('เบอร์โทรศัพท์', initial.phoneNumber, trimmed.phoneNumber)
    cmp('บทบาท', ROLE_LABEL[initial.role], ROLE_LABEL[trimmed.role])
    cmp(
      'สถานะบัญชี',
      initial.isActive ? 'ใช้งานอยู่' : 'ระงับการใช้งาน',
      trimmed.isActive ? 'ใช้งานอยู่' : 'ระงับการใช้งาน',
    )
    return out
  }, [mode, initial, trimmed, positions, departments])

  function submit() {
    const next: Partial<Record<keyof StaffFormValues, string>> = {}
    if (!trimmed.firstName) next.firstName = 'กรอกชื่อ'
    else if (!trimmed.lastName) next.lastName = 'กรอกนามสกุล'
    else if (mode === 'create' && !EMAIL_RE.test(trimmed.email))
      next.email = 'กรอกอีเมลให้ถูกต้อง เช่น somchai@easybook.local'
    else if (trimmed.phoneNumber && !PHONE_RE.test(trimmed.phoneNumber))
      next.phoneNumber = 'ใช้ได้เฉพาะตัวเลข เว้นวรรค และ + - ( ) # . · ความยาว 6–20 ตัวอักษร'

    setErrors(next)
    if (Object.keys(next).length) return
    onSubmit(trimmed, diff)
  }

  const emailMsg = emailDirty ? undefined : (emailError ?? undefined)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'เพิ่มบัญชีเจ้าหน้าที่' : self ? 'จัดการบัญชีของคุณ' : 'จัดการบัญชี'}
      width={620}
      // Closing mid-write leaves the operator unsure whether the account was created.
      dismissable={!busy}
      footerClassName="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
      footer={
        <>
          <Btn variant="ghost" className="w-full sm:w-auto" disabled={busy} onClick={onClose}>
            ยกเลิก
          </Btn>
          <Btn
            variant="primary"
            className="w-full sm:w-auto"
            disabled={busy}
            aria-busy={busy || undefined}
            aria-label={busy ? 'กำลังบันทึก' : undefined}
            onClick={submit}
          >
            {busy && <Spinner />}
            {mode === 'create' ? 'สร้างบัญชี' : 'บันทึกการแก้ไข'}
          </Btn>
        </>
      }
    >
      <InlineAlert message={alert} />

      <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
        {mode === 'create' ? (
          <FormField
            className="sm:col-span-2"
            label="อีเมล (ใช้เป็นชื่อผู้ใช้)"
            type="email"
            inputMode="email"
            maxLength={254}
            autoComplete="off"
            enterKeyHint="next"
            placeholder="เช่น somchai@easybook.local"
            value={values.email}
            error={errors.email ?? emailMsg}
            onChange={(e) => {
              setEmailDirty(true)
              set('email', e.target.value)
            }}
            hint={
              <span className="leading-[1.55]">
                ที่อยู่นี้เปลี่ยนไม่ได้หลังสร้างบัญชีแล้ว และใช้ซ้ำกับบัญชีอื่นในภายหลังไม่ได้ แม้บัญชีเดิมจะถูกลบไปแล้ว
              </span>
            }
          />
        ) : (
          <div className="sm:col-span-2">
            <p className="form-label m-0">อีเมล (ชื่อผู้ใช้)</p>
            <p className="m-0 break-all text-[15px] text-base-content">{initial.email}</p>
            <p className="mt-1.5 text-[13px] leading-[1.55] text-base-content/70">
              อีเมลของบัญชีที่สร้างแล้วเปลี่ยนไม่ได้ หากต้องใช้ที่อยู่ใหม่ ให้สร้างบัญชีใหม่แล้วลบบัญชีนี้
            </p>
          </div>
        )}

        <FormField
          label="ชื่อ"
          maxLength={120}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="next"
          value={values.firstName}
          error={errors.firstName}
          onChange={(e) => set('firstName', e.target.value)}
        />
        <FormField
          label="นามสกุล"
          maxLength={120}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="next"
          value={values.lastName}
          error={errors.lastName}
          onChange={(e) => set('lastName', e.target.value)}
        />

        {/* ตำแหน่ง before กลุ่ม/ฝ่าย — the Thai civil-service order used everywhere else. */}
        <Combobox
          label="ตำแหน่ง"
          placeholder="เลือกตำแหน่ง"
          options={positions}
          value={values.personnelRoleId}
          onChange={(v) => set('personnelRoleId', v)}
        />
        <Combobox
          label="กลุ่ม/ฝ่าย"
          placeholder="เลือกกลุ่ม/ฝ่าย"
          options={departments}
          value={values.departmentId}
          onChange={(v) => set('departmentId', v)}
        />

        <FormField
          className="sm:col-span-2"
          label={
            <>
              เบอร์โทรศัพท์ <span className="font-normal text-base-content/70">(ไม่บังคับ)</span>
            </>
          }
          type="tel"
          inputMode="tel"
          maxLength={20}
          autoComplete="off"
          enterKeyHint="done"
          placeholder="เช่น 02-123-4567 #101"
          value={values.phoneNumber}
          error={errors.phoneNumber}
          onChange={(e) => set('phoneNumber', e.target.value)}
          hint={
            <span className="leading-[1.55]">
              ใช้ตัวเลข เว้นวรรค และ + - ( ) # . · เบอร์ต่อภายในให้ใช้ # เช่น 02-123-4567 #101
            </span>
          }
        />
      </div>

      {/* ── สิทธิ์การเข้าถึงระบบ ──
          Fenced off from the fields above with a border and a heading, because everything above
          describes a PERSON and everything below grants POWER. Mixing "นามสกุล" and "บทบาท" into
          one flat grid makes the most consequential control on the page look like the fifth text
          box. */}
      {!self && (
        <fieldset className="mt-5 rounded-control border border-base-300 px-4 pb-4 pt-3">
          <legend className="px-1.5 text-[13px] font-semibold text-base-content/80">
            สิทธิ์การเข้าถึงระบบ
          </legend>

          <SelectField
            label="บทบาท"
            value={values.role}
            onChange={(e) => set('role', e.target.value as SystemRole)}
            // Says what the CHOSEN role can do, and updates on change. A select whose three
            // options are three Thai noun phrases tells an operator nothing about what they are
            // handing over; this line is where the actual grant is stated, at the moment it is
            // being made.
            hint={<span className="leading-[1.55]">{ROLE_HINT[values.role]}</span>}
          >
            {ROLE_ORDER.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </SelectField>

          {mode === 'edit' && (
            <div className="mt-4">
              <p className="form-label m-0">สถานะบัญชี</p>
              {/* Two radios, not a switch. A switch states one thing and implies its opposite;
                  suspension is consequential enough that both outcomes should be written down and
                  neither should be the "off" position of the other. */}
              <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="flex cursor-pointer items-start gap-2.5 rounded-control border border-base-300 px-3.5 py-3 transition-colors has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
                  <input
                    type="radio"
                    name="staff-active"
                    className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-[var(--color-primary)]"
                    checked={values.isActive}
                    onChange={() => set('isActive', true)}
                  />
                  <span className="min-w-0">
                    <span className="block text-[14px] font-medium text-base-content">ใช้งานอยู่</span>
                    <span className="block text-[13px] leading-[1.5] text-base-content/70">
                      เข้าสู่ระบบได้ตามปกติ
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-control border border-base-300 px-3.5 py-3 transition-colors has-[:checked]:border-error/50 has-[:checked]:bg-error/5">
                  <input
                    type="radio"
                    name="staff-active"
                    className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-[var(--color-error)]"
                    checked={!values.isActive}
                    onChange={() => set('isActive', false)}
                  />
                  <span className="min-w-0">
                    <span className="block text-[14px] font-medium text-base-content">
                      ระงับการใช้งาน
                    </span>
                    <span className="block text-[13px] leading-[1.5] text-base-content/70">
                      เข้าสู่ระบบไม่ได้ แต่ข้อมูลและประวัติยังอยู่ครบ
                    </span>
                  </span>
                </label>
              </div>
            </div>
          )}
        </fieldset>
      )}

      {/* ⚠️ NO FILL, and that was measured. It was `bg-base-200` for one pass and the contrast
          sweep caught what that did: `.badge-emerald` is `bg-success/10 text-success`, so on a
          base-200 panel the badge composites success/10 over slate-100 instead of over white and
          ใช้งานอยู่ measured 4.37 — a fail, in light theme, on a chip that reads 4.76 everywhere
          else. A tinted chip on a tinted panel is a two-layer alpha stack, and the second layer is
          the one nobody remembers. It also matches the <fieldset> it stands in for, which has a
          border and no fill. */}
      {self && (
        <div className="mt-5 rounded-control border border-base-300 px-4 py-3.5">
          <p className="m-0 text-[13px] font-semibold text-base-content/80">สิทธิ์การเข้าถึงระบบของคุณ</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <RoleChip role={initial.role} />
            {currentState && (
              <Badge tone={STAFF_STATE[currentState].tone}>{STAFF_STATE[currentState].label}</Badge>
            )}
          </div>
          <p className="m-0 mt-2.5 text-[13px] leading-[1.55] text-base-content/70">
            บทบาทและสถานะของตัวเอง เปลี่ยนเองไม่ได้ทุกกรณี · การรีเซ็ตรหัสผ่านและการลบบัญชีของตัวเองก็เช่นกัน
            ต้องให้ผู้ดูแลระบบสูงสุดรายอื่นเป็นผู้ทำ · หากต้องการเปลี่ยนรหัสผ่านของตัวเอง ให้ไปที่หน้าเปลี่ยนรหัสผ่าน
          </p>
        </div>
      )}

      {/* CREATE only. Where the password comes from, said BEFORE the button is pressed — not
          after, when it is too late to be ready to write it down. */}
      {mode === 'create' && (
        <div className="mt-4 flex items-start gap-2.5 rounded-control border border-base-300 bg-base-200 px-3.5 py-3 text-[14px] leading-[1.55] text-base-content/80">
          <svg
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0 text-base-content/70"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
            />
          </svg>
          <p className="m-0">
            ระบบจะสร้างรหัสผ่านชั่วคราวให้อัตโนมัติ และแสดงเพียง <span className="font-semibold">ครั้งเดียว</span>{' '}
            ทันทีที่สร้างบัญชีสำเร็จ · เตรียมช่องทางส่งให้เจ้าตัวไว้ก่อนกดปุ่ม
          </p>
        </div>
      )}

      {/* EDIT only, and never on your own row. A danger zone in the BODY rather than the footer:
          these two are not alternatives to บันทึก, they are separate writes that hit different
          endpoints and take effect immediately whether or not the form above is saved. Putting
          them beside บันทึก would suggest they are part of it. */}
      {mode === 'edit' && !self && (
        <div className="mt-5 rounded-control border border-error/30">
          <p className="m-0 border-b border-error/25 px-4 py-2.5 text-[13px] font-semibold text-error">
            การจัดการบัญชี
          </p>
          <div className="flex flex-col gap-2.5 border-b border-base-300 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 text-[13px] leading-[1.55] text-base-content/80">
              ออกรหัสผ่านชั่วคราวใหม่ · รหัสผ่านเดิมใช้ไม่ได้ทันที และเจ้าตัวต้องตั้งรหัสผ่านใหม่ก่อนใช้งานต่อ
            </p>
            <Btn variant="ghost" className="shrink-0" disabled={busy} onClick={onResetPassword}>
              รีเซ็ตรหัสผ่าน
            </Btn>
          </div>
          <div className="flex flex-col gap-2.5 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 text-[13px] leading-[1.55] text-base-content/80">
              ลบบัญชีออกจากระบบ · ประวัติการทำรายการยังอยู่ครบ แต่อีเมลนี้จะใช้สร้างบัญชีใหม่ไม่ได้อีก
            </p>
            <Btn variant="danger" className="shrink-0" disabled={busy} onClick={onDelete}>
              ลบบัญชี
            </Btn>
          </div>
        </div>
      )}
    </Modal>
  )
}
