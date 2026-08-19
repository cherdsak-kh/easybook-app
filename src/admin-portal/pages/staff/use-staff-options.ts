/**
 * The ตำแหน่ง / กลุ่ม/ฝ่าย lists both staff forms fill their selects from, fetched ONCE per open.
 *
 * ── Why a hook and not two fetches ──
 * `AccountEditor` (edit, and โปรไฟล์'s จัดการบัญชี) and เจ้าหน้าที่ระบบ's เพิ่มบัญชี are two dialogs
 * over one question: "which options may this form offer right now?" The prototype answers it in one
 * place — both modes of `#staff-form` read the same live arrays — and two copies here would be two
 * mappings of `reserved` / `fallback`, one of which gets the next fix.
 *
 * ⚠️ REFETCHED ON EVERY OPEN, not once at mount. That was the PO's bug (18 ส.ค. 2569): delete a
 * ตำแหน่ง on ตัวเลือกบุคลากร, come back, and the dropdown still offered it — a row the server had
 * already soft-deleted, which answers 400 on save. The prototype states the rule outright: "Both
 * selects are filled from the LIVE option arrays, every time the dialog opens — not once at boot."
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  listDepartments,
  listPersonnelRoles,
  type Department,
  type PersonnelRole,
} from '@/lib/api-client'
import type { StaffOption } from './staff-record'

export const OPTIONS_FAILED =
  'โหลดรายการตำแหน่งและกลุ่ม/ฝ่ายไม่สำเร็จ โปรดปิดหน้าต่างนี้แล้วลองใหม่อีกครั้ง'

/** The pair a row already points at, so neither can be silently rewritten. `null` on create. */
export interface CurrentOptions {
  personnelRole: { id: number; name: string }
  department: { id: number; name: string }
}

/**
 * `{ id, name, isSystemReserved, isFallback }` → `StaffOption`, plus the row the record is ALREADY
 * on if the list does not contain it.
 *
 * ⚠️ `fallback` HAS TWO SOURCES, and they are different facts that happen to want the same
 * rendering — "show it only if it is already the value".
 *
 *  1. `isFallback` FROM THE SERVER. The tombstone rows (`ไม่พบตำแหน่ง` / `ไม่พบกลุ่ม/ฝ่าย`) that
 *     `OptionsService.softDelete` re-points holders onto (OPT-FALLBACK-1). They cannot be told from
 *     the System Developer row by `isSystemReserved` — both are `true` — and the two need OPPOSITE
 *     treatment: the reserved row is assignable by a SUPER_ADMIN, the tombstone must never be
 *     offered, because filing somebody under "not found" on purpose is not something a form may do.
 *  2. NOT IN THE LIST AT ALL. The option this row points at was soft-deleted, so it is absent.
 *     `<select>` has no concept of "a value not in the list": omit it and the browser silently
 *     selects option 0, so opening the dialog and pressing บันทึก would refile the person.
 *
 * ⚠️ A TOMBSTONE CARRIES **BOTH** FLAGS. `OptionList` reads them together — `reserved` keeps a row
 * out of the ordinary choices and inside the `สงวนของระบบ` group, `fallback` hides it there unless
 * it is already the value — so dropping `reserved` does not hide a tombstone, it PROMOTES it to an
 * ungrouped, always-selectable option. That was the bug the PO reported on 18 ส.ค. 2569.
 */
function toOptions(
  // The GENERATED types, not a hand-written echo of them: this reads three fields the contract
  // owns, and a second copy stops matching the day one of them changes without the compiler saying so.
  rows: readonly (Department | PersonnelRole)[],
  current?: { id: number; name: string },
): StaffOption[] {
  const out: StaffOption[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    reserved: r.isSystemReserved || undefined,
    fallback: r.isFallback || undefined,
  }))
  // The appended row gets BOTH flags for the reason above: it is reachable for an ADMIN whose row
  // was re-pointed onto the tombstone, and without `reserved` it would come back as a normal choice
  // for the one role that must never be handed it.
  if (current && !out.some((o) => o.id === current.id)) {
    out.push({ id: current.id, name: current.name, reserved: true, fallback: true })
  }
  return out
}

export function useStaffOptions(
  open: boolean,
  current: CurrentOptions | null,
): { positions: StaffOption[] | null; departments: StaffOption[] | null; alert: string | null } {
  /**
   * The lists AS FETCHED. The mapping depends on `current` and the fetch must not: holding the
   * mapped result meant the effect had to depend on `current.personnelRole`, which is a fresh
   * OBJECT out of the DTO on every `/me` re-read — measured at three GETs per list on one load.
   */
  const [rawPositions, setRawPositions] = useState<readonly PersonnelRole[] | null>(null)
  const [rawDepartments, setRawDepartments] = useState<readonly Department[] | null>(null)
  const [alert, setAlert] = useState<string | null>(null)
  /** Have the lists ever arrived? See the `catch`. */
  const loaded = useRef(false)

  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const [roles, depts] = await Promise.all([listPersonnelRoles(), listDepartments()])
        if (!live) return
        setRawPositions(roles)
        setRawDepartments(depts)
        loaded.current = true
      } catch {
        // Only shout if there is nothing to show. A refresh that fails while the operator already
        // has a usable list is not worth replacing that list with an error.
        //
        // Read through a REF, not the state, so this effect does not depend on the value it sets —
        // which would refetch on every successful load, forever.
        if (live && !loaded.current) setAlert(OPTIONS_FAILED)
      }
    })()
    return () => {
      live = false
    }
  }, [open])

  const positions = useMemo(
    () => (rawPositions ? toOptions(rawPositions, current?.personnelRole) : null),
    [rawPositions, current?.personnelRole],
  )
  const departments = useMemo(
    () => (rawDepartments ? toOptions(rawDepartments, current?.department) : null),
    [rawDepartments, current?.department],
  )

  return { positions, departments, alert }
}
