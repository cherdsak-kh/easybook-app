/**
 * Hub 5 and Hub 6's range state (AC-A2 / AC-D7): the quick presets plus กำหนดเอง with two inline dates.
 *
 * ⚠️ TWO RANGES, ONE VISIBLE. `from`/`to` are the COMMITTED range (what the page fetches) and
 * `draftFrom`/`draftTo` are what the date inputs show. They differ only while the user is mid-typing an
 * invalid range: an inverted or over-wide pair is refused WHERE IT IS TYPED (`error`, `input-error`) and
 * the page keeps showing the last valid range instead of an empty or broken one. A missing date is the
 * same case (clearing a field to retype it must not fire a request).
 *
 * ⚠️ TYPING A DATE IS CHOOSING กำหนดเอง, and a preset writes its dates into the (hidden) inputs, so
 * opening กำหนดเอง starts from the range already on screen.
 *
 * State is per page instance, so leaving the route resets it (AC-A11).
 */

import { useCallback, useMemo, useState } from 'react'
import {
  LOG_DEFAULT_PRESET,
  logDateBounds,
  logPresetRange,
  validateLogRange,
  type LogPreset,
} from './log-range'
import { todayIsoLocal } from './use-report-range'

export interface LogRangeState {
  today: string
  preset: LogPreset
  /** The committed, valid range the page fetches. */
  from: string
  to: string
  /** What the inline date inputs hold (may be an invalid pair). */
  draftFrom: string
  draftTo: string
  /** The refusal for the draft, or `null`. */
  error: string | null
  min: string
  max: string
  select: (preset: LogPreset) => void
  editFrom: (value: string) => void
  editTo: (value: string) => void
  /** Back to the default preset (`30 วันล่าสุด`): the empty states' escape hatch. */
  reset: () => void
}

export function useLogRange(): LogRangeState {
  const today = useMemo(() => todayIsoLocal(), [])
  const initial = useMemo(() => logPresetRange(LOG_DEFAULT_PRESET, today), [today])

  const [preset, setPreset] = useState<LogPreset>(LOG_DEFAULT_PRESET)
  const [range, setRange] = useState(initial)
  const [draft, setDraft] = useState(initial)
  const [error, setError] = useState<string | null>(null)

  const select = useCallback(
    (p: LogPreset) => {
      setPreset(p)
      if (p === 'custom') return // keeps the range on screen; the inputs take over
      const r = logPresetRange(p, today)
      setRange(r)
      setDraft(r)
      setError(null)
    },
    [today],
  )

  const edit = useCallback(
    (next: { from: string; to: string }) => {
      setPreset('custom')
      setDraft(next)
      const err = validateLogRange(next.from, next.to)
      setError(err)
      if (!err) setRange(next)
    },
    [],
  )

  const editFrom = useCallback((value: string) => edit({ from: value, to: draft.to }), [edit, draft.to])
  const editTo = useCallback((value: string) => edit({ from: draft.from, to: value }), [edit, draft.from])

  const reset = useCallback(() => select(LOG_DEFAULT_PRESET), [select])

  const { min, max } = useMemo(() => logDateBounds(today), [today])

  return {
    today,
    preset,
    from: range.from,
    to: range.to,
    draftFrom: draft.from,
    draftTo: draft.to,
    error,
    min,
    max,
    select,
    editFrom,
    editTo,
    reset,
  }
}
