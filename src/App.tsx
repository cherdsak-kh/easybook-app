import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { isInLineClient } from '@/lib/liff'
import { legacyHashTarget } from '@/client-portal/lib/legacy-hash-link'
// Eager (initial chunk): the LIFF client is the surface an end user opens, and its first paint
// is the splash the gate runs behind. Waiting on a lazy chunk to start the four checks would add
// a download to the one screen whose whole job is to be quick.
import { ClientRoutes } from '@/client-portal/ClientRoutes'

/**
 * P1 SCAFFOLDING — the component showcase, and the only way Phase 1's components get
 * verified at all: the PO's ruling for this phase is "measure in the browser, write no new
 * unit tests". It is lazy so it never enters the client's initial chunk, and it hangs off
 * this branch only until P2 brings the real `/backend` router, which replaces it.
 */
const ShowcasePage = lazy(() =>
  import('@/admin-portal/pages/showcase/ShowcasePage').then((m) => ({
    default: m.ShowcasePage,
  })),
)

/**
 * The CLIENT portal's Phase 1 showcase — the same instrument for the other side, and for the same
 * reason: the PO's ruling for this build is "measure in the browser, write no UI component unit
 * tests", so this page is where every shared component's contrast, tap-target size and both-theme
 * rendering actually get checked, at 390px and 820px.
 *
 * ⚠️ Path mirrors `/admin-portal/_showcase` rather than the bare `/showcase` the brief offered,
 * so the two instruments sort together and neither can be mistaken for a product route.
 *
 * Lazy, so it never enters the client's initial chunk. It goes when Phase 1's components have
 * been absorbed by real screens.
 */
const ClientShowcasePage = lazy(() =>
  import('@/client-portal/pages/showcase/ShowcasePage').then((m) => ({
    default: m.ShowcasePage,
  })),
)

/**
 * The back-office, lazily loaded as ONE chunk.
 *
 * A LIFF user never signs in here, so none of it belongs in the initial download — and the
 * split is at the branch rather than per page because the shell, the route table and all 31
 * destinations are reached together the moment anyone enters `/backend`.
 */
const BackendRoutes = lazy(() =>
  import('@/admin-portal/BackendRoutes').then((m) => ({
    default: m.BackendRoutes,
  })),
)

/**
 * 🔴 LEGACY HASH DEEP LINKS (`/#/booking/abc` → `/booking/abc`), FORWARDED ONCE AT MODULE LOAD.
 *
 * LINE cards sent before 15 ก.ย. 2569 link with `#/…`. This app routes on the path, so without the
 * forward those links reached the gate at `/` and `GateLanding` sent them to `/home`.
 *
 * ⚠️ IT RUNS HERE, BEFORE `BrowserRouter` EXISTS, rather than as a `navigate()` in an effect:
 *  - `main.tsx` imports this module before it calls `render()`, so the router's first location is
 *    already the forwarded path. Nothing can redirect first: not `GateLanding`, not `GateGuard`'s
 *    bounce, not the external-browser `<Navigate to="/backend">` below. Child effects run before a
 *    parent's, so an effect here would lose that race to the last of those.
 *  - `replaceState` adds no history entry, so Back never returns to the hash URL.
 *  - `liff.state` needs nothing special. `liff.init()` settles it with `location.replace()`, a full
 *    reload, so a legacy link arrives as a fresh load of `/#/booking/abc` and is forwarded then.
 *    The query string is kept verbatim, so `liff.state`, `?code=` and `?gate=` are all still there
 *    for `liff.init()`, `IS_DEV_GATE_BYPASS` and `readDevCase()`.
 *  - LIFF's own `#access_token=…` hash is not `#/`, so it is left for `liff.init()` to read.
 */
function forwardLegacyHashLink() {
  const target = legacyHashTarget(window.location.hash, window.location.search)
  if (target === null) return
  try {
    window.history.replaceState(window.history.state, '', target)
  } catch (error) {
    // Fail soft: an unforwardable link lands where it did before, it never blanks the app.
    console.warn('[route] legacy hash link not forwarded:', error)
  }
}
forwardLegacyHashLink()

/**
 * The escape hatch for the QA measurement runs: those drive the client gate from desktop Chrome
 * with `?gate=<case>`, which the external-browser redirect below would otherwise swallow. Gated
 * on `import.meta.env.DEV`, so a production URL can never opt itself back into the client portal.
 *
 * 🔴 PINNED AT LOAD, on purpose, and it must stay module-level. The gate navigates away from the
 * URL that carried the parameter (`/?gate=allowed` → `/login`), so a value recomputed on every
 * render of `App` would read an empty query string on the second render and bounce the run to
 * `/backend` mid-measurement. Today `App` happens to render once per page load — `BrowserRouter`
 * passes the same `children` element on a location change, so React bails out — but that is a
 * reconciliation detail, not a contract: adding one `useState` to `App` would silently break every
 * QA run. `useLiffGate.readDevCase()` caches the same parameter for the same reason.
 */
const IS_DEV_GATE_BYPASS =
  import.meta.env.DEV && Boolean(new URLSearchParams(window.location.search).get('gate'))

/** The single Suspense fallback for a lazily-loaded route chunk. */
function RouteFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-base-200"
    >
      <span className="loading loading-spinner loading-lg text-primary" />
      <span className="sr-only">Loading…</span>
    </div>
  )
}

