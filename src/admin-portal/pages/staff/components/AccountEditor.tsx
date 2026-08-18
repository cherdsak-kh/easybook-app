/**
 * THE ONE DOOR to `PATCH /api/v1/system-users/:id`. Form, confirmation and write in one component.
 *
 * ── Why this exists at all ──
 * The prototype's `__manageMe()` — โปรไฟล์'s จัดการบัญชี button — is three lines long, and the
 * comment above it is the design:
 *
 *   "The same `openEdit` the pencil calls, on the same row, with the same guard: `canManageRow`
 *    decides, not the caller. A second entry point that reached the dialog by another route is how
 *    two doors end up enforcing two different rules — the profile card is allowed to ASK, never to
 *    decide."
 *
 * In React that cannot be a shared *dialog* alone, because the rules live in the save path, not in
 * the markup: which fields are sent, what the confirmation quotes, how a 403 is read. So the save
 * path is what is shared. โปรไฟล์ renders this with `self`; เจ้าหน้าที่ระบบ will render the same
 * component for any row it may manage. Neither of them holds a `patchSystemUser` call of its own.
 *
 * ── It lives in `pages/staff/`, and is imported by `pages/profile/` ──
 * Deliberately, and it is the one place P4 crosses that line. The capability belongs to
 * เจ้าหน้าที่ระบบ; the profile card only asks for it. Copying it into `pages/profile/components/`
 * would produce exactly the second door the prototype names.
 *
 * ── HIDING THE BUTTON HAS NEVER BEEN THE BOUNDARY ──
 * `system-users.policy.ts` decides, inside the write transaction, and `@Roles` decides before that.
 * `canPatch` denies `role` and `isActive` on a self-patch for EVERY role including SUPER_ADMIN
 * (`CANNOT_CHANGE_OWN_ROLE` / `CANNOT_CHANGE_OWN_ACTIVE_STATUS`), which is why `self` may drop that
 * whole fieldset without weakening anything: the form is not sending keys the server would refuse,
 * rather than the form being what refuses them.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  ApiError,
  listDepartments,
  listPersonnelRoles,
  patchSystemUser,
  type SystemUser,
  type UpdateSystemUserBody,
} from '@/lib/api-client'
import { ConfirmModal } from '../../../components/feedback/ConfirmModal'
import { useToast } from '../../../lib/toast-context'
import { fullName, type StaffOption, type StaffState } from '../staff-record'
import {
  StaffFormDialog,
  type StaffDiff,
  type StaffFormValues,
} from './StaffFormDialog'

/**
 * `{ id, name, isSystemReserved }` → `StaffOption`, plus the row the operator is ALREADY on if the
 * list does not contain it.
 *
 * ⚠️ `fallback` is never set from the API, and that is not an oversight. The prototype's tombstone
 * rows (`ไม่พบตำแหน่ง` / `ไม่พบกลุ่ม/ฝ่าย`) do not exist in `easybook-service` — nothing seeds them
 * and no endpoint returns one. What CAN happen is that the option a row points at was soft-deleted
 * and so is absent from the list, and `<select>` has no concept of "a value not in the list": omit
 * it and the browser silently selects option 0, so opening the dialog and pressing บันทึก would
 * quietly refile the operator under a different department. Appending the current value with
 * `fallback` is what `StaffFormDialog`'s `OptionList` already knows how to render — offered only
 * because it is already the answer, never as a choice.
 */
function toOptions(
  rows: readonly { id: number; name: string; isSystemReserved: boolean }[],
  current: { id: number; name: string },
): StaffOption[] {
  const out: StaffOption[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    reserved: r.isSystemReserved || undefined,
  }))
  if (!out.some((o) => o.id === current.id)) {
    out.push({ id: current.id, name: current.name, fallback: true })
  }
  return out
}

const MSG = {
  options: 'โหลดรายการตำแหน่งและกลุ่ม/ฝ่ายไม่สำเร็จ โปรดปิดหน้าต่างนี้แล้วลองใหม่อีกครั้ง',
  unchanged: 'ไม่มีการเปลี่ยนแปลง',
  saved: 'บันทึกข้อมูลบัญชีเรียบร้อย',
  gone: 'ตำแหน่งหรือกลุ่ม/ฝ่ายที่เลือกไม่มีอยู่แล้ว โปรดเลือกใหม่อีกครั้ง',
  denied: 'คุณไม่มีสิทธิ์แก้ไขข้อมูลนี้',
  unavailable: 'ระบบไม่สามารถใช้งานได้ชั่วคราว โปรดลองใหม่อีกครั้งในภายหลัง',
  network: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ โปรดลองใหม่อีกครั้ง',
  failed: 'บันทึกไม่สำเร็จ โปรดลองใหม่อีกครั้ง',
} as const

