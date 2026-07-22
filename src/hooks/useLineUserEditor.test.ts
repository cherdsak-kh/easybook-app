import { act, renderHook, waitFor } from '@testing-library/react'
import * as apiClient from '@/lib/api-client'
import { ApiError, type Department, type LineUser, type PersonnelRole } from '@/lib/api-client'
import { EDITOR_MESSAGES, useLineUserEditor } from '@/hooks/useLineUserEditor'

// Mock ONLY the four network helpers at the api-client boundary (repo convention); keep
// `ApiError` + the types real so the hook's `instanceof ApiError` branches fire.
vi.mock('@/lib/api-client', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/api-client')>()
  return {
    ...actual,
    patchLineUserRegistration: vi.fn(),
    patchLineUserAccess: vi.fn(),
    listDepartments: vi.fn(),
    listPersonnelRoles: vi.fn(),
  }
})

const mockPatchReg = vi.mocked(apiClient.patchLineUserRegistration)
const mockPatchAccess = vi.mocked(apiClient.patchLineUserAccess)
const mockListDepartments = vi.mocked(apiClient.listDepartments)
const mockListPersonnelRoles = vi.mocked(apiClient.listPersonnelRoles)

function makeUser(o: Partial<LineUser> = {}): LineUser {
  return {
    id: 'lu1',
    lineUserId: 'U0123456789abcdef0123456789abcdef',
    displayName: 'Alice',
    pictureUrl: null,
    statusMessage: null,
    richMenuType: 'TYPE_1',
    access: 'PENDING',
    followedAt: '2026-07-07T10:00:00.000Z',
    registration: {
      firstName: 'Alice',
      lastName: 'Wong',
      staffId: 'STAFF-123',
      phone: '0812345678',
      departmentId: 1,
      department: 'Computer Science',
      personnelRoleId: 1,
      personnelRole: 'Teacher',
    },
    ...o,
  }
}

function dept(o: Partial<Department> = {}): Department {
  return {
    id: 1,
    name: 'Computer Science',
    isSystemReserved: false,
    createdAt: '2026-07-14T10:00:00.000Z',
    updatedAt: '2026-07-14T10:00:00.000Z',
    ...o,
  }
}

function role(o: Partial<PersonnelRole> = {}): PersonnelRole {
  return {
    id: 1,
    name: 'Teacher',
    isSystemReserved: false,
    createdAt: '2026-07-14T10:00:00.000Z',
    updatedAt: '2026-07-14T10:00:00.000Z',
    ...o,
  }
}

function setup() {
  const updateUserInPlace = vi.fn()
  const expireSession = vi.fn()
  const { result } = renderHook(() => useLineUserEditor({ updateUserInPlace, expireSession }))
  return { result, updateUserInPlace, expireSession }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockListDepartments.mockResolvedValue([dept()])
  mockListPersonnelRoles.mockResolvedValue([role()])
})

describe('useLineUserEditor — edit lifecycle', () => {
  it('startEdit seeds the six-field draft + access from the user, in edit mode', () => {
    const { result } = setup()
    act(() => result.current.startEdit(makeUser()))

    expect(result.current.mode).toBe('edit')
    expect(result.current.draft).toEqual({
      firstName: 'Alice',
      lastName: 'Wong',
      staffId: 'STAFF-123',
      phone: '0812345678',
      departmentId: 1,
      personnelRoleId: 1,
    })
    expect(result.current.draftAccess).toBe('PENDING')
    expect(result.current.dirty).toBe(false)
  })

  it('a null-registration (UNREGISTERED) user gets a null draft and no option fetch', () => {
    const { result } = setup()
    act(() => result.current.startEdit(makeUser({ registration: null, access: 'UNREGISTERED' })))

    expect(result.current.draft).toBeNull()
    expect(result.current.draftAccess).toBe('UNREGISTERED')
    expect(mockListDepartments).not.toHaveBeenCalled()
    expect(mockListPersonnelRoles).not.toHaveBeenCalled()
  })

  it('cancel discards edits and returns to view without any PATCH', () => {
    const { result } = setup()
    act(() => result.current.startEdit(makeUser()))
    act(() => result.current.setDraftField('firstName', 'Bob'))
    expect(result.current.dirty).toBe(true)

    act(() => result.current.cancel())
    expect(result.current.mode).toBe('view')
    expect(result.current.draft?.firstName).toBe('Alice')
    expect(mockPatchReg).not.toHaveBeenCalled()
    expect(mockPatchAccess).not.toHaveBeenCalled()
  })
})

