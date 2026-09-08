/**
 * The Socket.IO client for the LINE end-user realtime channel (`CLIENT-REALTIME-1`).
 *
 * The client-portal counterpart of `admin-portal/lib/realtime.ts`, and deliberately shaped like it:
 * this is the ONLY place `socket.io-client` is imported for this portal, so the connection contract
 * (namespace, engine path, credential, backoff) lives in one reviewable file — the same discipline
 * `api-client.ts` applies to REST.
 *
 * ── 🔴 IT IS A SECOND NAMESPACE, NOT A RELAXATION OF THE FIRST ──
 * `/admin` authenticates from the `eb.sid` httpOnly session cookie (`withCredentials: true`, no
 * token anywhere). A LINE end-user has no session and no cookie, so `/client` proves identity with
 * a **LINE ID token on the handshake** and the server verifies it through the same
 * `verifyLineIdToken` the REST guard uses. Nothing here sends credentials, and nothing on `/admin`
 * sends a token; the two must not be merged.
 *
 * Contract, and do not "simplify" any of it (verified against
 * `easybook-service/src/realtime/client-realtime.gateway.ts` and `realtime.constants.ts`):
 *  · namespace `/client` — NOT the default `/`, which the server's allowlist refuses;
 *  · engine path `/socket.io` — matches the Vite dev proxy's entry, which needs `ws: true`;
 *  · the token travels in `handshake.auth.token`. A browser WebSocket upgrade cannot carry a custom
 *    header at all, so the `Authorization: Bearer` form the gateway also accepts is for non-browser
 *    clients and the backend e2e suite, never for us.
 *
 * ── ⚠️ ROOMS, WHICH `/admin` DOES NOT HAVE ──
 * Membership of `/admin` IS its authorization boundary, so every socket there may see everything.
 * Membership here means only "an `ALLOWED` LINE user" — nearly everybody — so `D-C13` is enforced by
 * TARGETING instead: `user:<cuid>` and `schedule:all` are joined by the server on connect, and
 * `venue:<id>` is joined by us via {@link CLIENT_REALTIME_MESSAGES}. That is why this namespace has
 * an inbound surface and `/admin` has none.
 *
 * ⚠️ THE TWO INBOUND MESSAGES SUBSCRIBE, THEY DO NOT WRITE. No booking is created, cancelled or
 * approved over this socket — every write in this portal goes through REST so it can answer with a
 * status code and a reason.
 */

import { io, type Socket } from 'socket.io-client'
import { getIdToken } from '@/lib/liff'

/** The LINE end-user fan-out namespace. Full target: `<backend origin>/client`. */
export const REALTIME_CLIENT_NAMESPACE = '/client'

/** engine.io path. Must match the server default and the dev-proxy location. */
export const REALTIME_PATH = '/socket.io'

/**
 * Reconnection is socket.io's own exponential backoff + jitter — CONFIGURED here, never hand-rolled.
 * Heartbeat (`pingInterval`/`pingTimeout`) is server-driven and needs no client option at all.
 */
export const RECONNECT_DELAY_MS = 1_000
export const RECONNECT_DELAY_MAX_MS = 10_000

/** Server → client event names. Exported so the provider and the hooks cannot drift by a typo. */
export const CLIENT_REALTIME_EVENTS = {
  /**
   * One of MY bookings moved. Room `user:<cuid>` — one person's room, because the payload names a
   * request and its refusal reason and that is nobody else's business.
   *
   * 🔴 IT FIRES FOR `PENDING` TOO, and that is not a mistake to "clean up": a pending request
   * occupies the venue's calendar, and the submitter's OTHER devices need to learn about their own
   * submission. See the provider for why `PENDING` must never raise a toast.
   */
  bookingUpdated: 'client.bookingUpdated',
  /**
   * A slot at this venue was taken or freed. Room `venue:<id>`.
   *
   * 🔴 THE PAYLOAD IS `{ venueId }` AND NOTHING ELSE (`D-C13`) — no requester, no purpose, no times,
   * not even for the person who owns the booking, because the room is shared by everyone with that
   * venue's calendar open. **A refetch is therefore mandatory**: there is nothing here to patch
   * state from, by construction.
   */
  venueAvailabilityChanged: 'client.venueAvailabilityChanged',
  /**
   * The org-wide approved schedule moved. Room `schedule:all`, which every connected end-user is in.
   *
   * 🔴 **NO PAYLOAD AT ALL** — the handler receives an empty argument list, not `{}`. Same reason as
   * above, one step wider. It fires only for `APPROVED`/`CANCELLED` (the server keeps a separate,
   * narrower status list for this room than for the two events above), so a `PENDING` submission
   * never tells the whole organisation that an unapproved request exists.
   */
  scheduleUpdated: 'client.scheduleUpdated',
} as const

