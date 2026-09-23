/**
 * The shell's realtime CONTEXT — what a subscriber sees. The provider that fills it is
 * `RealtimeProvider.tsx`, and the socket contract itself is `realtime.ts`.
 *
 * ⚠️ THREE FILES FOR ONE CONCERN, AND THE SPLIT IS NOT COSMETIC. A single module exporting the
 * provider AND these hooks breaks Fast Refresh for the whole shell during development (oxlint's
 * `only-export-components` says so), which on a page whose interesting states take a minute to
 * reach is a real cost. The component lives alone; everything that is not a component lives here.
 *
 * ⚠️ IT LIVES AT THE SHELL RATHER THAN ON การลงทะเบียน BECAUSE THE SIDEBAR COUNTS OUTLIVE THE PAGE.
 * A hook owned by the page opens its socket on arrival and closes it on the way out, which is fine
 * for a table you are looking at and useless for a number you are meant to notice from somewhere
 * else: `รออนุมัติ` has to move while the operator is on โปรไฟล์. The first version of this was
 * that page-scoped hook; hoisting it is what made the count real, not a refactor for tidiness.
 *
 * That is now load-bearing TWICE — `usePendingRegistrations` and `usePendingBookings` are both
 * ordinary subscribers of this one socket, and BOTH of their pills have to move while the operator
 * is standing somewhere else. A page-scoped connection cannot do it for either.
 *
 * ⚠️ SUBSCRIBERS ARE HELD AS REFS, NOT AS VALUES. Each subscriber re-points its own ref on every
 * render, so a handler always closes over today's state while the socket is never re-subscribed.
 * That is what lets การลงทะเบียน read `rows`, `access` and `shown` directly inside its handlers.
 */

import { createContext, useContext, useEffect, useRef, type RefObject } from 'react'
import type { BookingRequestListItem, LineUser } from '@/lib/api-client'

/**
 * What a connection indicator may render.
 *
 * `disabled` is NOT a failure. It is "this session was never going to have a socket" — the
 * `VITE_WS_ENABLED=false` rollback, or a VIEWER, whom the gateway refuses by role. Screens render
 * NO indicator for it: telling somebody the automatic updates stopped, when they never started and
 * never could, is a warning they can do nothing with.
 */
export type RealtimeStatus = 'disabled' | 'connecting' | 'live' | 'offline'

export interface RealtimeHandlers {
  /** `lineUser.created` — a row now exists (or re-exists). */
  onCreated?: (user: LineUser) => void
  /** `lineUser.updated` — a row's contents changed. */
  onUpdated?: (user: LineUser) => void
  /** `lineUser.deleted` — a row left the operator's list. */
  onDeleted?: (id: string) => void
  /**
   * `bookingRequest.created` — a request now exists in the approval queue. Either a LINE user
   * submitted one through LIFF, or an operator filed a booking directly (born `APPROVED`).
   *
   * ⚠️ THE THREE OLDER HANDLERS ARE การลงทะเบียน'S AND THESE TWO ARE คำขอจองสถานที่'S, which is why
   * they are named after the RECORD rather than after the verb. `onCreated` was named before there
   * was a second live table; renaming it now would be a rename across a working screen for no gain,
   * so the rule is simply that anything added from here on carries its record's name.
   */
  onBookingCreated?: (booking: BookingRequestListItem) => void
  /**
   * `bookingRequest.updated` — a request was approved, rejected, cancelled, **or auto-rejected by
   * ADR-001** because somebody else's overlapping request won the room.
   *
   * 🔴 EXPECT A BURST, NOT ONE CALL PER OPERATION: one approval fires this once for the subject and
   * once for EVERY displaced loser. That is the whole point of the event — the losers are rows on
   * other operators' screens.
   */
  onBookingUpdated?: (booking: BookingRequestListItem) => void
  /**
   * Called on every RE-connect, never on the first. Events emitted while the socket was down are
   * gone forever — the gateway has no replay and no sequence — so a subscriber must be told its
   * data has a HOLE in it. Without this the screen is *confidently wrong*, which is strictly worse
   * than visibly stale.
   */
  onResync?: () => void
}

export type Subscriber = RefObject<RealtimeHandlers>

export interface RealtimeContextValue {
  status: RealtimeStatus
  /** Stable for the provider's lifetime, so subscribing never re-runs on a status change. */
  subscribe: (ref: Subscriber) => () => void
}

export const RealtimeContext = createContext<RealtimeContextValue | null>(null)

/**
 * Subscribe to the shell's socket for as long as the caller is mounted.
 *
 * The handlers may be fresh closures on every render — they are read through a ref, so this never
 * re-subscribes and never goes stale.
 */
export function useRealtimeEvents(handlers: RealtimeHandlers): void {
  const ctx = useContext(RealtimeContext)
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
 * For the controls that render the connection state: the `อัปเดตอัตโนมัติหยุด` chip in the header of
 * การลงทะเบียน and of คำขอจองสถานที่ — the two live tables.
 *
 * ⚠️ ONLY `offline` MAY DRAW ANYTHING. `disabled` is a VIEWER (or the rollback flag), and telling
 * somebody that automatic updates stopped, when their role was never issued a socket, is a warning
 * they can do nothing with.
 */
export function useRealtimeStatus(): RealtimeStatus {
  return useContext(RealtimeContext)?.status ?? 'disabled'
}
