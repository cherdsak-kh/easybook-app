import { useId, useState } from 'react'
import type { CreateLineUserRegistration } from '@/lib/api-client'
import { Spinner } from '@/components/Spinner'

/** The two roles the portal offers. `role` is free text on the backend; these are
 * the controlled choices, and they also drive the dynamic ID-field label. */
const ROLES = ['Student', 'Staff'] as const
type Role = (typeof ROLES)[number]

/** Loose, Thai-friendly phone shape — mirrors the backend DTO's `phone` regex. */
const PHONE_RE = /^[0-9+\-() ]{6,20}$/
/** University ID: alphanumeric (+ dash), 3–50 chars. */
const ID_RE = /^[A-Za-z0-9-]{3,50}$/

interface Fields {
  firstName: string
  lastName: string
  role: Role
  studentStaffId: string
  phone: string
  department: string
}

const EMPTY: Fields = {
  firstName: '',
  lastName: '',
  role: 'Student',
  studentStaffId: '',
  phone: '',
  department: '',
}

type Errors = Partial<Record<keyof Fields, string>>

function validate(f: Fields): Errors {
  const e: Errors = {}
  if (!f.firstName.trim()) e.firstName = 'First name is required.'
  if (!f.lastName.trim()) e.lastName = 'Last name is required.'
  const idLabel = f.role === 'Staff' ? 'Staff ID' : 'Student ID'
  if (!f.studentStaffId.trim()) e.studentStaffId = `${idLabel} is required.`
  else if (!ID_RE.test(f.studentStaffId.trim()))
    e.studentStaffId = `${idLabel} must be 3–50 letters, numbers, or dashes.`
  if (!f.phone.trim()) e.phone = 'Phone number is required.'
  else if (!PHONE_RE.test(f.phone.trim()))
    e.phone = 'Enter a valid phone number (digits, spaces, + - ( ) only).'
  if (!f.department.trim()) e.department = 'Department is required.'
  return e
}

const INPUT_CLASS =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
const INPUT_ERR_CLASS = 'border-red-400 focus:border-red-500 focus:ring-red-500 dark:border-red-500/60'

/**
 * The Client-Portal registration form (shown to `UNREGISTERED` users). Collects
 * the personnel identity the backend needs to move the user to `PENDING`. The ID
 * field's label switches between "Student ID" / "Staff ID" by the selected role,
 * but both map to the single `studentStaffId` DTO field.
 *
 * Validates client-side (required + loose ID/phone format) before calling
 * {@link onSubmit}; `serverError` surfaces a non-crashing backend failure.
 */
export function RegistrationForm({
  onSubmit,
  submitting,
  serverError,
  displayName,
}: {
  onSubmit: (dto: CreateLineUserRegistration) => void
  submitting: boolean
  serverError: string | null
  displayName?: string
}) {
  const [fields, setFields] = useState<Fields>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [submitted, setSubmitted] = useState(false)
  const uid = useId()

  const idLabel = fields.role === 'Staff' ? 'Staff ID' : 'Student ID'

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
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
      studentStaffId: fields.studentStaffId.trim(),
      phone: fields.phone.trim(),
      department: fields.department.trim(),
      role: fields.role,
    })
  }

  return (
    <main className="flex min-h-screen justify-center bg-slate-50 px-4 py-8 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Complete your registration
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {displayName ? `Hi ${displayName}! ` : ''}Tell us who you are so an administrator can
            approve your access.
          </p>

          {serverError && (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400"
            >
              {serverError}
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

            <div>
              <label
                htmlFor={`${uid}-role`}
                className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Role
              </label>
              <select
                id={`${uid}-role`}
                value={fields.role}
                onChange={(e) => set('role', e.target.value as Role)}
                disabled={submitting}
                className={INPUT_CLASS}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <Field
              id={`${uid}-id`}
              label={idLabel}
              value={fields.studentStaffId}
              onChange={(v) => set('studentStaffId', v)}
              error={errors.studentStaffId}
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

            <Field
              id={`${uid}-dept`}
              label="Department"
              value={fields.department}
              onChange={(v) => set('department', v)}
              error={errors.department}
              autoComplete="organization"
              disabled={submitting}
            />

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-60 dark:focus-visible:ring-offset-slate-900"
            >
              {submitting && <Spinner label="Submitting…" className="text-white" />}
              {submitting ? 'Submitting…' : 'Submit registration'}
            </button>
          </form>
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
