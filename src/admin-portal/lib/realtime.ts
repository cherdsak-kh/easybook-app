/**
 * The Socket.IO client for the back-office realtime channel.
 *
 * ⚠️ RESTORED, NOT REWRITTEN. This module went with the old portal on 16 ส.ค. 2569 and should not
 * have: like `api-client.ts` it binds to the TRANSPORT CONTRACT rather than to any UI, and that
 * contract has not moved. What is new is the payload envelope — the gateway gained `actor`
 * (REALTIME-1) while this file was gone — so `LineUserEventPayload` is the one part written fresh.
 *
 * It is the ONLY place `socket.io-client` is imported, so the connection contract (namespace,
 * engine path, credentials, backoff) lives in one reviewable place, the same discipline
 * `api-client.ts` applies to REST.
 *
 * Contract, and do not "simplify" any of it:
 *  · namespace `/admin` — NOT the default `/`, which the server's allowlist refuses;
 *  · engine path `/socket.io` — matches the Vite dev proxy's entry, which needs `ws: true`;
 *  · `withCredentials: true` — the handshake authenticates from the EXISTING `eb.sid` httpOnly
 *    session cookie. There is no token to pass, none to store, and none to log.
 *
 * Strictly server → client: it subscribes to four events and sends none. That is also why no CSRF
 * token is involved — the handshake is a GET that changes nothing, and the socket-shaped threat
 * (CSWSH) is answered server-side by `Origin` validation.
 *
 * ⚠️ A VIEWER IS REFUSED HERE, and that is the server's rule, not a preference: `isRealtimeEligible`
 * admits only SUPER_ADMIN and ADMIN (and never a `mustChangePassword` session). Since 19 ส.ค. 2569 a
 * VIEWER may READ การลงทะเบียน over HTTP, so the socket's audience is now a strict SUBSET of the
 * list's. The page must therefore not open one for a VIEWER — see `useLineUsersRealtime`'s
 * `enabled`, and the offline chip that deliberately stays hidden for them.
 */

import { io, type Socket } from 'socket.io-client'
import type { LineUser } from '@/lib/api-client'

/** The admin fan-out namespace. Membership IS the authorization boundary — there are no rooms. */
export const REALTIME_NAMESPACE = '/admin'

/** engine.io path. Must match the server default and the dev-proxy location. */
export const REALTIME_PATH = '/socket.io'

/**
 * Reconnection is socket.io's own exponential backoff + jitter — CONFIGURED here, never hand-rolled.
 * Heartbeat (`pingInterval`/`pingTimeout`) is server-driven and needs no client option at all.
 */
export const RECONNECT_DELAY_MS = 1_000
export const RECONNECT_DELAY_MAX_MS = 10_000

/** Server → client event names. Exported so the hook and the page can never drift by a typo. */
export const REALTIME_EVENTS = {
  lineUserCreated: 'lineUser.created',
  lineUserUpdated: 'lineUser.updated',
  lineUserDeleted: 'lineUser.deleted',
  sessionClosed: 'session.closed',
} as const

/**
 * Handshake rejection classes. They are STATUS CLASSES, not diagnostics — the server deliberately
 * refuses to distinguish "no cookie" from "deleted user", exactly as its HTTP surface does.
 *
 * `UNAUTHENTICATED` / `FORBIDDEN` are terminal: retrying cannot fix them, so the client stops.
 * Everything else (`SESSION_STORE_UNAVAILABLE`, `FORBIDDEN_ORIGIN`, transport errors) keeps the
 * default backoff, so a recovered backend heals the socket with no page reload.
 */
export const TERMINAL_CONNECT_ERRORS = ['UNAUTHENTICATED', 'FORBIDDEN'] as const

/** Why the server closed a socket. The two reasons are handled DIFFERENTLY — see the hook. */
export type SessionClosedReason = 'REVOKED' | 'STORE_UNAVAILABLE'

export interface SessionClosedPayload {
  reason: SessionClosedReason
}

/**
 * Who performed the change, or `null` when no operator did — a LINE user following the account, or
 * registering / editing their own details through the LIFF app.
 *
 * ⚠️ NOTHING ON THIS SCREEN RENDERS IT YET, on purpose. The prototype was designed while the
 * payload carried no actor and says so in as many words ("ไม่มีผู้กระทำ · จะเป็นการแต่งขึ้น"); the
 * server has since added one. Showing "สมหญิง อนุมัติรายการนี้" is now POSSIBLE and still
 * undesigned, so it is recorded in `NEEDS_DESIGN.md` rather than invented here. The type exists so
 * the payload is described truthfully.
 */
export interface RealtimeActor {
  id: string
  name: string
}

/**
 * `lineUser.created` / `lineUser.updated` — the full row, byte-identical to one element of
 * `GET /line-users`'s `data[]`, produced by the same `toDto`. So there is NO new type here: `LineUser`
 * is the generated `LineUserResponseDto` re-exported by `api-client.ts`.
 */
export interface LineUserEventPayload {
  user: LineUser
  actor: RealtimeActor | null
}

/** `lineUser.deleted` carries an id only — the row left the operator's list (a soft delete). */
export interface LineUserDeletedPayload {
  id: string
  actor: RealtimeActor | null
}

export interface RealtimeServerEvents {
  [REALTIME_EVENTS.lineUserCreated]: (payload: LineUserEventPayload) => void
  [REALTIME_EVENTS.lineUserUpdated]: (payload: LineUserEventPayload) => void
  [REALTIME_EVENTS.lineUserDeleted]: (payload: LineUserDeletedPayload) => void
  [REALTIME_EVENTS.sessionClosed]: (payload: SessionClosedPayload) => void
}

/** Client → server: NOTHING. The gateway exposes zero message handlers. */
export type RealtimeClientEvents = Record<string, never>

export type RealtimeSocket = Socket<RealtimeServerEvents, RealtimeClientEvents>

/**
 * The rollback switch. Realtime is an ENHANCEMENT: with it off the page still works exactly as it
 * does from the fetch path, so flipping this env var + redeploying the SPA is the whole procedure.
 *
 * Opt-OUT, not opt-in: only the explicit string `'false'` disables it, so a missing/empty
 * `VITE_WS_ENABLED` (every dev machine, and any deploy predating the flag) keeps the feature on
 * rather than silently shipping a dead socket.
 */
export function isRealtimeEnabled(): boolean {
  return import.meta.env.VITE_WS_ENABLED !== 'false'
}

/**
 * Build (but do NOT connect) the `/admin` socket.
 *
 * `autoConnect: false` is deliberate: the caller connects only once the session is known to be
 * live and the role is eligible, so a page load never opens a socket guaranteed to be rejected.
 *
 * The origin reuses the SAME `VITE_API_URL` as the REST client — empty in dev ⇒ same-origin ⇒ the
 * Vite dev proxy's `/socket.io` entry.
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
