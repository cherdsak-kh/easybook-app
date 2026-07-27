import { act, renderHook, waitFor } from '@testing-library/react'
import * as apiClient from '@/lib/api-client'
import { ApiError, type LineUser, type PaginatedLineUsers } from '@/lib/api-client'
import {
  CLIENT_PAGE_SIZE,
  FETCH_PAGE_SIZE,
  LEADS_MESSAGES,
  MAX_PAGES,
  useLineUsers,
} from '@/hooks/useLineUsers'
import { REALTIME_EVENTS } from '@/lib/realtime'
import { latestFakeSocket, resetFakeSockets } from '@/test/fake-socket'

// The hook depends on `useAuth().expireSession` (401s) and `.status` (the socket opens only
// once the session probe reports authenticated — AC F7). Stub both via a hoisted mock so
// neither needs the real AuthProvider/getMe probe.
const { mockExpireSession } = vi.hoisted(() => ({ mockExpireSession: vi.fn() }))
vi.mock('@/auth/useAuth', () => ({
  useAuth: () => ({ status: 'authenticated', expireSession: mockExpireSession }),
}))

// Mock ONLY the two network helpers at the api-client boundary (repo convention); keep
// `ApiError` + the types real so `instanceof ApiError` branches in the hook fire.
vi.mock('@/lib/api-client', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/api-client')>()
  return { ...actual, listLineUsers: vi.fn(), patchLineUserAccess: vi.fn() }
})

// Same boundary treatment for the socket: replace ONLY the factory, so these specs drive
// real events through a real emitter and never open a connection. `isRealtimeEnabled` and
// the event-name constants stay real.
vi.mock('@/lib/realtime', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/realtime')>()
  const { createFakeRealtimeSocket } = await import('@/test/fake-socket')
  return { ...actual, createRealtimeSocket: vi.fn(() => createFakeRealtimeSocket()) }
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

/** A registered follower. Every searchable field is overridable per test. */
function registered(o: Partial<LineUser> = {}, reg: Partial<NonNullable<LineUser['registration']>> = {}): LineUser {
  return makeUser({
    registration: {
      firstName: 'Alice',
      lastName: 'Wong',
      staffId: 'STAFF-123',
      phone: '0812345678',
      departmentId: 1,
      department: 'Computer Science',
      personnelRoleId: 1,
      personnelRole: 'Teacher',
      ...reg,
    },
    ...o,
  })
}

function makePage(
  users: LineUser[],
  meta: Partial<PaginatedLineUsers['meta']> = {},
): PaginatedLineUsers {
  return {
    data: users,
    meta: { page: 1, limit: FETCH_PAGE_SIZE, total: users.length, totalPages: 1, ...meta },
  }
}

/** `n` distinct rows, ids `p{page}-{i}`, so page provenance is assertable. */
function rowsFor(page: number, n: number): LineUser[] {
  return Array.from({ length: n }, (_, i) => makeUser({ id: `p${page}-${i}` }))
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
  resetFakeSockets()
  mockList.mockResolvedValue(makePage([makeUser()]))
})

// ---------------------------------------------------------------------------
describe('useLineUsers — fetch-all page loop', () => {
  it('requests page 1 at the server cap (limit=100) and sends NO search/access param', async () => {
    const { result } = renderHook(() => useLineUsers())

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockList).toHaveBeenCalledTimes(1)
    expect(mockList).toHaveBeenCalledWith({ page: 1, limit: FETCH_PAGE_SIZE })
    // The server-side `search`/`access` params stay in the API for other callers; this
    // page simply never sends them any more.
    expect(mockList.mock.calls[0][0]).not.toHaveProperty('search')
    expect(mockList.mock.calls[0][0]).not.toHaveProperty('access')
  })

  it('loops page 2..totalPages and accumulates EVERY row', async () => {
    mockList.mockImplementation(({ page } = {}) =>
      Promise.resolve(
        makePage(rowsFor(page ?? 1, page === 3 ? 10 : FETCH_PAGE_SIZE), {
          page,
          total: 210,
          totalPages: 3,
        }),
      ),
    )
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockList).toHaveBeenCalledTimes(3)
    expect(mockList.mock.calls.map((c) => c[0]?.page)).toEqual([1, 2, 3])
    expect(result.current.loadedCount).toBe(210)
    expect(result.current.meta?.total).toBe(210)
    expect(result.current.truncated).toBe(false)
  })

  it('terminates on meta.totalPages, NOT on "a page came back short"', async () => {
    // An exactly-limit-divisible total: page 2 is full, and there is no page 3. Stopping
    // on a short page would fire one wasted request here.
    mockList.mockImplementation(({ page } = {}) =>
      Promise.resolve(
        makePage(rowsFor(page ?? 1, FETCH_PAGE_SIZE), { page, total: 200, totalPages: 2 }),
      ),
    )
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockList).toHaveBeenCalledTimes(2)
    expect(result.current.loadedCount).toBe(200)
  })

  it('issues exactly ONE request for a single-page dataset', async () => {
    mockList.mockResolvedValue(makePage([makeUser()], { total: 1, totalPages: 1 }))
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockList).toHaveBeenCalledTimes(1)
  })

  it('handles an empty dataset as EMPTY, not as a stuck spinner', async () => {
    mockList.mockResolvedValue(makePage([], { total: 0, totalPages: 0 }))
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockList).toHaveBeenCalledTimes(1)
    expect(result.current.users).toEqual([])
    expect(result.current.totalPages).toBe(0)
    expect(result.current.error).toBeNull()
  })
})

