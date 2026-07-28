import { StrictMode } from 'react'
import { act, renderHook } from '@testing-library/react'
import {
  fakeSockets,
  latestFakeSocket,
  resetFakeSockets,
  type FakeRealtimeSocket,
} from '@/test/fake-socket'
import { REALTIME_EVENTS } from '@/lib/realtime'
import {
  useLineUsersRealtime,
  type LineUsersRealtimeHandlers,
} from '@/hooks/useLineUsersRealtime'
import type { LineUser } from '@/lib/api-client'

// Mock our own module (repo convention), replacing ONLY the socket factory. `isRealtimeEnabled`
// and every constant stay REAL, so the rollback-flag branch below exercises the production
// predicate rather than a copy of it. Nothing here touches the network.
vi.mock('@/lib/realtime', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/realtime')>()
  const { createFakeRealtimeSocket } = await import('@/test/fake-socket')
  return { ...actual, createRealtimeSocket: vi.fn(() => createFakeRealtimeSocket()) }
})

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

/**
 * Spy handlers. Typed via `vi.fn<T>()` rather than a cast, so a change to
 * {@link LineUsersRealtimeHandlers} breaks THIS file at compile time instead of quietly
 * asserting on a signature that no longer exists.
 */
function makeHandlers() {
  const handlers = {
    onCreated: vi.fn<(user: LineUser) => void>(),
    onUpdated: vi.fn<(user: LineUser) => void>(),
    onDeleted: vi.fn<(id: string) => void>(),
    onResync: vi.fn<() => void>(),
  }
  return handlers satisfies LineUsersRealtimeHandlers
}

/** Mount the hook enabled, and connect it unless `connect: false`. */
function mount(options: { enabled?: boolean; connect?: boolean } = {}) {
  const handlers = makeHandlers()
  const view = renderHook(() => useLineUsersRealtime(options.enabled ?? true, handlers))
  if (options.connect !== false && fakeSockets.length > 0) {
    act(() => latestFakeSocket().server('connect'))
  }
  return { ...view, handlers, socket: () => latestFakeSocket() }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  resetFakeSockets()
})

