/**
 * การลงทะเบียน — `/backend/line-users`, `GET /api/v1/line-users`.
 *
 * The approval queue: everyone who has ever added the LINE Official Account, whether or not they
 * went on to fill in the form. It is the only LIVE table in the portal (`Q4`), and the only one
 * whose rows arrive from outside the building.
 *
 * ── THE ONE RULE EVERYTHING HERE FOLLOWS ──
 *   Anything that would MOVE a row waits for a click.
 *   Anything that does not move a row happens immediately.
 *
 * An operator's hand is already travelling toward a row when an event arrives, and a list that
 * inserts underneath that hand approves the wrong person. So "live" does not mean the table
 * reorders itself; it means the operator learns AT ONCE that their view is behind, and chooses when
 * to catch up. The learning is instant; only the layout change is deferred.
 *
 * The one exception falls out of the rule instead of bending it: when the list is EMPTY there is
 * nothing to move, so an arriving row is fetched at once — a bar reading "มีรายการใหม่ 1 รายการ"
 * over the words "ยังไม่มีรายการ" is the screen arguing with itself.
 *
 * ── Filtering is SERVER-side, unlike the prototype ──
 * There, one `apply()` sorted, filtered and paged an array already in the browser. Here `search`,
 * `access`, `sort`, `page` and `limit` are query parameters (LU-SEARCH-1 · LU-SORT-1 · LU-REGDATE-1)
 * and one page of rows is all this component ever holds. Three consequences:
 *
 *  · the counts under the table are `meta.total` from the request that produced the rows;
 *  · every filter change resets to page 1 — filtering while parked on page 2 would render an empty
 *    table under a pager insisting otherwise;
 *  · the search box is DEBOUNCED; the prototype filtered per keystroke because that cost nothing.
 *
 * ⚠️ AND THE CATCH-UP IS A REFETCH, NOT AN INSERT. `โหลดข้อมูลล่าสุด` re-runs the CURRENT query, so
 * the rows that appear are the ones the operator's filters ask for — a queued row that no longer
 * matches simply does not come back. Splicing the event payloads into the array instead would put a
 * row on screen that the filter above it excludes.
 *
 * ── Three roles, two screens ──
 * A VIEWER READS this table (PO, 19 ส.ค. 2569) and can open a record; both `PATCH`es are
 * `SUPER_ADMIN|ADMIN`, so `acl.write` is exactly the right question here — unlike เจ้าหน้าที่ระบบ,
 * where an ADMIN is also read-only. The free สถานะ select inside the edit dialog is SUPER_ADMIN's
 * alone. ⚠️ None of it is the boundary: the server answers 403 whatever this file renders.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ApiError,
  listLineUsers,
  patchLineUserAccess,
  patchLineUserRegistration,
  type LineUser,
  type LineUserSort,
} from '@/lib/api-client'
import { ConfirmModal } from '../../components/feedback/ConfirmModal'
import { EmptyState } from '../../components/feedback/EmptyState'
import { LoadError, type LoadErrorKind } from '../../components/feedback/LoadError'
import { Skeleton } from '../../components/feedback/Skeleton'
import { PageHeading } from '../../components/shell/PageHeading'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Btn } from '../../components/ui/Btn'
import { Pagination } from '../../components/ui/Pagination'
import { ACCESS_LABEL, ACCESS_TONE, type AppAccess } from '../../labels'
import { useAcl } from '../../lib/use-acl'
import { useAuth } from '../../lib/auth-context'
import { useRealtimeEvents, useRealtimeStatus } from '../../lib/realtime-context'
import { thaiDate } from '../../lib/thai-date'
import { useToast } from '../../lib/toast-context'
import { ADMIN_PORTAL_ROUTES, urlOf, type AdminRoute, type AdminRouteLabel } from '../../routes'
import {
  RegistrationDetailDialog,
  type RegistrationAction,
} from './components/RegistrationDetailDialog'
import {
  RegistrationEditDialog,
  type RegistrationDiff,
  type RegistrationEditValues,
} from './components/RegistrationEditDialog'
import {
  DASH,
  registrantName,
  whoOf,
  type RegistrationRecord,
} from './registration-record'
import { useRegistrationOptions } from './use-registration-options'

/** 10 per page — the request the prototype's pager describes. The endpoint's own default is 20. */
const PAGE_SIZE = 10

/**
 * Where ส่งออก Excel went. The prototype moved it off this page — an approval queue's page-level
 * actions should not compete with the per-row work — and this link is what stops that move from
 * reading as a lost feature.
 *
 * ⚠️ Built from the route TABLE, not written out as a string: `AdminRouteLabel` fails the build if
 * that destination is ever renamed, where a hand-written `/backend/reports/registrations` would
 * quietly become a 404. The screen behind it does not exist yet, so today it lands on the coming-soon
 * stand-in the router already renders — which is the honest destination, not a dead button.
 */
const REPORT_LABEL: AdminRouteLabel = 'รายงานการลงทะเบียน'
const REPORT_URL = urlOf(ADMIN_PORTAL_ROUTES.find((r) => r.label === REPORT_LABEL)!)

/** `''` is "no filter", which is not a value the query may carry. */
type AccessFilter = '' | AppAccess

const ICON = {
  refresh:
    'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  eye: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z',
  eyeInner: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  pencil:
    'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z',
  chevron: 'M9 5l7 7-7 7',
  caret: 'M19 9l-7 7-7-7',
  info: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z',
  offline:
    'M3 3l18 18M8.288 8.29a10.5 10.5 0 00-2.65 1.86m12.724 0a10.5 10.5 0 00-4.6-2.634M12 20.25h.008v.008H12v-.008zM9.348 14.652a3.75 3.75 0 015.304 0M2.25 6.75a16.5 16.5 0 014.263-2.94',
  report:
    'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  users:
    'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z',
} as const