/**
 * Client → server messages. THE ONLY INBOUND SURFACE IN THIS PORTAL.
 *
 * Both change room membership and nothing else. The server answers each with `{ ok: boolean }`;
 * a `false` means the payload was refused or the socket hit its room ceiling, and is deliberately
 * NOT an existence oracle — an unknown venue id and a malformed one get the identical answer.
 */
export const CLIENT_REALTIME_MESSAGES = {
  venueWatch: 'venue:watch',
  venueUnwatch: 'venue:unwatch',
} as const

/**
 * The four statuses `client.bookingUpdated` can carry.
 *
 * Written out rather than imported from the generated types: this is the WIRE vocabulary of a
 * socket event, which no OpenAPI document describes, and a `BookingStatus` that grew a fifth member
 * would not automatically be announced on this channel.
 */
export type ClientBookingStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

/** `client.bookingUpdated`'s payload — the four fields a card needs to flip. */
export interface ClientBookingUpdatedPayload {
  id: string
  code: string
  status: ClientBookingStatus
  /** The approver's reason, or ADR-001's auto-rejection copy. `null` on every other transition. */
  rejectReason: string | null
}

/** `client.venueAvailabilityChanged`'s payload — which venue, and nothing else. */
export interface ClientVenueAvailabilityPayload {
  venueId: string
}

/**
 * Handshake rejections that retrying cannot fix.
 *
 * ── ⚠️ THIS LIST IS SHORTER THAN THE ADMIN PORTAL'S, ON PURPOSE ──
 * `admin-portal/lib/realtime.ts` treats `UNAUTHENTICATED` as terminal as well. It must not be
 * treated as terminal here, because on `/client` that one code also covers **a LINE verify
 * outage**: the gateway collapses `BadGatewayException` into `UNAUTHENTICATED` (a socket that
 * cannot prove who it belongs to must not be held open) and its own comment records the trade-off
 * as *"the client reconnects on its own timer"*. Switching reconnection off for it would turn a
 * transient LINE hiccup into realtime that is dead until the app is closed and reopened.
 *
 * `FORBIDDEN` is genuinely terminal: the `LineUser` exists and their `access` is no longer
 * `ALLOWED`, which no amount of retrying changes — only a fresh gate run does, and that happens on
 * the next launch.
 */
export const TERMINAL_CONNECT_ERRORS = ['FORBIDDEN'] as const

export interface ClientRealtimeServerEvents {
  [CLIENT_REALTIME_EVENTS.bookingUpdated]: (payload: ClientBookingUpdatedPayload) => void
  [CLIENT_REALTIME_EVENTS.venueAvailabilityChanged]: (
    payload: ClientVenueAvailabilityPayload,
  ) => void
  /** Payload-free — the parameter list is empty because the server emits no argument. */
  [CLIENT_REALTIME_EVENTS.scheduleUpdated]: () => void
}

export interface ClientRealtimeClientEvents {
  [CLIENT_REALTIME_MESSAGES.venueWatch]: (
    body: ClientVenueAvailabilityPayload,
    ack?: (result: { ok: boolean }) => void,
  ) => void
  [CLIENT_REALTIME_MESSAGES.venueUnwatch]: (
    body: ClientVenueAvailabilityPayload,
    ack?: (result: { ok: boolean }) => void,
  ) => void
}

