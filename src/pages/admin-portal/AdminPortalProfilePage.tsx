import { useCallback, useEffect, useRef, useState } from 'react'
import PencilSquareIcon from '@heroicons/react/24/outline/PencilSquareIcon'
import { ApiError, getOwnProfile, type SystemRole, type SystemUser } from '@/lib/api-client'
import { useAuth } from '@/auth/useAuth'
import { useProfileEditor } from '@/hooks/useProfileEditor'
import { PROFILE_STRINGS, ROLE_BADGE } from '@/constants/ui-strings-profile'
import { AccountInfoCard } from '@/components/admin-portal/profile/AccountInfoCard'
import { AuditTrailCard } from '@/components/admin-portal/profile/AuditTrailCard'
import { AvatarCropModal } from '@/components/admin-portal/profile/AvatarCropModal'
import { ChangePasswordModal } from '@/components/admin-portal/profile/ChangePasswordModal'
import { PersonalInfoCard } from '@/components/admin-portal/profile/PersonalInfoCard'
import { ProfileHeaderCard } from '@/components/admin-portal/profile/ProfileHeaderCard'
import { SaveConfirmModal } from '@/components/admin-portal/profile/SaveConfirmModal'

const T = PROFILE_STRINGS

/**
 * Roles that may edit their own row. Frontend gating is **UX only** — it exists so a
 * STAFF user never sees a control that would 403 at the backend's
 * `@Roles(SUPER_ADMIN, ADMIN)` guard. The server remains the authority.
 */
const SELF_EDITOR_ROLES: readonly SystemRole[] = ['SUPER_ADMIN', 'ADMIN']

/**
 * The admin-portal self-service Profile page (`/admin-portal/profile`).
 *
 * It reads the FULL `SystemUserResponseDto` itself rather than leaning on
 * `useAuth().user`: the auth context deliberately narrows the DTO to the handful of
 * fields the shell's header needs (`id`/`email`/name/`role`/`mustChangePassword`/
 * `profilePictureUrl`), so department, phone, `lineUserId` and every audit field are
 * simply not there. `getOwnProfile()` is the strict variant of the probe — it throws
 * with a status, so a 401 can bounce while anything else offers a retry.
 *
 * Saving is split by FIELD across two endpoints (see `useProfileEditor`); avatar and
 * password are independent flows that never touch the edit draft.
 */
