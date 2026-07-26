// Chart theming helper for the DashWind-derived dashboard charts
// (daisyui-admin-dashboard-template) — MIT (c) 2022 Dashwind. See
// THIRD_PARTY_NOTICES.md. This is OUR addition (not template code): the template
// dashboard was light-only, but this portal flips light/dark via `ThemeLayout`'s
// `data-theme`. Chart.js draws to <canvas> and cannot read CSS classes, so legend
// / tick / grid colours must be passed as options. This hook reads the resolved
// daisyUI tokens off the themed DOM so the chart CHROME tracks the active theme,
// while dataset (series) colours stay fixed brand literals for exact parity.
import { useLayoutEffect, useState, type RefObject } from 'react'
import { useResolvedTheme } from '@/hooks/useResolvedTheme'

export interface ChartThemeColors {
  /** Legend labels + axis tick text — daisyUI `--color-base-content`. */
  readonly text: string
  /** Axis grid lines — daisyUI `--color-base-300`. */
  readonly grid: string
}

/**
 * Neutral fallbacks used before the ref is attached, or when a token cannot be
 * read (e.g. jsdom, or rendered outside a themed subtree). Chosen to stay legible
 * on both light and dark surfaces — and since the dataset colours are fixed, the
 * chart itself is never invisible even if these are used.
 */
const FALLBACK: ChartThemeColors = {
  text: '#64748b', // slate-500
  grid: 'rgba(148, 163, 184, 0.25)', // slate-400 @ 25%
}

function readToken(el: Element, name: string, fallback: string): string {
  const value = getComputedStyle(el).getPropertyValue(name).trim()
  return value || fallback
}

/**
 * Reads `--color-base-content` (text) and `--color-base-300` (grid) from the
 * nearest themed element that `ref` lives inside. Recomputes whenever the admin
 * portal's resolved theme flips (OS light/dark change), so the chart chrome
 * follows the theme. Uses a layout effect to apply the real colours before paint,
 * avoiding a fallback-coloured flash.
 */
export function useChartThemeColors(ref: RefObject<HTMLElement | null>): ChartThemeColors {
  const theme = useResolvedTheme('admin')
  const [colors, setColors] = useState<ChartThemeColors>(FALLBACK)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setColors({
      text: readToken(el, '--color-base-content', FALLBACK.text),
      grid: readToken(el, '--color-base-300', FALLBACK.grid),
    })
  }, [ref, theme])

  return colors
}
