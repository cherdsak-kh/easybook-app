/**
 * `ทะเบียนการผิดวินัยการใช้งาน` — one row per late-cancelled request, so its row count IS the
 * `วินัยการใช้งาน` KPI (prototype ~L8332–8364, `ro-tpl-log` ~L8473–8487, AC-O12).
 *
 * ⚠️ NO REQUESTER NAME OR PHONE, for any role (D-26): the ฝ่าย is the governance unit, not the
 * person. The request code opens the existing request detail, where names are already visible to the
 * same three roles. `cancelReason` is free text and is shown as-is — no new exposure.
 * ⚠️ D-12: NO NO-SHOW ROWS and no attendance claim — the subtitle and the empty copy are rewritten
 * from the prototype's, which asserted a check-in record the system does not have.
 */

import type { ReportsOperations } from '@/lib/api-client'
import { CANCELLER_LABEL } from '../../../labels'
import { thaiDateOf } from '../report-presets'
import {
  UNASSIGNED_LABEL,
  bangkokParts,
  registryExtraSlots,
  registryLeadText,
} from '../report-operations-view'

export function LateCancellationRegistry({ data }: { data: ReportsOperations }) {
  const rows = data.registry
  const lead = data.discipline.cancelLeadMinutes
  return (
    <section className="card mt-4 border border-base-300 bg-base-100 shadow-sm" aria-labelledby="ro-log-h">
      <div className="card-body gap-0 p-0 sm:p-0">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-base-300 p-4 sm:px-5">
          <div className="min-w-0">
            <h2 id="ro-log-h" className="card-title">
              ทะเบียนการผิดวินัยการใช้งาน
            </h2>
            <p className="m-0 mt-0.5 text-[13px] text-base-content/70">
              การยกเลิกภายในเวลาที่กำหนด (น้อยกว่า {lead} นาทีก่อนเริ่ม) · ระบบยังไม่บันทึกการเข้าใช้จริง
              จึงยังไม่แสดงการไม่มาใช้
            </p>
          </div>
          <span className="badge badge-neutral badge-sm shrink-0 tabular-nums">{rows.length} รายการ</span>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
              <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="m-0 text-[15px] font-medium text-base-content">ไม่มีการยกเลิกกระชั้นชิดในช่วงเวลาที่เลือก</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table rp-table">
              <thead>
                <tr>
                  <th scope="col" className="hidden sm:table-cell">รหัสคำขอ</th>
                  <th scope="col" className="hidden sm:table-cell">วัน-เวลา</th>
                  <th scope="col">
                    <span className="sm:hidden">รายการ</span>
                    <span className="hidden sm:inline">สถานที่</span>
                  </th>
                  <th scope="col" className="hidden md:table-cell">กลุ่ม/ฝ่าย</th>
                  <th scope="col" className="text-center">ประเภท</th>
                  <th scope="col" className="hidden lg:table-cell">หมายเหตุ/สาเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const start = bangkokParts(r.slotStartAt)
                  const end = bangkokParts(r.slotEndAt)
                  const day = thaiDateOf(start.date)
                  const time = `${start.time}–${end.time}${registryExtraSlots(r) ? ` ${registryExtraSlots(r)}` : ''}`
                  const venue = r.venueName + (r.venueIsDeleted ? ' (ลบแล้ว)' : '')
                  const dept =
                    r.departmentName == null
                      ? UNASSIGNED_LABEL
                      : r.departmentName + (r.departmentIsDeleted ? ' (ลบแล้ว)' : '')
                  return (
                    <tr key={r.code}>
                      <td className="hidden whitespace-nowrap font-mono text-[13px] text-base-content/80 sm:table-cell">
                        {r.code}
                      </td>
                      <td className="hidden whitespace-nowrap tabular-nums sm:table-cell">
                        <span className="block">{day}</span>
                        <span className="block text-[12px] text-base-content/60">{time}</span>
                      </td>
                      <td>
                        <span className="block text-[12px] text-base-content/70 tabular-nums sm:hidden">
                          {r.code} · {day} {time}
                        </span>
                        <span className="block max-w-40 truncate font-medium sm:max-w-56 sm:font-normal" title={venue}>
                          {venue}
                        </span>
                        <span className="block max-w-40 truncate text-[12px] text-base-content/60 md:hidden">{dept}</span>
                        <span className="mt-0.5 block max-w-56 text-[12px] leading-[1.5] text-base-content/70 lg:hidden">
                          {r.cancelReason ?? '—'}
                        </span>
                      </td>
                      <td className="hidden max-w-56 truncate text-base-content/80 md:table-cell" title={dept}>
                        {dept}
                      </td>
                      <td className="text-center">
                        <span className="badge badge-warning badge-sm whitespace-nowrap">ยกเลิกกระชั้นชิด</span>
                        <span className="mt-1 block whitespace-nowrap text-[12px] text-base-content/60 tabular-nums">
                          {registryLeadText(r)}
                        </span>
                        <span className="badge badge-ghost badge-sm mt-1 whitespace-nowrap">
                          {CANCELLER_LABEL[r.canceller]}
                        </span>
                      </td>
                      <td className="hidden max-w-64 text-[13px] leading-[1.55] text-base-content/80 lg:table-cell">
                        {r.cancelReason ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
