/**
 * `รายละเอียดการทำรายการ`: one audit event, read-only. Prototype `#act-detail-modal` L12387–12481.
 *
 * Built on the portal's `Modal` (a native `<dialog>` driven by `showModal()`), whose close paths are
 * ✕, the footer `ปิด`, Escape and, because an audit record is never edited and there is nothing
 * half-written to lose, the BACKDROP (`closeOnBackdrop`). Focus returns to the opener (`Modal` records
 * it). ⚠️ No `<form method="dialog">` anywhere: React 19 never closes the dialog from one, and nesting it
 * hides that it is broken; this dialog closes through `onClose` and the platform's own events only.
 *
 * Sections in the order an auditor asks: which event, who, on what, what changed, why.
 *
 *   · the IP and device rows are present ONLY when the event carries them (a synthesised source records
 *     neither, and a row of dashes would read as "unknown" when it is "not recorded at all");
 *   · `ไปที่หน้า<owner>` is ABSENT when this role cannot reach the owner's route;
 *   · before/after is a key/value table with changed rows marked `เปลี่ยน`, or the sentence saying the
 *     source has none: nobody diffs two raw JSON blocks by eye. The raw object is one click away on
 *     `คัดลอก JSON`, which copies exactly what the API sent.
 */

import { useNavigate } from 'react-router-dom'
import type { AuditEvent } from '@/lib/api-client'
import { AUDIT_TARGET_KIND } from '../../../labels'
import { Modal } from '../../../components/ui/Modal'
import { useToast } from '../../../lib/toast-context'
import { useAcl } from '../../../lib/use-acl'
import { useAuth } from '../../../lib/auth-context'
import { urlOf, routeOf } from '../../../routes'
import { RoleChip } from '../../staff/components/RoleChip'
import {
  NO_CHANGES,
  NO_NOTE,
  actorView,
  diffRowsOf,
  eventJson,
  gotoOf,
  positionLine,
} from '../activity-view'
import { COPY_FAILED, copyToClipboard } from '../clipboard'
import { bangkokTimestampFull } from '../log-format'
import { ActionBadge } from './ActionBadge'

const COPY_D =
  'M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184'

