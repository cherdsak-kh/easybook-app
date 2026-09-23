/**
 * The number on the `การลงทะเบียน` menu row: how many registrations are waiting for a decision.
 *
 * ⚠️ THIS IS THE ONE NUMBER THE PROTOTYPE SAYS MAY MOVE ON ITS OWN. Everything else on that screen
 * waits for a click, because moving it would move a row under the operator's hand — but this is "a
 * single number with no row attached to it" (README, หน้าการลงทะเบียนแบบ real-time), so it updates
 * the moment the news arrives. The rule was never "nothing moves"; it was "nothing MOVES A ROW".
 *
 * ── Why it refetches instead of counting locally ──
 * A `lineUser.updated` payload carries the row's NEW state and not its old one, so a client cannot
 * tell whether that row just entered the queue, just left it, or was already outside it. Deriving
 * ±1 from that is guesswork that drifts further from the truth with every event. One `limit=1`
 * request answers exactly, and the answer is `meta.total` — the rows are not even transferred.
 *
 * Bursts are coalesced: approving five people in a row fires five events, and the count only has
 * to be right once they have all landed.
 *
 * ⚠️ A FAILED REFETCH KEEPS THE LAST KNOWN NUMBER. Zeroing it on a network blip would announce an
 * empty queue — the one thing this pill must never say when it is not true. `NavRow` hides a `0`
 * entirely, so a wrong zero is indistinguishable from "no work waiting".
 *
 * ⚠️ A VIEWER GETS NO SOCKET (the gateway refuses the role), so for them this number is fetched and
 * then only refreshed when they navigate. That is a real limitation and it is why the refetch is
 * also wired to the route: without it a read-only session would hold one number all day.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { listLineUsers } from '@/lib/api-client'
import { useRealtimeEvents } from './realtime-context'

/** Long enough to swallow a burst of events, short enough that nobody notices the lag. */
const COALESCE_MS = 400

export function usePendingRegistrations(): number {
  const [count, setCount] = useState(0)
  const { pathname } = useLocation()
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const load = useCallback(async () => {
    try {
      // `limit: 1` — the pill needs `meta.total`, never the rows.
      const res = await listLineUsers({ access: 'PENDING', limit: 1 })
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
   * All four events matter, and none of them can be read as ±1:
   *  · created  — a new registration arrives PENDING, but a re-follow arrives UNREGISTERED;
   *  · updated  — the row may have entered OR left the queue;
   *  · deleted  — it may or may not have been one of the waiting ones;
   *  · resync   — there was a gap, so the number on screen is of unknown age.
   */
  useRealtimeEvents({
    onCreated: schedule,
    onUpdated: schedule,
    onDeleted: schedule,
    onResync: schedule,
  })

  return count
}
