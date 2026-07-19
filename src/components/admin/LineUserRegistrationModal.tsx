import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  ApiError,
  listDepartments,
  listPersonnelRoles,
  patchLineUserRegistration,
  type Department,
  type LineUser,
  type PersonnelRole,
} from '@/lib/api-client'
import { Spinner } from '@/components/Spinner'
import { ID_COUNT, PHONE_COUNT } from '@/components/RegistrationForm'
import { UI_STRINGS } from '@/constants/ui-strings-backend'

const LU = UI_STRINGS.lineUsers
const UI = LU.edit
/** Field labels shared with the read-only registration block (same surface). */
const REG = LU.registration

/** The `{ id, name }` shape both option lists share once reserved rows are dropped. */
type Option = Pick<Department | PersonnelRole, 'id' | 'name'>

interface Fields {
  firstName: string
  lastName: string
  staffId: string
  phone: string
  /** `<select>` values are DOM strings; coerced with `Number()` on submit. */
  departmentId: string
  personnelRoleId: string
}

type Errors = Partial<Record<keyof Fields, string>>

export interface LineUserRegistrationModalProps {
  /** The row being edited. Its `registration` is non-null (the caller gates on it). */
  user: LineUser
  onClose: () => void
  /** 200 — hand back the updated user so the caller patches the row in place. */
  onSaved: (updated: LineUser) => void
  /** 401 — the session died; bounce to login (never for a 400/409/404). */
  onSessionExpired: () => void
  /** 404 — the user/registration is gone; surface a row notice and close. */
  onRowGone: () => void
}

/** Only active, non-reserved rows are selectable — a LINE end-user must never be
 *  assigned a system-reserved (developer) option, and the backend 400s one anyway. */
function selectable(options: (Department | PersonnelRole)[]): Option[] {
  return options.filter((o) => !o.isSystemReserved).map((o) => ({ id: o.id, name: o.name }))
}

/**
 * Keep the currently-assigned option visible even if it has since been
 * soft-deleted or reserved (so the select doesn't silently blank to the
 * placeholder and invite an accidental change). It is appended DISABLED, and
 * `validate` forces an active re-pick — mirroring `StaffFormModal.withAssigned`.
 */
function withAssigned(options: Option[], assigned: Option): Option[] {
  if (options.some((o) => o.id === assigned.id)) return options
  return [...options, assigned]
}

function isStale(active: Option[], assigned: Option, selectedId: string): boolean {
  if (String(assigned.id) !== selectedId) return false
  return !active.some((o) => o.id === assigned.id)
}

/**
 * Admin edit of a LINE user's registration, in an accessible modal. Re-submits
 * all six fields (`firstName`, `lastName`, `staffId`, `phone`, `departmentId`,
 * `personnelRoleId`) via `patchLineUserRegistration`. `lineUserId` is immutable
 * and never rendered.
 *
 * Department / Role are dynamic selects fed by the admin option lists
 * (`listDepartments` / `listPersonnelRoles`), filtered to active + non-reserved.
 * Client validation mirrors the client `RegistrationForm` (reusing its exported
 * `ID_COUNT` / `PHONE_COUNT`); the server remains the source of truth. Backend
 * 409 / 400 render inline; 404 closes into a row notice; only 401 logs out.
 */
