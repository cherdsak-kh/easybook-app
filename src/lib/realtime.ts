// The Socket.IO client for the back-office real-time channel (design §11.1).
//
// This module is the ONLY place `socket.io-client` is imported, so the connection contract
// (namespace, engine path, credentials, backoff) lives in exactly one reviewable place and
// every consumer/test mocks ONE boundary — the same discipline `api-client.ts` applies to
// REST.
//
// Transport contract, copied from `02_design_log.md` §2/§11.1 (the authoritative event/auth
// contract) — do not "simplify" any of it without re-reading that section:
//  - namespace `/admin` (NOT the default `/`, which the server deliberately leaves undeclared),
//  - engine path `/socket.io` (matches the nginx `location /socket.io/` block and the Vite
//    dev-proxy entry),
//  - `withCredentials: true` — the handshake authenticates from the EXISTING `eb.sid`
//    httpOnly session cookie. There is no token to pass, none to store, and none to log.
//
// The socket is strictly server → client: it subscribes to four events and sends none. That
// is why no CSRF token is involved (design §5: the handshake is a GET, it changes no state;
// the real control is server-side `Origin` validation against CSWSH).
import { io, type Socket } from 'socket.io-client'
import type { LineUser } from './api-client'

/** The admin fan-out namespace. Membership IS the authorization boundary (design §2). */
export const REALTIME_NAMESPACE = '/admin'

/** engine.io path. Must match the server default and the nginx/Vite proxy location. */
export const REALTIME_PATH = '/socket.io'

/**
 * Reconnection is socket.io's own exponential backoff + jitter (design §1 / ACs F12–F14) —
 * CONFIGURED here, never hand-rolled. Heartbeat (`pingInterval`/`pingTimeout`) is server-driven
 * and needs no client option at all.
 */
export const RECONNECT_DELAY_MS = 1_000
export const RECONNECT_DELAY_MAX_MS = 10_000

/**
 * Server → client event names. Exact strings from design §6; exported so the hook and its
 * tests can never drift from each other by a typo.
 */
export const REALTIME_EVENTS = {
  lineUserCreated: 'lineUser.created',
  lineUserUpdated: 'lineUser.updated',
  lineUserDeleted: 'lineUser.deleted',
  sessionClosed: 'session.closed',
} as const

/**
 * Handshake rejection classes (design §3.4). They are STATUS CLASSES, not diagnostics — the
 * server deliberately refuses to distinguish "no cookie" from "deleted user", exactly as its
 * HTTP surface does.
 *
 * `UNAUTHENTICATED` / `FORBIDDEN` are terminal: retrying cannot fix them, so the client stops.
 * Everything else (`SESSION_STORE_UNAVAILABLE`, `FORBIDDEN_ORIGIN`, transport errors) keeps
 * the default backoff so a recovered backend heals the socket with no page reload.
 */
export const TERMINAL_CONNECT_ERRORS = ['UNAUTHENTICATED', 'FORBIDDEN'] as const

/** Why the server closed a socket (design §6.3). The two reasons are handled DIFFERENTLY. */
export type SessionClosedReason = 'REVOKED' | 'STORE_UNAVAILABLE'

export interface SessionClosedPayload {
  reason: SessionClosedReason
}

/** `lineUser.deleted` carries an id only — the row left the operator's list (design §6.4). */
export interface LineUserDeletedPayload {
  id: string
}

/**
 * The event map. `lineUser.created` / `lineUser.updated` carry a **full**
 * `LineUserResponseDto` — byte-identical to one element of `GET /line-users`'s `data[]`,
 * produced by the same `toDto` from the same `LINE_USER_PUBLIC_FIELDS` (design §6.1).
 *
 * So there is NO new type here and NO contract change: `LineUser` is the already-generated
 * `components['schemas']['LineUserResponseDto']` re-exported by `api-client.ts`. Do not run
 * `gen:api` for this feature, and never hand-edit `src/lib/api-types.ts`.
 */
export interface RealtimeServerEvents {
  [REALTIME_EVENTS.lineUserCreated]: (user: LineUser) => void
  [REALTIME_EVENTS.lineUserUpdated]: (user: LineUser) => void
  [REALTIME_EVENTS.lineUserDeleted]: (payload: LineUserDeletedPayload) => void
  [REALTIME_EVENTS.sessionClosed]: (payload: SessionClosedPayload) => void
}

/** Client → server: NOTHING. The gateway exposes zero message handlers (design §2, AC B14). */
export type RealtimeClientEvents = Record<string, never>

export type RealtimeSocket = Socket<RealtimeServerEvents, RealtimeClientEvents>

/**
 * The §13 rollback switch. Real-time is an ENHANCEMENT: with it off the page still works
 * exactly as it does from the fetch-all path, so flipping this env var + redeploying the SPA
 * is the whole rollback procedure.
 *
 * Opt-OUT, not opt-in: only the explicit string `'false'` disables it, so a missing/empty
 * `VITE_WS_ENABLED` (every dev machine, and any deploy that predates the flag) keeps the
 * feature on rather than silently shipping a dead socket.
 */
export function isRealtimeEnabled(): boolean {
  return import.meta.env.VITE_WS_ENABLED !== 'false'
}

/**
 * Build (but do NOT connect) the `/admin` socket.
 *
 * `autoConnect: false` is deliberate: the caller connects only once the session probe reports
 * authenticated (AC F7), so an anonymous page load never opens a socket that is guaranteed to
 * be rejected.
 *
 * The origin reuses the SAME `VITE_API_URL` as the REST client — empty in dev ⇒ same-origin
 * ⇒ the Vite dev proxy's `/socket.io` entry (which needs `ws: true`, see `vite.config.ts`).
 */
export function createRealtimeSocket(): RealtimeSocket {
  const origin = import.meta.env.VITE_API_URL || window.location.origin
  return io(`${origin}${REALTIME_NAMESPACE}`, {
    path: REALTIME_PATH,
    // REQUIRED: this is what sends the `eb.sid` session cookie on the handshake.
    withCredentials: true,
    autoConnect: false,
    reconnectionAttempts: Infinity,
    reconnectionDelay: RECONNECT_DELAY_MS,
    reconnectionDelayMax: RECONNECT_DELAY_MAX_MS,
  })
}
