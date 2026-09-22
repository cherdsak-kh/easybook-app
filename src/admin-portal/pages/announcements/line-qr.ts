/**
 * The LINE OA add-friend QR's pure half (LINE-OA-QR-1): the URL it encodes, the PNG's file name,
 * and whether there is an id to draw at all. `LineQrModal` and `LineOaCard` only apply these, so
 * `tests/unit/admin-portal/pages/announcements/line-qr.test.ts` pins them without a DOM.
 *
 * A `.ts` beside the components, not inside `components/`, for the reason `announcement-icons.ts`
 * gives: a module that exports constants AND a component trips `react/only-export-components`.
 */

/** CSS px of the rendered QR, and the bitmap/PNG size — 1:1 (02_design_log §5). */
export const QR_SIZE = 220

/**
 * LINE's documented add-friend form: `https://line.me/R/ti/p/{percent-encoded LINE ID}`
 * (developers.line.biz, "Sharing a LINE Official Account" — the literal `@` still works but is
 * deprecated). `@easybook` → `https://line.me/R/ti/p/%40easybook`.
 *
 * ⚠️ THE ONLY PLACE THIS URL IS BUILT, AND IT IS ENCODED EXACTLY ONCE. Never pass the result through
 * `encodeURI`, `new URL(…).href`, `URLSearchParams` or a second `encodeURIComponent` — that is how
 * `%40` becomes `%2540`. `trim()` keeps a stray space from becoming `%20`.
 */
export function addFriendUrl(basicId: string): string {
  return `https://line.me/R/ti/p/${encodeURIComponent(basicId.trim())}`
}

/**
 * The id as a file-name fragment: ONE leading `@` stripped, then every character outside
 * `[A-Za-z0-9._-]` replaced with `_`. A guard against path characters, not a transliteration —
 * LINE ids are ASCII today.
 */
export function cleanId(basicId: string): string {
  return basicId
    .trim()
    .replace(/^@/, '')
    .replace(/[^A-Za-z0-9._-]/g, '_')
}

/** `LINE_OA_${cleanId}_QR.png` — the downloaded PNG's name, and part of the button's label. */
export function qrFileName(basicId: string): string {
  return `LINE_OA_${cleanId(basicId)}_QR.png`
}

/**
 * False for `''`, whitespace, or a lone `@`: there is nothing to encode, so the card renders no QR
 * pill and mounts no dialog (plan D-5). The real contract always sends one; this is the guard.
 */
export function hasQrId(basicId: string): boolean {
  return cleanId(basicId) !== ''
}
