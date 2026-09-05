/**
 * The one socket the whole shell shares. Everything about WHY it lives here — and why it is not
 * owned by การลงทะเบียน — is in `realtime-context.ts`; this file is the component alone, so Fast
 * Refresh keeps working for the shell.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  REALTIME_EVENTS,
  RECONNECT_DELAY_MAX_MS,
  RECONNECT_DELAY_MS,
  TERMINAL_CONNECT_ERRORS,
  createRealtimeSocket,
  isRealtimeEnabled,
  type BookingRequestEventPayload,
  type LineUserDeletedPayload,
  type LineUserEventPayload,
  type SessionClosedPayload,
} from './realtime'
import {
  RealtimeContext,
  type RealtimeContextValue,
  type RealtimeHandlers,
  type RealtimeStatus,
  type Subscriber,
} from './realtime-context'

export function RealtimeProvider({
  enabled,
  children,
}: {
  /** The role may hold a socket at all. `false` → nothing is opened and the status is `disabled`. */
  enabled: boolean
  children: ReactNode
}) {
  const [status, setStatus] = useState<RealtimeStatus>('disabled')
  const subscribers = useRef(new Set<Subscriber>())

  const subscribe = useCallback((ref: Subscriber) => {
    subscribers.current.add(ref)
    return () => {
      subscribers.current.delete(ref)
    }
  }, [])

  /**
   * Fan one event out to every subscriber.
   *
   * ⚠️ EACH CALL IS ISOLATED. A subscriber that throws must not stop the next one from being told —
   * the sidebar count and the table are independent readers of the same news, and one of them
   * failing is not a reason for the other to go stale silently.
   */
  const fanOut = useCallback(<K extends keyof RealtimeHandlers>(key: K, arg: unknown) => {
    subscribers.current.forEach((ref) => {
      const handler = ref.current[key] as ((value: unknown) => void) | undefined
      if (!handler) return
      try {
        handler(arg)
      } catch (error) {
        console.error(`realtime: a ${key} subscriber threw`, error)
      }
    })
  }, [])

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
      if (hasConnected) fanOut('onResync', undefined)
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
      if (payload?.user) fanOut('onCreated', payload.user)
    }
    const onUpdated = (payload: LineUserEventPayload) => {
      if (payload?.user) fanOut('onUpdated', payload.user)
    }
    const onDeleted = (payload: LineUserDeletedPayload) => {
      if (payload?.id) fanOut('onDeleted', payload.id)
    }

    /*
     * ⚠️ THE SAME `payload?.record` GUARD AS THE THREE ABOVE, and it is not defensive noise: the
     * gateway is fail-soft, so a half-built payload reaches the wire rather than throwing on the
     * server. Fanning out `undefined` would put `booking.id` inside every subscriber's handler.
     *
     * The envelope is unwrapped HERE, once, so no subscriber has to know that the row travels under
     * a key — and so `actor` has exactly one place to be rendered from if the design ever asks for
     * it (`NEEDS_DESIGN.md`; nothing renders it today).
     */
    const onBookingCreated = (payload: BookingRequestEventPayload) => {
      if (payload?.booking) fanOut('onBookingCreated', payload.booking)
    }
    const onBookingUpdated = (payload: BookingRequestEventPayload) => {
      if (payload?.booking) fanOut('onBookingUpdated', payload.booking)
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)
    socket.on(REALTIME_EVENTS.lineUserCreated, onCreated)
    socket.on(REALTIME_EVENTS.lineUserUpdated, onUpdated)
    socket.on(REALTIME_EVENTS.lineUserDeleted, onDeleted)
    socket.on(REALTIME_EVENTS.bookingRequestCreated, onBookingCreated)
    socket.on(REALTIME_EVENTS.bookingRequestUpdated, onBookingUpdated)
    socket.on(REALTIME_EVENTS.sessionClosed, onSessionClosed)

    socket.connect()

    return () => {
      clearHeal()
      // `off()` with no arguments drops EVERY listener on this socket, so a StrictMode re-invoke
      // can never leave a second copy attached.
      socket.off()
      socket.disconnect()
    }
  }, [enabled, fanOut])

  const value = useMemo<RealtimeContextValue>(() => ({ status, subscribe }), [status, subscribe])

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