export type ClientRealtimeSocket = Socket<
  ClientRealtimeServerEvents,
  ClientRealtimeClientEvents
>

/**
 * Build (but do NOT connect) the `/client` socket.
 *
 * `autoConnect: false` is deliberate: the caller connects only once the gate has settled on
 * `allowed` AND there is a token to send, so a page load never opens a socket guaranteed to be
 * rejected. See {@link hasRealtimeCredential}.
 *
 * ── 🔴 `auth` IS A CALLBACK, AND THAT IS LOAD-BEARING ──
 * socket.io re-runs it on **every** connection attempt, including every reconnect, so the token is
 * read fresh each time rather than pinned at mount. Capturing `getIdToken()` once outside this
 * function would pin a token that expires mid-session, and the reconnect that was meant to heal the
 * socket would re-present the dead credential forever.
 *
 * ⚠️ `getIdToken()` is SYNCHRONOUS (`lib/liff.ts` — it wraps `liff.getIDToken()`, which returns
 * `string | null`, and never throws). If it ever becomes async, `cb({ token: getIdToken() })` would
 * put a `Promise` on the wire: the handshake fails at runtime while type-checking perfectly,
 * because `handshake.auth` is untyped on both sides. The `?? omit` below keeps that honest — an
 * absent credential is sent as an absent key, never as `"[object Promise]"` or `""`.
 *
 * The origin reuses the SAME `VITE_API_URL` as the REST client — empty in dev ⇒ same-origin ⇒ the
 * Vite dev proxy's `/socket.io` entry (which sets `ws: true`; without it the polling handshake
 * succeeds and the upgrade dies at the dev server, which looks like a reconnect loop).
 *
 * ⚠️ NO `withCredentials`. There is no cookie in this flow, and asking for one would put the
 * handshake under the credentialed CORS rules for nothing.
 */
export function createClientRealtimeSocket(): ClientRealtimeSocket {
  const origin = import.meta.env.VITE_API_URL || window.location.origin
  return io(`${origin}${REALTIME_CLIENT_NAMESPACE}`, {
    path: REALTIME_PATH,
    autoConnect: false,
    auth: (cb: (data: Record<string, unknown>) => void) => {
      const token = getIdToken()
      cb(token ? { token } : {})
    },
    reconnectionAttempts: Infinity,
    reconnectionDelay: RECONNECT_DELAY_MS,
    reconnectionDelayMax: RECONNECT_DELAY_MAX_MS,
  })
}

/**
 * Is there a credential to hand the handshake at all?
 *
 * 🔴 THE ANSWER IS `false` FOR EVERY DEV-GATE (`?gate=…`) SESSION, AND THAT IS THE POINT. Those
 * sessions run with no `VITE_LIFF_ID`, so `getIdToken()` returns `null` and the gateway would refuse
 * every attempt — forever, on a 1–10 s timer, writing a `connect_error` each time. Declining to open
 * the socket is the difference between a quiet fixture session and a console that fills with
 * refusals nobody can act on.
 *
 * It also closes OBS-2 (a real LINE session on a channel missing the `openid` scope: logged in,
 * `ALLOWED`, and still tokenless) for free — the gate sends that case to the error screen, but a
 * socket opened before then would have had the same argument with the server.
 *
 * ⚠️ IT IS A CHECK ON *TOKEN PRESENCE*, WHICH IS EXACTLY WHAT `registration-api.ts` WARNS AGAINST —
 * and the direction is what makes it safe here. Binding a **fixture** to token presence lets a real,
 * tokenless session fall into a mock and report data that was never stored. This binds a
 * **connection** to it: the worst case is a socket that is not opened, which costs a live update, not
 * a false fact. Nothing downstream renders differently.
 */
export function hasRealtimeCredential(): boolean {
  return getIdToken() !== null
}
