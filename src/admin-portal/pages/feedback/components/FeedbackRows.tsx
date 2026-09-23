/**
 * One report as a desktop ROW (`fb-row-tpl`, prototype 6259–6325) and as a phone CARD
 * (`fb-card-tpl`, 6328–6350). Same record, same vocabulary, two layouts.
 *
 * ⚠️ THE THREE CAPS ON THE ROW ARE MEASURED IN THE PROTOTYPE (1280px, Noto Sans Thai): venue 90 ·
 * subject 160 · reporter 110, with `h-[63px]` on every multi-line cell so a row with photos is not
 * taller than a row without. The photo chip sits on the SUBJECT line for the same reason. If a column
 * changes, re-measure `scrollWidth === clientWidth` on `.card-scroll` rather than defending a literal.
 *
 * ⚠️ THE ROW'S BUTTON IS A READ, so it is rendered for every role — a VIEWER opens the same record
 * and simply finds no status control inside it.
 *
 * ⚠️ VISIBILITY IS THE CALLER'S `hidden lg:block` / `lg:hidden`. Nothing here carries a breakpoint.
 */

import { Badge } from '../../../components/ui/Badge'
import { FEEDBACK_STATUS, FEEDBACK_TYPE } from '../../../labels'
import { thaiDate, thaiTime } from '../../../lib/thai-date'
import type { FeedbackListItem } from '../feedback-api'
import { ICON } from '../feedback-icons'
import {
  reporterName,
  reporterRoleLine,
  snippet,
  statusLabel,
  thaiAt,
} from '../feedback-record'
import { Glyph } from './FeedbackGlyph'

/** The venue, or the neutral "no venue" chip. `title` sits on the element that truncates. */
function Venue({ item }: { item: FeedbackListItem }) {
  return item.venue ? (
    <span className="fb-venue" title={item.venue.name}>
      {item.venue.name}
    </span>
  ) : (
    <span className="fb-general">ปัญหาทั่วไป</span>
  )
}

/**
 * The photo count on the subject line. NOT RENDERED at zero (rather than `hidden`): `.fb-photos`
 * sets a display, and an absent node cannot lose that fight. `role="img"` so the `aria-label` is
 * actually announced — a label on a bare <span> is ignored by most screen readers.
 */
function Photos({ n }: { n: number }) {
  if (n <= 0) return null
  return (
    <span className="fb-photos" role="img" aria-label={`มีรูปภาพแนบ ${n} รูป`}>
      <Glyph d={ICON.camera} className="h-3.5 w-3.5" />
      <span>{n}</span>
    </span>
  )
}