// ---------------------------------------------------------------------------
describe('useLineUsers — MAX_PAGES truncation tripwire', () => {
  it('stops at MAX_PAGES, keeps what it fetched, and flags the list as truncated', async () => {
    mockList.mockImplementation(({ page } = {}) =>
      Promise.resolve(
        makePage(rowsFor(page ?? 1, FETCH_PAGE_SIZE), { page, total: 9_999, totalPages: 99 }),
      ),
    )
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockList).toHaveBeenCalledTimes(MAX_PAGES)
    expect(result.current.loadedCount).toBe(MAX_PAGES * FETCH_PAGE_SIZE)
    // Degrades LOUDLY: the page renders a visible warning off this flag.
    expect(result.current.truncated).toBe(true)
    // …and NOT as an error — the rows it did fetch are still usable.
    expect(result.current.error).toBeNull()
  })

  it('does NOT flag truncation when the dataset ends exactly on MAX_PAGES', async () => {
    mockList.mockImplementation(({ page } = {}) =>
      Promise.resolve(
        makePage(rowsFor(page ?? 1, FETCH_PAGE_SIZE), { page, totalPages: MAX_PAGES }),
      ),
    )
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockList).toHaveBeenCalledTimes(MAX_PAGES)
    expect(result.current.truncated).toBe(false)
  })
})

// ---------------------------------------------------------------------------
describe('useLineUsers — loop failure handling', () => {
  it('maps a generic failure on page 1 to the generic error copy', async () => {
    mockList.mockRejectedValue(new ApiError(500, 'boom'))
    const { result } = renderHook(() => useLineUsers())

    await waitFor(() => expect(result.current.error).toBe(LEADS_MESSAGES.loadFailed))
    expect(result.current.loading).toBe(false)
  })

  it('maps a 403 to the distinct forbidden copy', async () => {
    mockList.mockRejectedValue(new ApiError(403, 'nope'))
    const { result } = renderHook(() => useLineUsers())

    await waitFor(() => expect(result.current.error).toBe(LEADS_MESSAGES.loadForbidden))
  })

  it('a failure on page k raises a page-level error and NEVER renders a short list', async () => {
    mockList.mockImplementation(({ page } = {}) =>
      page === 3
        ? Promise.reject(new ApiError(500, 'boom'))
        : Promise.resolve(
            makePage(rowsFor(page ?? 1, FETCH_PAGE_SIZE), { page, totalPages: 4 }),
          ),
    )
    const { result } = renderHook(() => useLineUsers())

    await waitFor(() => expect(result.current.error).toBe(LEADS_MESSAGES.loadFailed))
    // The two pages that DID arrive are discarded: a partial list that looks complete is
    // worse than a visible failure.
    expect(result.current.users).toEqual([])
    expect(result.current.loadedCount).toBe(0)
    // It stopped at the failure rather than grinding through page 4.
    expect(mockList).toHaveBeenCalledTimes(3)
  })

  it('expires the session on a 401 mid-loop and sets no render error', async () => {
    mockList.mockImplementation(({ page } = {}) =>
      page === 2
        ? Promise.reject(new ApiError(401, 'dead'))
        : Promise.resolve(makePage(rowsFor(1, FETCH_PAGE_SIZE), { totalPages: 2 })),
    )
    const { result } = renderHook(() => useLineUsers())

    await waitFor(() => expect(mockExpireSession).toHaveBeenCalledTimes(1))
    expect(result.current.error).toBeNull()
  })
})

