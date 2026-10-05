/**
 * ติดต่อทีมผู้พัฒนา — `/backend/help/support`, the 26th and last destination to get a real screen.
 *
 * Renamed on 5 ต.ค. 2569 (PO + CTO) from a label that named an in-school technical department: the
 * people on this portal ARE the school's top authority, so there is nobody inside the school to
 * escalate to. Every road on this page leads to one place — the EasyBook dev team. Three zones, in
 * the prototype's order:
 *
 *  1. สถานะการทำงานของระบบ — is it us or is it them? Live from the two existing endpoints.
 *  2. ทีมพัฒนาระบบ EasyBook — the one contact, and its public Discord invite.
 *  3. แจ้งปัญหาการใช้งานถึงทีมพัฒนา — an incident form relayed by the backend to the team's Discord.
 *
 * ⚠️ EVERY ROLE REACHES IT (not in `VIEWER_DENY`): a ผู้ดูข้อมูล who cannot see a button is exactly who
 * needs to report that. What differs per role is only what the server chooses to put in the health
 * response — latency and quota are SUPER_ADMIN-only on the wire, so this screen cannot leak them.
 *
 * Leaving the route unmounts the page, which is the prototype's `__supportReset`: the form, the
 * dropped files and the last receipt go with it.
 *
 * Every control is daisyUI as shipped; `.sp-scope` (admin-portal.css) only adds the 44px floor and
 * the dropzone.
 */

import { PageHeading } from '../../components/shell/PageHeading'
import { Card, CardBody } from '../../components/ui/Card'
import type { AdminRoute } from '../../routes'
import { SupportHealthCard } from './SupportHealthCard'
import { SupportIncidentForm } from './SupportIncidentForm'
import { DISCORD_INVITE_URL } from './support-model'
import { useSupportHealth } from './use-support-health'

const CODE_ICON =
  'M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5'
const CHAT_ICON =
  'M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155'

export function SupportPage({ route }: { route: AdminRoute }) {
  const { state, pending, recheck } = useSupportHealth()

  return (
    <div className="sp-scope card-shell lg:overflow-y-auto">
      <PageHeading
        route={route}
        desc="ช่องทางติดต่อและแจ้งปัญหาการใช้งานระบบโดยตรงถึงทีมพัฒนา EasyBook"
      />

      <div className="flex flex-col gap-4 pb-1">
        {/* ══ Zone 1 · สถานะการทำงานของระบบ ══ */}
        <SupportHealthCard state={state} pending={pending} onRecheck={() => void recheck()} />

        {/* ══ Zone 2 · ทีมพัฒนาระบบ EasyBook ══ ONE card: the school-department card that used to sit
            beside it left with the rename. */}
        <Card aria-labelledby="sp-contact-title">
          <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary">
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={CODE_ICON} />
                </svg>
              </span>
              <div className="min-w-0">
                <h2
                  id="sp-contact-title"
                  className="m-0 text-[15px] font-semibold leading-[1.45] text-base-content"
                >
                  ทีมพัฒนาระบบ EasyBook
                </h2>
                <p className="m-0 mt-0.5 text-[13px] leading-[1.5] text-base-content/70">
                  ระบบขัดข้อง หน้าจอแสดงผลผิดพลาด หรือแจ้งปัญหาการใช้งาน
                </p>
                <dl className="m-0 mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[14px] leading-[1.5]">
                  <dt className="text-base-content/70">ช่องทาง</dt>
                  <dd className="m-0 text-base-content">Discord (ห้องการแจ้งปัญหา/ข้อเสนอแนะ)</dd>
                  <dt className="text-base-content/70">ตอบกลับ</dt>
                  <dd className="m-0 text-base-content">
                    แจ้งเตือนผ่าน Discord ทันที · หรือแจ้งผ่านแบบฟอร์มด้านล่าง
                  </dd>
                </dl>
              </div>
            </div>
            {/* An anchor, not `window.open`: it works with middle-click, long-press and a blocked
                popup, and `rel` keeps the Discord tab from reaching back into this one. This is the
                fallback channel when the relay below fails (D6), so it must never depend on JS. */}
            <a
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-primary w-full shrink-0 sm:w-auto"
            >
              <svg
                aria-hidden="true"
                className="h-4.5 w-4.5 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={CHAT_ICON} />
              </svg>
              <span>เข้าร่วม Discord ทีมพัฒนา</span>
              <span className="sr-only">(เปิดในแท็บใหม่)</span>
            </a>
          </CardBody>
        </Card>

        {/* ══ Zone 3 · แจ้งปัญหาการใช้งานถึงทีมพัฒนา ══ */}
        <SupportIncidentForm version={state.phase === 'done' ? state.version : null} />
      </div>
    </div>
  )
}
