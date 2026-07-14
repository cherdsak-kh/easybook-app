import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  ApiError,
  createSystemUser,
  patchSystemUser,
  type SystemRole,
  type SystemUser,
} from '@/lib/api-client'
import { Spinner } from '@/components/Spinner'

const ROLES: readonly SystemRole[] = ['STAFF', 'ADMIN', 'SUPER_ADMIN']
const ROLE_LABEL: Record<SystemRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  STAFF: 'Staff',
}

export interface StaffFormModalProps {
  mode: 'create' | 'edit'
  /** The row being edited (edit mode only). */
  user?: SystemUser
  /** Whether the current admin may set the `role` field (SUPER_ADMIN, and not on self). */
  canEditRole: boolean
  onClose: () => void
  onSaved: (user: SystemUser) => void
}

interface Fields {
  email: string
  password: string
  firstName: string
  lastName: string
  role: SystemRole
  position: string
  department: string
  phoneNumber: string
}

function initialFields(user?: SystemUser): Fields {
  return {
    email: user?.email ?? '',
    password: '',
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    role: user?.role ?? 'STAFF',
    position: user?.position ?? '',
    department: user?.department ?? '',
    phoneNumber: user?.phoneNumber ?? '',
  }
}

/** Map a mutation error status to a friendly message. */
function saveErrorMessage(status: number): string {
  if (status === 403) return 'You do not have permission to perform this action.'
  if (status === 409) return 'That email is already in use.'
  if (status === 404) return 'That staff member no longer exists.'
  if (status === 400) return 'Please check the highlighted fields and try again.'
  return 'Could not save. Please try again.'
}

/**
 * Create/edit form for a staff (`SystemUser`) account. Presented as an
 * accessible modal dialog. Passwords are set only at creation (the backend
 * never accepts a password on patch), and the `role` field is shown only when
 * the current admin is permitted to set it.
 */
export function StaffFormModal({
  mode,
  user,
  canEditRole,
  onClose,
  onSaved,
}: StaffFormModalProps) {
  const [fields, setFields] = useState<Fields>(() => initialFields(user))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      let saved: SystemUser
      if (mode === 'create') {
        saved = await createSystemUser({
          email: fields.email.trim(),
          password: fields.password,
          firstName: fields.firstName.trim(),
          lastName: fields.lastName.trim(),
          role: fields.role,
          position: fields.position.trim(),
          department: fields.department.trim(),
          phoneNumber: fields.phoneNumber.trim() || undefined,
        })
      } else {
        saved = await patchSystemUser(user!.id, {
          firstName: fields.firstName.trim(),
          lastName: fields.lastName.trim(),
          position: fields.position.trim(),
          department: fields.department.trim(),
          phoneNumber: fields.phoneNumber.trim() || null,
          ...(canEditRole ? { role: fields.role } : {}),
        })
      }
      onSaved(saved)
    } catch (err: unknown) {
      setError(err instanceof ApiError ? saveErrorMessage(err.status) : 'Could not save. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const titleId = 'staff-form-title'

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-slate-900/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl dark:bg-slate-900"
      >
        <h2 id={titleId} className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">
          {mode === 'create' ? 'Add staff member' : 'Edit staff member'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400"
            >
              {error}
            </p>
          )}

          {mode === 'create' && (
            <Field label="Email" htmlFor="sf-email">
              <input
                ref={firstFieldRef}
                id="sf-email"
                type="email"
                required
                autoComplete="off"
                value={fields.email}
                onChange={(e) => set('email', e.target.value)}
                className={inputClass}
              />
            </Field>
          )}

          {mode === 'create' && (
            <Field label="Temporary password" htmlFor="sf-password">
              <input
                id="sf-password"
                type="password"
                required
                autoComplete="new-password"
                value={fields.password}
                onChange={(e) => set('password', e.target.value)}
                className={inputClass}
              />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" htmlFor="sf-first">
              <input
                ref={mode === 'edit' ? firstFieldRef : undefined}
                id="sf-first"
                required
                value={fields.firstName}
                onChange={(e) => set('firstName', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Last name" htmlFor="sf-last">
              <input
                id="sf-last"
                required
                value={fields.lastName}
                onChange={(e) => set('lastName', e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Position" htmlFor="sf-position">
              <input
                id="sf-position"
                required
                value={fields.position}
                onChange={(e) => set('position', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Department" htmlFor="sf-department">
              <input
                id="sf-department"
                required
                value={fields.department}
                onChange={(e) => set('department', e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Phone number (optional)" htmlFor="sf-phone">
            <input
              id="sf-phone"
              value={fields.phoneNumber}
              onChange={(e) => set('phoneNumber', e.target.value)}
              className={inputClass}
            />
          </Field>

          {canEditRole && (
            <Field label="Role" htmlFor="sf-role">
              <select
                id="sf-role"
                value={fields.role}
                onChange={(e) => set('role', e.target.value as SystemRole)}
                className={inputClass}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60"
            >
              {submitting ? <Spinner label="Saving…" /> : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {label}
      </label>
      {children}
    </div>
  )
}
