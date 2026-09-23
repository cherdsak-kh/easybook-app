import { RXICON, type RXIconName } from './rxicon'

/**
 * One RemixIcon glyph — the enter/leave pair for a booking slot's start and end. The registry
 * itself is `./rxicon.ts`.
 *
 * ⚠️ FILENAME NOTE: same reason as `LucideIcon.tsx` — on a case-insensitive filesystem
 * `RXIcon.tsx` and `rxicon.ts` are one name. The exported component is still `RXIcon`.
 *
 * Decorative like every other icon in this portal, so `aria-hidden` is forced rather than left to
 * the caller. `dangerouslySetInnerHTML` for the same reason as `LIcon`: the strings exist so they
 * can be string-compared against their source, and turning them into JSX would mean retyping them.
 */
export function RXIcon({
  name,
  className = 'h-[18px] w-[18px] shrink-0',
}: {
  name: RXIconName
  className?: string
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      dangerouslySetInnerHTML={{ __html: RXICON[name] }}
    />
  )
}
