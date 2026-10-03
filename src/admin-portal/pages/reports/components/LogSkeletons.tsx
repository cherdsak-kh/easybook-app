/**
 * The loading shapes of Hub 5 and Hub 6 (prototype `[data-panel="loading"]` L8998–9020 / L9301–9317):
 * four KPI tiles and a toolbar-plus-rows card, in the footprint of what replaces them so nothing moves
 * when the data arrives. A skeleton earns its place only by matching the shape of the real thing.
 *
 * Decorative and `aria-hidden`; the region carries `aria-busy` and ONE `sr-only` status line.
 */

import { SkeletonRegion } from '../../../components/feedback/Skeleton'

/** Four KPI tiles. Also used on its own while only the KPIs are pending. */
export function KpiSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
      <div className="rounded-card border border-base-300 bg-base-100 p-5">
        <span className="sk-soft block h-3.5 w-32" />
        <span className="sk-box mt-3 block h-8 w-20" />
        <span className="sk-soft mt-3 block h-3 w-40" />
      </div>
      <div className="rounded-card border border-base-300 bg-base-100 p-5">
        <span className="sk-soft block h-3.5 w-28" />
        <span className="sk-box mt-3 block h-8 w-16" />
        <span className="sk-soft mt-3 block h-3 w-44" />
      </div>
      <div className="rounded-card border border-base-300 bg-base-100 p-5">
        <span className="sk-soft block h-3.5 w-28" />
        <span className="sk-box mt-3 block h-8 w-16" />
        <span className="sk-soft mt-3 block h-3 w-36" />
      </div>
      <div className="rounded-card border border-base-300 bg-base-100 p-5">
        <span className="sk-soft block h-3.5 w-36" />
        <span className="sk-box mt-3 block h-6 w-40" />
        <span className="sk-soft mt-3 block h-3 w-32" />
      </div>
    </div>
  )
}

/** The toolbar strip of the list card. */
export function ToolbarSkeleton() {
  return (
    <div className="flex gap-3 border-b border-base-300 p-4 lg:p-5" aria-hidden="true">
      <span className="sk-box block h-11 flex-1" />
      <span className="sk-box hidden h-11 w-52 lg:block" />
      <span className="sk-box hidden h-11 w-52 lg:block" />
    </div>
  )
}

/** Rows of the list card: a date, a two-line body, a badge. */
export function RowsSkeleton({ rows = 4 }: { rows?: number }) {
  const widths = ['w-2/5', 'w-3/5', 'w-1/2', 'w-2/3']
  const subs = ['w-3/5', 'w-4/5', 'w-2/3', 'w-1/2']
  return (
    <ul className="m-0 list-none divide-y divide-base-300 p-0" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-4 px-4 py-4 lg:px-5">
          <span className="sk-soft block h-3.5 w-24 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className={`sk block h-3.5 ${widths[i % widths.length]}`} />
            <span className={`sk-soft mt-2.5 block h-3 ${subs[i % subs.length]}`} />
          </span>
          <span className="sk-box block h-6 w-24 shrink-0" />
        </li>
      ))}
    </ul>
  )
}

/** The whole page's first load. */
export function LogPageSkeleton({ label }: { label: string }) {
  return (
    <SkeletonRegion label={label}>
      <KpiSkeleton />
      <div className="mt-4 rounded-card border border-base-300 bg-base-100">
        <ToolbarSkeleton />
        <RowsSkeleton />
      </div>
    </SkeletonRegion>
  )
}