// ---------------------------------------------------------------------------
describe('useLineUsers — race guard covers the WHOLE loop', () => {
  it('a superseded fetch-all discards ALL of its pages', async () => {
    const stale = deferred<PaginatedLineUsers>()
    mockList.mockReturnValueOnce(stale.promise)
    const { result } = renderHook(() => useLineUsers())

    // Supersede the in-flight run before its first page ever resolves. The fresh response
    // is queued BEFORE `refetch()` because the effect fires synchronously inside `act`.
    mockList.mockResolvedValue(makePage([makeUser({ id: 'fresh' })], { totalPages: 1 }))
    act(() => result.current.refetch())
    await waitFor(() => expect(result.current.users[0]?.id).toBe('fresh'))

    // Now let the STALE page 1 land: it must be dropped, and must NOT start its own loop.
    const callsBefore = mockList.mock.calls.length
    await act(async () => {
      stale.resolve(makePage(rowsFor(1, FETCH_PAGE_SIZE), { totalPages: 5 }))
    })

    expect(result.current.users[0]?.id).toBe('fresh')
    expect(result.current.loadedCount).toBe(1)
    expect(mockList.mock.calls.length).toBe(callsBefore) // no page 2..5 from the stale run
  })
})

// ---------------------------------------------------------------------------
describe('useLineUsers — client-side search (zero network)', () => {
  const ROWS = [
    registered({ id: 'a' }, { firstName: 'สมชาย', lastName: 'ใจดี', staffId: 'EMP-001', phone: '0811111111', department: 'ฝ่ายบุคคล' }),
    registered({ id: 'b' }, { firstName: 'Bob', lastName: 'Smith', staffId: 'EMP-002', phone: '0822222222', department: 'Computer Science' }),
    registered({ id: 'c' }, { firstName: 'Carol', lastName: 'Jones', staffId: 'ZZZ-999', phone: '0899999999', department: 'Mathematics' }),
    makeUser({ id: 'none', registration: null }),
  ]

  async function loaded() {
    mockList.mockResolvedValue(makePage(ROWS, { total: ROWS.length, totalPages: 1 }))
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))
    return result
  }

  it('defaults to the "all fields" search field', async () => {
    const result = await loaded()
    expect(result.current.searchField).toBe('all')
  })

  it('typing issues ZERO additional requests', async () => {
    const result = await loaded()
    const callsBefore = mockList.mock.calls.length

    act(() => result.current.setSearch('EMP'))
    act(() => result.current.setSearchField('staffId'))
    act(() => result.current.setSortBy('nameAsc'))
    act(() => result.current.setAccessFilter('PENDING'))
    act(() => result.current.setPage(1))

    expect(mockList.mock.calls.length).toBe(callsBefore)
  })

  it('all: matches on name OR staffId OR phone OR department', async () => {
    const result = await loaded()

    act(() => result.current.setSearch('สมชาย'))
    expect(result.current.users.map((u) => u.id)).toEqual(['a'])

    act(() => result.current.setSearch('ZZZ-999'))
    expect(result.current.users.map((u) => u.id)).toEqual(['c'])

    act(() => result.current.setSearch('0822222222'))
    expect(result.current.users.map((u) => u.id)).toEqual(['b'])

    act(() => result.current.setSearch('Mathematics'))
    expect(result.current.users.map((u) => u.id)).toEqual(['c'])
  })

  it('name: matches the joined "First Last" and ignores the other fields', async () => {
    const result = await loaded()
    act(() => result.current.setSearchField('name'))

    act(() => result.current.setSearch('Bob Smith'))
    expect(result.current.users.map((u) => u.id)).toEqual(['b'])

    // A staffId hit under the `name` field must NOT match.
    act(() => result.current.setSearch('EMP-002'))
    expect(result.current.users).toEqual([])
  })

  it('staffId: matches only the staff id', async () => {
    const result = await loaded()
    act(() => result.current.setSearchField('staffId'))

    act(() => result.current.setSearch('emp-00'))
    expect(result.current.users.map((u) => u.id)).toEqual(['a', 'b'])

    act(() => result.current.setSearch('Carol'))
    expect(result.current.users).toEqual([])
  })

  it('phone: matches only the phone number', async () => {
    const result = await loaded()
    act(() => result.current.setSearchField('phone'))

    act(() => result.current.setSearch('0899'))
    expect(result.current.users.map((u) => u.id)).toEqual(['c'])

    act(() => result.current.setSearch('Mathematics'))
    expect(result.current.users).toEqual([])
  })

  it('department: matches only the resolved department name', async () => {
    const result = await loaded()
    act(() => result.current.setSearchField('department'))

    act(() => result.current.setSearch('ฝ่ายบุคคล'))
    expect(result.current.users.map((u) => u.id)).toEqual(['a'])

    act(() => result.current.setSearch('EMP-001'))
    expect(result.current.users).toEqual([])
  })

  it('is case-insensitive and trims the query', async () => {
    const result = await loaded()

    act(() => result.current.setSearch('  cOmPuTeR sCiEnCe  '))
    expect(result.current.users.map((u) => u.id)).toEqual(['b'])
  })

  it('filters out rows with NO registration for any non-empty query, and keeps them when blank', async () => {
    const result = await loaded()

    act(() => result.current.setSearch('a'))
    expect(result.current.users.map((u) => u.id)).not.toContain('none')

    act(() => result.current.setSearch(''))
    expect(result.current.users.map((u) => u.id)).toContain('none')
  })

  it('recomputes immediately when the FIELD is switched under an active query', async () => {
    const result = await loaded()

    act(() => result.current.setSearch('EMP-001'))
    expect(result.current.users.map((u) => u.id)).toEqual(['a']) // matched via `all`

    act(() => result.current.setSearchField('phone'))
    expect(result.current.users).toEqual([]) // no stale list
  })
})

