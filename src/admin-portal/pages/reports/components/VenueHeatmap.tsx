/**
 * `ความหนาแน่นตามช่วงเวลา (จันทร์–ศุกร์)` — the 8 × 5 = 40-cell heatmap, prototype ~L7935–7970 (AC-V8,
 * AC-V10, AC-V11).
 *
 * ⚠️ 40 REAL `<button>`s, each ≥ 44px (`rv-heat-cell` = `min-h-11`), inside a horizontal scroller for
 * the narrow case. Days are COLUMNS so five fit a 390px phone beside the time labels. Tap = read the
 * numbers in the pick line; hover / long-press = the native `title` tooltip.
 *
 * ⚠️ THE VENUE SELECTOR DOES NOT REFETCH. Every venue's 40 cells are already in `data`, so switching
 * repaints from memory (`scopeCells`). `scope` is lifted to the page so it survives รีเฟรช; the PICKED
 * cell lives here and resets when the page re-keys this component on a range change.
 */

import { useMemo, useState } from 'react'
import type { ReportsVenues } from '@/lib/api-client'
import {
  HEAT_LEVEL_CLASSES,
  HEAT_SLOTS,
  TH_DAY,
  TH_DAY_SHORT,
  cellLabel,
  densityPct0,
  hasAnyUse,
  heatBadgeText,
  heatLevel,
  peakOf,
  pickLineText,
  quietOf,
  scopeCells,
  slotLabel,
  slotStart,
  venueOptions,
} from '../report-venues-view'

const LEGEND: readonly string[] = ['ว่าง 0%', '1–30%', '31–60%', '61–85%', 'มากกว่า 85% (จุดพีค)']

export function VenueHeatmap({
  data,
  scope,
  onScopeChange,
}: {
  data: ReportsVenues
  /** `'all'` or a venue id. The page has already fallen back to `'all'` for a vanished venue. */
  scope: string
  onScopeChange: (scope: string) => void
}) {
  const [picked, setPicked] = useState<number | null>(null)

  const options = useMemo(() => venueOptions(data.venues), [data.venues])
  const cells = useMemo(() => scopeCells(data, scope), [data, scope])
  const peak = peakOf(cells)
  const quiet = quietOf(cells)
  const scopeName = options.find((o) => o.value === scope)?.label ?? options[0].label

  // A tapped cell survives a refresh only while it still has a density; otherwise the peak.
  const pickedCell = picked != null && cells[picked].density != null ? cells[picked] : peak
  const anyUse = hasAnyUse(cells)

  return (
    <section className="card mt-4 border border-base-300 bg-base-100 shadow-sm" aria-labelledby="rv-heat-h">
      <div className="card-body">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 id="rv-heat-h" className="card-title">
              ความหนาแน่นตามช่วงเวลา (จันทร์–ศุกร์)
            </h2>
            <p className="m-0 mt-0.5 text-[13px] text-base-content/70">
              ร้อยละของเวลาที่ถูกจองในแต่ละชั่วโมง · แตะช่องเพื่อดูตัวเลข
            </p>
          </div>
          <div className="w-full min-w-0 sm:w-72">
            <label htmlFor="rv-heat-venue" className="label">
              สถานที่
            </label>
            <select
              id="rv-heat-venue"
              className="select select-bordered min-h-11 w-full"
              value={scope}
              onChange={(e) => {
                setPicked(null)
                onScopeChange(e.target.value)
              }}
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="nav-scroll -mx-1 overflow-x-auto px-1">
          <div className="rv-heat" role="group" aria-labelledby="rv-heat-h">
            <span />
            {TH_DAY.map((full, d) => (
              <span key={full} className="rv-heat-day">
                <span className="sm:hidden">{TH_DAY_SHORT[d]}</span>
                <span className="hidden sm:inline">{full}</span>
              </span>
            ))}
            {Array.from({ length: HEAT_SLOTS }, (_, j) => (
              <RowFragment key={j} j={j}>
                {TH_DAY.map((_full, d) => {
                  const c = cells[d * HEAT_SLOTS + j]
                  const label = cellLabel(c)
                  return (
                    <button
                      key={c.i}
                      type="button"
                      className={`rv-heat-cell ${HEAT_LEVEL_CLASSES[heatLevel(c.density)]}`}
                      aria-pressed={pickedCell?.i === c.i}
                      title={label}
                      aria-label={label}
                      onClick={() => setPicked(c.i)}
                    >
                      {densityPct0(c.density)}
                    </button>
                  )
                })}
              </RowFragment>
            ))}
          </div>
        </div>

        <p className="m-0 rounded-control bg-base-200 px-3.5 py-2.5 text-[14px] leading-[1.6] text-base-content">
          {pickLineText(anyUse ? pickedCell : null, scopeName)}
        </p>

        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <ul
            className="m-0 flex list-none flex-wrap gap-x-3.5 gap-y-1.5 p-0 text-[12px] text-base-content/80"
            aria-label="ระดับความหนาแน่น"
          >
            {LEGEND.map((text, level) => (
              <li key={text} className="flex items-center gap-1.5">
                {/* The SAME strings the cells carry (`HEAT_LEVEL_CLASSES`), so legend and grid cannot drift. */}
                <span
                  aria-hidden="true"
                  className={`h-3.5 w-5 rounded-[4px] ${HEAT_LEVEL_CLASSES[level]} ${level === 0 ? 'border border-base-300' : ''}`.trim()}
                />
                {text}
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-1.5 text-[13px] text-base-content/80 sm:flex-row sm:flex-wrap sm:gap-x-4">
            <p className="m-0 flex items-center gap-1.5">
              <span className="badge badge-warning badge-sm shrink-0">ช่วงพีค</span>
              <span className="tabular-nums">{heatBadgeText(peak, true)}</span>
            </p>
            <p className="m-0 flex items-center gap-1.5">
              <span className="badge badge-ghost badge-sm shrink-0">ว่างที่สุด</span>
              <span className="tabular-nums">{heatBadgeText(quiet, false)}</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

/** One time row: the label, then its five cells — a fragment, so they stay direct grid items. */
function RowFragment({ j, children }: { j: number; children: React.ReactNode }) {
  return (
    <>
      <span className="rv-heat-time">
        <span className="sm:hidden">{slotStart(j)}</span>
        <span className="hidden sm:inline">{slotLabel(j)}</span>
      </span>
      {children}
    </>
  )
}
