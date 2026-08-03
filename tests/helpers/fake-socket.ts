// A hand-rolled stand-in for a `socket.io-client` Socket, shared by the realtime specs.
//
// It exists so NO test ever opens a real connection: the suite mocks
// `@/lib/realtime.createRealtimeSocket` (the repo's `vi.mock('@/lib/...')` boundary
// convention) and hands back one of these instead. It is a real emitter, not a bag of spies,
// because the properties under test are emitter properties: that `off()` truly detaches
// listeners, that a superseded socket's handlers stop firing, and that no event is ever
// delivered twice.
type Listener = (...args: never[]) => void

/** Every socket the mocked factory has produced, newest last. Reset between tests. */
export const fakeSockets: FakeRealtimeSocket[] = []

export class FakeRealtimeSocket {
  private readonly listeners = new Map<string, Set<Listener>>()

  connectCount = 0
  disconnectCount = 0
  /** How many times `off()` was called with NO arguments (i.e. "detach everything"). */
  offAllCount = 0

  /** The Manager handle. `io.reconnection(false)` is how the client stops retrying. */
  readonly io = { reconnection: vi.fn() }

  on(event: string, listener: Listener): this {
    const set = this.listeners.get(event) ?? new Set<Listener>()
    set.add(listener)
    this.listeners.set(event, set)
    return this
  }

  off(event?: string, listener?: Listener): this {
    if (event === undefined) {
      this.offAllCount += 1
      this.listeners.clear()
      return this
    }
    if (listener === undefined) this.listeners.delete(event)
    else this.listeners.get(event)?.delete(listener)
    return this
  }

  connect(): this {
    this.connectCount += 1
    return this
  }

  disconnect(): this {
    this.disconnectCount += 1
    return this
  }

  // --- test-side controls -------------------------------------------------

  /** Play a server → client event at whatever listeners are currently attached. */
  server(event: string, ...args: unknown[]): void {
    const fns = [...(this.listeners.get(event) ?? [])] as ((...a: unknown[]) => void)[]
    for (const fn of fns) fn(...args)
  }

  /** Total attached listeners — a duplicate-registration canary. */
  get listenerCount(): number {
    let total = 0
    for (const set of this.listeners.values()) total += set.size
    return total
  }
}

/** The `createRealtimeSocket` replacement: builds a fake and records it. */
export function createFakeRealtimeSocket(): FakeRealtimeSocket {
  const socket = new FakeRealtimeSocket()
  fakeSockets.push(socket)
  return socket
}

export function resetFakeSockets(): void {
  fakeSockets.length = 0
}

/** The newest socket the hook opened. Throws rather than returning `undefined`. */
export function latestFakeSocket(): FakeRealtimeSocket {
  const socket = fakeSockets.at(-1)
  if (!socket) throw new Error('No socket was created — the hook did not connect.')
  return socket
}
