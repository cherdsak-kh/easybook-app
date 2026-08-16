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

import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Btn, IconBtn } from '../../components/ui/Btn'
import { Card, CardBody, CardHead, CardRows } from '../../components/ui/Card'
import { FieldRow, LinkRow } from '../../components/ui/FieldRow'
import { FormField, SelectField } from '../../components/ui/FormField'
import { Modal } from '../../components/ui/Modal'
import { Pagination } from '../../components/ui/Pagination'
import { PasswordField } from '../../components/ui/PasswordField'
import { PasswordRules } from '../../components/ui/PasswordRules'
import { checkPassword, passwordOk } from '../../lib/password-policy'
import { ACCESS_LABEL, ACCESS_TONE, ROLE_HINT, ROLE_LABEL } from '../../labels'
import type { AppAccess, SystemRole } from '../../labels'

const ACCESS_VALUES: AppAccess[] = ['ALLOWED', 'PENDING', 'REJECTED', 'BLOCKED', 'UNREGISTERED']
const ROLE_VALUES: SystemRole[] = ['SUPER_ADMIN', 'ADMIN', 'VIEWER']

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

export function ShowcasePage() {
  const [theme, setTheme] = useState<'easybook-admin' | 'easybook-admin-dark'>('easybook-admin')
  const [pw, setPw] = useState('')
  const [page, setPage] = useState(2)
  const [modal, setModal] = useState(false)
  const rules = checkPassword(pw, 'Current-1!')

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
      </div>
    </div>
  )
}