export function AccountEditor({
  open,
  onClose,
  target,
  self,
  currentState,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  /** The row being edited, as the API returned it. */
  target: SystemUser
  /** `target` is the signed-in operator. Drops the grant fieldset and the danger zone. */
  self: boolean
  /** The status half of the pair the replaced fieldset keeps on screen. Only read when `self`. */
  currentState?: StaffState
  /**
   * Re-read the record after a successful write. The caller re-fetches rather than being handed
   * the response body: on โปรไฟล์ the session is the ONE record the page header, the account card
   * and the sidebar identity card all render from, so there must be no moment where two of them
   * disagree.
   */
  onSaved: () => void | Promise<void>
}) {
  const toast = useToast()

  /**
   * The lists AS FETCHED. `positions` / `departments` below derive from these plus `target`.
   *
   * ⚠️ THE RAW ROWS ARE THE STATE, not the mapped options, because the mapping depends on the
   * target and the fetch must not. Holding the mapped result meant the effect had to list
   * `target.personnelRole` in its deps — and those are fresh OBJECTS out of the DTO on every
   * `/me` re-read, so a save refetched both lists, and a save is exactly when it happened.
   * Measured: three GETs per list on one page load.
   */
  const [rawPositions, setRawPositions] = useState<
    readonly { id: number; name: string; isSystemReserved: boolean }[] | null
  >(null)
  const [rawDepartments, setRawDepartments] = useState<
    readonly { id: number; name: string; isSystemReserved: boolean }[] | null
  >(null)
  const [alert, setAlert] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /** Set when the form submits; the confirmation is what actually writes. */
  const [pending, setPending] = useState<{ values: StaffFormValues; diff: StaffDiff } | null>(null)

  /**
   * Fetched on MOUNT, not on open — the two lists are small and the dialog is useless without
   * them, so paying for them while the operator is still reading the page is what keeps the click
   * instant. This component only mounts where the capability exists, so it is not a request every
   * session makes.
   */
  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const [roles, depts] = await Promise.all([listPersonnelRoles(), listDepartments()])
        if (!live) return
        setRawPositions(roles)
        setRawDepartments(depts)
      } catch {
        if (live) setAlert(MSG.options)
      }
    })()
    return () => {
      live = false
    }
  }, [])

  const positions = useMemo(
    () => (rawPositions ? toOptions(rawPositions, target.personnelRole) : null),
    [rawPositions, target.personnelRole],
  )
  const departments = useMemo(
    () => (rawDepartments ? toOptions(rawDepartments, target.department) : null),
    [rawDepartments, target.department],
  )

  const initial = useMemo<StaffFormValues>(
    () => ({
      email: target.email,
      firstName: target.firstName,
      lastName: target.lastName,
      personnelRoleId: target.personnelRole.id,
      departmentId: target.department.id,
      phoneNumber: target.phoneNumber ?? '',
      role: target.role,
      isActive: target.isActive,
    }),
    [target],
  )

  const close = () => {
    setPending(null)
    setAlert(null)
    onClose()
  }

  const onSubmit = (values: StaffFormValues, diff: StaffDiff) => {
    // Nothing changed. Say so and close rather than sending a PATCH with an empty body — which the
    // server would accept, bumping `updatedAt` and writing a row into the audit trail that records
    // no change at all.
    if (diff.length === 0) {
      toast('info', MSG.unchanged)
      close()
      return
    }
    setPending({ values, diff })
  }

  const save = async () => {
    if (!pending) return
    const v = pending.values
    setAlert(null)
    setBusy(true)
    try {
      /*
       * ⚠️ EXACTLY FIVE KEYS, and `email` is not one of them — `UpdateSystemUserDto` has no `email`
       * field at all, so the address is unchangeable after creation for everybody. `role` and
       * `isActive` are omitted ON A SELF-PATCH because `canPatch` denies them on KEY PRESENCE for
       * every role: sending `role: <the same role>` is still a 403, not a no-op.
       */
      const body: UpdateSystemUserBody = {
        firstName: v.firstName,
        lastName: v.lastName,
        personnelRoleId: v.personnelRoleId,
        departmentId: v.departmentId,
        // `null` clears it — an empty string is not a phone number, and the column is nullable.
        phoneNumber: v.phoneNumber || null,
      }
      if (!self) {
        body.role = v.role
        body.isActive = v.isActive
      }
      await patchSystemUser(target.id, body)
      await onSaved()
      toast('success', MSG.saved)
      close()
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0
      const message = err instanceof ApiError ? err.message : ''
      // ⚠️ A DELETED OPTION IS A 400, NOT A 404 — deliberately, on the server: a reserved option an
      // ADMIN may not assign answers the same 400 as an id that never existed, so the response can
      // never be used to probe which reserved rows exist.
      if (status === 400) setAlert(MSG.gone)
      else if (status === 403) setAlert(message || MSG.denied)
      else if (status === 503) setAlert(MSG.unavailable)
      else if (status === 0) setAlert(MSG.network)
      // A 401 is session death; the session-expired dialog is wired to it centrally, so this must
      // not compete with it.
      else setAlert(message || MSG.failed)
      setPending(null)
    } finally {
      setBusy(false)
    }
  }

  /*
   * ⚠️ THE ONLY EARLY RETURN IS THE LOADING ONE — this must NOT also return null on `!open`.
   *
   * `Modal` restores focus from the dialog's own `close` event, which fires when `open` goes false
   * while the component is still mounted. Unmounting an open dialog removes the node without ever
   * closing it, so the handler never runs: measured, focus was left on `<body>` after every save,
   * with a toast a keyboard user cannot reach. Staying mounted and passing `open` through is what
   * gives the platform a close to report. See `Modal`'s note for why the fix does not belong there.
   *
   * The lists are a different case: a <select> rendered before they land would offer exactly one
   * option and look like the answer. The fetch starts on mount, long before anyone clicks.
   */
  if (!positions || !departments) return null

  return (
    <>
      {/* ⚠️ STAYS OPEN WHILE THE CONFIRMATION IS UP — the two dialogs STACK, they do not swap.
          This read `open={!pending}` for one pass and the whole flow collapsed on the first save:
          `Modal` binds `onClose` to the dialog's own `close` event precisely so that Esc, the
          backdrop, the ✕ AND React setting `open` to false all report through one path (its header
          says so in as many words). So hiding the form to make room for the confirmation fired the
          form's `onClose`, which is this component's `close()` — tearing down `pending` and the
          editor before the confirmation could render. Measured: the button appeared to do nothing.

          Stacking is also the prototype's behaviour and the platform's: `showModal()` puts each
          dialog in the top layer in call order, so the confirmation paints over the form, and Esc
          reaches only the topmost. Pressing ยกเลิก there returns to the form with the values still
          typed, which is the whole reason someone opens a confirmation to read it. */}
      <StaffFormDialog
        open={open}
        onClose={close}
        mode="edit"
        self={self}
        initial={initial}
        positions={positions}
        departments={departments}
        currentState={currentState}
        alert={alert}
        busy={busy}
        onSubmit={onSubmit}
      />

      <ConfirmModal
        open={open && pending !== null}
        // Back to the FORM, not out of the flow — the operator opened the confirmation to read it,
        // and the thing they want after "no" is the values they just typed.
        onClose={() => setPending(null)}
        onConfirm={save}
        title={self ? 'ยืนยันการแก้ไขบัญชีของคุณ' : 'ยืนยันการแก้ไขบัญชี'}
        who={fullName(target) || target.email}
        description="ตรวจสอบการเปลี่ยนแปลงด้านล่างก่อนบันทึก"
        confirmLabel="บันทึก"
        busyLabel="กำลังบันทึก"
        diff={pending?.diff.map((d) => ({
          label: d.label,
          from: d.from,
          to: d.to,
          // ⚠️ Only reachable when `!self` — `canPatch` denies both keys on a self-patch, and the
          // form does not render them. On another operator's row these two are the changes that
          // grant or remove power, sitting in the same grey column as a surname.
          warn: d.label === 'บทบาท' || d.label === 'สถานะบัญชี',
        }))}
      />
    </>
  )
}
