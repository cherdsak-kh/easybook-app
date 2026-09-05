/**
 * The number on the `คำขอจองสถานที่` menu row: how many booking requests are waiting for a decision.
 *
 * ⚠️ IT IS `usePendingRegistrations` WITH ONE ENDPOINT SWAPPED, AND THAT IS DELIBERATE — read that
 * file first; every rule below is its rule, restated here only where this queue changes the reason.
 * Two sidebar pills that answer "how many people are waiting" must not behave differently, or the
 * operator has to learn which numbers they can trust separately.
 *
 * ── Why it refetches instead of counting locally ──
 * A `bookingRequest.updated` payload carries the row's NEW status and not its old one, so a client
 * cannot tell whether that row just entered the queue, just left it, or was never in it. Deriving
 * ±1 from that is guesswork that drifts further from the truth with every event — and this queue is
 * where it would drift FASTEST, because ADR-001 makes one approval emit one `updated` for the winner
 * and one for EVERY displaced loser. A local counter would have to know that a burst of four events
 * meant "minus four", not "minus one". One `limit=1` request answers exactly, and the answer is
 * `meta.total` — the rows are not even transferred.
 *
 * Bursts are coalesced for the same reason: an approval that displaces three requests is four events
 * that must produce ONE request, and the count only has to be right once they have all landed.
 *
 * ⚠️ A FAILED REFETCH KEEPS THE LAST KNOWN NUMBER. Zeroing it on a network blip would announce an
 * empty queue — the one thing this pill must never say when it is not true. `NavRow` hides a `0`
 * entirely, so a wrong zero is indistinguishable from "no work waiting".
 *
 * ⚠️ A VIEWER GETS NO SOCKET (`REALTIME_ERRORS.forbidden` — the gateway refuses the role), yet a
 * VIEWER MAY READ THIS LIST over HTTP. So for them this number is fetched on arrival and then only
 * refreshed when they navigate. That is a real, accepted limitation — identical to the one
 * การลงทะเบียน has carried since 19 ส.ค. 2569 — and it is exactly why the refetch is also wired to
 * the route: without it a read-only session would hold one number all day. Nothing anywhere renders
 * a "live" affordance next to this pill, so it never claims to be something it is not for that role.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { listBookingRequests } from '@/lib/api-client'
import { useRealtimeEvents } from './realtime-context'

/** Long enough to swallow a burst of events, short enough that nobody notices the lag. */
const COALESCE_MS = 400

export function usePendingBookings(): number {
  const [count, setCount] = useState(0)
  const { pathname } = useLocation()
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const load = useCallback(async () => {
    try {
      /*
       * ⚠️ `limit: 10`, NOT the `limit: 1` its sibling sends, and that is the CONTRACT'S rule rather
       * than a preference: `BookingRequestLimit` is `10 | 20 | 50` and the endpoint answers **400**
       * to anything else instead of clamping — because the queue screen computes every row's ordinal
       * from the value it SENT, and a silent clamp would make all of them wrong. `GET /line-users`
       * takes an open `limit`, so `usePendingRegistrations` can ask for one row; here the smallest
       * legal page is ten. The type is what stops a caller walking into that 400, and it caught this
       * one at the build gate.
       *
       * The price is ten rows on the wire that nothing reads — the pill needs `meta.total` and only
       * `meta.total`. That is the cheapest honest answer available, and still far cheaper than the
       * alternative of counting events locally (see the header).
       */
      const res = await listBookingRequests({ status: 'PENDING', limit: 10 })
      setCount(res.meta.total)
    } catch {
      // Keep the last known number. See the header.
    }
  }, [])

  const schedule = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void load(), COALESCE_MS)
  }, [load])

  // On arrival, and again on every navigation: cheap, bounded, and the only refresh a VIEWER gets.
  useEffect(() => {
    void load()
  }, [load, pathname])

  useEffect(() => () => clearTimeout(timer.current), [])

  /*
   * All three events matter, and none of them can be read as ±1:
   *  · created  — a LIFF submission arrives PENDING, but a staff direct-create arrives APPROVED;
   *  · updated  — the row may have entered OR left the queue, and ADR-001 moves several at once;
   *  · resync   — there was a gap, so the number on screen is of unknown age.
   *
   * ⛔ There is no `bookingRequest.deleted`: a request is never removed, only moved to REJECTED or
   * CANCELLED — which is an `updated`.
   */
  useRealtimeEvents({
    onBookingCreated: schedule,
    onBookingUpdated: schedule,
    onResync: schedule,
  })

  return count
}
