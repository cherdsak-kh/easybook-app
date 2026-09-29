/**
 * ภาพรวมสถิติ's ช่วงเวลา toolbar (AC-R1/AC-R2/AC-R3). Prototype `[data-route="reports-overview"]`
 * ~L7430–7468 — a `join` of 3 radios, a preset `<select>`, and two `<input type="date">`s, all
 * daisyUI's OWN native controls (memory rule: never a custom wrapper here).
 *
 * ⚠️ PURELY CONTROLLED. Every rule in the header ("a preset fills both dates", "editing a date
 * switches the mode to กำหนดเอง") is decided by the PAGE (`ReportsOverviewPage`), which owns `st`
 * the way the prototype's own closure did — this component only renders what it is handed and
 * reports raw events upward.
 */

import type { RangePreset, ReportMode } from '../report-presets'

const MODE_LABEL: Record<ReportMode, string> = {
  term: 'ประจำภาคเรียน',
  month: 'ประจำเดือน',
  custom: 'กำหนดเอง',
}
const MODES: ReportMode[] = ['term', 'month', 'custom']

export function ReportFilterBar({
  mode,
  onModeChange,
  presets,
  presetId,
  onPresetChange,
  from,
  to,
  onFromChange,
  onToChange,
  echo,
  echoError,
}: {
  mode: ReportMode
  onModeChange: (mode: ReportMode) => void
  presets: RangePreset[]
  presetId: string
  onPresetChange: (id: string) => void
  from: string
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
  echo: string
  echoError: boolean
}) {
  return (
    <section className="card mb-4 border border-base-300 bg-base-100 shadow-sm" aria-labelledby="rp-filter-h">
      <div className="card-body gap-3">
        <h2 id="rp-filter-h" className="sr-only">
          ช่วงเวลาของรายงาน
        </h2>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <div className="min-w-0">
            <p id="rp-mode-l" className="label">
              รูปแบบช่วงเวลา
            </p>
            <div className="join w-full sm:w-auto" role="radiogroup" aria-labelledby="rp-mode-l">
              {MODES.map((m) => (
                <input
                  key={m}
                  type="radio"
                  name="rp-mode"
                  value={m}
                  checked={mode === m}
                  onChange={() => onModeChange(m)}
                  className="btn join-item flex-auto whitespace-nowrap px-2.5 sm:flex-none sm:px-4"
                  aria-label={MODE_LABEL[m]}
                />
              ))}
            </div>
          </div>

          <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-3">
            {mode !== 'custom' && (
              <div className="min-w-0">
                <label htmlFor="rp-preset" className="label">
                  {mode === 'month' ? 'เดือน' : 'ภาคเรียน'}
                </label>
                <select
                  id="rp-preset"
                  className="select w-full"
                  value={presetId}
                  onChange={(e) => onPresetChange(e.target.value)}
                >
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="min-w-0">
              <label htmlFor="rp-from" className="label">
                ตั้งแต่วันที่
              </label>
              <input
                id="rp-from"
                type="date"
                className="input w-full tabular-nums"
                value={from}
                onChange={(e) => onFromChange(e.target.value)}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="rp-to" className="label">
                ถึงวันที่
              </label>
              <input
                id="rp-to"
                type="date"
                className={`input w-full tabular-nums ${echoError ? 'input-error' : ''}`}
                aria-describedby="rp-range-echo"
                aria-invalid={echoError || undefined}
                value={to}
                onChange={(e) => onToChange(e.target.value)}
              />
            </div>
          </div>
        </div>
        <p
          id="rp-range-echo"
          aria-live="polite"
          className={`m-0 text-[13px] leading-[1.6] ${echoError ? 'text-error' : 'text-base-content/70'}`}
        >
          {echo}
        </p>
      </div>
    </section>
  )
}
