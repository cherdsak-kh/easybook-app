/**
 * The internal component showcase — every P1 component, in every state, on one page.
 *
 * This is the TEST HARNESS for Phase 1, and it is the only one there is: the PO's ruling for
 * this phase is "measure in the browser, write no new unit tests" (CONVENTIONS §2). A
 * component that is never rendered has never been verified, so this page grows with each
 * P1 chunk rather than waiting until the end — three unmeasured chunks would be three
 * chunks of "it compiles".
 *
 * It is also where the full contrast sweep runs at the end of P1, once, in both themes.
 * That is why every component appears in its FAILING and its EMPTY states too, not just its
 * happy one: a sweep that only ever sees valid fields never measures the error red.
 *
 * ⚠️ Temporary route. P2 owns the real router and the `/backend` shell; this hangs off
 * `/admin-portal/_showcase` until then and goes away with the P2 wiring.
 * ⚠️ Not part of the product. Nothing here may be imported by a real page.
 */

import { useRef, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Btn, IconBtn } from '../../components/ui/Btn'
import { Card, CardBody, CardHead, CardRows } from '../../components/ui/Card'
import { FieldRow, LinkRow } from '../../components/ui/FieldRow'
import { FormField, SelectField } from '../../components/ui/FormField'
import { Modal } from '../../components/ui/Modal'
import { Pagination } from '../../components/ui/Pagination'
import { PasswordField } from '../../components/ui/PasswordField'
import { PasswordRules } from '../../components/ui/PasswordRules'
import { ComingSoon } from '../../components/feedback/ComingSoon'
import { ConfirmModal } from '../../components/feedback/ConfirmModal'
import { EmptyState } from '../../components/feedback/EmptyState'
import { InlineAlert, InlineNote } from '../../components/feedback/InlineAlert'
import { LoadError } from '../../components/feedback/LoadError'
import type { LoadErrorKind } from '../../components/feedback/LoadError'
import { NotFound } from '@/components/shared/NotFound'
import { Skeleton, SkeletonRegion } from '../../components/feedback/Skeleton'
import { Spinner } from '../../components/feedback/Spinner'
import { NavGroup, NavRow, NavSection } from '../../components/shell/NavRow'
import { NotifReadAll, NotifRow } from '../../components/shell/NotifRow'
import { bellLabel, unreadCount } from '../../lib/notifications'
import type { Notification } from '../../lib/notifications'
import { useAcl } from '../../lib/use-acl'
import { useBusy } from '../../lib/use-busy'
import { useCopy } from '../../lib/use-copy'
import { useEscapeTopDialog } from '../../lib/use-escape-top-dialog'
import { useTheme } from '../../lib/use-theme'
import { ToastProvider } from '../../components/feedback/Toast'
import { useToast } from '../../lib/toast-context'
import { checkPassword, passwordOk } from '../../lib/password-policy'
import { ACCESS_LABEL, ACCESS_TONE, ROLE_HINT, ROLE_LABEL } from '../../labels'
import type { AppAccess, SystemRole } from '../../labels'
import { RoleChip } from '../staff/components/RoleChip'
import { StaffDetailDialog } from '../staff/components/StaffDetailDialog'
import { StaffFormDialog } from '../staff/components/StaffFormDialog'
import type { StaffFormValues } from '../staff/components/StaffFormDialog'
import { TempPasswordDialog } from '../staff/components/TempPasswordDialog'
import type { StaffOption, StaffRecord } from '../staff/staff-record'

const ACCESS_VALUES: AppAccess[] = ['ALLOWED', 'PENDING', 'REJECTED', 'BLOCKED', 'UNREGISTERED']
const ROLE_VALUES: SystemRole[] = ['SUPER_ADMIN', 'ADMIN', 'VIEWER']

const DOT = (
  <svg className="notif-glyph" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
  </svg>
)
const NAV_ICO = (
  <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z" />
  </svg>
)
const SEED_NOTIFS: Notification[] = [
  { id: 'n1', tone: 'amber', icon: DOT, title: 'มีคำขอลงทะเบียนใหม่ 3 รายการ', detail: 'รอการอนุมัติ', time: '2 นาทีที่แล้ว', read: false },
  { id: 'n2', tone: 'emerald', icon: DOT, title: 'อนุมัติผู้ใช้ สมชาย ใจดี แล้ว', time: '1 ชั่วโมงที่แล้ว', read: false },
  { id: 'n3', tone: 'slate', icon: DOT, title: 'ระบบสำรองข้อมูลเรียบร้อย', time: 'เมื่อวาน 23:00', read: true },
]

