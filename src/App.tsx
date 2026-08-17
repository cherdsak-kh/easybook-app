import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
// Eager (initial chunk): the anonymous LIFF client (`/` → HomePage) must paint without
// waiting on a lazy chunk. It is dependency-light, so keeping it eager does not bloat the
// initial download.
import { HomePage } from '@/pages/client-portal/HomePage'
import { ThemeLayout } from '@/components/client-portal/ThemeLayout'

const NotFoundPage = lazy(() =>
  import('@/pages/NotFoundPage').then((m) => ({
    default: m.NotFoundPage,
  })),
)

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
 * Routes:
 *  - `/backend/*` → Admin Portal v2 (P2). It owns everything under that segment, including its
 *                   own in-shell 404, so this file never learns the back-office's 31 paths.
 *  - `/`          → the client LIFF surface (`HomePage`). Matched at the INDEX only —
 *                   `HomePage` is route-less (it swaps screens via internal state, not the
 *                   URL), so the client portal has exactly one real route.
 *  - `path="*"`   → the ONE global 404, kept LAST. It is still the CLIENT's 404: the
 *                   prototype's full-page back-office 404 exists (`NotFound variant="full"`)
 *                   but has no correct home until P2-C decides who is "outside the shell",
 *                   and pointing an anonymous LIFF user at back-office chrome would advertise
 *                   the staff entrance to every mistyped address.
 *
 * The pathless `ThemeLayout` stamps the portal's daisyUI `data-theme` onto the subtree. It
 * is presentational only — it adds no path segment, so route specificity is unchanged.
 */
function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* OUTSIDE the client ThemeLayout on purpose: the showcase stamps its own
            `data-theme` so it can flip between the two admin themes in place, which is how
            the contrast sweep gets run twice without a reload. */}
        <Route path="/admin-portal/_showcase" element={<ShowcasePage />} />

        {/* The back-office. `/*` because `BackendRoutes` owns everything below this segment —
            its own 31 destinations and its own in-shell 404 — and a nested `<Routes>` only
            sees the remainder of the path. Also outside `ThemeLayout`: it stamps its own
            `data-theme`, and the two portals' themes must never reach each other. */}
        <Route path="/backend/*" element={<BackendRoutes />} />

        <Route element={<ThemeLayout portal="client" />}>
          {/* The client LIFF surface. `HomePage` is route-less (it swaps screens via
              internal state, not the URL), so it matches only the INDEX (`/`); there is no
              client sub-route to catch. */}
          <Route index element={<HomePage />} />
          {/* The single global 404, kept LAST. */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default App
