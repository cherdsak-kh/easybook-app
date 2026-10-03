/**
 * Hub 6's four KPI cards. Prototype L9157–9190.
 *
 *   1 อัตราความพร้อมใช้งาน        real per-day counters (`1 - 5xx / requests`), `—` when none were counted
 *   2 ข้อผิดพลาดในรอบ 24 ชม.      a ROLLING 24 h count, independent of the selected range
 *   3 ข้อผิดพลาดระดับวิกฤต         CRITICAL in range + its latest timestamp
 *   4 ปัญหาเชื่อมต่อบริการภายนอก    LINE OA + Cloudflare R2 + Redis in range, itemised
 *
 * ⚠️ RANGE ONLY (AC-D6): `kpis` is its own request that takes dates and nothing else, so the toolbar can
 * never change them. Every figure is the server's; this file formats and computes nothing.
 */

import type { IncidentKpis } from '@/lib/api-client'
import { availabilityOf, criticalDesc, externalOf, last24hDesc } from '../error-log-view'

const D = {
  shield:
    'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
  clock: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  warn: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  link: 'M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244',
}

function Glyph({ d }: { d: string }) {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

export function IncidentKpiCards({ kpis }: { kpis: IncidentKpis }) {
  const avail = availabilityOf(kpis.availability)
  const ext = externalOf(kpis.external)
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="stats border border-base-300 bg-base-100 shadow-sm">
        <div className="stat">
          <div className="stat-figure bg-success/10 text-success">
            <Glyph d={D.shield} />
          </div>
          <div className="stat-title whitespace-normal">อัตราความพร้อมใช้งาน</div>
          <div className="stat-value flex-wrap">
            <span>{avail.value}</span>
            {avail.badge && <span className={`badge badge-sm ${avail.badge.cls}`}>{avail.badge.text}</span>}
          </div>
          <div className="stat-desc">{avail.desc}</div>
        </div>
      </div>

      <div className="stats border border-base-300 bg-base-100 shadow-sm">
        <div className="stat">
          <div className="stat-figure bg-warning/10 text-warning">
            <Glyph d={D.clock} />
          </div>
          <div className="stat-title whitespace-normal">ข้อผิดพลาดในรอบ 24 ชม.</div>
          <div className="stat-value">
            <span>{kpis.last24h.toLocaleString('en-US')}</span>
            <span className="stat-unit">รายการ</span>
          </div>
          <div className="stat-desc">{last24hDesc(kpis)}</div>
        </div>
      </div>

      <div className="stats border border-base-300 bg-base-100 shadow-sm">
        <div className="stat">
          <div className="stat-figure bg-error/10 text-error">
            <Glyph d={D.warn} />
          </div>
          <div className="stat-title whitespace-normal">ข้อผิดพลาดระดับวิกฤต</div>
          <div className="stat-value flex-wrap">
            <span>{kpis.critical.count.toLocaleString('en-US')}</span>
            <span className="stat-unit">รายการ</span>
            <span className="badge badge-error badge-sm">CRITICAL</span>
          </div>
          <div className="stat-desc">{criticalDesc(kpis.critical)}</div>
        </div>
      </div>

      <div className="stats border border-base-300 bg-base-100 shadow-sm">
        <div className="stat">
          <div className="stat-figure bg-info/10 text-info">
            <Glyph d={D.link} />
          </div>
          <div className="stat-title whitespace-normal">ปัญหาเชื่อมต่อบริการภายนอก</div>
          <div className="stat-value">
            <span>{ext.count.toLocaleString('en-US')}</span>
            <span className="stat-unit">รายการ</span>
          </div>
          <div className="stat-desc">{ext.desc}</div>
        </div>
      </div>
    </div>
  )
}
