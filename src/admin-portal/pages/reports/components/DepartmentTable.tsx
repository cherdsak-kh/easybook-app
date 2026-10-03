/**
 * `การจัดสรรพื้นที่ตามกลุ่มสาระ/ฝ่ายงาน` — every กลุ่ม/ฝ่าย, ZEROS INCLUDED (a ฝ่าย with no bookings is
 * itself an equity finding), UNPAGINATED. Prototype ~L8273–8298 and `ro-tpl-dept` ~L8435–8463
 * (AC-O8). The `ไม่ระบุกลุ่ม/ฝ่าย` row comes last from the server and is not a department (DV-4).
 *
 * ⚠️ D-12: the lapse badge counts LATE CANCELLATIONS only — there is no no-show data.
 * ⚠️ D-20: for ADMIN/VIEWER a system-reserved department never reaches this table by name; the server
 * has already folded it into `ไม่ระบุกลุ่ม/ฝ่าย`.
 */

import type { ReportsOperations } from '@/lib/api-client'
import { approvalBadge, departmentName, equityBadge, hrs, lapseBadge, pct1 } from '../report-operations-view'

export function DepartmentTable({ data }: { data: ReportsOperations }) {
  const rows = data.departments
  const equity = equityBadge(rows)
  return (
    <section className="card mt-4 border border-base-300 bg-base-100 shadow-sm" aria-labelledby="ro-dept-h">
      <div className="card-body gap-0 p-0 sm:p-0">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-base-300 p-4 sm:px-5">
          <div className="min-w-0">
            <h2 id="ro-dept-h" className="card-title">
              การจัดสรรพื้นที่ตามกลุ่มสาระ/ฝ่ายงาน
            </h2>
            <p className="m-0 mt-0.5 text-[13px] text-base-content/70">
              ทุกกลุ่มสาระ/ฝ่าย เรียงตามชั่วโมงที่ใช้จริง · รวม {hrs(data.heldHours)} ชม. จาก{' '}
              {data.requests.total.toLocaleString('en-US')} คำขอ
            </p>
          </div>
          {equity && <span className={`badge badge-sm shrink-0 ${equity.cls}`}>{equity.text}</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="table rp-table">
            <thead>
              <tr>
                <th scope="col">กลุ่มสาระ / ฝ่ายงาน</th>
                <th scope="col" className="hidden text-right sm:table-cell">คำขอทั้งหมด</th>
                <th scope="col" className="hidden text-right sm:table-cell">ชั่วโมงที่ใช้จริง</th>
                <th scope="col" className="w-[28%] sm:w-[22%]">สัดส่วนการใช้พื้นที่</th>
                <th scope="col" className="text-center">
                  <span className="sm:hidden">อนุมัติ</span>
                  <span className="hidden sm:inline">อัตราการอนุมัติ</span>
                </th>
                <th scope="col" className="hidden text-center md:table-cell">ประวัติผิดวินัย</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const name = departmentName(r)
                const ok = approvalBadge(r.approvalPercent)
                const lapse = lapseBadge(r.lateCancellations)
                return (
                  <tr key={r.departmentId ?? 'unassigned'}>
                    <td>
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-control bg-info/10 text-info sm:flex"
                        >
                          <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                            />
                          </svg>
                        </span>
                        <div className="min-w-0">
                          <span className="block max-w-32 truncate font-medium sm:max-w-72" title={name}>
                            {name}
                          </span>
                          {/* Phone: the hidden columns, stacked. */}
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-base-content/70 tabular-nums md:hidden">
                            <span className="sm:hidden">
                              {r.requests} คำขอ · {hrs(r.heldHours)} ชม.
                            </span>
                            <span className={`badge badge-sm whitespace-nowrap ${lapse.cls}`}>{lapse.text}</span>
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="hidden text-right tabular-nums sm:table-cell">{r.requests}</td>
                    <td className="hidden text-right tabular-nums sm:table-cell">{hrs(r.heldHours)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <progress
                          className="progress progress-info min-w-10"
                          value={Math.round(r.sharePercent * 10) / 10}
                          max={100}
                          aria-label={`สัดส่วนการใช้พื้นที่ของ${name} ${pct1(r.sharePercent)}`}
                        />
                        <span className="w-12 shrink-0 text-right text-[13px] font-semibold tabular-nums">
                          {pct1(r.sharePercent)}
                        </span>
                      </div>
                    </td>
                    <td className="text-center">
                      <span className={`badge badge-sm tabular-nums ${ok.cls}`}>{ok.text}</span>
                    </td>
                    <td className="hidden text-center md:table-cell">
                      <span className={`badge badge-sm whitespace-nowrap ${lapse.cls}`}>{lapse.text}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
