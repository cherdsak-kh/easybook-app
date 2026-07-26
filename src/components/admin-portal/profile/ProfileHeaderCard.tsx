import CameraIcon from '@heroicons/react/24/outline/CameraIcon'
import type { SystemUser } from '@/lib/api-client'
import { PROFILE_STRINGS, ROLE_BADGE, ROLE_RING } from '@/constants/ui-strings-profile'

const T = PROFILE_STRINGS

/** First letters of the given/family name; `?` when both are blank. */
function initialsOf(user: SystemUser): string {
  const letters = `${user.firstName.trim().charAt(0)}${user.lastName.trim().charAt(0)}`
  return letters.toUpperCase() || '?'
}

/**
 * The page's identity header: 1:1 avatar (with an initials fallback — never an
 * `<img>` with an empty `src`, and never an external stock-photo host), display
 * name, account id and the role badge.
 *
 * daisyUI 5 notes (skill: components/avatar.md, button.md, badge.md): the
 * image-less variant is `avatar avatar-placeholder`, which is the **v5 rename** of
 * the prototypes' v4 `avatar placeholder` — pasting the v4 spelling would silently
 * drop the placeholder styling. The camera affordance is a real `btn btn-circle`
 * with an `aria-label`, not an icon-only div.
 */
export function ProfileHeaderCard({
  user,
  onChangeAvatar,
}: {
  readonly user: SystemUser
  readonly onChangeAvatar: () => void
}) {
  const displayName = `${user.firstName} ${user.lastName}`.trim()
  const ring = `ring ring-offset-2 ring-offset-base-100 ${ROLE_RING[user.role]}`

  return (
    <section className="card w-full bg-base-100 shadow-sm">
      <div className="card-body flex-col items-center gap-4 p-6 text-center sm:flex-row sm:items-start sm:gap-6 sm:text-left">
        <div className="relative shrink-0">
          {user.profilePictureUrl ? (
            <div className="avatar">
              <div className={`h-20 w-20 rounded-full sm:h-24 sm:w-24 ${ring}`}>
                <img
                  src={user.profilePictureUrl}
                  alt={T.avatarAlt(displayName)}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          ) : (
            <div className="avatar avatar-placeholder">
              <div
                className={`h-20 w-20 rounded-full bg-neutral text-neutral-content sm:h-24 sm:w-24 ${ring}`}
              >
                <span className="text-2xl font-semibold sm:text-3xl">{initialsOf(user)}</span>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={onChangeAvatar}
            aria-label={T.actions.changeAvatar}
            title={T.actions.changeAvatar}
            className="btn btn-circle btn-neutral btn-xs absolute right-0 bottom-0 shadow-sm transition-transform motion-safe:hover:scale-110 focus-visible:ring-2 focus-visible:ring-primary"
          >
            <CameraIcon className="size-3.5" aria-hidden />
          </button>
        </div>

        <div className="mt-2 flex min-w-0 flex-col items-center gap-1 sm:mt-0 sm:items-start">
          <h2 className="text-xl font-semibold wrap-break-word sm:text-2xl">{displayName}</h2>
          <p className="font-mono text-xs break-all text-base-content/50 sm:text-sm">
            {T.idPrefix} {user.id}
          </p>
          <div className="mt-1 flex gap-2 sm:mt-2">
            <span className={`badge font-medium ${ROLE_BADGE[user.role]}`}>{user.role}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