function Glyph({ d, className = 'h-4.5 w-4.5 shrink-0' }: { d: string; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
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
 * The face on a row — and THE PICTURE ALWAYS WINS.
 *
 * ⚠️ THIS EXISTS BECAUSE THE FIRST PORT ASKED THE WRONG QUESTION FIRST (PO, 19 ส.ค. 2569). The rows
 * branched on `registration` and only reached for `pictureUrl` inside the registered branch, so
 * somebody who had just added the LINE account — a follower with a real LINE photo and no
 * registration yet — rendered as the neutral `?` disc. The detail dialog got it right (it tests
 * `pictureUrl` first), so the same person had a face in the dialog and none in the list.
 *
 * The correct rule, and the one the dialog was already following:
 *   1. a LINE picture, if LINE gave us one — it belongs to the person, not to their paperwork;
 *   2. otherwise their initial, on the primary disc;
 *   3. otherwise `?` on the NEUTRAL disc — no name was ever given, so there is no initial to take.
 *
 * Registration decides only which FALLBACK, never whether the photo is shown. It lives in one
 * component used by both layouts because two copies of this rule is exactly how it broke.
 */
function RowAvatar({ record, className }: { record: RegistrationRecord; className: string }) {
  if (record.pictureUrl) return <Avatar src={record.pictureUrl} className={className} />
  if (record.registration) return <Avatar name={record.registration.firstName} className={className} />
  return (
    <span
      aria-hidden="true"
      className={`ava-fill-none flex items-center justify-center text-base-content/70 ${className}`}
    >
      ?
    </span>
  )
}

/** `ApiError` → which of the three error panels. */
const kindOf = (err: unknown): LoadErrorKind => {
  const status = err instanceof ApiError ? err.status : 0
  if (status === 0) return 'network'
  if (status === 403) return 'forbidden'
  return 'server'
}

/** What each of the four review transitions actually WRITES. Named for the write, not the button. */
const ACTION_ACCESS: Record<RegistrationAction, AppAccess> = {
  approve: 'ALLOWED',
  return: 'REJECTED',
  block: 'BLOCKED',
  unblock: 'ALLOWED',
}

type ConfirmKind = RegistrationAction | 'save'

/**
 * The confirmations, copied from the prototype's `COPY` table.
 *
 * ⚠️ `tone` IS THE COLOUR THE ROW IS ABOUT TO BECOME — green grants, sky hands the record back to
 * the user, rose takes access away — so the hue in the dialog matches the badge that follows it.
 *
 * ⚠️ TWO OF THEM CARRY A REASON AND THE SERVER TREATS THEM DIFFERENTLY. ส่งคืน's is REQUIRED and is
 * pushed to the user on LINE; ระงับ's is stored as an internal note and the server would accept a
 * block without one. The field is required here because the prototype requires it — a UI rule, and
 * stated as one: the boundary is `line-users.controller.ts`, not this table.
 */
const CONFIRM: Record<
  ConfirmKind,
  {
    title: string
    desc: string
    label: string
    busy: string
    tone: 'primary' | 'danger' | 'warn'
    reason?: { label: string; hint: string; required?: boolean }
  }
> = {
  approve: {
    title: 'ยืนยันการอนุมัติ',
    desc: 'ผู้ใช้จะเข้าใช้งานระบบจองได้ทันที และระบบจะแจ้งผลการอนุมัติไปยัง LINE ของผู้ใช้',
    label: 'อนุมัติการลงทะเบียน',
    busy: 'กำลังอนุมัติ…',
    tone: 'primary',
  },
  return: {
    title: 'ยืนยันการส่งคืนเพื่อแก้ไข',
    desc: 'ผู้ใช้จะได้รับเหตุผลด้านล่างทาง LINE แล้วแก้ไขข้อมูลส่งกลับมาให้พิจารณาอีกครั้ง',
    label: 'ยืนยันการส่งคืน',
    busy: 'กำลังส่งคืน…',
    tone: 'warn',
    reason: {
      label: 'เหตุผลการส่งคืน',
      hint: 'ผู้ใช้จะเห็นข้อความนี้ทาง LINE',
      required: true,
    },
  },
  block: {
    title: 'ยืนยันการระงับการใช้งาน',
    desc: 'ผู้ใช้จะจองห้องไม่ได้จนกว่าจะถูกปลดระงับ การจองที่ยืนยันแล้วจะไม่ถูกยกเลิกให้อัตโนมัติ',
    label: 'ยืนยันการระงับ',
    busy: 'กำลังระงับ…',
    tone: 'danger',
    reason: {
      label: 'เหตุผลการระงับ',
      hint: 'บันทึกไว้กับบัญชีนี้และแสดงให้เจ้าหน้าที่เห็นเท่านั้น ผู้ใช้ไม่เห็นข้อความนี้',
      required: true,
    },
  },
  unblock: {
    title: 'ยืนยันการปลดระงับ',
    desc: 'ผู้ใช้จะกลับมาใช้งานระบบจองได้ทันที และสถานะจะเปลี่ยนเป็น "อนุมัติแล้ว"',
    label: 'ยืนยันการปลดระงับ',
    busy: 'กำลังปลดระงับ…',
    tone: 'primary',
  },
  save: {
    title: 'ยืนยันการบันทึกการแก้ไข',
    desc: 'ระบบจะบันทึกทับข้อมูลเดิมทันที ตรวจสอบรายการที่เปลี่ยนแปลงด้านล่างก่อนยืนยัน',
    label: 'บันทึกการแก้ไข',
    busy: 'กำลังบันทึก…',
    tone: 'primary',
  },
}

/**
 * What the operator is told AFTER the write lands. The success line names the person and is past
 * tense — it is a receipt, not a promise. The failure line says what did NOT happen and what to do
 * next, because "เกิดข้อผิดพลาด" on its own leaves somebody unsure whether to try again.
 */
const RESULT: Record<ConfirmKind, { ok: (n: string) => string; no: (n: string) => string }> = {
  approve: {
    ok: (n) => `อนุมัติการลงทะเบียนของ ${n} แล้ว`,
    no: (n) => `อนุมัติ ${n} ไม่สำเร็จ — ข้อมูลยังไม่ถูกเปลี่ยน ลองใหม่อีกครั้ง`,
  },
  return: {
    ok: (n) => `ส่งคืนข้อมูลของ ${n} แล้ว ระบบแจ้งไปทาง LINE เรียบร้อย`,
    no: (n) => `ส่งคืนข้อมูลของ ${n} ไม่สำเร็จ — ยังไม่ได้ส่งแจ้งเตือน ลองใหม่อีกครั้ง`,
  },
  block: {
    ok: (n) => `ระงับการใช้งานของ ${n} แล้ว`,
    no: (n) => `ระงับการใช้งานของ ${n} ไม่สำเร็จ — ผู้ใช้ยังใช้งานระบบได้อยู่ ลองใหม่อีกครั้ง`,
  },
  unblock: {
    ok: (n) => `ปลดระงับการใช้งานของ ${n} แล้ว`,
    no: (n) => `ปลดระงับ ${n} ไม่สำเร็จ — ผู้ใช้ยังถูกระงับอยู่ ลองใหม่อีกครั้ง`,
  },
  save: {
    ok: (n) => `บันทึกการแก้ไขข้อมูลของ ${n} แล้ว`,
    no: (n) => `บันทึกข้อมูลของ ${n} ไม่สำเร็จ — ข้อมูลที่กรอกไว้ยังอยู่ ลองกดบันทึกอีกครั้ง`,
  },
}

const MSG = {
  refreshed: 'อัปเดตข้อมูลล่าสุดแล้ว',
  loaded: 'โหลดข้อมูลล่าสุดแล้ว',
  /** The 404 both writes share: the row moved or vanished under the dialog. */
  gone: 'รายการนี้ไม่อยู่ในสถานะเดิมแล้ว รายการถูกปรับให้ตรงกับข้อมูลล่าสุด',
  /** A 400 from the registration write. The option ids are the only thing on that form that expires. */
  optionGone: 'ตำแหน่งหรือกลุ่ม/ฝ่ายที่เลือกไว้ไม่พร้อมใช้งานแล้ว โปรดเลือกใหม่แล้วลองอีกครั้ง',
  /** A 403 from the transition matrix — ADMIN reaching for a move only SUPER_ADMIN may make. */
  forbidden: 'บัญชีของคุณเปลี่ยนสถานะนี้ไม่ได้ โปรดติดต่อผู้ดูแลระบบสูงสุด',
} as const

/** The realtime layer says this record moved under an open dialog. */
const STALE_MSG = (label: string) =>
  `รายการนี้ถูกเปลี่ยนเป็น “${label}” โดยผู้ใช้รายอื่นเมื่อสักครู่ · ปิดหน้าต่างนี้แล้วเปิดใหม่เพื่อดูข้อมูลล่าสุด`
const STALE_GONE_MSG =
  'รายการนี้ถูกลบออกจากระบบแล้วโดยผู้ใช้รายอื่น · การกระทำใด ๆ กับรายการนี้จะไม่มีผล'

/** `LineUserResponseDto` → what the two dialogs and the rows read. A straight re-shape; see the type. */
const toRecord = (u: LineUser): RegistrationRecord => ({
  id: u.id,
  lineUserId: u.lineUserId,
  displayName: u.displayName,
  pictureUrl: u.pictureUrl,
  access: u.access,
  registeredAt: u.registeredAt,
  rejectionReason: u.rejectionReason,
  blockReason: u.blockReason,
  registration: u.registration,
})

/**
 * The one amber line inside ตรวจสอบผู้ลงทะเบียน, and it says only what the row can prove.
 *
 * ⚠️ AN UNREGISTERED FOLLOWER GETS A SENTENCE THAT IS TRUE OF THE STATE, not of the row — there is
 * nothing stored about them at all, and "ไม่มีข้อมูล" alone reads as a fault rather than as the
 * ordinary state of somebody who added the account and stopped there.
 */
const noticeOf = (r: RegistrationRecord): string => {
  if (r.access === 'UNREGISTERED')
    return 'ผู้ใช้รายนี้เพิ่มเพื่อนใน LINE แล้ว แต่ยังไม่ได้กรอกแบบฟอร์มลงทะเบียน จึงยังไม่มีข้อมูลให้ตรวจสอบ'
  if (r.access === 'REJECTED' && r.rejectionReason)
    return `ส่งคืนให้ผู้ใช้แก้ไข · เหตุผล: ${r.rejectionReason}`
  if (r.access === 'BLOCKED' && r.blockReason) return `ระงับการใช้งาน · เหตุผล: ${r.blockReason}`
  return ''
}

export function LineUsersPage({ route }: { route: AdminRoute }) {
  const { user } = useAuth()
  const me = user!
  const acl = useAcl(me.role)
  const toast = useToast()

  /** Both `PATCH`es are `SUPER_ADMIN|ADMIN`, so the shared ACL is the right question on this page. */
  const canWrite = acl.write
  /** The free สถานะ select. SUPER_ADMIN bypasses the transition matrix; nobody else may jump states. */
  const canEditAccess = me.role === 'SUPER_ADMIN'

  const [rows, setRows] = useState<LineUser[] | null>(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<LoadErrorKind | null>(null)

  /** What is TYPED. `query` is what was last SENT — see the debounce below. */
  const [term, setTerm] = useState('')
  const [query, setQuery] = useState('')
  const [access, setAccess] = useState<AccessFilter>('')
  const [sort, setSort] = useState<LineUserSort>('new')
  const [page, setPage] = useState(1)

  /* ── The live layer's four pieces of deferred news ─────────────────────────────────────────── */

  /**
   * Ids of rows created since the last load. A SET of ids rather than the records themselves,
   * because the catch-up is a refetch — the payloads are never spliced in.
   *
   * ⚠️ IT COUNTS ARRIVALS, NOT MATCHES. With a search term typed, some of them may not come back
   * when the list reloads. Deciding otherwise would mean re-implementing the server's six-field
   * search in the browser to guess at it, which is the exact thing moving the filters server-side
   * removed. An over-count says "your view is behind" one time too often; an under-count hides work
   * in an approval queue.
   */
  const [queued, setQueued] = useState<Set<string>>(() => new Set())
  /** Rows deleted on the server that are still on screen. They are disarmed, never removed. */
  const [gone, setGone] = useState<Set<string>>(() => new Set())
  /** Reconnected, and there is no replay: we know there was a gap and cannot know how big. */
  const [missed, setMissed] = useState(false)
  /** Rows to paint the 2.5s left rail on. */
  const [flashing, setFlashing] = useState<Set<string>>(() => new Set())
  /** The wash is a pointer; this is the message, for a reader who cannot see it. */
  const [live, setLive] = useState('')

  const flashTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  /** The row whose record is open for reading. `null` keeps the dialog mounted and closed. */
  const [shown, setShown] = useState<RegistrationRecord | null>(null)
  const [detailAlert, setDetailAlert] = useState<string | null>(null)
  /**
   * The open record moved under the dialog. `changed` disarms only the state transitions —
   * แก้ไขข้อมูล stays live, because correcting a name or a phone is still valid — while `gone`
   * disarms everything. ⚠️ DISABLE, NEVER HIDE: a button that vanishes takes the explanation with
   * it, and the dialog is never closed in the reader's face either.
   */
  const [staleKind, setStaleKind] = useState<'changed' | 'gone' | null>(null)

  /** See `StaffPage`: the row and the open flag are separate so the dialog stays MOUNTED to close. */
  const [editing, setEditing] = useState<RegistrationRecord | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editAlert, setEditAlert] = useState<string | null>(null)
  const [editBusy, setEditBusy] = useState(false)

  /**
   * Which confirmation is up. `back` is the prototype's `returnTo`: every one of these is reached
   * from INSIDE a dialog, which closes to make room, so dismissing must put the operator back where
   * they were — they answered "no" to the transition, not to the record.
   */
  const [asking, setAsking] = useState<
    | { kind: RegistrationAction; row: RegistrationRecord }
    | { kind: 'save'; row: RegistrationRecord; values: RegistrationEditValues; diff: RegistrationDiff }
    | null
  >(null)

  const editOptions = useRegistrationOptions(
    editorOpen,
    editing?.registration
      ? {
          personnelRole: {
            id: editing.registration.personnelRoleId,
            name: editing.registration.personnelRole,
          },
          department: {
            id: editing.registration.departmentId,
            name: editing.registration.department,
          },
        }
      : null,
  )

  /* 300ms after the last keystroke, not on every one — each one would otherwise be a request. */
  useEffect(() => {
    const id = setTimeout(() => {
      setQuery(term.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(id)
  }, [term])

  /** Declared up here because the live layer's "insert at once" exception asks the same question. */
  const anyFilter = Boolean(query || access)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await listLineUsers({
        page,
        limit: PAGE_SIZE,
        search: query || undefined,
        access: access || undefined,
        sort,
      })
      setRows(res.data)
      setTotal(res.meta.total)
      return true
    } catch (err) {
      setRows(null)
      setError(kindOf(err))
      return false
    }
  }, [page, query, access, sort])

  useEffect(() => {
    void load()
  }, [load])

  /** Everything the live layer was holding is answered by a fresh page of rows. */
  const clearNews = useCallback(() => {
    setQueued(new Set())
    setGone(new Set())
    setMissed(false)
  }, [])

  /**
   * `โหลดข้อมูลล่าสุด` — deliberately the SAME sequence as รีเฟรช, skeleton first. The rows are about
   * to change, and a list that mutates in place while being read is what this whole page exists to
   * prevent; that applies to the catch-up too.
   */
  const catchUp = async () => {
    setRows(null)
    clearNews()
    if (await load()) setLive(MSG.loaded)
  }

  const refresh = async () => {
    setRows(null)
    clearNews()
    if (await load()) toast('success', MSG.refreshed)
  }

  /* ── The live layer ────────────────────────────────────────────────────────────────────────── */

  const flash = useCallback((id: string) => {
    setFlashing((s) => new Set(s).add(id))
    const timers = flashTimers.current
    clearTimeout(timers.get(id))
    timers.set(
      id,
      setTimeout(() => {
        timers.delete(id)
        setFlashing((s) => {
          const next = new Set(s)
          next.delete(id)
          return next
        })
      }, 2500),
    )
  }, [])

  // Every pending flash timer is cleared on unmount — a `setFlashing` after the page is gone is a
  // React warning at best and a leak at worst.
  useEffect(() => {
    const timers = flashTimers.current
    return () => {
      timers.forEach((t) => clearTimeout(t))
      timers.clear()
    }
  }, [])

  /**
   * ⚠️ THESE HANDLERS READ TODAY'S STATE, and that is safe ONLY because the hook re-points its
   * `handlersRef` on every render while keeping the same socket. Do not "optimise" them into
   * `useCallback`s with dependency arrays: a handler that closed over a stale `rows` would patch
   * the page the operator was looking at three filters ago, and the socket would never say so.
   *
   * ⚠️ AN EVENT FOR A ROW THAT IS NOT ON THIS PAGE IS DELIBERATELY QUIET (except a creation, which
   * is news by definition). The operator is looking at ten rows out of a hundred; announcing a
   * change to one of the other ninety is noise they cannot act on and cannot see.
   */
  /**
   * ⚠️ THE SOCKET IS THE SHELL'S, NOT THIS PAGE'S. Subscribing rather than connecting is what lets
   * the sidebar's รออนุมัติ count keep moving after the operator navigates away — and it means
   * leaving and re-entering this page no longer tears a connection down and builds another.
   */
  const status = useRealtimeStatus()
  useRealtimeEvents({
    onUpdated: (user) => {
      const onScreen = rows?.some((r) => r.id === user.id) ?? false
      if (onScreen) {
        setRows((current) => current?.map((r) => (r.id === user.id ? user : r)) ?? current)
        flash(user.id)
        setLive(
          `รายการของ ${whoOf(toRecord(user))} เปลี่ยนเป็น ${ACCESS_LABEL[user.access]}`,
        )
      }
      // The record a dialog is holding just moved, so the buttons under it aim at a state that no
      // longer exists. This DISARMS them and says why; it does not close the dialog in somebody's
      // face, and it does not touch แก้ไขข้อมูล.
      if (shown?.id === user.id) {
        setShown(toRecord(user))
        setDetailAlert(STALE_MSG(ACCESS_LABEL[user.access]))
        setStaleKind('changed')
      }
    },
    onCreated: (user) => {
      // The exception, and it falls out of the rule rather than bending it: with nothing on screen
      // there is nothing to move, so the queue appears at once instead of behind a button.
      if (rows !== null && rows.length === 0 && !anyFilter) {
        setLive('มีรายการลงทะเบียนใหม่เข้ามา')
        void load()
        return
      }
      setQueued((s) => new Set(s).add(user.id))
    },
    onDeleted: (id) => {
      // NOT removed from the table: removing it moves every row below, which is the one thing this
      // page does not do without a click — and the operator may be mid-read on it. It is disarmed
      // instead, because a row that opens a dialog onto a record the server no longer has is a 404
      // nobody can explain, and the bar collects it for the next load.
      const row = rows?.find((r) => r.id === id)
      if (row) {
        setGone((s) => new Set(s).add(id))
        setLive(`รายการของ ${whoOf(toRecord(row))} ถูกลบออกจากระบบแล้ว`)
      }
      if (shown?.id === id) {
        setDetailAlert(STALE_GONE_MSG)
        setStaleKind('gone')
      }
    },
    onResync: () => setMissed(true),
  })

  const records = useMemo(() => (rows ?? []).map(toRecord), [rows])

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = (page - 1) * PAGE_SIZE + records.length
  /** The filters emptied the table. An empty table with NO filter on is a different panel. */
  const miss = anyFilter && records.length === 0

  /**
   * The bar's sentence, assembled from whatever is currently true.
   *
   * ⚠️ THE RECONNECT CLAUSE STATES NO NUMBER AND MUST NOT. The gateway has no replay and no
   * sequence, so "3 รายการ" after a gap would be a guess dressed as a fact. What we know is that
   * there WAS a gap.
   */
  /**
   * ⚠️ DRIFT IS DERIVED, NOT REMEMBERED, and that is what makes it self-correcting. A row that
   * changed OUT of the active filter cannot be allowed to vanish — that moves every row under it —
   * but leaving it silently makes the filter look broken: "รออนุมัติ" is selected and a row plainly
   * reads "อนุมัติแล้ว". Since every load and every filter change re-asks the server, a row on
   * screen that contradicts the filter IS the whole definition, and there is no set to forget to
   * clear.
   */
  const driftCount = useMemo(
    () => (access ? records.filter((r) => r.access !== access).length : 0),
    [records, access],
  )
  const goneCount = useMemo(() => records.filter((r) => gone.has(r.id)).length, [records, gone])
  const barParts: string[] = []
  if (queued.size) barParts.push(`มีรายการใหม่ ${queued.size} รายการ`)
  if (goneCount) barParts.push(`มีรายการที่ถูกลบออก ${goneCount} รายการ`)
  if (driftCount) barParts.push(`มี ${driftCount} รายการที่ไม่ตรงกับตัวกรองแล้ว`)
  if (missed) barParts.push('เชื่อมต่อใหม่แล้ว · ข้อมูลระหว่างที่ขาดการเชื่อมต่ออาจไม่ครบ')
  const barMessage = barParts.join(' · ')

  const clearFilters = () => {
    setTerm('')
    setQuery('')
    setAccess('')
    setPage(1)
  }

  /** Names the filters that are ACTUALLY on — "ลองล้างตัวกรอง" does not say what to undo. */
  const missDesc = query
    ? `ไม่มีรายการที่ตรงกับ “${query}”${access ? ' ในสถานะที่เลือก' : ''} · ลองใช้คำที่สั้นลง หรือล้างตัวกรอง`
    : 'ไม่มีรายการในสถานะที่เลือก · ลองเลือกสถานะอื่น หรือล้างตัวกรอง'

  const openDetail = (r: RegistrationRecord) => {
    if (gone.has(r.id)) return
    // A failure — or a staleness warning — from a PREVIOUS record is not this one's.
    setDetailAlert(null)
    setStaleKind(null)
    setShown(r)
  }

  const openEdit = (r: RegistrationRecord) => {
    if (!canWrite || !r.registration || gone.has(r.id)) return
    setShown(null)
    setEditAlert(null)
    setEditing(r)
    setEditorOpen(true)
  }

  /* ── The two writes ────────────────────────────────────────────────────────────────────────── */

  const runAction = async (kind: RegistrationAction, row: RegistrationRecord, reason: string) => {
    const who = whoOf(row)
    try {
      await patchLineUserAccess(
        row.id,
        ACTION_ACCESS[kind],
        // Sent only where it means something. `approve`/`unblock` have no reason field at all, and
        // an empty string on the wire is a 400 on the one route that requires a non-empty one.
        CONFIRM[kind].reason ? reason.trim() : undefined,
      )
      setAsking(null)
      setGone((s) => {
        const next = new Set(s)
        next.delete(row.id)
        return next
      })
      await load()
      toast('success', RESULT[kind].ok(who))
    } catch (err) {
      const httpStatus = err instanceof ApiError ? err.status : 0
      setAsking(null)
      await load()
      if (httpStatus === 404) toast('error', MSG.gone)
      else if (httpStatus === 403) toast('error', MSG.forbidden)
      else toast('error', RESULT[kind].no(who))
    }
  }

  /**
   * บันทึกการแก้ไข — up to TWO requests, because they are two endpoints with two different rules.
   *
   * ⚠️ THE REGISTRATION GOES FIRST. It is what the operator opened the form to change; the สถานะ
   * select is a SUPER_ADMIN extra riding along. If the second call fails the first is already
   * saved, and the toast says which half did not happen rather than claiming the whole save failed.
   */
  const runSave = async (
    row: RegistrationRecord,
    values: RegistrationEditValues,
    reason: string,
  ) => {
    const who = whoOf(row)
    setEditBusy(true)
    try {
      await patchLineUserRegistration(row.id, {
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
        departmentId: values.departmentId,
        personnelRoleId: values.personnelRoleId,
      })
      if (canEditAccess && values.access !== row.access) {
        await patchLineUserAccess(
          row.id,
          values.access,
          values.access === 'REJECTED' ? reason.trim() : undefined,
        )
      }
      setAsking(null)
      setEditorOpen(false)
      await load()
      toast('success', RESULT.save.ok(who))
    } catch (err) {
      const httpStatus = err instanceof ApiError ? err.status : 0
      setAsking(null)
      // Back into the form with every keystroke intact — `close()` does not reset it — and the
      // reason for the failure where the operator is about to press บันทึก again.
      setEditorOpen(true)
      setEditAlert(
        httpStatus === 400
          ? MSG.optionGone
          : httpStatus === 404
            ? MSG.gone
            : httpStatus === 403
              ? MSG.forbidden
              : RESULT.save.no(who),
      )
    } finally {
      setEditBusy(false)
    }
  }

  const editInitial = useMemo<RegistrationEditValues | null>(() => {
    const reg = editing?.registration
    if (!editing || !reg) return null
    return {
      firstName: reg.firstName,
      lastName: reg.lastName,
      personnelRoleId: reg.personnelRoleId,
      departmentId: reg.departmentId,
      phone: reg.phone,
      access: editing.access,
    }
  }, [editing])

  /**
   * A SUPER_ADMIN's free select can pick ส่งคืนแล้ว, and that write is the one the server refuses
   * without a reason (it is pushed to the user as a LINE message). The confirm therefore grows the
   * SAME reason field the guided ส่งคืนแก้ไข action uses, rather than letting the operator walk into
   * a guaranteed 400 with a filled-in form.
   */
  const saveNeedsReason =
    asking?.kind === 'save' && canEditAccess && asking.values.access === 'REJECTED'

  return (
    <div className="card-shell">
      <PageHeading
        route={route}
        descAtEveryWidth={false}
        actions={
          <div className="flex items-center gap-2">
            {/* ══ อัปเดตอัตโนมัติหยุด ══
                The dangerous state on a live page is not "disconnected" — it is being disconnected
                AND NOT KNOWING, because the rows still look authoritative. This says the automatic
                half stopped; รีเฟรช beside it still fetches perfectly good data, which is why it is
                a quiet grey chip and not a red banner. Nothing is broken; one convenience is.
                ⚠️ `offline` ONLY. `disabled` — a VIEWER, or the rollback flag — renders nothing:
                warning somebody that updates stopped, when their role was never going to get them,
                is a warning they can do nothing about. */}
            {status === 'offline' && (
              <span
                aria-live="polite"
                data-tip="ข้อมูลจะไม่อัปเดตเองจนกว่าจะเชื่อมต่อได้อีกครั้ง · กดรีเฟรชเพื่อดึงข้อมูลล่าสุด"
                data-tip-pos="bottom"
                className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-control border border-base-content/20 bg-base-200 px-2.5 text-[13px] font-medium text-base-content/70"
              >
                <Glyph d={ICON.offline} className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">อัปเดตอัตโนมัติหยุด</span>
                <span className="sm:hidden">ออฟไลน์</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => void refresh()}
              aria-label="รีเฟรช"
              data-tip="รีเฟรช"
              data-tip-pos="bottom"
              className="flex min-h-11 items-center gap-2 rounded-control border border-base-content/20 bg-base-100 px-3 text-[14px] font-medium text-base-content/80 transition-colors hover:border-info/40 hover:bg-info/10 hover:text-info focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-4"
            >
              <Glyph d={ICON.refresh} />
              <span className="hidden sm:inline">รีเฟรช</span>
            </button>
            {/* ⚠️ NO PRIMARY BUTTON ON THIS PAGE, deliberately: it is an approval QUEUE, the work
                happens per row, and a solid green button up here pulls the eye away from the job.
                Same chrome as รีเฟรช because both are secondary and sit side by side — what tells
                them apart is the trailing →, which says this one NAVIGATES.
                ⚠️ NOT A `<Link>`: รายงานการลงทะเบียน has no screen yet, so this points at the
                coming-soon stand-in the router already renders for it. */}
            <Link
              to={REPORT_URL}
              className="flex min-h-11 items-center gap-2 rounded-control border border-base-content/20 bg-base-100 px-4 text-[14px] font-medium text-base-content/80 transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Glyph d={ICON.report} />
              <span className="sm:hidden">รายงาน</span>
              <span className="hidden sm:inline">รายงานและส่งออกข้อมูล</span>
              <Glyph d={ICON.chevron} className="h-4 w-4 shrink-0" />
            </Link>
          </div>
        }
      />

      <div className="card-shell rounded-card border border-base-300/70 bg-base-100 shadow-e1">
        {/* Toolbar — pinned. Filters that scroll away are filters you cannot correct without first
            scrolling back to them. */}
        <div className="flex shrink-0 flex-col gap-2.5 border-b border-base-300 p-3 sm:gap-3 sm:p-4 lg:flex-row lg:items-center lg:p-5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-control border border-transparent bg-base-200 px-4 transition-all focus-within:border-primary/40 focus-within:bg-base-100 focus-within:ring-4 focus-within:ring-primary/10">
            <Glyph d={ICON.search} className="h-5 w-5 shrink-0 text-base-content/60" />
            {/* ⚠️ The placeholder is a PROMISE about what this box searches, so it names every
                field the server actually reads. It used to say "ชื่อ หรือเบอร์โทรศัพท์" while the
                box searched nothing at all. */}
            <label className="sr-only" htmlFor="lu-q">
              ค้นหาชื่อ–สกุล ชื่อไลน์ ตำแหน่ง กลุ่ม/ฝ่าย หรือเบอร์โทรศัพท์
            </label>
            <input
              id="lu-q"
              type="search"
              autoCorrect="on"
              autoCapitalize="none"
              spellCheck
              enterKeyHint="search"
              placeholder="ค้นหาชื่อ–สกุล ชื่อไลน์ ตำแหน่ง กลุ่ม/ฝ่าย หรือเบอร์โทรศัพท์"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="min-h-11 w-full min-w-0 border-none bg-transparent text-[15px] text-base-content/90 outline-none placeholder:text-base-content/70"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5 lg:flex lg:shrink-0">
            <label className="relative flex items-center rounded-control border border-transparent bg-base-200 transition-all focus-within:border-primary/40 focus-within:bg-base-100 focus-within:ring-4 focus-within:ring-primary/10 lg:w-44">
              <span className="sr-only">กรองตามสถานะ</span>
              {/* `value` is the STATE key, not the Thai label: the label is what the operator reads,
                  the key is what `AppAccess` calls it and what the query carries. */}
              <select
                value={access}
                onChange={(e) => {
                  setAccess(e.target.value as AccessFilter)
                  setPage(1)
                }}
                className="min-h-11 w-full cursor-pointer appearance-none border-none bg-transparent px-4 pr-9 text-[15px] font-medium text-base-content/90 outline-none"
              >
                <option value="">ทุกสถานะ</option>
                <option value="ALLOWED">{ACCESS_LABEL.ALLOWED}</option>
                <option value="PENDING">{ACCESS_LABEL.PENDING}</option>
                <option value="REJECTED">{ACCESS_LABEL.REJECTED}</option>
                <option value="BLOCKED">{ACCESS_LABEL.BLOCKED}</option>
                <option value="UNREGISTERED">{ACCESS_LABEL.UNREGISTERED}</option>
              </select>
              <Glyph
                d={ICON.caret}
                className="pointer-events-none absolute right-3 h-4 w-4 text-base-content/60"
              />
            </label>

            <label className="relative flex items-center rounded-control border border-transparent bg-base-200 transition-all focus-within:border-primary/40 focus-within:bg-base-100 focus-within:ring-4 focus-within:ring-primary/10 lg:w-48">
              <span className="sr-only">เรียงลำดับตาม</span>
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as LineUserSort)
                  setPage(1)
                }}
                className="min-h-11 w-full cursor-pointer appearance-none border-none bg-transparent px-4 pr-9 text-[15px] font-medium text-base-content/90 outline-none"
              >
                <option value="new">ลงทะเบียนล่าสุด</option>
                <option value="old">ลงทะเบียนเก่าสุด</option>
                <option value="name">ชื่อ ก–ฮ</option>
              </select>
              <Glyph
                d={ICON.caret}
                className="pointer-events-none absolute right-3 h-4 w-4 text-base-content/60"
              />
            </label>
          </div>
        </div>

        {error ? (
          <div className="card-shell">
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
              <LoadError kind={error} onRetry={() => void load()} />
            </div>
          </div>
        ) : rows === null ? (
          <LoadingPanel actionsLabel={acl.actionsColumnLabel} />
        ) : records.length === 0 && !anyFilter ? (
          /* ⚠️ NO "เพิ่มผู้ลงทะเบียน" BUTTON, unlike ตัวเลือกบุคลากร's version of this block. A
             registration cannot be created from here at all — it arrives from LINE. Offering the
             shape of an action that has no endpoint is worse than offering nothing. */
          <div className="card-shell">
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
              <EmptyState
                icon={<Glyph d={ICON.users} className="h-8 w-8" />}
                title="ไม่พบข้อมูลการลงทะเบียน"
                description="ยังไม่มีผู้ใช้เพิ่มเพื่อนหรือลงทะเบียนผ่าน LINE · เมื่อมีคนลงทะเบียนเข้ามา รายการจะขึ้นที่นี่เอง"
                actions={
                  <Btn variant="primary" onClick={() => void refresh()}>
                    <Glyph d={ICON.refresh} />
                    รีเฟรชข้อมูล
                  </Btn>
                }
              />
            </div>
          </div>
        ) : (
          <div className="card-shell">
            {/* ══ แถบข้อมูลใหม่ — the one place a live list may interrupt ══
                THE BAR IS THE BUTTON, and that is measured: as a strip with a button inside it, it
                stood 65px — 71% of a row — and pushed every row down by exactly that the first time
                it appeared. A notice that moves five rows in order to promise that rows will not
                move is self-defeating. Collapsed into one full-width target it is 44px, and the
                44px IS the bar.
                It sits INSIDE the list panel and above the scroller, so it never appears over the
                empty state and never scrolls away from the rows it describes. */}
            {barMessage && (
              <button
                type="button"
                onClick={() => void catchUp()}
                className="flex min-h-11 w-full shrink-0 items-center gap-2.5 border-b border-info/35 bg-info/10 px-3 py-2 text-left text-[14px] leading-[1.55] text-info transition-colors hover:bg-info/20 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-info sm:px-4"
              >
                <Glyph d={ICON.info} className="h-5 w-5 shrink-0" />
                <span className="min-w-0 flex-1">{barMessage}</span>
                <span className="shrink-0 font-medium underline underline-offset-2">
                  โหลดข้อมูลล่าสุด
                </span>
              </button>
            )}
            {/* The rail on a changed row is a pointer, not a message. This is the message. */}
            <p role="status" aria-live="polite" className="sr-only">
              {live}
            </p>

            <div className="card-scroll nav-scroll">
              {miss ? (
                /* ⚠️ "หาไม่เจอ" IS NOT "ยังไม่มีข้อมูล". They are different facts with different ways
                   out, and on THIS page an empty queue means "no work waiting" — a genuinely
                   damaging thing to say when it is only a filter. */
                <EmptyState
                  icon={<Glyph d={ICON.search} className="h-8 w-8" />}
                  title="ไม่พบรายการที่ตรงกับที่ค้นหา"
                  description={missDesc}
                  actions={
                    <Btn variant="ghost" onClick={clearFilters}>
                      ล้างตัวกรองทั้งหมด
                    </Btn>
                  }
                />
              ) : (
                <>
                  <div className="hidden lg:block">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr>
                          <th scope="col" className="th-cell w-16 text-center">
                            ลำดับ
                          </th>
                          <th scope="col" className="th-cell">
                            ชื่อ–สกุล
                          </th>
                          {/* ตำแหน่ง FIRST, then กลุ่ม/ฝ่าย — the Thai civil-service convention for
                              identifying an official. Not a styling preference; do not "tidy" it. */}
                          <th scope="col" className="th-cell whitespace-nowrap">
                            ตำแหน่ง · กลุ่ม/ฝ่าย
                          </th>
                          <th scope="col" className="th-cell whitespace-nowrap text-center">
                            เบอร์โทรศัพท์
                          </th>
                          <th scope="col" className="th-cell text-center">
                            สถานะ
                          </th>
                          <th scope="col" className="th-cell whitespace-nowrap text-center">
                            วันที่ลงทะเบียน
                          </th>
                          <th scope="col" data-col="actions" className="th-cell text-right">
                            {acl.actionsColumnLabel}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((r, i) => (
                          <Row
                            key={r.id}
                            record={r}
                            index={from + i}
                            canWrite={canWrite}
                            flash={flashing.has(r.id)}
                            gone={gone.has(r.id)}
                            onView={() => openDetail(r)}
                            onEdit={() => openEdit(r)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <ul className="m-0 list-none divide-y divide-base-300/60 p-0 lg:hidden">
                    {records.map((r) => (
                      <CardRow
                        key={r.id}
                        record={r}
                        flash={flashing.has(r.id)}
                        gone={gone.has(r.id)}
                        onView={() => openDetail(r)}
                      />
                    ))}
                  </ul>
                </>
              )}
            </div>

            {!miss && (
              <div className="flex shrink-0 flex-col items-center justify-between gap-3 border-t border-base-300 p-4 sm:flex-row lg:px-5">
                <p className="text-[14px] text-base-content/70">
                  แสดง{' '}
                  <span className="font-medium text-base-content/90 tabular-nums">
                    {total === 0 ? '0' : `${from}–${to}`}
                  </span>{' '}
                  จาก{' '}
                  <span className="font-medium text-base-content/90 tabular-nums">{total}</span>{' '}
                  รายการ
                </p>
                <Pagination page={page} pages={pages} onGo={setPage} label="แบ่งหน้ารายการลงทะเบียน" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Held MOUNTED between rows — `record={null}` renders a closed dialog rather than unmounting
          one, so `Modal` still gets the `close` event that restores focus to the row. */}
      <RegistrationDetailDialog
        open={shown !== null}
        onClose={() => setShown(null)}
        record={shown}
        canWrite={canWrite}
        alert={detailAlert}
        stale={staleKind === 'changed'}
        staleGone={staleKind === 'gone'}
        notice={shown ? noticeOf(shown) : ''}
        onAction={(action) => {
          if (!shown) return
          const row = shown
          setShown(null)
          setAsking({ kind: action, row })
        }}
        onEdit={() => shown && openEdit(shown)}
      />

      {editing && editInitial && (
        <RegistrationEditDialog
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          record={editing}
          initial={editInitial}
          positions={editOptions.positions ?? []}
          departments={editOptions.departments ?? []}
          canEditAccess={canEditAccess}
          alert={editAlert ?? editOptions.alert}
          busy={editBusy}
          onSubmit={(values, diff) => {
            // Nothing changed — a confirm listing an empty diff asks a question with no content.
            if (diff.length === 0) {
              setEditorOpen(false)
              return
            }
            setEditorOpen(false)
            setAsking({ kind: 'save', row: editing, values, diff })
          }}
        />
      )}

      <ConfirmModal
        open={asking !== null}
        onClose={() => {
          const back = asking
          setAsking(null)
          // `returnTo`: back into the dialog it was launched from, with the form intact.
          if (back?.kind === 'save') setEditorOpen(true)
          else if (back) setShown(back.row)
        }}
        onConfirm={(reason) => {
          if (!asking) return
          if (asking.kind === 'save') return runSave(asking.row, asking.values, reason)
          return runAction(asking.kind, asking.row, reason)
        }}
        title={asking ? CONFIRM[asking.kind].title : ''}
        who={asking ? whoOf(asking.row) : undefined}
        description={asking ? CONFIRM[asking.kind].desc : ''}
        tone={asking ? CONFIRM[asking.kind].tone : 'primary'}
        confirmLabel={asking ? CONFIRM[asking.kind].label : ''}
        busyLabel={asking ? CONFIRM[asking.kind].busy : undefined}
        diff={asking?.kind === 'save' ? asking.diff : undefined}
        reason={
          saveNeedsReason
            ? { label: 'เหตุผลการส่งคืน', hint: 'ผู้ใช้จะเห็นข้อความนี้ทาง LINE', required: true }
            : asking && asking.kind !== 'save'
              ? CONFIRM[asking.kind].reason
              : undefined
        }
      />
    </div>
  )
}

/**
 * One desktop row.
 *
 * ⚠️ `gone` DISARMS IT IN PLACE. `.row-gone` is `pointer-events: none` plus a strikethrough, so the
 * row stays exactly where the operator was reading it and simply stops opening a record the server
 * no longer has.
 */
function Row({
  record,
  index,
  canWrite,
  flash,
  gone,
  onView,
  onEdit,
}: {
  record: RegistrationRecord
  index: number
  canWrite: boolean
  flash: boolean
  gone: boolean
  onView: () => void
  onEdit: () => void
}) {
  const reg = record.registration
  const name = registrantName(record)
  const label = ACCESS_LABEL[record.access]

  return (
    <tr
      className={`group border-b border-base-300/60 transition-colors hover:bg-base-content/5 ${
        flash ? 'row-flash' : ''
      } ${gone ? 'row-gone' : ''}`.trim()}
      data-lu-id={record.id}
    >
      <td className="td-cell text-center text-base-content/70 tabular-nums">{index}</td>
      <td className="td-cell">
        <div className="flex items-center gap-3">
          <RowAvatar
            record={record}
            className="h-9 w-9 shrink-0 rounded-control text-[14px] font-semibold"
          />
          <span className="flex min-w-0 flex-col">
            {reg ? (
              <>
                <span className="truncate text-[15px] font-medium text-base-content">{name}</span>
                <span className="truncate text-[13px] text-base-content/70">
                  LINE: {record.displayName ?? record.lineUserId}
                </span>
              </>
            ) : (
              /* Prefixed, so nobody reads a LINE display name as a registered person's real name. */
              <span className="truncate text-[15px] font-medium text-base-content/80">
                LINE: {record.displayName ?? record.lineUserId}
              </span>
            )}
          </span>
        </div>
      </td>
      {/* `h-[63px]` on EVERY cell in this column, including the "—" one: the two long departments
          otherwise make their rows 92px while the rest stay 73px, and a table with two heights
          looks broken. `whitespace-nowrap` was measured and rejected — it widened the column past
          the card and put a horizontal scrollbar under the rows. */}
      <td className="td-cell">
        <span className="flex h-[63px] min-w-0 flex-col justify-center gap-0.5">
          {reg ? (
            <>
              <span className="text-[14px] text-base-content/80">{reg.personnelRole}</span>
              <span className="text-[13px] text-base-content/70">{reg.department}</span>
            </>
          ) : (
            <span className="text-[14px] text-base-content/60">{DASH}</span>
          )}
        </span>
      </td>
      <td
        className={`td-cell whitespace-nowrap text-center tabular-nums ${
          reg ? 'text-base-content/80' : 'text-base-content/60'
        }`}
      >
        {reg?.phone || DASH}
      </td>
      <td className="td-cell text-center">
        <Badge tone={ACCESS_TONE[record.access]}>{label}</Badge>
      </td>
      <td
        className={`td-cell whitespace-nowrap text-center text-[14px] ${
          record.registeredAt ? 'text-base-content/80' : 'text-base-content/60'
        }`}
      >
        {record.registeredAt ? thaiDate(record.registeredAt) : DASH}
      </td>
      <td data-col="actions" className="td-cell text-right">
        <div className="row-actions">
          <button
            type="button"
            onClick={onView}
            aria-label={
              reg
                ? `ตรวจสอบข้อมูล ${name} สถานะ ${label}`
                : 'ตรวจสอบข้อมูล ผู้ใช้ที่ยังไม่ลงทะเบียน'
            }
            data-tip="ตรวจสอบข้อมูล"
            data-tip-pos="left"
            className="icon-btn icon-btn-view"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={ICON.eye} />
              <path strokeLinecap="round" strokeLinejoin="round" d={ICON.eyeInner} />
            </svg>
          </button>
          {/* ⚠️ NO PENCIL ON AN UNREGISTERED FOLLOWER, at any role: there is no registration row to
              edit, and `PATCH /line-users/:id/registration` answers 404 for one. */}
          {canWrite && reg && (
            <button
              type="button"
              onClick={onEdit}
              aria-label={`แก้ไข ${name}`}
              data-tip="แก้ไข"
              data-tip-pos="left"
              className="icon-btn icon-btn-edit"
            >
              <Glyph d={ICON.pencil} className="h-5 w-5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

/**
 * The phone card — THE SAME CARD as เจ้าหน้าที่ระบบ's, deliberately.
 *
 * ⚠️ THE WHOLE ROW IS THE TARGET, and the two icon buttons of the desktop column are gone. That
 * translation cost ~60px of every card and repeated a solid button down the page as if each row
 * were the page's primary action. Tapping opens the record; the actions live in there — which is
 * also the only honest order, since you should read somebody before approving them.
 */
function CardRow({
  record,
  flash,
  gone,
  onView,
}: {
  record: RegistrationRecord
  flash: boolean
  gone: boolean
  onView: () => void
}) {
  const reg = record.registration
  const name = registrantName(record)
  const label = ACCESS_LABEL[record.access]
  const lineName = record.displayName ?? record.lineUserId

  return (
    <li className={`${flash ? 'row-flash' : ''} ${gone ? 'row-gone' : ''}`.trim()}>
      <button
        type="button"
        onClick={onView}
        aria-label={reg ? `ดูรายละเอียด ${name} สถานะ ${label}` : `ดูรายละเอียด ผู้ใช้ที่ยังไม่ลงทะเบียน ${lineName}`}
        className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-base-content/5 active:bg-base-content/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      >
        <RowAvatar
          record={record}
          className="h-10 w-10 shrink-0 rounded-control text-[15px] font-semibold"
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span
              className={`truncate text-[15px] font-medium ${
                reg ? 'text-base-content' : 'text-base-content/80'
              }`}
            >
              {reg ? name : `LINE: ${lineName}`}
            </span>
            <Badge tone={ACCESS_TONE[record.access]} className="shrink-0">
              {label}
            </Badge>
          </span>
          {reg ? (
            <>
              <span className="mt-0.5 block truncate text-[13px] text-base-content/70">
                LINE: {lineName} · {reg.phone}
              </span>
              <span className="block truncate text-[13px] text-base-content/70">
                {reg.department}
                {record.registeredAt ? ` · ${thaiDate(record.registeredAt)}` : ''}
              </span>
            </>
          ) : (
            <span className="mt-0.5 block truncate text-[13px] text-base-content/70">
              ยังไม่มีข้อมูลการลงทะเบียน
            </span>
          )}
        </span>
        <Glyph d={ICON.chevron} className="mt-1 h-5 w-5 shrink-0 text-base-content/40" />
      </button>
    </li>
  )
}

/**
 * The skeleton, at both widths.
 *
 * ⚠️ `table-fixed` + a colgroup, because an auto-layout table sizes each column to its widest
 * CONTENT — and a skeleton's content is bars, not text. Measured before the colgroup existed: the
 * ชื่อ–สกุล column came out 78px wider than the real one, so every column snapped sideways the
 * moment the data landed. Ten rows because that is `PAGE_SIZE`.
 */
function LoadingPanel({ actionsLabel }: { actionsLabel: string }) {
  const rows = Array.from({ length: PAGE_SIZE }, (_, i) => i)
  return (
    <div className="card-shell" aria-busy="true">
      <span className="sr-only" role="status">
        กำลังโหลดข้อมูลการลงทะเบียน
      </span>
      <div className="card-scroll nav-scroll">
        <div className="hidden lg:block" aria-hidden="true">
          <table className="w-full table-fixed border-collapse text-left">
            <colgroup>
              <col style={{ width: '7.5%' }} />
              <col style={{ width: '21.5%' }} />
              <col style={{ width: '16.3%' }} />
              <col style={{ width: '13.9%' }} />
              <col style={{ width: '16.4%' }} />
              <col style={{ width: '12.6%' }} />
              <col style={{ width: '11.8%' }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="th-cell w-16 text-center">
                  ลำดับ
                </th>
                <th scope="col" className="th-cell">
                  ชื่อ–สกุล
                </th>
                <th scope="col" className="th-cell whitespace-nowrap">
                  ตำแหน่ง · กลุ่ม/ฝ่าย
                </th>
                <th scope="col" className="th-cell whitespace-nowrap text-center">
                  เบอร์โทรศัพท์
                </th>
                <th scope="col" className="th-cell text-center">
                  สถานะ
                </th>
                <th scope="col" className="th-cell whitespace-nowrap text-center">
                  วันที่ลงทะเบียน
                </th>
                <th scope="col" data-col="actions" className="th-cell text-right">
                  {actionsLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i} className="border-b border-base-300/60">
                  <td className="td-cell text-center">
                    <Skeleton className="mx-auto h-3.5 w-4" />
                  </td>
                  <td className="td-cell">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 shrink-0 rounded-control" variant="box" />
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <Skeleton className="h-3.5 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  </td>
                  <td className="td-cell">
                    <div className="flex h-[63px] flex-col justify-center gap-1.5">
                      <Skeleton className="h-3.5 w-20" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </td>
                  <td className="td-cell">
                    <Skeleton className="mx-auto h-3.5 w-24" />
                  </td>
                  <td className="td-cell">
                    <Skeleton className="mx-auto h-6 w-20 rounded-full" variant="box" />
                  </td>
                  <td className="td-cell">
                    <Skeleton className="mx-auto h-3.5 w-20" />
                  </td>
                  <td className="td-cell">
                    <Skeleton className="ml-auto h-9 w-20 rounded-control" variant="box" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="m-0 list-none divide-y divide-base-300/60 p-0 lg:hidden" aria-hidden="true">
          {rows.map((i) => (
            <li key={i} className="flex items-start gap-3 p-4">
              <Skeleton className="h-10 w-10 shrink-0 rounded-control" variant="box" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-52" />
                <Skeleton className="h-3 w-36" />
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* The pagination bar lives INSIDE the list panel, so without a stand-in the card is 71px
          shorter while loading and everything below it jumps up and back down. */}
      <div
        className="flex shrink-0 flex-col items-center justify-between gap-3 border-t border-base-300 p-4 sm:flex-row lg:px-5"
        aria-hidden="true"
      >
        <Skeleton className="h-3.5 w-40" />
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-11 w-20 rounded-control" variant="box" />
          <Skeleton className="h-11 w-11 rounded-control" variant="box" />
          <Skeleton className="h-11 w-11 rounded-control" variant="box" />
          <Skeleton className="h-11 w-16 rounded-control" variant="box" />
        </div>
      </div>
    </div>
  )
}
