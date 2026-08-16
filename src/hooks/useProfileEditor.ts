import { useCallback, useRef, useState } from 'react'
import {
  ApiError,
  listDepartments,
  listPersonnelRoles,
  patchSystemUser,
  type Department,
  type PersonnelRole,
  type SystemUser,
  type UpdateSystemUserBody,
} from '@/lib/api-client'
import { PROFILE_STRINGS } from '@/constants/ui-strings-profile'

/**
 * `view → edit → confirming → saving → view`. `confirming` exists so the confirm
 * dialog can be dismissed back into `edit` with the draft INTACT; `saving` exists so
 * a double-click cannot fire a second request.
 */
export type ProfileEditMode = 'view' | 'edit' | 'confirming' | 'saving'

/** The five editable fields, flattened. `null` ids mean "the row has no option set". */
export interface ProfileDraft {
  firstName: string
  lastName: string
  /** Raw input text. Blank is normalised to `null` on the wire (the column is nullable). */
  phoneNumber: string
  departmentId: number | null
  personnelRoleId: number | null
}

export interface UseProfileEditorInput {
  /** The committed user, owned by the page (seeded from `getOwnProfile`). */
  user: SystemUser | null
  /**
   * True for SUPER_ADMIN / ADMIN, who may PATCH their OWN `/system-users/:id` row.
   * STAFF is blocked at the backend's `@Roles(SUPER_ADMIN, ADMIN)` guard, so for
   * them the department/position half of the save must never be attempted.
   */
  canEditAssignment: boolean
  /** Push a freshly committed user upward (after each successful PATCH). */
  onCommitted: (user: SystemUser) => void
  /** Mark the session dead on a 401. The route guard owns the redirect. */
  expireSession: () => void
}

export interface UseProfileEditor {
  mode: ProfileEditMode
  /** The live draft, or `null` in `view` mode. */
  draft: ProfileDraft | null
  /** Any draft field differs from the (advancing) committed baseline. */
  dirty: boolean
  /** Save-surface error (`null` when clean). */
  error: string | null
  /** Neutral notice — currently only "nothing changed, so nothing was sent". */
  notice: string | null
  departments: Department[]
  personnelRoles: PersonnelRole[]
  optionsLoading: boolean
  optionsLoaded: boolean
  optionsError: string | null
  /** Snapshot the current user into a draft and enter `edit`; lazily loads options. */
  startEdit: () => void
  /** Restore the ORIGINAL values and return to `view`. Never calls the API. */
  cancel: () => void
  setField: <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => void
  /** `edit → confirming`. Opens the confirm dialog; sends nothing. */
  requestSave: () => void
  /** `confirming → edit`, draft preserved. */
  dismissConfirm: () => void
  /** `confirming → saving → view`. Resolves to the freshest committed user, or `null`. */
  confirmSave: () => Promise<SystemUser | null>
  /** Clear the inline notice/error (e.g. when the user starts typing again). */
  clearFeedback: () => void
}

/** Blank → `null`; the backend column is nullable and `''` would be a 400. */
function normalisePhone(raw: string): string | null {
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

function seedDraft(user: SystemUser): ProfileDraft {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber ?? '',
    departmentId: user.department?.id ?? null,
    personnelRoleId: user.personnelRole?.id ?? null,
  }
}

function draftDiffers(draft: ProfileDraft, user: SystemUser): boolean {
  return (
    draft.firstName !== user.firstName ||
    draft.lastName !== user.lastName ||
    normalisePhone(draft.phoneNumber) !== (user.phoneNumber ?? null) ||
    draft.departmentId !== (user.department?.id ?? null) ||
    draft.personnelRoleId !== (user.personnelRole?.id ?? null)
  )
}

