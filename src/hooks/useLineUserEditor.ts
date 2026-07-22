import { useCallback, useRef, useState } from 'react'
import {
  ApiError,
  listDepartments,
  listPersonnelRoles,
  patchLineUserAccess,
  patchLineUserRegistration,
  type AdminUpdateLineUserRegistration,
  type AppAccess,
  type Department,
  type LineUser,
  type LineUserRegistrationSummary,
  type PersonnelRole,
} from '@/lib/api-client'

/**
 * Modal-scoped, Thai-recontextualised save/option copy for the LINE-user editor. Exported
 * (like `LEADS_MESSAGES` in `useLineUsers.ts`) so the hook and its tests read the SAME
 * literal — a message edited out-of-band while a test queried the old string is a silent
 * red (see the app CLAUDE.md note). The staffId-taken message is surfaced as a per-FIELD
 * error near the staffId input; the rest are the modal-level `formError`.
 */
export const EDITOR_MESSAGES = {
  /** registration 409 — the staffId is already taken by another registration. */
  staffIdTaken: 'รหัสพนักงานนี้ถูกใช้แล้ว',
  /** registration 400 — a blank/invalid field or a deleted/unknown/system-reserved option id. */
  invalid: 'ข้อมูลไม่ถูกต้อง โปรดตรวจสอบอีกครั้ง',
  /** 404 (either call) — the row was deleted between load and save. */
  rowGone: 'ผู้ใช้นี้ไม่มีอยู่แล้ว โปรดรีเฟรช',
  /** 403 (either call) — the client gate drifted vs. the server authority. */
  forbidden: 'คุณไม่มีสิทธิ์แก้ไขข้อมูลผู้ใช้รายนี้',
  /** Any other save failure. */
  failed: 'ไม่สามารถบันทึกข้อมูลได้ โปรดลองใหม่อีกครั้ง',
  /** The option-list (department / personnel-role) fetch failed — Save is disabled. */
  optionsFailed: 'ไม่สามารถโหลดตัวเลือกได้ โปรดปิดหน้าต่างแล้วลองใหม่',
} as const

/** The exact six editable registration fields (`AdminUpdateLineUserRegistrationDto`). */
export type DraftRegistration = AdminUpdateLineUserRegistration

export interface UseLineUserEditorInput {
  /** List-sync callback from `useLineUsers`; called after every successful PATCH. */
  updateUserInPlace: (updated: LineUser) => void
  /** Marks the session dead on a 401 (the route guard owns the redirect). */
  expireSession: () => void
}

export interface UseLineUserEditor {
  mode: 'view' | 'edit'
  /**
   * The six-field registration draft, or `null` for an UNREGISTERED follower (no
   * registration row to PATCH — the registration form is not offered for such users).
   */
  draft: DraftRegistration | null
  draftAccess: AppAccess
  /** Derived: any draft field ≠ the last-committed value, or `draftAccess` ≠ current access. */
  dirty: boolean
  saving: boolean
  /** Modal-level save error (`null` when clean). */
  formError: string | null
  /** Per-field staffId error for the 409 (staffId-taken) case (`null` when clean). */
  staffIdError: string | null
  /** Department options (system-reserved rows excluded), lazily fetched on first edit. */
  departments: Department[]
  /** Personnel-role options (system-reserved rows excluded), lazily fetched on first edit. */
  personnelRoles: PersonnelRole[]
  /** True while the option lists are in flight. */
  optionsLoading: boolean
  /** True once both option lists have loaded successfully (cached for the page's lifetime). */
  optionsLoaded: boolean
  /** Non-null when the option-list fetch failed (Save stays disabled; page shows a notice). */
  optionsError: string | null
  /** Seed the draft from a user and switch to edit mode; lazily fetches options if needed. */
  startEdit: (user: LineUser) => void
  /** Discard edits, re-seed from the last-committed state, and return to view mode. No PATCH. */
  cancel: () => void
  /** Update one draft registration field. */
  setDraftField: <K extends keyof DraftRegistration>(key: K, value: DraftRegistration[K]) => void
  /** Update the draft access (status) value. */
  setDraftAccess: (access: AppAccess) => void
  /**
   * Persist the changed PATCH(es) — registration then access, stop-on-failure. Resolves to
   * the freshest committed `LineUser` (so the modal view reflects the save), or `null` when
   * a PATCH failed / the session expired. Success switches back to view mode.
   */
  save: () => Promise<LineUser | null>
  /** Reset all edit state (on modal close). Keeps the cached option lists. */
  reset: () => void
}