describe('useLineUserEditor — option lists', () => {
  it('lazily fetches the option lists once and excludes system-reserved rows', async () => {
    mockListDepartments.mockResolvedValue([dept({ id: 1, name: 'CS' }), dept({ id: 9, name: 'Reserved', isSystemReserved: true })])
    mockListPersonnelRoles.mockResolvedValue([role({ id: 1, name: 'Teacher' }), role({ id: 9, name: 'Reserved', isSystemReserved: true })])

    const { result } = setup()
    act(() => result.current.startEdit(makeUser()))

    await waitFor(() => expect(result.current.optionsLoaded).toBe(true))
    expect(result.current.departments).toEqual([expect.objectContaining({ id: 1, name: 'CS' })])
    expect(result.current.personnelRoles).toEqual([expect.objectContaining({ id: 1, name: 'Teacher' })])

    // Re-entering edit does NOT refetch (cached once for the page's lifetime).
    act(() => result.current.startEdit(makeUser()))
    await waitFor(() => expect(result.current.optionsLoaded).toBe(true))
    expect(mockListDepartments).toHaveBeenCalledTimes(1)
    expect(mockListPersonnelRoles).toHaveBeenCalledTimes(1)
  })

  it('surfaces an option-load failure and leaves optionsLoaded false', async () => {
    mockListDepartments.mockRejectedValue(new ApiError(500, 'boom'))
    const { result } = setup()
    act(() => result.current.startEdit(makeUser()))

    await waitFor(() => expect(result.current.optionsError).toBe(EDITOR_MESSAGES.optionsFailed))
    expect(result.current.optionsLoaded).toBe(false)
  })

  it('expires the session on a 401 option-load and sets no option error', async () => {
    mockListDepartments.mockRejectedValue(new ApiError(401, 'dead'))
    const { result, expireSession } = setup()
    act(() => result.current.startEdit(makeUser()))

    await waitFor(() => expect(expireSession).toHaveBeenCalledTimes(1))
    expect(result.current.optionsError).toBeNull()
  })
})

describe('useLineUserEditor — save orchestration (§7)', () => {
  it('registration-only: PATCHes registration with the six-field draft, updates in place, no access call', async () => {
    const { result, updateUserInPlace } = setup()
    act(() => result.current.startEdit(makeUser()))
    act(() => result.current.setDraftField('firstName', 'Bob'))

    const saved = makeUser({ registration: { ...makeUser().registration!, firstName: 'Bob' } })
    mockPatchReg.mockResolvedValue(saved)

    let returned: LineUser | null = null
    await act(async () => {
      returned = await result.current.save()
    })

    expect(mockPatchReg).toHaveBeenCalledWith('lu1', {
      firstName: 'Bob',
      lastName: 'Wong',
      staffId: 'STAFF-123',
      phone: '0812345678',
      departmentId: 1,
      personnelRoleId: 1,
    })
    expect(mockPatchAccess).not.toHaveBeenCalled()
    expect(updateUserInPlace).toHaveBeenCalledTimes(1)
    expect(updateUserInPlace).toHaveBeenCalledWith(saved)
    expect(returned).toEqual(saved)
    expect(result.current.mode).toBe('view')
  })

  it('access-only: PATCHes access, updates in place, no registration call', async () => {
    const { result, updateUserInPlace } = setup()
    act(() => result.current.startEdit(makeUser()))
    act(() => result.current.setDraftAccess('ALLOWED'))

    const saved = makeUser({ access: 'ALLOWED' })
    mockPatchAccess.mockResolvedValue(saved)

    await act(async () => {
      await result.current.save()
    })

    expect(mockPatchAccess).toHaveBeenCalledWith('lu1', 'ALLOWED')
    expect(mockPatchReg).not.toHaveBeenCalled()
    expect(updateUserInPlace).toHaveBeenCalledWith(saved)
    expect(result.current.mode).toBe('view')
  })

  it('both changed: PATCHes registration THEN access, updates in place after each, returns the final row', async () => {
    const { result, updateUserInPlace } = setup()
    act(() => result.current.startEdit(makeUser()))
    act(() => result.current.setDraftField('lastName', 'Ng'))
    act(() => result.current.setDraftAccess('ALLOWED'))

    const afterReg = makeUser({ registration: { ...makeUser().registration!, lastName: 'Ng' } })
    const afterAccess = makeUser({ access: 'ALLOWED', registration: afterReg.registration })
    mockPatchReg.mockResolvedValue(afterReg)
    mockPatchAccess.mockResolvedValue(afterAccess)

    let returned: LineUser | null = null
    await act(async () => {
      returned = await result.current.save()
    })

    // Registration first, access second.
    expect(mockPatchReg.mock.invocationCallOrder[0]).toBeLessThan(
      mockPatchAccess.mock.invocationCallOrder[0],
    )
    expect(updateUserInPlace).toHaveBeenNthCalledWith(1, afterReg)
    expect(updateUserInPlace).toHaveBeenNthCalledWith(2, afterAccess)
    expect(returned).toEqual(afterAccess)
    expect(result.current.mode).toBe('view')
  })

  it('registration failure ABORTS access (access is never attempted) and keeps the modal in edit mode', async () => {
    const { result, updateUserInPlace } = setup()
    act(() => result.current.startEdit(makeUser()))
    act(() => result.current.setDraftField('staffId', 'DUPE'))
    act(() => result.current.setDraftAccess('ALLOWED'))

    mockPatchReg.mockRejectedValue(new ApiError(409, 'taken'))

    let returned: LineUser | null = makeUser()
    await act(async () => {
      returned = await result.current.save()
    })

    expect(mockPatchAccess).not.toHaveBeenCalled()
    expect(updateUserInPlace).not.toHaveBeenCalled()
    expect(returned).toBeNull()
    expect(result.current.mode).toBe('edit')
    expect(result.current.staffIdError).toBe(EDITOR_MESSAGES.staffIdTaken)
  })

  it('partial success (registration ok, access fails): commits + syncs registration, retains draftAccess, drops registrationDirty', async () => {
    const { result, updateUserInPlace } = setup()
    act(() => result.current.startEdit(makeUser()))
    act(() => result.current.setDraftField('lastName', 'Ng'))
    act(() => result.current.setDraftAccess('ALLOWED'))

    const afterReg = makeUser({ registration: { ...makeUser().registration!, lastName: 'Ng' } })
    mockPatchReg.mockResolvedValue(afterReg)
    mockPatchAccess.mockRejectedValue(new ApiError(500, 'boom'))

    await act(async () => {
      await result.current.save()
    })

    expect(updateUserInPlace).toHaveBeenCalledTimes(1)
    expect(updateUserInPlace).toHaveBeenCalledWith(afterReg)
    expect(result.current.mode).toBe('edit')
    expect(result.current.formError).toBe(EDITOR_MESSAGES.failed)
    // The registration commit is now the baseline; a retry re-sends ONLY the access PATCH.
    mockPatchReg.mockClear()
    const afterAccess = makeUser({ access: 'ALLOWED', registration: afterReg.registration })
    mockPatchAccess.mockResolvedValue(afterAccess)
    await act(async () => {
      await result.current.save()
    })
    expect(mockPatchReg).not.toHaveBeenCalled()
    expect(mockPatchAccess).toHaveBeenCalledWith('lu1', 'ALLOWED')
    expect(result.current.mode).toBe('view')
  })

  it('a no-op save (nothing dirty) issues no PATCH and returns to view', async () => {
    const { result, updateUserInPlace } = setup()
    act(() => result.current.startEdit(makeUser()))

    await act(async () => {
      await result.current.save()
    })

    expect(mockPatchReg).not.toHaveBeenCalled()
    expect(mockPatchAccess).not.toHaveBeenCalled()
    expect(updateUserInPlace).not.toHaveBeenCalled()
    expect(result.current.mode).toBe('view')
  })
})

