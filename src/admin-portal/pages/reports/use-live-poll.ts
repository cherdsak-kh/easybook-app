/**
 * Hub 6's `อัปเดตสด 30 วิ` (D-25, AC-D10): refresh on a timer, only while it is wanted.
 *
 * It polls while ALL of these hold, and stops the moment one stops being true:
 *   · the toggle is on (`enabled`)                      · the tab is VISIBLE (a hidden tab skips the tick)
 *   · the page is mounted (leaving the route, or a role change that makes `BackendLayout` redirect,
 *     unmounts the page and the cleanup clears the timer)
 *   · the session is alive: a refresh answering 401 calls `onSessionDead`, which turns the toggle off.
 *     The shell's own 401 watcher owns the sign-in dialog; this hook must not retry into it, because a
 *     poll that keeps asking a dead session is a request storm (P1 DASH-POLL-401-1).
 *
 * ⚠️ A NEW POLL NEVER STARTS WHILE ONE IS IN FLIGHT: a slow answer must not stack a second request
 * behind it. The ref is the guard, because a state flag would not update before the next tick.
 *
 * ⚠️ IT DOES NOT RESET THE PAGE OR THE FILTERS: `refresh` re-asks for exactly what is on screen.
 */

import { useEffect, useRef } from 'react'
import type { RefreshResult } from './use-log-feed'

export const LIVE_POLL_MS = 30_000

export function useLivePoll(
  enabled: boolean,
  refresh: () => Promise<RefreshResult>,
  onSessionDead: () => void,
  intervalMs: number = LIVE_POLL_MS,
) {
  const latest = useRef({ refresh, onSessionDead })
  useEffect(() => {
    latest.current = { refresh, onSessionDead }
  })
  const inFlight = useRef(false)

  useEffect(() => {
    if (!enabled) return
    const tick = async () => {
      if (document.visibilityState !== 'visible' || inFlight.current) return
      inFlight.current = true
      try {
        const result = await latest.current.refresh()
        if (result.status === 401) latest.current.onSessionDead()
      } finally {
        inFlight.current = false
      }
    }
    const id = setInterval(() => void tick(), intervalMs)
    return () => clearInterval(id)
  }, [enabled, intervalMs])
}
