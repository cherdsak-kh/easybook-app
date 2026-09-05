/**
 * The one <svg> wrapper คำขอจองสถานที่ draws its icons through. Paths come from `booking-icons.ts`.
 *
 * It owns `aria-hidden`, the stroke weight and the viewBox — the three things that were wrong on a
 * different icon each time they were written per call site. The same `Glyph` การลงทะเบียน and
 * สถานที่จัดกิจกรรม declare locally; this screen spans four files, so it needs a module.
 *
 * ⚠️ ALWAYS DECORATIVE. Every glyph here sits beside text that already says the same thing, so
 * `aria-hidden` is unconditional rather than a prop. An icon that must be announced belongs inside a
 * button carrying an `aria-label`.
 */

export function Glyph({
  d,
  className = 'h-4.5 w-4.5 shrink-0',
}: {
  d: string
  className?: string
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}
