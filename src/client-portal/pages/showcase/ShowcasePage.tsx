import { useState } from 'react'
import type { ReactNode } from 'react'

import { Breadcrumbs } from '@/client-portal/components/ui/Breadcrumbs'
import { Combobox } from '@/client-portal/components/ui/Combobox'
import { Dropdown } from '@/client-portal/components/ui/Dropdown'
import { SCREEN_WIDTH, ScreenHeader } from '@/client-portal/components/ui/ScreenHeader'
import { EmptyState } from '@/client-portal/components/feedback/EmptyState'
import { Skeleton, SkeletonSwap } from '@/client-portal/components/feedback/Skeleton'
import { StatusCard } from '@/client-portal/components/feedback/StatusCard'
import { ToastProvider } from '@/client-portal/components/feedback/Toast'
import { useToast } from '@/client-portal/components/feedback/toast-context'
import { UnderConstruction } from '@/client-portal/components/feedback/UnderConstruction'
import { Dock } from '@/client-portal/components/shell/Dock'
import { DockItem } from '@/client-portal/components/shell/DockItem'
import { NavScrim } from '@/client-portal/components/shell/NavScrim'
import { LIcon } from '@/client-portal/icons/LucideIcon'
import { RXIcon } from '@/client-portal/icons/RemixIcon'
import { VIcon } from '@/client-portal/icons/VenueIcon'
import {
  fmtD,
  fmtDDow,
  fmtDLong,
  fmtDShort,
  fmtSlot,
  fmtT,
  fmtTe,
} from '@/client-portal/lib/formatters'

/**
 * PHASE 1 SCAFFOLDING — the client portal's component showcase, and the ONLY way these
 * components get verified at all.
 *
 * The PO's ruling for this build is "measure in the browser, write no UI component unit tests"
 * (`CONVENTIONS.md` §2). That trades regression safety for the thing browser measurement is
 * actually good at — contrast, tap targets, overflow, both themes — so this page exists to make
 * all of it measurable in one place, at 390px and at 820px, without a screen having been built
 * yet. It is deleted, or folded into a real screen, when the portal no longer needs it.
 *
 * ── 🔴 THE CONTROL PROBE IS THE LINE BUTTON, AND IT IS SUPPOSED TO FAIL ──
 * Every contrast sweep run against this page must flag `.btn-line`: white on `#06C755` measures
 * **2.26:1**, a deliberate one-button brand exception under `D-C17`. A sweep that reports zero
 * failures here has measured nothing — that result is a statement about the tool, not about the
 * page. Nothing else on this page may fail.
 *
 * ⚠️ BEFORE READING ANY COLOUR, run `document.getAnimations().forEach(a => a.finish())`. daisyUI's
 * `.btn` transition otherwise returns a fake 1.00 immediately after a theme switch.
 *
 * ⚠️ It stamps its own `data-theme` so the sweep can be run twice without a reload, which is the
 * same reason the admin showcase sits outside any theme layout.
 */

const OPTIONS = [
  { value: '1', label: 'ครูผู้สอน' },
  { value: '2', label: 'ครูพี่เลี้ยง' },
  { value: '3', label: 'เจ้าหน้าที่ธุรการ' },
  { value: '4', label: 'นักการภารโรง' },
  { value: '5', label: 'รองผู้อำนวยการ' },
]

const DEPTS = [
  { value: '1', label: 'กลุ่มบริหารงานวิชาการ' },
  { value: '2', label: 'กลุ่มบริหารงานงบประมาณ' },
  { value: '3', label: 'กลุ่มบริหารงานบุคคล' },
  { value: '4', label: 'กลุ่มบริหารงานทั่วไป' },
  { value: '5', label: 'ฝ่ายปฐมวัย' },
]

/** A labelled block, so the page reads as a checklist rather than as a pile of widgets. */
function Section({
  title,
  note,
  children,
}: {
  title: string
  note?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold tracking-wide text-base-content/60 uppercase">
        {title}
      </h2>
      {note ? <p className="mt-1 text-xs text-base-content/60">{note}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  )
}

/**
 * A viewport-sized component (`StatusCard` is `min-h-dvh`) shown inside a bounded, scrollable
 * frame, so seven of them do not turn this page into seven screens of scrolling. The component
 * itself is unmodified — the frame is around it, never inside it.
 */
function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="h-[380px] overflow-y-auto rounded-box border border-base-300 bg-base-200">
      {children}
    </div>
  )
}

