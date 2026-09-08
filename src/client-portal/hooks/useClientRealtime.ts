/**
 * What a screen sees of the `/client` socket. The provider that fills it is
 * `components/shell/ClientRealtimeProvider.tsx`; the wire contract itself is
 * `lib/client-realtime.ts`.
 *
 * ── ⚠️ THREE FILES FOR ONE CONCERN, AND THE SPLIT IS NOT COSMETIC ──
 * The same arrangement the back-office uses (`realtime.ts` · `realtime-context.ts` ·
 * `RealtimeProvider.tsx`) and for the same reason: a single module exporting the provider AND these
 * hooks breaks React Fast Refresh for the whole shell (oxlint's `only-export-components` says so),
 * which on a portal whose interesting states take four LINE checks to reach is a real cost. The
 * component lives alone; everything that is not a component lives here.
 *
 * ── ⚠️ IT LIVES AT THE SHELL, NOT ON A PAGE ──
 * A page-scoped socket opens on arrival and closes on the way out, which is fine for a calendar you
 * are looking at and useless for the thing this channel mostly exists to deliver: the toast that
 * says your request was approved while you were standing on `#/settings`. The connection therefore
 * outlives every screen, and screens are ordinary subscribers to it.
 *
 * ── 🔴 SUBSCRIBERS ARE HELD AS REFS, NOT AS VALUES ──
 * Every subscriber re-points its own ref on each render, so a handler always closes over today's
 * state while the socket is never re-subscribed. Without this, a callback in a dependency array
 * re-registers the listener on every render and one event arrives two, three, ten times — the
 * classic version of this bug looks like a page that refetches in a loop.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type RefObject,
} from 'react'
import type {
  ClientBookingUpdatedPayload,
  ClientVenueAvailabilityPayload,
} from '@/client-portal/lib/client-realtime'

export interface ClientRealtimeHandlers {
  /**
   * `client.bookingUpdated` — one of MY requests moved.
   *
   * ⚠️ FIRES FOR `PENDING` AS WELL. The server announces the submitter's own submission so their
   * other devices update; a subscriber that treats every call as news the user has not seen will
   * report the thing they just did back to them.
   */
  onBookingUpdated?: (payload: ClientBookingUpdatedPayload) => void
  /**
   * `client.venueAvailabilityChanged` — availability moved at `payload.venueId`.
   *
   * 🔴 THE PAYLOAD CARRIES NOTHING ELSE, so the only correct response is a REFETCH. There is no
   * state to patch: the event does not say which hours, whose, or in which direction.
   */
  onVenueAvailabilityChanged?: (payload: ClientVenueAvailabilityPayload) => void
  /** `client.scheduleUpdated` — the org-wide approved schedule moved. Payload-free; refetch. */
  onScheduleUpdated?: () => void
}

export type ClientRealtimeSubscriber = RefObject<ClientRealtimeHandlers>

export interface ClientRealtimeContextValue {
  /** Stable for the provider's lifetime, so subscribing never re-runs. */
  subscribe: (ref: ClientRealtimeSubscriber) => () => void
  /**
   * Join `venue:<venueId>` for as long as the returned function is uncalled — and REJOIN it after
   * every reconnect, which the provider does on the caller's behalf.
   *
   * Stable for the provider's lifetime. Reference-counted, so two components watching one venue do
   * not unwatch each other.
   */
  watchVenue: (venueId: string) => () => void
  /**
   * "The next event for this booking is the echo of something I just did — do not announce it back
   * to me."
   *
   * 🔴 IT SUPPRESSES A TOAST, NOT AN EVENT. The screens still receive `onBookingUpdated` and still
   * refetch; only the provider's global announcement is swallowed. Silencing the fan-out instead
   * would leave the card that was just cancelled sitting there saying "อนุมัติแล้ว" on every OTHER
   * screen that is mounted.
   *
   * 🔴 STATUS-BLIND, AND IT HAS TO BE. Cancelling one day of a multi-day approved booking leaves the
   * request `APPROVED`, so the echo carries `APPROVED` — a mark that only covered `CANCELLED` let
   * that through as "ได้รับการอนุมัติแล้ว", congratulating the user on the request they had just cut
   * a day out of. The mark says who started the mutation, never where it lands.
   *
   * Takes the cuid **or** the `BR-…` code, because a caller may only hold one of them — the payload
   * carries both and either is enough to recognise it. Expires on its own after
   * {@link SELF_ACTION_TTL_MS}; see the provider for why that is a timer and not a promise.
   *
   * Stable for the provider's lifetime.
   */
  markSelfAction: (idOrCode: string) => void
}

export const ClientRealtimeContext = createContext<ClientRealtimeContextValue | null>(null)

/**
 * How long a self-started mutation stays recognisable to
 * {@link ClientRealtimeContextValue.markSelfAction}.
 *
 * 🔴 IT IS A CEILING ON A RACE, NOT A GUESS AT LATENCY. The mark is laid down BEFORE the `PATCH` is
 * awaited, because the server emits on the socket inside the request — on localhost the `CANCELLED`
 * frame regularly beats the HTTP response, and a mark placed after the `await` would arrive too late
 * to suppress anything. The window therefore has to cover a slow round trip on a phone (a few
 * seconds on LINE's in-app webview over mobile data), while staying short enough that a mark which
 * never matched — a request that 422'd, a socket that was down — cannot still be lying around when
 * a genuine, externally-originated cancellation arrives later in the session.
 *
 * ⚠️ THE TTL IS THE FALLBACK, NOT THE MECHANISM. A mark is consumed the instant it matches, so in
 * the normal path it lives for one round trip; this timer only cleans up the ones that never fired.
 */
