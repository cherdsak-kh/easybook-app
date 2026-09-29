/**
 * `สถานะของระบบ` — prototype `[data-route="dashboard"]` ~L3468–3485 (`.db-chip`/`.db-dot`).
 *
 * ⚠️ THE CALLER OWNS THE VIEWER GATE. This component is never mounted for a VIEWER at all (D-15,
 * AC-D18) — `DashboardPage` conditionally renders it, so there is no `hidden` prop to forget here.
 *
 * ⚠️ ROLE SHAPING IS THE SERVER'S (D-15, AC-D17): for ADMIN, `health.telemetry` is `null` on the
 * wire — this component never falls back to computing a number from a field that is not there, it
 * only ever reads `health.services[*].status` for the summary words. SUPER_ADMIN's numeric chips
 * read `health.telemetry`, which is only non-null for that role.
 *
 * ⚠️ FIX ROUND 1 (F4): Core API is ALSO one of AC-D16's four chips and AC-D17 says ADMIN gets "the
 * same four services… each as one word" — it is not exempt just because its number is client-
 * measured rather than server-sent. `apiLatencyMs` is only ever set after a SUCCESSFUL round trip
 * (`getSystemHealth` throws before returning it otherwise, and `DashboardPage` never sets `health`
 * from a throw), so "we have a non-null `health`" already means Core API answered — ADMIN's word is
 * therefore always `ปกติ` here, with no separate boolean to plumb through.
 *
 * ⚠️ D-7: NO 30-DAY AVAILABILITY LINE AND NO บันทึกข้อผิดพลาด LINK — Hub 6 does not exist yet, and a
 * link to a coming-soon route would be worse than no link.
 */

import { HEALTH_STATUS_LABEL } from '../../../labels'
import type { SystemHealth } from '@/lib/api-client'

export function SystemStatusStrip({
  health,
  error,
}: {
  health: (SystemHealth & { apiLatencyMs: number }) | null
  error: boolean
}) {
  return (
    <section className="card border border-base-300 bg-base-100 p-4 shadow-sm" aria-labelledby="db-health-h">
      <h2 id="db-health-h" className="sr-only">
        สถานะของระบบ
      </h2>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-5">
        {error && (
          <span className="badge badge-warning">● ตรวจสอบสถานะไม่สำเร็จ</span>
        )}
        {!error && !health && <span className="badge badge-neutral">กำลังตรวจสอบสถานะ…</span>}
        {!error && health && (
          <div className="shrink-0">
            <span className={`badge ${health.overall === 'OK' ? 'badge-success' : 'badge-warning'}`}>
              {health.overall === 'OK'
                ? '● ระบบทั้งหมดทำงานปกติ (All Systems Operational)'
                : '● ระบบบางส่วนขัดข้อง'}
            </span>
          </div>
        )}
        {!error && health && (
          <ul role="list" className="m-0 flex min-w-0 flex-1 list-none flex-wrap gap-2 p-0">
            <li className="db-chip">
              <span className="db-dot" aria-hidden="true" />
              {health.detail === 'FULL' ? (
                <span>
                  Core API: <b className="tabular-nums">{health.apiLatencyMs}ms</b>
                </span>
              ) : (
                <span>
                  Core API: <b>ปกติ</b>
                </span>
              )}
            </li>
            <li className="db-chip">
              <span className="db-dot" aria-hidden="true" />
              {health.detail === 'FULL' && health.telemetry ? (
                <span>
                  PostgreSQL: <b className="tabular-nums">{health.telemetry.database.latencyMs}ms</b>
                </span>
              ) : (
                <span>
                  PostgreSQL: <b>{HEALTH_STATUS_LABEL[health.services.database.status]}</b>
                </span>
              )}
            </li>
            <li className="db-chip">
              <span className="db-dot" aria-hidden="true" />
              {health.detail === 'FULL' && health.telemetry ? (
                <span>
                  LINE OA: <b>{HEALTH_STATUS_LABEL[health.services.line.status]}</b>
                  {health.telemetry.line.quotaRemaining != null && (
                    <>
                      {' '}
                      (โควตาเหลือ{' '}
                      <span className="tabular-nums">{health.telemetry.line.quotaRemaining}</span> ข้อความ)
                    </>
                  )}
                </span>
              ) : (
                <span>
                  LINE OA: <b>{HEALTH_STATUS_LABEL[health.services.line.status]}</b>
                </span>
              )}
            </li>
            <li className="db-chip">
              <span className="db-dot" aria-hidden="true" />
              {health.detail === 'FULL' && health.telemetry ? (
                <span>
                  Cloudflare R2: <b>{HEALTH_STATUS_LABEL[health.services.storage.status]}</b>
                  {health.telemetry.storage.latencyMs != null && (
                    <> · <span className="tabular-nums">{health.telemetry.storage.latencyMs}ms</span></>
                  )}
                </span>
              ) : (
                <span>
                  Cloudflare R2: <b>{HEALTH_STATUS_LABEL[health.services.storage.status]}</b>
                </span>
              )}
            </li>
          </ul>
        )}
      </div>
    </section>
  )
}
