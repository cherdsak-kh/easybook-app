import { act, renderHook, waitFor } from '@testing-library/react'
import * as apiClient from '@/lib/api-client'
import { ApiError, type LineUser, type PaginatedLineUsers } from '@/lib/api-client'
import { LEADS_MESSAGES, useLineUsers } from '@/hooks/useLineUsers'

// The hook depends on `useAuth().expireSession` only — stub it via a hoisted mock so a
// 401 can be observed without standing up the real AuthProvider/getMe probe.
const { mockExpireSession } = vi.hoisted(() => ({ mockExpireSession: vi.fn() }))
vi.mock('@/auth/useAuth', () => ({ useAuth: () => ({ expireSession: mockExpireSession }) }))

// Mock ONLY the two network helpers at the api-client boundary (repo convention); keep
// `ApiError` + the types real so `instanceof ApiError` branches in the hook fire.
vi.mock('@/lib/api-client', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/api-client')>()
  return { ...actual, listLineUsers: vi.fn(), patchLineUserAccess: vi.fn() }
})

const mockList = vi.mocked(apiClient.listLineUsers)
const mockPatch = vi.mocked(apiClient.patchLineUserAccess)

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
    registration: null,
    ...o,
  }
}

function makePage(
  users: LineUser[],
  meta: Partial<PaginatedLineUsers['meta']> = {},
): PaginatedLineUsers {
  return {
    data: users,
    meta: { page: 1, limit: 20, total: users.length, totalPages: 1, ...meta },
  }
}

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockList.mockResolvedValue(makePage([makeUser()]))
})

describe('useLineUsers — load lifecycle', () => {
  it('starts loading, then populates rows from a successful list', async () => {
    const { result } = renderHook(() => useLineUsers())

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.users).toHaveLength(1)
    expect(result.current.error).toBeNull()
    expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20 }))
  })

  it('treats a page-past-end 200 (empty data) as empty, not an error', async () => {
    mockList.mockResolvedValue(makePage([], { page: 5, total: 3, totalPages: 1 }))
    const { result } = renderHook(() => useLineUsers())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.users).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('maps a generic load failure to the generic error copy', async () => {
    mockList.mockRejectedValue(new ApiError(500, 'boom'))
    const { result } = renderHook(() => useLineUsers())

    await waitFor(() => expect(result.current.error).toBe(LEADS_MESSAGES.loadFailed))
    expect(result.current.loading).toBe(false)
  })

  it('maps a 403 load to the distinct forbidden copy', async () => {
    mockList.mockRejectedValue(new ApiError(403, 'nope'))
    const { result } = renderHook(() => useLineUsers())

    await waitFor(() => expect(result.current.error).toBe(LEADS_MESSAGES.loadForbidden))
  })

  it('expires the session on a 401 load and sets no render error (guard handles redirect)', async () => {
    mockList.mockRejectedValue(new ApiError(401, 'dead'))
    const { result } = renderHook(() => useLineUsers())

    await waitFor(() => expect(mockExpireSession).toHaveBeenCalledTimes(1))
    expect(result.current.error).toBeNull()
  })
})

describe('useLineUsers — pagination, search, filter', () => {
  it('setPage refetches with the new page', async () => {
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.setPage(2))
    await waitFor(() =>
      expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })),
    )
    expect(result.current.page).toBe(2)
  })

  it('exposes totalPages from the response meta', async () => {
    mockList.mockResolvedValue(makePage([makeUser()], { total: 45, totalPages: 3 }))
    const { result } = renderHook(() => useLineUsers())

    await waitFor(() => expect(result.current.totalPages).toBe(3))
  })

  it('setAccessFilter resets to page 1 and refetches with the access param', async () => {
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.setPage(3))
    await waitFor(() => expect(result.current.page).toBe(3))

    act(() => result.current.setAccessFilter('ALLOWED'))
    expect(result.current.page).toBe(1)
    await waitFor(() =>
      expect(mockList).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, access: 'ALLOWED' }),
      ),
    )
  })

  it('setSearch resets to page 1 and refetches (debounced) with the search term', async () => {
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.setSearch('bob'))
    expect(result.current.page).toBe(1)
    await waitFor(() =>
      expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'bob', page: 1 })),
    )
  })
})

