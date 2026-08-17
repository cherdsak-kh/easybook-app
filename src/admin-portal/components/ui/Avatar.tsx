/**
 * A person's picture, or their initial when there isn't one.
 *
 * ⚠️ NOT THE PRODUCT LOGO, and that was the first port's fallback. Three things are wrong with
 * it: the logo is not a person, every account without a photo gets the *same* image so it
 * distinguishes nobody, and it is the one mark that means "EasyBook" — so the identity control
 * ends up reading as though the account belongs to the system. On a row named
 * "EasyBook Administrator" the two reinforced each other perfectly.
 *
 * The prototype's rule, written beside its own fallback: "the initial, not an empty grey disc,
 * which reads as an image that failed to load." A tinted disc with a letter in it is obviously
 * *placed there*, and it differs per person, which is the entire job.
 *
 * ⚠️ THE INITIAL IS THE FIRST CONSONANT, NOT `charAt(0)`. Thai writes เ แ โ ใ ไ BEFORE the
 * consonant they belong to, so `charAt(0)` on เชิดศักดิ์ yields "เ" — a vowel standing alone,
 * which is not an initial in any sense a reader would accept, and those five leading vowels start
 * a large share of Thai given names. The prototype's live code IS `charAt(0)`; it never showed
 * because its sample data hand-picks the letter ("ini: 'ช'" for เชิดศักดิ์). Following the
 * prototype's DESIGN here and not its implementation is deliberate.
 *
 * Size and shape belong to the caller: the sidebar card is a 40px `rounded-control`, the profile
 * header a 96px `rounded-full`. Passing them in keeps this component from knowing where it is.
 */

/** Thai leading vowels — written first, pronounced after the consonant that follows them. */
const LEADING_VOWELS = new Set(['เ', 'แ', 'โ', 'ใ', 'ไ'])

/**
 * The letter to draw. `?` when there is no name at all — the prototype uses the same character
 * for a LINE user who has followed but never registered, so an unnamed account looks the same
 * everywhere rather than inventing a second empty state.
 */
// Module-private: exporting it alongside the component costs Fast Refresh for the whole file
// (oxlint `only-export-components`), and nothing outside needs the letter on its own — callers
// want the avatar, and every one of them gets the same rule by using it.
function initialOf(name: string | null | undefined): string {
  const chars = [...(name ?? '').trim()]
  for (const ch of chars) {
    if (LEADING_VOWELS.has(ch)) continue
    return ch.toUpperCase()
  }
  return '?'
}

export function Avatar({
  src,
  name,
  className = '',
}: {
  src?: string | null
  /** Used for the initial only. The picture is decorative — see below. */
  name?: string | null
  /** Size and shape, e.g. `h-10 w-10 rounded-control`. */
  className: string
}) {
  // `alt=""` on purpose: the name is always rendered beside this, and an avatar that announces
  // it a second time just makes the row take twice as long to read out.
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`shrink-0 border border-base-300 bg-base-100 object-cover ${className}`.trim()}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center border border-base-300 bg-primary/10 font-semibold text-primary ${className}`.trim()}
    >
      {initialOf(name)}
    </span>
  )
}
