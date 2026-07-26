import type { SystemUser, SystemUserOption } from '@/lib/api-client'
import type { ProfileDraft, UseProfileEditor } from '@/hooks/useProfileEditor'
import { PROFILE_STRINGS } from '@/constants/ui-strings-profile'
import { ProfileCard } from './ProfileCard'
import { ProfileFieldRow, ProfileFieldValue } from './ProfileFieldRow'

const T = PROFILE_STRINGS

/** Every control on this card, so ids stay in one place and match their `<label htmlFor>`. */
const ID = {
  firstName: 'profile-first-name',
  lastName: 'profile-last-name',
  phone: 'profile-phone',
  department: 'profile-department',
  position: 'profile-position',
} as const

/**
 * Personal card. Two shapes, chosen by role:
 *
 *  - **STAFF** (`editable={false}`) — every value is plain text. There is no `<input>`
 *    and no `<select>` in the DOM at all, because STAFF has no edit affordance and
 *    `PATCH /system-users/:id` 403s them at the guard.
 *  - **SUPER_ADMIN / ADMIN** — real form controls whose `readOnly`/`disabled` state is
 *    DECLARATIVE (driven by the editor's mode), which is the React translation of the
 *    prototypes' `classList.add/removeAttribute` toggling.
 *
 * The prototypes' `"1 (IT Department)"` / `"5 (Director)"` are placeholder shorthand:
 * the option **name** renders, never the raw id (the id lives only in `<option value>`).
 *
 * daisyUI v4→v5: `form-control` / `label-text` are gone (the label lives in
 * `ProfileFieldRow`), and `input-bordered` / `select-bordered` no longer exist — the
 * bare `input` / `select` classes are bordered by default in v5.
 */
export function PersonalInfoCard({
  user,
  editor,
  editable,
}: {
  readonly user: SystemUser
  readonly editor: UseProfileEditor
  /** False for STAFF: render read-only text with no form control at all. */
  readonly editable: boolean
}) {
  const { draft, mode, setField, departments, personnelRoles, optionsLoading, optionsLoaded } =
    editor
  const editing = draft !== null && mode !== 'view'
  const saving = mode === 'saving'

  if (!editable) {
    return (
      <ProfileCard id="profile-personal-title" title={T.cards.personal}>
        <ReadOnlyRows user={user} />
      </ProfileCard>
    )
  }

  // In view mode there is no draft, so the controls read straight from the committed
  // user; entering edit swaps in the draft. Same markup either way — only `readOnly`
  // / `disabled` change, which is the declarative version of the prototypes' runtime
  // `removeAttribute('readonly')` juggling.
  const values: ProfileDraft = draft ?? {
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber ?? '',
    departmentId: user.department?.id ?? null,
    personnelRoleId: user.personnelRole?.id ?? null,
  }

  return (
    <ProfileCard id="profile-personal-title" title={T.cards.personal}>
      <ProfileFieldRow label={T.fields.firstName} htmlFor={ID.firstName}>
        <TextField
          id={ID.firstName}
          value={values.firstName}
          editing={editing}
          disabled={saving}
          onChange={(v) => setField('firstName', v)}
        />
      </ProfileFieldRow>

      <ProfileFieldRow label={T.fields.lastName} htmlFor={ID.lastName}>
        <TextField
          id={ID.lastName}
          value={values.lastName}
          editing={editing}
          disabled={saving}
          onChange={(v) => setField('lastName', v)}
        />
      </ProfileFieldRow>

      <ProfileFieldRow label={T.fields.phone} htmlFor={ID.phone}>
        <TextField
          id={ID.phone}
          type="tel"
          value={values.phoneNumber}
          editing={editing}
          disabled={saving}
          onChange={(v) => setField('phoneNumber', v)}
        />
      </ProfileFieldRow>

      <ProfileFieldRow label={T.fields.department} htmlFor={ID.department}>
        <OptionSelect
          id={ID.department}
          value={values.departmentId}
          current={user.department}
          options={departments}
          editing={editing}
          disabled={saving}
          loading={optionsLoading}
          loaded={optionsLoaded}
          onChange={(v) => setField('departmentId', v)}
        />
      </ProfileFieldRow>

      <ProfileFieldRow label={T.fields.position} htmlFor={ID.position}>
        <OptionSelect
          id={ID.position}
          value={values.personnelRoleId}
          current={user.personnelRole}
          options={personnelRoles}
          editing={editing}
          disabled={saving}
          loading={optionsLoading}
          loaded={optionsLoaded}
          onChange={(v) => setField('personnelRoleId', v)}
        />
      </ProfileFieldRow>
    </ProfileCard>
  )
}