const ALERT_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-7 w-7">
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" d="M12 7.5v5" />
    <path strokeLinecap="round" d="M12 16.25h.01" />
  </svg>
)

const CLOCK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-7 w-7">
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" d="M12 7v5l3 2" />
  </svg>
)

/** Fires each toast kind through the real provider, rather than rendering a frozen stack. */
function ToastButtons() {
  const toast = useToast()
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="btn btn-app-sm btn-outline"
        onClick={() => toast('บันทึกข้อมูลเรียบร้อยแล้ว', 'success')}
      >
        success
      </button>
      <button
        type="button"
        className="btn btn-app-sm btn-outline"
        onClick={() => toast('คำขอของคุณอยู่ระหว่างการพิจารณา', 'info')}
      >
        info
      </button>
      <button
        type="button"
        className="btn btn-app-sm btn-outline"
        onClick={() => toast('ช่วงเวลานี้ใกล้ถึงกำหนดยกเลิกแล้ว', 'warning')}
      >
        warning
      </button>
      <button
        type="button"
        className="btn btn-app-sm btn-outline"
        onClick={() => toast('คำขอถูกปฏิเสธ เนื่องจากช่วงเวลาซ้อนทับกับคำขอที่อนุมัติแล้ว', 'error')}
      >
        error
      </button>
    </div>
  )
}

