/**
 * The venue list the queue's `สถานที่` filter is built from.
 *
 * ⚠️ READ LIVE FROM `GET /venues`, NEVER COPIED — the prototype's own rule for this control
 * (`window.__venueList`): a venue renamed on สถานที่จัดกิจกรรม is renamed here on the next entry,
 * and the two screens can never disagree about what the places are called. A hard-coded array is
 * the same defect `useVenueVocabularies` records one layer up.
 *
 * ⚠️ THE WHOLE LIST, AND THAT IS THE ENDPOINT'S OWN SHAPE: `GET /venues` is unpaginated by design
 * and returns every non-deleted venue sorted by name. This is the one fetch on this screen that is
 * not server-filtered, and it is not a table — it is a closed vocabulary of nine rows that a school
 * grows slowly.
 *
 * ⚠️ CLOSED VENUES STAY IN THE FILTER. `isOpen` refuses new REQUESTS; it says nothing about the
 * requests already in the queue, and hiding a closed venue would make the bookings taken before it
 * shut unfindable — on the screen an operator opens precisely because the room is now shut.
 *
 * Fetched ONCE per mount rather than per open: this is a toolbar filter that stands on screen for
 * as long as the operator is working, not a dialog that is opened fresh each time. รีเฟรช re-runs
 * it through `reloadKey`.
 */

import { useEffect, useRef, useState } from 'react'
import { listVenues, type Venue } from '@/lib/api-client'

export const VENUES_FAILED = 'โหลดรายชื่อสถานที่ไม่สำเร็จ · กรองตามสถานที่ไม่ได้ชั่วคราว'

export interface VenueOptions {
  /** `null` while the first load is in flight — the filter is disabled until it lands. */
  venues: Venue[] | null
  /** Set only when there has NEVER been a usable list. See the `catch`. */
  error: string | null
}

export function useVenueOptions(reloadKey: unknown): VenueOptions {
  const [venues, setVenues] = useState<Venue[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Has the list ever arrived? See the `catch`. */
  const loaded = useRef(false)

  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const rows = await listVenues()
        if (!live) return
        setVenues(rows)
        setError(null)
        loaded.current = true
      } catch {
        // Only shout when there is nothing to show. A refresh that fails while the operator still
        // has a working filter is not worth replacing that filter with an error — and the queue
        // itself has its own error panel for the load that actually matters.
        //
        // Read through a REF rather than the state, so this effect does not depend on a value it
        // sets, which would refetch on every successful load forever.
        if (live && !loaded.current) setError(VENUES_FAILED)
      }
    })()
    return () => {
      live = false
    }
  }, [reloadKey])

  return { venues, error }
}
