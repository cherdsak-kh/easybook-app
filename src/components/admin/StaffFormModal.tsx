import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  ApiError,
  createSystemUser,
  listDepartments,
  listPersonnelRoles,
  patchSystemUser,
  type Department,
  type PersonnelRole,
  type SystemRole,
  type SystemUser,
  type SystemUserWithTemporaryPassword,
} from '@/lib/api-client'
import { Spinner } from '@/components/Spinner'
import { UI_STRINGS } from '@/constants/ui-strings'

const UI = UI_STRINGS.staff.form
const ROLES: readonly SystemRole[] = ['STAFF', 'ADMIN', 'SUPER_ADMIN']

/** The `{ id, name }` shape both option lists share. */
type Option = Pick<Department | PersonnelRole, 'id' | 'name'>

export interface StaffFormModalProps {
  mode: 'create' | 'edit'
  /** The row being edited (edit mode only). */
  user?: SystemUser
  /** Whether the current admin may set the `role` field (SUPER_ADMIN, and not on self). */
  canEditRole: boolean
  onClose: () => void
  /**
   * Create yields a `SystemUserWithTemporaryPassword` (the one-time plaintext);
   * edit yields a plain `SystemUser`. The caller discriminates on
   * `'temporaryPassword' in saved`.
   */
  onSaved: (saved: SystemUser | SystemUserWithTemporaryPassword) => void
}

interface Fields {
  email: string
  firstName: string
  lastName: string
  role: SystemRole
  /** `<select>` values are DOM strings; coerced with `Number()` on submit. */
  departmentId: string
  personnelRoleId: string
  phoneNumber: string
}

function initialFields(user?: SystemUser): Fields {
  return {
    email: user?.email ?? '',
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    role: user?.role ?? 'STAFF',
    departmentId: user ? String(user.department.id) : '',
    personnelRoleId: user ? String(user.personnelRole.id) : '',
    phoneNumber: user?.phoneNumber ?? '',
  }
}

/** Map a mutation error status to a friendly message. */
function saveErrorMessage(status: number): string {
  if (status === 403) return UI.forbidden
  if (status === 409) return UI.emailTaken
  if (status === 404) return UI.gone
  if (status === 400) return UI.invalid
  return UI.saveFailed
}

/**
 * Merge the staff member's currently assigned option into the active list.
 *
 * The list endpoints return ACTIVE options only, but an assignment survives its
 * option being soft-deleted (the read embed still resolves the name — the
 * backend's deliberate read-ignores-`deletedAt` asymmetry). Without this, a
 * stale assignment would fall out of the `<select>` and silently reset itself to
 * the placeholder — AC-F2's crash/blank path. Instead we append it as a DISABLED
 * option so the name still displays, and `validate` forces an active pick before
 * save.
 */
function withAssigned(options: Option[], assigned?: Option): Option[] {
  if (!assigned || options.some((o) => o.id === assigned.id)) return options
  return [...options, assigned]
}

function isStale(options: Option[], assigned: Option | undefined, selectedId: string): boolean {
  if (!assigned || String(assigned.id) !== selectedId) return false
  return !options.some((o) => o.id === assigned.id)
}

/**
 * Create/edit form for a staff (`SystemUser`) account, in an accessible modal.
 *
 * Department and Position are **dynamic selects** fed by the admin-curated
 * option tables (`GET /departments`, `GET /personnel-roles`) — the same lists
 * the Registration Options page manages. The wire field is `personnelRole`; the
 * UI label stays **"Position"**.
 *
 * There is no password input: the server issues a temporary password on create
 * and returns it once (the caller shows it).
 */
