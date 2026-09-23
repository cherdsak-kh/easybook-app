/**
 * Where a legacy hash deep link should land, or `null` when the URL is not one.
 *
 * LINE rich cards sent before 15 ก.ย. 2569 link to `#/booking/:id` and `#/venue/:id`, but this app
 * routes on the path (`BrowserRouter`), so `/#/booking/abc` reached the gate at `/` and landed on
 * `/home`. Those cards stay in people's chats for good, so the forward is permanent.
 *
 * `hash` and `search` are `window.location.hash` / `.search`. The result is a same-origin path:
 *   `#/booking/abc`            + ``              → `/booking/abc`
 *   `#/booking/abc?x=1`        + `?gate=allowed` → `/booking/abc?x=1&gate=allowed`
 *
 * ⚠️ THE OUTER QUERY IS KEPT BYTE FOR BYTE, not re-serialised through `URLSearchParams`. It can
 * carry `liff.state`, the login `?code=` exchange and the DEV `?gate=` override, and all three are
 * read later by code that parses the raw string. Re-encoding (`%20` → `+`) could quietly change
 * what they read. The link's own query goes first because it is the more specific of the two.
 *
 * ⚠️ ONLY `#/`. LIFF itself puts `#access_token=…&id_token=…` in the hash when LINE opens the app,
 * and `liff.init()` has to read it.
 *
 * ⚠️ OFF-SITE TARGETS ARE REFUSED BY THE URL PARSER, NOT BY LOOKING AT CHARACTERS. A leading-`//`
 * or `/\` test is not enough: `#/..//evil.com`, `#/%2e%2e//evil.com` and `#/.//evil.com` all
 * normalise to the protocol-relative path `//evil.com`, and got past that check (QA R2-OBS-1). The
 * candidate is now resolved with `new URL(target, origin)` — the same parser `replaceState` uses —
 * and is only returned when it resolves to THIS origin on a path with exactly one leading slash.
 * Anything else returns `null`, the URL is left alone, and the user stays where they are (the app
 * root, in the LIFF flow). Not exploitable today, because `replaceState` cannot leave the origin —
 * but react-router falls back to `location.assign()` when `pushState` throws, so a later navigate
 * taken from a `//evil.com` pathname would become a cross-origin one.
 */
export function legacyHashTarget(hash: string, search: string): string | null {
  if (!hash.startsWith('#/')) return null
  const inner = hash.slice(1)
  // Cheap lexical refusal of the two literal off-site forms, kept so the common attack never
  // depends on `window` being present. The parser check below is the actual guarantee.
  if (inner[1] === '/' || inner[1] === '\\') return null

  const cut = inner.search(/[?#]/)
  const path = cut === -1 ? inner : inner.slice(0, cut)
  const rest = cut === -1 ? '' : inner.slice(cut)
  const fragmentAt = rest.indexOf('#')
  const own = (fragmentAt === -1 ? rest : rest.slice(0, fragmentAt)).replace(/^\?/, '')
  const fragment = fragmentAt === -1 ? '' : rest.slice(fragmentAt)

  const query = [own, search.replace(/^\?/, '')].filter(Boolean).join('&')
  const target = `${path}${query ? `?${query}` : ''}${fragment}`
  return isSameOriginPath(target) ? target : null
}

/**
 * True when `target` resolves, against the page's own origin, to a same-origin URL whose pathname
 * starts with exactly one `/`.
 *
 * The raw string is validated rather than a rebuilt one, and the raw string is what gets returned:
 * `replaceState` resolves it with the same WHATWG parser against a document URL of the same origin,
 * so what is checked here is exactly what the browser will do with it. Rebuilding the target from
 * `url.pathname + url.search` would re-encode the query, and THE OUTER QUERY MUST STAY BYTE FOR BYTE
 * (see above).
 *
 * The `//` pathname test is separate from the origin test on purpose: `/..//evil.com` resolves to
 * this origin — it is only the *pathname* that turns protocol-relative — so the origin comparison
 * alone lets it through.
 */
function isSameOriginPath(target: string): boolean {
  const origin = window.location.origin
  try {
    const url = new URL(target, origin)
    return url.origin === origin && url.pathname.startsWith('/') && !url.pathname.startsWith('//')
  } catch {
    // An unparseable target, or an opaque origin: forward nothing rather than guess.
    return false
  }
}
