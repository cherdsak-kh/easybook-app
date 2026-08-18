/**
 * ตรวจสอบผู้ลงทะเบียน — the review surface for a LINE registration.
 *
 * Opened by the eye in the จัดการ column and by tapping a row on a phone. All five values of
 * `access` render through this one dialog; what changes is the FOOTER.
 *
 * ⚠️ IT IS A REVIEW SURFACE, NOT AN EDIT SURFACE. Neither ALLOWED nor REJECTED offers แก้ไขข้อมูล
 * above `lg`, and that is deliberate: editing stays reachable from the row's own pencil, so nothing
 * is lost — only the wrong entry point is. What remains here is the state TRANSITIONS, which is the
 * one thing a reviewer opened this to decide.
 *
 * ⚠️ NONE OF THE FOUR ACTIONS FIRES FROM ITS OWN CLICK. Every one hands off to the shared confirm
 * dialog and passes a way back, so cancelling there returns the operator to this record — still
 * open — instead of dumping them on the table wondering what happened. That handoff is the caller's
 * to wire; this component only reports which transition was asked for.
 *
 * ⚠️ `stale` DISARMS, IT DOES NOT HIDE. When the realtime layer says this record changed under the
 * dialog, the buttons beneath are about to write to a state that no longer exists — but a button
 * that vanishes takes the explanation with it. A disabled button next to a sentence saying why is a
 * screen the operator can still read and act on.
 */

import type { ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Btn } from '../../../components/ui/Btn'
import { FieldRow } from '../../../components/ui/FieldRow'
import { InlineAlert } from '../../../components/feedback/InlineAlert'
import { Modal } from '../../../components/ui/Modal'
import { ACCESS_LABEL, ACCESS_TONE } from '../../../labels'
import { thaiDate } from '../../../lib/thai-date'
import { DASH, registrantName, type RegistrationRecord } from '../registration-record'

/** The four transitions a reviewer can ask for. Named for the write, not for the button. */
export type RegistrationAction = 'approve' | 'return' | 'block' | 'unblock'

const ICON = {
  approve: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  return: 'M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3',
  block: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
  unblock:
    'M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z',
  edit: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z',
} as const