export const SELF_ACTION_TTL_MS = 8_000

/**
 * Subscribe to the shell's socket for as long as the caller is mounted.
 *
 * The handlers may be fresh closures on every render — they are read through a ref, so this never
 * re-subscribes and never goes stale. That is what lets the three hooks below take a plain inline
 * arrow function without a `useCallback` at every call site.
 *
 * ⚠️ Returns silently when there is no provider above. Realtime is an ENHANCEMENT: a screen rendered
 * outside the shell (or in a spec) must still work from its fetch path rather than throw. This is
 * deliberately the opposite of `useToast()`, which throws — a toast that goes nowhere is
 * indistinguishable from nothing having happened, whereas a missing live update leaves a screen that
 * is merely as fresh as its last read.
 */
export function useClientRealtimeEvents(handlers: ClientRealtimeHandlers): void {
  const ctx = useContext(ClientRealtimeContext)
  const ref = useRef(handlers)
  ref.current = handlers

  const subscribe = ctx?.subscribe
  useEffect(() => {
    if (!subscribe) return
    return subscribe(ref)
    // `subscribe` is stable for the provider's lifetime, so this runs once per subscriber.
  }, [subscribe])
}

/**
 * Follow one venue's availability: joins `venue:<venueId>` while mounted and calls back when that
 * venue's availability moves.
 *
 * 🔴 THE CALLBACK TAKES NO ARGUMENT BECAUSE THE EVENT CARRIES NO INFORMATION (`D-C13`). It is a
 * "refetch what you are showing" pulse; a caller that tried to patch a calendar cell from it would
 * be inventing the hours.
 *
 * ⚠️ `venueId` is `undefined`-tolerant so `useParams()` can be passed straight in — a route param is
 * `string | undefined` and forcing every caller to guard would put the same `if` on every screen.
 *
 * ⚠️ REJOINING AFTER A RECONNECT IS THE PROVIDER'S JOB, and it is not optional: room membership does
 * not survive a dropped socket, so a client that watched once and never re-emitted looks perfectly
 * healthy — connected, listening — and silently receives nothing after the first network blip.
 */
export function useWatchVenue(
  venueId: string | undefined,
  onAvailabilityChanged?: () => void,
): void {
  /* Read through the subscriber ref, so this closure sees the current `venueId` and the current
     callback without ever re-registering the socket listener. */
  useClientRealtimeEvents({
    onVenueAvailabilityChanged: (payload) => {
      if (venueId && payload?.venueId === venueId) onAvailabilityChanged?.()
    },
  })

  const watchVenue = useContext(ClientRealtimeContext)?.watchVenue
  useEffect(() => {
    if (!venueId || !watchVenue) return
    return watchVenue(venueId)
  }, [venueId, watchVenue])
}

/** Listen for the payload-free org-wide schedule pulse. `APPROVED`/`CANCELLED` only, server-side. */
export function useScheduleRealtime(onScheduleUpdated?: () => void): void {
  useClientRealtimeEvents({
    onScheduleUpdated: () => {
      onScheduleUpdated?.()
    },
  })
}

/**
 * Listen for changes to the signed-in user's own bookings.
 *
 * ⚠️ THE HANDLER MUST TOLERATE `PENDING`, and on a detail screen it must check the id: this arrives
 * for every one of the reader's requests, not only the one they are looking at.
 */
export function useBookingRealtime(
  onBookingUpdated?: (payload: ClientBookingUpdatedPayload) => void,
): void {
  useClientRealtimeEvents({
    onBookingUpdated: (payload) => {
      onBookingUpdated?.(payload)
    },
  })
}

/**
 * "I am about to mutate this myself" — hand it the booking before the request goes out.
 *
 * ⚠️ ONE MARK COVERS WHOLE **AND** PARTIAL CANCELLATION, because it is laid down before the branch
 * that picks between them and the suppression no longer inspects the status. A caller does not need
 * to know, and could not reliably predict, whether the server will answer `CANCELLED` or leave the
 * request `APPROVED` with one day fewer.
 *
 * 🔴 CALL IT **BEFORE** `await`ING THE CANCEL, NOT AFTER. The server emits `client.bookingUpdated`
 * while it is still answering the `PATCH`; over the dev proxy the socket frame regularly wins that
 * race, so a mark laid down on the response has already missed the event it was meant to silence.
 * Marking first is free when the call then fails — an unmatched mark simply expires
 * ({@link SELF_ACTION_TTL_MS}).
 *
 * ⚠️ Returns a no-op outside the shell, for the same reason {@link useClientRealtimeEvents} returns
 * silently: realtime is an enhancement, and a screen rendered without the provider (or in a spec)
 * must still be able to cancel a booking.
 */
export function useMarkSelfBookingAction(): (idOrCode: string) => void {
  const markSelfAction = useContext(ClientRealtimeContext)?.markSelfAction
  return useCallback(
    (idOrCode: string) => {
      markSelfAction?.(idOrCode)
    },
    [markSelfAction],
  )
}