// ---------------------------------------------------------------------------
describe('useLineUsers — client-side sort', () => {
  // Thai names chosen so a naive UTF-16 `<` comparison would get them WRONG: "แดง" (leading
  // vowel แ, U+0E41) sorts AFTER "กล้า" (ก, U+0E01) by code unit, but Thai collation orders
  // it by the consonant it is pronounced after (ด), i.e. still after ก but before ส.
  const ROWS = [
    registered({ id: 'mid', followedAt: '2026-05-05T00:00:00.000Z', access: 'BLOCKED' }, { firstName: 'สมชาย', lastName: 'ก' }),
    registered({ id: 'new', followedAt: '2026-09-09T00:00:00.000Z', access: 'PENDING' }, { firstName: 'แดง', lastName: 'ข' }),
    registered({ id: 'old', followedAt: '2026-01-01T00:00:00.000Z', access: 'ALLOWED' }, { firstName: 'กล้า', lastName: 'ค' }),
    makeUser({ id: 'unnamed', followedAt: '2026-03-03T00:00:00.000Z', access: 'REJECTED', registration: null }),
  ]

  async function loaded() {
    mockList.mockResolvedValue(makePage(ROWS, { total: ROWS.length, totalPages: 1 }))
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))
    return result
  }

  it('defaults to newest-registered first', async () => {
    const result = await loaded()
    expect(result.current.sortBy).toBe('registeredAtDesc')
    expect(result.current.users.map((u) => u.id)).toEqual(['new', 'mid', 'unnamed', 'old'])
  })

  it('registeredAtAsc: oldest first', async () => {
    const result = await loaded()
    act(() => result.current.setSortBy('registeredAtAsc'))
    expect(result.current.users.map((u) => u.followedAt)).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2026-03-03T00:00:00.000Z',
      '2026-05-05T00:00:00.000Z',
      '2026-09-09T00:00:00.000Z',
    ])
  })

  it('nameAsc: Thai collation (NOT raw code-unit order), null names last', async () => {
    const result = await loaded()
    act(() => result.current.setSortBy('nameAsc'))

    const ids = result.current.users.map((u) => u.id)
    // Collated by `Intl.Collator('th')` — the same algorithm as localeCompare(…, 'th').
    const expected = ['กล้า ค', 'แดง ข', 'สมชาย ก'].sort((a, b) =>
      new Intl.Collator('th').compare(a, b),
    )
    expect(
      result.current.users
        .filter((u) => u.registration)
        .map((u) => `${u.registration!.firstName} ${u.registration!.lastName}`),
    ).toEqual(expected)
    // The registration-less row has no name key, so it sorts LAST.
    expect(ids[ids.length - 1]).toBe(ROWS[3].id)
  })

  it('nameDesc: reverses the collation but STILL sorts the null name last', async () => {
    const result = await loaded()
    act(() => result.current.setSortBy('nameDesc'))

    const named = result.current.users
      .filter((u) => u.registration)
      .map((u) => `${u.registration!.firstName} ${u.registration!.lastName}`)
    const collator = new Intl.Collator('th')
    expect(named).toEqual([...named].sort((a, b) => collator.compare(b, a)))
    // "No name" is not a name that happens to sort high — it stays at the bottom.
    expect(result.current.users[result.current.users.length - 1].id).toBe(ROWS[3].id)
  })

  it('status: PENDING → REJECTED → ALLOWED → BLOCKED → UNREGISTERED', async () => {
    mockList.mockResolvedValue(
      makePage(
        [
          makeUser({ id: 'u', access: 'UNREGISTERED' }),
          makeUser({ id: 'b', access: 'BLOCKED' }),
          makeUser({ id: 'a', access: 'ALLOWED' }),
          makeUser({ id: 'r', access: 'REJECTED' }),
          makeUser({ id: 'p', access: 'PENDING' }),
        ],
        { total: 5, totalPages: 1 },
      ),
    )
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.setSortBy('status'))
    expect(result.current.users.map((u) => u.id)).toEqual(['p', 'r', 'a', 'b', 'u'])
  })
})

