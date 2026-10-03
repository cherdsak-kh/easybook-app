/**
 * `รายละเอียดข้อผิดพลาด`: the incident inspector. Prototype `#errlog-detail-modal` L12483–12565.
 *
 * Read-only. ✕, `ปิด`, Escape and the backdrop all close it (`Modal`, `closeOnBackdrop`), and focus goes
 * back to the row's button. ⚠️ No `<form method="dialog">` (React 19 never closes the dialog from one).
 * It lives inside the page, so it unmounts with it: a role change that makes `BackendLayout` redirect, or
 * leaving the route, closes it.
 *
 * Order is how an engineer reads an incident: which one, when and how bad, the request, who sent it, the
 * stack, the context. The FIRST FOUR sections come straight from the list row, so the dialog is useful
 * the instant it opens; only the stack and the context wait for `GET /reports/error-log/detail/:id`
 * (they are not in the list), each with its own loading line, and a failure there is said in place:
 *   · `404` (`INCIDENT_NOT_FOUND`: purged, evicted by the cap, or the id was never real) reads
 *     `บันทึกนี้ถูกล้างไปแล้ว`; the summary above stays, because the row proved it existed;
 *   · anything else offers a retry. Never a silent blank.
 *
 * ⚠️ WHAT IT SHOWS WAS REDACTED BEFORE IT WAS STORED (a whitelist, D-21): no request body, no cookie, no
 * token, a masked LINE user id. This component renders what it is given and never tries to "improve" it.
 * The stack is frames only, in a `<pre>` that scrolls INSIDE the dialog (`overflow-auto`), so a 200
 * character line widens that box and never the page.
 */

import { useEffect, useState } from 'react'
import { ApiError, getIncident, type IncidentDetail, type IncidentSummary } from '@/lib/api-client'
import { INCIDENT_COMPONENT_LABEL, INCIDENT_SEVERITY } from '../../../labels'
import { Modal } from '../../../components/ui/Modal'
import { useToast } from '../../../lib/toast-context'
import { COPY_FAILED, copyToClipboard } from '../clipboard'
import { contextOf, pathOf, statusClass, statusLabel } from '../error-log-view'
import { bangkokTimestampMs } from '../log-format'

type DetailState =
  | { status: 'loading' }
  | { status: 'ready'; detail: IncidentDetail }
  | { status: 'missing' }
  | { status: 'error' }

const COPY_D =
  'M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184'

const PRE =
  'm-0 max-h-72 overflow-auto rounded-box bg-base-300/40 p-4 font-mono text-xs leading-[1.6] text-base-content/90 select-all'

