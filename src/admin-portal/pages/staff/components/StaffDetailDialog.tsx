/**
 * ข้อมูลบัญชีเจ้าหน้าที่ — read-only, and EVERY role opens it.
 *
 * That is the point of it existing separately: it is the whole screen for an ADMIN and a VIEWER,
 * and the first step for a SUPER_ADMIN. Two dialogs rather than one that turns into a form —
 * a dialog that is sometimes a form has to get both jobs right in every combination of role,
 * state and width, and this portal already has that pattern going wrong once elsewhere.
 *
 * ⚠️ `เพิ่มโดย` IS HERE AND NOWHERE ELSE. It is `createdBy`, resolved on the server WITHOUT a
 * `deletedAt` filter, so it keeps naming a colleague who has since been removed — that is the
 * audit chain working, not stale data, and it is exactly the fact a supervisor opens this for.
 * `null` only for the seeded first SUPER_ADMIN, where the honest answer is "สร้างตอนติดตั้งระบบ"
 * and not an em-dash.
 *
 * ⚠️ PROPS ONLY. It decides nothing about permissions: the caller passes `canManage` and the
 * server decides for real. `system-users.policy.ts` runs inside the write transaction and `@Roles`
 * runs before that — an action button that should not be here changes what the screen offers, not
 * what the account can do.
 */

import type { ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Btn } from '../../../components/ui/Btn'
import { FieldRow } from '../../../components/ui/FieldRow'
import { Modal } from '../../../components/ui/Modal'
import { Avatar } from '../../../components/ui/Avatar'
import { thaiDate, thaiDateTime, NO_VALUE } from '../../../lib/thai-date'
import { fullName, stateOf, STAFF_STATE, type StaffRecord } from '../staff-record'
import { RoleChip } from './RoleChip'

/**
 * ONE line, and only one — whichever fact about this row is most consequential.
 *
 * ⚠️ THE ORDER IS DELIBERATE: being deleted outranks being you, which outranks having created
 * you, which outranks being suspended, which outranks waiting on a password. Rendering all the
 * true ones would put four amber paragraphs on a dialog whose job is to answer one question.
 */
function notice(r: StaffRecord, opts: { self: boolean; canManage: boolean; myCreator: boolean }) {
  if (r.deleted)
    return 'บัญชีนี้ถูกลบแล้ว จึงไม่แสดงในรายชื่อปกติและเข้าสู่ระบบไม่ได้ · อีเมลนี้นำไปสร้างบัญชีใหม่ไม่ได้ ต้องกู้คืนบัญชีเดิมเท่านั้น'
  if (opts.self)
    return opts.canManage
      ? 'นี่คือบัญชีที่คุณกำลังใช้งานอยู่ · แก้ไขชื่อ ตำแหน่ง กลุ่ม/ฝ่าย และเบอร์โทรของตัวเองได้ที่นี่ · ส่วนบทบาท สถานะ การรีเซ็ตรหัสผ่าน และการลบบัญชี ทำกับตัวเองไม่ได้ทุกกรณี'
      : 'นี่คือบัญชีที่คุณกำลังใช้งานอยู่ · แก้ไขข้อมูลส่วนตัวได้ที่หน้าโปรไฟล์ ส่วนบทบาทและสถานะของตัวเอง เปลี่ยนเองไม่ได้ทุกกรณี'
  // Only a SUPER_ADMIN is ever told this, because only a SUPER_ADMIN has a missing pencil to
  // explain. Saying it to an ADMIN answers a question they cannot have asked — every row is
  // view-only for them.
  if (opts.canManage && opts.myCreator)
    return 'บัญชีนี้เป็นผู้สร้างบัญชีของคุณ จึงจัดการไม่ได้ ดูข้อมูลได้อย่างเดียว · หากต้องแก้ไข ให้เจ้าของบัญชีนี้ทำเอง หรือให้ผู้ดูแลระบบสูงสุดรายอื่นเป็นผู้ทำ'
  if (!r.isActive)
    return 'บัญชีนี้ถูกระงับ เข้าสู่ระบบไม่ได้จนกว่าจะเปลี่ยนสถานะกลับเป็นใช้งานอยู่ · ข้อมูลและประวัติการทำรายการยังอยู่ครบ'
  if (r.mustChangePassword)
    return 'บัญชีนี้ยังใช้รหัสผ่านชั่วคราวที่ออกให้อยู่ และจะถูกบังคับให้ตั้งรหัสผ่านใหม่เมื่อเข้าสู่ระบบครั้งแรก'
  return ''
}

