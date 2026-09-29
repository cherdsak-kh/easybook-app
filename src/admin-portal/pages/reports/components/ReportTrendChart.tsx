/**
 * `ปริมาณคำขอจองและอัตราการใช้` — prototype `[data-route="reports-overview"]` ~L7537–7566, chart
 * built by `paintChart` (module ~L24301–24371). CSS is `.rp-chart`/`.rp-col`/`.rp-bar` (a custom
 * component — daisyUI has none — ported verbatim into `admin-portal.css`).
 *
 * ⚠️ THE GRAIN TOGGLE NEVER REFETCHES (AC-R10). The API already returns BOTH series in one
 * response (`trend.month`/`trend.week`); this component only switches which array it reads.
 *
 * ⚠️ RESET ON A NEW RANGE, NOT ON EVERY RENDER. The caller remounts this component with
 * `key={data.serverTime}` when a new range is fetched, so `grain`/`pick` start fresh from
 * `trend.defaultGrain` and AC-R9's "latest non-future bucket with data" rule — see
 * `ReportsOverviewPage`.
 */

import { useState } from 'react'
import type { ReportsOverview, ReportTrendBucket } from '@/lib/api-client'
import {
  bucketShortLabel,
  bucketTooltip,
  defaultPickIndex,
  pct0,
  pickLineText,
} from '../report-presets'

type Grain = 'month' | 'week'

function Column({
  bucket,
  grain,
  active,
  max,
  onPick,
  edge,
}: {
  bucket: ReportTrendBucket
  grain: Grain
  active: boolean
  /** The tallest bucket's rounded-up ceiling — every bar's height is a share of this. */
  max: number
  onPick: () => void
  /** `-1` near the left edge, `1` near the right — leans the tooltip bubble inward. */
  edge: -1 | 0 | 1
}) {
  const tip = bucketTooltip(bucket, grain)
  const ariaLabel = tip + (bucket.occupancyPercent == null || bucket.future ? '' : ` · อัตราการใช้ ${pct0(bucket.occupancyPercent)}`)
  return (
    <div
      className={`rp-col tooltip ${bucket.future ? 'rp-col-future' : ''}`}
      data-tip={tip}
      style={edge !== 0 ? { ['--tt-trans' as string]: edge < 0 ? '-12%' : '-88%' } : undefined}
    >
      <button type="button" className="rp-col-hit" aria-pressed={active} aria-label={ariaLabel} onClick={onPick}>
        {bucket.total > 0 && (
          <>
            <span className="rp-col-n">{bucket.total}</span>
            <span className="rp-bar" style={{ height: `${(bucket.total / max) * 88}%` }}>
              {bucket.cancelled > 0 && <span className="rp-seg-cx" style={{ flex: `${bucket.cancelled} 1 0` }} />}
              {bucket.rejected > 0 && <span className="rp-seg-no" style={{ flex: `${bucket.rejected} 1 0` }} />}
              {bucket.approved > 0 && <span className="rp-seg-ok" style={{ flex: `${bucket.approved} 1 0` }} />}
            </span>
          </>
        )}
      </button>
      <span className="rp-col-label">{bucketShortLabel(bucket, grain)}</span>
      <span className="rp-col-occ">{bucket.future || bucket.occupancyPercent == null ? '—' : pct0(bucket.occupancyPercent)}</span>
    </div>
  )
}

export function ReportTrendChart({ data }: { data: ReportsOverview }) {
  const [grain, setGrain] = useState<Grain>(data.trend.defaultGrain === 'MONTH' ? 'month' : 'week')
  const buckets = grain === 'month' ? data.trend.month : data.trend.week
  const [pick, setPick] = useState(() => defaultPickIndex(buckets))

  const changeGrain = (g: Grain) => {
    setGrain(g)
    const next = g === 'month' ? data.trend.month : data.trend.week
    setPick(defaultPickIndex(next))
  }

  const max = Math.max(1, ...buckets.map((b) => b.total))
  const step = Math.max(1, Math.ceil(max / 4))
  const top = step * 4
  const picked = pick >= 0 ? buckets[pick] : null

  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm xl:col-span-3" aria-labelledby="rp-trend-h">
      <div className="card-body">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="rp-trend-h" className="card-title">
              ปริมาณคำขอจองและอัตราการใช้
            </h2>
            <p className="m-0 mt-0.5 text-[13px] text-base-content/70">นับตามวันที่ใช้สถานที่ · แตะแท่งเพื่อดูตัวเลข</p>
          </div>
          <div role="tablist" aria-label="ความละเอียดของกราฟ" className="tabs tabs-box">
            <button
              type="button"
              role="tab"
              className={`tab ${grain === 'month' ? 'tab-active' : ''}`}
              aria-selected={grain === 'month'}
              onClick={() => changeGrain('month')}
            >
              รายเดือน
            </button>
            <button
              type="button"
              role="tab"
              className={`tab ${grain === 'week' ? 'tab-active' : ''}`}
              aria-selected={grain === 'week'}
              onClick={() => changeGrain('week')}
            >
              รายสัปดาห์
            </button>
          </div>
        </div>

        <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[13px] text-base-content/80" aria-label="คำอธิบายสี">
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-success" aria-hidden="true" />
            อนุมัติ
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-error" aria-hidden="true" />
            ปฏิเสธ
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-base-content/25" aria-hidden="true" />
            ยกเลิก
          </li>
          <li className="flex items-center gap-1.5">
            <span className="text-[12px] font-semibold text-primary" aria-hidden="true">
              %
            </span>
            อัตราการใช้สถานที่
          </li>
        </ul>

        <div className="nav-scroll -mx-1 overflow-x-auto px-1 pt-14">
          <div className="rp-chart">
            <div className="rp-chart-plot" aria-hidden="true" />
            {buckets.map((b, i) => (
              <Column
                key={b.from}
                bucket={b}
                grain={grain}
                active={i === pick}
                max={top}
                onPick={() => setPick(i)}
                edge={i < 2 ? -1 : i > buckets.length - 3 ? 1 : 0}
              />
            ))}
          </div>
        </div>

        <p className="m-0 rounded-control bg-base-200 px-3.5 py-2.5 text-[14px] leading-[1.6] text-base-content">
          {pickLineText(picked, grain)}
        </p>
      </div>
    </section>
  )
}