export function LineUserRegistrationModal({
  user,
  onClose,
  onSaved,
  onSessionExpired,
  onRowGone,
}: LineUserRegistrationModalProps) {
  const reg = user.registration
  const [fields, setFields] = useState<Fields>(() => ({
    firstName: reg?.firstName ?? '',
    lastName: reg?.lastName ?? '',
    staffId: reg?.staffId ?? '',
    phone: reg?.phone ?? '',
    departmentId: reg ? String(reg.departmentId) : '',
    personnelRoleId: reg ? String(reg.personnelRoleId) : '',
  }))
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)

  const [departments, setDepartments] = useState<Department[] | null>(null)
  const [personnelRoles, setPersonnelRoles] = useState<PersonnelRole[] | null>(null)
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    setOptionsLoading(true)
    setOptionsError(null)
    Promise.all([listDepartments(), listPersonnelRoles()])
      .then(([depts, roles]) => {
        if (!alive) return
        setDepartments(depts)
        setPersonnelRoles(roles)
        setOptionsLoading(false)
      })
      .catch(() => {
        if (!alive) return
        setOptionsError(UI.optionsFailed)
        setOptionsLoading(false)
      })
    return () => {
      alive = false
    }
  }, [reloadKey])

  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [optionsLoading])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const activeDepartments = selectable(departments ?? [])
  const activeRoles = selectable(personnelRoles ?? [])
  const assignedDept: Option = { id: reg?.departmentId ?? -1, name: reg?.department ?? '' }
  const assignedRole: Option = { id: reg?.personnelRoleId ?? -1, name: reg?.personnelRole ?? '' }
  const deptOptions = withAssigned(activeDepartments, assignedDept)
  const roleOptions = withAssigned(activeRoles, assignedRole)

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function validate(): Errors {
    const e: Errors = {}
    const first = fields.firstName.trim()
    const last = fields.lastName.trim()
    const staff = fields.staffId.trim()
    const phone = fields.phone.trim()
    if (!first) e.firstName = UI.firstNameRequired
    else if (/\d/.test(first)) e.firstName = UI.firstNameNoDigits
    if (!last) e.lastName = UI.lastNameRequired
    else if (/\d/.test(last)) e.lastName = UI.lastNameNoDigits
    if (!staff) e.staffId = UI.staffIdRequired
    else if (!/^[0-9]+$/.test(staff)) e.staffId = UI.staffIdDigitsOnly
    else if (staff.length !== ID_COUNT) e.staffId = UI.staffIdLength(ID_COUNT)
    if (!phone) e.phone = UI.phoneRequired
    else if (!/^[0-9]+$/.test(phone)) e.phone = UI.phoneDigitsOnly
    else if (phone.length !== PHONE_COUNT) e.phone = UI.phoneLength(PHONE_COUNT)
    if (!fields.departmentId) e.departmentId = UI.departmentRequired
    else if (isStale(activeDepartments, assignedDept, fields.departmentId))
      e.departmentId = UI.departmentRemoved
    if (!fields.personnelRoleId) e.personnelRoleId = UI.roleRequired
    else if (isStale(activeRoles, assignedRole, fields.personnelRoleId))
      e.personnelRoleId = UI.roleRemoved
    return e
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setServerError(null)
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSubmitting(true)
    try {
      // `<select>` values are DOM strings but the backend types both option ids as
      // `@IsInt()` — a string "3" is a 400. `validate` guarantees a non-empty
      // selection, so `Number()` can never emit NaN from the placeholder.
      const updated = await patchLineUserRegistration(user.id, {
        firstName: fields.firstName.trim(),
        lastName: fields.lastName.trim(),
        staffId: fields.staffId.trim(),
        phone: fields.phone.trim(),
        departmentId: Number(fields.departmentId),
        personnelRoleId: Number(fields.personnelRoleId),
      })
      onSaved(updated)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        onSessionExpired()
        return
      }
      if (err instanceof ApiError && err.status === 404) {
        onRowGone()
        return
      }
      setServerError(
        err instanceof ApiError && err.status === 409
          ? UI.staffIdTaken
          : err instanceof ApiError && err.status === 400
            ? UI.invalid
            : UI.saveFailed,
      )
    } finally {
      setSubmitting(false)
    }
  }

  const titleId = 'line-user-registration-title'

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label={UI_STRINGS.common.closeDialog}
        className="absolute inset-0 bg-slate-900/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl dark:bg-slate-900"
      >
        <h2 id={titleId} className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {UI.title}
        </h2>
        <p className="mb-4 mt-1 text-sm text-slate-500 dark:text-slate-400">{UI.intro}</p>

        {/* Reserve height so the dialog doesn't jump when the options land. */}
        {optionsLoading && (
          <div
            className="flex min-h-[22rem] items-center justify-center text-slate-500 dark:text-slate-400"
            data-testid="registration-options-loading"
          >
            <Spinner label={UI.optionsLoading} />
          </div>
        )}

        {!optionsLoading && optionsError && (
          <div className="min-h-[22rem]">
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400"
            >
              {optionsError}
            </p>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {UI_STRINGS.common.tryAgain}
            </button>
          </div>
        )}

        {!optionsLoading && !optionsError && (
          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            {serverError && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400"
              >
                {serverError}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label={UI.firstName} htmlFor="lur-first" error={errors.firstName}>
                <input
                  ref={firstFieldRef}
                  id="lur-first"
                  value={fields.firstName}
                  onChange={(e) => set('firstName', e.target.value)}
                  autoComplete="given-name"
                  disabled={submitting}
                  aria-invalid={errors.firstName ? true : undefined}
                  aria-describedby={errors.firstName ? 'lur-first-error' : undefined}
                  className={inputClass(errors.firstName)}
                />
              </Field>
              <Field label={UI.lastName} htmlFor="lur-last" error={errors.lastName}>
                <input
                  id="lur-last"
                  value={fields.lastName}
                  onChange={(e) => set('lastName', e.target.value)}
                  autoComplete="family-name"
                  disabled={submitting}
                  aria-invalid={errors.lastName ? true : undefined}
                  aria-describedby={errors.lastName ? 'lur-last-error' : undefined}
                  className={inputClass(errors.lastName)}
                />
              </Field>
            </div>

            <Field label={REG.staffId} htmlFor="lur-staff" error={errors.staffId}>
              <input
                id="lur-staff"
                value={fields.staffId}
                onChange={(e) => set('staffId', e.target.value)}
                inputMode="numeric"
                disabled={submitting}
                aria-invalid={errors.staffId ? true : undefined}
                aria-describedby={errors.staffId ? 'lur-staff-error' : undefined}
                className={inputClass(errors.staffId)}
              />
            </Field>

            <Field label={REG.phone} htmlFor="lur-phone" error={errors.phone}>
              <input
                id="lur-phone"
                type="tel"
                value={fields.phone}
                onChange={(e) => set('phone', e.target.value)}
                inputMode="numeric"
                autoComplete="tel"
                disabled={submitting}
                aria-invalid={errors.phone ? true : undefined}
                aria-describedby={errors.phone ? 'lur-phone-error' : undefined}
                className={inputClass(errors.phone)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <OptionSelect
                id="lur-department"
                label={REG.department}
                value={fields.departmentId}
                onChange={(v) => set('departmentId', v)}
                options={deptOptions}
                activeOptions={activeDepartments}
                placeholder={UI.departmentPlaceholder}
                error={errors.departmentId}
                disabled={submitting}
              />
              <OptionSelect
                id="lur-role"
                label={REG.role}
                value={fields.personnelRoleId}
                onChange={(v) => set('personnelRoleId', v)}
                options={roleOptions}
                activeOptions={activeRoles}
                placeholder={UI.rolePlaceholder}
                error={errors.personnelRoleId}
                disabled={submitting}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {UI_STRINGS.common.cancel}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60"
              >
                {submitting ? <Spinner label={UI_STRINGS.common.saving} className="text-white" /> : UI_STRINGS.common.save}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function inputClass(error?: string): string {
  const base =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
  const err = 'border-red-400 focus:border-red-500 focus:ring-red-500 dark:border-red-500/60'
  return error ? `${base} ${err}` : base
}

function OptionSelect({
  id,
  label,
  value,
  onChange,
  options,
  activeOptions,
  placeholder,
  error,
  disabled,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  /** Active options plus, if it is stale, the currently assigned one (disabled). */
  options: Option[]
  /** Active options only — anything outside this list renders as removed. */
  activeOptions: Option[]
  placeholder: string
  error?: string
  disabled?: boolean
}) {
  const errorId = `${id}-error`
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={inputClass(error)}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => {
          const removed = !activeOptions.some((a) => a.id === o.id)
          return (
            // A removed/reserved option the row still points at stays visible (so
            // the row reads correctly) but disabled, so it can never be re-picked.
            <option key={o.id} value={o.id} disabled={removed}>
              {removed ? UI.removedOption(o.name) : o.name}
            </option>
          )
        })}
      </select>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  children: ReactNode
}) {
  const errorId = `${htmlFor}-error`
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {label}
      </label>
      {children}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