export function StaffDetailDialog({
  open,
  onClose,
  record,
  self = false,
  canManage = false,
  canManageRow = false,
  myCreator = false,
  onManage,
  onRestore,
  onGoToProfile,
}: {
  open: boolean
  onClose: () => void
  /** `null` renders nothing — the caller may hold the dialog mounted between rows. */
  record: StaffRecord | null
  /** Is this the signed-in operator's own row? */
  self?: boolean
  /** Does this session hold the write capability at all (SUPER_ADMIN)? */
  canManage?: boolean
  /** May this session manage THIS row? `canManageRow` on the server, asked by the caller. */
  canManageRow?: boolean
  /** Is this row the account that created the operator's? Explains a missing pencil. */
  myCreator?: boolean
  onManage?: () => void
  onRestore?: () => void
  onGoToProfile?: () => void
}) {
  if (!record) {
    return (
      <Modal open={false} onClose={onClose} title="ข้อมูลบัญชีเจ้าหน้าที่">
        {null}
      </Modal>
    )
  }

  const state = STAFF_STATE[stateOf(record)]
  const msg = notice(record, { self, canManage, myCreator })

  /*
   * The footer is built per row and is ABSENT when it would be empty — an ADMIN reading somebody
   * else's record gets no action bar at all rather than a grey strip holding nothing.
   *
   * ⚠️ Two buttons can coexist, and only on your OWN row as a SUPER_ADMIN: the record you may edit
   * here is also the record whose avatar and password live on another page. They answer different
   * questions, so neither can stand in for the other — ghost for the navigation, solid for the
   * write.
   */
  let footer: ReactNode = null
  if (canManage && record.deleted) {
    footer = (
      <Btn variant="primary" className="w-full sm:w-auto" onClick={onRestore}>
        กู้คืนบัญชี
      </Btn>
    )
  } else {
    const parts: ReactNode[] = []
    if (self)
      parts.push(
        <Btn key="profile" variant="ghost" className="w-full sm:w-auto" onClick={onGoToProfile}>
          ไปที่โปรไฟล์ของฉัน
        </Btn>,
      )
    if (canManageRow)
      parts.push(
        <Btn key="manage" variant="primary" className="w-full sm:w-auto" onClick={onManage}>
          {self ? 'จัดการบัญชีของคุณ' : 'จัดการบัญชี'}
        </Btn>,
      )
    if (parts.length) footer = <>{parts}</>
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="ข้อมูลบัญชีเจ้าหน้าที่"
      width={560}
      footer={footer}
    >
      <div className="mb-4 flex items-center gap-3">
        <Avatar
          src={record.profilePictureUrl}
          name={fullName(record)}
          chrome=""
          className="h-14 w-14 rounded-control text-[20px]"
        />
        <span className="flex min-w-0 flex-col gap-1.5">
          <span className="truncate text-[18px] font-semibold text-base-content">
            {fullName(record)}
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            <RoleChip role={record.role} />
            <Badge tone={state.tone}>{state.label}</Badge>
          </span>
        </span>
      </div>

      <div>
        <FieldRow label="อีเมล (ชื่อผู้ใช้)">
          <span className="break-all">{record.email}</span>
        </FieldRow>
        <FieldRow label="ตำแหน่ง">{record.personnelRole.name}</FieldRow>
        <FieldRow label="กลุ่ม/ฝ่าย">{record.department.name}</FieldRow>
        <FieldRow label="เบอร์โทรศัพท์">
          <span className="tabular-nums">{record.phoneNumber || NO_VALUE}</span>
        </FieldRow>
        {/* "ยังไม่เคยเข้าสู่ระบบ" and not an em-dash: `lastLoginAt` is nullable and null means
            something specific and useful here — the account was created and never used, which is
            the row an operator chases up. */}
        <FieldRow label="เข้าใช้งานล่าสุด">
          {record.lastLoginAt ? thaiDateTime(record.lastLoginAt) : 'ยังไม่เคยเข้าสู่ระบบ'}
        </FieldRow>
        {/* Date only, where เข้าใช้งานล่าสุด carries the time — the prototype's own split, and it
            is the right one: "when did they last work?" is answered by an hour, "when were they
            added?" never is. Neither takes `tabular-nums`; that is for the phone number, where
            digits sit in a column the eye compares down. */}
        <FieldRow label="เพิ่มเมื่อ">{thaiDate(record.createdAt)}</FieldRow>
        {/* An em-dash here would read as missing data about the one account in the table whose
            provenance is least in doubt. */}
        <FieldRow label="เพิ่มโดย">
          {record.createdBy ? fullName(record.createdBy) : 'สร้างตอนติดตั้งระบบ'}
        </FieldRow>
      </div>

      {/* Amber, not rose — none of the five is an error. Always in the DOM, hidden when empty. */}
      <p
        className={`mt-4 rounded-control bg-warning/10 px-4 py-3 text-[14px] leading-[1.55] text-warning ${
          msg ? '' : 'hidden'
        }`.trim()}
      >
        {msg}
      </p>
    </Modal>
  )
}
