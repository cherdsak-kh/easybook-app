import { VICON, type VIconName } from './vicon'

/**
 * One heroicons glyph from the registry shared with the admin portal.
 *
 * ⚠️ `strokeLinecap` AND `strokeLinejoin`, both — the admin sets both on every one of these, and
 * these paths are cornered rather than straight. A rounded cap with a mitred corner is a
 * different shape, not a rounding difference.
 *
 * `strokeWidth` is a prop because the admin's own usage varies by position and those values were
 * measured: 1.8 on tags and meta rows, 2 on the closed marker, 1.4 on the large placeholder.
 *
 * Decorative, like every icon in this portal — the Thai text beside it already says the same
 * thing — so `aria-hidden` is forced here rather than left to the caller.
 */
export function VIcon({
  names,
  className,
  strokeWidth = 1.8,
}: {
  /** One or more registry keys, drawn in order into a single `<svg>` (the map pin is two). */
  names: VIconName | readonly VIconName[]
  className?: string
  strokeWidth?: number
}) {
  const keys = typeof names === 'string' ? [names] : names
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      className={className}
    >
      {keys.map((k) => (
        <path key={k} strokeLinecap="round" strokeLinejoin="round" d={VICON[k]} />
      ))}
    </svg>
  )
}