// ---------------------------------------------------------------------------
describe('useLineUsers — client-side status filter + pagination', () => {
  it('filters by access without a request', async () => {
    mockList.mockResolvedValue(
      makePage(
        [makeUser({ id: 'p', access: 'PENDING' }), makeUser({ id: 'a', access: 'ALLOWED' })],
        { total: 2, totalPages: 1 },
      ),
    )
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const callsBefore = mockList.mock.calls.length

    act(() => result.current.setAccessFilter('ALLOWED'))
    expect(result.current.users.map((u) => u.id)).toEqual(['a'])
    expect(mockList.mock.calls.length).toBe(callsBefore)
  })

  it('paginates the FILTERED set client-side: search spans everything, the page does not', async () => {
    // 45 rows over one server page of 100 → one request, three client pages of 20.
    const rows = Array.from({ length: 45 }, (_, i) =>
      registered({ id: `r${i}`, followedAt: `2026-01-01T00:00:${String(i).padStart(2, '0')}.000Z` }),
    )
    mockList.mockResolvedValue(makePage(rows, { total: 45, totalPages: 1 }))
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockList).toHaveBeenCalledTimes(1)
    expect(result.current.totalPages).toBe(Math.ceil(45 / CLIENT_PAGE_SIZE))
    expect(result.current.users).toHaveLength(CLIENT_PAGE_SIZE)
    expect(result.current.meta).toEqual({
      page: 1,
      limit: CLIENT_PAGE_SIZE,
      total: 45,
      totalPages: 3,
    })

    act(() => result.current.setPage(3))
    expect(result.current.users).toHaveLength(45 - 2 * CLIENT_PAGE_SIZE)
    expect(result.current.meta?.page).toBe(3)
  })

  it('resets to page 1 on every search / field / sort / filter change', async () => {
    const rows = Array.from({ length: 45 }, (_, i) => registered({ id: `r${i}` }))
    mockList.mockResolvedValue(makePage(rows, { total: 45, totalPages: 1 }))
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))

    for (const change of [
      () => result.current.setSearch('a'),
      () => result.current.setSearchField('name'),
      () => result.current.setSortBy('nameAsc'),
      () => result.current.setAccessFilter('PENDING'),
    ]) {
      act(() => result.current.setPage(2))
      expect(result.current.page).toBe(2)
      act(change)
      expect(result.current.page).toBe(1)
    }
  })

  it('clamps a now-out-of-range page instead of stranding the operator on a blank one', async () => {
    const rows = Array.from({ length: 45 }, (_, i) =>
      registered({ id: `r${i}` }, { staffId: i === 0 ? 'ONLY-ONE' : `EMP-${i}` }),
    )
    mockList.mockResolvedValue(makePage(rows, { total: 45, totalPages: 1 }))
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.setPage(3))
    expect(result.current.page).toBe(3)

    // A filter that leaves one row would otherwise leave `page` at 3 of 1.
    act(() => result.current.setSearchField('staffId'))
    act(() => result.current.setSearch('ONLY-ONE'))
    expect(result.current.page).toBe(1)
    expect(result.current.users.map((u) => u.id)).toEqual(['r0'])
  })

  it('composes filter → search → sort → paginate', async () => {
    mockList.mockResolvedValue(
      makePage(
        [
          registered({ id: 'allowed-b', access: 'ALLOWED' }, { firstName: 'Bravo', lastName: 'Team' }),
          registered({ id: 'allowed-a', access: 'ALLOWED' }, { firstName: 'Alpha', lastName: 'Team' }),
          registered({ id: 'pending-a', access: 'PENDING' }, { firstName: 'Alpha', lastName: 'Team' }),
          registered({ id: 'allowed-x', access: 'ALLOWED' }, { firstName: 'Zulu', lastName: 'Other' }),
        ],
        { total: 4, totalPages: 1 },
      ),
    )
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.setAccessFilter('ALLOWED')) // 3 rows
    act(() => result.current.setSearch('Team')) // 2 rows
    act(() => result.current.setSortBy('nameAsc'))

    expect(result.current.users.map((u) => u.id)).toEqual(['allowed-a', 'allowed-b'])
    expect(result.current.meta?.total).toBe(2)
  })
})

