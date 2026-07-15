import { useEffect, useId, useState } from 'react'
import type { CreateLineUserRegistration, RegistrationOptions } from '@/lib/api-client'
import { Spinner } from '@/components/Spinner'

/** Loose, Thai-friendly phone shape — mirrors the backend DTO's `phone` regex. */
const PHONE_RE = /^[0-9+\-() ]{6,20}$/
/** Staff/personnel ID: non-empty, up to 50 chars (matches the backend DTO). */
const ID_MAX = 50

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
  if (!f.firstName.trim()) e.firstName = 'First name is required.'
  if (!f.lastName.trim()) e.lastName = 'Last name is required.'
  if (!f.staffId.trim()) e.staffId = 'Staff ID is required.'
  else if (f.staffId.trim().length > ID_MAX) e.staffId = `Staff ID must be ${ID_MAX} characters or fewer.`
  if (!f.phone.trim()) e.phone = 'Phone number is required.'
  else if (!PHONE_RE.test(f.phone.trim()))
    e.phone = 'Enter a valid phone number (digits, spaces, + - ( ) only).'
  if (!f.departmentId) e.departmentId = 'Please select a department.'
  if (!f.personnelRoleId) e.personnelRoleId = 'Please select a role.'
  return e
}

const INPUT_CLASS =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
const INPUT_ERR_CLASS = 'border-red-400 focus:border-red-500 focus:ring-red-500 dark:border-red-500/60'

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
        setOptionsError('We could not load the registration options. Please try again.')
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
      departmentId: fields.departmentId,
      personnelRoleId: fields.personnelRoleId,
    })
  }

  const heading = mode === 'edit' ? 'Edit your registration' : 'Complete your registration'
  const submitLabel = mode === 'edit' ? 'Save changes' : 'Submit registration'
  const submittingLabel = mode === 'edit' ? 'Saving…' : 'Submitting…'

  return (
    <main className="flex min-h-screen justify-center bg-slate-50 px-4 py-8 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{heading}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {mode === 'edit'
              ? 'Update your details below and re-submit for approval.'
              : `${displayName ? `Hi ${displayName}! ` : ''}Tell us who you are so an administrator can approve your access.`}
          </p>

          {serverError && (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400"
            >
              {serverError}
            </p>
          )}

          {/* Options loading / error state — reserve height so the form doesn't jump. */}
          {optionsLoading && (
            <div
              className="mt-6 flex min-h-[18rem] items-center justify-center text-slate-500 dark:text-slate-400"
              data-testid="options-loading"
            >
              <Spinner label="Loading registration options…" />
            </div>
          )}

          {!optionsLoading && optionsError && (
            <div className="mt-6 min-h-[18rem]">
              <p
                role="alert"
                className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400"
              >
                {optionsError}
              </p>
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
              >
                Try again
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
                  Registration is temporarily unavailable — no options have been configured yet.
                  Please contact the administration.
                </p>
              )}

              <form className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    id={`${uid}-first`}
                    label="First name"
                    value={fields.firstName}
                    onChange={(v) => set('firstName', v)}
                    error={errors.firstName}
                    autoComplete="given-name"
                    disabled={submitting}
                  />
                  <Field
                    id={`${uid}-last`}
                    label="Last name"
                    value={fields.lastName}
                    onChange={(v) => set('lastName', v)}
                    error={errors.lastName}
                    autoComplete="family-name"
                    disabled={submitting}
                  />
                </div>

                <Field
                  id={`${uid}-id`}
                  label="Staff ID"
                  value={fields.staffId}
                  onChange={(v) => set('staffId', v)}
                  error={errors.staffId}
                  inputMode="text"
                  disabled={submitting}
                />

                <Field
                  id={`${uid}-phone`}
                  label="Phone"
                  value={fields.phone}
                  onChange={(v) => set('phone', v)}
                  error={errors.phone}
                  type="tel"
                  autoComplete="tel"
                  disabled={submitting}
                />

                <SelectField
                  id={`${uid}-dept`}
                  label="Department"
                  value={fields.departmentId}
                  onChange={(v) => set('departmentId', v)}
                  error={errors.departmentId}
                  options={options.departments}
                  placeholder="Select a department"
                  disabled={submitting}
                />

                <SelectField
                  id={`${uid}-role`}
                  label="Role"
                  value={fields.personnelRoleId}
                  onChange={(v) => set('personnelRoleId', v)}
                  error={errors.personnelRoleId}
                  options={options.personnelRoles}
                  placeholder="Select a role"
                  disabled={submitting}
                />

                <div className="flex gap-3 pt-1">
                  {mode === 'edit' && onCancel && (
                    <button
                      type="button"
                      onClick={onCancel}
                      disabled={submitting}
                      className="flex-1 rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={submitting || noOptions}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-60 dark:focus-visible:ring-offset-slate-900"
                  >
                    {submitting && <Spinner label={submittingLabel} className="text-white" />}
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
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
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
        className={`${INPUT_CLASS} ${error ? INPUT_ERR_CLASS : ''}`}
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
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
  options: readonly { id: string; name: string }[]
  placeholder: string
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
        className={`${INPUT_CLASS} ${error ? INPUT_ERR_CLASS : ''}`}
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
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
