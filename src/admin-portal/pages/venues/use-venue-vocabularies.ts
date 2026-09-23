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
 * ── #ISSUE-11: `refresh`, `createVenueType`, `createAmenity` ──
 * `VenueFormDialog` revalidates these lists while it is open (focus, another tab's write, a dropdown
 * opening) through `refresh`, and adds a missing category or amenity without leaving the form through
 * the two creates. They live HERE, beside the lists, so the toolbar filter on `VenuesPage` sees the
 * new row too. Newest read wins (`seq`); a failed background read keeps the lists. The create
 * contract is `useStaffOptions`': append at once, broadcast, re-read; on failure toast and REJECT.
 *
 * ── The tombstone is filtered out of BOTH consumers, but not identically ──
 * `assignable` drops it, because filing a venue under "ไม่พบประเภทสถานที่" on purpose would make
 * that row mean two different things. The FILTER on the toolbar keeps it — but only while it holds
 * something — because that is the operator's repair tool for venues whose category was deleted.
 * `VenuesPage` derives the second from the first plus the venue list; this hook supplies the raw
 * material for both and decides neither.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createAmenity,
  createVenueType,
  listAmenities,
  listVenueTypes,
  type Amenity,
  type VenueType,
} from '@/lib/api-client'
import { broadcastMasterUpdated, inlineCreateError, isConflict } from '../../lib/master-sync'
import { useToast } from '../../lib/toast-context'

export const VOCAB_FAILED =
  'โหลดรายการประเภทสถานที่และอุปกรณ์ไม่สำเร็จ โปรดปิดหน้าต่างนี้แล้วลองใหม่อีกครั้ง'

export interface VenueVocabularies {
  /** Every non-deleted category, tombstone INCLUDED — the caller decides where it may appear. */
  venueTypes: VenueType[] | null
  /** Categories a form may offer: the tombstone removed. */
  assignableTypes: VenueType[]
  amenities: Amenity[] | null
  alert: string | null
  /** Background re-read of both lists. */
  refresh: () => void
  createVenueType: (name: string) => Promise<VenueType>
  createAmenity: (name: string) => Promise<Amenity>
}

export function useVenueVocabularies(reloadKey: unknown): VenueVocabularies {
  const toast = useToast()

  const [venueTypes, setVenueTypes] = useState<VenueType[] | null>(null)
  const [amenities, setAmenities] = useState<Amenity[] | null>(null)
  const [alert, setAlert] = useState<string | null>(null)
  /** Have the lists ever arrived? See the `catch`. */
  const loaded = useRef(false)
  const seq = useRef(0)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const fetchAll = useCallback(async () => {
    const mine = (seq.current += 1)
    try {
      const [types, amens] = await Promise.all([listVenueTypes(), listAmenities()])
      if (!alive.current || mine !== seq.current) return
      setVenueTypes(types)
      setAmenities(amens)
      setAlert(null)
      loaded.current = true
    } catch {
      if (!alive.current || mine !== seq.current) return
      // Only shout when there is nothing to show. A refresh that fails while the operator already
      // has a usable list is not worth replacing that list with an error.
      //
      // Read through a REF rather than the state, so this callback does not depend on a value it
      // sets — which would refetch on every successful load, forever.
      if (!loaded.current) setAlert(VOCAB_FAILED)
    }
  }, [])

  useEffect(() => {
    void fetchAll()
  }, [reloadKey, fetchAll])

  const refresh = useCallback(() => {
    void fetchAll()
  }, [fetchAll])

  const addVenueType = useCallback(
    async (name: string): Promise<VenueType> => {
      try {
        const row = await createVenueType({ name })
        if (alive.current) {
          setVenueTypes((prev) => [...(prev ?? []), row])
          void fetchAll()
        }
        broadcastMasterUpdated('venueType')
        return row
      } catch (err) {
        toast('error', inlineCreateError(err, 'ประเภทสถานที่', name))
        if (isConflict(err)) void fetchAll()
        throw err
      }
    },
    [fetchAll, toast],
  )

  const addAmenity = useCallback(
    async (name: string): Promise<Amenity> => {
      try {
        const row = await createAmenity({ name })
        if (alive.current) {
          setAmenities((prev) => [...(prev ?? []), row])
          void fetchAll()
        }
        broadcastMasterUpdated('amenity')
        return row
      } catch (err) {
        toast('error', inlineCreateError(err, 'อุปกรณ์', name))
        if (isConflict(err)) void fetchAll()
        throw err
      }
    },
    [fetchAll, toast],
  )

  return {
    venueTypes,
    assignableTypes: (venueTypes ?? []).filter((t) => !t.isFallback),
    amenities,
    alert,
    refresh,
    createVenueType: addVenueType,
    createAmenity: addAmenity,
  }
}