/**
 * The Profile page's whole edit orchestration, JSX-free so the trickiest part — the
 * **two-endpoint, split-by-FIELD save** — is unit-testable at the `@/lib/api-client`
 * boundary. It deliberately mirrors `useLineUserEditor`'s sequential stop-on-failure
 * shape rather than inventing a second pattern.
 *
 * ⚠️ THE SPLIT COLLAPSED ON 2026-08-16 AND THIS HOOK IS ON ITS WAY OUT.
 *
 * `UpdateOwnProfileDto` was cut down to `profilePictureUrl` alone: v2 renders name,
 * position, department and phone behind a padlock because an administrator maintains
 * them, and an endpoint that still accepted them would have made that padlock
 * decorative. So `firstName` / `lastName` / `phoneNumber` no longer have a
 * `PATCH /auth/system/me` to go to, and they now travel with the assignment fields to
 * `PATCH /system-users/:id` on the actor's OWN id — which `canPatch` permits for a
 * SUPER_ADMIN or an ADMIN editing themselves.
 *
 * A VIEWER therefore gets a 403 from `@Roles(SUPER_ADMIN, ADMIN)` where they used to
 * get a 200. That is the new design arriving early rather than a regression, and a
 * truthful 403 is better than the alternative available here — dropping the fields
 * silently, so the operator's edit vanishes with a success message. This portal is
 * deleted at the switch; v2 renders the padlock instead of offering the edit at all.
 *
 * Order is profile-first, assignment-last, **stop-on-failure**: if the profile PATCH
 * fails the assignment PATCH is never attempted. Each success advances the committed
 * baseline, so after a partial save a retry re-sends only the half that failed — no
 * half-applied ambiguity, and no chance of re-sending an already-committed field.
 *
 * Only CHANGED fields are ever sent, and when nothing changed **no request is made at
 * all** — an empty body is a 400 on both endpoints.
 */
