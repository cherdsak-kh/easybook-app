import { act, renderHook, waitFor } from '@testing-library/react'
import * as apiClient from '@/lib/api-client'
import { ApiError, type Department, type PersonnelRole, type SystemUser } from '@/lib/api-client'
import { useProfileEditor, type UseProfileEditorInput } from '@/hooks/useProfileEditor'
import { PROFILE_STRINGS } from '@/constants/ui-strings-profile'
import { makeSystemUser } from '@/test/system-user-factory'

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
    mockUpdateOwnProfile.mockResolvedValue(updated)
    const { result, onCommitted } = setup()

    act(() => result.current.startEdit())
    act(() => result.current.setField('firstName', 'Grace'))
    await act(async () => {
      await result.current.confirmSave()
    })

    expect(mockUpdateOwnProfile).toHaveBeenCalledTimes(1)
    expect(mockUpdateOwnProfile).toHaveBeenCalledWith({ firstName: 'Grace' })
    // No lastName, no phoneNumber, and none of the forbidden keys.
    const body = mockUpdateOwnProfile.mock.calls[0][0]
    expect(Object.keys(body)).toEqual(['firstName'])
    expect(mockPatchSystemUser).not.toHaveBeenCalled()
    expect(onCommitted).toHaveBeenCalledWith(updated)
    expect(result.current.mode).toBe('view')
  })

  it('clearing the phone sends null, never an empty string', async () => {
    mockUpdateOwnProfile.mockResolvedValue(makeSystemUser({ phoneNumber: null }))
    const { result } = setup({ user: makeSystemUser({ phoneNumber: '0812345678' }) })

    act(() => result.current.startEdit())
    act(() => result.current.setField('phoneNumber', '   '))
    await act(async () => {
      await result.current.confirmSave()
    })

    expect(mockUpdateOwnProfile).toHaveBeenCalledWith({ phoneNumber: null })
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

describe('useProfileEditor — the two-endpoint split (by FIELD, not by role)', () => {
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

  it('a save touching BOTH groups fires two sequential calls, profile first', async () => {
    const afterProfile = makeSystemUser({ firstName: 'Grace' })
    const afterAssignment = makeSystemUser({
      firstName: 'Grace',
      personnelRole: { id: 4, name: 'Manager' },
    })
    mockUpdateOwnProfile.mockResolvedValue(afterProfile)
    mockPatchSystemUser.mockResolvedValue(afterAssignment)
    const { result, onCommitted } = setup()

    act(() => result.current.startEdit())
    await waitFor(() => expect(result.current.optionsLoaded).toBe(true))
    act(() => result.current.setField('firstName', 'Grace'))
    act(() => result.current.setField('personnelRoleId', 4))
    await act(async () => {
      await result.current.confirmSave()
    })

    expect(mockUpdateOwnProfile).toHaveBeenCalledWith({ firstName: 'Grace' })
    expect(mockPatchSystemUser).toHaveBeenCalledWith('u1', { personnelRoleId: 4 })
    // Ordering: /auth/system/me strictly before /system-users/:id.
    expect(mockUpdateOwnProfile.mock.invocationCallOrder[0]).toBeLessThan(
      mockPatchSystemUser.mock.invocationCallOrder[0],
    )
    expect(onCommitted).toHaveBeenCalledTimes(2)
    expect(onCommitted).toHaveBeenLastCalledWith(afterAssignment)
  })

  it('STOPS on the first failure — a failed profile PATCH never attempts the assignment PATCH', async () => {
    mockUpdateOwnProfile.mockRejectedValue(new ApiError(400, 'bad'))
    const { result } = setup()

    act(() => result.current.startEdit())
    await waitFor(() => expect(result.current.optionsLoaded).toBe(true))
    act(() => result.current.setField('firstName', 'Grace'))
    act(() => result.current.setField('departmentId', 3))
    await act(async () => {
      await result.current.confirmSave()
    })

    expect(mockUpdateOwnProfile).toHaveBeenCalledTimes(1)
    expect(mockPatchSystemUser).not.toHaveBeenCalled()
    // Stays in edit with the draft preserved so the user can retry.
    expect(result.current.mode).toBe('edit')
    expect(result.current.draft?.firstName).toBe('Grace')
    expect(result.current.error).toBe(PROFILE_STRINGS.save.invalid)
  })

  it('never sends department/position when the actor may not patch their own row (STAFF)', async () => {
    mockUpdateOwnProfile.mockResolvedValue(makeSystemUser({ firstName: 'Grace' }))
    const { result } = setup({
      user: makeSystemUser({ role: 'STAFF' }),
      canEditAssignment: false,
    })

    act(() => result.current.startEdit())
    act(() => result.current.setField('firstName', 'Grace'))
    act(() => result.current.setField('departmentId', 3))
    await act(async () => {
      await result.current.confirmSave()
    })

    expect(mockPatchSystemUser).not.toHaveBeenCalled()
    expect(mockUpdateOwnProfile).toHaveBeenCalledWith({ firstName: 'Grace' })
    // STAFF never needs the option lists either.
    expect(mockListDepartments).not.toHaveBeenCalled()
  })

  it('after a PARTIAL save the baseline advances, so a retry re-sends only the failed half', async () => {
    const afterProfile = makeSystemUser({ firstName: 'Grace' })
    mockUpdateOwnProfile.mockResolvedValue(afterProfile)
    mockPatchSystemUser.mockRejectedValueOnce(new ApiError(400, 'bad option'))
    const { result } = setup()

    act(() => result.current.startEdit())
    await waitFor(() => expect(result.current.optionsLoaded).toBe(true))
    act(() => result.current.setField('firstName', 'Grace'))
    act(() => result.current.setField('departmentId', 3))
    await act(async () => {
      await result.current.confirmSave()
    })

    expect(mockUpdateOwnProfile).toHaveBeenCalledTimes(1)
    expect(mockPatchSystemUser).toHaveBeenCalledTimes(1)

    // Retry: the profile half is already committed, so only the assignment is re-sent.
    mockPatchSystemUser.mockResolvedValue(makeSystemUser({ department: { id: 3, name: 'Maths' } }))
    await act(async () => {
      await result.current.confirmSave()
    })

    expect(mockUpdateOwnProfile).toHaveBeenCalledTimes(1)
    expect(mockPatchSystemUser).toHaveBeenCalledTimes(2)
    expect(mockPatchSystemUser).toHaveBeenLastCalledWith('u1', { departmentId: 3 })
  })
})

describe('useProfileEditor — error mapping', () => {
  it('401 expires the session and renders no inline error', async () => {
    mockUpdateOwnProfile.mockRejectedValue(new ApiError(401, 'dead'))
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
    mockUpdateOwnProfile.mockRejectedValue(new ApiError(403, 'forbidden'))
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
    mockUpdateOwnProfile.mockRejectedValueOnce(new ApiError(404, 'gone'))
    const { result } = setup()

    act(() => result.current.startEdit())
    act(() => result.current.setField('firstName', 'Grace'))
    await act(async () => {
      await result.current.confirmSave()
    })
    expect(result.current.error).toBe(PROFILE_STRINGS.save.notFound)

    mockUpdateOwnProfile.mockRejectedValueOnce(new Error('offline'))
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
