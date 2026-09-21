/**
 * The one <svg> wrapper ข้อเสนอแนะ/แจ้งปัญหา draws its icons through. Paths come from
 * `feedback-icons.ts`. Same contract as `BookingGlyph`: it owns `aria-hidden`, the viewBox and the
 * stroke, and is ALWAYS decorative — every glyph here sits beside text (or inside a button with an
 * `aria-label`) that already says the same thing.
 */

export function Glyph({
  d,
  className = 'h-4.5 w-4.5 shrink-0',
  strokeWidth = 1.8,
}: {
  d: string
  className?: string
  /** The prototype draws its ✕ / chevrons at 2 and everything else at 1.8. */
  strokeWidth?: number
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}