/**
 * ⚠️ THE `/admin-portal` BRANCH IS GONE, ON PURPOSE (2026-08-16).
 *
 * The old back-office — its login, its guarded shell, its two wired pages and its 29 stub
 * routes — was deleted whole rather than carried until v2 reached parity. The plan had
 * called for a parity-then-switch cutover, and that rule exists to avoid losing a working
 * capability mid-flight; at `0.0.0` nobody was using it, so there was no capability to
 * lose, and every backend contract change was costing a round of repairs to a portal
 * already scheduled for deletion.
 *
 * v2 lands under `src/admin-portal/` with its own routes, guard and session handling. Until
 * it does, this app serves the LIFF client only, and an `/admin-portal/*` URL is a 404 like
 * any other unknown path — which is honest: there is no back-office to be logged out of.
 *
 * The `/demo/*` mockups went the same way (2026-08-16). They were a scripted MVP pitch for a
 * booking domain that has no schema, no endpoints and no prototype design, so every day they
 * stayed they read as a spec for a feature nobody had agreed to. Their record lives in git.
 *
 * ⚠️ CLIENT PORTAL v1 IS GONE TOO, ON PURPOSE (2 ก.ย. 2569).
 *
 * `HomePage` (the 11-screen LIFF state machine), `RegistrationForm`, `ThemeLayout` and
 * `ui-strings-client.ts` were deleted whole — the same clean-slate move the back-office made
 * on 2026-08-16, for the same reason: nothing was in production to lose, and keeping a
 * surface that is scheduled for replacement means paying to repair it after every contract
 * change. Its two UI component specs went with it, per the standing policy of no UI
 * component unit tests.
 *
 * v2 is built from `docs/prototypes/client-portal/client_portal_prototype.html` and lands
 * under `src/client-portal/` as ONE folder — routes, gate, screens and dock together, the
 * same shape `src/admin-portal/` uses and for the same reason (it can be reasoned about, and
 * removed, in one piece).
 *
 * Routes:
 *  - `/backend/*` → Admin Portal v2 (P2). It owns everything under that segment, including its
 *                   own in-shell 404, so this file never learns the back-office's 31 paths.
 *  - `/*`         → the client LIFF surface (P2, 2 ก.ย. 2569). `ClientRoutes` owns everything
 *                   this file does not claim explicitly: its twenty routes, its gate, its shell
 *                   **and the global 404**, which moved in there with the branch.
 *
 * ⚠️ THE GLOBAL 404 IS NO LONGER IN THIS FILE, and it is not gone. `path="*"` and `path="/*"`
 * are the same pattern, so the client branch and a sibling catch-all cannot both exist; the
 * catch-all is now the last route inside `ClientRoutes`, still the CLIENT's 404 and still
 * outside the gate. The two more specific branches above it win on route ranking rather than on
 * source order, so `/backend/staff` and the two showcases are unaffected.
 *
 * There is no pathless client theme layout any more — it was `ThemeLayout`, and it went with
 * v1. `LiffShell` stamps `data-theme` for the whole client subtree; the two showcases stamp
 * their own because they sit outside every shell on purpose.
 *
 * ⚠️ `/*` IS ENVIRONMENT-DEPENDENT (9 ก.ย. 2569, PO Option B). Outside LINE, the client branch
 * is replaced by a redirect to `/backend`. Before this, a desktop browser opening the domain
 * root landed in the LIFF gate, found no LINE session and stopped at the client login screen —
 * a dead end for the only people who use a desktop browser here, since the back-office has no
 * link from that screen and staff read it as an outage. The two portals now separate by
 * environment rather than by the user knowing which URL to type.
 */
function App() {
  /**
   * Two signals, because either alone has a hole: `isInLineClient()` reads the LIFF SDK, which
   * answers `false` whenever `VITE_LIFF_ID` is unset or the SDK has not initialised yet (it
   * fails soft by contract), and this runs during the first render — before `bootLiff()`. The
   * User-Agent check (`Line/x.y.z`) is what covers that window, and it is why a LINE user never
   * sees the redirect on a cold start.
   */
  const inLine =
    isInLineClient() ||
    (typeof navigator !== 'undefined' && /Line\/[0-9.]+/i.test(navigator.userAgent))

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* OUTSIDE the client ThemeLayout on purpose: the showcase stamps its own
            `data-theme` so it can flip between the two admin themes in place, which is how
            the contrast sweep gets run twice without a reload. */}
        <Route path="/admin-portal/_showcase" element={<ShowcasePage />} />

        {/* The client's twin, and outside any theme layout for the same reason: it stamps its
            own `data-theme` so the contrast sweep runs twice without a reload. */}
        <Route path="/client-portal/_showcase" element={<ClientShowcasePage />} />

        {/* The back-office. `/*` because `BackendRoutes` owns everything below this segment —
            its own 31 destinations and its own in-shell 404 — and a nested `<Routes>` only
            sees the remainder of the path. Also outside `ThemeLayout`: it stamps its own
            `data-theme`, and the two portals' themes must never reach each other. */}
        <Route path="/backend/*" element={<BackendRoutes />} />

        {/* External browser gateway. Outside LINE, and not a dev-gate probe, every path this
            file has not already claimed goes to the back-office instead of the LIFF client —
            `/backend` renders its own login when unauthenticated, so no redirect loop: the
            three routes above are matched first and this one never sees `/backend/*`.

            It sits ABOVE the client branch for readability only. Both patterns are `/*`, so
            react-router ranks them equal and the FIRST wins — which is why this is rendered
            conditionally rather than always present: when the condition is false the element
            is `false`, the route does not exist, and the client branch below is the only `/*`. */}
        {!inLine && !IS_DEV_GATE_BYPASS && (
          <Route path="/*" element={<Navigate to="/backend" replace />} />
        )}

        {/* The client LIFF surface — the gate, the shell, the twenty routes and the 404. */}
        <Route path="/*" element={<ClientRoutes />} />
      </Routes>
    </Suspense>
  )
}

export default App
