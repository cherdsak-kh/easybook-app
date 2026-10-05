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

import { useEffect, useRef, type ReactNode } from 'react'
import type { StaffSessionSummary } from '@/lib/api-client'
import { Skeleton } from '../../../components/feedback/Skeleton'
import { Badge } from '../../../components/ui/Badge'
import { Btn } from '../../../components/ui/Btn'
import { FieldRow } from '../../../components/ui/FieldRow'
import { Modal } from '../../../components/ui/Modal'
import { Avatar } from '../../../components/ui/Avatar'
import { ipLabel, lastLoginLine } from '../../../lib/session-labels'
import { thaiDate, thaiDateTime, NO_VALUE } from '../../../lib/thai-date'
import { fullName, stateOf, STAFF_STATE, type StaffRecord } from '../staff-record'
import { RoleChip } from './RoleChip'

/**
 * What the caller knows about THIS row's sessions — `GET /system-users/:id/sessions`, fetched by the
 * page (this dialog stays props-only). `undefined` on the prop means "do not render the section".
 */
export type StaffSessionsView =
  | { status: 'loading' }
  | { status: 'error'; onRetry: () => void }
  | { status: 'ok'; data: StaffSessionSummary }

/**
 * `0 เครื่อง · ถูกบังคับออกจากระบบแล้ว` only when the force is the NEWER fact. An account that was
 * force-signed-out last week and has signed in since has a latest login that is newer, and printing
 * the old force beside a fresh login would be stating something that stopped being true.
 */
function sessionCount(s: StaffSessionSummary): string {
  if (s.activeSessionCount > 0) return `${s.activeSessionCount} เครื่อง`
  const forced =
    s.lastForceRevokedAt !== null &&
    (s.lastLogin === null || new Date(s.lastForceRevokedAt) > new Date(s.lastLogin.at))
  return forced ? '0 เครื่อง · ถูกบังคับออกจากระบบแล้ว' : '0 เครื่อง'
}

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
  sessions,
  alert,
  onForceRevoke,
  onGoToSessions,
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
  /**
   * เซสชันและความปลอดภัย. Rendered only when this is given AND `canManage` AND the row is not
   * deleted — so for an ADMIN or a VIEWER the section is absent from the DOM, and the page that
   * owns the fetch never makes the request (it would 403).
   */
  sessions?: StaffSessionsView
  /** A failure line from a write launched in this dialog. Takes the notice slot — see `msg` below. */
  alert?: string
  onForceRevoke?: () => void
  onGoToSessions?: () => void
}) {
  // The notice sits ABOVE the sessions section, and the force button that raises it is below the fold on a
  // phone: without this the failure line is written where nobody is looking. `nearest` moves nothing when
  // it is already visible, and the browser's own reduced-motion setting governs any animation.
  const noticeRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (alert) noticeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [alert])

  if (!record) {
    return (
      <Modal open={false} onClose={onClose} title="ข้อมูลบัญชีเจ้าหน้าที่">
        {null}
      </Modal>
    )
  }

  const state = STAFF_STATE[stateOf(record)]
  // ⚠️ A write failure REPLACES the standing notice rather than stacking on it: the dialog answers one
  // question in one line, and a toast over a modal is unclickable (prototype L22826–22845).
  const msg = alert || notice(record, { self, canManage, myCreator })
  const showSessions = canManage && !record.deleted && sessions !== undefined

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
        ref={noticeRef}
        className={`mt-4 rounded-control bg-warning/10 px-4 py-3 text-[14px] leading-[1.55] text-warning ${
          msg ? '' : 'hidden'
        }`.trim()}
      >
        {msg}
      </p>

      {/* ── เซสชันและความปลอดภัย ── SUPER_ADMIN only (`canManage`, the question the pencils ask —
          not VIEWER logic: an ADMIN reads this table with a VIEWER's capabilities, and would otherwise
          be shown a colleague's IP address). Absent from the DOM otherwise. `hidden` sits on plain
          wrappers, never on an element carrying a `flex`/`grid` utility. NOT the audit log:
          force-revoking is a security action on the account, filed nowhere in ประวัติการทำรายการ. */}
      {showSessions && (
        <section className="fb-sec mt-4" aria-labelledby="sd-sess-h">
          <h3 id="sd-sess-h" className="fb-sec-h">
            <svg
              aria-hidden="true"
              className="fb-sec-ico"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
              />
            </svg>
            เซสชันและความปลอดภัย
          </h3>

          {sessions.status === 'ok' ? (
            <dl className="m-0">
              <div className="field-row">
                <dt className="field-label">เซสชันที่ใช้งานอยู่</dt>
                <dd className="field-value m-0">{sessionCount(sessions.data)}</dd>
              </div>
              <div className="field-row">
                <dt className="field-label">เข้าสู่ระบบล่าสุดจาก</dt>
                <dd className="field-value m-0">
                  {sessions.data.lastLogin
                    ? lastLoginLine(sessions.data.lastLogin)
                    : 'ยังไม่เคยเข้าสู่ระบบ'}
                </dd>
              </div>
              <div className="field-row">
                <dt className="field-label">หมายเลข IP</dt>
                <dd className="field-value m-0 font-mono tabular-nums">
                  {ipLabel(sessions.data.lastLogin?.ipAddress)}
                </dd>
              </div>
            </dl>
          ) : sessions.status === 'error' ? (
            <div role="alert" className="py-1">
              <p className="m-0 text-[14px] text-base-content/70">
                โหลดข้อมูลเซสชันของบัญชีนี้ไม่สำเร็จ
              </p>
              <Btn variant="ghost" className="mt-2 w-full sm:w-auto" onClick={sessions.onRetry}>
                ลองใหม่อีกครั้ง
              </Btn>
            </div>
          ) : (
            /* The three rows' height, so the dialog does not grow when the answer arrives. */
            <div aria-busy="true">
              <span className="sr-only" role="status">
                กำลังโหลดข้อมูลเซสชัน
              </span>
              <div aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="field-row">
                    <Skeleton variant="soft" className="h-3.5" width="8rem" />
                    <Skeleton className="h-4" width="11rem" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* The emergency button needs something to end and somebody else's account. */}
          {!self && sessions.status === 'ok' && sessions.data.activeSessionCount > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={onForceRevoke}
                className="btn btn-error btn-sm min-h-11 w-full sm:w-auto"
              >
                บังคับออกจากระบบทุกอุปกรณ์
              </button>
              <p className="m-0 mt-2 text-[13px] leading-[1.5] text-base-content/70">
                ใช้เมื่อสงสัยว่าบัญชีถูกบุกรุก หรือเจ้าหน้าที่พ้นหน้าที่ ·
                ทุกอุปกรณ์จะถูกออกจากระบบทันที และเจ้าของบัญชียังเข้าสู่ระบบใหม่ได้ตามปกติ
              </p>
            </div>
          )}
          {self && (
            <div className="mt-3">
              <p className="m-0 mb-2 text-[13px] leading-[1.5] text-base-content/70">
                นี่คือบัญชีของคุณเอง จึงไม่มีปุ่มบังคับออกจากระบบ เพราะจะตัดเซสชันที่คุณกำลังใช้อยู่ ·
                จัดการอุปกรณ์อื่นได้ที่หน้าประวัติการเข้าสู่ระบบ
              </p>
              <button
                type="button"
                onClick={onGoToSessions}
                className="btn btn-outline btn-sm min-h-11 w-full sm:w-auto"
              >
                ไปที่ประวัติการเข้าสู่ระบบ
              </button>
            </div>
          )}
        </section>
      )}
    </Modal>
  )
}
