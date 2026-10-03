/**
 * Hub 5's list: the table from `xl`, one card per event below it. Prototype L8905–8914 (markup) and the
 * `act-tpl-row` / `act-tpl-card` templates L9014–9048.
 *
 * ⚠️ THE TABLE STARTS AT `xl`, NOT THE USUAL `lg`, and that was MEASURED in the prototype: at 1024px the
 * content area is 671px and the columns need ~800 even at `act-table`'s 12px cell padding (daisyUI gives
 * 20), so `lg` would have meant a sideways-scrolling audit log. At 1280 the area is 927px and it fits.
 * Below `xl` every event is one card and the WHOLE card is the button.
 *
 * ⚠️ THE IP / DEVICE COLUMN IS ABSENT WHEN THE SOURCE RECORDS NO IP (`recordsIp`). Synthesis cannot know
 * an address, and a column of dashes under a header that promises one reads as "nobody has an IP".
 *
 * ⚠️ TEXT, NEVER HTML: a booking code, a venue name and a free-text reject reason are text nodes.
 */

import type { AuditEvent } from '@/lib/api-client'
import { AUDIT_ACTION, AUDIT_TARGET_KIND } from '../../../labels'
import { RoleChip } from '../../staff/components/RoleChip'
import { actorView, viewLabel } from '../activity-view'
import { bangkokClock, bangkokDateClock, bangkokDateShort, rowNumber } from '../log-format'
import { ActionBadge } from './ActionBadge'

const VIEW_D =
  'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z'

export function ActivityTable({
  items,
  page,
  limit,
  recordsIp,
  onOpen,
}: {
  items: AuditEvent[]
  page: number
  limit: number
  recordsIp: boolean
  onOpen: (e: AuditEvent) => void
}) {
  return (
    <div className="hidden overflow-x-auto xl:block">
      <table className="table rp-table act-table">
        <thead>
          <tr>
            <th scope="col" className="w-14 text-center">
              ลำดับ
            </th>
            <th scope="col" className="whitespace-nowrap">
              วัน-เวลา
            </th>
            <th scope="col">เจ้าหน้าที่ผู้กระทำ</th>
            <th scope="col">การกระทำ</th>
            <th scope="col">เป้าหมาย</th>
            <th scope="col">สรุปการเปลี่ยนแปลง</th>
            {recordsIp && <th scope="col">IP Address / อุปกรณ์</th>}
            <th scope="col" className="text-center">
              จัดการ
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((e, i) => {
            const actor = actorView(e.actor)
            return (
              <tr key={e.id}>
                <td className="w-14 text-center tabular-nums text-base-content/70">
                  {rowNumber(page, limit, i)}
                </td>
                <td className="whitespace-nowrap">
                  <span className="block text-[14px] text-base-content/90">{bangkokDateShort(e.at)}</span>
                  <span className="block text-[12px] text-base-content/60 tabular-nums">
                    {bangkokClock(e.at)}
                  </span>
                </td>
                <td>
                  <span className="block max-w-36 truncate font-medium" title={actor.name}>
                    {actor.name}
                  </span>
                  {actor.role && (
                    <span className="mt-1 flex items-center">
                      <RoleChip role={actor.role} className="px-2 py-0.5 text-[12px]" />
                    </span>
                  )}
                  {actor.department && (
                    <span className="mt-0.5 block max-w-36 truncate text-[12px] text-base-content/60">
                      {actor.department}
                    </span>
                  )}
                </td>
                <td>
                  <ActionBadge action={e.action} />
                </td>
                <td>
                  <span
                    className="block max-w-36 truncate font-mono text-[13px] text-base-content/90"
                    title={e.target.label}
                  >
                    {e.target.label}
                  </span>
                  <span className="block max-w-36 truncate text-[12px] text-base-content/60">
                    {AUDIT_TARGET_KIND[e.target.kind].label}
                  </span>
                </td>
                <td>
                  <span
                    className="line-clamp-2 max-w-60 text-[13px] leading-[1.55] text-base-content/80"
                    title={e.summary}
                  >
                    {e.summary}
                  </span>
                </td>
                {recordsIp && (
                  <td>
                    <span className="block whitespace-nowrap font-mono text-[13px] text-base-content/80">
                      {e.ip ?? '-'}
                    </span>
                    <span className="block max-w-28 truncate text-[12px] text-base-content/60" title={e.userAgent ?? undefined}>
                      {e.userAgent ?? ''}
                    </span>
                  </td>
                )}
                <td className="text-center">
                  <button
                    type="button"
                    onClick={() => onOpen(e)}
                    aria-label={viewLabel(e, AUDIT_ACTION[e.action].label)}
                    className="btn btn-ghost btn-sm min-h-11 whitespace-nowrap"
                  >
                    <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d={VIEW_D} />
                    </svg>
                    <span className="hidden 2xl:inline">ดูรายละเอียด</span>
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function ActivityCards({
  items,
  recordsIp,
  onOpen,
}: {
  items: AuditEvent[]
  recordsIp: boolean
  onOpen: (e: AuditEvent) => void
}) {
  return (
    <ul className="m-0 list-none divide-y divide-base-300 p-0 xl:hidden">
      {items.map((e) => {
        const actor = actorView(e.actor)
        return (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => onOpen(e)}
              aria-label={viewLabel(e, AUDIT_ACTION[e.action].label)}
              className="flex min-h-11 w-full flex-col gap-2 px-4 py-4 text-left transition-colors hover:bg-base-content/5 active:bg-base-content/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:px-5"
            >
              <span className="flex w-full items-center justify-between gap-2">
                <ActionBadge action={e.action} />
                <span className="shrink-0 whitespace-nowrap text-[13px] text-base-content/70 tabular-nums">
                  {bangkokDateClock(e.at)}
                </span>
              </span>
              <span className="w-full min-w-0">
                <span className="block truncate font-mono text-[14px] font-medium text-base-content">
                  {e.target.label}
                </span>
                {e.target.detail && (
                  <span className="block truncate text-[13px] text-base-content/70">{e.target.detail}</span>
                )}
              </span>
              <span className="line-clamp-2 w-full text-[14px] leading-[1.55] text-base-content/80">
                {e.summary}
              </span>
              <span className="flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-base-content/70">
                <span className="min-w-0 truncate font-medium text-base-content/90">{actor.name}</span>
                {actor.role && <RoleChip role={actor.role} className="px-2 py-0.5 text-[12px]" />}
                {recordsIp && e.ip && <span className="font-mono text-[12px]">{e.ip}</span>}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
