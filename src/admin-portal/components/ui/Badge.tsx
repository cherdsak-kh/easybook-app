/**
 * A status pill. Takes a TONE, never a status.
 *
 * `<Badge tone="emerald">` is allowed; `<Badge status="ALLOWED">` is not (CONVENTIONS §4
 * rule 3) — turning a status into a colour is the page's job, and the map that does it is
 * `ACCESS_TONE` in `admin-portal/labels.ts`. Keeping it out of here is what lets the same
 * pill carry a booking state later without this file learning about registrations.
 *
 * The five tones are the prototype's five classes, each measured ≥4.5:1 against its own
 * 10% wash. Do not add a sixth by writing `bg-<hue>/10 text-<hue>` inline somewhere — that
 * is how the amber-700 that failed at 4.35 got shipped the first time.
 */

export type BadgeTone = 'emerald' | 'amber' | 'sky' | 'rose' | 'slate'

const TONE_CLASS: Record<BadgeTone, string> = {
  emerald: 'badge-emerald',
  amber: 'badge-amber',
  sky: 'badge-sky',
  rose: 'badge-rose',
  slate: 'badge-slate',
}

export function Badge({
  tone,
  children,
  className = '',
}: {
  tone: BadgeTone
  children: React.ReactNode
  className?: string
}) {
  return <span className={`badge ${TONE_CLASS[tone]} ${className}`.trim()}>{children}</span>
}
