import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useToast } from '@/client-portal/components/feedback/toast-context'
import {
  ClientRealtimeContext,
  SELF_ACTION_TTL_MS,
  type ClientRealtimeContextValue,
  type ClientRealtimeHandlers,
  type ClientRealtimeSubscriber,
} from '@/client-portal/hooks/useClientRealtime'
import {
  CLIENT_REALTIME_EVENTS,
  CLIENT_REALTIME_MESSAGES,
  TERMINAL_CONNECT_ERRORS,
  createClientRealtimeSocket,
  hasRealtimeCredential,
  type ClientBookingUpdatedPayload,
  type ClientRealtimeSocket,
  type ClientVenueAvailabilityPayload,
} from '@/client-portal/lib/client-realtime'

/**
 * The one `/client` socket the whole LIFF surface shares. Everything about WHY it lives at the shell
 * — and why no page owns it — is in `hooks/useClientRealtime.ts`; this file is the component alone,
 * so Fast Refresh keeps working for the shell.
 *
 * ── 🔴 IT RENDERS NO MARKUP, DELIBERATELY ──
 * There is no connection chip, no "อัปเดตอัตโนมัติหยุด" banner, no reconnect spinner. The back-office
 * has one because an operator watching a live queue needs to know the queue stopped moving; a
 * teacher looking at a room's calendar does not, and a status pill on a phone screen would spend its
 * life reporting the transient drops a LINE webview produces every time it is backgrounded. The
 * screens are correct from their fetch path with the socket down — that is the fallback, and it is
 * why nothing here is allowed to fail loudly.
 */
