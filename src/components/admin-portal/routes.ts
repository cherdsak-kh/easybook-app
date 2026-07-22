// Route constants adapted from DashWind (daisyui-admin-dashboard-template),
// https://github.com/robbins23/daisyui-admin-dashboard-template — MIT (c) 2022 Dashwind.
// See THIRD_PARTY_NOTICES.md. Local path constants for the isolated `/admin-portal`
// replica ONLY — deliberately does NOT touch the shared `src/constants/routes.ts`
// (which bases the REAL portal at `/backend`). Mirrors the template's
// `routes/index.js` + `routes/sidebar.js` paths, rebased under `/admin-portal`.

/** Base of the isolated replica branch. Distinct from the real portal's `/backend`. */
const BASE = '/admin-portal'

/**
 * Absolute react-router paths for the replica (used by NavLink / Navigate). Every
 * DashWind menu target has a real route now (Phase 3.5 made the whole sidebar
 * clickable): `dashboard`, `team` + `leads` have bespoke pages; the rest render the
 * shared `AdminPortalStubPage` (see `ADMIN_PORTAL_STUB_ROUTES`). The segment tail of
 * each path matches the corresponding `ADMIN_PORTAL_STUB_ROUTES.segment`.
 */
export const ADMIN_PORTAL_ROUTES = {
  base: BASE,
  login: `${BASE}/login`,
  dashboard: `${BASE}/dashboard`,
  team: `${BASE}/team`,
  leads: `${BASE}/leads`,
  transactions: `${BASE}/transactions`,
  charts: `${BASE}/charts`,
  integration: `${BASE}/integration`,
  calendar: `${BASE}/calendar`,
  register: `${BASE}/register`,
  forgotPassword: `${BASE}/forgot-password`,
  blank: `${BASE}/blank`,
  settingsProfile: `${BASE}/settings-profile`,
  settingsBilling: `${BASE}/settings-billing`,
  gettingStarted: `${BASE}/getting-started`,
  features: `${BASE}/features`,
  components: `${BASE}/components`,
} as const

/**
 * Relative child segments under the shell mounted at `base`, for the pages with a
 * bespoke component. React Router resolves these against the `AdminPortalLayout`
 * parent (`/admin-portal`), so `dashboard` -> `/admin-portal/dashboard`.
 */
export const ADMIN_PORTAL_SEGMENTS = {
  dashboard: 'dashboard',
  team: 'team',
  leads: 'leads',
} as const

/** A DashWind menu target that renders the shared placeholder `AdminPortalStubPage`. */
export interface AdminPortalStubRoute {
  /** Relative segment under the shell (matches the tail of the absolute route). */
  readonly segment: string
  /** Page + header title (kept in step with the `nav-config` label). */
  readonly title: string
}

/**
 * The DashWind menu targets that have no bespoke replica page — each renders the
 * shared `AdminPortalStubPage` ("coming soon" placeholder), parameterised by `title`,
 * so clicking any sidebar item produces a real route transition without hand-writing
 * ~13 near-identical files. `dashboard`, `team` + `leads` have real pages and are NOT
 * here; `login` is a full-screen sibling route (outside the shell) and is NOT here
 * either. Titles mirror the sidebar labels in `nav-config.tsx` so the header title
 * never drifts.
 */
export const ADMIN_PORTAL_STUB_ROUTES: readonly AdminPortalStubRoute[] = [
  { segment: 'transactions', title: 'Transactions' },
  { segment: 'charts', title: 'Analytics' },
  { segment: 'integration', title: 'Integration' },
  { segment: 'calendar', title: 'Calendar' },
  { segment: 'register', title: 'Register' },
  { segment: 'forgot-password', title: 'Forgot Password' },
  { segment: 'blank', title: 'Blank Page' },
  // NOTE: there is no `/admin-portal/404` route (the demo "404" sidebar leaf was
  // removed). Any unknown `/admin-portal/*` path — including the old demo `/404` —
  // is not routed here and falls through to the GLOBAL `*` → `NotFoundPage` in
  // `App.tsx`, which is the single 404 surface for the whole app.
  { segment: 'settings-profile', title: 'Profile' },
  { segment: 'settings-billing', title: 'Billing' },
  { segment: 'getting-started', title: 'Getting Started' },
  { segment: 'features', title: 'Features' },
  { segment: 'components', title: 'Components' },
]
