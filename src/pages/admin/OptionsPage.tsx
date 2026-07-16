import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import {
  ApiError,
  createDepartment,
  createPersonnelRole,
  deleteDepartment,
  deletePersonnelRole,
  listDepartments,
  listPersonnelRoles,
  patchDepartment,
  patchPersonnelRole,
  type Department,
  type OptionInput,
  type PersonnelRole,
} from '@/lib/api-client'
import { Spinner } from '@/components/Spinner'
import { useAuth } from '@/auth/useAuth'

/** The common shape shared by `Department` and `PersonnelRole` rows. */
type OptionRow = Department | PersonnelRole

interface OptionResource {
  /** Section heading, e.g. "Departments". */
  title: string
  /** Singular noun for copy, e.g. "department". */
  noun: string
  list: () => Promise<OptionRow[]>
  create: (body: OptionInput) => Promise<OptionRow>
  rename: (id: number, body: OptionInput) => Promise<OptionRow>
  remove: (id: number) => Promise<void>
}

const DEPARTMENTS: OptionResource = {
  title: 'Departments (ฝ่าย/แผนก)',
  noun: 'department',
  list: listDepartments,
  create: createDepartment,
  rename: patchDepartment,
  remove: deleteDepartment,
}

const PERSONNEL_ROLES: OptionResource = {
  title: 'Personnel Roles (ตำแหน่ง/บทบาท)',
  noun: 'personnel role',
  list: listPersonnelRoles,
  create: createPersonnelRole,
  rename: patchPersonnelRole,
  remove: deletePersonnelRole,
}

/**
 * Registration options management. SUPER_ADMIN / ADMIN curate the `Department`
 * and `PersonnelRole` lists that populate the client-portal registration form.
 * DELETE is a server-side soft-delete (the row leaves the active list; there is
 * no restore in this scope). `STAFF` is denied server-side; a 403 is surfaced as
 * a non-crashing notice rather than crashing the view.
 */
export function OptionsPage() {
  return (
    <section aria-labelledby="options-heading" className="mx-auto w-full max-w-4xl">
      <div className="mb-6">
        <h1 id="options-heading" className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Registration Options
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Manage the departments and roles people choose from when they register.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <OptionManager resource={DEPARTMENTS} />
        <OptionManager resource={PERSONNEL_ROLES} />
      </div>
    </section>
  )
}

type ModalState = { kind: 'closed' } | { kind: 'create' } | { kind: 'rename'; row: OptionRow }

function OptionManager({ resource }: { resource: OptionResource }) {
  const { expireSession } = useAuth()

  const [items, setItems] = useState<OptionRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>({ kind: 'closed' })
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const reqId = useRef(0)
  const headingId = useId()

  const load = useCallback(() => {
    const id = ++reqId.current
    setLoading(true)
    setError(null)
    resource
      .list()
      .then((rows) => {
        if (id !== reqId.current) return
        setItems(rows)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (id !== reqId.current) return
        if (err instanceof ApiError && err.status === 401) {
          expireSession()
          return
        }
        setError(
          err instanceof ApiError && err.status === 403
            ? `You do not have permission to manage ${resource.title.toLowerCase()}.`
            : `Could not load ${resource.title.toLowerCase()}. Please try again.`,
        )
        setLoading(false)
      })
  }, [resource, expireSession])

  useEffect(() => {
    load()
  }, [load])

  function handleSaved() {
    setModal({ kind: 'closed' })
    load()
  }

  async function remove(row: OptionRow) {
    setBusyId(row.id)
    setActionError(null)
    try {
      await resource.remove(row.id)
      setConfirmingId(null)
      load()
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        expireSession()
        return
      }
      if (err instanceof ApiError && err.status === 404) {
        setActionError('That option was already removed — refreshing the list.')
        load()
      } else {
        setActionError(
          err instanceof ApiError && err.status === 403
            ? 'You do not have permission to remove this option.'
            : 'Could not remove the option. Please try again.',
        )
      }
    } finally {
      setBusyId(null)
    }
  }

  const rows = items ?? []

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={headingId} className="text-base font-semibold text-slate-900 dark:text-slate-100">
          {resource.title}
        </h2>
        <button
          type="button"
          onClick={() => {
            setActionError(null)
            setModal({ kind: 'create' })
          }}
          className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          Add
        </button>
      </div>

      {actionError && (
        <p
          role="alert"
          className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400"
        >
          {actionError}
        </p>
      )}

      <div className="min-h-[12rem]">
        {loading && <OptionSkeleton />}

        {!loading && error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
          >
            {error}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No {resource.title.toLowerCase()} yet. Add one to get started.
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-100">
                  {row.name}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActionError(null)
                      setModal({ kind: 'rename', row })
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Rename
                  </button>
                  {confirmingId === row.id ? (
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => remove(row)}
                        disabled={busyId === row.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-60"
                      >
                        {busyId === row.id ? <Spinner label="Removing…" /> : 'Confirm'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setActionError(null)
                        setConfirmingId(row.id)
                      }}
                      aria-label={`Delete ${row.name}`}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modal.kind !== 'closed' && (
        <OptionFormModal
          noun={resource.noun}
          mode={modal.kind}
          row={modal.kind === 'rename' ? modal.row : undefined}
          save={(name) =>
            modal.kind === 'rename'
              ? resource.rename(modal.row.id, { name })
              : resource.create({ name })
          }
          onClose={() => setModal({ kind: 'closed' })}
          onSaved={handleSaved}
          onUnauthorized={expireSession}
        />
      )}
    </section>
  )
}

/** Map a create/rename error status to a friendly message. */
function saveErrorMessage(status: number, noun: string): string {
  if (status === 409) return 'That name is already in use.'
  if (status === 403) return 'You do not have permission to perform this action.'
  if (status === 404) return `That ${noun} no longer exists.`
  if (status === 400) return 'Please enter a valid name.'
  return 'Could not save. Please try again.'
}

function OptionFormModal({
  noun,
  mode,
  row,
  save,
  onClose,
  onSaved,
  onUnauthorized,
}: {
  noun: string
  mode: 'create' | 'rename'
  row?: OptionRow
  save: (name: string) => Promise<OptionRow>
  onClose: () => void
  onSaved: () => void
  onUnauthorized: () => void
}) {
  const [name, setName] = useState(row?.name ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Please enter a name.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await save(trimmed)
      onSaved()
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        onUnauthorized()
        return
      }
      setError(
        err instanceof ApiError
          ? saveErrorMessage(err.status, noun)
          : 'Could not save. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const titleId = 'option-form-title'

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
        className="relative z-10 w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl dark:bg-slate-900"
      >
        <h2 id={titleId} className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">
          {mode === 'create' ? `Add ${noun}` : `Rename ${noun}`}
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

          <div>
            <label
              htmlFor="option-name"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Name
            </label>
            <input
              ref={inputRef}
              id="option-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

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

function OptionSkeleton() {
  return (
    <ul className="space-y-2" aria-hidden data-testid="option-skeleton">
      {Array.from({ length: 4 }).map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
        >
          <span className="block h-4 flex-1 rounded bg-slate-200 motion-safe:animate-pulse dark:bg-slate-700" />
          <span className="h-7 w-28 rounded bg-slate-200 motion-safe:animate-pulse dark:bg-slate-700" />
        </li>
      ))}
    </ul>
  )
}