export function ClientRealtimeProvider({
  enabled,
  children,
}: {
  /**
   * May this session hold a socket at all? `phase === 'settled' && access === 'allowed'` — the
   * gateway refuses everyone else (`AppAccess !== ALLOWED` ⇒ `FORBIDDEN`), and a user who is not
   * past the gate is looking at a screen with nothing on it to keep truthful.
   *
   * Flipping this to `false` — logging out, losing access, unmounting — tears the socket down in the
   * effect's cleanup. There is no other disconnect path and there must not be one.
   */
  enabled: boolean
  children: ReactNode
}) {
  const showToast = useToast()
  const subscribers = useRef(new Set<ClientRealtimeSubscriber>())

  /**
   * Which venue rooms this client believes it is in, and how many components asked.
   *
   * 🔴 IT IS A REF, NOT STATE, AND IT IS READ ON EVERY `connect`. Room membership does not survive a
   * dropped socket: the server forgets every `venue:watch` the moment the transport closes, so a
   * client that emitted once at mount would keep a live, listening socket that is in no venue room
   * at all. That failure is invisible — nothing errors, the calendar simply stops updating after the
   * first blip — which is exactly why the rejoin is driven from here rather than from the hook.
   *
   * Counted rather than a `Set` so two components watching one venue cannot unwatch each other.
   */
  const watched = useRef(new Map<string, number>())

  /** The live socket, or `null` while disabled. Read by `watchVenue`, which is not in the effect. */
  const socketRef = useRef<ClientRealtimeSocket | null>(null)

  /**
   * Mutations THIS client started, keyed by cuid or `BR-…` code, each holding its own expiry timer.
   *
   * ── 🔴 WHY THIS EXISTS: THE USER MUST NOT BE TOLD ABOUT THE THING THEY JUST DID ──
   * The same principle that makes `PENDING` silent below, one status further on. Cancelling from
   * `#/booking/:id` already raises a local *"ยกเลิก BR-… เรียบร้อยแล้ว"*; the server then announces
   * the same transition on `user:<cuid>` and the global handler would follow it a beat later with
   * *"คำขอ BR-… ถูกยกเลิกแล้ว"* — an amber warning, in a colour that reads as something having gone
   * wrong, for an action that succeeded. Two notices for one tap look like the action ran twice.
   *
   * ── 🔴 A MARK MEANS "I STARTED THIS", NOT "THIS WILL BE `CANCELLED`" ──
   * It is deliberately status-BLIND, because the echo's status is not the client's to predict.
   * Cancelling ONE DAY of a multi-day approved booking leaves the request `APPROVED`, so the server
   * emits `status: APPROVED` — and a suppression scoped to `CANCELLED` read that echo as fresh
   * external news and announced *"คำขอ BR-… ได้รับการอนุมัติแล้ว"* at the very person who had just
   * released a slot. The local screen has already said what happened, precisely and in the right
   * words; the global handler's job is to stay out of its way.
   *
   * ⚠️ A MAP, NOT A SET, AND THE VALUE IS THE TIMER. Membership and expiry have to be dropped
   * together: a `Set` plus a loose `setTimeout` leaves a timer that outlives the key it was cleaning
   * up, and that stale timer would delete a LATER mark for the same booking before its event landed.
   * Holding the handle next to the key is what makes both `consumeSelfAction` and the unmount sweep
   * exact rather than approximate.
   */
  const selfActions = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  /**
   * Drop a mark and its timer. The only place either is removed, so the two can never drift.
   */
  const forgetSelfAction = useCallback((key: string) => {
    const timer = selfActions.current.get(key)
    if (timer !== undefined) clearTimeout(timer)
    selfActions.current.delete(key)
  }, [])

  const markSelfAction = useCallback(
    (idOrCode: string) => {
      if (!idOrCode) return
      /* Re-marking restarts the window rather than stacking a second timer on one key. */
      forgetSelfAction(idOrCode)
      selfActions.current.set(
        idOrCode,
        setTimeout(() => {
          selfActions.current.delete(idOrCode)
        }, SELF_ACTION_TTL_MS),
      )
    },
    [forgetSelfAction],
  )

  /**
   * Did this client start the mutation this event is echoing? Answers once — the mark is spent on
   * the way out.
   *
   * 🔴 SINGLE-USE BY CONSTRUCTION, WHICH IS THE WHOLE SAFETY ARGUMENT — and, since the check moved
   * above the status switch, the ONLY one. Because the key is deleted on the match, one mark can
   * swallow at most one event: a booking this client cancelled and then, later in the same eight
   * seconds, moved by an admin still gets its second toast, and every event for a booking nobody
   * here touched is unmarked and toasts normally.
   *
   * ⚠️ ACCEPTED TRADE-OFF, NOT AN OVERSIGHT. Status-blindness means an admin decision that genuinely
   * lands inside the window opened by the user's own cancel is swallowed as if it were the echo.
   * There is no way to tell the two apart from the payload — a partial cancel's echo IS an
   * `APPROVED` for the same id — and any heuristic that guessed would be wrong silently and in the
   * more dangerous direction. One lost toast on a rare race is cheaper than routinely telling a user
   * their request was "approved" a second after they cancelled part of it.
   */
  const consumeSelfAction = useCallback(
    (payload: ClientBookingUpdatedPayload) => {
      const key = selfActions.current.has(payload.id)
        ? payload.id
        : payload.code && selfActions.current.has(payload.code)
          ? payload.code
          : null
      if (key === null) return false
      forgetSelfAction(key)
      return true
    },
    [forgetSelfAction],
  )

  /**
   * ⚠️ THE TIMERS ARE CLEARED ON UNMOUNT, and this is its own effect on purpose — a mark may be laid
   * down while `enabled` is false (no socket, nothing to suppress), so tying the sweep to the socket
   * effect would leave those handles running. A `setTimeout` writing into a ref the provider no
   * longer owns is an open handle, which this codebase treats as a defect rather than as noise.
   */
  useEffect(() => {
    const marks = selfActions.current
    return () => {
      marks.forEach((timer) => clearTimeout(timer))
      marks.clear()
    }
  }, [])

  const subscribe = useCallback((ref: ClientRealtimeSubscriber) => {
    subscribers.current.add(ref)
    return () => {
      subscribers.current.delete(ref)
    }
  }, [])

  /**
   * Fan one event out to every subscriber.
   *
   * ⚠️ EACH CALL IS ISOLATED. A subscriber that throws must not stop the next one from being told —
   * `#/bookings` and `#/booking/:id` can both be mounted for one event, and one of them failing is
   * not a reason for the other to go stale in silence.
   */
  const fanOut = useCallback(<K extends keyof ClientRealtimeHandlers>(key: K, arg: unknown) => {
    subscribers.current.forEach((ref) => {
      const handler = ref.current[key] as ((value: unknown) => void) | undefined
      if (!handler) return
      try {
        handler(arg)
      } catch (error) {
        console.error(`[client-realtime] a ${key} subscriber threw`, error)
      }
    })
  }, [])

  /**
   * Join a venue room now (if connected) and keep it in {@link watched} so `connect` can rejoin it.
   *
   * ⚠️ EMITTING WHILE DISCONNECTED IS NOT AN ERROR AND IS NOT A NO-OP EITHER — it is *registration*.
   * A screen that mounts before the handshake finishes (the common case: the socket opens as the
   * gate settles, while `#/venue/:id` is already rendering) records its interest here, and the
   * `connect` handler emits for it. Both paths lead to the same room; only the timing differs.
   */
  const watchVenue = useCallback((venueId: string) => {
    const rooms = watched.current
    const next = (rooms.get(venueId) ?? 0) + 1
    rooms.set(venueId, next)
    if (next === 1) {
      socketRef.current?.emit(CLIENT_REALTIME_MESSAGES.venueWatch, { venueId })
    }
    return () => {
      const left = (rooms.get(venueId) ?? 1) - 1
      if (left > 0) {
        rooms.set(venueId, left)
        return
      }
      rooms.delete(venueId)
      socketRef.current?.emit(CLIENT_REALTIME_MESSAGES.venueUnwatch, { venueId })
    }
  }, [])

  useEffect(() => {
    /*
     * 🔴 TWO CONDITIONS, AND THE SECOND ONE IS WHAT KEEPS A DEV-GATE SESSION QUIET. `?gate=…` runs
     * with no `VITE_LIFF_ID`, so there is no ID token and the gateway would refuse every attempt —
     * forever, on a 1–10 s backoff, logging a `connect_error` each round. Not opening the socket is
     * the whole mitigation; there is no retry loop to suppress because there is no loop.
     * See `hasRealtimeCredential`.
     */
    if (!enabled || !hasRealtimeCredential()) return

    const socket = createClientRealtimeSocket()
    socketRef.current = socket

    /* One warning per provider mount, not per attempt. A backend that is down produces a refusal
       every ten seconds for as long as the app is open, and a console full of the same line is a
       console nobody reads the useful lines out of. */
    let warned = false

    const onConnect = () => {
      /* 🔴 REJOIN EVERY VENUE ROOM. First connect and every reconnect alike — on the first there is
         usually one waiting (the screen mounted before the handshake finished), and on a reconnect
         the server has forgotten all of them. */
      watched.current.forEach((_count, venueId) => {
        socket.emit(CLIENT_REALTIME_MESSAGES.venueWatch, { venueId })
      })
    }

    /**
     * ⚠️ `UNAUTHENTICATED` IS NOT TERMINAL HERE, UNLIKE ON `/admin`. The gateway collapses a LINE
     * verify OUTAGE into that same code, and its own comment says the client is expected to
     * reconnect on its own timer. Only `FORBIDDEN` (access revoked) stops the manager — retrying
     * that cannot succeed until the gate runs again, which happens on the next launch.
     *
     * ⚠️ IT NEVER LOGS THE USER OUT. These are status CLASSES, so "the channel id is misconfigured",
     * "your token expired" and "LINE is unreachable" are indistinguishable here. The authoritative
     * answer arrives on the next HTTP call as a real 401, from a request the user actually made.
     */
    const onConnectError = (error: Error) => {
      if ((TERMINAL_CONNECT_ERRORS as readonly string[]).includes(error.message)) {
        socket.io.reconnection(false)
      }
      if (!warned) {
        warned = true
        console.warn('[client-realtime] socket refused:', error.message)
      }
    }

    /**
     * 🔴 `PENDING` MUST NOT TOAST, AND THE `switch` IS WHERE THAT IS ENFORCED.
     *
     * The server emits `bookingUpdated` to the submitter on their OWN `PENDING` submission — their
     * other devices need it, and a pending row occupies the venue calendar. A `default:` branch, or
     * a lookup table with four rows, would pop *"คำขอ … ถูกส่งแล้ว"* in the face of the person whose
     * thumb is still on the submit button, one screen after `#/sent/:id` said the same thing. It is
     * a silent state update: subscribers are told, the reader is not.
     *
     * ⚠️ SUBSCRIBERS ARE FANNED OUT FIRST, TOAST SECOND. The toast is seven seconds of Thai about a
     * request; the screen underneath it should already be showing the new status by the time it is
     * read, not flip afterwards.
     *
     * 🔴 A SELF-STARTED MUTATION IS SILENT TOO, FOR THE SAME REASON `PENDING` IS — AND THE CHECK SITS
     * **ABOVE** THE SWITCH, NOT INSIDE ONE ARM OF IT. The fan-out above runs either way (cards and
     * lists still move); only the announcement is dropped, and only for a booking this client just
     * acted on. Scoping the suppression to the `CANCELLED` arm was wrong the moment a PARTIAL
     * cancellation existed: releasing one day of a multi-day approved booking leaves the request
     * `APPROVED`, the server echoes `status: APPROVED`, and the arm-scoped version cheerfully
     * congratulated the user on an approval they had not just received. The mark's meaning is "the
     * local user initiated this", so the status it settles at is none of this handler's business.
     * See {@link selfActions} and {@link consumeSelfAction} for the trade-off that buys.
     */
    const onBookingUpdated = (payload: ClientBookingUpdatedPayload) => {
      /* The gateway is fail-soft, so a half-built payload reaches the wire rather than throwing
         server-side. Fanning out `undefined` would put `payload.id` inside every subscriber. */
      if (!payload?.id) return
      fanOut('onBookingUpdated', payload)

      /* ⚠️ AFTER THE FAN-OUT, BEFORE THE SWITCH. Subscribers must be told regardless — the whole
         point is that the screens refresh and only the toast is swallowed — and the mark is spent
         here so the next event for this booking toasts normally. `PENDING` never reaches a marked
         id in practice (nothing marks a submission), so consuming order costs nothing. */
      if (consumeSelfAction(payload)) return

      switch (payload.status) {
        case 'APPROVED':
          showToast(`คำขอ ${payload.code} ได้รับการอนุมัติแล้ว`, 'success')
          break
        case 'REJECTED':
          showToast(`คำขอ ${payload.code} ไม่ได้รับอนุมัติ`, 'error')
          break
        case 'CANCELLED':
          showToast(`คำขอ ${payload.code} ถูกยกเลิกแล้ว`, 'warning')
          break
        case 'PENDING':
          break
      }
    }

    const onVenueAvailabilityChanged = (payload: ClientVenueAvailabilityPayload) => {
      if (!payload?.venueId) return
      fanOut('onVenueAvailabilityChanged', payload)
    }

    /* Payload-free by contract — it takes no parameter, and adding one would document a field the
       server is forbidden from ever sending (`schedule:all` holds every connected end-user). */
    const onScheduleUpdated = () => {
      fanOut('onScheduleUpdated', undefined)
    }

    socket.on('connect', onConnect)
    socket.on('connect_error', onConnectError)
    socket.on(CLIENT_REALTIME_EVENTS.bookingUpdated, onBookingUpdated)
    socket.on(CLIENT_REALTIME_EVENTS.venueAvailabilityChanged, onVenueAvailabilityChanged)
    socket.on(CLIENT_REALTIME_EVENTS.scheduleUpdated, onScheduleUpdated)

    socket.connect()

    return () => {
      socketRef.current = null
      /* `off()` with no arguments drops EVERY listener, so StrictMode's double-invoke in dev can
         never leave a second copy attached to a socket that is about to be thrown away. */
      socket.off()
      socket.disconnect()
      /* ⚠️ `watched` IS NOT CLEARED. The components that asked for those rooms are still mounted —
         only the transport went away — so the next socket must rejoin exactly what this one held.
         Clearing here is how a reconnect comes back subscribed to nothing. */
    }
  }, [enabled, fanOut, showToast, consumeSelfAction])

  const value = useMemo<ClientRealtimeContextValue>(
    () => ({ subscribe, watchVenue, markSelfAction }),
    [subscribe, watchVenue, markSelfAction],
  )

  return (
    <ClientRealtimeContext.Provider value={value}>{children}</ClientRealtimeContext.Provider>
  )
}
