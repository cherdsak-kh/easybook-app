import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
// Eager (initial chunk): the anonymous LIFF client (`/*` → HomePage) and the admin login
// screen must paint without waiting on a lazy chunk, so they stay statically imported.
// Both are dependency-light, so keeping them eager does not bloat the initial download
// the LIFF client pays for (Phase 4 design §4).
import { HomePage } from '@/pages/client-portal/HomePage'
import { AdminPortalLoginPage } from '@/pages/admin-portal/AdminPortalLoginPage'
import { ThemeLayout } from '@/components/client-portal/ThemeLayout'
import { AdminPortalThemeLayout } from '@/components/admin-portal/AdminPortalThemeLayout'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { DemoClientPortalPage } from '@/pages/demo/DemoClientPortalPage'
import { DemoAdminDashboardPage } from '@/pages/demo/DemoAdminDashboardPage'
import {
  ADMIN_PORTAL_ROUTES,
  ADMIN_PORTAL_SEGMENTS,
  ADMIN_PORTAL_STUB_ROUTES,
} from '@/components/admin-portal/routes'

// Lazy (route-split async chunks): every heroicon-heavy / dependency-heavy page in the
// `/admin-portal` branch is dynamically imported so the back-office never lands in the
// initial chunk the anonymous LIFF client downloads (Phase 4 design §4). Each source
// uses a NAMED export, so the `.then(m => ({ default: m.X }))` adaptation is required —
// `React.lazy` resolves a module's `default`.
const AdminPortalLayout = lazy(() =>
  import('@/components/admin-portal/AdminPortalLayout').then((m) => ({
    default: m.AdminPortalLayout,
  })),
)
// REMOVED with the side-menu overhaul: `AdminPortalTeamPage`. It rendered DashWind MOCK
// members (fake names, emails and join dates) to a real operator — the same reason the mock
// dashboard was deleted. Its successor is the `staff` placeholder, where the outstanding
// staff-management rebuild will land.
const AdminPortalLineUsersPage = lazy(() =>
  import('@/pages/admin-portal/AdminPortalLineUsersPage').then((m) => ({
    default: m.AdminPortalLineUsersPage,
  })),
)
const AdminPortalProfilePage = lazy(() =>
  import('@/pages/admin-portal/AdminPortalProfilePage').then((m) => ({
    default: m.AdminPortalProfilePage,
  })),
)
const AdminPortalStubPage = lazy(() =>
  import('@/pages/admin-portal/AdminPortalStubPage').then((m) => ({
    default: m.AdminPortalStubPage,
  })),
)
const NotFoundPage = lazy(() =>
  import('@/pages/NotFoundPage').then((m) => ({
    default: m.NotFoundPage,
  })),
)

