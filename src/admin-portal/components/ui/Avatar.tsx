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
  chrome = 'border border-base-300',
  backdrop = 'bg-base-100',
}: {
  src?: string | null
  /** Used for the initial only. The picture is decorative — see below. */
  name?: string | null
  /** Size and shape, e.g. `h-10 w-10 rounded-control`. */
  className: string
  /**
   * The image's frame. Default is the sidebar card's hairline — the prototype's `#me-avatar`
   * carries exactly `border border-base-300`.
   *
   * ⚠️ IMAGE BRANCH ONLY, like `backdrop` below: an initial's disc has no border anywhere in the
   * prototype. See the fallback.
   *
   * ⚠️ IT IS A PROP BECAUSE THE PROFILE HEADER'S FRAME IS PART OF ITS OWN CLASS. `.pf-ava` is
   * `border-4 border-base-100` — the thick ring that lifts the circle off the cover band — and a
   * default emitted here would BEAT it: `.pf-ava` lives in `@layer components` while every
   * utility above lands in `@layer utilities`, which cascades later regardless of what order the
   * words sit in the class attribute. The result is a silent 4px→1px downgrade at the one place
   * the ring is doing work. Callers with their own frame pass `chrome=""`.
   *
   * BACKGROUND IS A SECOND PROP, not part of this one, because the two branches need different
   * values and one string would have them fighting inside `@layer utilities` — where the winner
   * is whichever class Tailwind happened to emit later, not whichever the caller wrote last.
   * (The initial's disc takes neither: it is `.ava-fill`, which is not the caller's business.)
   */
  chrome?: string
  /**
   * What shows through a transparent PNG. IMAGE BRANCH ONLY — the initial's disc is
   * `bg-primary/10`, which is the design and not a caller's business.
   *
   * `bg-base-100` matches the prototype's sidebar card, where the avatar sits on `bg-base-200`.
   * The profile header passes `""` so `.pf-ava`'s own `bg-base-200` survives: a utility here
   * would beat it from the later layer, which is a one-token difference nobody would ever spot
   * and exactly the kind that accumulates.
   */
  backdrop?: string
}) {
  // `alt=""` on purpose: the name is always rendered beside this, and an avatar that announces
  // it a second time just makes the row take twice as long to read out.
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`shrink-0 object-cover ${backdrop} ${chrome} ${className}`.trim()}
      />
    )
  }

  // ⚠️ `.ava-fill`, NOT `bg-primary/10` — OPAQUE, by PO instruction (18 ส.ค. 2569). A wash lets
  // whatever is behind it through, and on the profile header what is behind it is the coloured
  // cover band. See the class in `admin-portal.css` for the two places that had already gone
  // wrong. It is a `@layer components` class, so a caller's `className` can still override it.
  //
  // ⚠️ NO `chrome` ON THIS BRANCH, and that is the prototype, not a simplification. Every initial
  // disc in that file is a bare `ava-fill` span — the staff table, the registration table, both
  // phone lists, all six dialogs — while every `<img>` carries `border border-base-300`. The
  // default came from `#me-avatar`, which is an `<img>`, and the fallback inherited it by accident:
  // a tinted disc needs no hairline to separate it from the surface, because the tint already does
  // that, and the border it was drawing showed up on every account without a photo.
  return (
    <span
      aria-hidden="true"
      className={`ava-fill flex shrink-0 items-center justify-center font-semibold text-primary ${className}`.trim()}
    >
      {initialOf(name)}
    </span>
  )
}
