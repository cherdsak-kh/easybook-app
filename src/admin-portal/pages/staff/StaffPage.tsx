/**
 * เจ้าหน้าที่ระบบ — `/backend/staff`, `GET /api/v1/system-users`.
 *
 * The operator directory, and the only page in the product where the RBAC enum is DATA rather than
 * an implementation detail — which is why `บทบาท` is a column here and is hidden everywhere else
 * (โปรไฟล์ and the sidebar card show ตำแหน่ง). The rule is not "never show the role"; it is "show it
 * where it is the thing being managed, and nowhere else".
 *
 * ── Three roles, TWO screens ──
 * An ADMIN and a VIEWER get the SAME screen here, and that is not an oversight. It falls out of D-2
 * (separation of duties): `POST` / `DELETE` / `restore` / `reset-password` are `@Roles(SUPER_ADMIN)`
 * and an ADMIN may not PATCH anyone but themselves, so on THIS table an ADMIN holds a VIEWER's
 * capabilities even though `acl.write` is true for them everywhere else.
 *
 * ⚠️ THAT IS WHY THIS PAGE ASKS `canManage`, NEVER `acl.write`. Reaching for the shared ACL here
 * would render a pencil on every row for an ADMIN and 403 on submit — the exact failure the ACL
 * module exists to prevent, produced by using it.
 *
 * ⚠️ AND NONE OF IT IS THE BOUNDARY. `system-users.policy.ts` decides inside the write transaction
 * and answers 403 whatever this file renders. What this page owes the operator is that the screen
 * never PROMISES something the policy will refuse.
 *
 * ── Filtering is SERVER-side, unlike the prototype ──
 * There, `filtered()` narrowed a 14-row array that was already in the browser. Here `search`, `role`
 * and `status` are query parameters (STAFF-QUERY-1) and one page of rows is all this component ever
 * holds — the same shape `Pagination` was built for. Three consequences worth naming:
 *
 *  · the counts under the table are `meta.total` from the same request that produced the rows, so
 *    they cannot disagree with them;
 *  · `page` resets to 1 whenever a filter changes — filtering down to three rows while parked on
 *    page 2 would otherwise render an empty table under a pager insisting there are three;
 *  · the search box is DEBOUNCED. The prototype filtered on every keystroke because that cost
 *    nothing; here each keystroke would be a request.
 *
 * ⚠️ ถูกลบแล้ว is opt-IN and never part of "ทุกสถานะ". Soft-deleted rows are excluded from `data`
 * and from `meta.total` unless the query asks for them, so folding them into the default view would
 * show rows the count beside them denies exist. It is also the only way to obtain the id a restore
 * needs, and it is SUPER_ADMIN-only — the option is hidden for everyone else, and the server 403s
 * it regardless.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ApiError,
  createSystemUser,
  deleteSystemUser,
  listSystemUsers,
  resetSystemUserPassword,
  restoreSystemUser,
  type SystemUser,
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
import { ROLE_LABEL, type SystemRole } from '../../labels'
import { useAuth } from '../../lib/auth-context'
import { useToast } from '../../lib/toast-context'
import {
  ADMIN_PORTAL_ROUTES,
  urlOf,
  type AdminRoute,
  type AdminRouteLabel,
} from '../../routes'
import { AccountEditor } from './components/AccountEditor'
import { RoleChip } from './components/RoleChip'
import { StaffDetailDialog } from './components/StaffDetailDialog'
import { StaffFormDialog, type StaffFormValues } from './components/StaffFormDialog'
import { TempPasswordDialog } from './components/TempPasswordDialog'
import { fullName, stateOf, STAFF_STATE, type StaffRecord, type StaffState } from './staff-record'
import { useStaffOptions } from './use-staff-options'

/**
 * 10 per page. The endpoint's own default is 20 and its ceiling is 100, but `limit` is the CLIENT's
 * choice — this is the request the prototype's pager describes, not a number invented to make the
 * control visible.
 */
const PAGE_SIZE = 10

/** `''` is "no filter", which is not a value the query may carry. */
type RoleFilter = '' | SystemRole
type StatusFilter = '' | StaffState

