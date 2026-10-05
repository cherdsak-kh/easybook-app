import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MANUAL_ARTICLES,
  MANUAL_FILTERS,
  OFFICER_CONTACT,
  QUICK_STEPS,
  type ManualTopic,
} from './manual-content'
import { SCREEN_WIDTH, ScreenHeader } from '@/client-portal/components/ui/ScreenHeader'
import { LIcon } from '@/client-portal/icons/LucideIcon'

/**
 * `/manual` — help and FAQ. Prototype `data-screen="manual"` (client_portal_prototype.html) and its
 * `data-mn-filter` script.
 *
 * ── 🔴 NO `pad-nav` ON THE SECTION, THOUGH THE PROTOTYPE HAS IT ──
 * `LiffShell` is the single authority for clearing the floating dock (it applies `.pad-nav` on the
 * same condition it draws the dock on). A second one here double-pads — see
 * `fix/20260909_1715_client_dock_double_pad_nav`.
 *
 * ── ⚠️ NO BACK ARROW IN THE HEADER (`D-C3`) ──
 * LIFF draws its own. The breadcrumb names the way back (`D-C14`); the button at the foot is a link
 * to a written destination, not a history-back control.
 *
 * ── ⚠️ FILTERING UNMOUNTS, IT DOES NOT SET `hidden` ──
 * `.collapse` is `display: grid`, which beats the `[hidden]` attribute. The list is filtered, so a
 * hidden topic is simply not in the DOM. Trade-off: filtering away an open topic closes it — the
 * prototype kept it open in place, and a reader who filters to another category has moved on.
 */
export function ManualPage() {
  const [filter, setFilter] = useState<'all' | ManualTopic>('all')
  const shown = MANUAL_ARTICLES.filter((a) => filter === 'all' || a.topic === filter)

  return (
    <section className="min-h-dvh">
      <ScreenHeader
        title="คู่มือการใช้งานระบบ"
        breadcrumbs={[{ label: 'ตั้งค่า', to: '/settings' }, { label: 'คู่มือการใช้งานระบบ' }]}
      />
      <div className={`${SCREEN_WIDTH} space-y-4 pt-4`}>
        {/* ─── 1 · เริ่มต้นใช้งาน 3 ขั้นตอน ───────────────────────────────────────────
            Each step's text is ONE wrapping span: `li.step` is a grid, and two bare text nodes
            would become two grid cells rather than two lines in one. */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body gap-0 p-4">
            <h2 className="font-semibold">เริ่มต้นใช้งานง่าย ๆ ใน 3 ขั้นตอน</h2>
            <p className="mt-1 text-sm text-base-content/70">
              จองสถานที่ผ่าน LINE ได้เอง ไม่ต้องรอเวลาทำการ
            </p>
            <ul className="steps steps-vertical sm:steps-horizontal my-3 w-full text-xs sm:text-sm">
              {QUICK_STEPS.map((step) => (
                <li key={step.title} className="step step-primary">
                  <span className="text-start sm:text-center">
                    <span className="block font-medium">{step.title}</span>
                    <span className="block text-base-content/70">{step.desc}</span>
                  </span>
                </li>
              ))}
            </ul>
            <Link to="/venues" className="btn btn-app btn-primary w-full">
              ค้นหาสถานที่เพื่อเริ่มต้นจอง
            </Link>
          </div>
        </div>

        {/* ─── 2 · ตัวกรองหมวด ────────────────────────────────────────────────────────
            Selected = `btn-neutral`; the others carry `bg-base-100 border-base-300` so they read on
            the grey page. The prototype toggled those classes in JS; here it is one conditional
            className, so the two sets can never both apply (the utility would beat `btn-neutral`). */}
        <div
          role="group"
          aria-label="กรองหัวข้อช่วยเหลือ"
          className="no-sb flex gap-1.5 overflow-x-auto pb-1 text-xs"
        >
          {MANUAL_FILTERS.map((chip) => {
            const on = filter === chip.id
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(chip.id)}
                className={`btn btn-app-sm shrink-0 whitespace-nowrap rounded-full px-4 ${
                  on ? 'btn-neutral' : 'border-base-300 bg-base-100'
                }`}
              >
                {chip.label}
              </button>
            )
          })}
        </div>

        {/* ─── 3 · คำถาม-คำตอบ ─────────────────────────────────────────────────────── */}
        <p className="text-xs text-base-content/60" aria-live="polite">
          แสดง {shown.length} หัวข้อ
        </p>
        <div className="space-y-2">
          {shown.map((article) => (
            <details
              key={article.id}
              className="collapse collapse-plus rounded-box border border-base-300 bg-base-100"
            >
              <summary className="collapse-title min-h-14 pe-12 text-sm font-semibold">
                {article.title}
              </summary>
              <div className="collapse-content text-sm text-base-content/70">
                {article.body}
                {article.link && (
                  <Link
                    to={article.link.to}
                    className="btn btn-outline mt-3 w-full sm:w-auto min-h-10 font-medium"
                  >
                    {article.link.label}
                  </Link>
                )}
              </div>
            </details>
          ))}
        </div>

        {/* ─── 4 · ติดต่อเจ้าหน้าที่ ──────────────────────────────────────────────────── */}
        <div className="card border border-base-300/60 bg-base-200/60">
          <div className="card-body gap-0 p-4">
            <h2 className="font-semibold">ยังหาคำตอบไม่เจอ?</h2>
            <p className="mt-1 text-sm text-base-content/70">ติดต่อเจ้าหน้าที่ได้ในเวลาทำการ</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-start gap-3">
                <LIcon name="clock" className="mt-0.5 h-5 w-5 shrink-0 text-base-content/70" />
                <span className="min-w-0">{OFFICER_CONTACT.hours}</span>
              </li>
              <li className="flex items-start gap-3">
                <LIcon name="phone" className="mt-0.5 h-5 w-5 shrink-0 text-base-content/70" />
                <span className="min-w-0">
                  {OFFICER_CONTACT.unit}:{' '}
                  <a
                    href={OFFICER_CONTACT.phoneHref}
                    className="link link-hover font-mono font-medium text-primary whitespace-nowrap"
                  >
                    {OFFICER_CONTACT.phoneDisplay}
                  </a>
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* A link to a written destination at the end of the content, not a back control (D-C3). */}
        <Link
          to="/settings"
          className="btn btn-app btn-outline w-full border-base-300 text-base-content/80"
        >
          กลับสู่หน้าตั้งค่า
        </Link>
      </div>
    </section>
  )
}
