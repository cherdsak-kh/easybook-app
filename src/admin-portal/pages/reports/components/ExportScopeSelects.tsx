/**
 * Hub 4, step 3: `3. ขอบเขตข้อมูล (ไม่บังคับ)`. Prototype ~L8622–8636: two native daisyUI `select`s,
 * a venue and a กลุ่มสาระ/ฝ่าย. daisyUI draws the chevron: no hand-rolled shell, no `appearance-none`.
 *
 * The choices come from `GET /reports/export/scope-options`: every venue (a soft-deleted one is
 * suffixed `(ลบแล้ว)` and stays selectable, because its past bookings are in the data), and every
 * department EXCEPT the system-reserved one for an ADMIN (P2 D-20), which the server omits and this
 * file never has to know about.
 *
 * ⚠️ A FAILED `scope-options` IS SAID, NOT SWALLOWED. The selects stay usable with only their `ทุก…`
 * option (the document still works unscoped), and the line under them says why the lists are short
 * and offers a retry.
 */

import type { ReportScopeOptions } from '@/lib/api-client'

export type ScopeStatus = 'loading' | 'ready' | 'error'

export function ExportScopeSelects({
  options,
  status,
  venueId,
  departmentId,
  onVenueChange,
  onDepartmentChange,
  onRetry,
}: {
  options: ReportScopeOptions | null
  status: ScopeStatus
  venueId: string | null
  departmentId: number | null
  onVenueChange: (id: string | null) => void
  onDepartmentChange: (id: number | null) => void
  onRetry: () => void
}) {
  return (
    <div className="min-w-0">
      <p className="label">3. ขอบเขตข้อมูล (ไม่บังคับ)</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor="rpe-venue" className="label">
            สถานที่
          </label>
          <select
            id="rpe-venue"
            className="select select-bordered min-h-11 w-full"
            value={venueId ?? ''}
            disabled={status === 'loading'}
            onChange={(e) => onVenueChange(e.target.value === '' ? null : e.target.value)}
          >
            <option value="">ทุกสถานที่</option>
            {options?.venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.isDeleted ? ' (ลบแล้ว)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor="rpe-dept" className="label">
            กลุ่มสาระ/ฝ่าย
          </label>
          <select
            id="rpe-dept"
            className="select select-bordered min-h-11 w-full"
            value={departmentId ?? ''}
            disabled={status === 'loading'}
            onChange={(e) => onDepartmentChange(e.target.value === '' ? null : Number(e.target.value))}
          >
            <option value="">ทุกกลุ่มสาระ/ฝ่าย</option>
            {options?.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.isDeleted ? ' (ลบแล้ว)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
      {status === 'error' && (
        <p role="alert" className="m-0 mt-2 flex flex-wrap items-center gap-x-2 text-[13px] text-error">
          โหลดรายการสถานที่และกลุ่ม/ฝ่ายไม่สำเร็จ จึงเลือกขอบเขตไม่ได้ในตอนนี้
          <button type="button" className="btn btn-ghost btn-sm min-h-11" onClick={onRetry}>
            ลองใหม่
          </button>
        </p>
      )}
    </div>
  )
}