// ---------------------------------------------------------------------------
describe('useLineUsers — changeAccess', () => {
  it('optimistically replaces the row in place on success, without a refetch', async () => {
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

// ---------------------------------------------------------------------------
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

  it('survives the client-side filter: an updated row leaves a filter it no longer matches', async () => {
    mockList.mockResolvedValue(
      makePage([makeUser({ id: 'lu1', access: 'PENDING' }), makeUser({ id: 'lu2', access: 'PENDING' })]),
    )
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.setAccessFilter('PENDING'))
    expect(result.current.users).toHaveLength(2)

    act(() => result.current.updateUserInPlace(makeUser({ id: 'lu2', access: 'ALLOWED' })))
    expect(result.current.users.map((u) => u.id)).toEqual(['lu1'])
  })
})

// ---------------------------------------------------------------------------
// The live channel. `useLineUsersRealtime` is covered on its own in
// `useLineUsersRealtime.test.ts`; these specs cover the WIRING — that a server event mutates
// the same in-memory dataset the fetch-all produced, and that it does so without disturbing
// anything the operator is holding on screen.
// ---------------------------------------------------------------------------
describe('useLineUsers — live events patch the local dataset', () => {
  /** Load a dataset, then bring the socket up. */
  async function connected(rows: LineUser[]) {
    mockList.mockResolvedValue(makePage(rows, { total: rows.length, totalPages: 1 }))
    const view = renderHook(() => useLineUsers())
    await waitFor(() => expect(view.result.current.loading).toBe(false))
    act(() => latestFakeSocket().server('connect'))
    return view.result
  }

  it('reports the connection status for the page indicator', async () => {
    const result = await connected([makeUser({ id: 'lu1' })])

    expect(result.current.realtimeStatus).toBe('live')
  })

  it('lineUser.created INSERTS an unknown row', async () => {
    const result = await connected([makeUser({ id: 'lu1' })])

    act(() =>
      latestFakeSocket().server(REALTIME_EVENTS.lineUserCreated, makeUser({ id: 'brand-new' })),
    )

    expect(result.current.users.map((u) => u.id)).toContain('brand-new')
    expect(result.current.loadedCount).toBe(2)
  })

  it('lineUser.created for a KNOWN id upserts — a re-follow never duplicates a row', async () => {
    const result = await connected([makeUser({ id: 'lu1', access: 'PENDING' })])

    act(() =>
      latestFakeSocket().server(
        REALTIME_EVENTS.lineUserCreated,
        makeUser({ id: 'lu1', access: 'ALLOWED' }),
      ),
    )

    expect(result.current.users).toHaveLength(1)
    expect(result.current.users[0].access).toBe('ALLOWED')
  })

  it('lineUser.updated replaces the row in place, leaving its neighbours untouched', async () => {
    const result = await connected([
      makeUser({ id: 'lu1', access: 'PENDING' }),
      makeUser({ id: 'lu2', access: 'PENDING' }),
    ])

    act(() =>
      latestFakeSocket().server(
        REALTIME_EVENTS.lineUserUpdated,
        makeUser({ id: 'lu2', access: 'BLOCKED' }),
      ),
    )

    expect(result.current.users.find((u) => u.id === 'lu2')?.access).toBe('BLOCKED')
    expect(result.current.users.find((u) => u.id === 'lu1')?.access).toBe('PENDING')
    expect(result.current.users).toHaveLength(2)
  })

  it('lineUser.updated for an id we never fetched inserts it rather than crashing (AC F11)', async () => {
    const result = await connected([makeUser({ id: 'lu1' })])

    act(() =>
      latestFakeSocket().server(REALTIME_EVENTS.lineUserUpdated, makeUser({ id: 'arrived-late' })),
    )

    expect(result.current.users.map((u) => u.id)).toEqual(['lu1', 'arrived-late'])
  })

  it('the socket echo of an optimistic change is a no-op, not a second row (AC F15)', async () => {
    const result = await connected([makeUser({ id: 'lu1', access: 'PENDING' })])

    mockPatch.mockResolvedValue(makeUser({ id: 'lu1', access: 'ALLOWED' }))
    await act(async () => {
      await result.current.changeAccess(result.current.users[0], 'ALLOWED')
    })
    // …and now the server's own broadcast of the very same mutation arrives.
    act(() =>
      latestFakeSocket().server(
        REALTIME_EVENTS.lineUserUpdated,
        makeUser({ id: 'lu1', access: 'ALLOWED' }),
      ),
    )

    expect(result.current.users).toHaveLength(1)
    expect(result.current.users[0].access).toBe('ALLOWED')
  })

  it('lineUser.deleted removes the row and reports the id (so the modal can close)', async () => {
    const result = await connected([makeUser({ id: 'lu1' }), makeUser({ id: 'lu2' })])

    act(() => latestFakeSocket().server(REALTIME_EVENTS.lineUserDeleted, { id: 'lu2' }))

    expect(result.current.users.map((u) => u.id)).toEqual(['lu1'])
    expect(result.current.deletedRowId).toBe('lu2')
  })

  it('a re-follow clears the "row is gone" signal, so it cannot outlive the row', async () => {
    const result = await connected([makeUser({ id: 'lu1' })])

    act(() => latestFakeSocket().server(REALTIME_EVENTS.lineUserDeleted, { id: 'lu1' }))
    expect(result.current.deletedRowId).toBe('lu1')

    // An unfollow followed by a re-follow: the row is back, so the page must stop treating
    // it as deleted (otherwise it would keep slamming that row's modal shut).
    act(() => latestFakeSocket().server(REALTIME_EVENTS.lineUserCreated, makeUser({ id: 'lu1' })))

    expect(result.current.deletedRowId).toBeNull()
    expect(result.current.users.map((u) => u.id)).toEqual(['lu1'])
  })

  it('a repeated / unknown lineUser.deleted is idempotent, never a crash', async () => {
    const result = await connected([makeUser({ id: 'lu1' })])

    act(() => latestFakeSocket().server(REALTIME_EVENTS.lineUserDeleted, { id: 'lu1' }))
    act(() => latestFakeSocket().server(REALTIME_EVENTS.lineUserDeleted, { id: 'lu1' }))
    act(() => latestFakeSocket().server(REALTIME_EVENTS.lineUserDeleted, { id: 'never-existed' }))

    expect(result.current.users).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('an event fires ZERO requests — live updates never trigger a refetch', async () => {
    const result = await connected([makeUser({ id: 'lu1' })])
    const callsBefore = mockList.mock.calls.length

    act(() =>
      latestFakeSocket().server(
        REALTIME_EVENTS.lineUserUpdated,
        makeUser({ id: 'lu1', access: 'ALLOWED' }),
      ),
    )
    act(() => latestFakeSocket().server(REALTIME_EVENTS.lineUserCreated, makeUser({ id: 'lu2' })))
    act(() => latestFakeSocket().server(REALTIME_EVENTS.lineUserDeleted, { id: 'lu2' }))

    // All three took effect locally — so "zero requests" is not a vacuous assertion.
    expect(result.current.users.map((u) => u.id)).toEqual(['lu1'])
    expect(result.current.users[0].access).toBe('ALLOWED')
    expect(mockList.mock.calls.length).toBe(callsBefore)
  })
})

// ---------------------------------------------------------------------------
describe('useLineUsers — an event must not disturb the operator view', () => {
  it('preserves search text, search field, sort, status filter AND page position', async () => {
    // 45 ALLOWED rows so page 2 exists under the active filter+search.
    const rows = Array.from({ length: 45 }, (_, i) =>
      registered({ id: `r${i}`, access: 'ALLOWED' }, { staffId: `EMP-${String(i).padStart(3, '0')}` }),
    )
    mockList.mockResolvedValue(makePage(rows, { total: rows.length, totalPages: 1 }))
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => latestFakeSocket().server('connect'))

    act(() => result.current.setAccessFilter('ALLOWED'))
    act(() => result.current.setSearchField('staffId'))
    act(() => result.current.setSearch('EMP-'))
    act(() => result.current.setSortBy('nameAsc'))
    act(() => result.current.setPage(2))
    const visibleBefore = result.current.users.map((u) => u.id)

    act(() =>
      latestFakeSocket().server(
        REALTIME_EVENTS.lineUserUpdated,
        registered({ id: 'r0', access: 'ALLOWED' }, { staffId: 'EMP-000', phone: '0999999999' }),
      ),
    )

    // Every control the operator set is exactly where they left it…
    expect(result.current.accessFilter).toBe('ALLOWED')
    expect(result.current.searchField).toBe('staffId')
    expect(result.current.search).toBe('EMP-')
    expect(result.current.sortBy).toBe('nameAsc')
    // …including the page: an incoming event must never yank them back to page 1.
    expect(result.current.page).toBe(2)
    expect(result.current.users.map((u) => u.id)).toEqual(visibleBefore)
  })

  it('drops an updated row out of a filter it no longer matches, without resetting the view', async () => {
    mockList.mockResolvedValue(
      makePage([makeUser({ id: 'lu1', access: 'PENDING' }), makeUser({ id: 'lu2', access: 'PENDING' })], {
        total: 2,
        totalPages: 1,
      }),
    )
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => latestFakeSocket().server('connect'))
    act(() => result.current.setAccessFilter('PENDING'))

    // Another admin approves lu2 elsewhere: it leaves the PENDING queue on this screen.
    act(() =>
      latestFakeSocket().server(
        REALTIME_EVENTS.lineUserUpdated,
        makeUser({ id: 'lu2', access: 'ALLOWED' }),
      ),
    )

    expect(result.current.users.map((u) => u.id)).toEqual(['lu1'])
    expect(result.current.accessFilter).toBe('PENDING')
    // It left the VIEW, not the dataset: clearing the filter brings it back, updated.
    act(() => result.current.setAccessFilter(''))
    expect(result.current.users.find((u) => u.id === 'lu2')?.access).toBe('ALLOWED')
  })
})

// ---------------------------------------------------------------------------
describe('useLineUsers — reconnect reconciliation (AC F12)', () => {
  it('re-runs the fetch-all on RE-connect and never on the first connect', async () => {
    mockList.mockResolvedValue(makePage([makeUser({ id: 'lu1' })], { total: 1, totalPages: 1 }))
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => latestFakeSocket().server('connect'))
    expect(mockList).toHaveBeenCalledTimes(1) // first connect reconciles nothing

    // Drop, then come back to a server that changed while we were blind.
    act(() => latestFakeSocket().server('disconnect', 'transport close'))
    mockList.mockResolvedValue(
      makePage([makeUser({ id: 'lu1', access: 'ALLOWED' }), makeUser({ id: 'lu2' })], {
        total: 2,
        totalPages: 1,
      }),
    )
    act(() => latestFakeSocket().server('connect'))

    await waitFor(() => expect(result.current.users).toHaveLength(2))
    expect(mockList).toHaveBeenCalledTimes(2)
    // Reconciled, not appended: no duplicate rows after a reconnect.
    expect(result.current.users.map((u) => u.id)).toEqual(['lu1', 'lu2'])
    expect(result.current.users[0].access).toBe('ALLOWED')
  })

  it('reconciles SILENTLY: the table keeps its rows instead of flashing a skeleton', async () => {
    mockList.mockResolvedValue(makePage([makeUser({ id: 'lu1' })], { total: 1, totalPages: 1 }))
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => latestFakeSocket().server('connect'))

    const pending = deferred<PaginatedLineUsers>()
    mockList.mockReturnValueOnce(pending.promise)
    act(() => latestFakeSocket().server('disconnect', 'transport close'))
    act(() => latestFakeSocket().server('connect'))

    // Mid-revalidation: still the old rows, still no spinner, page state intact.
    expect(result.current.loading).toBe(false)
    expect(result.current.users.map((u) => u.id)).toEqual(['lu1'])

    await act(async () => {
      pending.resolve(makePage([makeUser({ id: 'lu9' })], { total: 1, totalPages: 1 }))
    })
    expect(result.current.users.map((u) => u.id)).toEqual(['lu9'])
  })

  it('an explicit refetch() is still LOUD — only the socket reconciliation is silent', async () => {
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))

    mockList.mockReturnValueOnce(deferred<PaginatedLineUsers>().promise)
    act(() => result.current.refetch())

    expect(result.current.loading).toBe(true)
  })
})

