/**
 * Hub 4, step 2: `2. ช่วงเวลาของข้อมูล`. Prototype ~L8592–8620: the mode `join`, the preset `select`
 * (hidden for กำหนดเอง) and two date `input`s, then the echo line.
 *
 * ⚠️ THIS IS `ReportFilterBar`'S MARKUP WITHOUT ITS CARD, and the copy is deliberate. Hub 4 puts all
 * three steps in ONE card (the prototype's studio), while `ReportFilterBar` is a card of its own, and
 * the design lists that file as untouchable (Hubs 1 to 3 depend on it). What is shared is the part
 * that carries rules: `useReportRange` (the state machine), `report-presets` (the families and
 * `validateRange`) and `rangeEcho`. Nothing here decides anything; it renders and reports upward.
 *
 * Every control is `min-h-11` (44px): daisyUI's own field height is 40px, which `ReportFilterBar`
 * accepts on a desktop table page and this studio, used on phones, does not.
 */

import type { RangePreset, ReportMode } from '../report-presets'

const MODE_LABEL: Record<ReportMode, string> = {
  term: 'ประจำภาคเรียน',
  month: 'ประจำเดือน',
  custom: 'กำหนดเอง',
}
const MODES: ReportMode[] = ['term', 'month', 'custom']

export function ExportRangeFields({
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
    <div className="min-w-0">
      <p id="rpe-mode-l" className="label">
        2. ช่วงเวลาของข้อมูล
      </p>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="join w-full sm:w-auto" role="radiogroup" aria-labelledby="rpe-mode-l">
          {MODES.map((m) => (
            <input
              key={m}
              type="radio"
              name="rpe-mode"
              value={m}
              checked={mode === m}
              onChange={() => onModeChange(m)}
              className="btn join-item min-h-11 flex-auto whitespace-nowrap px-2.5 sm:flex-none sm:px-4"
              aria-label={MODE_LABEL[m]}
            />
          ))}
        </div>
        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-3">
          {mode !== 'custom' && (
            <div className="min-w-0">
              <label htmlFor="rpe-preset" className="label">
                {mode === 'month' ? 'เดือน' : 'ภาคเรียน'}
              </label>
              <select
                id="rpe-preset"
                className="select select-bordered min-h-11 w-full"
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
            <label htmlFor="rpe-from" className="label">
              ตั้งแต่วันที่
            </label>
            <input
              id="rpe-from"
              type="date"
              className="input input-bordered min-h-11 w-full tabular-nums"
              value={from}
              onChange={(e) => onFromChange(e.target.value)}
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="rpe-to" className="label">
              ถึงวันที่
            </label>
            <input
              id="rpe-to"
              type="date"
              className={`input input-bordered min-h-11 w-full tabular-nums ${echoError ? 'input-error' : ''}`.trim()}
              aria-describedby="rpe-range-echo"
              aria-invalid={echoError || undefined}
              value={to}
              onChange={(e) => onToChange(e.target.value)}
            />
          </div>
        </div>
      </div>
      <p
        id="rpe-range-echo"
        aria-live="polite"
        className={`m-0 mt-2 text-[13px] leading-[1.6] ${echoError ? 'text-error' : 'text-base-content/70'}`}
      >
        {echo}
      </p>
    </div>
  )
}