export function FeedbackRow({
  item,
  index,
  onView,
}: {
  item: FeedbackListItem
  /** The ABSOLUTE position in the filtered set — page 2 at ten rows starts at 11. */
  index: number
  /** Handed the button, so the page can return focus to it after a save. */
  onView: (opener: HTMLElement) => void
}) {
  const who = reporterName(item.reporter)
  const role = reporterRoleLine(item.reporter)
  const status = FEEDBACK_STATUS[item.status]

  return (
    <tr className="group border-b border-base-300/60 transition-colors hover:bg-base-content/5">
      <td className="td-cell td-cell-tight text-center text-base-content/70 tabular-nums">
        {index}
      </td>
      <td className="td-cell td-cell-tight whitespace-nowrap">
        <span className={`fb-code ${FEEDBACK_TYPE[item.type].code}`}>{item.code}</span>
      </td>
      <td className="td-cell td-cell-tight">
        <span className="flex min-w-0 max-w-[90px] items-center">
          <Venue item={item} />
        </span>
      </td>
      <td className="td-cell td-cell-tight">
        <span className="flex h-[63px] min-w-0 max-w-[160px] flex-col justify-center gap-0.5">
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              className="min-w-0 truncate text-[14px] font-semibold text-base-content"
              title={item.subject}
            >
              {item.subject}
            </span>
            <Photos n={item.photoCount} />
          </span>
          <span className="truncate text-[13px] text-base-content/70">
            {snippet(item.description)}
          </span>
        </span>
      </td>
      <td className="td-cell td-cell-tight">
        <span className="flex h-[63px] min-w-0 max-w-[110px] flex-col justify-center gap-0.5">
          <span className="truncate text-[14px] font-medium text-base-content" title={who}>
            {who}
          </span>
          {role && (
            <span className="truncate text-[13px] text-base-content/70" title={role}>
              {role}
            </span>
          )}
          {item.reporter.phone && (
            <span className="truncate text-[13px] text-base-content/70 tabular-nums">
              {item.reporter.phone}
            </span>
          )}
        </span>
      </td>
      <td className="td-cell td-cell-tight">
        <span className="flex flex-col">
          <span className="whitespace-nowrap text-[14px] text-base-content/80">
            {thaiDate(item.createdAt)}
          </span>
          <span className="whitespace-nowrap text-[13px] text-base-content/70 tabular-nums">
            {thaiTime(item.createdAt)} น.
          </span>
        </span>
      </td>
      <td className="td-cell td-cell-tight text-center">
        <Badge tone={status.tone}>{statusLabel(item.status, item.type)}</Badge>
      </td>
      {/* ICON-ONLY below `2xl`, labelled from `2xl` up: the word costs 45px the 1280px table does
          not have. The aria-label and the tooltip carry "ดูข้อมูล" at every width, and `min-w-11`
          keeps the icon a 44px target. */}
      <td data-col="actions" className="td-cell td-cell-tight">
        <div className="mx-auto flex w-fit">
          <button
            type="button"
            onClick={(e) => onView(e.currentTarget)}
            aria-label={`ดูข้อมูลเรื่อง ${item.code} ${item.subject}`}
            data-tip="ดูข้อมูล"
            data-tip-pos="left"
            className="btn-ghost2 min-w-11 whitespace-nowrap px-2.5 text-[13px] 2xl:px-3"
          >
            <Glyph d={ICON.eye} className="h-4 w-4 shrink-0" />
            <span className="hidden 2xl:inline">ดูข้อมูล</span>
          </button>
        </div>
      </td>
    </tr>
  )
}

/**
 * The phone card: ONE full-width target, like every other queue in the portal. ลำดับ is dropped —
 * a numbered list of cards you scroll counts something nobody is pointing at.
 */
export function FeedbackCard({
  item,
  onView,
}: {
  item: FeedbackListItem
  onView: (opener: HTMLElement) => void
}) {
  const who = reporterName(item.reporter)
  const label = statusLabel(item.status, item.type)
  const dept = item.reporter.departmentName

  return (
    <li>
      <button
        type="button"
        onClick={(e) => onView(e.currentTarget)}
        aria-label={`ดูข้อมูลเรื่อง ${item.code} ${item.subject} สถานะ ${label}`}
        className="flex w-full flex-col gap-1.5 p-4 text-left transition-colors hover:bg-base-content/5 active:bg-base-content/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      >
        <span className="flex w-full items-center justify-between gap-2">
          <span className={`fb-code ${FEEDBACK_TYPE[item.type].code}`}>{item.code}</span>
          <Badge tone={FEEDBACK_STATUS[item.status].tone} className="shrink-0">
            {label}
          </Badge>
        </span>
        <span className="flex w-full min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-[15px] font-semibold text-base-content">
            {item.subject}
          </span>
          <Photos n={item.photoCount} />
        </span>
        <span className="flex w-full min-w-0 items-center gap-2 text-[13px] text-base-content/70">
          <span className="flex min-w-0 max-w-[60%] items-center">
            <Venue item={item} />
          </span>
          <span aria-hidden="true">·</span>
          <span className="whitespace-nowrap tabular-nums">{thaiAt(item.createdAt)}</span>
        </span>
        <span className="w-full truncate text-[13px] text-base-content/70">
          {dept ? `${who} · ${dept}` : who}
        </span>
      </button>
    </li>
  )
}
