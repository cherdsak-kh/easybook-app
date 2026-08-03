import { io } from 'socket.io-client'
import {
  REALTIME_EVENTS,
  REALTIME_NAMESPACE,
  REALTIME_PATH,
  RECONNECT_DELAY_MAX_MS,
  RECONNECT_DELAY_MS,
  createRealtimeSocket,
  isRealtimeEnabled,
} from '@/lib/realtime'

// Mock the LIBRARY, not our wrapper: this spec's whole job is to pin the connection
// contract (`02_design_log.md` §11.1) that gets handed to socket.io. No real network,
// ever — a spec that opened a socket would be flaky and would leak a handle.
vi.mock('socket.io-client', () => ({ io: vi.fn(() => ({ id: 'fake' })) }))

const mockIo = vi.mocked(io)

/** The options object `io()` was called with on the most recent call. */
function optionsOfLastCall() {
  return mockIo.mock.calls.at(-1)?.[1] as Record<string, unknown>
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('createRealtimeSocket — the handshake contract', () => {
  it('targets the /admin NAMESPACE on the app origin, not the default / namespace', () => {
    createRealtimeSocket()

    // Namespace membership IS the authorization boundary (design §2): a future client-portal
    // socket must not be able to inherit the admin handshake by landing on `/`.
    expect(mockIo).toHaveBeenCalledTimes(1)
    expect(mockIo.mock.calls[0][0]).toBe(`${window.location.origin}${REALTIME_NAMESPACE}`)
    expect(REALTIME_NAMESPACE).toBe('/admin')
  })

  it('uses the /socket.io engine path — the one the nginx + Vite proxies are keyed on', () => {
    createRealtimeSocket()

    expect(optionsOfLastCall().path).toBe(REALTIME_PATH)
    expect(REALTIME_PATH).toBe('/socket.io')
  })

  it('sends credentials, so the handshake carries the existing session cookie', () => {
    createRealtimeSocket()

    // Cookie-based auth: there is NO token to pass and none to store. Dropping this option
    // makes every handshake an anonymous one, i.e. rejected.
    expect(optionsOfLastCall().withCredentials).toBe(true)
  })

  it('does NOT auto-connect (the caller waits for the session probe — AC F7)', () => {
    createRealtimeSocket()

    expect(optionsOfLastCall().autoConnect).toBe(false)
  })

  it('configures socket.io own backoff rather than hand-rolling reconnection (F12–F14)', () => {
    createRealtimeSocket()
    const options = optionsOfLastCall()

    expect(options.reconnectionAttempts).toBe(Infinity)
    expect(options.reconnectionDelay).toBe(RECONNECT_DELAY_MS)
    expect(options.reconnectionDelayMax).toBe(RECONNECT_DELAY_MAX_MS)
  })

  it('prefers VITE_API_URL when the SPA is deployed cross-origin', () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.com')
    createRealtimeSocket()

    expect(mockIo.mock.calls[0][0]).toBe('https://api.example.com/admin')
  })
})

describe('event names', () => {
  it('pins the exact wire strings from the design contract', () => {
    // A typo here is a silently dead feature: socket.io delivers unknown events to nobody.
    expect(REALTIME_EVENTS).toEqual({
      lineUserCreated: 'lineUser.created',
      lineUserUpdated: 'lineUser.updated',
      lineUserDeleted: 'lineUser.deleted',
      sessionClosed: 'session.closed',
    })
  })
})

describe('isRealtimeEnabled — the rollback switch', () => {
  it('is ON when VITE_WS_ENABLED is unset (opt-out, not opt-in)', () => {
    expect(isRealtimeEnabled()).toBe(true)
  })

  it('is OFF only for the exact string "false"', () => {
    vi.stubEnv('VITE_WS_ENABLED', 'false')
    expect(isRealtimeEnabled()).toBe(false)
  })

  it('stays ON for any other value, so a typo cannot silently kill the feature', () => {
    for (const value of ['true', '1', '0', 'FALSE', '']) {
      vi.stubEnv('VITE_WS_ENABLED', value)
      expect(isRealtimeEnabled()).toBe(true)
    }
  })
})
