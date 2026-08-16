import { act, renderHook, waitFor } from '@testing-library/react'
import * as apiClient from '@/lib/api-client'
import { ApiError, type Department, type PersonnelRole, type SystemUser } from '@/lib/api-client'
import { useProfileEditor, type UseProfileEditorInput } from '@/hooks/useProfileEditor'
import { PROFILE_STRINGS } from '@/constants/ui-strings-profile'
import { makeSystemUser } from '@tests/helpers/system-user-factory'

// Mock ONLY the network helpers at the api-client boundary (repo convention); `ApiError`
// and the types stay real so the hook's `instanceof ApiError` branches actually fire.
vi.mock('@/lib/api-client', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/api-client')>()
  return {
    ...actual,
    updateOwnProfile: vi.fn(),
    patchSystemUser: vi.fn(),
    listDepartments: vi.fn(),
    listPersonnelRoles: vi.fn(),
  }
})

const mockUpdateOwnProfile = vi.mocked(apiClient.updateOwnProfile)
const mockPatchSystemUser = vi.mocked(apiClient.patchSystemUser)
const mockListDepartments = vi.mocked(apiClient.listDepartments)
const mockListPersonnelRoles = vi.mocked(apiClient.listPersonnelRoles)

function dept(o: Partial<Department> = {}): Department {
  return {
    id: 2,
    name: 'CS',
    isSystemReserved: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    holderCount: 0,
    ...o,
  }
}

function personnelRole(o: Partial<PersonnelRole> = {}): PersonnelRole {
  return {
    id: 1,
    name: 'Director',
    isSystemReserved: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    holderCount: 0,
    ...o,
  }
}

function setup(overrides: Partial<UseProfileEditorInput> = {}) {
  const onCommitted = vi.fn()
  const expireSession = vi.fn()
  const user: SystemUser = overrides.user ?? makeSystemUser()
  const view = renderHook((props: UseProfileEditorInput) => useProfileEditor(props), {
    initialProps: {
      user,
      canEditAssignment: true,
      onCommitted,
      expireSession,
      ...overrides,
    },
  })
  return { ...view, onCommitted, expireSession, user }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockListDepartments.mockResolvedValue([dept(), dept({ id: 3, name: 'Maths' })])
  mockListPersonnelRoles.mockResolvedValue([
    personnelRole(),
    personnelRole({ id: 4, name: 'Manager' }),
  ])
})

describe('useProfileEditor — state machine', () => {
  it('starts in view mode with no draft and no request', () => {
    const { result } = setup()

    expect(result.current.mode).toBe('view')
    expect(result.current.draft).toBeNull()
    expect(mockUpdateOwnProfile).not.toHaveBeenCalled()
  })

  it('startEdit snapshots the current user into the draft', async () => {
    const { result } = setup({
      user: makeSystemUser({ firstName: 'Ada', lastName: 'Lovelace', phoneNumber: '0812345678' }),
    })

    act(() => result.current.startEdit())

    expect(result.current.mode).toBe('edit')
    expect(result.current.draft).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      phoneNumber: '0812345678',
      departmentId: 2,
      personnelRoleId: 1,
    })
    await waitFor(() => expect(result.current.optionsLoaded).toBe(true))
  })

  it('cancel restores the ORIGINAL values, returns to view, and calls NO endpoint', async () => {
    const { result } = setup()
    act(() => result.current.startEdit())
    await waitFor(() => expect(result.current.optionsLoaded).toBe(true))

    act(() => result.current.setField('firstName', 'Grace'))
    expect(result.current.dirty).toBe(true)

    act(() => result.current.cancel())

    expect(result.current.mode).toBe('view')
    expect(result.current.draft).toBeNull()
    expect(result.current.dirty).toBe(false)
    expect(mockUpdateOwnProfile).not.toHaveBeenCalled()
    expect(mockPatchSystemUser).not.toHaveBeenCalled()

    // Re-entering edit shows the ORIGINAL value, not the abandoned one.
    act(() => result.current.startEdit())
    expect(result.current.draft?.firstName).toBe('Ada')
  })

  it('requestSave only opens the confirm step — it sends nothing', async () => {
    const { result } = setup()
    act(() => result.current.startEdit())
    act(() => result.current.setField('firstName', 'Grace'))

    act(() => result.current.requestSave())

    expect(result.current.mode).toBe('confirming')
    expect(mockUpdateOwnProfile).not.toHaveBeenCalled()
  })

  it('dismissConfirm returns to edit with the draft INTACT', async () => {
    const { result } = setup()
    act(() => result.current.startEdit())
    act(() => result.current.setField('firstName', 'Grace'))
    act(() => result.current.requestSave())

    act(() => result.current.dismissConfirm())

    expect(result.current.mode).toBe('edit')
    expect(result.current.draft?.firstName).toBe('Grace')
  })
})

