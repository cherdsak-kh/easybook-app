/**
 * A small accessible loading spinner. Respects `prefers-reduced-motion` (the
 * spin is applied only under `motion-safe`).
 */
export function Spinner({
  label = 'Loading…',
  className = '',
}: {
  label?: string
  className?: string
}) {
  return (
    <span role="status" className={`inline-flex items-center gap-2 ${className}`}>
      <span
        aria-hidden
        className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"
      />
      <span className="sr-only">{label}</span>
    </span>
  )
}

/** A full-viewport centred spinner used while the session probe is in flight. */
export function FullPageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-base-200 text-base-content/60"
      data-testid="full-page-spinner"
    >
      <Spinner label={label} />
    </div>
  )
}
