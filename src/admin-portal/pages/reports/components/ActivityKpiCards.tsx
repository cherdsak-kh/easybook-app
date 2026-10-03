/**
 * Hub 5's four KPI cards. Prototype L8820–8867 (`stats` / `stat`, the existing unlayered P1 rules).
 *
 * ⚠️ THEY FOLLOW THE RANGE ONLY, never the toolbar (AC-A4): `kpis` comes from its own request that takes
 * dates and nothing else, so a search or a filter cannot move them. A KPI that shrank with the search box
 * would stop being a picture of the period, and "most active operator" would always be whoever the actor
 * filter names.
 *
 * ⚠️ KPI 3 IS `—` UNTIL THE SOURCE RECORDS VENUE CHANGES (`resourceChanges === null`, D-14), with its
 * reason both as the `title` AND as the visible description: a tooltip does not exist on a phone, and
 * this app lives in a LINE webview. The same for the name KPI: the actor is a NAME, 18px, and wraps.
 */

import type { AuditKpis } from '@/lib/api-client'
import { decisionsOf, resourceOf, topActorOf, totalDesc, RESOURCE_UNRECORDED } from '../activity-view'

const D = {
  total: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  decisions: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  resources:
    'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21',
  top: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
}

function Glyph({ d }: { d: string }) {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

export function ActivityKpiCards({ kpis }: { kpis: AuditKpis }) {
  const decisions = decisionsOf(kpis)
  const resource = resourceOf(kpis)
  const top = topActorOf(kpis)
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="stats border border-base-300 bg-base-100 shadow-sm">
        <div className="stat">
          <div className="stat-figure bg-info/10 text-info">
            <Glyph d={D.total} />
          </div>
          <div className="stat-title">รายการกระทำทั้งหมด</div>
          <div className="stat-value">
            <span>{kpis.total.toLocaleString('en-US')}</span>
            <span className="stat-unit">รายการ</span>
          </div>
          <div className="stat-desc">{totalDesc(kpis)}</div>
        </div>
      </div>

      <div className="stats border border-base-300 bg-base-100 shadow-sm">
        <div className="stat">
          <div className="stat-figure bg-success/10 text-success">
            <Glyph d={D.decisions} />
          </div>
          <div className="stat-title">การตัดสินใจคำขอจอง</div>
          <div className="stat-value">
            <span>{decisions.count.toLocaleString('en-US')}</span>
            <span className="stat-unit">รายการ</span>
          </div>
          <div className="stat-desc">{decisions.desc}</div>
        </div>
      </div>

      <div className="stats border border-base-300 bg-base-100 shadow-sm">
        <div className="stat">
          <div className="stat-figure bg-warning/10 text-warning">
            <Glyph d={D.resources} />
          </div>
          <div className="stat-title">การปรับปรุงทรัพยากร</div>
          <div className="stat-value" title={kpis.resourceChanges === null ? RESOURCE_UNRECORDED : undefined}>
            <span>{resource.value}</span>
            {kpis.resourceChanges !== null && <span className="stat-unit">รายการ</span>}
          </div>
          <div className="stat-desc">{resource.desc}</div>
        </div>
      </div>

      <div className="stats border border-base-300 bg-base-100 shadow-sm">
        <div className="stat">
          <div className="stat-figure bg-primary/10 text-primary">
            <Glyph d={D.top} />
          </div>
          <div className="stat-title whitespace-normal">เจ้าหน้าที่ที่มีการทำรายการสูงสุด</div>
          <div className="stat-value stat-value-name-sm flex-wrap">
            <span className="min-w-0">{top.name}</span>
            {top.badge && <span className="badge badge-primary badge-sm tabular-nums">{top.badge}</span>}
          </div>
          <div className="stat-desc">{top.desc}</div>
        </div>
      </div>
    </div>
  )
}