/**
 * The single Suspense fallback for every lazily-loaded route chunk. A centered daisyUI
 * spinner. Because `HomePage` and the admin login page stay eager, this never flashes on
 * a first-paint-critical screen (`/`, `/admin-portal/login`) — only while a
 * back-office inner-page chunk is fetched.
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
 * Route tree with a single, unified GLOBAL 404. Two branches remain: the `/admin-portal`
 * back-office (its own theme + guard) and the client LIFF surface. The legacy `/backend`
 * portal and its `admin/**` pages were deleted in the Big Bang cutover; the V2
 * `AdminPortalLoginPage` (`/admin-portal/login`) is now the app's only admin login.
 *
 *  - `/admin-portal/login`  → the admin login form (eager, outside the guard).
 *  - `/admin-portal`        → protected shell (sidebar + header) with the two bespoke pages
 *    (+ known sub-paths)      (`line-users`, `profile`) plus the 29 placeholder routes generated
 *                             from `ADMIN_PORTAL_STUB_ROUTES` (`dashboard` is one of them; the
 *                             DashWind `team` page was deleted with the side-menu overhaul).
 *                             Stub segments may be MULTI-PART (`reports/analytics`,
 *                             `settings/roles`, …) — legal as one `<Route path>` string. Valid
 *                             routes stay behind `ProtectedRoute`, so an unauthenticated visit
 *                             redirects to the admin login — NOT the 404.
 *  - `/`                     → the client LIFF surface (`HomePage`). Matched at the INDEX
 *                             only — `HomePage` is route-less (it swaps screens via internal
 *                             state, not the URL), so the client portal has exactly one real
 *                             route.
 *  - `path="*"`              → the ONE global 404, kept LAST inside the client theme layout.
 *                             Any URL that matches no valid route — an unknown `/admin-portal/*`
 *                             sub-path OR an unknown client path — falls through here,
 *                             REGARDLESS of authentication (this fallback sits OUTSIDE
 *                             `ProtectedRoute`, so a bogus path shows the 404, not a login
 *                             bounce). React Router ranks the concrete/index routes above this
 *                             splat, so valid routes keep their auth behavior and only genuinely
 *                             unmatched URLs reach it.
 *
 * Theme consequence (deliberate — accepted in the plan): the global `path="*"` lives inside
 * `ThemeLayout portal="client"`, so an unknown ADMIN path renders the 404 in the CLIENT theme
 * rather than the `dashwind-*` admin theme. Unifying the 404 across both portals means one
 * theme wrapper; `NotFoundPage` uses only theme-agnostic semantic tokens, so it renders
 * correctly under either theme. No per-portal 404 theming (a second `path="*"` wrapper) — that
 * would be a different design.
 *
 * Each branch is wrapped in a pathless theme layout route that stamps the portal's daisyUI
 * `data-theme` onto the subtree. These wrappers are presentational only — they add no path
 * segment, so route specificity is unchanged.
 *
 * Phase 4: the in-shell `/admin-portal` pages are code-split (`React.lazy`) behind a
 * single top-level `<Suspense>`, so the anonymous LIFF client never eagerly downloads the
 * back-office. The trade-off (accepted, PO sign-off): the first in-shell page after login
 * shows a brief `RouteFallback` spinner while its chunk loads.
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
            Router ranks the concrete `/admin-portal/*` paths above the client index and the
            global `path="*"` fallback.

            404 handling is now GLOBAL, not admin-local: this branch has NO 404 route. An
            unknown `/admin-portal/*` sub-path matches no leaf here (there is no splat inside
            the guard), so it falls through to the single global `path="*"` in the client
            branch below. The bare base still resolves to the dashboard through the layout's
            `index`, and every KNOWN sub-path still renders in-shell behind `ProtectedRoute`
            (so an unauthenticated visit to a VALID admin route still redirects to login). */}
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
            {/* The (re-contextualised) LINE-user registration page renders REAL LINE-user
                data (wired via `useLineUsers` → `listLineUsers`). The URL segment is now
                `line-users` (renamed from `leads` to match the page/label). */}
            <Route path={ADMIN_PORTAL_SEGMENTS.lineUsers} element={<AdminPortalLineUsersPage />} />
            {/* Self-service profile. Replaces the `settings-profile` DashWind stub, which
                was deleted along with its route constant so the sidebar has exactly one
                "Profile" leaf. Lazy like every other in-shell page (Phase 4), so
                `react-easy-crop` never lands in the initial LIFF chunk. */}
            <Route path={ADMIN_PORTAL_SEGMENTS.profile} element={<AdminPortalProfilePage />} />
            {/* Every other menu target is a real route rendering the shared "coming soon"
                placeholder, so all 31 sidebar leaves are clickable and none 404s. This
                INCLUDES `dashboard` (its mock-data page was deleted). Segments here may be
                MULTI-part (`reports/analytics`, `settings/roles`, …) — that is a legal
                single `<Route path>` string, so this `.map()` needs no nested-route
                refactor to serve them. */}
            {ADMIN_PORTAL_STUB_ROUTES.map((stub) => (
              <Route
                key={stub.segment}
                path={stub.segment}
                element={<AdminPortalStubPage title={stub.title} />}
              />
            ))}
          </Route>
        </Route>
        <Route element={<ThemeLayout portal="client" />}>
          {/* MVP Demo Routes */}
          <Route path="/demo/client" element={<DemoClientPortalPage />} />
          <Route path="/demo/admin" element={<DemoAdminDashboardPage />} />
          
          {/* The client LIFF surface. `HomePage` is route-less (it swaps screens via
              internal state, not the URL), so it matches only the INDEX (`/`); there is no
              client sub-route to catch. */}
          <Route index element={<HomePage />} />
          {/* The single global 404, kept LAST. Any URL matching no valid route — an unknown
              `/admin-portal/*` sub-path OR an unknown client path — lands here, regardless of
              auth (this sits OUTSIDE `ProtectedRoute`). See the tree docstring for the
              deliberate client-theme tradeoff on admin 404s. */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default App
