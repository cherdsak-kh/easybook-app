/**
 * User-facing copy for the **client portal** — the LIFF surface end users see
 * inside the LINE app (`HomePage.tsx`, `RegistrationForm.tsx`).
 *
 * ## This file is intentionally EMPTY
 * That is a deliberately deferred task, **not an oversight**. The sibling
 * `ui-strings-backend.ts` was extracted first because its copy/test duplication
 * was already causing silent test rot; the client portal's strings are a
 * separate piece of work that has not been scheduled yet. This scaffold exists
 * so that work has an obvious home — and so nobody "helpfully" files client copy
 * into the backend dictionary in the meantime.
 *
 * ## Why two dictionaries rather than one
 * The two portals share no copy and no audience: the backend portal is internal
 * staff tooling, the client portal is what a member of the public reads in the
 * LINE webview. Keeping them apart means a Backend Portal re-word can never
 * reach an end user's screen, and the client extraction can pick its own
 * grouping without renegotiating the backend one.
 *
 * ## What this is NOT
 * Not i18n — same as `ui-strings-backend.ts`. There is no locale, no framework
 * and no `t()` lookup; this will be a plain `as const` object reached by
 * property access. Do not grow it into a locale system without a plan that asks
 * for one.
 *
 * ## Adding the first string
 * Follow `ui-strings-backend.ts`'s conventions: surface-scoped groups, a small
 * `common`, and formatters (`(x) => string`) only where runtime data actually
 * interpolates.
 */

/**
 * Empty by design — see the file doc-comment. Typed as an index signature rather
 * than bare `{}` so the first real entry does not have to re-type it, and so
 * reading a not-yet-extracted key is a type error rather than `undefined`.
 */
export const UI_STRINGS_CLIENT = {} as const satisfies Record<string, never>
