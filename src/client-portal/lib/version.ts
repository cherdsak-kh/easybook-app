/**
 * The two version numbers the client portal knows about, and the arithmetic for telling them
 * apart. Read by `#/version` (prototype 1957–2078) and by `#/settings`' version-summary card.
 *
 * EasyBook is TWO independently released deployables — the bundle running in the LINE webview and
 * the service holding the data — and the whole `#/version` screen follows from that one fact. They
 * are normally the same number; when they are not, a deploy went half-way.
 *
 * ⚠️ ONLY ONE OF THE TWO NEEDS A NETWORK CALL, and the asymmetry is deliberate: the app's own
 * version is compiled in (`vite.config.ts` explains why), so this module answers "which bundle am
 * I?" with no dependency on anything — which is what keeps the screen useful while every request to
 * the backend is failing. The server's number comes from `fetchServerVersion()`, which is allowed
 * to fail and renders as a STATE, never as an error.
 *
 * ── 🟠 WHY THIS IS NOT IMPORTED FROM `admin-portal/lib/version.ts` ──
 * The two portals are separate folders by a hard rule in `CLAUDE.md`, and the back-office copy also
 * drags in `admin-portal/lib/thai-date.ts` for a stamp this screen does not print. What is
 * duplicated is ten lines of integer comparison; what would be coupled is a client screen to the
 * back-office's module graph. ⚠️ The thing that genuinely must NOT be duplicated is the *server's*
 * resolver, and it is not: `GET /line-users/version` and the admin's `/system/version` both call
 * one `resolveAppVersion()` in the service, so the two endpoints cannot disagree about the deploy.
 */

/**
 * This bundle, stated once. Every other file reads `APP`, never the raw `__…__` global, so the text
 * substitution has exactly one point of contact with the client source tree.
 *
 * 🔴 IT IS READ, NEVER WRITTEN DOWN. The prototype hard-codes `v1.0.0` and says so itself at line
 * 1927: *"port it from build info and the API, which is where 'do they match' can actually be
 * answered — not from two constants in one file that always agree"*. A literal here would make the
 * agreement check on `#/version` a check of nothing.
 */
export const APP = {
  version: __APP_VERSION__,
  /** Short commit, `unknown` when unstamped, `+dirty` when built over uncommitted work. */
  build: __APP_BUILD__,
} as const

/**
 * `-1 | 0 | 1`, comparing `x.y.z` NUMERICALLY.
 *
 * ⚠️ Not `<` on strings. `'0.10.0' > '0.9.0'` is FALSE as text, because `'1'` sorts before `'9'` —
 * a comparison that is correct for every version anyone tests it with and flips silently on the
 * tenth minor release. This portal is already past `0.9.0`, so the string form would be wrong today.
 *
 * Missing segments read as `0`, so `'1.4'` and `'1.4.0'` compare equal rather than throwing at the
 * one moment the screen exists to diagnose a problem.
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const left = String(a).split('.')
  const right = String(b).split('.')
  for (let i = 0; i < 3; i++) {
    const x = Number.parseInt(left[i] ?? '0', 10) || 0
    const y = Number.parseInt(right[i] ?? '0', 10) || 0
    if (x !== y) return x < y ? -1 : 1
  }
  return 0
}