describe('useProfileEditor — payload correctness', () => {
  it('sends EXACTLY the changed field and nothing else', async () => {
    const updated = makeSystemUser({ firstName: 'Grace' })
    mockPatchSystemUser.mockResolvedValue(updated)
    const { result, onCommitted } = setup()

    act(() => result.current.startEdit())
    act(() => result.current.setField('firstName', 'Grace'))
    await act(async () => {
      await result.current.confirmSave()
    })

    expect(mockPatchSystemUser).toHaveBeenCalledTimes(1)
    expect(mockPatchSystemUser).toHaveBeenCalledWith('u1', { firstName: 'Grace' })
    // No lastName, no phoneNumber, and none of the forbidden keys.
    const body = mockPatchSystemUser.mock.calls[0][1]
    expect(Object.keys(body)).toEqual(['firstName'])
    // /auth/system/me no longer accepts identity fields at all — see the hook's header.
    expect(mockUpdateOwnProfile).not.toHaveBeenCalled()
    expect(onCommitted).toHaveBeenCalledWith(updated)
    expect(result.current.mode).toBe('view')
  })

  it('clearing the phone sends null, never an empty string', async () => {
    mockPatchSystemUser.mockResolvedValue(makeSystemUser({ phoneNumber: null }))
    const { result } = setup({ user: makeSystemUser({ phoneNumber: '0812345678' }) })

    act(() => result.current.startEdit())
    act(() => result.current.setField('phoneNumber', '   '))
    await act(async () => {
      await result.current.confirmSave()
    })

    expect(mockPatchSystemUser).toHaveBeenCalledWith('u1', { phoneNumber: null })
  })

  it('saving with NO changes calls neither endpoint (an empty body would be a 400)', async () => {
    const { result } = setup()

    act(() => result.current.startEdit())
    await act(async () => {
      await result.current.confirmSave()
    })

    expect(mockUpdateOwnProfile).not.toHaveBeenCalled()
    expect(mockPatchSystemUser).not.toHaveBeenCalled()
    expect(result.current.mode).toBe('view')
    expect(result.current.notice).toBe(PROFILE_STRINGS.save.noChanges)
  })
})

