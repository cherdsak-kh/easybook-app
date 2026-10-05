/**
 * The prototype's inline `<svg><path/></svg>`, with the two things that vary — the path and the
 * stroke — as props. Always `aria-hidden`: every icon in the guide sits beside text that says the
 * same thing.
 *
 * `join={false}` omits `stroke-linejoin`, which the prototype's chevron/arrow glyphs do not set.
 */
export function Ico({
  d,
  className,
  sw = 1.8,
  join = true,
}: {
  d: string
  className?: string
  sw?: number
  join?: boolean
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin={join ? 'round' : undefined} d={d} />
    </svg>
  )
}