/**
 * Fixtures for เจ้าหน้าที่ระบบ's dialogs. The reserved and tombstone rows are both present on
 * purpose: they are the two cases `OptionList` exists to place correctly, and neither shows up in
 * a list of ordinary options.
 */
const SEED_POSITIONS: StaffOption[] = [
  { id: 1, name: 'ครู' },
  { id: 2, name: 'เจ้าหน้าที่ธุรการ' },
  { id: 3, name: 'ผู้ดูแลระบบ' },
  { id: 4, name: 'รองผู้อำนวยการ' },
  { id: 9, name: 'ผู้พัฒนาระบบ', reserved: true },
  { id: 99, name: 'ไม่พบตำแหน่ง', reserved: true, fallback: true },
]
const SEED_DEPARTMENTS: StaffOption[] = [
  { id: 1, name: 'ฝ่ายบริหารงานทั่วไป' },
  { id: 2, name: 'ฝ่ายวิชาการ' },
  { id: 3, name: 'ฝ่ายเทคโนโลยีสารสนเทศ' },
  { id: 98, name: 'ไม่พบกลุ่ม/ฝ่าย', reserved: true, fallback: true },
]

const STAFF_SEED: StaffRecord = {
  id: 'u101',
  email: 'cherd@easybook.local',
  firstName: 'เชิดศักดิ์',
  lastName: 'คำไล้',
  role: 'ADMIN',
  personnelRole: { id: 3, name: 'ผู้ดูแลระบบ' },
  department: { id: 3, name: 'ฝ่ายเทคโนโลยีสารสนเทศ' },
  phoneNumber: '081-234-5678',
  profilePictureUrl: null,
  isActive: true,
  mustChangePassword: false,
  lastLoginAt: '2026-08-11T09:42:00+07:00',
  createdAt: '2026-07-08T10:00:00+07:00',
  createdBy: { firstName: 'EasyBook', lastName: 'Administrator' },
}

const STAFF_FORM_SEED: StaffFormValues = {
  email: STAFF_SEED.email,
  firstName: STAFF_SEED.firstName,
  lastName: STAFF_SEED.lastName,
  personnelRoleId: 3,
  departmentId: 3,
  phoneNumber: STAFF_SEED.phoneNumber ?? '',
  role: 'ADMIN',
  isActive: true,
}

// VIEWER is the default, and that is a decision: the least privilege that still makes an account
// worth creating. A select that opens on the most powerful option grants it to whoever does not
// read it.
const STAFF_FORM_BLANK: StaffFormValues = {
  email: '',
  firstName: '',
  lastName: '',
  personnelRoleId: SEED_POSITIONS[0].id,
  departmentId: SEED_DEPARTMENTS[0].id,
  phoneNumber: '',
  role: 'VIEWER',
  isActive: true,
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="m-0 mb-2 text-[15px] font-semibold text-base-content/70 th-tight">{title}</h2>
      <div className="rounded-card border border-base-300/70 bg-base-100 p-4 shadow-e1">
        {children}
      </div>
    </section>
  )
}

/** Wraps the page so `useToast` has a provider — the real shell does this in P2. */
export function ShowcasePage() {
  return (
    <ToastProvider>
      <ShowcaseBody />
    </ToastProvider>
  )
}