const EMPTY_ACCESS: AppAccess = 'UNREGISTERED'

function seedDraft(reg: LineUserRegistrationSummary): DraftRegistration {
  return {
    firstName: reg.firstName,
    lastName: reg.lastName,
    staffId: reg.staffId,
    phone: reg.phone,
    departmentId: reg.departmentId,
    personnelRoleId: reg.personnelRoleId,
  }
}

/** True when any of the six draft fields differs from the committed registration summary. */
function registrationChanged(
  draft: DraftRegistration,
  reg: LineUserRegistrationSummary | null,
): boolean {
  if (!reg) return false
  return (
    draft.firstName !== reg.firstName ||
    draft.lastName !== reg.lastName ||
    draft.staffId !== reg.staffId ||
    draft.phone !== reg.phone ||
    draft.departmentId !== reg.departmentId ||
    draft.personnelRoleId !== reg.personnelRoleId
  )
}

/**
 * The Phase-B two-endpoint edit orchestration for the admin-portal LINE-user modal
 * (plan §5–§7). Owns the edit-mode state (`mode`/`draft`/`draftAccess`/`saving`/errors),
 * the lazy option-list fetch, and the sequential registration→access `save()`. It is
 * deliberately decoupled from `useLineUsers` (it takes `updateUserInPlace` + `expireSession`
 * as inputs) so the trickiest logic is unit-testable at the `@/lib/api-client` boundary,
 * mirroring `useLineUsers`.
 *
 * Save is registration-first, access-last, stop-on-failure: `LineUserResponseDto` embeds
 * `registration`, so each successful response is the freshest full row and is pushed to the
 * list via `updateUserInPlace`. If registration fails, access is NOT attempted. On a partial
 * success (registration committed, access failed) the committed state becomes the new
 * baseline — so `registrationChanged` is now false and a retry re-sends only the access
 * PATCH, with no half-applied ambiguity.
 */
