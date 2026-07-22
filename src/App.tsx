import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
// Eager (initial chunk): the anonymous LIFF client (`/*` → HomePage) and the admin login
// screen must paint without waiting on a lazy chunk, so they stay statically imported.
// Neither pulls in `chart.js`, so keeping them eager does not reintroduce the heavy
// dependency into the initial download (Phase 4 design §4).
import { HomePage } from '@/pages/HomePage'
import { AdminPortalLoginPage } from '@/pages/admin-portal/AdminPortalLoginPage'
import { ThemeLayout } from '@/components/ThemeLayout'
import { AdminPortalThemeLayout } from '@/components/admin-portal/AdminPortalThemeLayout'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import {
  ADMIN_PORTAL_ROUTES,
  ADMIN_PORTAL_SEGMENTS,
  ADMIN_PORTAL_STUB_ROUTES,
} from '@/components/admin-portal/routes'

// Lazy (route-split async chunks): every chart-bearing / heroicon-heavy page in the
// `/admin-portal` branch is dynamically imported so `chart.js` + `react-chartjs-2` +
// `components/dashboard/*` are evicted from the initial chunk the LIFF client downloads
// (Phase 4 design §4). Each source uses a NAMED export, so the `.then(m => ({ default:
// m.X }))` adaptation is required — `React.lazy` resolves a module's `default`.
const AdminPortalLayout = lazy(() =>
  import('@/components/admin-portal/AdminPortalLayout').then((m) => ({
    default: m.AdminPortalLayout,
  })),
)
const AdminPortalDashboardPage = lazy(() =>
  import('@/pages/admin-portal/AdminPortalDashboardPage').then((m) => ({
    default: m.AdminPortalDashboardPage,
  })),
)
const AdminPortalTeamPage = lazy(() =>
  import('@/pages/admin-portal/AdminPortalTeamPage').then((m) => ({
    default: m.AdminPortalTeamPage,
  })),
)
const AdminPortalLeadsPage = lazy(() =>
  import('@/pages/admin-portal/AdminPortalLeadsPage').then((m) => ({
    default: m.AdminPortalLeadsPage,
  })),
)
const AdminPortalStubPage = lazy(() =>
  import('@/pages/admin-portal/AdminPortalStubPage').then((m) => ({
    default: m.AdminPortalStubPage,
  })),
)
const AdminPortalNotFoundPage = lazy(() =>
  import('@/pages/admin-portal/AdminPortalNotFoundPage').then((m) => ({
    default: m.AdminPortalNotFoundPage,
  })),
)

/**
 * The single Suspense fallback for every lazily-loaded route chunk. A centered daisyUI
 * spinner. Because `HomePage` and the admin login page stay eager, this never flashes on
 * a first-paint-critical screen (`/`, `/admin-portal/login`) — only while a
 * dashboard/inner page chunk is fetched.
 */
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
 * Route tree (Phase 5 cutover). Two branches remain: the `/admin-portal` back-office
 * (its own theme + guard) and the client `/*` LIFF catch-all. The legacy `/backend`
 * portal and its `admin/**` pages were deleted in the Big Bang cutover; the V2
 * `AdminPortalLoginPage` (`/admin-portal/login`) is now the app's only admin login.
 *
 *  - `/admin-portal/login`  → the admin login form (eager, outside the guard).
 *  - `/admin-portal/*`      → protected shell (sidebar + header) with the dashboard,
 *                             team, wired Leads, and stub pages.
 *  - `/*`                   → the existing client LIFF surface, unchanged. Kept LAST:
 *                             React Router ranks specific paths above this catch-all,
 *                             so the portal branch wins and `/*` only catches
 *                             non-portal paths. A deep-link to a removed `/backend/*`
 *                             URL now falls through here to `HomePage` (accepted; no
 *                             server rewrite in this repo).
 *
 * Each branch is wrapped in a pathless theme layout route that stamps the portal's
 * daisyUI `data-theme` onto the subtree. These wrappers are presentational only — they
 * add no path segment, so route specificity is unchanged and `/*` still ranks last.
 *
 * Phase 4: the chart-bearing `/admin-portal` pages are code-split (`React.lazy`) behind
 * a single top-level `<Suspense>`, so the anonymous LIFF client never eagerly downloads
 * `chart.js`/`react-chartjs-2`. The trade-off (accepted, PO sign-off): the dashboard
 * shows a brief `RouteFallback` spinner on its first paint after login while its chunk
 * loads.
 */