function ShowcaseBody() {
  const [theme, setTheme] = useState<'easybook-admin' | 'easybook-admin-dark'>('easybook-admin')
  const [pw, setPw] = useState('')
  const [page, setPage] = useState(2)
  const [modal, setModal] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [alert, setAlert] = useState<string | null>('บันทึกไม่สำเร็จ — โปรดลองใหม่อีกครั้ง')
  const [errKind, setErrKind] = useState<LoadErrorKind>('server')
  const rules = checkPassword(pw, 'Current-1!')
  const toast = useToast()
  const { busy, run, buttonProps } = useBusy()
  const [role, setRole] = useState<SystemRole>('SUPER_ADMIN')
  const acl = useAcl(role)
  const themeCtl = useTheme()
  const copy = useCopy()
  const [notifs, setNotifs] = useState(SEED_NOTIFS)
  const [readAllSaid, setReadAllSaid] = useState('')
  const unread = unreadCount(notifs)
  const [navActive, setNavActive] = useState('การลงทะเบียน')
  const [staffDetail, setStaffDetail] = useState<'other' | 'self' | 'deleted' | null>(null)
  const [staffForm, setStaffForm] = useState<'create' | 'edit' | 'self' | null>(null)
  const [tempPw, setTempPw] = useState<'created' | 'reset' | null>(null)
  const notifListRef = useRef<HTMLDivElement>(null)
  useEscapeTopDialog()

  return (
    <div data-theme={theme} data-acl="super" className="min-h-screen bg-base-200 text-base-content">
      <div className="mx-auto w-full max-w-[900px] px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="m-0 text-[20px] font-semibold th-tight">P1 · component showcase</h1>
          <Btn
            variant="ghost"
            onClick={() =>
              setTheme((t) =>
                t === 'easybook-admin' ? 'easybook-admin-dark' : 'easybook-admin',
              )
            }
          >
            ธีม: {theme === 'easybook-admin' ? 'สว่าง' : 'มืด'}
          </Btn>
        </div>

        <Section title="Badge — 5 tones">
          <div className="flex flex-wrap gap-2">
            {ACCESS_VALUES.map((a) => (
              <Badge key={a} tone={ACCESS_TONE[a]}>
                {ACCESS_LABEL[a]}
              </Badge>
            ))}
          </div>
        </Section>

        <Section title="Btn — 6 variants, enabled and disabled">
          <div className="flex flex-wrap gap-2">
            <Btn variant="primary">บันทึก</Btn>
            <Btn variant="ghost">ยกเลิก</Btn>
            <Btn variant="danger">ลบบัญชี</Btn>
            <Btn variant="warn">ส่งคืน</Btn>
            <Btn variant="danger-solid">ยืนยันการลบ</Btn>
            <Btn variant="warn-solid">ยืนยันการส่งคืน</Btn>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Btn
              variant="primary"
              disabled
              className="disabled:cursor-not-allowed disabled:bg-base-200 disabled:text-base-content/70 disabled:hover:brightness-100"
            >
              ลองใหม่ใน 4:59
            </Btn>
            <IconBtn label="ดูรายละเอียด" tone="view">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </IconBtn>
            <IconBtn label="แก้ไข" tone="edit">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
            </IconBtn>
          </div>
        </Section>

        <Section title="Card · CardHead · CardBody · FieldRow · LinkRow">
          <Card>
            <CardHead
              title="ข้อมูลบัญชี"
              subtitle="ผู้ดูแลระบบเป็นผู้แก้ไขข้อมูลเหล่านี้"
              action={<Btn variant="ghost">แก้ไข</Btn>}
            />
            <CardBody>
              <FieldRow label="ชื่อ-นามสกุล">สมชาย ใจดี</FieldRow>
              <FieldRow label="อีเมล">spa@easybook.local</FieldRow>
              <FieldRow label="บทบาท">{ROLE_LABEL.SUPER_ADMIN}</FieldRow>
              <FieldRow label="เบอร์โทรศัพท์">02-123-4567 ต่อ 101</FieldRow>
            </CardBody>
          </Card>
          <Card className="mt-4">
            <CardHead title="ตั้งค่า" />
            <CardRows>
              <LinkRow title="เปลี่ยนรหัสผ่าน" detail="อัปเดตล่าสุด 12 ส.ค. 2569" />
              <LinkRow title="ข้อมูลเวอร์ชันระบบ" detail="0.1.0" />
            </CardRows>
          </Card>
        </Section>

        <Section title="FormField · SelectField — normal and error">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="อีเมล" type="email" placeholder="name@example.com" defaultValue="" />
            <FormField
              label="อีเมล (ผิดพลาด)"
              type="email"
              defaultValue="not-an-email"
              error="รูปแบบอีเมลไม่ถูกต้อง"
            />
            <SelectField label="บทบาท" defaultValue="ADMIN">
              {ROLE_VALUES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </SelectField>
            <SelectField label="บทบาท (ผิดพลาด)" error="กรุณาเลือกบทบาท" defaultValue="">
              <option value="">— เลือก —</option>
              {ROLE_VALUES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </SelectField>
          </div>
          <p className="mt-3 text-[13px] text-base-content/70 th-tight">{ROLE_HINT.VIEWER}</p>
        </Section>

        <Section title="PasswordField · PasswordRules — live">
          <PasswordField
            label="รหัสผ่านใหม่"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="new-password"
          />
          <PasswordRules state={rules} />
          <p className="mt-2 text-[13px] text-base-content/70">
            ผ่านทุกข้อ: {passwordOk(rules) ? 'ใช่' : 'ยัง'}
          </p>
        </Section>

        <Section title="Modal">
          <Btn variant="primary" onClick={() => setModal(true)}>
            เปิด modal
          </Btn>
          <Modal
            open={modal}
            onClose={() => setModal(false)}
            title="ข้อมูลการลงทะเบียน"
            footer={
              <>
                <Btn variant="ghost" onClick={() => setModal(false)}>
                  ปิด
                </Btn>
                <Btn variant="primary">อนุมัติ</Btn>
              </>
            }
          >
            <FieldRow label="ชื่อ">สมชาย ใจดี</FieldRow>
            <FieldRow label="สถานะ">
              <Badge tone={ACCESS_TONE.PENDING}>{ACCESS_LABEL.PENDING}</Badge>
            </FieldRow>
          </Modal>
        </Section>

        <Section title="Pagination">
          <Pagination page={page} pages={5} onGo={setPage} />
        </Section>

        <Section title="Toast — 3 kinds · error never expires">
          <div className="flex flex-wrap gap-2">
            <Btn variant="primary" onClick={() => toast('success', 'บันทึกข้อมูลเรียบร้อยแล้ว')}>
              success
            </Btn>
            <Btn variant="danger" onClick={() => toast('error', 'บันทึกไม่สำเร็จ — เซิร์ฟเวอร์ไม่ตอบสนอง')}>
              error
            </Btn>
            <Btn variant="ghost" onClick={() => toast('info', 'มีรายการใหม่ 3 รายการ')}>
              info
            </Btn>
          </div>
        </Section>

        <Section title="Spinner · useBusy — label must not change while busy">
          <div className="flex flex-wrap items-center gap-3">
            <Btn
              variant="primary"
              {...buttonProps('กำลังบันทึก')}
              onClick={() => void run(() => new Promise((r) => setTimeout(r, 1600)))}
            >
              {busy ? (
                <Spinner />
              ) : (
                <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
              บันทึก
            </Btn>
            <Spinner size="lg" label="กำลังโหลด" />
          </div>
        </Section>

        <Section title="InlineAlert · InlineNote — alert stays in the DOM when empty">
          <InlineAlert message={alert} />
          <InlineNote>ผู้ดูแลระบบเป็นผู้แก้ไขชื่อและเบอร์โทรศัพท์ของคุณ</InlineNote>
          <div className="mt-3">
            <Btn variant="ghost" onClick={() => setAlert((a) => (a ? null : 'บันทึกไม่สำเร็จ — โปรดลองใหม่อีกครั้ง'))}>
              สลับ alert
            </Btn>
          </div>
        </Section>

        <Section title="Skeleton">
          <SkeletonRegion label="กำลังโหลดข้อมูลการลงทะเบียน" className="flex items-center gap-3">
            <Skeleton variant="box" className="h-11 w-11 shrink-0" />
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton width="45%" className="h-3.5" />
              <Skeleton variant="soft" width="70%" className="h-3" />
            </span>
          </SkeletonRegion>
        </Section>

        <Section title="EmptyState">
          <EmptyState
            icon={
              <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z" />
              </svg>
            }
            title="ไม่พบข้อมูลการลงทะเบียน"
            description="ยังไม่มีผู้ใช้ที่ตรงกับเงื่อนไขที่เลือก ลองล้างตัวกรอง หรือรอผู้ใช้ลงทะเบียนผ่าน LINE"
            actions={<Btn variant="primary">รีเฟรชข้อมูล</Btn>}
          />
        </Section>

        <Section title="LoadError — retry exists only where retrying can change the answer">
          <div className="mb-3 flex flex-wrap gap-2">
            {(['network', 'server', 'forbidden'] as LoadErrorKind[]).map((k) => (
              <Btn key={k} variant={errKind === k ? 'primary' : 'ghost'} onClick={() => setErrKind(k)}>
                {k}
              </Btn>
            ))}
          </div>
          <LoadError kind={errKind} />
        </Section>

        <Section title="ConfirmModal — shows the diff, not just a yes/no">
          <Btn variant="danger" onClick={() => setConfirm(true)}>
            ระงับการใช้งาน
          </Btn>
          <ConfirmModal
            open={confirm}
            onClose={() => setConfirm(false)}
            onConfirm={() => new Promise((r) => setTimeout(r, 1200))}
            tone="danger"
            title="ยืนยันการระงับการใช้งาน"
            who="สมชาย ใจดี"
            description="ผู้ใช้รายนี้จะเข้าใช้งานระบบผ่าน LINE ไม่ได้จนกว่าจะถูกปลดระงับ"
            confirmLabel="ยืนยันการระงับ"
            busyLabel="กำลังระงับ"
            diff={[{ label: 'สถานะ', from: 'อนุมัติแล้ว', to: 'ถูกระงับการใช้งาน' }]}
            reason={{ label: 'เหตุผลการระงับ', hint: 'บันทึกในประวัติระบบ ผู้ใช้ไม่เห็นข้อความนี้', required: true }}
          />
        </Section>

        {/* ── เจ้าหน้าที่ระบบ's three dialogs ──
            Built ahead of their page (PO, 18 ส.ค. 2569: whatever is a component gets built first).
            They live in `pages/staff/components/` because that is where their page will own them,
            and they are rendered HERE because P1's own rule stands: a component that has never
            been rendered has never been checked. This section is how they get measured against
            the prototype before anything depends on them. */}
        <Section title="StaffDetailDialog — read-only, every role opens it">
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => setStaffDetail('other')}>บัญชีคนอื่น (SUPER_ADMIN)</Btn>
            <Btn onClick={() => setStaffDetail('self')}>บัญชีของคุณเอง</Btn>
            <Btn onClick={() => setStaffDetail('deleted')}>บัญชีที่ถูกลบแล้ว</Btn>
          </div>
          <StaffDetailDialog
            open={staffDetail !== null}
            onClose={() => setStaffDetail(null)}
            record={
              staffDetail === 'deleted' ? { ...STAFF_SEED, deleted: true } : STAFF_SEED
            }
            self={staffDetail === 'self'}
            canManage
            canManageRow={staffDetail !== 'deleted'}
            onManage={() => setStaffDetail(null)}
            onRestore={() => setStaffDetail(null)}
            onGoToProfile={() => setStaffDetail(null)}
          />
        </Section>

        <Section title="StaffFormDialog — create, manage, and manage-your-own">
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => setStaffForm('create')}>เพิ่มบัญชี</Btn>
            <Btn onClick={() => setStaffForm('edit')}>จัดการบัญชี</Btn>
            <Btn onClick={() => setStaffForm('self')}>จัดการบัญชีของคุณ</Btn>
          </div>
          <StaffFormDialog
            open={staffForm !== null}
            onClose={() => setStaffForm(null)}
            mode={staffForm === 'create' ? 'create' : 'edit'}
            self={staffForm === 'self'}
            initial={staffForm === 'create' ? STAFF_FORM_BLANK : STAFF_FORM_SEED}
            positions={SEED_POSITIONS}
            departments={SEED_DEPARTMENTS}
            currentState="active"
            onSubmit={(_v, d) =>
              toast('success', d.length ? `จะบันทึก ${d.length} รายการ` : 'ไม่มีการเปลี่ยนแปลง')
            }
            onResetPassword={() => setTempPw('reset')}
            onDelete={() => toast('error', 'ลบบัญชี (ตัวอย่าง)')}
          />
        </Section>

        <Section title="TempPasswordDialog — shown once, and refuses every casual dismissal">
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => setTempPw('created')}>หลังสร้างบัญชี</Btn>
            <Btn onClick={() => setTempPw('reset')}>หลังรีเซ็ตรหัสผ่าน</Btn>
          </div>
          <TempPasswordDialog
            open={tempPw !== null}
            onClose={() => setTempPw(null)}
            kind={tempPw === 'reset' ? 'reset' : 'created'}
            name="เชิดศักดิ์ คำไล้"
            email="cherd@easybook.local"
            password="Kp7Rn2Tq9Wx4Yb6C"
          />
        </Section>

        <Section title="RoleChip — outlined, so it never competes with a status badge">
          <div className="flex flex-wrap items-center gap-2">
            <RoleChip role="SUPER_ADMIN" />
            <RoleChip role="ADMIN" />
            <RoleChip role="VIEWER" />
          </div>
        </Section>

        <Section title="ComingSoon — the designed state of 24 destinations">
          <ComingSoon onBack={() => {}} homeTo="/backend/dashboard" />
        </Section>

        <Section title="useAcl — hides affordances, never enforces">
          <div className="mb-3 flex flex-wrap gap-2">
            {ROLE_VALUES.map((r) => (
              <Btn key={r} variant={role === r ? 'primary' : 'ghost'} onClick={() => setRole(r)}>
                {ROLE_LABEL[r]}
              </Btn>
            ))}
          </div>
          <div className="grid gap-1 text-[14px]" data-acl-out>
            <p className="m-0">write: <b>{String(acl.write)}</b></p>
            <p className="m-0">หัวข้อคอลัมน์: <b>{acl.actionsColumnLabel}</b></p>
            <p className="m-0">เห็น ตำแหน่งบุคลากร: <b data-can-options>{String(acl.can('ตำแหน่งบุคลากร'))}</b></p>
            <p className="m-0">เห็น เจ้าหน้าที่ระบบ: <b data-can-staff>{String(acl.can('เจ้าหน้าที่ระบบ'))}</b></p>
          </div>
        </Section>

        <Section title="useTheme — persists the CHOICE, not the colour">
          <div className="mb-3 flex flex-wrap gap-2">
            {(['light', 'dark', 'system'] as const).map((c) => (
              <Btn key={c} variant={themeCtl.choice === c ? 'primary' : 'ghost'} onClick={() => themeCtl.setTheme(c)}>
                {c}
              </Btn>
            ))}
          </div>
          <p className="m-0 text-[14px]">
            choice <b data-theme-choice>{themeCtl.choice}</b> → resolved <b data-theme-resolved>{themeCtl.resolved}</b>
          </p>
        </Section>

        <Section title="useCopy — three tiers, the third always works">
          <p ref={copy.ref as React.RefObject<HTMLParagraphElement>} className="m-0 mb-2 rounded-control bg-base-200 px-3 py-2 font-mono text-[14px]">
            Tmp-9xKq7wRn2LbV
          </p>
          <Btn variant="ghost" onClick={() => void copy.copy()}>{copy.label}</Btn>
          <p role="status" className="mt-2 text-[13px] text-base-content/70" data-copy-say>{copy.announcement}</p>
        </Section>

        <Section title="NavRow · NavGroup · NavSection">
          <nav className="max-w-[264px]" aria-label="ตัวอย่างเมนู">
            <NavRow icon={NAV_ICO} label="ภาพรวมระบบ" active={navActive === 'ภาพรวมระบบ'} onSelect={() => setNavActive('ภาพรวมระบบ')} />
            <NavSection>การบริหารจัดการ</NavSection>
            <NavRow icon={NAV_ICO} label="การลงทะเบียน" count={12} alert active={navActive === 'การลงทะเบียน'} onSelect={() => setNavActive('การลงทะเบียน')} />
            <NavRow icon={NAV_ICO} label="เจ้าหน้าที่ระบบ" count={0} active={navActive === 'เจ้าหน้าที่ระบบ'} onSelect={() => setNavActive('เจ้าหน้าที่ระบบ')} />
            <NavSection>การตั้งค่า</NavSection>
            <NavGroup icon={NAV_ICO} label="การตั้งค่าระบบ" defaultOpen>
              {(['ระบบการจอง', 'ประเภทสถานที่', 'ตำแหน่งบุคลากร'] as const).filter((l) => acl.can(l)).map((l) => (
                <NavRow key={l} label={l} sub active={navActive === l} onSelect={() => setNavActive(l)} />
              ))}
            </NavGroup>
          </nav>
        </Section>

        <Section title="NotifRow — one source for the count">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[14px]" data-bell-label={bellLabel(unread)}>
              badge: <b data-notif-badge>{unread === 0 ? '—' : unread > 9 ? '9+' : unread}</b>
            </span>
            {/* Rendered VISIBLY here, `sr-only` in the real panel — the showcase's job is to
                make the invisible half reviewable. */}
            <span role="status" className="text-[13px] text-base-content/70">
              {readAllSaid}
            </span>
            <NotifReadAll count={unread} listRef={notifListRef} onAnnounce={setReadAllSaid} onReadAll={() => setNotifs((l) => l.map((n) => ({ ...n, read: true })))} />
          </div>
          <div ref={notifListRef} className="overflow-hidden rounded-control border border-base-300">
            {notifs.map((n) => (
              <NotifRow key={n.id} item={n} onRead={(id) => setNotifs((l) => l.map((x) => (x.id === id ? { ...x, read: true } : x)))} />
            ))}
          </div>
        </Section>

        <Section title="NotFound — shell variant">
          <NotFound variant="shell" path="/backend/reports/room-usage-2568" onBack={() => {}} homeTo="/backend/dashboard" />
        </Section>
      </div>
    </div>
  )
}