// The split collapsed on 2026-08-16: identity fields joined the assignment fields on
// PATCH /system-users/:id because UpdateOwnProfileDto no longer accepts them. These tests kept
// their scenarios and changed their expectations, so the history of what this hook used to do
// stays legible next to what it does now.
describe('useProfileEditor — one endpoint, all editable fields', () => {
  it('routes department/position to PATCH /system-users/:id on the OWN id, not to /auth/system/me', async () => {
    const updated = makeSystemUser({ department: { id: 3, name: 'Maths' } })
    mockPatchSystemUser.mockResolvedValue(updated)
    const { result } = setup({ user: makeSystemUser({ id: 'me-1' }) })

    act(() => result.current.startEdit())
    await waitFor(() => expect(result.current.optionsLoaded).toBe(true))
    act(() => result.current.setField('departmentId', 3))
    await act(async () => {
      await result.current.confirmSave()
    })

    expect(mockUpdateOwnProfile).not.toHaveBeenCalled()
    expect(mockPatchSystemUser).toHaveBeenCalledTimes(1)
    expect(mockPatchSystemUser).toHaveBeenCalledWith('me-1', { departmentId: 3 })
  })

  it('a save touching BOTH groups now fires ONE call', async () => {
    const saved = makeSystemUser({
      firstName: 'Grace',
      personnelRole: { id: 4, name: 'Manager' },
    })
    mockPatchSystemUser.mockResolvedValue(saved)
    const { result, onCommitted } = setup()

    act(() => result.current.startEdit())
    await waitFor(() => expect(result.current.optionsLoaded).toBe(true))
    act(() => result.current.setField('firstName', 'Grace'))
    act(() => result.current.setField('personnelRoleId', 4))
    await act(async () => {
      await result.current.confirmSave()
    })

    // ONE request carrying both halves — so there is no longer a partial-save state to reason
    // about, which is the one thing this change made simpler rather than harder.
    expect(mockPatchSystemUser).toHaveBeenCalledTimes(1)
    expect(mockPatchSystemUser).toHaveBeenCalledWith('u1', {
      firstName: 'Grace',
      personnelRoleId: 4,
    })
    expect(mockUpdateOwnProfile).not.toHaveBeenCalled()
    expect(onCommitted).toHaveBeenCalledTimes(1)
    expect(onCommitted).toHaveBeenLastCalledWith(saved)
  })

  it('a failed save applies NOTHING and keeps the draft for a retry', async () => {
    mockPatchSystemUser.mockRejectedValue(new ApiError(400, 'bad'))
    const { result } = setup()

    act(() => result.current.startEdit())
    await waitFor(() => expect(result.current.optionsLoaded).toBe(true))
    act(() => result.current.setField('firstName', 'Grace'))
    act(() => result.current.setField('departmentId', 3))
    await act(async () => {
      await result.current.confirmSave()
    })

    // One request means one outcome: previously a failure here could land the name and drop the
    // department, and the retry had to know which half was already committed.
    expect(mockPatchSystemUser).toHaveBeenCalledTimes(1)
    expect(mockUpdateOwnProfile).not.toHaveBeenCalled()
    expect(result.current.mode).toBe('edit')
    expect(result.current.draft?.firstName).toBe('Grace')
    expect(result.current.error).toBe(PROFILE_STRINGS.save.invalid)
  })

  it('never sends department/position when the actor may not patch their own row (VIEWER)', async () => {
    mockPatchSystemUser.mockResolvedValue(makeSystemUser({ firstName: 'Grace' }))
    const { result } = setup({
      user: makeSystemUser({ role: 'VIEWER' }),
      canEditAssignment: false,
    })

    act(() => result.current.startEdit())
    act(() => result.current.setField('firstName', 'Grace'))
    act(() => result.current.setField('departmentId', 3))
    await act(async () => {
      await result.current.confirmSave()
    })

    // The name still goes, WITHOUT the option ids — `canEditAssignment` gates those only.
    expect(mockPatchSystemUser).toHaveBeenCalledWith('u1', { firstName: 'Grace' })
    expect(mockUpdateOwnProfile).not.toHaveBeenCalled()
    // ⚠️ A VIEWER now gets a 403 from this endpoint's @Roles(SUPER_ADMIN, ADMIN) where they used
    // to get a 200. That is the v2 padlock arriving early, not a regression — and a truthful 403
    // beats dropping the field silently under a success message.
    // A VIEWER never needs the option lists either.
    expect(mockListDepartments).not.toHaveBeenCalled()
  })

  it('a retry re-sends the WHOLE body, because nothing was committed', async () => {
    mockPatchSystemUser.mockRejectedValueOnce(new ApiError(400, 'bad option'))
    const { result } = setup()

    act(() => result.current.startEdit())
    await waitFor(() => expect(result.current.optionsLoaded).toBe(true))
    act(() => result.current.setField('firstName', 'Grace'))
    act(() => result.current.setField('departmentId', 3))
    await act(async () => {
      await result.current.confirmSave()
    })

    expect(mockPatchSystemUser).toHaveBeenCalledTimes(1)

    mockPatchSystemUser.mockResolvedValue(
      makeSystemUser({ firstName: 'Grace', department: { id: 3, name: 'Maths' } }),
    )
    await act(async () => {
      await result.current.confirmSave()
    })

    // The old shape advanced a baseline between the two requests so a retry sent only the failed
    // half. With one request the baseline cannot advance mid-save, so the retry is the same body.
    expect(mockPatchSystemUser).toHaveBeenCalledTimes(2)
    expect(mockPatchSystemUser).toHaveBeenLastCalledWith('u1', {
      firstName: 'Grace',
      departmentId: 3,
    })
  })
})