export function StaffFormModal({ mode, user, canEditRole, onClose, onSaved }: StaffFormModalProps) {
  const [fields, setFields] = useState<Fields>(() => initialFields(user))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof Fields, string>>>({})
  const firstFieldRef = useRef<HTMLInputElement>(null)

  const [departments, setDepartments] = useState<Option[] | null>(null)
  const [personnelRoles, setPersonnelRoles] = useState<Option[] | null>(null)
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

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((f) => ({ ...f, [key]: value }))
    setFieldErrors((e) => ({ ...e, [key]: undefined }))
  }

  const activeDepartments = departments ?? []
  const activeRoles = personnelRoles ?? []
  const deptOptions = withAssigned(activeDepartments, user?.department)
  const roleOptions = withAssigned(activeRoles, user?.personnelRole)

  function validate(): boolean {
    const errs: Partial<Record<keyof Fields, string>> = {}
    if (!fields.departmentId) errs.departmentId = UI.departmentRequired
    else if (isStale(activeDepartments, user?.department, fields.departmentId))
      errs.departmentId = UI.departmentRemoved
    if (!fields.personnelRoleId) errs.personnelRoleId = UI.positionRequired
    else if (isStale(activeRoles, user?.personnelRole, fields.personnelRoleId))
      errs.personnelRoleId = UI.positionRemoved
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!validate()) return
    setSubmitting(true)
    try {
      // `<select>` values are DOM strings but the backend types both option ids
      // as `@IsInt()` with NO implicit conversion — a string "3" is a 400. Coerce
      // here. `validate()` above guarantees a non-empty selection, so `Number()`
      // can never produce NaN from the placeholder.
      const departmentId = Number(fields.departmentId)
      const personnelRoleId = Number(fields.personnelRoleId)

      let saved: SystemUser | SystemUserWithTemporaryPassword
      if (mode === 'create') {
        saved = await createSystemUser({
          email: fields.email.trim(),
          firstName: fields.firstName.trim(),
          lastName: fields.lastName.trim(),
          role: fields.role,
          departmentId,
          personnelRoleId,
          phoneNumber: fields.phoneNumber.trim() || undefined,
        })
      } else {
        saved = await patchSystemUser(user!.id, {
          firstName: fields.firstName.trim(),
          lastName: fields.lastName.trim(),
          departmentId,
          personnelRoleId,
          phoneNumber: fields.phoneNumber.trim() || null,
          ...(canEditRole ? { role: fields.role } : {}),
        })
      }
      onSaved(saved)
    } catch (err: unknown) {
      setError(err instanceof ApiError ? saveErrorMessage(err.status) : UI.saveFailed)
    } finally {
      setSubmitting(false)
    }
  }

  const titleId = 'staff-form-title'

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
        <h2 id={titleId} className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">
          {mode === 'create' ? UI.addTitle : UI.editTitle}
        </h2>

        {/* Reserve height so the dialog doesn't jump when the options land. */}
        {optionsLoading && (
          <div
            className="flex min-h-[20rem] items-center justify-center text-slate-500 dark:text-slate-400"
            data-testid="staff-options-loading"
          >
            <Spinner label={UI.optionsLoading} />
          </div>
        )}

        {!optionsLoading && optionsError && (
          <div className="min-h-[20rem]">
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
              <>
                <Field label={UI.email} htmlFor="sf-email">
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
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                  {UI.tempPasswordNote}
                </p>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label={UI.firstName} htmlFor="sf-first">
                <input
                  ref={mode === 'edit' ? firstFieldRef : undefined}
                  id="sf-first"
                  required
                  value={fields.firstName}
                  onChange={(e) => set('firstName', e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label={UI.lastName} htmlFor="sf-last">
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
              {/* Wire field `personnelRole`; the UI label stays "Position". */}
              <OptionSelect
                id="sf-position"
                label={UI.position}
                value={fields.personnelRoleId}
                onChange={(v) => set('personnelRoleId', v)}
                options={roleOptions}
                activeOptions={activeRoles}
                placeholder={UI.positionPlaceholder}
                error={fieldErrors.personnelRoleId}
              />
              <OptionSelect
                id="sf-department"
                label={UI.department}
                value={fields.departmentId}
                onChange={(v) => set('departmentId', v)}
                options={deptOptions}
                activeOptions={activeDepartments}
                placeholder={UI.departmentPlaceholder}
                error={fieldErrors.departmentId}
              />
            </div>

            <Field label={UI.phoneNumber} htmlFor="sf-phone">
              <input
                id="sf-phone"
                value={fields.phoneNumber}
                onChange={(e) => set('phoneNumber', e.target.value)}
                className={inputClass}
              />
            </Field>

            {canEditRole && (
              <Field label={UI.role} htmlFor="sf-role">
                <select
                  id="sf-role"
                  value={fields.role}
                  onChange={(e) => set('role', e.target.value as SystemRole)}
                  className={inputClass}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {UI_STRINGS.roles[r]}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {UI_STRINGS.common.cancel}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60"
              >
                {submitting ? (
                  <Spinner label={UI_STRINGS.common.saving} />
                ) : (
                  UI_STRINGS.common.save
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
const inputErrClass = 'border-red-400 focus:border-red-500 focus:ring-red-500 dark:border-red-500/60'

function OptionSelect({
  id,
  label,
  value,
  onChange,
  options,
  activeOptions,
  placeholder,
  error,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  /** Active options plus, if it is stale, the currently assigned one. */
  options: Option[]
  /** Active options only — anything outside this list renders as removed. */
  activeOptions: Option[]
  placeholder: string
  error?: string
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
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`${inputClass} ${error ? inputErrClass : ''}`}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => {
          const removed = !activeOptions.some((a) => a.id === o.id)
          return (
            // A removed option stays visible (so the row still reads correctly)
            // but is disabled, so it can never be re-picked.
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