function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* The DashWind-derived back-office. Phase 5.1 gates the shell: every
            `/admin-portal/*` route EXCEPT `/admin-portal/login` requires a live admin
            session via the shared `ProtectedRoute`, which is passed the REQUIRED
            `loginPath={ADMIN_PORTAL_ROUTES.login}` (R6 — the guard no longer defaults it)
            plus `forcePasswordChangePath={null}` so a `mustChangePassword` admin is
            admitted without a force-reset bounce (this branch has no reset screen; the
            server still gates every mutation — accepted lockout R2). `/admin-portal/login`
            stays OUTSIDE the guard so it remains reachable while unauthenticated (else a
            redirect loop). Its own `AdminPortalThemeLayout` stamps the `dashwind-*` theme
            and a distinct `admin-portal-drawer` id keeps its drawer independent. React
            Router ranks the concrete `/admin-portal/*` paths above the client `/*`
            catch-all.

            404 placement: an unknown `/admin-portal/*` sub-path now renders the 404
            FULL-SCREEN — via the `${base}/*` SIBLING route below, OUTSIDE both the shell
            (no sidebar/header) and the guard — and that page auto-redirects to login after
            a countdown. The bare base still resolves to the dashboard through the layout's
            `index` (React Router ranks the index/static branch above the sibling splat),
            and every KNOWN sub-path still renders in-shell. Intended behavior change: since
            the 404 sibling sits OUTSIDE `<ProtectedRoute>`, an UNAUTHENTICATED visitor to a
            bogus sub-path now SEES the full-screen 404 (then auto-redirects to login),
            instead of being bounced straight to login by the guard. Deliberate, not a
            silent regression. */}
        <Route element={<AdminPortalThemeLayout />}>
          <Route path={ADMIN_PORTAL_ROUTES.login} element={<AdminPortalLoginPage />} />
          <Route
            path={ADMIN_PORTAL_ROUTES.base}
            element={
              <ProtectedRoute loginPath={ADMIN_PORTAL_ROUTES.login} forcePasswordChangePath={null}>
                <AdminPortalLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to={ADMIN_PORTAL_ROUTES.dashboard} replace />} />
            <Route path={ADMIN_PORTAL_SEGMENTS.dashboard} element={<AdminPortalDashboardPage />} />
            <Route path={ADMIN_PORTAL_SEGMENTS.team} element={<AdminPortalTeamPage />} />
            {/* Phase 5: the Leads menu target renders REAL LINE-user data (wired via
                `useLineUsers` → `listLineUsers`/`patchLineUserAccess`), not a mock. */}
            <Route path={ADMIN_PORTAL_SEGMENTS.leads} element={<AdminPortalLeadsPage />} />
            {/* Phase 3.5: every other DashWind menu target is a real route rendering the
                shared "coming soon" placeholder, so the whole sidebar is clickable. */}
            {ADMIN_PORTAL_STUB_ROUTES.map((stub) => (
              <Route
                key={stub.segment}
                path={stub.segment}
                element={<AdminPortalStubPage title={stub.title} />}
              />
            ))}
          </Route>
          {/* Full-screen 404: a SIBLING of the guarded layout (still inside the theme
              wrapper, but OUTSIDE `<ProtectedRoute>`/`<AdminPortalLayout>`), so an unknown
              `/admin-portal/*` sub-path renders the 404 with no shell chrome and outside
              the guard. It auto-redirects to login after a countdown. */}
          <Route path={`${ADMIN_PORTAL_ROUTES.base}/*`} element={<AdminPortalNotFoundPage />} />
        </Route>
        <Route element={<ThemeLayout portal="client" />}>
          <Route path="/*" element={<HomePage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default App
