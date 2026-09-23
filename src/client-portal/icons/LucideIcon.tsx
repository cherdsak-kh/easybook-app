import { LICON, type LIconName } from './licon'

/**
 * One lucide glyph. The registry itself is `./licon.ts`.
 *
 * ⚠️ FILENAME NOTE: the renderer is `LucideIcon.tsx` and the registry is `licon.ts` because this
 * repository is developed on a case-insensitive filesystem, where `LIcon.tsx` and `licon.ts` are
 * the same name — a `rm licon.tsx` deleted the renderer while this file was being split out. The
 * exported component is still `LIcon`; only the file it lives in is spelled differently.
 *
 * ⚠️ `aria-hidden` IS FORCED HERE, not left to whoever writes the markup. The previous round
 * changed four headings from emoji (which had been hidden correctly) to `<svg>` and forgot it,
 * producing four unnamed images that a screen reader had to announce before every heading. Every
 * glyph in this portal is decorative — the Thai text beside it already says the same thing — so
 * there is no case that needs the exception.
 *
 * ── Why `dangerouslySetInnerHTML` and not JSX children ──
 * The registry holds lucide's own markup as text so it can be diffed against the upstream file
 * with a string comparison. Converting these to JSX elements would mean retyping every path,
 * which is precisely the failure that registry exists to prevent. The content is a compile-time
 * constant in this repository; nothing from the network or from a user reaches it.
 */
export function LIcon({
  name,
  className = 'h-[18px] w-[18px] shrink-0',
}: {
  name: LIconName
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
      dangerouslySetInnerHTML={{ __html: LICON[name] }}
    />
  )
}
