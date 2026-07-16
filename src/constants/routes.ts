/**
 * Client-side ROUTE paths for the back-office portal, in one place so a rebase of
 * the base segment is a one-line edit and tests assert the SAME strings the
 * router registers.
 *
 * ## Why this exists
 * The portal was rebased `/admin` → `/backend` and the literal was duplicated
 * across the router, the auth guard, the login page, the sidebar and four test
 * files. Every copy was a chance to miss one — and a missed redirect target
 * fails SILENTLY (you land on the client portal's catch-all instead of an
 * error). One definition, derived sub-paths, no drift.
 *
 * ## CRITICAL: these are URL paths, not API paths
 * This file is for `react-router` only — `<Route path>`, `navigate()`,
 * `<Navigate to>`, `<Link to>`, `<NavLink to>`. The backend's admin surface is
 * deliberately `/auth/system/*` and `/api/v1/system-users` ("**system**, never
 * admin"). Never import this into `api-client.ts`, and never point a request URL
 * at it: the two namespaces are unrelated and coupling them would break auth.
 *
 * ## What this is NOT
 * Not a route builder, not a typed-link layer. Just an `as const` object of
 * strings. Parameterised routes (`/thing/:id`) can arrive as formatters when a
 * route actually needs one — do not add one speculatively.
 */

/**
 * The portal's base segment. Rebasing the whole back-office is editing THIS
 * line; everything below derives from it.
 */
const PORTAL_BASE = '/backend'

const DASHBOARD = `${PORTAL_BASE}/dashboard`

/**
 * Dashboard sub-paths as RELATIVE segments, because `App.tsx` nests them under
 * the `DASHBOARD` parent route where React Router expects relative children.
 * `ROUTES` below composes these into the absolute paths that `NavLink`/
 * `navigate()` need, so the two can never disagree.
 */
export const DASHBOARD_CHILDREN = {
  lineUsers: 'line-users',
  options: 'options',
  staff: 'staff',
  profile: 'profile',
} as const

export const ROUTES = {
  /** Base of the portal branch. `App.tsx` keeps the client catch-all off it. */
  portalBase: PORTAL_BASE,

  login: `${PORTAL_BASE}/login`,
  /**
   * The forced password-change screen: inside the auth guard (you must be signed
   * in) but outside the dashboard shell (there is nowhere to navigate while
   * gated).
   */
  forcePasswordChange: `${PORTAL_BASE}/force-password-change`,

  dashboard: DASHBOARD,
  lineUsers: `${DASHBOARD}/${DASHBOARD_CHILDREN.lineUsers}`,
  options: `${DASHBOARD}/${DASHBOARD_CHILDREN.options}`,
  staff: `${DASHBOARD}/${DASHBOARD_CHILDREN.staff}`,
  profile: `${DASHBOARD}/${DASHBOARD_CHILDREN.profile}`,
} as const
