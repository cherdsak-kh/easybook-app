/**
 * Hub 6's list: the table from `xl`, one card per incident below it. Prototype L9218–9235 and the
 * `errlog-tpl-row` / `errlog-tpl-card` templates L9320–9361: Hub 5's split, for Hub 5's measured reason
 * (the eight columns do not fit a 1024px content area).
 *
 * Severity is a `badge` in the file's status hues (CRITICAL red, ERROR amber, WARNING sky, scoped to
 * `.rp-page` as 10% tints); the component is the NEUTRAL outlined `.act-chip`, because it says WHERE and
 * a second colour system beside the severity badge would compete with it. The status is coloured by
 * class (5xx red, 4xx amber), `SYS` when the incident has no HTTP response. Messages are `line-clamp-2`
 * mono with `break-all`: a stack-ish string has no spaces to wrap on.
 *
 * ⚠️ TEXT, NEVER HTML. The message, the path and the trace id arrive scrubbed, but they are still data,
 * and they are text nodes.
 */

import type { IncidentSummary } from '@/lib/api-client'
import { INCIDENT_COMPONENT_LABEL, INCIDENT_SEVERITY } from '../../../labels'
import { pathOf, statusClass, statusLabel, viewLabel } from '../error-log-view'
import { bangkokClockMs, bangkokDateClockSeconds, bangkokDateShort, rowNumber } from '../log-format'

const VIEW_D =
  'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z'

function Severity({ i }: { i: IncidentSummary }) {
  return <span className={`badge badge-sm font-mono ${INCIDENT_SEVERITY[i.severity].badge}`}>{i.severity}</span>
}

function ComponentChip({ i }: { i: IncidentSummary }) {
  return <span className="act-chip px-2 py-0.5 text-[12px]">{INCIDENT_COMPONENT_LABEL[i.component]}</span>
}

export function IncidentTable({
  items,
  page,
  limit,
  onOpen,
}: {
  items: IncidentSummary[]
  page: number
  limit: number
  onOpen: (i: IncidentSummary) => void
}) {
  return (
    <div className="hidden overflow-x-auto xl:block">
      <table className="table rp-table act-table">
        <thead>
          <tr>
            <th scope="col" className="w-14 text-center">
              ลำดับ
            </th>
            <th scope="col">วัน-เวลา</th>
            <th scope="col">ความรุนแรง</th>
            <th scope="col">บริการ / โมดูล</th>
            <th scope="col">สถานะและเส้นทาง</th>
            <th scope="col">ข้อความผิดพลาด</th>
            <th scope="col">Trace ID</th>
            <th scope="col" className="text-center">
              จัดการ
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((i, n) => (
            <tr key={i.id}>
              <td className="w-14 text-center tabular-nums text-base-content/70">
                {rowNumber(page, limit, n)}
              </td>
              <td className="whitespace-nowrap">
                <span className="block text-[14px] text-base-content/90">{bangkokDateShort(i.at)}</span>
                <span className="block font-mono text-[12px] text-base-content/60">{bangkokClockMs(i.at)}</span>
              </td>
              <td>
                <Severity i={i} />
              </td>
              <td>
                <ComponentChip i={i} />
              </td>
              <td>
                <span className="block whitespace-nowrap font-mono text-[13px]">
                  <b className={`font-semibold ${statusClass(i.status)}`}>{statusLabel(i.status)}</b>{' '}
                  <span className="text-base-content/70">{i.method ?? ''}</span>
                </span>
                <span className="block max-w-44 truncate font-mono text-[12px] text-base-content/70" title={pathOf(i)}>
                  {pathOf(i)}
                </span>
              </td>
              <td>
                <span
                  className="line-clamp-2 max-w-60 break-all font-mono text-[12px] leading-[1.55] text-base-content/80"
                  title={i.message}
                >
                  {i.message}
                </span>
              </td>
              <td>
                <span className="whitespace-nowrap font-mono text-[12px] text-base-content/80">{i.traceId}</span>
              </td>
              <td className="text-center">
                <button
                  type="button"
                  onClick={() => onOpen(i)}
                  aria-label={viewLabel(i)}
                  className="btn btn-ghost btn-sm min-h-11 whitespace-nowrap"
                >
                  <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={VIEW_D} />
                  </svg>
                  <span className="hidden 2xl:inline">ดูรายละเอียด</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function IncidentCards({
  items,
  page,
  limit,
  onOpen,
}: {
  items: IncidentSummary[]
  page: number
  limit: number
  onOpen: (i: IncidentSummary) => void
}) {
  return (
    <ul className="m-0 list-none divide-y divide-base-300 p-0 xl:hidden">
      {items.map((i, n) => (
        <li key={i.id}>
          <button
            type="button"
            onClick={() => onOpen(i)}
            aria-label={viewLabel(i)}
            className="flex min-h-11 w-full flex-col gap-2 px-4 py-4 text-left transition-colors hover:bg-base-content/5 active:bg-base-content/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:px-5"
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <Severity i={i} />
                <ComponentChip i={i} />
              </span>
              <span className="shrink-0 whitespace-nowrap font-mono text-[12px] text-base-content/70">
                {bangkokDateClockSeconds(i.at)}
              </span>
            </span>
            <span className="w-full min-w-0 truncate font-mono text-[13px] text-base-content">
              <b className={`font-semibold ${statusClass(i.status)}`}>{statusLabel(i.status)}</b>{' '}
              <span className="text-base-content/70">{i.method ?? ''}</span> <span>{pathOf(i)}</span>
            </span>
            <span className="line-clamp-2 w-full break-all font-mono text-[12px] leading-[1.55] text-base-content/80">
              {i.message}
            </span>
            <span className="flex w-full items-center gap-2 text-[12px] text-base-content/60">
              <span className="tabular-nums">ลำดับ {rowNumber(page, limit, n)}</span>
              <span className="min-w-0 truncate font-mono">{i.traceId}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