describe('useProfileEditor — error mapping', () => {
  it('401 expires the session and renders no inline error', async () => {
    mockPatchSystemUser.mockRejectedValue(new ApiError(401, 'dead'))
    const { result, expireSession } = setup()

    act(() => result.current.startEdit())
    act(() => result.current.setField('firstName', 'Grace'))
    await act(async () => {
      await result.current.confirmSave()
    })

    expect(expireSession).toHaveBeenCalledTimes(1)
    expect(result.current.error).toBeNull()
  })

  it('403 is an INLINE error, never a logout', async () => {
    mockPatchSystemUser.mockRejectedValue(new ApiError(403, 'forbidden'))
    const { result, expireSession } = setup()

    act(() => result.current.startEdit())
    act(() => result.current.setField('firstName', 'Grace'))
    await act(async () => {
      await result.current.confirmSave()
    })

    expect(result.current.error).toBe(PROFILE_STRINGS.save.forbidden)
    expect(expireSession).not.toHaveBeenCalled()
  })

  it('404 and unknown failures each map to their own copy', async () => {
    mockPatchSystemUser.mockRejectedValueOnce(new ApiError(404, 'gone'))
    const { result } = setup()

    act(() => result.current.startEdit())
    act(() => result.current.setField('firstName', 'Grace'))
    await act(async () => {
      await result.current.confirmSave()
    })
    expect(result.current.error).toBe(PROFILE_STRINGS.save.notFound)

    mockPatchSystemUser.mockRejectedValueOnce(new Error('offline'))
    await act(async () => {
      await result.current.confirmSave()
    })
    expect(result.current.error).toBe(PROFILE_STRINGS.save.failed)
  })

  it('an option-list failure surfaces a notice instead of failing silently', async () => {
    mockListDepartments.mockRejectedValue(new ApiError(500, 'boom'))
    const { result } = setup()

    act(() => result.current.startEdit())

    await waitFor(() => expect(result.current.optionsError).toBe(PROFILE_STRINGS.options.failed))
    expect(result.current.optionsLoaded).toBe(false)
  })

  // INVERTED (PO review). This test previously asserted
  // `departments.map(d => d.id) === [2]` — i.e. that the hook DROPPED every
  // `isSystemReserved` row. That client-side filter was the bug: `GET /api/v1/departments`
  // already applies `includeReserved: mayUseSystemReservedOptions(actor)` server-side, so
  // a reserved row only ever reaches this hook when the signed-in actor is a SUPER_ADMIN —
  // exactly the role that is allowed to pick it. Filtering here hid the options from the
  // one role entitled to them. The hook now stores the response verbatim; the server is
  // the sole authority on visibility.
  it('keeps system-reserved options verbatim — the server, not the client, decides visibility', async () => {
    mockListDepartments.mockResolvedValue([
      dept(),
      dept({ id: 9, name: 'Reserved', isSystemReserved: true }),
    ])
    mockListPersonnelRoles.mockResolvedValue([
      personnelRole(),
      personnelRole({ id: 8, name: 'Reserved role', isSystemReserved: true }),
    ])
    const { result } = setup()

    act(() => result.current.startEdit())

    await waitFor(() => expect(result.current.optionsLoaded).toBe(true))
    expect(result.current.departments.map((d) => d.id)).toEqual([2, 9])
    expect(result.current.personnelRoles.map((r) => r.id)).toEqual([1, 8])
  })

  it('passes through a response with NO reserved rows unchanged (the ADMIN/STAFF case)', async () => {
    // The backend hides reserved rows from a non-SUPER_ADMIN, so this is what an ADMIN's
    // response looks like. Nothing is added, nothing is dropped.
    mockListDepartments.mockResolvedValue([dept(), dept({ id: 3, name: 'Maths' })])
    const { result } = setup()

    act(() => result.current.startEdit())

    await waitFor(() => expect(result.current.optionsLoaded).toBe(true))
    expect(result.current.departments.map((d) => d.id)).toEqual([2, 3])
    expect(result.current.departments.some((d) => d.isSystemReserved)).toBe(false)
  })
})
