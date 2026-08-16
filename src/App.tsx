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
 * Routes — there are now exactly two:
 *  - `/`        → the client LIFF surface (`HomePage`). Matched at the INDEX only —
 *                 `HomePage` is route-less (it swaps screens via internal state, not the
 *                 URL), so the client portal has exactly one real route.
 *  - `path="*"` → the ONE global 404, kept LAST.
 *
 * The pathless `ThemeLayout` stamps the portal's daisyUI `data-theme` onto the subtree. It
 * is presentational only — it adds no path segment, so route specificity is unchanged.
 */
function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
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