function Glyph({ d }: { d: string }) {
  return (
    <svg
      aria-hidden="true"
      className="h-4.5 w-4.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

/**
 * ⚠️ AN ALREADY-BLOCKED USER MUST NOT BE OFFERED "อนุมัติ", and an unregistered follower has
 * nothing to approve at all. The table is what each state legally moves to, in one place, rather
 * than a role test repeated inside four branches.
 */
const TRANSITIONS: Record<
  string,
  { action: RegistrationAction; label: string; variant: 'primary' | 'warn' | 'danger' }[]
> = {
  PENDING: [
    { action: 'return', label: 'ส่งคืนแก้ไข', variant: 'warn' },
    { action: 'approve', label: 'อนุมัติ', variant: 'primary' },
  ],
  ALLOWED: [{ action: 'block', label: 'ระงับการใช้งาน', variant: 'danger' }],
  BLOCKED: [{ action: 'unblock', label: 'ปลดระงับการใช้งาน', variant: 'primary' }],
  REJECTED: [],
  UNREGISTERED: [],
}

export function RegistrationDetailDialog({
  open,
  onClose,
  record,
  canWrite = false,
  alert = null,
  stale = false,
  staleGone = false,
  notice = '',
  onAction,
  onEdit,
}: {
  open: boolean
  onClose: () => void
  record: RegistrationRecord | null
  /** A read-only session gets NO footer at all — the ✕ is the only thing left to do. */
  canWrite?: boolean
  /** A failure from the last attempt on THIS record. Cleared by the caller on reopen. */
  alert?: string | null
  /** The realtime layer says this record moved. Disarms the transitions in place. */
  stale?: boolean
  /** …and it is gone entirely, so even แก้ไขข้อมูล is dead. */
  staleGone?: boolean
  /** One amber line about this record — a reason it was returned, say. */
  notice?: string
  onAction?: (action: RegistrationAction) => void
  onEdit?: () => void
}) {
  if (!record) {
    return (
      <Modal open={false} onClose={onClose} title="ข้อมูลการลงทะเบียน">
        {null}
      </Modal>
    )
  }

  const reg = record.registration
  const unregistered = reg === null
  const name = registrantName(record)
  const acts = canWrite && !unregistered ? (TRANSITIONS[record.access] ?? []) : []

  /*
   * แก้ไขข้อมูล appears ONLY below `lg`. The pencil in the จัดการ column is the edit entry point,
   * and that column does not exist on a phone — without this button a phone user could not edit a
   * record at all. Absent for an unregistered follower, which is exactly where the desktop table
   * also shows no pencil.
   */
  const mobileEdit = canWrite && !unregistered

  /*
   * An action bar with nothing in it is a grey stripe, not a control:
   *  · unregistered / read-only → no buttons at all → no bar
   *  · REJECTED                 → only the mobile-only edit → bar hidden from `lg` up
   */
  const footerHidden = !acts.length && !mobileEdit
  const footerLgHidden = !acts.length && mobileEdit

  const footer: ReactNode = footerHidden ? null : (
    <>
      {mobileEdit && (
        <Btn
          variant="ghost"
          className="w-full sm:w-auto lg:hidden"
          disabled={staleGone}
          onClick={onEdit}
        >
          <Glyph d={ICON.edit} />
          แก้ไขข้อมูล
        </Btn>
      )}
      {acts.map((a) => (
        <Btn
          key={a.action}
          variant={a.variant}
          className="w-full sm:w-auto"
          disabled={stale || staleGone}
          onClick={() => onAction?.(a.action)}
        >
          <Glyph d={ICON[a.action]} />
          {a.label}
        </Btn>
      ))}
    </>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="ข้อมูลการลงทะเบียน"
      width={560}
      footerClassName={`flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end ${
        footerLgHidden ? 'lg:hidden' : ''
      }`.trim()}
      footer={footer}
    >
      <InlineAlert message={alert} />

      <div className="mb-4 flex items-center gap-3">
        {record.pictureUrl ? (
          <span className="h-14 w-14 shrink-0 rounded-control border border-base-300 bg-base-100">
            <img
              src={record.pictureUrl}
              alt=""
              className="h-full w-full rounded-control object-cover"
            />
          </span>
        ) : (
          // ⚠️ The neutral disc for an unregistered follower, the primary one for everyone else —
          // and both are OPAQUE (`ava-fill*`, see `admin-portal.css`). There is no initial to take
          // from a person who never told us their name, so this falls back to `?`.
          <span
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-control text-[20px] font-semibold ${
              unregistered ? 'ava-fill-none text-base-content/70' : 'ava-fill text-primary'
            }`}
          >
            {(name || record.displayName || '?').trim().charAt(0) || '?'}
          </span>
        )}
        <span className="flex min-w-0 flex-col gap-1">
          {/* An unregistered follower has no name of ours, so the LINE identity IS the heading —
              prefixed, so nobody reads a LINE display name as a registered person's real name. */}
          <span className="truncate text-[18px] font-semibold text-base-content">
            {unregistered ? `LINE: ${record.displayName ?? record.lineUserId}` : name}
          </span>
          <Badge tone={ACCESS_TONE[record.access]} className="self-start">
            {ACCESS_LABEL[record.access]}
          </Badge>
        </span>
      </div>

      <div>
        <FieldRow label="ชื่อ–สกุล">{name || DASH}</FieldRow>
        <FieldRow label="ชื่อที่แสดงใน LINE">{record.displayName || DASH}</FieldRow>
        <FieldRow label="ตำแหน่ง">{reg?.personnelRole || DASH}</FieldRow>
        <FieldRow label="กลุ่ม/ฝ่าย">{reg?.department || DASH}</FieldRow>
        <FieldRow label="เบอร์โทรศัพท์">
          <span className="tabular-nums">{reg?.phone || DASH}</span>
        </FieldRow>
        <FieldRow label="วันที่ลงทะเบียน">
          {record.registeredAt ? thaiDate(record.registeredAt) : DASH}
        </FieldRow>
      </div>

      <p
        className={`mt-4 rounded-control bg-warning/10 px-4 py-3 text-[14px] leading-[1.55] text-warning ${
          notice ? '' : 'hidden'
        }`.trim()}
      >
        {notice}
      </p>
    </Modal>
  )
}
