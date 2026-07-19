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
import { Avatar } from '@/components/admin/Avatar'
import { AvatarCropModal } from '@/components/admin/AvatarCropModal'
import { useAuth } from '@/auth/useAuth'
import { UI_STRINGS } from '@/constants/ui-strings-backend'

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
  /** The picked file awaiting a crop. Non-null ⇔ the crop dialog is open. */
  const [cropping, setCropping] = useState<File | null>(null)
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

  /**
   * A file was PICKED — it is not uploaded yet. Pre-check it, then hand it to the
   * crop dialog; `handleCropped` is the only path to the network, so every stored
   * avatar is a 1:1 crop by construction.
   */
  function handlePicked(file: File) {
    setAvatarError(null)
    const rejection = fileRejection(file)
    if (rejection) {
      setAvatarError(rejection)
      // Let the same file be re-picked after a rejection.
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setCropping(file)
  }

  /**
   * `cropped` is the modal's output: already square, JPEG, and verified against
   * `AVATAR_MAX_BYTES` — cropping can INCREASE size, so the modal re-checks
   * rather than trusting the pre-check that ran on the original at pick time.
   */
  async function handleCropped(cropped: File) {
    setCropping(null)
    setAvatarError(null)
    setAvatarBusy(true)
    try {
      const updated = await uploadOwnAvatar(cropped)
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
          className="rounded-xl border border-error/30 bg-error/10 p-6 text-center text-error"
        >
          <p>{UI.loadFailed}</p>
          <button
            type="button"
            onClick={load}
            className="btn btn-primary btn-sm mt-4 focus-visible:ring-2 focus-visible:ring-primary"
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
        <h1 id="profile-heading" className="text-xl font-bold text-base-content">
          {UI.heading}
        </h1>
        <p className="text-sm text-base-content/60">{UI.subheading}</p>
      </div>

      {/* ---------------------------------------------------------------- Avatar */}
      <div className="mb-4 rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-4">
          {/* Named here (unlike the header/staff rows): this is the user's OWN
              picture and nothing adjacent identifies it. */}
          <Avatar
            src={me.profilePictureUrl}
            name={`${me.firstName} ${me.lastName}`}
            colorKey={me.id}
            size="lg"
            alt={UI.avatarAlt}
          />

          <div className="min-w-0">
            <label htmlFor="profile-avatar" className="mb-1 block text-sm font-medium">
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
                if (file) handlePicked(file)
              }}
              className="file-input file-input-bordered w-full focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
            />
            <p className="mt-1 text-xs text-base-content/60">{UI.avatarHint}</p>
            {avatarBusy && (
              <p className="mt-2 text-sm text-base-content/70">
                <Spinner label={UI.avatarUploadingSr} />
                <span className="ml-2">{UI.avatarUploading}</span>
              </p>
            )}
          </div>
        </div>

        {avatarError && (
          <div role="alert" className="alert alert-error alert-soft mt-3 text-sm">
            {avatarError}
          </div>
        )}

        {cropping && (
          <AvatarCropModal
            file={cropping}
            onConfirm={handleCropped}
            onCancel={() => {
              setCropping(null)
              // Re-arm the input: without this, re-picking the SAME file fires no
              // change event and the dialog would never reopen.
              if (fileRef.current) fileRef.current.value = ''
            }}
          />
        )}
      </div>

      {/* ----------------------------------------------------------- Editable */}
      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm sm:p-5"
      >
        {saveError && (
          <div role="alert" className="alert alert-error alert-soft text-sm">
            {saveError}
          </div>
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
            className="btn btn-primary btn-sm focus-visible:ring-2 focus-visible:ring-primary"
          >
            {saving ? <Spinner label={UI_STRINGS.common.saving} /> : UI.saveChanges}
          </button>
        </div>
      </form>

      {/* ---------------------------------------------------------- Read-only */}
      <div className="mt-4 rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm sm:p-5">
        <h2 className="text-base font-semibold text-base-content">{UI.readOnlyHeading}</h2>
        <p className="mt-1 text-sm text-base-content/60">
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

const labelClass = 'mb-1 block text-sm font-medium'
const inputClass =
  'input input-bordered w-full focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60'

function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-base-200 px-3 py-2">
      <dt className="text-xs font-medium text-base-content/60">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-base-content">{value}</dd>
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl" aria-hidden data-testid="profile-skeleton">
      <div className="mb-4 space-y-2">
        <span className="block h-6 w-40 rounded bg-base-300 motion-safe:animate-pulse" />
        <span className="block h-4 w-56 rounded bg-base-300 motion-safe:animate-pulse" />
      </div>
      <div className="mb-4 flex items-center gap-4 rounded-2xl border border-base-300 bg-base-100 p-5">
        <span className="h-20 w-20 shrink-0 rounded-full bg-base-300 motion-safe:animate-pulse" />
        <span className="h-9 flex-1 rounded bg-base-300 motion-safe:animate-pulse" />
      </div>
      <div className="space-y-3 rounded-2xl border border-base-300 bg-base-100 p-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className="block h-10 rounded bg-base-300 motion-safe:animate-pulse" />
        ))}
      </div>
    </div>
  )
}
