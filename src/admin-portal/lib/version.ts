/**
 * The two version numbers, and the arithmetic for telling them apart.
 *
 * EasyBook is TWO independently released deployables — the bundle in the browser and the service
 * that holds the data — and the whole version screen follows from that one fact. They are normally
 * the same number; when they are not, something went wrong with a deploy and the remedy depends on
 * WHICH of the two is behind.
 *
 * ⚠️ Only ONE of the two needs a network call, and that asymmetry is deliberate on both sides. The
 * app's own version is compiled in (`vite.config.ts` explains why), so this module answers "which
 * bundle am I?" with no dependency on anything — which is what lets the screen stay useful while
 * every request to the backend is failing. The server's version comes from
 * `getSystemVersion()`, which is allowed to fail and renders as a state rather than an error.
 */

/**
 * This bundle, stated once. Every other file reads `APP`, never the raw `__…__` globals, so the
 * two text substitutions have exactly one point of contact with the source tree — and so a test
 * environment that does not perform the substitution fails here, loudly, instead of in whichever
 * component happened to reference one first.
 */
export const APP = {
  version: __APP_VERSION__,
  /** Short commit, `unknown` when unstamped, `+dirty` when built over uncommitted work. */
  build: __APP_BUILD__,
} as const

/**
 * `-1 | 0 | 1`, comparing `x.y.z` NUMERICALLY.
 *
 * ⚠️ Not `<` on strings. `'1.10.0' > '1.9.0'` is FALSE as text, because `'1'` sorts before `'9'` —
 * a comparison that is correct for every version anyone tests it with and flips silently on the
 * tenth minor release, long after whoever wrote it has stopped thinking about this file. The whole
 * screen reduces to this function: it decides which of four sentences the reader is shown.
 *
 * Missing segments read as `0`, so `'1.4'` and `'1.4.0'` compare equal rather than throwing at the
 * one moment the page is meant to be diagnosing a problem.
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const A = String(a).split('.')
  const B = String(b).split('.')
  for (let i = 0; i < 3; i++) {
    const x = Number.parseInt(A[i] ?? '0', 10) || 0
    const y = Number.parseInt(B[i] ?? '0', 10) || 0
    if (x !== y) return x < y ? -1 : 1
  }
  return 0
}

const TH_MONTHS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
] as const

const two = (n: number) => String(n).padStart(2, '0')

/**
 * `17 ส.ค. 2569 14:32` — the moment the reader copied the diagnostic block.
 *
 * The ONE computed date on this screen. Every other date it shows is a release date, which is a
 * fixed fact written down when the release happened; this one is stamped into the text somebody
 * pastes into a support message, so it has to be *now* or the technician cannot line the report up
 * against the logs.
 *
 * Hand-rolled rather than `Intl.DateTimeFormat('th-TH')`: the Buddhist year is what the school
 * reads, and `th-TH`'s output varies by engine and by ICU build — an `en-US` fallback locale would
 * quietly emit a Gregorian year into a support ticket, which is the one number in it that must not
 * be ambiguous.
 */
export function thaiStamp(now: Date = new Date()): string {
  return (
    `${now.getDate()} ${TH_MONTHS[now.getMonth()]} ${now.getFullYear() + 543} ` +
    `${two(now.getHours())}:${two(now.getMinutes())}`
  )
}