function ShowcaseBody() {
  const [dark, setDark] = useState(false)
  const [role, setRole] = useState('')
  const [dept, setDept] = useState('3')
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const later = new Date(now.getTime() + 3 * 60 * 60 * 1000)
  const midnightEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0)

  return (
    <div
      data-theme={dark ? 'easybook-client-dark' : 'easybook-client'}
      className="pad-nav min-h-dvh bg-base-200 text-base-content"
    >
      <ScreenHeader
        title="Client Portal · component showcase"
        subtitle="ทุกคอมโพเนนต์ที่ใช้ร่วมกันตั้งแต่สองจอขึ้นไป · วัดคอนทราสต์และขนาดเป้าที่ 390px และ 820px"
        action={
          <button
            type="button"
            onClick={() => setDark((d) => !d)}
            aria-pressed={dark}
            className="btn btn-app-sm btn-outline min-h-11 gap-2"
          >
            <LIcon name={dark ? 'moon' : 'sun'} className="h-4 w-4" />
            {dark ? 'มืด' : 'สว่าง'}
          </button>
        }
      />

      <div className={`${SCREEN_WIDTH} pt-4`}>
        <div role="note" className="alert alert-warning text-sm">
          <LIcon name="triangleAlert" className="h-5 w-5 shrink-0" />
          <span>
            <strong>Control probe:</strong> the LINE sign-in button below is{' '}
            <strong>meant to fail</strong> the contrast sweep at 2.26:1 (`D-C17`). If a sweep of
            this page reports zero failures, the sweep is broken — not the page.
          </span>
        </div>

        {/* ── ScreenHeader, second form ─────────────────────────────────────── */}
        <Section
          title="ScreenHeader · two-tier (breadcrumbs)"
          note="Rendered non-sticky inside a frame; the live sticky one is at the top of this page."
        >
          <div className="overflow-hidden rounded-box border border-base-300">
            <ScreenHeader
              title="รายละเอียดคำขอจอง"
              breadcrumbs={[
                { label: 'การจองของฉัน', to: '/bookings' },
                { label: 'BR-25690902-01' },
              ]}
            />
          </div>
        </Section>

        <Section title="Breadcrumbs · standalone">
          <div className="rounded-box border border-base-300 bg-base-100 p-4">
            <Breadcrumbs
              trail={[
                { label: 'ตั้งค่า', to: '/settings' },
                { label: 'คู่มือการใช้งาน', to: '/manual' },
                { label: 'การจองสถานที่' },
              ]}
              className="text-xs text-base-content/60"
            />
          </div>
        </Section>

        {/* ── Buttons, including the control probe ──────────────────────────── */}
        <Section
          title="Buttons · .btn-app / .btn-app-sm / disabled / .btn-line"
          note="48px and 36px, 16px/500 text — the two daisyUI overrides. Disabled has ONE look for every colour."
        >
          <div className="flex flex-wrap gap-2 rounded-box border border-base-300 bg-base-100 p-4">
            <button type="button" className="btn btn-app btn-primary">
              ยืนยันการลงทะเบียน
            </button>
            <button type="button" className="btn btn-app btn-outline">
              ยกเลิก
            </button>
            <button type="button" className="btn btn-app btn-error">
              ยืนยันยกเลิก
            </button>
            <button type="button" disabled className="btn btn-app btn-primary">
              ปิดใช้งาน (primary)
            </button>
            <button type="button" disabled className="btn btn-app btn-neutral">
              ปิดใช้งาน (neutral)
            </button>
            <button type="button" className="btn btn-app-sm btn-ghost">
              ล้างตัวกรองทั้งหมด
            </button>
            {/* 🔴 THE CONTROL PROBE. The only place `#06C755` is allowed, and the only element on
                this page that is expected to fail AA. */}
            <button type="button" className="btn btn-app btn-line w-full gap-2">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-5 w-5">
                <path d="M12 3.5C6.9 3.5 2.75 6.86 2.75 11c0 3.71 3.29 6.82 7.74 7.41.3.06.71.2.82.46.09.24.06.6.03.85l-.13.79c-.04.24-.19.93.82.51 1.02-.42 5.46-3.22 7.45-5.51C20.86 14.05 21.5 12.6 21.5 11c0-4.14-4.15-7.5-9.5-7.5z" />
              </svg>
              เข้าสู่ระบบด้วย LINE
            </button>
          </div>
        </Section>

        {/* ── Combobox ──────────────────────────────────────────────────────── */}
        <Section
          title="Combobox · empty / filled / error / disabled"
          note="Opens the bottom sheet — the one documented exception to “dialogs are always centred”. Try: type to filter, ↑/↓ to walk, Enter to pick, Esc to close."
        >
          <div className="space-y-4 rounded-box border border-base-300 bg-base-100 p-4">
            <Combobox
              id="sc-role"
              label="ตำแหน่ง"
              placeholder="เลือกตำแหน่ง"
              options={OPTIONS}
              value={role}
              onChange={setRole}
            />
            <Combobox
              id="sc-dept"
              label="กลุ่ม/ฝ่าย"
              placeholder="เลือกกลุ่ม/ฝ่าย"
              options={DEPTS}
              value={dept}
              onChange={setDept}
            />
            <Combobox
              id="sc-err"
              label="ตำแหน่ง (สถานะผิดพลาด)"
              placeholder="เลือกตำแหน่ง"
              options={OPTIONS}
              value=""
              onChange={() => {}}
              error="กรุณาเลือกตำแหน่ง"
            />
            <Combobox
              id="sc-dis"
              label="ตำแหน่ง (ปิดใช้งาน)"
              placeholder="เลือกตำแหน่ง"
              options={OPTIONS}
              value=""
              onChange={() => {}}
              disabled
            />
          </div>
        </Section>

        {/* ── Dropdown ──────────────────────────────────────────────────────── */}
        <Section
          title="Dropdown · one document listener for all menus"
          note="Open both, then click outside — both close. Press Escape — both close and focus returns to the summary. The accordion below must NOT collapse."
        >
          <div className="flex flex-wrap items-start gap-3 rounded-box border border-base-300 bg-base-100 p-4">
            {/* The trigger's contents are the CALLER's, and this is the prototype's own pattern
                (898–902): below `sm` the control is genuinely icon-only at 48 × 48, with the
                label carried by `sr-only` so the accessible name never shrinks with the layout;
                at `sm` and up the words and the caret appear. */}
            <Dropdown
              label="กรองตามประเภทสถานที่"
              trigger={
                <>
                  <LIcon name="slidersHorizontal" className="h-5 w-5 shrink-0" />
                  <span className="sr-only text-sm font-medium sm:not-sr-only">ทุกประเภท</span>
                  <LIcon name="chevronDown" className="hidden h-4 w-4 shrink-0 opacity-60 sm:block" />
                </>
              }
            >
              <li>
                <button type="button">ทั้งหมด</button>
              </li>
              <li>
                <button type="button">ห้องประชุม</button>
              </li>
              <li>
                <button type="button">โรงยิม</button>
              </li>
            </Dropdown>

            <Dropdown
              label="เรียงลำดับ"
              trigger={
                <>
                  <LIcon name="arrowUpDown" className="h-5 w-5 shrink-0" />
                  <span className="sr-only text-sm font-medium sm:not-sr-only">ใหม่ที่สุด</span>
                  <LIcon name="chevronDown" className="hidden h-4 w-4 shrink-0 opacity-60 sm:block" />
                </>
              }
            >
              <li>
                <button type="button">ใหม่ที่สุด</button>
              </li>
              <li>
                <button type="button">เก่าที่สุด</button>
              </li>
            </Dropdown>

            {/* The regression guard: a content accordion that must survive an outside click. */}
            <details className="collapse-arrow collapse w-full border border-base-300 bg-base-200">
              <summary className="collapse-title text-sm font-medium">
                &lt;details class=&quot;collapse&quot;&gt; — must stay open
              </summary>
              <div className="collapse-content text-xs text-base-content/70">
                หีบเพลงของเนื้อหา ไม่ใช่เมนูลอย — การกดที่อื่นต้องไม่ทำให้สิ่งที่ผู้ใช้ตั้งใจเปิดหุบลง
              </div>
            </details>
          </div>
        </Section>

        {/* ── Skeleton ──────────────────────────────────────────────────────── */}
        <Section
          title="Skeleton + SkeletonSwap"
          note="The placeholder must be the same height as the real content, or the page jumps at the moment the skeleton was there to prevent it."
        >
          <div className="rounded-box border border-base-300 bg-base-100 p-4">
            <button
              type="button"
              onClick={() => setLoading((v) => !v)}
              className="btn btn-app-sm btn-outline mb-3"
            >
              {loading ? 'แสดงข้อมูลจริง' : 'แสดงโครงร่าง'}
            </button>
            <SkeletonSwap
              loading={loading}
              skeleton={
                <div className="space-y-3">
                  <Skeleton className="h-4 w-44" />
                  <div className="rounded-box border border-base-300 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </div>
                    <Skeleton className="mt-4 h-5 w-2/3" />
                    <Skeleton className="mt-4 h-4 w-1/2" />
                    <Skeleton className="mt-2 h-4 w-2/5" />
                  </div>
                </div>
              }
            >
              <div className="space-y-3">
                <p className="h-4 text-sm text-base-content/60">{fmtDLong(now)}</p>
                <div className="rounded-box border border-base-300 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="h-5 font-medium">หอประชุมวารณ</p>
                    <span className="badge badge-ghost badge-sm h-5">อนุมัติแล้ว</span>
                  </div>
                  <p className="mt-4 h-5">ประชุมครูประจำเดือน</p>
                  <p className="mt-4 h-4 text-sm text-base-content/70">{fmtSlot(now, later)}</p>
                  <p className="mt-2 h-4 text-sm text-base-content/70">ผู้เข้าร่วม 120 คน</p>
                </div>
              </div>
            </SkeletonSwap>
          </div>
        </Section>

        {/* ── Toast ─────────────────────────────────────────────────────────── */}
        <Section
          title="Toast · four kinds, 7s, top-centre"
          note="Assertive live region, because a real-time approval changes what the reader was about to do."
        >
          <div className="rounded-box border border-base-300 bg-base-100 p-4">
            <ToastButtons />
          </div>
        </Section>

        {/* ── EmptyState ────────────────────────────────────────────────────── */}
        <Section
          title="EmptyState · invitation vs dead end vs compact"
          note="Two different messages, not one with different words: nothing yet invites; nothing matched needs a way out."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <EmptyState
              icon={<LIcon name="calendarCheck2" className="h-7 w-7" />}
              title="ยังไม่มีคำขอใช้สถานที่"
              description="เมื่อคุณยื่นคำขอแล้ว รายการจะมาอยู่ที่นี่"
              action={
                <button type="button" className="btn btn-app btn-primary gap-2">
                  <LIcon name="plus" className="h-[18px] w-[18px]" />
                  เริ่มต้นจองสถานที่
                </button>
              }
            />
            <EmptyState
              icon={<LIcon name="building2" className="h-7 w-7" />}
              title="ไม่พบสถานที่ที่ตรงกับเงื่อนไข"
              description="ลองเปลี่ยนคำค้นหา หรือเลือกประเภทสถานที่อื่น"
              action={
                <button type="button" className="btn btn-app btn-outline">
                  ล้างตัวกรองทั้งหมด
                </button>
              }
            />
            <EmptyState
              compact
              icon={<LIcon name="calendarCheck2" className="h-5 w-5" />}
              title="ไม่มีรายการจองในวันนี้"
              description="พร้อมให้คุณยื่นคำขอจองใช้งานได้ทันที"
            />
          </div>
        </Section>

        {/* ── UnderConstruction ─────────────────────────────────────────────── */}
        <Section title="UnderConstruction · #/issues, #/manual, #/rules">
          <UnderConstruction />
        </Section>

        {/* ── StatusCard ────────────────────────────────────────────────────── */}
        <Section
          title="StatusCard · the seven gate and outcome screens"
          note="Each frame scrolls; the card itself is unmodified and still centres in a full viewport."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Frame>
              <StatusCard
                announce
                tone="error"
                icon={ALERT_ICON}
                title="ตรวจสอบไม่สำเร็จ"
                description="ไม่สามารถเชื่อมต่อกับระบบได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง"
                actions={
                  <button type="button" className="btn btn-app btn-outline w-full">
                    ลองใหม่อีกครั้ง
                  </button>
                }
              />
            </Frame>
            <Frame>
              <StatusCard
                tone="warning"
                icon={CLOCK_ICON}
                title="รอการอนุมัติลงทะเบียน"
                description="ขอบคุณ สมชาย ระบบได้รับข้อมูลการลงทะเบียนของคุณแล้ว โปรดรอเจ้าหน้าที่พิจารณาอนุมัติสิทธิ์การเข้าใช้งาน"
                actions={
                  <button type="button" className="btn btn-app btn-outline w-full">
                    แก้ไขข้อมูลลงทะเบียน
                  </button>
                }
              />
            </Frame>
            <Frame>
              <StatusCard
                tone="warning"
                icon={ALERT_ICON}
                title="ข้อมูลการลงทะเบียนไม่ถูกต้อง"
                description="คุณ สมชาย กรุณาตรวจสอบรายละเอียดด้านล่างนี้ และแก้ไขข้อมูลเพื่อส่งคำขออนุมัติใหม่อีกครั้ง"
                actions={
                  <button type="button" className="btn btn-app btn-primary w-full">
                    แก้ไขข้อมูลการลงทะเบียน
                  </button>
                }
              >
                <div className="mt-6 rounded-box border border-base-300 bg-base-200 p-4 text-start">
                  <h2 className="text-xs font-semibold tracking-wide text-base-content/60">
                    เหตุผลจากเจ้าหน้าที่
                  </h2>
                  <p className="mt-1.5 font-medium whitespace-pre-line">
                    เบอร์โทรศัพท์ที่กรอกไม่สามารถติดต่อได้ กรุณาตรวจสอบและกรอกใหม่อีกครั้ง
                  </p>
                </div>
              </StatusCard>
            </Frame>
            <Frame>
              {/* The one terminal state: no action at all, on purpose. */}
              <StatusCard
                announce
                tone="error"
                icon={
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    className="h-7 w-7"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path strokeLinecap="round" d="m5.6 5.6 12.8 12.8" />
                  </svg>
                }
                title="บัญชีของคุณถูกระงับการใช้งาน"
                description="ขออภัยในความไม่สะดวก บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อเจ้าหน้าที่เพื่อตรวจสอบข้อมูล"
              />
            </Frame>
          </div>
        </Section>

        {/* ── The sent-confirmation animation ───────────────────────────────── */}
        <Section
          title=".sent-pop / .sent-draw"
          note="Motion is ADDED for devices that did not ask to reduce it — the default state is still. The mark is equally legible either way."
        >
          <div className="grid place-items-center rounded-box border border-base-300 bg-base-100 p-8">
            <span className="sent-pop flex h-16 w-16 items-center justify-center rounded-full bg-success text-success-content">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-8 w-8"
              >
                <path className="sent-draw" strokeDasharray="24" d="M4 12.5l5 5L20 6.5" />
              </svg>
            </span>
          </div>
        </Section>

        {/* ── Icon registries ───────────────────────────────────────────────── */}
        <Section
          title="Icon registries · VICON (heroicons, imported from admin) · LICON (lucide) · RXICON (remix)"
          note="Three registries, never mixed: mapPin/users/image here are lucide twins of VICON's pin/people/photo and must never substitute for them."
        >
          <div className="space-y-4 rounded-box border border-base-300 bg-base-100 p-4">
            <div>
              <p className="mb-2 text-xs font-medium text-base-content/60">
                VICON — re-exported from the admin VenueCard, not copied
              </p>
              <div className="flex flex-wrap gap-4">
                {(['photo', 'photoDetailed', 'closed', 'people'] as const).map((n) => (
                  <VIcon key={n} names={n} className="h-6 w-6" />
                ))}
                <VIcon names={['pin', 'pinOuter']} className="h-6 w-6" />
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-base-content/60">LICON — lucide 1.37.0</p>
              <div className="flex flex-wrap gap-4">
                {(
                  [
                    'house', 'building2', 'calendarCheck', 'settings', 'circleDot', 'flag',
                    'clock', 'calendarPlus', 'circleCheck', 'triangleAlert', 'circleX',
                    'circleAlert', 'calendar', 'calendarRange', 'calendarDays', 'user', 'sun',
                    'moon', 'monitor', 'bookOpen', 'fileText', 'info', 'history', 'chevronLeft',
                    'chevronRight', 'plus', 'slidersHorizontal', 'chevronDown', 'phone', 'hammer',
                    'x', 'arrowUpDown', 'repeat', 'calendarCheck2', 'mapPin', 'users', 'image',
                  ] as const
                ).map((n) => (
                  <LIcon key={n} name={n} className="h-6 w-6" />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-base-content/60">
                RXICON — the enter/leave pair; the wall is on the right in both
              </p>
              <div className="flex flex-wrap gap-4">
                <RXIcon name="enter" className="h-6 w-6" />
                <RXIcon name="leave" className="h-6 w-6" />
              </div>
            </div>
          </div>
        </Section>

        {/* ── Formatters ────────────────────────────────────────────────────── */}
        <Section
          title="Thai formatters · Buddhist Era throughout"
          note="fmtTe prints 24:00 for a span that ENDS at midnight — 08:00–00:00 reads as zero length or as an end before its start."
        >
          <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100 p-4">
            <table className="table-sm table">
              <tbody>
                <tr>
                  <td className="font-mono text-xs">fmtD</td>
                  <td>{fmtD(now)}</td>
                </tr>
                <tr>
                  <td className="font-mono text-xs">fmtDShort</td>
                  <td>{fmtDShort(now)}</td>
                </tr>
                <tr>
                  <td className="font-mono text-xs">fmtDLong</td>
                  <td>{fmtDLong(now)}</td>
                </tr>
                <tr>
                  <td className="font-mono text-xs">fmtDDow</td>
                  <td>{fmtDDow(now)}</td>
                </tr>
                <tr>
                  <td className="font-mono text-xs">fmtT</td>
                  <td>{fmtT(now)}</td>
                </tr>
                <tr>
                  <td className="font-mono text-xs">fmtTe (midnight)</td>
                  <td>{fmtTe(midnightEnd)}</td>
                </tr>
                <tr>
                  <td className="font-mono text-xs">fmtSlot (same day)</td>
                  <td>{fmtSlot(now, later)}</td>
                </tr>
                <tr>
                  <td className="font-mono text-xs">fmtSlot (ends at midnight)</td>
                  <td>{fmtSlot(now, midnightEnd)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section
          title="Dock + DockItem + NavScrim"
          note="The live, fixed ones are at the bottom of this page. Tap a tab to move aria-current. Every item must measure ≥ 44 × 44."
        >
          <p className="text-xs text-base-content/60">
            `.pad-nav` on this page reserves 7rem + inset so this last line clears the scrim, not
            merely the dock.
          </p>
        </Section>
      </div>

      {/* The LIVE, fixed pair — not a mock-up in a frame — so the 44px floor and the
          `.dock-item[aria-current="page"]` tint can be measured on the real thing.
          `href="#"` on purpose: a real path would navigate away from the page being measured.
          `aria-current` is hard-set on one tab here; Phase 2's router owns it in the real shell. */}
      <NavScrim />
      <Dock>
        <DockItem href="#" label="หน้าแรก" icon="house" />
        <DockItem href="#" label="จองสถานที่" icon="building2" active />
        <DockItem href="#" label="การจองของฉัน" icon="calendarCheck" />
        <DockItem href="#" label="ตั้งค่า" icon="settings" />
      </Dock>
    </div>
  )
}

export function ShowcasePage() {
  return (
    <ToastProvider>
      <ShowcaseBody />
    </ToastProvider>
  )
}
