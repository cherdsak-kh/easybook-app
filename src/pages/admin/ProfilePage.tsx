import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  ApiError,
  AVATAR_ACCEPTED_TYPES,
  AVATAR_MAX_BYTES,
  getMe,
  updateOwnProfile,
  uploadOwnAvatar,
  type SystemUser,
} from '@/lib/api-client'
import { Spinner } from '@/components/Spinner'
import { useAuth } from '@/auth/useAuth'
import { UI_STRINGS } from '@/constants/ui-strings'

const UI = UI_STRINGS.profile

interface Fields {
  firstName: string
  lastName: string
  phoneNumber: string
}

function toFields(u: SystemUser): Fields {
  return {
    firstName: u.firstName,
    lastName: u.lastName,
    phoneNumber: u.phoneNumber ?? '',
  }
}

function initials(u: SystemUser): string {
  return `${u.firstName.charAt(0)}${u.lastName.charAt(0)}`.toUpperCase()
}

/** Client-side pre-check. The server re-checks everything and sniffs magic bytes. */
function fileRejection(file: File): string | null {
  // `>` not `>=`: the backend's limit is EXCLUSIVE — exactly 2 MiB is accepted,
  // so rejecting `>=` here would refuse a file the server would have taken.
  if (file.size > AVATAR_MAX_BYTES) return UI.avatarTooLarge
  if (!(AVATAR_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return UI.avatarBadType
  }
  return null
}

/**
 * Staff self-profile (AC-F7/F8). The signed-in user edits their OWN safe fields
 * via `PATCH /auth/system/me`: first name, last name, `phoneNumber` (the column
 * that already exists — there is no `phone` field), and their avatar.
 *
 * `role`, `department` and `personnelRole` (labelled "Position") render
 * **read-only**: they are SUPER_ADMIN-managed, are absent from the self-edit
 * DTO, and `forbidNonWhitelisted` makes sending one a 400. They are deliberately
 * never part of the submitted payload.
 */
export function ProfilePage() {
  const { refresh, expireSession } = useAuth()

  const [me, setMe] = useState<SystemUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [fields, setFields] = useState<Fields>({ firstName: '', lastName: '', phoneNumber: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    setLoadError(false)
    getMe()
      .then((user) => {
        if (!user) {
          setLoadError(true)
          setLoading(false)
          return
        }
        setMe(user)
        setFields(toFields(user))
        setLoading(false)
      })
      .catch(() => {
        setLoadError(true)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((f) => ({ ...f, [key]: value }))
    setSaved(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaveError(null)
    setSaved(false)
    setSaving(true)
    try {
      // ONLY the self-editable fields. `role`/`departmentId`/`personnelRoleId`
      // are absent from the DTO — including one would be a 400, not a silent
      // no-op. An empty phone clears the nullable column.
      const updated = await updateOwnProfile({
        firstName: fields.firstName.trim(),
        lastName: fields.lastName.trim(),
        phoneNumber: fields.phoneNumber.trim() || null,
      })
      setMe(updated)
      setFields(toFields(updated))
      setSaved(true)
      // Keep the header's name in sync with what we just saved.
      await refresh()
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        expireSession()
        return
      }
      setSaveError(
        err instanceof ApiError && err.status === 400
          ? err.message || UI.saveInvalid
          : UI.saveFailed,
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatar(file: File) {
    setAvatarError(null)
    const rejection = fileRejection(file)
    if (rejection) {
      setAvatarError(rejection)
      return
    }
    setAvatarBusy(true)
    try {
      const updated = await uploadOwnAvatar(file)
      // Re-render straight from the response — never construct the URL.
      setMe(updated)
      await refresh()
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        expireSession()
        return
      }
      if (err instanceof ApiError && err.status === 400) {
        // Oversize, unsupported type, or the magic-byte sniff disagreed with the
        // declared one — the server's message says which.
        setAvatarError(err.message || UI.avatarRejected)
      } else if (err instanceof ApiError && err.status === 502) {
        setAvatarError(UI.avatarStorageDown)
      } else {
        setAvatarError(UI.avatarUploadFailed)
      }
    } finally {
      setAvatarBusy(false)
      // Let the same file be re-picked after a failure.
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  if (loading) return <ProfileSkeleton />

  if (loadError || !me) {
    return (
      <section aria-labelledby="profile-heading" className="mx-auto w-full max-w-2xl">
        <h1 id="profile-heading" className="sr-only">
          {UI.heading}
        </h1>
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
        >
          <p>{UI.loadFailed}</p>
          <button
            type="button"
            onClick={load}
            className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            {UI_STRINGS.common.tryAgain}
          </button>
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby="profile-heading" className="mx-auto w-full max-w-2xl">
      <div className="mb-4">
        <h1 id="profile-heading" className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {UI.heading}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{UI.subheading}</p>
      </div>

      {/* ---------------------------------------------------------------- Avatar */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-4">
          {me.profilePictureUrl ? (
            <img
              src={me.profilePictureUrl}
              alt={UI.avatarAlt}
              className="h-20 w-20 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xl font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200"
            >
              {initials(me)}
            </span>
          )}

          <div className="min-w-0">
            <label
              htmlFor="profile-avatar"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              {UI.avatarLabel}
            </label>
            <input
              ref={fileRef}
              id="profile-avatar"
              type="file"
              accept={AVATAR_ACCEPTED_TYPES.join(',')}
              disabled={avatarBusy}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleAvatar(file)
              }}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-emerald-700 disabled:opacity-60 dark:text-slate-300"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{UI.avatarHint}</p>
            {avatarBusy && (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                <Spinner label={UI.avatarUploadingSr} />
                <span className="ml-2">{UI.avatarUploading}</span>
              </p>
            )}
          </div>
        </div>

        {avatarError && (
          <p
            role="alert"
            className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400"
          >
            {avatarError}
          </p>
        )}
      </div>

      {/* ----------------------------------------------------------- Editable */}
      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        {saveError && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400"
          >
            {saveError}
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="profile-first" className={labelClass}>
              {UI.firstName}
            </label>
            <input
              id="profile-first"
              required
              value={fields.firstName}
              onChange={(e) => set('firstName', e.target.value)}
              disabled={saving}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="profile-last" className={labelClass}>
              {UI.lastName}
            </label>
            <input
              id="profile-last"
              required
              value={fields.lastName}
              onChange={(e) => set('lastName', e.target.value)}
              disabled={saving}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="profile-phone" className={labelClass}>
            {UI.phoneNumber}
          </label>
          <input
            id="profile-phone"
            type="tel"
            value={fields.phoneNumber}
            onChange={(e) => set('phoneNumber', e.target.value)}
            disabled={saving}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="profile-email" className={labelClass}>
            {UI.email}
          </label>
          <input
            id="profile-email"
            value={me.email}
            readOnly
            disabled
            className={`${inputClass} cursor-not-allowed opacity-70`}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          {/* role="status" so the save confirmation is announced. */}
          <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
            {saved ? UI.saved : ''}
          </p>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60"
          >
            {saving ? <Spinner label={UI_STRINGS.common.saving} /> : UI.saveChanges}
          </button>
        </div>
      </form>

      {/* ---------------------------------------------------------- Read-only */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          {UI.readOnlyHeading}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {UI.readOnlyIntro} {UI.managedNote}
        </p>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ReadOnlyValue label={UI.role} value={UI_STRINGS.roles[me.role]} />
          {/* Wire field `personnelRole`; the UI label stays "Position". */}
          <ReadOnlyValue label={UI.position} value={me.personnelRole.name} />
          <ReadOnlyValue label={UI.department} value={me.department.name} />
        </dl>
      </div>
    </section>
  )
}

const labelClass = 'mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300'
const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'

function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
        {value}
      </dd>
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl" aria-hidden data-testid="profile-skeleton">
      <div className="mb-4 space-y-2">
        <span className="block h-6 w-40 rounded bg-slate-200 motion-safe:animate-pulse dark:bg-slate-700" />
        <span className="block h-4 w-56 rounded bg-slate-200 motion-safe:animate-pulse dark:bg-slate-700" />
      </div>
      <div className="mb-4 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <span className="h-20 w-20 shrink-0 rounded-full bg-slate-200 motion-safe:animate-pulse dark:bg-slate-700" />
        <span className="h-9 flex-1 rounded bg-slate-200 motion-safe:animate-pulse dark:bg-slate-700" />
      </div>
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        {Array.from({ length: 4 }).map((_, i) => (
          <span
            key={i}
            className="block h-10 rounded bg-slate-200 motion-safe:animate-pulse dark:bg-slate-700"
          />
        ))}
      </div>
    </div>
  )
}