export function useLineUserEditor({
  updateUserInPlace,
  expireSession,
}: UseLineUserEditorInput): UseLineUserEditor {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  /** The last-committed row: the baseline the draft is diffed against. Advances after each PATCH. */
  const [baseUser, setBaseUser] = useState<LineUser | null>(null)
  const [draft, setDraft] = useState<DraftRegistration | null>(null)
  const [draftAccess, setDraftAccessState] = useState<AppAccess>(EMPTY_ACCESS)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [staffIdError, setStaffIdError] = useState<string | null>(null)

  const [departments, setDepartments] = useState<Department[]>([])
  const [personnelRoles, setPersonnelRoles] = useState<PersonnelRole[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [optionsLoaded, setOptionsLoaded] = useState(false)
  const [optionsError, setOptionsError] = useState<string | null>(null)

  // Refs guard the lazy fetch against a stale-closure double-fire (state reads inside the
  // async callback would lag a re-render): fetch once, only if not already loaded/in flight.
  const loadedRef = useRef(false)
  const inFlightRef = useRef(false)

  const ensureOptions = useCallback(async () => {
    if (loadedRef.current || inFlightRef.current) return
    inFlightRef.current = true
    setOptionsLoading(true)
    setOptionsError(null)
    try {
      const [depts, roles] = await Promise.all([listDepartments(), listPersonnelRoles()])
      // Exclude system-reserved options — the backend 400s a reserved id, so an admin must
      // never be able to pick one (plan §6.2, mirrors options-management behavior).
      setDepartments(depts.filter((d) => !d.isSystemReserved))
      setPersonnelRoles(roles.filter((r) => !r.isSystemReserved))
      loadedRef.current = true
      setOptionsLoaded(true)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        expireSession()
        return
      }
      setOptionsError(EDITOR_MESSAGES.optionsFailed)
    } finally {
      inFlightRef.current = false
      setOptionsLoading(false)
    }
  }, [expireSession])

  const startEdit = useCallback(
    (user: LineUser) => {
      setBaseUser(user)
      setDraft(user.registration ? seedDraft(user.registration) : null)
      setDraftAccessState(user.access)
      setFormError(null)
      setStaffIdError(null)
      setMode('edit')
      // Options are only needed for the registration selects — skip the fetch entirely for
      // an UNREGISTERED follower (status-only edit), per the "lazy, once" guard (plan §6.2).
      if (user.registration) void ensureOptions()
    },
    [ensureOptions],
  )

  const cancel = useCallback(() => {
    setDraft(baseUser?.registration ? seedDraft(baseUser.registration) : null)
    setDraftAccessState(baseUser?.access ?? EMPTY_ACCESS)
    setFormError(null)
    setStaffIdError(null)
    setMode('view')
  }, [baseUser])

  const setDraftField = useCallback(
    <K extends keyof DraftRegistration>(key: K, value: DraftRegistration[K]) => {
      setDraft((prev) => (prev ? { ...prev, [key]: value } : prev))
    },
    [],
  )

  const setDraftAccess = useCallback((access: AppAccess) => setDraftAccessState(access), [])

  const reset = useCallback(() => {
    setMode('view')
    setBaseUser(null)
    setDraft(null)
    setDraftAccessState(EMPTY_ACCESS)
    setSaving(false)
    setFormError(null)
    setStaffIdError(null)
    // Intentionally KEEP the cached option lists (fetched once for the page's lifetime).
  }, [])

  const save = useCallback(async (): Promise<LineUser | null> => {
    if (!baseUser) return null
    const id = baseUser.id
    const registrationDirty = draft !== null && registrationChanged(draft, baseUser.registration)
    const accessDirty = draftAccess !== baseUser.access

    if (!registrationDirty && !accessDirty) {
      // Nothing changed — no PATCH; just leave edit mode showing the current data.
      setMode('view')
      return baseUser
    }

    setSaving(true)
    setFormError(null)
    setStaffIdError(null)
    let committed = baseUser

    // (1) Registration — stop the whole save if it fails (do NOT attempt access).
    if (registrationDirty && draft) {
      try {
        committed = await patchLineUserRegistration(id, draft)
        setBaseUser(committed)
        updateUserInPlace(committed)
      } catch (err: unknown) {
        setSaving(false)
        if (err instanceof ApiError && err.status === 401) {
          expireSession()
          return null
        }
        if (err instanceof ApiError && err.status === 409) {
          setStaffIdError(EDITOR_MESSAGES.staffIdTaken)
        } else if (err instanceof ApiError && err.status === 400) {
          setFormError(EDITOR_MESSAGES.invalid)
        } else if (err instanceof ApiError && err.status === 404) {
          setFormError(EDITOR_MESSAGES.rowGone)
        } else if (err instanceof ApiError && err.status === 403) {
          setFormError(EDITOR_MESSAGES.forbidden)
        } else {
          setFormError(EDITOR_MESSAGES.failed)
        }
        return null
      }
    }

    // (2) Access — registration (if any) is already committed + reflected in the list.
    if (accessDirty) {
      try {
        committed = await patchLineUserAccess(id, draftAccess)
        setBaseUser(committed)
        updateUserInPlace(committed)
      } catch (err: unknown) {
        setSaving(false)
        if (err instanceof ApiError && err.status === 401) {
          expireSession()
          return null
        }
        if (err instanceof ApiError && err.status === 404) {
          setFormError(EDITOR_MESSAGES.rowGone)
        } else if (err instanceof ApiError && err.status === 403) {
          setFormError(EDITOR_MESSAGES.forbidden)
        } else {
          setFormError(EDITOR_MESSAGES.failed)
        }
        // Registration (if any) is already committed — return the freshest committed row so
        // the page can re-seed the modal snapshot (a later Cancel then shows saved data).
        return committed
      }
    }

    setSaving(false)
    setMode('view')
    return committed
  }, [baseUser, draft, draftAccess, updateUserInPlace, expireSession])

  const dirty =
    baseUser !== null &&
    ((draft !== null && registrationChanged(draft, baseUser.registration)) ||
      draftAccess !== baseUser.access)

  return {
    mode,
    draft,
    draftAccess,
    dirty,
    saving,
    formError,
    staffIdError,
    departments,
    personnelRoles,
    optionsLoading,
    optionsLoaded,
    optionsError,
    startEdit,
    cancel,
    setDraftField,
    setDraftAccess,
    save,
    reset,
  }
}
