import { useCallback, useEffect, useRef, useState } from 'react'
import CameraIcon from '@heroicons/react/24/outline/CameraIcon'
import CheckIcon from '@heroicons/react/24/outline/CheckIcon'
import ClipboardDocumentIcon from '@heroicons/react/24/outline/ClipboardDocumentIcon'
import UserIcon from '@heroicons/react/24/outline/UserIcon'
import type { SystemUser } from '@/lib/api-client'
import { PROFILE_STRINGS, ROLE_BADGE, ROLE_LABEL, ROLE_RING } from '@/constants/ui-strings-profile'

const T = PROFILE_STRINGS

/** How long the "copied" / "failed" confirmation stays on screen. */
const COPY_FEEDBACK_MS = 2000

/**
 * The page's identity header: 1:1 avatar (with a person-icon fallback — never an
 * `<img>` with an empty `src`, and never an external stock-photo host), display
 * name, account id and the role badge.
 *
 * The no-picture case renders the SAME `UserIcon` placeholder as the navbar avatar in
 * `AdminPortalHeader` (`bg-base-300 text-base-content`), so the two surfaces that show
 * "this signed-in user" agree. It replaced a text-initials chip on `bg-neutral`, which
 * was the only place in the portal drawing an avatar that way.
 *
 * daisyUI 5 notes (skill: components/avatar.md, button.md, badge.md): the
 * image-less variant is `avatar avatar-placeholder`, which is the **v5 rename** of
 * the prototypes' v4 `avatar placeholder` — pasting the v4 spelling would silently
 * drop the placeholder styling. The camera affordance is a real `btn btn-circle`
 * with an `aria-label`, not an icon-only div.
 *
 * a11y: the icon is decorative (`aria-hidden`, as in the header), so the accessible
 * name the initials used to carry moves onto the placeholder itself as
 * `role="img" + aria-label` — the same sentence the real photo carries in `alt`. The
 * avatar region therefore still names the user in both branches.
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
                role="img"
                aria-label={T.avatarAlt(displayName)}
                className={`h-20 w-20 rounded-full bg-base-300 text-base-content sm:h-24 sm:w-24 ${ring}`}
              >
                <UserIcon className="h-10 w-10 sm:h-12 sm:w-12" aria-hidden />
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={onChangeAvatar}
            aria-label={T.actions.changeAvatar}
            title={T.actions.changeAvatar}
            className="btn btn-circle btn-neutral btn-xs absolute right-0 bottom-0 shadow-sm transition-transform motion-safe:hover:scale-110 focus-visible:ring-2 focus-visible:ring-base-content"
          >
            <CameraIcon className="size-3.5" aria-hidden />
          </button>
        </div>

        <div className="mt-2 flex min-w-0 flex-col items-center gap-1 sm:mt-0 sm:items-start">
          <h2 className="text-xl font-semibold wrap-break-word sm:text-2xl">{displayName}</h2>
          <CuidRow id={user.id} />
          <div className="mt-1 flex gap-2 sm:mt-2">
            <span className={`badge font-medium ${ROLE_BADGE[user.role]}`}>
              {ROLE_LABEL[user.role]}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * `CUID: <value>` plus a copy-to-clipboard button — the id is the one thing support
 * asks a user to read out, and reading a 25-character cuid aloud is a bug report
 * waiting to happen.
 *
 * Failure handling is the whole point of the `try/catch`: `navigator.clipboard` is
 * **absent entirely** outside a secure context (and in jsdom), and present-but-denied
 * when the user refuses the permission. The first case throws synchronously on the
 * property access and the second rejects — both land in the same `catch` because the
 * access happens inside an `async` function, so neither can escape as an unhandled
 * rejection. A failure is SHOWN (`copy.failed`), never swallowed.
 *
 * Feedback is a live region so it is announced, not merely drawn: the icon swap alone
 * would be invisible to a screen-reader user.
 */
function CuidRow({ id }: { readonly id: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear on unmount so a pending timeout can never setState on a dead component.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  const copy = useCallback(async () => {
    let next: 'copied' | 'failed'
    try {
      await navigator.clipboard.writeText(id)
      next = 'copied'
    } catch {
      next = 'failed'
    }
    setStatus(next)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setStatus('idle'), COPY_FEEDBACK_MS)
  }, [id])

  return (
    <div className="flex max-w-full flex-wrap items-center justify-center gap-1 sm:justify-start">
      <p className="font-mono text-xs break-all text-base-content/50 sm:text-sm">
        {T.idPrefix} {id}
      </p>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={T.actions.copyId}
        title={T.actions.copyId}
        className="btn btn-ghost btn-circle btn-xs shrink-0 text-base-content/60 transition-colors hover:text-base-content focus-visible:ring-2 focus-visible:ring-base-content"
      >
        {status === 'copied' ? (
          <CheckIcon className="size-4 text-success" aria-hidden />
        ) : (
          <ClipboardDocumentIcon className="size-4" aria-hidden />
        )}
      </button>
      {/* Always mounted so the live region exists BEFORE it gains content — a region
          inserted at the same moment as its text is unreliably announced. */}
      <span
        role="status"
        aria-live="polite"
        className={`text-xs ${status === 'failed' ? 'text-error' : 'text-success'}`}
      >
        {status === 'copied' ? T.copy.done : status === 'failed' ? T.copy.failed : ''}
      </span>
    </div>
  )
}