describe('useLineUsers — changeAccess', () => {
  it('optimistically replaces the row in place on success, without a full refetch', async () => {
    mockList.mockResolvedValue(makePage([makeUser({ id: 'lu1', access: 'PENDING' })]))
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))

    mockPatch.mockResolvedValue(makeUser({ id: 'lu1', access: 'ALLOWED' }))
    const listCallsBefore = mockList.mock.calls.length

    await act(async () => {
      await result.current.changeAccess(result.current.users[0], 'ALLOWED')
    })

    expect(result.current.users[0].access).toBe('ALLOWED')
    expect(result.current.pendingId).toBeNull()
    expect(mockList.mock.calls.length).toBe(listCallsBefore) // no refetch
  })

  it('expires the session on a 401 mutation and sets no row error', async () => {
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))

    mockPatch.mockRejectedValue(new ApiError(401, 'dead'))
    await act(async () => {
      await result.current.changeAccess(result.current.users[0], 'ALLOWED')
    })

    expect(mockExpireSession).toHaveBeenCalledTimes(1)
    expect(result.current.rowError).toBeNull()
  })

  it('maps a 404 mutation to the "row gone" notice', async () => {
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))

    mockPatch.mockRejectedValue(new ApiError(404, 'gone'))
    await act(async () => {
      await result.current.changeAccess(result.current.users[0], 'ALLOWED')
    })

    expect(result.current.rowError).toBe(LEADS_MESSAGES.rowGone)
    expect(mockExpireSession).not.toHaveBeenCalled()
  })

  it('maps a 403 mutation to the "forbidden" notice', async () => {
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))

    mockPatch.mockRejectedValue(new ApiError(403, 'forbidden'))
    await act(async () => {
      await result.current.changeAccess(result.current.users[0], 'BLOCKED')
    })

    expect(result.current.rowError).toBe(LEADS_MESSAGES.rowForbidden)
  })

  it('maps any other mutation failure to the generic row error', async () => {
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))

    mockPatch.mockRejectedValue(new Error('offline'))
    await act(async () => {
      await result.current.changeAccess(result.current.users[0], 'ALLOWED')
    })

    expect(result.current.rowError).toBe(LEADS_MESSAGES.rowFailed)
  })
})

describe('useLineUsers — updateUserInPlace', () => {
  it('replaces a single row by id without a refetch, leaving others untouched', async () => {
    mockList.mockResolvedValue(
      makePage([makeUser({ id: 'lu1', access: 'PENDING' }), makeUser({ id: 'lu2', access: 'PENDING' })]),
    )
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const listCallsBefore = mockList.mock.calls.length

    act(() => result.current.updateUserInPlace(makeUser({ id: 'lu2', access: 'ALLOWED' })))

    expect(result.current.users.find((u) => u.id === 'lu2')?.access).toBe('ALLOWED')
    expect(result.current.users.find((u) => u.id === 'lu1')?.access).toBe('PENDING')
    expect(mockList.mock.calls.length).toBe(listCallsBefore) // no refetch
  })
})

describe('useLineUsers — race guard', () => {
  it('ignores a stale (superseded) list resolution', async () => {
    const first = deferred<PaginatedLineUsers>()
    const second = deferred<PaginatedLineUsers>()
    mockList
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
      .mockReturnValue(new Promise<PaginatedLineUsers>(() => {})) // never-resolving safety net

    const { result } = renderHook(() => useLineUsers())

    // Supersede the in-flight page-1 fetch with a page-2 fetch.
    act(() => result.current.setPage(2))

    // Resolve the NEWER (page-2) request first — it wins.
    await act(async () => {
      second.resolve(makePage([makeUser({ id: 'p2' })], { page: 2 }))
    })
    await waitFor(() => expect(result.current.users[0]?.id).toBe('p2'))

    // Now resolve the STALE page-1 request — it must be dropped, not clobber page 2.
    await act(async () => {
      first.resolve(makePage([makeUser({ id: 'p1' })], { page: 1 }))
    })

    expect(result.current.users[0]?.id).toBe('p2')
  })
})