export function useProfileEditor({
  user,
  canEditAssignment,
  onCommitted,
  expireSession,
}: UseProfileEditorInput): UseProfileEditor {
  const [mode, setMode] = useState<ProfileEditMode>('view')
  /** The last-committed snapshot the draft is diffed against; advances after each PATCH. */
  const [baseUser, setBaseUser] = useState<SystemUser | null>(null)
  const [draft, setDraft] = useState<ProfileDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [departments, setDepartments] = useState<Department[]>([])
  const [personnelRoles, setPersonnelRoles] = useState<PersonnelRole[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [optionsLoaded, setOptionsLoaded] = useState(false)
  const [optionsError, setOptionsError] = useState<string | null>(null)

  // Refs, not state: a state read inside the async callback lags a re-render, which
  // would let a second `startEdit` fire a duplicate fetch.
  const loadedRef = useRef(false)
  const inFlightRef = useRef(false)

  const ensureOptions = useCallback(async () => {
    if (loadedRef.current || inFlightRef.current) return
    inFlightRef.current = true
    setOptionsLoading(true)
    setOptionsError(null)
    try {
      const [depts, roles] = await Promise.all([listDepartments(), listPersonnelRoles()])
      // Stored VERBATIM — no `isSystemReserved` filter. The SERVER already decides who
      // may see a reserved row: `GET /api/v1/departments` (and the personnel-roles
      // twin) pass `includeReserved: mayUseSystemReservedOptions(actor)`, so a
      // SUPER_ADMIN's response contains the reserved options and everyone else's does
      // not. Re-filtering here used to hide them from the ONE role allowed to pick
      // them, which is the bug this removal fixes; it also duplicated an authorisation
      // decision in the client, where it can only ever drift from the backend.
      setDepartments(depts)
      setPersonnelRoles(roles)
      loadedRef.current = true
      setOptionsLoaded(true)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        expireSession()
        return
      }
      setOptionsError(PROFILE_STRINGS.options.failed)
    } finally {
      inFlightRef.current = false
      setOptionsLoading(false)
    }
  }, [expireSession])

  const startEdit = useCallback(() => {
    if (!user) return
    setBaseUser(user)
    setDraft(seedDraft(user))
    setError(null)
    setNotice(null)
    setMode('edit')
    // Only the dept/position selects need the option lists — STAFF never sees them.
    if (canEditAssignment) void ensureOptions()
  }, [user, canEditAssignment, ensureOptions])

  const cancel = useCallback(() => {
    // Restore the ORIGINAL values exactly; the draft is discarded, nothing is sent.
    setDraft(null)
    setError(null)
    setNotice(null)
    setMode('view')
  }, [])

  const setField = useCallback(
    <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => {
      setDraft((prev) => (prev ? { ...prev, [key]: value } : prev))
      setError(null)
      setNotice(null)
    },
    [],
  )

  const requestSave = useCallback(() => {
    setError(null)
    setNotice(null)
    setMode('confirming')
  }, [])

  const dismissConfirm = useCallback(() => {
    // Back to `edit` with the draft INTACT — dismissing is not cancelling.
    setMode((prev) => (prev === 'confirming' ? 'edit' : prev))
  }, [])

  const clearFeedback = useCallback(() => {
    setError(null)
    setNotice(null)
  }, [])

  /** 401 is the only session-death signal; every other status renders inline. */
  const mapError = useCallback(
    (err: unknown): string | null => {
      if (err instanceof ApiError && err.status === 401) {
        expireSession()
        return null
      }
      if (err instanceof ApiError && err.status === 400) return PROFILE_STRINGS.save.invalid
      if (err instanceof ApiError && err.status === 403) return PROFILE_STRINGS.save.forbidden
      if (err instanceof ApiError && err.status === 404) return PROFILE_STRINGS.save.notFound
      return PROFILE_STRINGS.save.failed
    },
    [expireSession],
  )

  const confirmSave = useCallback(async (): Promise<SystemUser | null> => {
    if (!draft || !baseUser) return null

    // --- Build the two payloads: CHANGED fields only, split by field ---
    // `UpdateOwnProfileDto` is down to the avatar, so identity fields ride with the
    // assignment ones. NOT gated on `canEditAssignment`: that flag is about the
    // department/position selects, and gating a name edit behind it would drop the
    // change silently instead of letting the API answer.
    const assignmentBody: UpdateSystemUserBody = {}
    if (draft.firstName !== baseUser.firstName) assignmentBody.firstName = draft.firstName
    if (draft.lastName !== baseUser.lastName) assignmentBody.lastName = draft.lastName
    const phone = normalisePhone(draft.phoneNumber)
    if (phone !== (baseUser.phoneNumber ?? null)) assignmentBody.phoneNumber = phone

    if (canEditAssignment) {
      if (draft.departmentId !== null && draft.departmentId !== (baseUser.department?.id ?? null)) {
        assignmentBody.departmentId = draft.departmentId
      }
      if (
        draft.personnelRoleId !== null &&
        draft.personnelRoleId !== (baseUser.personnelRole?.id ?? null)
      ) {
        assignmentBody.personnelRoleId = draft.personnelRoleId
      }
    }

    const assignmentDirty = Object.keys(assignmentBody).length > 0

    if (!assignmentDirty) {
      // Send NOTHING: an empty body is a 400 on both endpoints.
      setMode('view')
      setDraft(null)
      setNotice(PROFILE_STRINGS.save.noChanges)
      return baseUser
    }

    setMode('saving')
    setError(null)
    let committed = baseUser

    // ONE request now: name, phone, department and position all go to
    // PATCH /system-users/:id on the actor's own id.
    if (assignmentDirty) {
      try {
        committed = await patchSystemUser(baseUser.id, assignmentBody)
        setBaseUser(committed)
        onCommitted(committed)
      } catch (err: unknown) {
        setMode('edit')
        setError(mapError(err))
        // ⚠️ The draft is left EXACTLY as the operator typed it, and it used to be reconciled
        // against the committed baseline here. That reconciliation existed for the partial save
        // the old two-request shape could produce; with one request nothing is committed when
        // this runs, so merging the baseline back in would silently revert what they just typed
        // and then show them an error about it. Caught by the existing test, not by reading.
        return null
      }
    }

    setMode('view')
    setDraft(null)
    return committed
  }, [draft, baseUser, canEditAssignment, onCommitted, mapError])

  const dirty = draft !== null && baseUser !== null && draftDiffers(draft, baseUser)

  return {
    mode,
    draft,
    dirty,
    error,
    notice,
    departments,
    personnelRoles,
    optionsLoading,
    optionsLoaded,
    optionsError,
    startEdit,
    cancel,
    setField,
    requestSave,
    dismissConfirm,
    confirmSave,
    clearFeedback,
  }
}

