import { DASHBOARD_CHILDREN, ROUTES } from '@/constants/routes'

/**
 * The ANCHOR for the `/admin` → `/backend` rebase.
 *
 * Every other suite imports `ROUTES`, which means they all pass no matter what
 * the base segment is — flip `PORTAL_BASE` back to `/admin` and the rest of the
 * suite stays green while the product requirement silently breaks. This file is
 * the one place that pins the literal strings, so the requirement ("no `/admin`
 * route paths in the frontend") is enforced by CI rather than by memory.
 *
 * These literals are SUPPOSED to be duplicated from `routes.ts`. That is the
 * entire point — asserting `ROUTES.login === ROUTES.login` would prove nothing.
 */
describe('ROUTES', () => {
  it('bases the whole portal at /backend', () => {
    expect(ROUTES.portalBase).toBe('/backend')
  })

  it('exposes every portal path under /backend', () => {
    expect(ROUTES).toMatchObject({
      portalBase: '/backend',
      login: '/backend/login',
      forcePasswordChange: '/backend/force-password-change',
      dashboard: '/backend/dashboard',
      lineUsers: '/backend/dashboard/line-users',
      options: '/backend/dashboard/options',
      staff: '/backend/dashboard/staff',
      profile: '/backend/dashboard/profile',
    })
  })

  it('has no /admin path left anywhere in the route table', () => {
    for (const path of Object.values(ROUTES)) {
      expect(path.startsWith('/admin')).toBe(false)
      expect(path.startsWith('/backend')).toBe(true)
    }
  })

  it('keeps the dashboard sub-path structure unchanged (only the base segment moved)', () => {
    expect(DASHBOARD_CHILDREN).toEqual({
      lineUsers: 'line-users',
      options: 'options',
      staff: 'staff',
      profile: 'profile',
    })
  })

  it('composes each absolute dashboard path from its relative segment', () => {
    // Guards the router/sidebar split: App.tsx registers the RELATIVE segment as
    // a nested child while NavLink navigates to the ABSOLUTE path. If those two
    // ever disagree the sidebar links 404 into the client catch-all.
    expect(ROUTES.lineUsers).toBe(`${ROUTES.dashboard}/${DASHBOARD_CHILDREN.lineUsers}`)
    expect(ROUTES.options).toBe(`${ROUTES.dashboard}/${DASHBOARD_CHILDREN.options}`)
    expect(ROUTES.staff).toBe(`${ROUTES.dashboard}/${DASHBOARD_CHILDREN.staff}`)
    expect(ROUTES.profile).toBe(`${ROUTES.dashboard}/${DASHBOARD_CHILDREN.profile}`)
  })
})
