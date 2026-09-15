/**
 * The ตำแหน่ง / กลุ่ม/ฝ่าย lists แก้ไขข้อมูลการลงทะเบียน fills its two selects from, fetched on every
 * open — the same rule `useStaffOptions` follows, and for the same reason the PO found on
 * 18 ส.ค. 2569: delete an option on ตัวเลือกบุคลากร, come back, and a list fetched at mount still
 * offers a row the server has already soft-deleted, which answers 400 on save.
 *
 * ⚠️ AND REVALIDATED WHILE OPEN (#ISSUE-11) — on return to the tab, on another tab's write, and
 * when a dropdown opens (`refresh`). Newest read wins (`seq`); the list on screen stays put while a
 * read is in flight. `useStaffOptions` and `lib/master-sync.ts` carry the full reasoning; this
 * file follows it rather than restating it.
 *
 * ── ⚠️ WHY THIS IS NOT `useStaffOptions` ──
 * The two screens ask DIFFERENT questions of the same two tables, and the difference is a server
 * rule, not a preference:
 *
 *   เจ้าหน้าที่ระบบ  a SUPER_ADMIN MAY assign the system-reserved pair, so its hook keeps reserved
 *                    rows and groups them under `สงวนของระบบ`.
 *   การลงทะเบียน     `PATCH /line-users/:id/registration` rejects a reserved id for EVERY actor
 *                    (400, "the same 400 as an unknown id" — reserved must be indistinguishable
 *                    from never-existed). Offering one here would be a select whose top group
 *                    cannot be saved by anybody.
 *
 * So this hook DROPS reserved rows — with one exception it must make, below. An inline-created row
 * is never reserved, so it always survives that filter.
 *
 * ⚠️ THE CURRENT VALUE IS APPENDED EVEN WHEN IT IS RESERVED. A registration CAN come to point at a
 * tombstone (`ไม่พบตำแหน่ง` / `ไม่พบกลุ่ม/ฝ่าย`): deleting an option re-points every holder onto one
 * (OPT-FALLBACK-1), and those rows carry `isSystemReserved`. `<select>` has no concept of "a value
 * not in the list" — omit it and the browser silently selects option 0, so opening the dialog and
 * pressing บันทึก would refile the person under whatever happens to be first. The row is therefore
 * appended so the select shows the truth; saving it unchanged is a 400 the page turns into
 * "เลือกใหม่แล้วลองอีกครั้ง", which is the honest instruction.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createDepartment,
  createPersonnelRole,
  listDepartments,
  listPersonnelRoles,
  type Department,
  type PersonnelRole,
} from '@/lib/api-client'
import {
  broadcastMasterUpdated,
  inlineCreateError,
  isConflict,
  useMasterRevalidation,
  type MasterEntity,
} from '../../lib/master-sync'
import { useToast } from '../../lib/toast-context'
import type { RegistrationOption } from './registration-record'

export const OPTIONS_FAILED =
  'โหลดรายการตำแหน่งและกลุ่ม/ฝ่ายไม่สำเร็จ โปรดปิดหน้าต่างนี้แล้วลองใหม่อีกครั้ง'

const ENTITIES: readonly MasterEntity[] = ['personnelRole', 'department']

/** The pair the record already points at, so neither can be silently rewritten. */
export interface CurrentOptions {
  personnelRole: { id: number; name: string }
  department: { id: number; name: string }
}

export interface RegistrationOptions {
  positions: RegistrationOption[] | null
  departments: RegistrationOption[] | null
  alert: string | null
  /** Background re-read. For `Combobox`'s `onOpen`. */
  refresh: () => void
  createPosition: (name: string) => Promise<RegistrationOption>
  createDepartment: (name: string) => Promise<RegistrationOption>
}

function toOptions(
  rows: readonly (Department | PersonnelRole)[],
  current?: { id: number; name: string },
): RegistrationOption[] {
  // `isFallback` rows are reserved too, so this one test removes both the System Developer pair and
  // the two tombstones — nothing a registration may be filed under on purpose.
  const out: RegistrationOption[] = rows
    .filter((r) => !r.isSystemReserved)
    .map((r) => ({ id: r.id, name: r.name }))
  if (current && !out.some((o) => o.id === current.id)) {
    out.push({ id: current.id, name: current.name })
  }
  return out
}

export function useRegistrationOptions(
  open: boolean,
  current: CurrentOptions | null,
): RegistrationOptions {
  const toast = useToast()

  /**
   * The lists AS FETCHED. The mapping depends on `current` and the fetch must not: holding the
   * mapped result would make the effect depend on an object identity that changes on every render
   * of the row it came from.
   */
  const [rawPositions, setRawPositions] = useState<readonly PersonnelRole[] | null>(null)
  const [rawDepartments, setRawDepartments] = useState<readonly Department[] | null>(null)
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

  const fetchLists = useCallback(async () => {
    const mine = (seq.current += 1)
    try {
      const [roles, depts] = await Promise.all([listPersonnelRoles(), listDepartments()])
      if (!alive.current || mine !== seq.current) return
      setRawPositions(roles)
      setRawDepartments(depts)
      setAlert(null)
      loaded.current = true
    } catch {
      if (!alive.current || mine !== seq.current) return
      // Only shout if there is nothing to show: a refresh that fails while the operator already
      // has a usable list is not worth replacing that list with an error. Read through a REF, not
      // the state, so this callback does not depend on the value it sets.
      if (!loaded.current) setAlert(OPTIONS_FAILED)
    }
  }, [])

  useEffect(() => {
    void fetchLists()
  }, [open, fetchLists])

  const refresh = useCallback(() => {
    void fetchLists()
  }, [fetchLists])

  useMasterRevalidation(open, ENTITIES, refresh)

  const addPosition = useCallback(
    async (name: string): Promise<RegistrationOption> => {
      try {
        const row = await createPersonnelRole({ name })
        if (alive.current) {
          setRawPositions((prev) => [...(prev ?? []), row])
          void fetchLists()
        }
        broadcastMasterUpdated('personnelRole')
        return { id: row.id, name: row.name }
      } catch (err) {
        toast('error', inlineCreateError(err, 'ตำแหน่ง', name))
        if (isConflict(err)) void fetchLists()
        throw err
      }
    },
    [fetchLists, toast],
  )

  const addDepartment = useCallback(
    async (name: string): Promise<RegistrationOption> => {
      try {
        const row = await createDepartment({ name })
        if (alive.current) {
          setRawDepartments((prev) => [...(prev ?? []), row])
          void fetchLists()
        }
        broadcastMasterUpdated('department')
        return { id: row.id, name: row.name }
      } catch (err) {
        toast('error', inlineCreateError(err, 'กลุ่ม/ฝ่าย', name))
        if (isConflict(err)) void fetchLists()
        throw err
      }
    },
    [fetchLists, toast],
  )

  const positions = useMemo(
    () => (rawPositions ? toOptions(rawPositions, current?.personnelRole) : null),
    [rawPositions, current?.personnelRole],
  )
  const departments = useMemo(
    () => (rawDepartments ? toOptions(rawDepartments, current?.department) : null),
    [rawDepartments, current?.department],
  )

  return {
    positions,
    departments,
    alert,
    refresh,
    createPosition: addPosition,
    createDepartment: addDepartment,
  }
}
