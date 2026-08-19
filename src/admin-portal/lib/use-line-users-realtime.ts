/**
 * Opens the `/admin` socket for การลงทะเบียน and routes its four server → client events at the
 * caller's handlers. Returns only the connection status.
 *
 * ⚠️ ALL STATE LIVES WITH THE CALLER, and that is what keeps an arriving event from touching the
 * operator's search, filter, sort or page. This hook decides nothing about the table; it decides
 * when there is a socket and what to call.
 *
 * **Realtime is an enhancement, never a dependency.** Nothing here can block a render: the socket
 * opens from an effect, every failure lands in {@link RealtimeStatus}, and a socket that never
 * connects leaves the page working exactly as it does from its initial fetch. **No toast is ever
 * raised from this hook** — a reconnect storm must not become a notification storm.
 *
 * **Exactly one socket, always.** The effect depends ONLY on `enabled`; the handlers are held in a
 * ref that each render refreshes, so a re-render (or a fresh inline callback) can never tear down
 * and re-open the connection. Cleanup removes every listener AND disconnects, so StrictMode's
 * double-invoked effect leaves one live socket with one set of handlers, not two of either.
 */

import { useEffect, useRef, useState } from 'react'
import type { LineUser } from '@/lib/api-client'
import {
  REALTIME_EVENTS,
  RECONNECT_DELAY_MAX_MS,
  RECONNECT_DELAY_MS,
  TERMINAL_CONNECT_ERRORS,
  createRealtimeSocket,
  isRealtimeEnabled,
  type LineUserDeletedPayload,
  type LineUserEventPayload,
  type SessionClosedPayload,
} from './realtime'

/**
 * What the page's connection chip renders.
 *
 * `disabled` is NOT a failure. It is "this session was never going to have a socket" — the
 * `VITE_WS_ENABLED=false` rollback, or a VIEWER, whom the gateway refuses by role. It renders NO
 * chip at all: telling somebody the automatic updates stopped, when they never started and never
 * could, is a warning they can do nothing with.
 */
export type RealtimeStatus = 'disabled' | 'connecting' | 'live' | 'offline'

export interface LineUsersRealtimeHandlers {
  /** `lineUser.created` — a row now exists (or re-exists) in the operator's list. */
  onCreated: (user: LineUser) => void
  /** `lineUser.updated` — a row's contents changed. */
  onUpdated: (user: LineUser) => void
  /** `lineUser.deleted` — a row left the operator's list. */
  onDeleted: (id: string) => void
  /**
   * Called on every RE-connect, never on the first. Events emitted while the socket was down are
   * gone forever — the gateway has no replay and no sequence — so the page must be told that its
   * data has a HOLE in it. Without this the table is *confidently wrong*, which is strictly worse
   * than visibly stale.
   */
  onResync: () => void
}

export function useLineUsersRealtime(
  enabled: boolean,
  handlers: LineUsersRealtimeHandlers,
): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>('disabled')

  // Refreshed on EVERY render, read only from inside socket callbacks — this is what lets the
  // effect below depend on `enabled` alone without ever going stale.
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!enabled || !isRealtimeEnabled()) {
      setStatus('disabled')
      return
    }

    const socket = createRealtimeSocket()
    setStatus('connecting')

    /** First connect ⇒ the initial fetch is already authoritative; only RE-connects resync. */
    let hasConnected = false
    /** The `STORE_UNAVAILABLE` self-heal timer. Cleared on unmount and on a successful connect. */
    let healTimer: ReturnType<typeof setTimeout> | undefined
    let healAttempt = 0

    const clearHeal = () => {
      if (healTimer !== undefined) {
        clearTimeout(healTimer)
        healTimer = undefined
      }
    }

    /**
     * socket.io does NOT auto-reconnect after a SERVER-initiated disconnect — correct for
     * `REVOKED`, wrong for `STORE_UNAVAILABLE`, where a healthy admin's realtime must heal itself
     * once Redis recovers. So that one reason (and only that one) gets an explicit retry, on a
     * capped exponential backoff mirroring the manager's own.
     */
    const scheduleHeal = () => {
      clearHeal()
      const delay = Math.min(RECONNECT_DELAY_MS * 2 ** healAttempt, RECONNECT_DELAY_MAX_MS)
      healAttempt += 1
      healTimer = setTimeout(() => {
        healTimer = undefined
        socket.connect()
      }, delay)
    }

    const onConnect = () => {
      clearHeal()
      healAttempt = 0
      setStatus('live')
      if (hasConnected) handlersRef.current.onResync()
      hasConnected = true
    }

    // The manager's own backoff owns ordinary drops; do not race it with a second timer.
    const onDisconnect = () => setStatus('offline')

    /**
     * `UNAUTHENTICATED` / `FORBIDDEN` are terminal — retrying a rejected handshake forever is a
     * request storm that cannot succeed, so reconnection is switched off.
     *
     * ⚠️ Deliberately NOT a session-expiry signal. The socket must never be what logs a user out:
     * these codes are status CLASSES, so "the gateway is misconfigured", "you are a VIEWER" and
     * "your session died" are indistinguishable here. The authoritative answer arrives on the
     * operator's next HTTP request, from `SessionGuard`, as a real 401.
     */
    const onConnectError = (error: Error) => {
      if ((TERMINAL_CONNECT_ERRORS as readonly string[]).includes(error.message)) {
        socket.io.reconnection(false)
        clearHeal()
      }
      setStatus('offline')
    }

    const onSessionClosed = (payload: SessionClosedPayload) => {
      if (payload?.reason === 'STORE_UNAVAILABLE') {
        // Transient: the session store blinked. Heal when it comes back.
        scheduleHeal()
      } else {
        // REVOKED (or anything unrecognised, which is terminal by design): stop.
        socket.io.reconnection(false)
        clearHeal()
      }
      setStatus('offline')
    }

    const onCreated = (payload: LineUserEventPayload) => {
      if (payload?.user) handlersRef.current.onCreated(payload.user)
    }
    const onUpdated = (payload: LineUserEventPayload) => {
      if (payload?.user) handlersRef.current.onUpdated(payload.user)
    }
    const onDeleted = (payload: LineUserDeletedPayload) => {
      if (payload?.id) handlersRef.current.onDeleted(payload.id)
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)
    socket.on(REALTIME_EVENTS.lineUserCreated, onCreated)
    socket.on(REALTIME_EVENTS.lineUserUpdated, onUpdated)
    socket.on(REALTIME_EVENTS.lineUserDeleted, onDeleted)
    socket.on(REALTIME_EVENTS.sessionClosed, onSessionClosed)

    socket.connect()

    return () => {
      clearHeal()
      // `off()` with no arguments drops EVERY listener on this socket, so a StrictMode re-invoke
      // (or a route change and back) can never leave a second copy attached.
      socket.off()
      socket.disconnect()
    }
  }, [enabled])

  return status
}
