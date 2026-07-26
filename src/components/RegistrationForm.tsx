import { useEffect, useId, useState } from 'react'
import type { CreateLineUserRegistration, RegistrationOptions } from '@/lib/api-client'
import { Spinner } from '@/components/Spinner'
import { UI_STRINGS_CLIENT } from '@/constants/ui-strings-client'

const UI = UI_STRINGS_CLIENT.registration

/**
 * Required length of a staff/personnel ID. Exported so tests derive their
 * fixtures from it (`'1'.repeat(ID_COUNT)`) rather than hardcoding a 13-char
 * literal: when this rule last changed out-of-band, the hardcoded fixtures went
 * silently invalid and blocked submission, cascading into unrelated payload
 * assertions. A string dictionary cannot catch that class of drift; this can.
 */
export const ID_COUNT = 13

/**
 * Required length of a phone number. Exported for the same reason as
 * {@link ID_COUNT}: tests derive their fixtures from it (`'0'.repeat(PHONE_COUNT)`)
 * and the copy interpolates it (`UI.phoneLength(PHONE_COUNT)`), so the rule, the
 * message and the fixtures cannot drift apart when this number changes.
 */
export const PHONE_COUNT = 10

export interface RegistrationFormValues {
  firstName: string
  lastName: string
  staffId: string
  phone: string
  departmentId: string
  personnelRoleId: string
}

const EMPTY: RegistrationFormValues = {
  firstName: '',
  lastName: '',
  staffId: '',
  phone: '',
  departmentId: '',
  personnelRoleId: '',
}

type Errors = Partial<Record<keyof RegistrationFormValues, string>>

function validate(f: RegistrationFormValues): Errors {
  const e: Errors = {}
  if (!f.firstName.trim()) e.firstName = UI.firstNameRequired
  else if (/\d/.test(f.firstName)) e.firstName = UI.firstNameNoDigits
  if (!f.lastName.trim()) e.lastName = UI.lastNameRequired
  else if (/\d/.test(f.lastName)) e.lastName = UI.lastNameNoDigits
  if (!f.staffId.trim()) e.staffId = UI.staffIdRequired
  else if (!/^[0-9]+$/.test(f.staffId.trim())) e.staffId = UI.staffIdDigitsOnly
  else if (f.staffId.trim().length !== ID_COUNT) e.staffId = UI.staffIdLength(ID_COUNT)
  if (!f.phone.trim()) e.phone = UI.phoneRequired
  else if (!/^[0-9]+$/.test(f.phone.trim())) e.phone = UI.phoneDigitsOnly
  else if (f.phone.trim().length !== PHONE_COUNT) e.phone = UI.phoneLength(PHONE_COUNT)
  if (!f.departmentId) e.departmentId = UI.departmentRequired
  if (!f.personnelRoleId) e.personnelRoleId = UI.personnelRoleRequired
  return e
}

const INPUT_CLASS =
  'input input-bordered w-full focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60'
const SELECT_CLASS =
  'select select-bordered w-full focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60'

export interface RegistrationFormProps {
  /** `create` = first-time registration; `edit` = PENDING self-edit (pre-filled). */
  mode: 'create' | 'edit'
  /** Loads the dynamic Department / PersonnelRole option lists (real fetch or mock). */
  loadOptions: () => Promise<RegistrationOptions>
  onSubmit: (dto: CreateLineUserRegistration) => void
  submitting: boolean
  serverError: string | null
  displayName?: string
  /** Pre-fill values (edit mode). */
  initial?: RegistrationFormValues
  /** Back-out affordance (edit mode → returns to the Pending screen). */
  onCancel?: () => void
}

/**
 * The Client-Portal registration form. Shown to `UNREGISTERED` users (create) and
 * re-used by `PENDING` users to edit their submission (edit). Department and role
 * are **dynamic dropdowns** populated from the admin-curated option tables via
 * {@link loadOptions} — non-deleted options only. The identity field is the
 * staff/personnel `staffId` (these users are educational personnel/staff, not
 * students).
 *
 * Validates client-side (required + loose phone format) before calling
 * {@link onSubmit} with the id-based DTO; `serverError` surfaces a non-crashing
 * backend failure (e.g. 409 STAFF_ID_TAKEN, 400 invalid option, 403 not editable).
 */
