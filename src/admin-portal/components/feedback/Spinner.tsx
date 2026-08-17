/**
 * The spinner, and the button busy-state that uses it.
 *
 * `<Spinner size="sm">` is exactly `h-4.5 w-4.5` — the same box as every leading icon in
 * this portal's buttons. That is deliberate and it is what lets `useBusy` swap one for the
 * other without the button changing width.
 *
 * It is `aria-hidden`. A spinner has no text, and the thing worth announcing is `aria-busy`
 * on the control, not a decorative ring.
 */

export function Spinner({
  size = 'sm',
  className = '',
  label,
}: {
  size?: 'sm' | 'lg'
  className?: string
  /** Set only when the spinner is the ONLY thing on screen saying work is happening. */
  label?: string
}) {
  const cls = `spinner ${size === 'lg' ? 'spinner-lg' : 'spinner-sm'} ${className}`.trim()
  if (label) {
    return (
      <span role="status" className="inline-flex items-center gap-2">
        <span aria-hidden="true" className={cls} />
        <span className="sr-only">{label}</span>
      </span>
    )
  }
  return <span aria-hidden="true" className={cls} />
}
