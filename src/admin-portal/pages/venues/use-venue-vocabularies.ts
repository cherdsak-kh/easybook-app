/**
 * The two curated lists this screen reads but does not own: `ประเภทสถานที่` and `สิ่งอำนวยความสะดวก`.
 *
 * ⚠️ READ LIVE, NEVER COPIED. This is the prototype's own rule, and it was learned the expensive way
 * there: the amenity vocabulary used to be a hard-coded array in the venues module, so adding a row
 * on `การตั้งค่าระบบ › สิ่งอำนวยความสะดวก` changed a table nothing on this screen read. Two records
 * of one fact is the same defect `Venue.venueTypeId` exists to avoid, one layer up.
 *
 * ⚠️ REFETCHED ON EVERY DIALOG OPEN, not once at mount — the same bug `useStaffOptions` documents.
 * Delete a category on the other screen, come back here, and a stale dropdown offers a row the
 * server has already soft-deleted: a form whose default state is a 400.
 *
 * ── The tombstone is filtered out of BOTH consumers, but not identically ──
 * `assignable` drops it, because filing a venue under "ไม่พบประเภทสถานที่" on purpose would make
 * that row mean two different things. The FILTER on the toolbar keeps it — but only while it holds
 * something — because that is the operator's repair tool for venues whose category was deleted.
 * `VenuesPage` derives the second from the first plus the venue list; this hook supplies the raw
 * material for both and decides neither.
 */

import { useEffect, useRef, useState } from 'react'
import { listAmenities, listVenueTypes, type Amenity, type VenueType } from '@/lib/api-client'

export const VOCAB_FAILED =
  'โหลดรายการประเภทสถานที่และอุปกรณ์ไม่สำเร็จ โปรดปิดหน้าต่างนี้แล้วลองใหม่อีกครั้ง'

export interface VenueVocabularies {
  /** Every non-deleted category, tombstone INCLUDED — the caller decides where it may appear. */
  venueTypes: VenueType[] | null
  /** Categories a form may offer: the tombstone removed. */
  assignableTypes: VenueType[]
  amenities: Amenity[] | null
  alert: string | null
}

export function useVenueVocabularies(reloadKey: unknown): VenueVocabularies {
  const [venueTypes, setVenueTypes] = useState<VenueType[] | null>(null)
  const [amenities, setAmenities] = useState<Amenity[] | null>(null)
  const [alert, setAlert] = useState<string | null>(null)
  /** Have the lists ever arrived? See the `catch`. */
  const loaded = useRef(false)

  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const [types, amens] = await Promise.all([listVenueTypes(), listAmenities()])
        if (!live) return
        setVenueTypes(types)
        setAmenities(amens)
        setAlert(null)
        loaded.current = true
      } catch {
        // Only shout when there is nothing to show. A refresh that fails while the operator already
        // has a usable list is not worth replacing that list with an error.
        //
        // Read through a REF rather than the state, so this effect does not depend on a value it
        // sets — which would refetch on every successful load, forever.
        if (live && !loaded.current) setAlert(VOCAB_FAILED)
      }
    })()
    return () => {
      live = false
    }
  }, [reloadKey])

  return {
    venueTypes,
    assignableTypes: (venueTypes ?? []).filter((t) => !t.isFallback),
    amenities,
    alert,
  }
}