export function RegistrationForm({
  mode,
  loadOptions,
  onSubmit,
  submitting,
  serverError,
  displayName,
  initial,
  onCancel,
}: RegistrationFormProps) {
  const [fields, setFields] = useState<RegistrationFormValues>(initial ?? EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [submitted, setSubmitted] = useState(false)
  const uid = useId()

  const [options, setOptions] = useState<RegistrationOptions | null>(null)
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    setOptionsLoading(true)
    setOptionsError(null)
    loadOptions()
      .then((opts) => {
        if (!alive) return
        setOptions(opts)
        setOptionsLoading(false)
      })
      .catch(() => {
        if (!alive) return
        setOptionsError(UI.optionsError)
        setOptionsLoading(false)
      })
    return () => {
      alive = false
    }
  }, [loadOptions, reloadKey])

  const noOptions =
    !!options && (options.departments.length === 0 || options.personnelRoles.length === 0)

  function set<K extends keyof RegistrationFormValues>(key: K, value: RegistrationFormValues[K]) {
    setFields((prev) => {
      const next = { ...prev, [key]: value }
      // Re-validate live only after the first submit, so we don't nag mid-typing.
      if (submitted) setErrors(validate(next))
      return next
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    const found = validate(fields)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    onSubmit({
      firstName: fields.firstName.trim(),
      lastName: fields.lastName.trim(),
      staffId: fields.staffId.trim(),
      phone: fields.phone.trim(),
      // <select> values are always DOM strings; the backend now types the option
      // ids as integers (`@IsInt()`), so coerce before submitting. `validate`
      // above guarantees a non-empty selection, so `Number()` yields a real
      // integer here and can never emit `NaN` from the placeholder.
      departmentId: Number(fields.departmentId),
      personnelRoleId: Number(fields.personnelRoleId),
    })
  }

  const heading = mode === 'edit' ? UI.editHeading : UI.createHeading
  const submitLabel = mode === 'edit' ? UI.editSubmit : UI.createSubmit
  const submittingLabel = mode === 'edit' ? UI.editSubmitting : UI.createSubmitting

  return (
    <main className="flex min-h-screen justify-center bg-base-200 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-bold text-base-content">{heading}</h1>
          <p className="mt-1 text-sm text-base-content/60">
            {mode === 'edit' ? UI.editIntro : UI.createIntro(displayName)}
          </p>

          {serverError && (
            <div role="alert" className="alert alert-error alert-soft mt-4 text-sm">
              {serverError}
            </div>
          )}

          {/* Options loading / error state — reserve height so the form doesn't jump. */}
          {optionsLoading && (
            <div
              className="mt-6 flex min-h-[18rem] items-center justify-center text-base-content/60"
              data-testid="options-loading"
            >
              <Spinner label={UI.optionsLoading} />
            </div>
          )}

          {!optionsLoading && optionsError && (
            <div className="mt-6 min-h-[18rem]">
              <div role="alert" className="alert alert-error alert-soft text-sm">
                {optionsError}
              </div>
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="btn btn-primary mt-4 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100"
              >
                {UI_STRINGS_CLIENT.common.tryAgain}
              </button>
            </div>
          )}

          {!optionsLoading && !optionsError && options && (
            <>
              {noOptions && (
                <p
                  role="alert"
                  className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
                >
                  {UI.noOptions}
                </p>
              )}

              <form className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    id={`${uid}-first`}
                    label={UI.firstName}
                    value={fields.firstName}
                    onChange={(v) => set('firstName', v)}
                    error={errors.firstName}
                    autoComplete="given-name"
                    disabled={submitting}
                  />
                  <Field
                    id={`${uid}-last`}
                    label={UI.lastName}
                    value={fields.lastName}
                    onChange={(v) => set('lastName', v)}
                    error={errors.lastName}
                    autoComplete="family-name"
                    disabled={submitting}
                  />
                </div>

                <Field
                  id={`${uid}-id`}
                  label={UI.staffId}
                  value={fields.staffId}
                  onChange={(v) => set('staffId', v)}
                  error={errors.staffId}
                  inputMode="text"
                  disabled={submitting}
                />

                <Field
                  id={`${uid}-phone`}
                  label={UI.phone}
                  value={fields.phone}
                  onChange={(v) => set('phone', v)}
                  error={errors.phone}
                  type="tel"
                  autoComplete="tel"
                  disabled={submitting}
                />

                <SelectField
                  id={`${uid}-dept`}
                  label={UI.department}
                  value={fields.departmentId}
                  onChange={(v) => set('departmentId', v)}
                  error={errors.departmentId}
                  options={options.departments}
                  placeholder={UI.departmentPlaceholder}
                  disabled={submitting}
                />

                <SelectField
                  id={`${uid}-role`}
                  label={UI.personnelRole}
                  value={fields.personnelRoleId}
                  onChange={(v) => set('personnelRoleId', v)}
                  error={errors.personnelRoleId}
                  options={options.personnelRoles}
                  placeholder={UI.personnelRolePlaceholder}
                  disabled={submitting}
                />

                <div className="flex gap-3 pt-1">
                  {mode === 'edit' && onCancel && (
                    <button
                      type="button"
                      onClick={onCancel}
                      disabled={submitting}
                      className="btn btn-outline flex-1 focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {UI.cancel}
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={submitting || noOptions}
                    className="btn btn-primary flex-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100"
                  >
                    {submitting && <Spinner label={submittingLabel} className="text-primary-content" />}
                    {submitting ? submittingLabel : submitLabel}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = 'text',
  autoComplete,
  inputMode,
  disabled,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  type?: string
  autoComplete?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  disabled?: boolean
}) {
  const errorId = `${id}-error`
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        inputMode={inputMode}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`${INPUT_CLASS} ${error ? 'input-error' : ''}`}
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-error">
          {error}
        </p>
      )}
    </div>
  )
}

function SelectField({
  id,
  label,
  value,
  onChange,
  error,
  options,
  placeholder,
  disabled,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  options: readonly { id: number; name: string }[]
  placeholder: string
  disabled?: boolean
}) {
  const errorId = `${id}-error`
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`${SELECT_CLASS} ${error ? 'select-error' : ''}`}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-error">
          {error}
        </p>
      )}
    </div>
  )
}
