import KeyIcon from '@heroicons/react/24/outline/KeyIcon'
import type { SystemUser } from '@/lib/api-client'
import { PROFILE_STRINGS, ROLE_BADGE } from '@/constants/ui-strings-profile'
import { ProfileCard } from './ProfileCard'
import { ProfileFieldRow, ProfileFieldValue } from './ProfileFieldRow'

const T = PROFILE_STRINGS

/** Never render a linked id in full — show a recognisable prefix only. */
function maskLinkedId(id: string): string {
  return `${id.slice(0, 6)}…`
}

/**
 * Account card: email, the change-password action, the role badge and the LINE row.
 *
 * The LINE row is kept because it carries REAL state (`lineUserId`, which is
 * `readonly` in the contract), but there is no linking endpoint anywhere in the API —
 * so the affordance is **visibly disabled** with a "coming soon" badge and an
 * explanatory `title`, rather than an enabled button wired to nothing. The
 * prototypes' hard-coded LINE green (`bg-[#00B900]`/`hover:bg-[#009900]` + `text-white`)
 * is dropped entirely: it is unreadable in a dark theme and this project bans
 * hard-coded colours. Semantic tokens carry linked/not-linked instead.
 */
export function AccountInfoCard({
  user,
  onChangePassword,
}: {
  readonly user: SystemUser
  readonly onChangePassword: () => void
}) {
  const linked = user.lineUserId !== null

  return (
    <ProfileCard id="profile-account-title" title={T.cards.account}>
      <ProfileFieldRow label={T.fields.email}>
        <ProfileFieldValue>
          <span className="break-all">{user.email}</span>
        </ProfileFieldValue>
      </ProfileFieldRow>

      <ProfileFieldRow label={T.fields.password}>
        <button
          type="button"
          onClick={onChangePassword}
          className="btn btn-outline btn-neutral btn-xs transition-colors focus-visible:ring-2 focus-visible:ring-primary"
        >
          <KeyIcon className="size-[1.2em]" aria-hidden />
          {T.actions.changePassword}
        </button>
      </ProfileFieldRow>

      <ProfileFieldRow label={T.fields.role}>
        <span className={`badge badge-sm ${ROLE_BADGE[user.role]}`}>{user.role}</span>
      </ProfileFieldRow>

      <ProfileFieldRow label={T.fields.line}>
        <div className="flex flex-wrap items-center gap-2">
          {linked ? (
            <>
              <span className="badge badge-success badge-soft badge-sm">{T.line.linked}</span>
              <span className="font-mono text-xs break-all text-base-content/60">
                {maskLinkedId(user.lineUserId as string)}
              </span>
            </>
          ) : (
            <>
              <span className="text-xs text-base-content/60 sm:text-sm">{T.line.notLinked}</span>
              <button
                type="button"
                disabled
                aria-disabled
                title={T.line.comingSoonHint}
                className="btn btn-outline btn-xs"
              >
                {T.line.connect}
              </button>
              <span className="badge badge-ghost badge-sm">{T.line.comingSoon}</span>
            </>
          )}
        </div>
      </ProfileFieldRow>
    </ProfileCard>
  )
}