export function AdminPortalProfilePage() {
  const { refresh, expireSession } = useAuth()

  const [user, setUser] = useState<SystemUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  /** Set on a 401: render nothing while the route guard performs the login bounce. */
  const [sessionDead, setSessionDead] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let live = true
    setLoading(true)
    setLoadError(null)
    getOwnProfile()
      .then((me) => {
        if (!live) return
        setUser(me)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (!live) return
        setLoading(false)
        if (err instanceof ApiError && err.status === 401) {
          // Session death — the route guard owns the redirect to the login screen.
          // Deliberately NOT the load-error alert: offering "retry" against a dead
          // session would just loop.
          setSessionDead(true)
          expireSession()
          return
        }
        setLoadError(T.loadFailed)
      })
    return () => {
      live = false
    }
  }, [reloadTick, expireSession])

  const canSelfEdit = user ? SELF_EDITOR_ROLES.includes(user.role) : false

  /**
   * Commit a freshly returned user. `refresh()` re-probes `/auth/system/me` so the
   * shell's header avatar/name follow — and it is fire-and-forget on purpose: if that
   * probe fails, the page must still show the values the PATCH just returned rather
   * than blanking out.
   */
  const handleCommitted = useCallback(
    (updated: SystemUser) => {
      setUser(updated)
      void refresh()
    },
    [refresh],
  )

  const editor = useProfileEditor({
    user,
    canEditAssignment: canSelfEdit,
    onCommitted: handleCommitted,
    expireSession,
  })

  const confirmDialogRef = useRef<HTMLDialogElement>(null)
  const passwordDialogRef = useRef<HTMLDialogElement>(null)
  const avatarDialogRef = useRef<HTMLDialogElement>(null)

  const handleRequestSave = useCallback(() => {
    editor.requestSave()
    confirmDialogRef.current?.showModal()
  }, [editor])

  const handleConfirmSave = useCallback(async () => {
    const saved = await editor.confirmSave()
    // Close only on success; a failure keeps the draft and surfaces the error on the
    // page's action bar, never as a silent no-op.
    if (saved) confirmDialogRef.current?.close()
  }, [editor])

  // Esc / backdrop / Cancel all fire the native `close` — one dismissal path.
  const handleConfirmDialogClose = useCallback(() => {
    editor.dismissConfirm()
  }, [editor])

  const handleUploaded = useCallback(
    (updated: SystemUser) => {
      handleCommitted(updated)
      avatarDialogRef.current?.close()
    },
    [handleCommitted],
  )

  if (sessionDead) return null
  if (loading) return <ProfileSkeleton />

  if (loadError || !user) {
    return (
      <div className="mx-auto max-w-5xl">
        <div role="alert" className="alert alert-error alert-soft">
          <span>{loadError ?? T.loadFailed}</span>
          <button
            type="button"
            onClick={() => setReloadTick((t) => t + 1)}
            className="btn btn-sm focus-visible:ring-2 focus-visible:ring-primary"
          >
            {T.retry}
          </button>
        </div>
      </div>
    )
  }

  const editing = editor.mode !== 'view'
  const saving = editor.mode === 'saving'

  return (
    <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
      <div className="text-center sm:text-left">
        <h1 className="flex flex-col items-center gap-2 text-2xl font-bold sm:flex-row sm:items-baseline sm:gap-4 sm:text-3xl">
          <span>
            {T.heading.th}{' '}
            <span className="text-base font-normal opacity-70 sm:text-lg">
              ({T.heading.en})
            </span>
          </span>
          <span className={`badge ${ROLE_BADGE[user.role]}`}>{user.role}</span>
        </h1>
        {/* NOTE: the prototypes' "Excluded: passwordHash, profilePictureUrl, isActive,
            deletedAt…" subtitle is developer scaffolding and deliberately does NOT ship. */}
      </div>

      <ProfileHeaderCard
        user={user}
        onChangeAvatar={() => avatarDialogRef.current?.showModal()}
      />

      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
        <AccountInfoCard
          user={user}
          onChangePassword={() => passwordDialogRef.current?.showModal()}
        />
        <PersonalInfoCard user={user} editor={editor} editable={canSelfEdit} />
        {/* Audit provenance is for SUPER_ADMIN / ADMIN only (product decision). */}
        {canSelfEdit && <AuditTrailCard user={user} />}
      </div>

      {editor.optionsError && (
        <div role="alert" className="alert alert-warning alert-soft text-sm">
          <span>{editor.optionsError}</span>
        </div>
      )}
      {editor.error && (
        <div role="alert" className="alert alert-error alert-soft text-sm">
          <span>{editor.error}</span>
        </div>
      )}
      {editor.notice && (
        <div role="status" className="alert alert-info alert-soft text-sm">
          <span>{editor.notice}</span>
        </div>
      )}

      {/* STAFF has no action bar at all — nothing on this page is editable for them. */}
      {canSelfEdit && (
        <div className="mt-6 flex flex-col justify-end gap-2 sm:flex-row">
          {editing && (
            <button
              type="button"
              onClick={editor.cancel}
              disabled={saving}
              className="btn btn-outline btn-error w-full transition-colors sm:w-auto focus-visible:ring-2 focus-visible:ring-error"
            >
              {T.actions.cancel}
            </button>
          )}
          <button
            type="button"
            onClick={editing ? handleRequestSave : editor.startEdit}
            disabled={saving}
            className={`btn w-full shadow-md transition-colors sm:w-auto focus-visible:ring-2 focus-visible:ring-primary ${
              editing ? 'btn-success' : 'btn-primary'
            }`}
          >
            {!editing && <PencilSquareIcon className="size-5" aria-hidden />}
            {editing ? T.actions.save : T.actions.edit}
          </button>
        </div>
      )}

      <SaveConfirmModal
        ref={confirmDialogRef}
        saving={saving}
        onConfirm={() => void handleConfirmSave()}
        onClose={handleConfirmDialogClose}
        onRequestClose={() => confirmDialogRef.current?.close()}
      />
      <ChangePasswordModal
        ref={passwordDialogRef}
        onClose={() => {}}
        onRequestClose={() => passwordDialogRef.current?.close()}
        onExpireSession={expireSession}
      />
      <AvatarCropModal
        ref={avatarDialogRef}
        onUploaded={handleUploaded}
        onClose={() => {}}
        onRequestClose={() => avatarDialogRef.current?.close()}
        onExpireSession={expireSession}
      />
    </div>
  )
}

/**
 * Loading state. A skeleton (not a bare spinner) because this screen is data-dense,
 * and it reserves the SAME heights the real cards occupy so the swap does not shift
 * the layout underneath the user.
 */
function ProfileSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy
      className="mx-auto max-w-5xl space-y-4 sm:space-y-6"
    >
      <span className="sr-only">{T.loading}</span>
      <div className="skeleton h-9 w-56" />
      <div className="card w-full bg-base-100 shadow-sm">
        <div className="card-body flex-col items-center gap-4 p-6 sm:flex-row sm:items-start sm:gap-6">
          <div className="skeleton h-20 w-20 shrink-0 rounded-full sm:h-24 sm:w-24" />
          <div className="w-full space-y-2">
            <div className="skeleton h-6 w-48" />
            <div className="skeleton h-4 w-64" />
            <div className="skeleton h-5 w-24" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
        <SkeletonCard rows={4} />
        <SkeletonCard rows={5} />
        <SkeletonCard rows={4} className="md:col-span-2" />
      </div>
    </div>
  )
}

function SkeletonCard({ rows, className }: { readonly rows: number; readonly className?: string }) {
  return (
    <div className={`card h-full w-full bg-base-100 shadow-sm ${className ?? ''}`}>
      <div className="card-body gap-3 p-4 sm:p-6">
        <div className="skeleton h-6 w-40" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:gap-4">
            <div className="skeleton h-4 w-full sm:w-1/3" />
            <div className="skeleton h-8 w-full sm:w-2/3" />
          </div>
        ))}
      </div>
    </div>
  )
}
