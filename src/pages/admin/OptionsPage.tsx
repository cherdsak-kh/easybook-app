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
import { UI_STRINGS, type OptionCopy } from '@/constants/ui-strings-backend'

const UI = UI_STRINGS.options

/** The common shape shared by `Department` and `PersonnelRole` rows. */
type OptionRow = Department | PersonnelRole

interface OptionResource {
  /**
   * This section's `{ title, noun }` copy. Points at the shared dictionary — the
   * strings deliberately do not live on this object any more, so the tests can
   * assert against the same values the page renders.
   */
  copy: OptionCopy
  list: () => Promise<OptionRow[]>
  create: (body: OptionInput) => Promise<OptionRow>
  rename: (id: number, body: OptionInput) => Promise<OptionRow>
  remove: (id: number) => Promise<void>
}

const DEPARTMENTS: OptionResource = {
  copy: UI.departments,
  list: listDepartments,
  create: createDepartment,
  rename: patchDepartment,
  remove: deleteDepartment,
}

const PERSONNEL_ROLES: OptionResource = {
  copy: UI.personnelRoles,
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
        <h1 id="options-heading" className="text-xl font-bold text-base-content">
          {UI.heading}
        </h1>
        <p className="text-sm text-base-content/60">{UI.subheading}</p>
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
            ? UI.loadForbidden(resource.copy.title)
            : UI.loadFailed(resource.copy.title),
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
        setActionError(UI.removeGone)
        load()
      } else {
        setActionError(
          err instanceof ApiError && err.status === 403 ? UI.removeForbidden : UI.removeFailed,
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
      className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm sm:p-5"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={headingId} className="text-base font-semibold text-base-content">
          {resource.copy.title}
        </h2>
        <button
          type="button"
          onClick={() => {
            setActionError(null)
            setModal({ kind: 'create' })
          }}
          className="btn btn-primary btn-sm shrink-0 focus-visible:ring-2 focus-visible:ring-primary"
        >
          {UI.add}
        </button>
      </div>

      {actionError && (
        <div role="alert" className="alert alert-error alert-soft mb-3 text-sm">
          {actionError}
        </div>
      )}

      <div className="min-h-[12rem]">
        {loading && <OptionSkeleton />}

        {!loading && error && (
          <div role="alert" className="alert alert-error alert-soft justify-center p-5 text-center text-sm">
            {error}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-base-300 p-8 text-center text-sm text-base-content/60">
            {UI.empty(resource.copy.title)}
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-3 rounded-xl border border-base-300 bg-base-100 p-3"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-base-content">
                  {row.name}
                </span>
                {row.isSystemReserved ? (
                  /*
                   * A system-reserved row (only ever reaches a SUPER_ADMIN). The
                   * backend answers 404 on PATCH/DELETE of it, so we render the
                   * read-only badge INSTEAD of the Rename/Delete controls — a
                   * visible-but-dead button would be a bug. The flag is display
                   * only; there is no affordance to set or clear it.
                   */
                  <span
                    title={UI.reservedHint}
                    className="badge badge-ghost shrink-0 font-medium"
                  >
                    {UI.reservedBadge}
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActionError(null)
                        setModal({ kind: 'rename', row })
                      }}
                      className="btn btn-outline btn-sm focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {UI.rename}
                    </button>
                    {confirmingId === row.id ? (
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => remove(row)}
                          disabled={busyId === row.id}
                          className="btn btn-error btn-sm focus-visible:ring-2 focus-visible:ring-error"
                        >
                          {busyId === row.id ? (
                            <Spinner label={UI.removing} />
                          ) : (
                            UI_STRINGS.common.confirm
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingId(null)}
                          className="btn btn-outline btn-sm focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          {UI_STRINGS.common.cancel}
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setActionError(null)
                          setConfirmingId(row.id)
                        }}
                        aria-label={UI.deleteRow(row.name)}
                        className="btn btn-outline btn-error btn-sm focus-visible:ring-2 focus-visible:ring-error"
                      >
                        {UI.delete}
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {modal.kind !== 'closed' && (
        <OptionFormModal
          noun={resource.copy.noun}
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
  if (status === 409) return UI.form.nameTaken
  if (status === 403) return UI.form.forbidden
  if (status === 404) return UI.form.gone(noun)
  if (status === 400) return UI.form.invalid
  return UI.form.saveFailed
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
      setError(UI.form.nameRequired)
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
      setError(err instanceof ApiError ? saveErrorMessage(err.status, noun) : UI.form.saveFailed)
    } finally {
      setSubmitting(false)
    }
  }

  const titleId = 'option-form-title'

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label={UI_STRINGS.common.closeDialog}
        className="absolute inset-0 bg-neutral/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-sm rounded-t-2xl bg-base-100 p-5 shadow-xl sm:rounded-2xl"
      >
        <h2 id={titleId} className="mb-4 text-lg font-bold text-base-content">
          {mode === 'create' ? UI.form.addTitle(noun) : UI.form.renameTitle(noun)}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div role="alert" className="alert alert-error alert-soft text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="option-name" className="mb-1 block text-sm font-medium">
              {UI.nameLabel}
            </label>
            <input
              ref={inputRef}
              id="option-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              className="input input-bordered w-full focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-outline btn-sm focus-visible:ring-2 focus-visible:ring-primary"
            >
              {UI_STRINGS.common.cancel}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary btn-sm focus-visible:ring-2 focus-visible:ring-primary"
            >
              {submitting ? <Spinner label={UI_STRINGS.common.saving} /> : UI_STRINGS.common.save}
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
          className="flex items-center gap-3 rounded-xl border border-base-300 bg-base-100 p-3"
        >
          <span className="block h-4 flex-1 rounded bg-base-300 motion-safe:animate-pulse" />
          <span className="h-7 w-28 rounded bg-base-300 motion-safe:animate-pulse" />
        </li>
      ))}
    </ul>
  )
}