// ---------------------------------------------------------------------------
describe('useLineUsersRealtime — lifecycle', () => {
  it('opens exactly one socket and connects it explicitly (autoConnect is off)', () => {
    const { result } = mount({ connect: false })

    expect(fakeSockets).toHaveLength(1)
    expect(latestFakeSocket().connectCount).toBe(1)
    expect(result.current).toBe('connecting')
  })

  it('reports "live" once connected', () => {
    const { result } = mount()

    expect(result.current).toBe('live')
  })

  it('opens NO socket until the session probe reports authenticated (AC F7)', () => {
    const { result } = mount({ enabled: false })

    expect(fakeSockets).toHaveLength(0)
    expect(result.current).toBe('disabled')
  })

  it('opens NO socket when the VITE_WS_ENABLED rollback flag is off', () => {
    vi.stubEnv('VITE_WS_ENABLED', 'false')
    const { result } = mount({ connect: false })

    expect(fakeSockets).toHaveLength(0)
    expect(result.current).toBe('disabled')
  })

  it('detaches EVERY listener and disconnects on unmount (AC F13)', () => {
    const { unmount } = mount()
    const socket = latestFakeSocket()
    expect(socket.listenerCount).toBeGreaterThan(0)

    unmount()

    expect(socket.offAllCount).toBe(1)
    expect(socket.listenerCount).toBe(0)
    expect(socket.disconnectCount).toBe(1)
  })

  it('does not re-open the socket when the caller passes new handler identities', () => {
    const { rerender } = renderHook(() => useLineUsersRealtime(true, makeHandlers()))
    const socket = latestFakeSocket()

    rerender()
    rerender()

    // Handlers live in a ref, so a re-render can never tear down a healthy connection.
    expect(fakeSockets).toHaveLength(1)
    expect(socket.connectCount).toBe(1)
    expect(socket.disconnectCount).toBe(0)
  })

  it('leaves ONE live socket with ONE set of handlers under StrictMode double-invoke', () => {
    const handlers = makeHandlers()
    renderHook(() => useLineUsersRealtime(true, handlers), { wrapper: StrictMode })

    // React 18/19 dev mounts, unmounts and re-mounts every effect: two sockets are built,
    // but the FIRST must be fully torn down.
    expect(fakeSockets.length).toBeGreaterThanOrEqual(2)
    const [first] = fakeSockets
    const live = latestFakeSocket()
    expect(first.disconnectCount).toBe(1)
    expect(first.listenerCount).toBe(0)
    expect(live.disconnectCount).toBe(0)

    // The abandoned socket is inert; the live one delivers exactly once — no duplicate rows.
    act(() => first.server(REALTIME_EVENTS.lineUserCreated, makeUser()))
    expect(handlers.onCreated).not.toHaveBeenCalled()

    act(() => live.server(REALTIME_EVENTS.lineUserCreated, makeUser()))
    expect(handlers.onCreated).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
describe('useLineUsersRealtime — domain events', () => {
  it('routes lineUser.created to onCreated with the full row', () => {
    const { handlers, socket } = mount()
    const user = makeUser({ id: 'new-1' })

    act(() => socket().server(REALTIME_EVENTS.lineUserCreated, user))

    expect(handlers.onCreated).toHaveBeenCalledTimes(1)
    expect(handlers.onCreated).toHaveBeenCalledWith(user)
  })

  it('routes lineUser.updated to onUpdated with the full row', () => {
    const { handlers, socket } = mount()
    const user = makeUser({ id: 'lu9', access: 'ALLOWED' })

    act(() => socket().server(REALTIME_EVENTS.lineUserUpdated, user))

    expect(handlers.onUpdated).toHaveBeenCalledTimes(1)
    expect(handlers.onUpdated).toHaveBeenCalledWith(user)
  })

  it('routes lineUser.deleted to onDeleted with the id only', () => {
    const { handlers, socket } = mount()

    act(() => socket().server(REALTIME_EVENTS.lineUserDeleted, { id: 'gone-1' }))

    expect(handlers.onDeleted).toHaveBeenCalledWith('gone-1')
  })

  it('ignores a malformed delete payload instead of removing an undefined row', () => {
    const { handlers, socket } = mount()

    act(() => socket().server(REALTIME_EVENTS.lineUserDeleted, {}))

    expect(handlers.onDeleted).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
describe('useLineUsersRealtime — reconnection', () => {
  it('does NOT resync on the FIRST connect (the fetch-all is already authoritative)', () => {
    const { handlers } = mount()

    expect(handlers.onResync).not.toHaveBeenCalled()
  })

  it('resyncs on every RE-connect, because events emitted while offline are gone (AC F12)', () => {
    const { handlers, result, socket } = mount()

    act(() => socket().server('disconnect', 'transport close'))
    expect(result.current).toBe('offline')

    act(() => socket().server('connect'))

    expect(handlers.onResync).toHaveBeenCalledTimes(1)
    expect(result.current).toBe('live')

    act(() => socket().server('disconnect', 'transport close'))
    act(() => socket().server('connect'))
    expect(handlers.onResync).toHaveBeenCalledTimes(2)
  })

  it('leaves the default backoff alone for a transient connect_error', () => {
    const { result, socket } = mount({ connect: false })

    act(() => socket().server('connect_error', new Error('xhr poll error')))

    expect(socket().io.reconnection).not.toHaveBeenCalled()
    expect(result.current).toBe('offline')
  })

  it('STOPS retrying a handshake that can never succeed (UNAUTHENTICATED / FORBIDDEN)', () => {
    for (const message of ['UNAUTHENTICATED', 'FORBIDDEN']) {
      resetFakeSockets()
      const { result, unmount } = mount({ connect: false })

      act(() => latestFakeSocket().server('connect_error', new Error(message)))

      // Retrying a rejected handshake forever is a request storm that cannot succeed.
      expect(latestFakeSocket().io.reconnection).toHaveBeenCalledWith(false)
      expect(result.current).toBe('offline')
      unmount()
    }
  })
})

// ---------------------------------------------------------------------------
describe('useLineUsersRealtime — session.closed', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('REVOKED: stops for good — no reconnect, ever', () => {
    const { result, socket } = mount()
    const connectsBefore = socket().connectCount

    act(() => socket().server(REALTIME_EVENTS.sessionClosed, { reason: 'REVOKED' }))

    expect(socket().io.reconnection).toHaveBeenCalledWith(false)
    expect(result.current).toBe('offline')

    act(() => vi.advanceTimersByTime(60_000))
    expect(socket().connectCount).toBe(connectsBefore)
  })

  it('STORE_UNAVAILABLE: heals itself once the store is back, WITHOUT a page reload', () => {
    const { result, socket } = mount()
    const connectsBefore = socket().connectCount

    // The server disconnects us, and socket.io does NOT auto-reconnect after a
    // server-initiated disconnect — hence the explicit retry.
    act(() => socket().server(REALTIME_EVENTS.sessionClosed, { reason: 'STORE_UNAVAILABLE' }))
    act(() => socket().server('disconnect', 'io server disconnect'))
    expect(result.current).toBe('offline')
    expect(socket().io.reconnection).not.toHaveBeenCalled()
    expect(socket().connectCount).toBe(connectsBefore)

    act(() => vi.advanceTimersByTime(1_000))
    expect(socket().connectCount).toBe(connectsBefore + 1)

    act(() => socket().server('connect'))
    expect(result.current).toBe('live')
  })

  it('backs the heal attempts off instead of hammering a store that is still down', () => {
    const { socket } = mount()
    const closed = { reason: 'STORE_UNAVAILABLE' as const }
    const connectsBefore = socket().connectCount

    act(() => socket().server(REALTIME_EVENTS.sessionClosed, closed))
    act(() => vi.advanceTimersByTime(1_000))
    expect(socket().connectCount).toBe(connectsBefore + 1)

    // Second failure in a row waits longer than the first.
    act(() => socket().server(REALTIME_EVENTS.sessionClosed, closed))
    act(() => vi.advanceTimersByTime(1_000))
    expect(socket().connectCount).toBe(connectsBefore + 1)
    act(() => vi.advanceTimersByTime(1_000))
    expect(socket().connectCount).toBe(connectsBefore + 2)
  })

  it('clears a pending heal timer on unmount (no work after the page is gone)', () => {
    const { socket, unmount } = mount()

    act(() => socket().server(REALTIME_EVENTS.sessionClosed, { reason: 'STORE_UNAVAILABLE' }))
    const socketRef: FakeRealtimeSocket = socket()
    unmount()
    const connectsAtUnmount = socketRef.connectCount

    act(() => vi.advanceTimersByTime(60_000))

    expect(socketRef.connectCount).toBe(connectsAtUnmount)
  })
})
