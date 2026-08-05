// Ported from DashWind (daisyui-admin-dashboard-template) — MIT (c) 2022 Dashwind. See THIRD_PARTY_NOTICES.md
// Single source of the admin portal's react-router URL paths — NOT API paths.

/** Base of every admin-portal path — rebasing the back-office is a one-line edit here. */
const BASE = '/admin-portal'

/**
 * Absolute react-router paths (used by NavLink / Navigate). Every
 * DashWind menu target has a real route now (Phase 3.5 made the whole sidebar
 * clickable): `team`, `line-users` + `profile` have bespoke pages; the rest — including
 * `dashboard` — render the shared `AdminPortalStubPage` (see `ADMIN_PORTAL_STUB_ROUTES`).
 * The segment tail of each path matches the corresponding
 * `ADMIN_PORTAL_STUB_ROUTES.segment`.
 */
export const ADMIN_PORTAL_ROUTES = {
  base: BASE,
  login: `${BASE}/login`,
  dashboard: `${BASE}/dashboard`,
  team: `${BASE}/team`,
  lineUsers: `${BASE}/line-users`,
  transactions: `${BASE}/transactions`,
  charts: `${BASE}/charts`,
  integration: `${BASE}/integration`,
  calendar: `${BASE}/calendar`,
  // REMOVED with the `Pages` sidebar submenu: `register`, `forgotPassword`, `blank`.
  // They were DashWind placeholder screens for auth flows this product does not have.
  // Their paths now match no route and fall through to the GLOBAL `*` → `NotFoundPage`,
  // which is the single 404 surface for the whole app — no redirect was added, by design.
  // `login` STAYS: it is the real, working admin login page.
  /**
   * The REAL self-service profile page. It replaced the DashWind `settings-profile`
   * stub outright: the constant, the stub entry and the second sidebar leaf were all
   * removed together, because two entries both titled "Profile" in one sidebar is a
   * defect, not a feature.
   */
  profile: `${BASE}/profile`,
  settingsBilling: `${BASE}/settings-billing`,
  gettingStarted: `${BASE}/getting-started`,
  features: `${BASE}/features`,
  components: `${BASE}/components`,
} as const

/**
 * Relative child segments under the shell mounted at `base`, for the pages with a
 * bespoke component. React Router resolves these against the `AdminPortalLayout`
 * parent (`/admin-portal`), so `team` -> `/admin-portal/team`.
 *
 * NOTE: `dashboard` is NOT here. Its DashWind mock-data page was deleted and the route
 * is now generated from `ADMIN_PORTAL_STUB_ROUTES` like every other placeholder. The
 * absolute `ADMIN_PORTAL_ROUTES.dashboard` STAYS — the sidebar leaf and the shell's
 * `index` redirect still target it.
 */
export const ADMIN_PORTAL_SEGMENTS = {
  team: 'team',
  lineUsers: 'line-users',
  profile: 'profile',
} as const

/** A DashWind menu target that renders the shared placeholder `AdminPortalStubPage`. */
export interface AdminPortalStubRoute {
  /** Relative segment under the shell (matches the tail of the absolute route). */
  readonly segment: string
  /** Page + header title (kept in step with the `nav-config` label). */
  readonly title: string
}

/**
 * The DashWind menu targets that have no bespoke page — each renders the
 * shared `AdminPortalStubPage` ("coming soon" placeholder), parameterised by `title`,
 * so clicking any sidebar item produces a real route transition without hand-writing
 * ~13 near-identical files. `team`, `line-users` + `profile` have real pages and are NOT
 * here; `login` is a full-screen sibling route (outside the shell) and is NOT here
 * either. Titles mirror the sidebar labels in `nav-config.tsx` so the header title
 * never drifts.
 */
export const ADMIN_PORTAL_STUB_ROUTES: readonly AdminPortalStubRoute[] = [
  // `dashboard` renders the SHARED stub like the rest: its bespoke page composed
  // DashWind mock data (fake stat cards + Chart.js canvases) that showed invented
  // numbers to a real operator, so the page and its whole mock-component directory were
  // deleted. Keeping the segment here preserves the sidebar leaf and the shell's `index`
  // redirect — only the body became inert.
  { segment: 'dashboard', title: 'Dashboard' },
  { segment: 'transactions', title: 'Transactions' },
  { segment: 'charts', title: 'Analytics' },
  { segment: 'integration', title: 'Integration' },
  { segment: 'calendar', title: 'Calendar' },
  // NOTE: `register`, `forgot-password` and `blank` used to stub three more DashWind
  // screens here. They are GONE along with the `Pages` sidebar submenu that reached them.
  // Because `App.tsx` generates one `<Route>` per entry in THIS array, deleting the
  // entries is what deletes the routes — there is no per-route registration to also edit,
  // and no bespoke component to delete either (all three rendered the SHARED
  // `AdminPortalStubPage`, which eight other menu targets still use, so it stays).
  // NOTE: there is no `/admin-portal/404` route (the demo "404" sidebar leaf was
  // removed). Any unknown `/admin-portal/*` path — including the old demo `/404` —
  // is not routed here and falls through to the GLOBAL `*` → `NotFoundPage` in
  // `App.tsx`, which is the single 404 surface for the whole app.
  // NOTE: `settings-profile` used to stub a "Profile" page here. It is GONE — the real
  // `/admin-portal/profile` page owns that sidebar leaf now.
  { segment: 'settings-billing', title: 'Billing' },
  { segment: 'getting-started', title: 'Getting Started' },
  { segment: 'features', title: 'Features' },
  { segment: 'components', title: 'Components' },
]