export function IncidentDialog({
  incident,
  open,
  onClose,
}: {
  /** The last incident opened. Kept after close so the dialog can finish closing (and restore focus) mounted. */
  incident: IncidentSummary | null
  open: boolean
  onClose: () => void
}) {
  const toast = useToast()
  const [state, setState] = useState<DetailState>({ status: 'loading' })
  const [tick, setTick] = useState(0)
  const id = incident?.id

  useEffect(() => {
    if (!open || !id) return
    const ac = new AbortController()
    setState({ status: 'loading' })
    getIncident(id, ac.signal)
      .then((detail) => {
        if (!ac.signal.aborted) setState({ status: 'ready', detail })
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return
        setState(
          err instanceof ApiError && err.status === 404 ? { status: 'missing' } : { status: 'error' },
        )
      })
    return () => ac.abort()
  }, [open, id, tick])

  if (!incident) return null

  const copyTrace = async () => {
    if (await copyToClipboard(incident.traceId)) toast('success', `คัดลอก Trace ID ${incident.traceId} แล้ว`)
    else toast('error', COPY_FAILED)
  }

  const detail = state.status === 'ready' ? state.detail : null
  const context = detail ? contextOf(detail) : null

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeOnBackdrop
      width={760}
      title="รายละเอียดข้อผิดพลาด"
      // Centred and capped at the Modal's own 70dvh (E-20): the phone's bottom edge belongs to the
      // browser's URL bar, and a second `max-h` here would fight the Modal's on source order.
      bodyClassName="space-y-3 bg-base-200 px-4 py-4 sm:px-5"
      footer={
        <button type="button" className="btn-primary2" onClick={onClose}>
          ปิด
        </button>
      }
    >
      {/* 1 · ids */}
      <section className="fb-sec !py-3" aria-label="รหัสเหตุการณ์และ Trace ID">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="m-0 font-mono text-[14px] font-semibold text-base-content">{incident.id}</p>
            <p className="m-0 mt-0.5 text-[13px] text-base-content/70">
              Trace ID <span className="break-all font-mono text-base-content/90">{incident.traceId}</span>
            </p>
          </div>
          <button type="button" className="btn btn-sm min-h-11" onClick={() => void copyTrace()}>
            <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={COPY_D} />
            </svg>
            คัดลอก Trace ID
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-base-300 pt-3">
          <span className={`badge badge-sm font-mono ${INCIDENT_SEVERITY[incident.severity].badge}`}>
            {incident.severity}
          </span>
          <span className="act-chip px-2 py-0.5 text-[12px]">{INCIDENT_COMPONENT_LABEL[incident.component]}</span>
          <span className="font-mono text-[13px] text-base-content/80">{bangkokTimestampMs(incident.at)}</span>
        </div>
      </section>

      {/* 2 · request */}
      <section className="fb-sec" aria-labelledby="errlog-d-req-h">
        <h3 id="errlog-d-req-h" className="m-0 mb-3 text-[14px] font-semibold text-base-content/70">
          คำขอที่เกิดข้อผิดพลาด
        </h3>
        <dl className="m-0 grid gap-x-4 gap-y-2 text-[14px] sm:grid-cols-[9rem_1fr]">
          <dt className="text-base-content/70">HTTP Status</dt>
          <dd className={`m-0 font-mono text-[13px] font-semibold ${statusClass(incident.status)}`}>
            {statusLabel(incident.status)}
          </dd>
          <dt className="text-base-content/70">Method</dt>
          <dd className="m-0 font-mono text-[13px] text-base-content/90">{incident.method ?? '—'}</dd>
          <dt className="text-base-content/70">เส้นทาง (URL)</dt>
          <dd className="m-0 break-all font-mono text-[13px] text-base-content/90">{pathOf(incident)}</dd>
          <dt className="text-base-content/70">ข้อความผิดพลาด</dt>
          <dd className="m-0 break-words font-mono text-[13px] leading-[1.6] text-error">{incident.message}</dd>
        </dl>
      </section>

      {/* 3 · client */}
      <section className="fb-sec" aria-labelledby="errlog-d-client-h">
        <h3 id="errlog-d-client-h" className="m-0 mb-3 text-[14px] font-semibold text-base-content/70">
          ข้อมูลผู้เรียกใช้
        </h3>
        <dl className="m-0 grid gap-x-4 gap-y-2 text-[14px] sm:grid-cols-[9rem_1fr]">
          <dt className="text-base-content/70">IP Address</dt>
          <dd className="m-0 font-mono text-[13px] text-base-content/90">{incident.ip ?? '—'}</dd>
          <dt className="text-base-content/70">ผู้ใช้ / ผู้เรียก</dt>
          <dd className="m-0 break-all font-mono text-[13px] text-base-content/90">{incident.caller.label}</dd>
          {/* The user agent is a detail-only field: it appears when the detail arrives. */}
          <dt className="text-base-content/70">User Agent</dt>
          <dd className="m-0 break-all font-mono text-[12px] leading-[1.6] text-base-content/80">
            {detail ? (detail.userAgent ?? '—') : state.status === 'loading' ? '…' : '—'}
          </dd>
        </dl>
      </section>

      {/* 4 · stack */}
      <section className="fb-sec" aria-labelledby="errlog-d-stack-h">
        <h3 id="errlog-d-stack-h" className="m-0 mb-3 text-[14px] font-semibold text-base-content/70">
          Stack Trace
        </h3>
        {state.status === 'loading' && (
          <p role="status" className="m-0 flex items-center gap-2 text-[13px] text-base-content/70">
            <span aria-hidden="true" className="loading loading-spinner loading-xs" />
            กำลังโหลด Stack Trace
          </p>
        )}
        {state.status === 'missing' && (
          <p role="status" className="m-0 text-[14px] text-base-content/70">
            บันทึกนี้ถูกล้างไปแล้ว
          </p>
        )}
        {state.status === 'error' && (
          <p role="alert" className="m-0 flex flex-wrap items-center gap-x-2 text-[14px] text-error">
            โหลด Stack Trace ไม่สำเร็จ
            <button type="button" className="btn btn-ghost btn-sm min-h-11" onClick={() => setTick((n) => n + 1)}>
              ลองใหม่อีกครั้ง
            </button>
          </p>
        )}
        {detail &&
          (detail.stack ? (
            <pre className={PRE}>{detail.stack}</pre>
          ) : (
            <p className="m-0 text-[14px] text-base-content/70">ไม่มี Stack Trace เก็บไว้สำหรับรายการนี้</p>
          ))}
      </section>

      {/* 5 · context. Whitelisted keys only: tokens, bodies and phone numbers never reach the store. */}
      <section className="fb-sec" aria-labelledby="errlog-d-ctx-h">
        <h3 id="errlog-d-ctx-h" className="m-0 mb-3 text-[14px] font-semibold text-base-content/70">
          บริบทของคำขอ (ปิดบังข้อมูลส่วนบุคคลแล้ว)
        </h3>
        {detail ? (
          context ? (
            <pre className={PRE}>{context}</pre>
          ) : (
            <p className="m-0 text-[14px] text-base-content/70">ไม่มีบริบทเพิ่มเติม</p>
          )
        ) : (
          <p className="m-0 text-[14px] text-base-content/70">
            {state.status === 'loading' ? 'กำลังโหลด…' : '—'}
          </p>
        )}
      </section>
    </Modal>
  )
}
