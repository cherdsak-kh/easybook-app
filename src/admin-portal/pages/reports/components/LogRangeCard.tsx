/**
 * The `ช่วงเวลา` card of Hub 5 and Hub 6. Prototype L8756–8794 (Hub 5) and L9127–9151 (Hub 6).
 *
 * A `join` of preset radios (daisyUI's own `btn` radios), then, ONLY while กำหนดเอง is chosen, two
 * inline native date inputs, and the echo line. Hub 5 offers five presets (it has ภาคเรียนปัจจุบัน),
 * Hub 6 four; the caller passes the list and the card renders it.
 *
 * ⚠️ THE JOIN WRAPS BELOW `sm` (`.act-range`, admin-portal.css C-7): five presets are 407px of joined
 * strip in a 317px card on a 375px phone. From `sm` up it is the joined strip.
 *
 * ⚠️ THE ECHO LINE IS `aria-live` AND IS THE ERROR CHANNEL: an inverted range replaces it with the
 * refusal in `text-error` and the `to` input carries `input-error` + `aria-invalid`, while the page keeps
 * showing the last valid range (see `useLogRange`). Every control is `min-h-11`.
 *
 * The `id`s and `name` take a prefix so Hub 5 and Hub 6 never collide if both are ever mounted.
 */

import type { ReactNode } from 'react'
import { LOG_PRESET_LABEL, type LogPreset } from '../log-range'
import type { LogRangeState } from '../use-log-range'

export function LogRangeCard({
  idPrefix,
  presets,
  range,
  echo,
}: {
  idPrefix: string
  presets: readonly LogPreset[]
  range: LogRangeState
  /** The echo text, already composed (the page owns "last updated" and the live/retention tails). */
  echo: ReactNode
}) {
  const labelId = `${idPrefix}-range-l`
  const echoId = `${idPrefix}-range-echo`
  const bad = range.error !== null
  return (
    <section className="card mb-4 border border-base-300 bg-base-100 shadow-sm" aria-labelledby={labelId}>
      <div className="card-body gap-3">
        {/* WRAPS rather than switching at `lg`: with the dates open the controls are ~837px, so the
            echo line gives way and drops below instead of pushing the dates onto a row of its own. */}
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <p id={labelId} className="label">
              ช่วงเวลา
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="join act-range w-full sm:w-auto" role="radiogroup" aria-labelledby={labelId}>
                {presets.map((p) => (
                  <input
                    key={p}
                    type="radio"
                    name={`${idPrefix}-range`}
                    value={p}
                    checked={range.preset === p}
                    onChange={() => range.select(p)}
                    className="btn join-item min-h-11 flex-auto whitespace-nowrap px-2.5 sm:flex-none sm:px-4"
                    aria-label={LOG_PRESET_LABEL[p]}
                  />
                ))}
              </div>
              {range.preset === 'custom' && (
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor={`${idPrefix}-from`} className="sr-only">
                    ตั้งแต่วันที่
                  </label>
                  <input
                    id={`${idPrefix}-from`}
                    type="date"
                    className="input input-bordered min-h-11 min-w-0 flex-1 tabular-nums sm:w-40 sm:flex-none"
                    value={range.draftFrom}
                    min={range.min}
                    max={range.max}
                    onChange={(e) => range.editFrom(e.target.value)}
                  />
                  <span className="text-[13px] text-base-content/60">ถึง</span>
                  <label htmlFor={`${idPrefix}-to`} className="sr-only">
                    ถึงวันที่
                  </label>
                  <input
                    id={`${idPrefix}-to`}
                    type="date"
                    className={`input input-bordered min-h-11 min-w-0 flex-1 tabular-nums sm:w-40 sm:flex-none ${bad ? 'input-error' : ''}`.trim()}
                    value={range.draftTo}
                    min={range.min}
                    max={range.max}
                    aria-describedby={echoId}
                    aria-invalid={bad || undefined}
                    onChange={(e) => range.editTo(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
          <p
            id={echoId}
            aria-live="polite"
            className={`m-0 min-w-64 flex-1 text-[13px] leading-[1.6] lg:text-right ${bad ? 'text-error' : 'text-base-content/70'}`}
          >
            {bad ? range.error : echo}
          </p>
        </div>
      </div>
    </section>
  )
}
