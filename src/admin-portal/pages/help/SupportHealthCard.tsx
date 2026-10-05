/**
 * Zone 1 of ติดต่อทีมผู้พัฒนา — สถานะการทำงานของระบบ. "Is it us or is it them?" before anyone writes a
 * report: four probe tiles, the VERDICT only. The การเชื่อมต่อระบบ screen owns keys and switches and is
 * closed to VIEWER; this one is open to every role, so it never shows more than the verdict plus the
 * numbers the server chose to send for that role (see `buildProbeTiles`).
 *
 * ⚠️ A BADGE ALONE WOULD BE COLOUR-ONLY. The word inside it ("ขัดข้อง", "ไม่ทราบสถานะ") is the meaning.
 *
 * ⚠️ THE RECHECK BUTTON IS NEVER `disabled`. `disabled` blurs the element it is set on, which would
 * drop a keyboard user on `<body>` the moment they pressed it. It goes `aria-disabled` + `btn-disabled`
 * instead, so focus stays on the button through the whole probe.
 */

import { Spinner } from '../../components/feedback/Spinner'
import { Card, CardBody, CardHead } from '../../components/ui/Card'
import {
  buildProbeTiles,
  healthFooter,
  type ProbeKey,
  type ProbeState,
  type ProbeTone,
} from './support-model'

const ICON: Record<ProbeKey, string> = {
  db: 'M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125',
  line: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
  r2: 'M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z',
  api: 'M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z',
}

const REFRESH_ICON =
  'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99'

const BADGE: Record<ProbeTone, string> = {
  success: 'badge-success',
  error: 'badge-error',
  neutral: 'badge-neutral',
}

export function SupportHealthCard({
  state,
  pending,
  onRecheck,
}: {
  state: ProbeState
  pending: boolean
  onRecheck: () => void
}) {
  const tiles = buildProbeTiles(state)

  return (
    <Card className="overflow-hidden" aria-labelledby="sp-health-title">
      <CardHead
        id="sp-health-title"
        title="สถานะการทำงานของระบบ"
        subtitle="ตรวจสอบก่อนแจ้งปัญหา หากทุกส่วนทำงานปกติ ปัญหาอาจอยู่ที่อุปกรณ์หรือเครือข่ายของคุณ"
        action={
          <button
            type="button"
            className={`btn btn-sm ${pending ? 'btn-disabled' : ''}`.trim()}
            aria-disabled={pending}
            aria-busy={pending || undefined}
            // The busy wording goes to assistive tech only: swapping the visible label is what
            // makes a button change width mid-click.
            aria-label={pending ? 'กำลังตรวจสอบสถานะระบบ' : undefined}
            onClick={() => {
              if (!pending) onRecheck()
            }}
          >
            {pending ? (
              <Spinner />
            ) : (
              <svg
                aria-hidden="true"
                className="h-4.5 w-4.5 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={REFRESH_ICON} />
              </svg>
            )}
            <span>ตรวจสอบอีกครั้ง</span>
          </button>
        }
      />
      <CardBody>
        <ul
          aria-busy={pending || undefined}
          aria-labelledby="sp-health-title"
          className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 xl:grid-cols-4"
        >
          {tiles.map((tile) => (
            <li
              key={tile.key}
              className="flex min-w-0 items-start gap-3 rounded-control border border-base-300 bg-base-100 p-3.5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-base-200 text-base-content/70">
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={ICON[tile.key]} />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium leading-[1.4] text-base-content">
                  {tile.name}
                </span>
                <span className="block text-[12px] leading-[1.4] text-base-content/70">
                  {tile.tech}
                </span>
                <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={`badge badge-sm ${BADGE[tile.tone]}`}>{tile.word}</span>
                  {tile.detail && (
                    <span className="text-[12px] tabular-nums text-base-content/70">
                      {tile.detail}
                    </span>
                  )}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p role="status" className="m-0 mt-3 text-[13px] leading-[1.45] text-base-content/70">
          {healthFooter(state)}
        </p>
      </CardBody>
    </Card>
  )
}