export function ActivityDetailDialog({
  event,
  open,
  onClose,
  recordsIp,
}: {
  /** The last event opened. Kept after close so the dialog can finish closing (and restore focus) mounted. */
  event: AuditEvent | null
  open: boolean
  onClose: () => void
  recordsIp: boolean
}) {
  const toast = useToast()
  const navigate = useNavigate()
  const { user } = useAuth()
  const acl = useAcl(user!.role)

  if (!event) return null

  const actor = actorView(event.actor)
  const position = positionLine(actor)
  const kind = AUDIT_TARGET_KIND[event.target.kind]
  const goto = gotoOf(event, acl.can)
  const diff = diffRowsOf(event.changes)
  const showDevice = recordsIp && (event.ip !== null || event.userAgent !== null)

  const copyJson = async () => {
    if (await copyToClipboard(eventJson(event))) toast('success', `คัดลอก JSON ของ ${event.id} แล้ว`)
    else toast('error', COPY_FAILED)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeOnBackdrop
      width={680}
      title="รายละเอียดการทำรายการ"
      bodyClassName="space-y-3 bg-base-200 px-4 py-4 sm:px-5"
      footer={
        <>
          <button type="button" className="btn-ghost2" onClick={() => void copyJson()}>
            <svg aria-hidden="true" className="h-4.5 w-4.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={COPY_D} />
            </svg>
            คัดลอก JSON
          </button>
          <button type="button" className="btn-primary2" onClick={onClose}>
            ปิด
          </button>
        </>
      }
    >
      {/* 1 · เหตุการณ์ */}
      <section className="fb-sec !py-3" aria-label="รหัสเหตุการณ์และเวลา">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[14px] font-semibold text-base-content">{event.id}</span>
          <ActionBadge action={event.action} />
        </div>
        <p className="m-0 mt-2 text-[14px] text-base-content/80 tabular-nums">
          {bangkokTimestampFull(event.at, event.atIsApproximate)}
        </p>
      </section>

      {/* 2 · ผู้กระทำ */}
      <section className="fb-sec" aria-labelledby="act-d-actor-h">
        <h3 id="act-d-actor-h" className="m-0 mb-3 text-[14px] font-semibold text-base-content/70">
          เจ้าหน้าที่ผู้กระทำ
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[16px] font-semibold text-base-content">{actor.name}</span>
          {actor.role && <RoleChip role={actor.role} className="px-2 py-0.5 text-[12px]" />}
        </div>
        {position && <p className="m-0 mt-1 text-[14px] text-base-content/70">{position}</p>}
        {showDevice && (
          <dl className="m-0 mt-3 grid gap-x-4 gap-y-2 border-t border-base-300 pt-3 text-[14px] sm:grid-cols-[8rem_1fr]">
            {event.ip !== null && (
              <>
                <dt className="text-base-content/70">IP Address</dt>
                <dd className="m-0 font-mono text-[13px] text-base-content/90">{event.ip}</dd>
              </>
            )}
            {event.userAgent !== null && (
              <>
                <dt className="text-base-content/70">อุปกรณ์ (User Agent)</dt>
                <dd className="m-0 break-all font-mono text-[12px] leading-[1.6] text-base-content/80">
                  {event.userAgent}
                </dd>
              </>
            )}
          </dl>
        )}
      </section>

      {/* 3 · เป้าหมาย */}
      <section className="fb-sec" aria-labelledby="act-d-target-h">
        <h3 id="act-d-target-h" className="m-0 mb-3 text-[14px] font-semibold text-base-content/70">
          เป้าหมายของการกระทำ
        </h3>
        <p className="m-0 text-[13px] text-base-content/70">{kind.label}</p>
        <p className="m-0 mt-0.5 break-words font-mono text-[15px] font-semibold text-base-content">
          {event.target.label}
          {event.target.isDeleted ? ' (ลบแล้ว)' : ''}
        </p>
        {event.target.detail && (
          <p className="m-0 mt-0.5 text-[14px] text-base-content/80">{event.target.detail}</p>
        )}
        {goto && (
          <button
            type="button"
            className="btn btn-ghost btn-sm -ml-2 mt-2 min-h-11 text-primary"
            onClick={() => {
              onClose()
              void navigate(urlOf(routeOf(goto.owner)!))
            }}
          >
            <span>{goto.label}</span>
            <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        )}
      </section>

      {/* 4 · ค่าก่อนและหลัง */}
      <section className="fb-sec" aria-labelledby="act-d-diff-h">
        <h3 id="act-d-diff-h" className="m-0 mb-3 text-[14px] font-semibold text-base-content/70">
          ข้อมูลก่อนและหลังการเปลี่ยนแปลง
        </h3>
        {diff ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-base-300 text-base-content/70">
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    รายการ
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    ก่อน
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    หลัง
                  </th>
                </tr>
              </thead>
              <tbody>
                {diff.map((r) => (
                  <tr key={r.field} className={`act-diff-row ${r.changed ? 'act-diff-on' : ''}`.trim()}>
                    <th scope="row" className="act-diff-k">
                      {r.field}
                    </th>
                    <td className="act-diff-old">{r.before}</td>
                    <td className="act-diff-new">
                      {r.after}
                      {r.changed && (
                        <>
                          {' '}
                          <span className="badge badge-warning badge-sm align-middle">เปลี่ยน</span>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="m-0 text-[14px] text-base-content/60">{NO_CHANGES}</p>
        )}
      </section>

      {/* 5 · หมายเหตุ */}
      <section className="fb-sec" aria-labelledby="act-d-note-h">
        <h3 id="act-d-note-h" className="m-0 mb-2 text-[14px] font-semibold text-base-content/70">
          หมายเหตุและเหตุผล
        </h3>
        <p
          className={`m-0 whitespace-pre-line text-[14px] leading-[1.6] ${
            event.note ? 'text-base-content/90' : 'text-base-content/60'
          }`}
        >
          {event.note ?? NO_NOTE}
        </p>
      </section>
    </Modal>
  )
}