describe('useLineUserEditor — error mapping (§7)', () => {
  async function saveWith(status: number, onCall: 'reg' | 'access') {
    const { result, expireSession } = setup()
    act(() => result.current.startEdit(makeUser()))
    if (onCall === 'reg') {
      act(() => result.current.setDraftField('firstName', 'Bob'))
      mockPatchReg.mockRejectedValue(new ApiError(status, 'x'))
    } else {
      act(() => result.current.setDraftAccess('ALLOWED'))
      mockPatchAccess.mockRejectedValue(new ApiError(status, 'x'))
    }
    await act(async () => {
      await result.current.save()
    })
    return { result, expireSession }
  }

  it('registration 409 → the per-field staffId-taken error (not a modal error)', async () => {
    const { result } = await saveWith(409, 'reg')
    expect(result.current.staffIdError).toBe(EDITOR_MESSAGES.staffIdTaken)
    expect(result.current.formError).toBeNull()
  })

  it('registration 400 → the invalid-data message', async () => {
    const { result } = await saveWith(400, 'reg')
    expect(result.current.formError).toBe(EDITOR_MESSAGES.invalid)
  })

  it('404 → the row-gone message', async () => {
    const { result } = await saveWith(404, 'reg')
    expect(result.current.formError).toBe(EDITOR_MESSAGES.rowGone)
  })

  it('access 403 → the forbidden message', async () => {
    const { result } = await saveWith(403, 'access')
    expect(result.current.formError).toBe(EDITOR_MESSAGES.forbidden)
  })

  it('a non-ApiError / other status → the generic failure message', async () => {
    const { result } = setup()
    act(() => result.current.startEdit(makeUser()))
    act(() => result.current.setDraftField('firstName', 'Bob'))
    mockPatchReg.mockRejectedValue(new Error('offline'))
    await act(async () => {
      await result.current.save()
    })
    expect(result.current.formError).toBe(EDITOR_MESSAGES.failed)
  })

  it('401 (either call) → expireSession and NO modal error', async () => {
    const { result, expireSession } = await saveWith(401, 'access')
    expect(expireSession).toHaveBeenCalledTimes(1)
    expect(result.current.formError).toBeNull()
  })
})