/** The STAFF (and pre-draft) shape: five plain-text values, no controls. */
function ReadOnlyRows({ user }: { readonly user: SystemUser }) {
  return (
    <>
      <ProfileFieldRow label={T.fields.firstName}>
        <ProfileFieldValue>{user.firstName || T.emptyValue}</ProfileFieldValue>
      </ProfileFieldRow>
      <ProfileFieldRow label={T.fields.lastName}>
        <ProfileFieldValue>{user.lastName || T.emptyValue}</ProfileFieldValue>
      </ProfileFieldRow>
      <ProfileFieldRow label={T.fields.phone}>
        <ProfileFieldValue>{user.phoneNumber || T.emptyValue}</ProfileFieldValue>
      </ProfileFieldRow>
      <ProfileFieldRow label={T.fields.department}>
        <ProfileFieldValue>{user.department?.name || T.emptyValue}</ProfileFieldValue>
      </ProfileFieldRow>
      <ProfileFieldRow label={T.fields.position}>
        <ProfileFieldValue>{user.personnelRole?.name || T.emptyValue}</ProfileFieldValue>
      </ProfileFieldRow>
    </>
  )
}

/**
 * A text input that is flat + `readOnly` in view mode and bordered + writable in edit
 * mode. Both states are one declarative render, so there is no imperative class
 * juggling and no chance of the DOM and the state disagreeing.
 */
function TextField({
  id,
  value,
  editing,
  disabled,
  onChange,
  type = 'text',
}: {
  readonly id: string
  readonly value: string
  readonly editing: boolean
  readonly disabled: boolean
  readonly onChange: (value: string) => void
  readonly type?: 'text' | 'tel'
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      readOnly={!editing}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={`input input-sm w-full transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
        editing ? '' : 'border-transparent bg-base-200'
      }`}
    />
  )
}

/**
 * A department/position `<select>` bound to the integer option id.
 *
 * In view mode it holds exactly the current option, so the right NAME shows without
 * waiting on the option lists. In edit mode it holds the loaded list — and if the
 * user's current option is missing from it (a system-reserved or since-deleted row),
 * that option is pinned as a DISABLED entry so the control still displays the real
 * value and can never silently rewrite it to whatever happens to be first.
 */
function OptionSelect({
  id,
  value,
  current,
  options,
  editing,
  disabled,
  loading,
  loaded,
  onChange,
}: {
  readonly id: string
  readonly value: ProfileDraft['departmentId']
  readonly current: SystemUserOption | undefined
  readonly options: readonly { id: number; name: string }[]
  readonly editing: boolean
  readonly disabled: boolean
  readonly loading: boolean
  readonly loaded: boolean
  readonly onChange: (value: number) => void
}) {
  const usable = editing && loaded && !disabled

  // One flat, de-duplicated option list so the controlled `value` always matches a
  // rendered <option> — otherwise the browser silently displays the first entry while
  // the draft still holds the old id, and a "save" would look applied but be a no-op.
  const entries: { id: number; name: string; locked?: boolean }[] = []
  if (editing && loaded) {
    entries.push(...options.map((o) => ({ id: o.id, name: o.name })))
  }
  if (current != null && !entries.some((e) => e.id === current.id)) {
    // Pinned when the list has not loaded yet, or when the current option is absent
    // from it (system-reserved / since-deleted). Locked in the latter case so it can
    // be displayed but never re-picked.
    entries.unshift({
      id: current.id,
      name: editing && !loaded && loading ? T.options.loading : current.name,
      locked: editing && loaded,
    })
  }

  return (
    <select
      id={id}
      value={value ?? ''}
      disabled={!usable}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`select select-sm w-full transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
        editing ? '' : 'border-transparent bg-base-200'
      }`}
    >
      {value == null && (
        <option value="" disabled>
          {T.emptyValue}
        </option>
      )}
      {entries.map((e) => (
        <option key={e.id} value={e.id} disabled={e.locked}>
          {e.name}
        </option>
      ))}
    </select>
  )
}
