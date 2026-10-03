/**
 * The `ReportFilterBar` state machine (AC-R1/AC-R2/AC-R3), extracted VERBATIM from
 * `ReportsOverviewPage` so Hub 1, Hub 2 and Hub 3 share ONE implementation instead of three copies
 * that could quietly drift (Phase 2 design §3.2). The move is behaviour-preserving — Hub 1 adopts
 * it in the same change with no observable difference (QA re-smokes AC-R1–R3).
 *
 * State is per PAGE INSTANCE (a plain `useState` inside the hook, not a shared store), so leaving
 * a hub's route and coming back resets it to the current term (AC-V2) — the three hubs never
 * share a range with each other.
 */

import { useMemo, useState } from 'react'
import {
  monthPresets,
  termPresets,
  validateRange,
  type RangePreset,
  type ReportMode,
} from './report-presets'

/** Bangkok-assumed local date, `YYYY-MM-DD` — the same convention `thai-date.ts` runs on. */
export function todayIsoLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export interface ReportRangeState {
  today: string
  mode: ReportMode
  presetId: string
  from: string
  to: string
  /** The active preset family for the current `mode` (terms, or months). */
  presets: RangePreset[]
  /** The preset matching `presetId` in `presets`, or `null` in `custom` mode / a stale id. */
  activePreset: RangePreset | null
  /** `null` when sendable (AC-R2); otherwise the client-side validation message. */
  validationError: string | null
  selectPreset: (id: string) => void
  selectMode: (mode: ReportMode) => void
  /** §4.1 Custom Override — editing either date means the preset no longer describes the range. */
  editFrom: (value: string) => void
  editTo: (value: string) => void
  resetToCurrentTerm: () => void
}

/**
 * Where a hub opens, when it is not the current term. ONLY Hub 4 passes one (a deep link from Hubs 1–3
 * or a bookmark, already validated by `parseExportParams`); Hubs 1–3 call the hook with no argument and
 * behave exactly as before.
 */
export interface ReportRangeInitial {
  mode: ReportMode
  presetId: string
  from: string
  to: string
}

export function useReportRange(initial?: ReportRangeInitial): ReportRangeState {
  const today = useMemo(() => todayIsoLocal(), [])
  const terms = useMemo(() => termPresets(today), [today])
  const months = useMemo(() => monthPresets(today, terms[terms.length - 1].from), [today, terms])

  const [mode, setMode] = useState<ReportMode>(initial?.mode ?? 'term')
  const [presetId, setPresetId] = useState(initial?.presetId ?? terms[0].id)
  const [from, setFrom] = useState(initial?.from ?? terms[0].from)
  const [to, setTo] = useState(initial?.to ?? terms[0].to)

  const presets: RangePreset[] = mode === 'month' ? months : terms
  const activePreset = presets.find((p) => p.id === presetId) ?? null
  const validationError = validateRange(from, to)

  const selectPreset = (id: string) => {
    const p = presets.find((x) => x.id === id)
    if (!p) return
    setPresetId(id)
    setFrom(p.from)
    setTo(p.to)
  }

  const selectMode = (m: ReportMode) => {
    setMode(m)
    if (m !== 'custom') {
      const list = m === 'month' ? months : terms
      setPresetId(list[0].id)
      setFrom(list[0].from)
      setTo(list[0].to)
    }
  }

  const editFrom = (v: string) => {
    setMode('custom')
    setFrom(v)
  }
  const editTo = (v: string) => {
    setMode('custom')
    setTo(v)
  }

  const resetToCurrentTerm = () => {
    setMode('term')
    setPresetId(terms[0].id)
    setFrom(terms[0].from)
    setTo(terms[0].to)
  }

  return {
    today,
    mode,
    presetId,
    from,
    to,
    presets,
    activePreset,
    validationError,
    selectPreset,
    selectMode,
    editFrom,
    editTo,
    resetToCurrentTerm,
  }
}
