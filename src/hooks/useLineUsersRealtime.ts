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
  type SessionClosedPayload,
} from '@/lib/realtime'

/**
 * What the connection indicator renders (AC F14).
 *
 * `disabled` is NOT a failure: it is the `VITE_WS_ENABLED=false` rollback state, and it
 * renders no indicator at all — claiming "not connected in real-time" for a feature the
 * operator's deployment deliberately turned off would be noise, not information.
 */
export type RealtimeStatus = 'disabled' | 'connecting' | 'live' | 'offline'

export interface LineUsersRealtimeHandlers {
  /** `lineUser.created` — a row now exists (or re-exists) in the operator's list. */
  onCreated: (user: LineUser) => void
  /** `lineUser.updated` — a row's contents changed. */
  onUpdated: (user: LineUser) => void
  /** `lineUser.deleted` — a row left the operator's list (an unfollow soft-delete). */
  onDeleted: (id: string) => void
  /**
   * Called on every RE-connect (never on the first connect). Events emitted while the socket
   * was down are gone forever, so the dataset must be reconciled from HTTP — without this the
   * table is *confidently wrong*, which is strictly worse than visibly stale (AC F12).
   */
  onResync: () => void
}

/**
 * Opens the `/admin` socket for the LINE-users page and routes its four server → client
 * events at the caller's dataset. Returns only the connection status; ALL state lives with
 * the caller, which is what keeps the operator's search / sort / filter / page untouched by
 * an arriving event.
 *
 * **Real-time is an enhancement, never a dependency.** Nothing here can block a render: the
 * socket is opened from an effect, every failure path lands in {@link RealtimeStatus}, and a
 * socket that never connects leaves the page working exactly as it does from the initial
 * fetch-all (AC F14). No toast is ever raised from this hook — a reconnect storm must not
 * become a notification storm.
 *
 * **Exactly one socket, always.** The effect depends ONLY on `enabled`; the handlers are held
 * in a ref that each render refreshes, so a re-render (or a new inline callback) can never
 * tear down and re-open the connection. Cleanup removes every listener AND disconnects, so
 * React StrictMode's double-invoked effect leaves one live socket with one set of handlers,
 * not two of either (AC F13).
 */
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

    /** First connect ⇒ the initial fetch-all is already authoritative; only RE-connects resync. */
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
     * `REVOKED`, wrong for `STORE_UNAVAILABLE`, where a healthy admin's real-time must heal
     * itself once Redis recovers. So that one reason (and only that one) gets an explicit
     * retry, on a capped exponential backoff mirroring the manager's own.
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

    const onDisconnect = () => {
      // The manager's own backoff owns ordinary drops; do not race it with a second timer.
      setStatus('offline')
    }

    /**
     * `UNAUTHENTICATED` / `FORBIDDEN` are terminal — retrying a rejected handshake forever is
     * a request storm that cannot succeed, so reconnection is switched off.
     *
     * Deliberately NOT `expireSession()`: the socket must never be what logs a user out
     * (design §3.4). These codes are status CLASSES, so "the gateway is misconfigured" and
     * "your session died" are indistinguishable here — and the authoritative answer arrives
     * on the operator's next HTTP request, from `SessionGuard`, as a real 401.
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
        // REVOKED (or anything unrecognised, which is treated as terminal by design): stop.
        socket.io.reconnection(false)
        clearHeal()
      }
      setStatus('offline')
    }

    const onCreated = (user: LineUser) => handlersRef.current.onCreated(user)
    const onUpdated = (user: LineUser) => handlersRef.current.onUpdated(user)
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
      // `off()` with no arguments drops EVERY listener on this socket, so a StrictMode
      // re-invoke (or a route change and back) can never leave a second copy attached.
      socket.off()
      socket.disconnect()
    }
  }, [enabled])

  return status
}
