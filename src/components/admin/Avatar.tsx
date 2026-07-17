import { useState } from 'react'
import { UI_STRINGS } from '@/constants/ui-strings-backend'

/**
 * The ONE avatar renderer for the back-office portal (header, staff rows,
 * profile). Every surface that shows a person's picture goes through this, so the
 * null-picture fallback and the broken-image recovery exist exactly once.
 *
 * Three states, in priority order:
 *  1. `src` present and loading/loaded → the picture.
 *  2. `src` present but the request FAILED (404 — the R2 bucket is public-read,
 *     but an object can go missing) → the fallback.
 *  3. `src` null/empty → the fallback.
 *
 * The fallback is initials on a deterministic colour: the same person keeps the
 * same colour across renders, routes and reloads, because the hue is a pure
 * function of `colorKey`/`name` rather than random or index-based.
 */

/**
 * FIXED dimensions per size — width and height always match, so a non-square
 * source is cropped by `object-cover` rather than stretched.
 */
const SIZE = {
  sm: { box: 'h-8 w-8', text: 'text-[0.625rem]' },
  md: { box: 'h-10 w-10', text: 'text-xs' },
  lg: { box: 'h-20 w-20', text: 'text-xl' },
} as const

export type AvatarSize = keyof typeof SIZE

/**
 * Fallback badge colours. Each entry pairs a light-mode and a dark-mode variant
 * that both clear WCAG AA against their own background (a `-100`/`-800` pair on
 * white; a translucent `-500/20` over slate with `-200` text in dark).
 *
 * Length is deliberately a power of two so the hash distributes evenly.
 */
const PALETTE = [
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
  'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200',
  'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200',
  'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
  'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
  'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-200',
] as const

/**
 * djb2. Not cryptographic and not meant to be — it only has to be STABLE and
 * evenly spread, so the same key always lands on the same swatch.
 */
function hashKey(key: string): number {
  let h = 5381
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h + key.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/**
 * First + last word initial ("Ada Lovelace" → "AL"), spread with `Array.from` so
 * an astral/Thai first character survives instead of splitting into half a
 * surrogate pair.
 *
 * Deliberately NOT exported: this file must export components only, or Vite's
 * fast refresh degrades to a full reload (and oxlint fails the build on it).
 * Tests assert the rendered initials through `Avatar` instead.
 */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return UI_STRINGS.avatar.unknownInitials
  const first = Array.from(parts[0])[0] ?? ''
  if (parts.length === 1) return first.toUpperCase()
  const last = Array.from(parts[parts.length - 1])[0] ?? ''
  return `${first}${last}`.toUpperCase()
}

export interface AvatarProps {
  /** The stored picture URL. `null` (no picture set) renders the fallback. */
  src?: string | null
  /** Full display name — drives the initials AND the fallback colour. */
  name: string
  /**
   * Stable identity for the colour hash. Defaults to `name`; pass the user id
   * where the colour should survive a rename.
   */
  colorKey?: string
  size?: AvatarSize
  /**
   * Accessible name. OMIT this where an adjacent element already names the
   * person (the header account block, a staff row): the avatar is then purely
   * decorative and is hidden from assistive tech rather than announced twice.
   */
  alt?: string
  className?: string
}

export function Avatar({ src, name, colorKey, size = 'md', alt, className = '' }: AvatarProps) {
  /**
   * The `src` that failed, NOT a boolean. Comparing the failed URL against the
   * current one means a later upload re-arms the `<img>` on its own — a flag
   * would latch the fallback on forever and hide the new picture.
   */
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const { box, text } = SIZE[size]

  const usable = src && failedSrc !== src

  if (usable) {
    return (
      <img
        src={src}
        // Undefined alt → decorative. Empty string, never a missing attribute.
        alt={alt ?? ''}
        onError={() => setFailedSrc(src)}
        data-testid="avatar-image"
        className={`${box} shrink-0 rounded-full bg-slate-100 object-cover ring-1 ring-slate-900/5 dark:bg-slate-800 dark:ring-white/10 ${className}`}
      />
    )
  }

  return (
    <span
      // Mirrors the <img>: named when `alt` is given, invisible to AT otherwise.
      {...(alt ? { role: 'img', 'aria-label': alt } : { 'aria-hidden': true })}
      data-testid="avatar-fallback"
      className={`${box} ${text} ${PALETTE[hashKey(colorKey ?? name) % PALETTE.length]} inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold uppercase leading-none ring-1 ring-slate-900/5 dark:ring-white/10 ${className}`}
    >
      {initialsOf(name)}
    </span>
  )
}