// ---------------------------------------------------------------------------
describe('useLineUsers — fail-soft: a socket that never connects (AC F14)', () => {
  it('still renders the fetched dataset, with no error and every control working', async () => {
    const rows = [
      registered({ id: 'a', access: 'ALLOWED' }, { firstName: 'Alpha', lastName: 'One' }),
      registered({ id: 'b', access: 'PENDING' }, { firstName: 'Bravo', lastName: 'Two' }),
    ]
    mockList.mockResolvedValue(makePage(rows, { total: 2, totalPages: 1 }))
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))

    // The handshake is rejected outright — gateway not deployed, proxy without upgrade
    // headers, backend down: the page must not notice beyond its indicator.
    act(() => latestFakeSocket().server('connect_error', new Error('UNAUTHENTICATED')))

    expect(result.current.realtimeStatus).toBe('offline')
    expect(result.current.error).toBeNull()
    expect(result.current.users).toHaveLength(2)

    act(() => result.current.setAccessFilter('PENDING'))
    expect(result.current.users.map((u) => u.id)).toEqual(['b'])
  })

  it('never logs the operator out off the back of a socket failure', async () => {
    const { result } = renderHook(() => useLineUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => latestFakeSocket().server('connect_error', new Error('UNAUTHENTICATED')))
    act(() => latestFakeSocket().server(REALTIME_EVENTS.sessionClosed, { reason: 'REVOKED' }))

    // The authoritative 401 comes from the next HTTP request, not from the socket
    // (design §3.4) — a gateway defect must never be able to sign an operator out.
    expect(mockExpireSession).not.toHaveBeenCalled()
  })
})