const ICON = {
  refresh:
    'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99',
  plus: 'M12 4.5v15m7.5-7.5h-15',
  pencil:
    'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  eye: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z',
  eyeInner: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  chevron: 'M9 5l7 7-7 7',
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

/** `ApiError` → which of the three error panels. */
const kindOf = (err: unknown): LoadErrorKind => {
  const status = err instanceof ApiError ? err.status : 0
  if (status === 0) return 'network'
  if (status === 403) return 'forbidden'
  return 'server'
}

/**
 * The three confirmations, and the sentence each one has to get right.
 *
 * ⚠️ ลบ IS NOT "ลบถาวร" AND NOT "กู้คืนไม่ได้". `DELETE` is an `update` that sets `deletedAt`, the
 * row survives so the `createdById` audit chain stays resolvable, and `POST /:id/restore` exists.
 * What IS permanent is the EMAIL — the `@unique` index spans deleted rows — so that is the
 * irreversible thing the line names.
 *
 * ⚠️ กู้คืน changes NOTHING else, which is the fact operators get wrong: a user suspended before
 * deletion comes back suspended, and their old password still works.
 */
const CONFIRM = {
  reset: {
    title: 'ยืนยันการรีเซ็ตรหัสผ่าน',
    // The sharp end is the FIRST clause: the operator usually arrives because somebody forgot a
    // password, and the fact they need before pressing is that the old one dies whether or not the
    // new one ever reaches its owner — including a temporary password handed over ten minutes ago.
    desc: 'รหัสผ่านเดิมจะใช้ไม่ได้ทันที · ระบบจะออกรหัสผ่านชั่วคราวใหม่และแสดงให้เห็นเพียงครั้งเดียว',
    label: 'รีเซ็ตรหัสผ่าน',
    busy: 'กำลังรีเซ็ต…',
    tone: 'danger',
    fail: (n: string) => `รีเซ็ตรหัสผ่านของ ${n} ไม่สำเร็จ — รหัสผ่านเดิมยังใช้ได้อยู่ ลองใหม่อีกครั้ง`,
  },
  delete: {
    title: 'ยืนยันการลบบัญชี',
    desc: 'บัญชีนี้จะเข้าสู่ระบบไม่ได้อีก และหายไปจากรายชื่อ · ประวัติการทำรายการยังอยู่ครบ แต่อีเมลนี้จะสร้างบัญชีใหม่ไม่ได้อีกเลย',
    label: 'ลบบัญชีนี้',
    busy: 'กำลังลบ…',
    tone: 'danger',
    ok: (n: string) => `ลบบัญชีของ ${n} แล้ว`,
    fail: (n: string) => `ลบบัญชีของ ${n} ไม่สำเร็จ — บัญชียังใช้งานได้อยู่ ลองใหม่อีกครั้ง`,
  },
  restore: {
    title: 'ยืนยันการกู้คืนบัญชี',
    desc: 'บัญชีจะกลับมาอยู่ในรายชื่อพร้อมบทบาท สถานะและรหัสผ่านเดิมทุกอย่าง · หากก่อนลบถูกระงับอยู่ ก็จะกลับมาในสถานะระงับเหมือนเดิม',
    label: 'กู้คืนบัญชี',
    busy: 'กำลังกู้คืน…',
    tone: 'primary',
    ok: (n: string) => `กู้คืนบัญชีของ ${n} แล้ว`,
    fail: (n: string) => `กู้คืนบัญชีของ ${n} ไม่สำเร็จ — บัญชียังอยู่ในสถานะถูกลบ ลองใหม่อีกครั้ง`,
  },
} as const

const MSG = {
  /**
   * ⚠️ ONE SENTENCE FOR ALL THREE CASES — live, suspended and deleted — by design. The unique index
   * spans soft-deleted rows on purpose, because that is what makes restore safe; but confirming
   * "this address belongs to a deleted account" would hand out the existence of a row that no list
   * this caller can request will return.
   */
  emailTaken: 'อีเมลนี้ถูกใช้กับบัญชีอื่นแล้ว ใช้อีเมลอื่น',
  optionGone: 'ตำแหน่งหรือกลุ่ม/ฝ่ายที่เลือกไว้ไม่พร้อมใช้งานแล้ว โปรดเลือกใหม่แล้วลองอีกครั้ง',
  refreshed: 'อัปเดตข้อมูลล่าสุดแล้ว',
} as const

/** Whole-form failures that leave the dialog open with everything typed intact. */
const WRITE_FAIL: Record<number, string> = {
  403: 'เซสชันความปลอดภัยหมดอายุ ยังไม่ได้บันทึกอะไร โปรดรีเฟรชหน้าแล้วลองใหม่',
  503: 'ระบบขัดข้องชั่วคราว ยังไม่ได้บันทึกอะไร ลองใหม่อีกครั้ง',
  0: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ยังไม่ได้บันทึกอะไร ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่',
}

const PROFILE_LABEL: AdminRouteLabel = 'โปรไฟล์'

/**
 * `SystemUserResponseDto` → what the dialogs read.
 *
 * ⚠️ `deleted` COMES FROM THE REQUEST, NOT FROM THE ROW. The DTO has no such field: the list
 * excludes soft-deleted rows unless `status=deleted` was asked for, so the only thing that knows
 * this row is a deleted one is the query that fetched it. That works, and it is fragile — any
 * future response mixing the two populations cannot be rendered correctly. `staff-record.ts` says
 * the same thing from the other side.
 */
const toRecord = (u: SystemUser, deleted: boolean): StaffRecord => ({
  id: u.id,
  email: u.email,
  firstName: u.firstName,
  lastName: u.lastName,
  role: u.role,
  personnelRole: u.personnelRole,
  department: u.department,
  phoneNumber: u.phoneNumber,
  profilePictureUrl: u.profilePictureUrl,
  isActive: u.isActive,
  mustChangePassword: u.mustChangePassword,
  deleted: deleted || undefined,
  lastLoginAt: u.lastLoginAt,
  createdAt: u.createdAt,
  createdBy: u.createdBy,
})

export function StaffPage({ route }: { route: AdminRoute }) {
  const { user, refresh: refreshSession } = useAuth()
  const me = user!
  const toast = useToast()
  const navigate = useNavigate()

  /**
   * SUPER_ADMIN, and only SUPER_ADMIN. See the header — this is deliberately not `useAcl`.
   */
  const canManage = me.role === 'SUPER_ADMIN'

  const [rows, setRows] = useState<SystemUser[] | null>(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<LoadErrorKind | null>(null)

  /** What is TYPED. `query` is what was last SENT — see the debounce below. */
  const [term, setTerm] = useState('')
  const [query, setQuery] = useState('')
  const [role, setRole] = useState<RoleFilter>('')
  const [status, setStatus] = useState<StatusFilter>('')
  const [page, setPage] = useState(1)

  /** The row whose record is open for reading. `null` keeps the dialog mounted and closed. */
  const [shown, setShown] = useState<StaffRecord | null>(null)

  /**
   * ⚠️ TWO PIECES OF STATE FOR ONE DIALOG, and the split is deliberate. `editing` is the row's DTO
   * and `editorOpen` is whether the dialog is showing; closing sets only the second, so the editor
   * is still MOUNTED for the commit in which `open` goes false. `Modal` restores focus from the
   * dialog's own `close` event, and a dialog unmounted while open never fires one — measured on
   * โปรไฟล์ as focus left on `<body>` after every save.
   */
  const [editing, setEditing] = useState<SystemUser | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)

  /** เพิ่มบัญชีเจ้าหน้าที่ — its own dialog, because create and edit send different bodies. */
  const [creating, setCreating] = useState(false)
  const [createAlert, setCreateAlert] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [creatingBusy, setCreatingBusy] = useState(false)

  /**
   * Which confirmation is up, and on whom.
   *
   * `back` is the prototype's `returnTo`: รีเซ็ตรหัสผ่าน and ลบบัญชี are reached from INSIDE the
   * edit dialog, which closes to make room (native `<dialog>`s stack, but a confirmation that
   * paints over the form it was launched from hides the row being acted on). Dismissing the
   * confirmation must therefore put the operator back where they were, not drop them on the table —
   * they answered "no" to the delete, not to the edit.
   */
  const [asking, setAsking] = useState<{
    kind: 'reset' | 'delete' | 'restore'
    row: StaffRecord
    back?: boolean
  } | null>(null)

  /** The one-shot plaintext. Held only until the dialog is dismissed. */
  const [temp, setTemp] = useState<{
    kind: 'created' | 'reset'
    name: string
    email: string
    password: string
  } | null>(null)

  /**
   * The create dialog's own option lists. `null` current — a new account is not already on one, so
   * nothing has to be appended to keep a value reachable. `AccountEditor` calls the same hook for
   * the edit dialog with the row it is editing.
   */
  const createOptions = useStaffOptions(creating, null)

  /*
   * 300ms after the last keystroke, not on every one. Also resets the page, for the same reason the
   * two selects do: a search that narrows the result set while parked on page 3 lands on nothing.
   */
  useEffect(() => {
    const id = setTimeout(() => {
      setQuery(term.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(id)
  }, [term])

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await listSystemUsers({
        page,
        limit: PAGE_SIZE,
        search: query || undefined,
        role: role || undefined,
        status: status || undefined,
      })
      setRows(res.data)
      setTotal(res.meta.total)
      return true
    } catch (err) {
      setRows(null)
      setError(kindOf(err))
      return false
    }
  }, [page, query, role, status])

  /**
   * The button, as opposed to the filter-driven reloads. It says so when it worked — the table can
   * come back byte-identical, and a control that gives no sign of having run reads as broken.
   */
  const refresh = async () => {
    if (await load()) toast('success', MSG.refreshed)
  }

  useEffect(() => {
    void load()
  }, [load])

  const deletedView = status === 'deleted'
  const records = useMemo(
    () => (rows ?? []).map((u) => toRecord(u, deletedView)),
    [rows, deletedView],
  )

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = (page - 1) * PAGE_SIZE + records.length
  const anyFilter = Boolean(query || role || status)
  /** The filters emptied the table. A table that is empty with NO filter on is a different panel. */
  const miss = anyFilter && records.length === 0

  /**
   * Names the filters that are ACTUALLY on. "ลองล้างตัวกรอง" over three inputs, two of which the
   * operator may have set ten minutes ago, is advice that does not say what to undo.
   */
  const missDesc = [
    query && `คำค้นหา “${query}”`,
    role && `บทบาท ${ROLE_LABEL[role]}`,
    status && `สถานะ ${STAFF_STATE[status].label}`,
  ].filter(Boolean) as string[]

  const clearFilters = () => {
    setTerm('')
    setQuery('')
    setRole('')
    setStatus('')
    setPage(1)
  }

  /** Is this row the signed-in operator? Four self-mutation rules on the server hang off it. */
  const isMe = (r: StaffRecord) => r.id === me.id

  /**
   * "You may not manage the account that created you" (15 ส.ค. 2569, PO).
   *
   * ⚠️ ONE HOP — your creator, not your creator's creator, exactly as specified. Two SUPER_ADMINs
   * are peers to the server (`case SUPER_ADMIN: return allow()`), so without this the account that
   * installed the system could be demoted by an account it created five minutes ago. `createdById`
   * is the asymmetry, and it is already kept resolvable forever for the audit chain.
   *
   * ⚠️ NOT IN THE SERVICE YET — STAFF-CREATOR-1. Today this is a screen-only rule, which means it
   * hides a pencil rather than refusing a write. It is recorded as a gap, not presented as enforced.
   */
  const isMyCreator = (r: StaffRecord) => Boolean(me.createdBy && me.createdBy.id === r.id)

  /**
   * The question every pencil and every dialog footer asks. One function on purpose: the prototype
   * had this test written out at three call sites and they had already drifted once.
   */
  const canManageRow = (r: StaffRecord) => {
    if (!canManage) return false // ADMIN and VIEWER: nothing on this table
    if (r.deleted) return false // a deleted row is restored, never edited
    if (isMyCreator(r)) return false
    return true // …including your own row — what is fenced off lives inside the dialog
  }

  /**
   * Guard, not UX. Nothing renders a pencil where `canManageRow` says no — reaching here means
   * something else called it, and every case it rejects is a form the policy would answer 403 or
   * 404 to.
   */
  const openManage = (r: StaffRecord) => {
    if (!canManageRow(r)) return
    const dto = (rows ?? []).find((u) => u.id === r.id)
    if (!dto) return
    setShown(null)
    setEditing(dto)
    setEditorOpen(true)
  }

  /** The create defaults. VIEWER is one of them, and it is a decision — see the dialog below. */
  const createInitial = useMemo<StaffFormValues | null>(() => {
    const pos = createOptions.positions?.find((o) => !o.reserved) ?? createOptions.positions?.[0]
    const dept =
      createOptions.departments?.find((o) => !o.reserved) ?? createOptions.departments?.[0]
    if (!pos || !dept) return null
    return {
      email: '',
      firstName: '',
      lastName: '',
      personnelRoleId: pos.id,
      departmentId: dept.id,
      phoneNumber: '',
      // Least privilege that still makes an account worth creating. A select that opens on the most
      // powerful option grants it to whoever does not read it.
      role: 'VIEWER',
      isActive: true,
    }
  }, [createOptions.positions, createOptions.departments])

  const closeCreate = () => {
    setCreating(false)
    setCreateAlert(null)
    setEmailError(null)
  }

  const submitCreate = async (values: StaffFormValues) => {
    setCreateAlert(null)
    setEmailError(null)
    setCreatingBusy(true)
    try {
      const created = await createSystemUser({
        email: values.email.trim().toLowerCase(),
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        role: values.role,
        personnelRoleId: values.personnelRoleId,
        departmentId: values.departmentId,
        // OPTIONAL, not nullable — `CreateSystemUserDto` has no `null` for it, and
        // `forbidNonWhitelisted` is not what would reject it: `@IsString()` would.
        ...(values.phoneNumber.trim() ? { phoneNumber: values.phoneNumber.trim() } : {}),
      })
      closeCreate()
      /*
       * Land on the new row. `createdAt DESC` puts it first, so clearing the filters and going to
       * page 1 is what shows it — being left on page 2 of a filter that excludes the account you
       * just made is the screen losing the thing it just made.
       */
      clearFilters()
      await load()
      setTemp({
        kind: 'created',
        name: fullName(created),
        email: created.email,
        password: created.temporaryPassword,
      })
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0
      // The 409 belongs ON THE FIELD, because the fix is to type a different address.
      if (status === 409) setEmailError(MSG.emailTaken)
      else if (status === 400) setCreateAlert(MSG.optionGone)
      else setCreateAlert(WRITE_FAIL[status] ?? 'สร้างบัญชีไม่สำเร็จ ยังไม่ได้บันทึกอะไร ลองใหม่อีกครั้ง')
    } finally {
      setCreatingBusy(false)
    }
  }

  /**
   * The three writes behind the confirmations.
   *
   * ⚠️ `isMe` GUARDS RESET AND DELETE even though neither button is rendered on your own row.
   * `canResetPassword` and `canDelete` deny self on the server, so these are the last places a UI
   * bug could become a request the policy answers 403 to — and a delete that got through would be
   * an account deleting itself.
   */
  const runConfirmed = async () => {
    if (!asking) return
    const { kind, row } = asking
    const who = fullName(row) || row.email
    try {
      if (kind === 'reset') {
        if (isMe(row)) return
        const res = await resetSystemUserPassword(row.id)
        setAsking(null)
        await load()
        setTemp({ kind: 'reset', name: who, email: row.email, password: res.temporaryPassword })
        return
      }
      if (kind === 'delete') {
        if (isMe(row)) return
        await deleteSystemUser(row.id)
        setAsking(null)
        await load()
        toast('success', CONFIRM.delete.ok(who))
        return
      }
      await restoreSystemUser(row.id)
      setAsking(null)
      /*
       * Restore moves the row OUT of the ถูกลบแล้ว list it was selected from, so staying on that
       * filter would answer with an empty table. Move to where the row actually went.
       */
      setStatus('')
      setPage(1)
      toast('success', CONFIRM.restore.ok(who))
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0
      setAsking(null)
      await load()
      toast(
        'error',
        status === 404
          ? 'บัญชีนี้ไม่อยู่ในสถานะเดิมแล้ว รายการถูกปรับให้ตรงกับข้อมูลล่าสุด'
          : CONFIRM[kind].fail(who),
      )
    }
  }

  return (
    <div className="card-shell">
      <PageHeading
        route={route}
        // Two sentences for two audiences and they are BOTH true at once: the super admin reads a
        // job description, the admin/viewer reads why the buttons are not there. Painting one of
        // them per role was the prototype's first idea and is worse — a page whose subtitle changes
        // under you reads as a different page.
        desc="บัญชีทั้งหมดที่เข้าใช้งานระบบหลังบ้านได้ · การเพิ่ม ลบ และเปลี่ยนบทบาท เป็นสิทธิ์ของผู้ดูแลระบบสูงสุดเท่านั้น"
        descAtEveryWidth={false}
        actions={
          <div className="flex items-center gap-2">
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
            {canManage && (
              <Btn variant="primary" onClick={() => setCreating(true)}>
                <Glyph d={ICON.plus} />
                {/* Two labels, one button: the phone drops "เจ้าหน้าที่" rather than the verb. */}
                <span className="sm:hidden">เพิ่มบัญชี</span>
                <span className="hidden sm:inline">เพิ่มบัญชีเจ้าหน้าที่</span>
              </Btn>
            )}
          </div>
        }
      />

      <div className="card-shell rounded-card border border-base-300/70 bg-base-100 shadow-e1">
        {/* Search + TWO filters. No sort control: the endpoint is `createdAt DESC, id DESC` and has
            no `sort` parameter, so offering one would be the screen promising an ordering the API
            cannot produce. */}
        <div className="flex shrink-0 flex-col gap-2.5 border-b border-base-300 p-3 sm:gap-3 sm:p-4 lg:flex-row lg:items-center lg:p-5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-control border border-transparent bg-base-200 px-4 transition-all focus-within:border-primary/40 focus-within:bg-base-100 focus-within:ring-4 focus-within:ring-primary/10">
            <Glyph d={ICON.search} className="h-5 w-5 shrink-0 text-base-content/60" />
            <label className="sr-only" htmlFor="st-search">
              ค้นหาชื่อหรืออีเมล
            </label>
            <input
              id="st-search"
              type="search"
              autoCorrect="on"
              autoCapitalize="none"
              spellCheck
              enterKeyHint="search"
              placeholder="ค้นหาชื่อ หรืออีเมล"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="min-h-11 w-full min-w-0 border-none bg-transparent text-[15px] text-base-content/90 outline-none placeholder:text-base-content/70"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5 lg:flex lg:shrink-0">
            <label className="relative flex items-center rounded-control border border-transparent bg-base-200 transition-all focus-within:border-primary/40 focus-within:bg-base-100 focus-within:ring-4 focus-within:ring-primary/10 lg:w-52">
              <span className="sr-only">กรองตามบทบาท</span>
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as RoleFilter)
                  setPage(1)
                }}
                className="min-h-11 w-full cursor-pointer appearance-none border-none bg-transparent px-4 pr-9 text-[15px] font-medium text-base-content/90 outline-none"
              >
                <option value="">ทุกบทบาท</option>
                <option value="SUPER_ADMIN">{ROLE_LABEL.SUPER_ADMIN}</option>
                <option value="ADMIN">{ROLE_LABEL.ADMIN}</option>
                <option value="VIEWER">{ROLE_LABEL.VIEWER}</option>
              </select>
              <Glyph
                d="M19 9l-7 7-7-7"
                className="pointer-events-none absolute right-3 h-4 w-4 text-base-content/60"
              />
            </label>

            <label className="relative flex items-center rounded-control border border-transparent bg-base-200 transition-all focus-within:border-primary/40 focus-within:bg-base-100 focus-within:ring-4 focus-within:ring-primary/10 lg:w-48">
              <span className="sr-only">กรองตามสถานะ</span>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as StatusFilter)
                  setPage(1)
                }}
                className="min-h-11 w-full cursor-pointer appearance-none border-none bg-transparent px-4 pr-9 text-[15px] font-medium text-base-content/90 outline-none"
              >
                <option value="">ทุกสถานะ</option>
                <option value="active">{STAFF_STATE.active.label}</option>
                <option value="pending">{STAFF_STATE.pending.label}</option>
                <option value="suspended">{STAFF_STATE.suspended.label}</option>
                {/* SUPER_ADMIN only, on the OPTION rather than the select — everyone keeps the
                    other four. The server 403s the query for any other role; this is the UX half. */}
                {canManage && <option value="deleted">{STAFF_STATE.deleted.label}</option>}
              </select>
              <Glyph
                d="M19 9l-7 7-7-7"
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
          <LoadingPanel actionsLabel={canManage ? 'จัดการ' : 'ดูข้อมูล'} />
        ) : records.length === 0 && !anyFilter ? (
          /* Unreachable in practice and still built: the account reading this IS a row in this
             table, so the endpoint cannot return zero to an authenticated caller. It exists because
             "the list came back empty" is a real server answer that a screen must not render as a
             blank card. The copy says exactly that rather than inventing a cause. */
          <div className="card-shell">
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
              <EmptyState
                icon={<Glyph d={ICON.users} className="h-8 w-8" />}
                title="ไม่มีบัญชีเจ้าหน้าที่ในระบบ"
                description="ระบบไม่ได้ส่งรายชื่อบัญชีใดกลับมา ทั้งที่บัญชีที่คุณใช้อยู่ก็อยู่ในรายการนี้ ลองโหลดข้อมูลใหม่ หากยังเป็นแบบเดิม โปรดแจ้งฝ่ายเทคนิค"
                actions={
                  <Btn variant="primary" onClick={() => void load()}>
                    <Glyph d={ICON.refresh} />
                    โหลดข้อมูลใหม่
                  </Btn>
                }
              />
            </div>
          </div>
        ) : (
          <div className="card-shell">
            <div className="card-scroll nav-scroll">
              {miss ? (
                <EmptyState
                  icon={<Glyph d={ICON.search} className="h-8 w-8" />}
                  title="ไม่พบบัญชีที่ตรงกับเงื่อนไข"
                  description={`ไม่มีบัญชีที่ตรงกับ ${missDesc.join(' · ')} พร้อมกัน`}
                  actions={
                    /* THREE inputs feed this table, so the way out is "ล้างตัวกรองทั้งหมด" rather
                       than clearing the search box — an operator who filtered to ผู้ดูข้อมูล + ระงับ
                       and then typed a name cannot tell which of the three emptied it. */
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
                          <th scope="col" className="th-cell whitespace-nowrap">
                            ตำแหน่ง · กลุ่ม/ฝ่าย
                          </th>
                          <th scope="col" className="th-cell whitespace-nowrap">
                            บทบาท
                          </th>
                          <th scope="col" className="th-cell text-center">
                            สถานะ
                          </th>
                          {/* ⚠️ `canManage`, not `acl.actionsColumnLabel`: an ADMIN never gets a
                              pencil on THIS table, so a header still reading จัดการ would claim a
                              capability the page just removed. */}
                          <th scope="col" data-col="actions" className="th-cell text-right">
                            {canManage ? 'จัดการ' : 'ดูข้อมูล'}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((r, i) => (
                          <Row
                            key={r.id}
                            record={r}
                            index={from + i}
                            me={isMe(r)}
                            canEdit={canManageRow(r)}
                            onView={() => setShown(r)}
                            onEdit={() => openManage(r)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <ul className="m-0 list-none divide-y divide-base-300/60 p-0 lg:hidden">
                    {records.map((r) => (
                      <CardRow key={r.id} record={r} me={isMe(r)} onView={() => setShown(r)} />
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
                  บัญชี
                </p>
                <Pagination page={page} pages={pages} onGo={setPage} label="แบ่งหน้ารายชื่อเจ้าหน้าที่" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Held MOUNTED between rows — `record={null}` renders a closed dialog rather than unmounting
          one, so `Modal` still gets the `close` event that restores focus to the row. */}
      <StaffDetailDialog
        open={shown !== null}
        onClose={() => setShown(null)}
        record={shown}
        self={shown ? isMe(shown) : false}
        canManage={canManage}
        canManageRow={shown ? canManageRow(shown) : false}
        myCreator={shown ? isMyCreator(shown) : false}
        onManage={() => shown && openManage(shown)}
        onRestore={() => {
          if (!shown) return
          const row = shown
          setShown(null)
          setAsking({ kind: 'restore', row })
        }}
        // ⚠️ NOT a row action. The prototype removed the โปรไฟล์ link from the จัดการ COLUMN — that
        // column acts on the row you are looking at, and yours acted on the app and navigated away
        // from the page. Inside the record, after you have opened and read it, is where "go and
        // edit yourself" belongs, beside จัดการบัญชีของคุณ rather than instead of it: the avatar and
        // the password genuinely do live on another page.
        onGoToProfile={() => {
          const target = ADMIN_PORTAL_ROUTES.find((r) => r.label === PROFILE_LABEL)
          if (target) navigate(urlOf(target))
        }}
      />

      {/* ── จัดการบัญชี ─────────────────────────────────────────────────────
          THE ONE DOOR to `PATCH /system-users/:id` — this page does not hold a patch call of its
          own, and neither does โปรไฟล์. The danger zone's two buttons are separate endpoints, so
          they come back out to this page; `self` removes them, matching `canDelete` /
          `canResetPassword`, which deny self on the server. */}
      {editing && (
        <AccountEditor
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          target={editing}
          self={editing.id === me.id}
          currentState={stateOf(toRecord(editing, false))}
          onSaved={async () => {
            await load()
            // Editing YOURSELF has to reach the places your own name, ตำแหน่ง and กลุ่ม/ฝ่าย are
            // printed — the sidebar identity card and the profile page — or the save looks like it
            // did nothing outside this table.
            if (editing.id === me.id) await refreshSession()
          }}
          onResetPassword={
            editing.id === me.id
              ? undefined
              : () => {
                  const row = toRecord(editing, false)
                  setEditorOpen(false)
                  setAsking({ kind: 'reset', row, back: true })
                }
          }
          onDelete={
            editing.id === me.id
              ? undefined
              : () => {
                  const row = toRecord(editing, false)
                  setEditorOpen(false)
                  setAsking({ kind: 'delete', row, back: true })
                }
          }
        />
      )}

      {/* ── เพิ่มบัญชีเจ้าหน้าที่ ───────────────────────────────────────────
          ⚠️ NO `password` FIELD, and that is not an omission: `CreateSystemUserDto` has none, so an
          admin-chosen password would be a second credential path bypassing the forced-reset gate.
          The SERVER issues a temporary one and returns it EXACTLY ONCE. */}
      {createInitial && (
        <StaffFormDialog
          open={creating}
          onClose={closeCreate}
          mode="create"
          initial={createInitial}
          positions={createOptions.positions ?? []}
          departments={createOptions.departments ?? []}
          alert={createAlert ?? createOptions.alert}
          emailError={emailError}
          busy={creatingBusy}
          onSubmit={(values) => void submitCreate(values)}
        />
      )}

      <ConfirmModal
        open={asking !== null}
        onClose={() => {
          const back = asking?.back
          setAsking(null)
          if (back) setEditorOpen(true)
        }}
        onConfirm={runConfirmed}
        title={asking ? CONFIRM[asking.kind].title : ''}
        // Name AND email, because two people called สมชาย is not a hypothetical in a school.
        who={asking ? `${fullName(asking.row)} · ${asking.row.email}` : undefined}
        description={asking ? CONFIRM[asking.kind].desc : ''}
        tone={asking?.kind === 'restore' ? 'primary' : 'danger'}
        confirmLabel={asking ? CONFIRM[asking.kind].label : ''}
        busyLabel={asking ? CONFIRM[asking.kind].busy : undefined}
      />

      {/* The one-shot. It is the RECEIPT for a create or a reset, so there is no toast beside it —
          the password IS the confirmation, and it can never be retrieved again. */}
      <TempPasswordDialog
        open={temp !== null}
        onClose={() => setTemp(null)}
        kind={temp?.kind ?? 'created'}
        name={temp?.name ?? ''}
        email={temp?.email ?? ''}
        password={temp?.password ?? ''}
      />
    </div>
  )
}

/** One desktop row. The action slot holds a ดินสอ or nothing — never a padlock; see below. */
function Row({
  record,
  index,
  me,
  canEdit,
  onView,
  onEdit,
}: {
  record: StaffRecord
  index: number
  me: boolean
  /** `canManageRow`, asked by the page. The slot holds a pencil or nothing. */
  canEdit: boolean
  onView: () => void
  onEdit: () => void
}) {
  const state = STAFF_STATE[stateOf(record)]
  const name = fullName(record)

  return (
    <tr className="group border-b border-base-300/60 transition-colors hover:bg-base-content/5">
      <td className="td-cell text-center text-base-content/70 tabular-nums">{index}</td>
      <td className="td-cell">
        <div className="flex items-center gap-3">
          <Avatar
            src={record.profilePictureUrl}
            name={record.firstName}
            className="h-9 w-9 shrink-0 rounded-control text-[14px] font-semibold"
          />
          <span className="flex min-w-0 flex-col">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[15px] font-medium text-base-content">{name}</span>
              {/* Not a badge: it is not a status, and a chip here would land in the same eye-line
                  as the two chip columns to the right. A muted parenthetical is what a directory
                  uses to mark you. */}
              {me && (
                <span className="shrink-0 text-[13px] font-medium text-base-content/60">(คุณ)</span>
              )}
            </span>
            {/* The email is the second line, not a column: it is the login identity, immutable
                after creation, so it belongs with the name it identifies rather than in ~200px of
                its own saying the same thing again. */}
            <span className="truncate text-[13px] text-base-content/70">{record.email}</span>
          </span>
        </div>
      </td>
      {/* `h-[63px]` on EVERY cell in this column: one wrapped กลุ่ม/ฝ่าย otherwise makes its row
          92px while the rest stay 73px, and a table with two heights looks broken. */}
      <td className="td-cell">
        <span className="flex h-[63px] min-w-0 flex-col justify-center gap-0.5">
          <span className="text-[14px] text-base-content/80">{record.personnelRole.name}</span>
          <span className="text-[13px] text-base-content/70">{record.department.name}</span>
        </span>
      </td>
      <td className="td-cell">
        <RoleChip role={record.role} />
      </td>
      <td className="td-cell text-center">
        <Badge tone={state.tone}>{state.label}</Badge>
      </td>
      <td data-col="actions" className="td-cell">
        {/* ⚠️ An empty slot is NOT a padlock, and that is not the same decision as ตัวเลือกบุคลากร's.
            There the row is un-editable by EVERYONE forever, so the lock is a fact about the ROW.
            Here the row is perfectly editable, just not by you — a padlock would state a fact about
            the READER and put a "you may not" glyph on every line of a directory somebody is only
            reading. The column HEADER says it once instead. */}
        <div className="ml-auto flex w-fit justify-end opacity-70 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={onView}
            aria-label={`ดูข้อมูลบัญชีของ ${name} สถานะ ${state.label}`}
            data-tip="ดูข้อมูลบัญชี"
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
          {/* Your own row says so: "จัดการบัญชีของ เชิดศักดิ์ คำไล้" read out on the row already
              marked (คุณ) is the screen not noticing. */}
          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label={me ? 'จัดการบัญชีของคุณ' : `จัดการบัญชีของ ${name}`}
              data-tip={me ? 'จัดการบัญชีของคุณ' : 'จัดการบัญชี'}
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
 * The phone card is THE SAME CARD as การลงทะเบียน's, deliberately.
 *
 * A literal translation of the desktop row — avatar, three lines, two 44px buttons bolted to the
 * right edge — left ~150px for a Thai full name at 375px, so most rows rendered as "ชนิดา ป…". A
 * directory whose names do not fit is not a directory. So: one full-width target, the actions live
 * inside the record, and you read somebody before acting on them.
 *
 * ⚠️ THE THIRD LINE IS THE ROLE, NOT THE EMAIL. An email is a string you need when you are about to
 * CONTACT somebody and it truncates to noise at this width; the role is the fact this directory
 * exists to carry. Plain text rather than the desktop's outlined chip — at 13px a bordered pill
 * costs a line of its own.
 */
function CardRow({
  record,
  me,
  onView,
}: {
  record: StaffRecord
  me: boolean
  onView: () => void
}) {
  const state = STAFF_STATE[stateOf(record)]
  const name = fullName(record)

  return (
    <li>
      <button
        type="button"
        onClick={onView}
        aria-label={`ดูข้อมูลบัญชีของ ${name} สถานะ ${state.label}`}
        className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-base-content/5 active:bg-base-content/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      >
        <Avatar
          src={record.profilePictureUrl}
          name={record.firstName}
          className="h-10 w-10 shrink-0 rounded-control text-[15px] font-semibold"
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[15px] font-medium text-base-content">{name}</span>
              {me && (
                <span className="shrink-0 text-[13px] font-medium text-base-content/60">(คุณ)</span>
              )}
            </span>
            <Badge tone={state.tone} className="shrink-0">
              {state.label}
            </Badge>
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-base-content/70">
            {record.personnelRole.name} · {record.department.name}
          </span>
          {/* No `mt-*`: การลงทะเบียน's third line has none either, and measured side by side the
              2px was the whole difference between a 104px card and its 101px one. */}
          <RoleChip role={record.role} variant="ink" />
        </span>
        <Glyph d={ICON.chevron} className="mt-1 h-5 w-5 shrink-0 text-base-content/40" />
      </button>
    </li>
  )
}

/**
 * The skeleton, at both widths. Ten rows because that is `PAGE_SIZE` — a skeleton that promises a
 * different number of rows than the request will return is a layout that jumps on arrival.
 */
function LoadingPanel({ actionsLabel }: { actionsLabel: string }) {
  const rows = Array.from({ length: PAGE_SIZE }, (_, i) => i)
  return (
    <div className="card-shell" aria-busy="true">
      <span className="sr-only" role="status">
        กำลังโหลดรายชื่อเจ้าหน้าที่ระบบ
      </span>
      <div className="card-scroll nav-scroll">
        <div className="hidden lg:block" aria-hidden="true">
          <table className="w-full table-fixed border-collapse text-left">
            <colgroup>
              <col style={{ width: '7%' }} />
              <col style={{ width: '29%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '10%' }} />
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
                <th scope="col" className="th-cell whitespace-nowrap">
                  บทบาท
                </th>
                <th scope="col" className="th-cell text-center">
                  สถานะ
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
                        <Skeleton className="h-3 w-40" />
                      </div>
                    </div>
                  </td>
                  <td className="td-cell">
                    <div className="flex h-[63px] flex-col justify-center gap-1.5">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </td>
                  <td className="td-cell">
                    <Skeleton className="h-7 w-28 rounded-full" variant="box" />
                  </td>
                  <td className="td-cell">
                    <Skeleton className="mx-auto h-6 w-20 rounded-full" variant="box" />
                  </td>
                  <td className="td-cell">
                    <Skeleton className="ml-auto h-9 w-9 rounded-control" variant="box" />
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
                <Skeleton className="h-3 w-28" />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div
        className="flex shrink-0 flex-col items-center justify-between gap-3 border-t border-base-300 p-4 sm:flex-row lg:px-5"
        aria-hidden="true"
      >
        <Skeleton className="h-3.5 w-40" />
        <span className="flex items-center gap-1.5">
          <Skeleton className="h-11 w-20" variant="box" />
          <Skeleton className="h-11 w-11" variant="box" />
          <Skeleton className="h-11 w-11" variant="box" />
          <Skeleton className="h-11 w-16" variant="box" />
        </span>
      </div>
    </div>
  )
}
