import type { SystemUser } from '@/lib/api-client'
import { PROFILE_STRINGS } from '@/constants/ui-strings-profile'
import { formatThaiDateTime } from '@/lib/format-th-datetime'
import { ProfileCard } from './ProfileCard'
import { ProfileFieldRow, ProfileFieldValue } from './ProfileFieldRow'

const T = PROFILE_STRINGS

/**
 * Audit provenance — four rows, all of which the contract now actually carries
 * (`createdBy` + `updatedAt` were added to `SystemUserResponseDto` for this feature).
 *
 * Nullability, spelled out because two of the four are genuinely nullable:
 *  - `createdBy` is `null` **only** for the seeded first SUPER_ADMIN → renders the
 *    "created by the system" fallback, never a blank row and never a crash.
 *  - `lastLoginAt` is `null` for an account that has never signed in → renders the
 *    em-dash placeholder, never "Invalid Date".
 *  - `createdAt` and `updatedAt` are never null.
 *
 * Rendered for SUPER_ADMIN and ADMIN only. The card is hidden for STAFF as a product
 * decision — their `/auth/system/me` body still carries these fields (the contract is
 * uniform across roles); hiding is UX, not a security control.
 */
export function AuditTrailCard({ user }: { readonly user: SystemUser }) {
  const creator = user.createdBy
  const createdByLabel = creator
    ? `${creator.firstName} ${creator.lastName}`.trim() || T.createdBySystem
    : T.createdBySystem

  return (
    <ProfileCard id="profile-audit-title" title={T.cards.audit} className="md:col-span-2">
      <ProfileFieldRow label={T.fields.createdBy} wide>
        <ProfileFieldValue>{createdByLabel}</ProfileFieldValue>
      </ProfileFieldRow>
      <ProfileFieldRow label={T.fields.createdAt} wide>
        <ProfileFieldValue>{formatThaiDateTime(user.createdAt, T.emptyValue)}</ProfileFieldValue>
      </ProfileFieldRow>
      <ProfileFieldRow label={T.fields.updatedAt} wide>
        <ProfileFieldValue>{formatThaiDateTime(user.updatedAt, T.emptyValue)}</ProfileFieldValue>
      </ProfileFieldRow>
      <ProfileFieldRow label={T.fields.lastLogin} wide>
        <ProfileFieldValue>{formatThaiDateTime(user.lastLoginAt, T.emptyValue)}</ProfileFieldValue>
      </ProfileFieldRow>
    </ProfileCard>
  )
}
