import { canReach } from '@/admin-portal/lib/use-acl'
import type { SystemRole } from '@/admin-portal/labels'
import {
  ADMIN_PORTAL_ROUTES,
  decideAdminRoute,
  resolveAdminRoute,
  urlOf,
  type AdminRouteLabel,
} from '@/admin-portal/routes'

/**
 * LOW-3 (`REPORTS-P2-LOW-3`): `BackendLayout` used to find the current row with
 * `urlOf(r) === pathname`. React Router renders far more spellings than that compare finds, so
 * `/backend/reports/error-log/` rendered the page while the ACL check was skipped. The ACL key is
 * now the row the ROUTER'S OWN matcher resolves; these cases pin it.
 *
 * `decide()` is the exact decision `BackendLayout` acts on: `page` renders, `canonical` redirects
 * (replace) an allowed role to the canonical spelling, `home` redirects a denied role BEFORE the page
 * mounts, `none` is "the router has no row here" (in-shell 404 or a legacy redirect).
 */
const decide = (role: SystemRole, pathname: string) =>
  decideAdminRoute(pathname, (label) => canReach(role, label)).kind

const ERR: AdminRouteLabel = 'บันทึกข้อผิดพลาด'
const EXPORT: AdminRouteLabel = 'ส่งออกรายงานราชการ'
const ACTIVITY: AdminRouteLabel = 'ประวัติการทำรายการ'

type Kind = 'page' | 'canonical' | 'home' | 'none'

// [pathname, resolved label (null = no row), SUPER_ADMIN, ADMIN, VIEWER]: the design's §3.1 table.
const MATRIX: readonly [string, AdminRouteLabel | null, Kind, Kind, Kind][] = [
  ['/backend/reports/error-log', ERR, 'page', 'home', 'home'],
  ['/backend/reports/error-log/', ERR, 'canonical', 'home', 'home'],
  ['/backend/reports/error-log//', ERR, 'canonical', 'home', 'home'],
  ['/backend/reports/ERROR-LOG', ERR, 'canonical', 'home', 'home'],
  ['/backend/reports/Error-Log/', ERR, 'canonical', 'home', 'home'],
  ['/backend/reports/error%2Dlog', ERR, 'canonical', 'home', 'home'],
  ['/backend/reports/error%2dlog', ERR, 'canonical', 'home', 'home'],
  ['/BACKEND/reports/error-log', ERR, 'canonical', 'home', 'home'],
  ['/Backend/Reports/Error-Log/', ERR, 'canonical', 'home', 'home'],
  // A doubled slash INSIDE the path matches no row in the router either (it reaches the 404).
  ['/backend//reports/error-log', null, 'none', 'none', 'none'],
  ['/backend/reports/error-log/x', null, 'none', 'none', 'none'],
  ['/backend/reports/error%2Flog', null, 'none', 'none', 'none'],
  ['/backend/reports/%E0%A4%A', null, 'none', 'none', 'none'],
  // Hub 4 and Hub 5: SUPER_ADMIN and ADMIN, never VIEWER.
  ['/backend/reports/export', EXPORT, 'page', 'page', 'home'],
  ['/backend/reports/export/', EXPORT, 'canonical', 'canonical', 'home'],
  ['/backend/reports/EXPORT', EXPORT, 'canonical', 'canonical', 'home'],
  ['/backend/reports/activity', ACTIVITY, 'page', 'page', 'home'],
  ['/backend/reports/activity/', ACTIVITY, 'canonical', 'canonical', 'home'],
  ['/backend/reports/Activity', ACTIVITY, 'canonical', 'canonical', 'home'],
  // A non-report denied row.
  ['/backend/settings/integrations', 'การเชื่อมต่อระบบ', 'page', 'page', 'home'],
  ['/backend/settings/integrations/', 'การเชื่อมต่อระบบ', 'canonical', 'canonical', 'home'],
  // Rows every role may open.
  ['/backend/dashboard', 'ภาพรวมระบบ', 'page', 'page', 'page'],
  ['/backend/dashboard/', 'ภาพรวมระบบ', 'canonical', 'canonical', 'canonical'],
  ['/backend/reports/overview/', 'ภาพรวมสถิติ', 'canonical', 'canonical', 'canonical'],
  ['/backend/reports/venues', 'การใช้สถานที่และช่วงเวลา', 'page', 'page', 'page'],
  ['/backend/reports/operations', 'สถิติตามฝ่ายและการดำเนินงาน', 'page', 'page', 'page'],
  // Not rows at all: the shell root, the login URL, the legacy redirects, outsiders.
  ['/backend', null, 'none', 'none', 'none'],
  ['/backend/', null, 'none', 'none', 'none'],
  ['/backend/login', null, 'none', 'none', 'none'],
  ['/backend/reports/bookings', null, 'none', 'none', 'none'],
  ['/backendx/reports/error-log', null, 'none', 'none', 'none'],
  ['/reports/error-log', null, 'none', 'none', 'none'],
]

describe('resolveAdminRoute: which row would the router render?', () => {
  it.each(MATRIX)('%s resolves to %s', (pathname, label) => {
    expect(resolveAdminRoute(pathname)?.label ?? null).toBe(label)
  })

  it('returns the SAME table object, so a caller can compare rows by identity', () => {
    expect(resolveAdminRoute('/backend/reports/error-log/')).toBe(
      ADMIN_PORTAL_ROUTES.find((r) => r.label === ERR),
    )
  })

  it('resolves every row of the table from its canonical URL', () => {
    for (const r of ADMIN_PORTAL_ROUTES) {
      expect(resolveAdminRoute(urlOf(r))).toBe(r)
    }
  })
})

describe('decideAdminRoute: the LOW-3 matrix (AC-D11), per role', () => {
  it.each(MATRIX)('%s', (pathname, _label, superAdmin, admin, viewer) => {
    expect(decide('SUPER_ADMIN', pathname)).toBe(superAdmin)
    expect(decide('ADMIN', pathname)).toBe(admin)
    expect(decide('VIEWER', pathname)).toBe(viewer)
  })

  it('canonicalises to the row URL, whatever the spelling', () => {
    const d = decideAdminRoute('/BACKEND/reports/Error-Log//', () => true)
    expect(d).toMatchObject({ kind: 'canonical', to: '/backend/reports/error-log' })
  })

  it('sends a denied role home for EVERY row and EVERY spelling the router accepts', () => {
    const spellings = (url: string) => [
      url,
      `${url}/`,
      `${url}//`,
      url.toUpperCase(),
      `${url.toUpperCase()}/`,
      url.replace(/-/g, '%2D'),
      url.replace('/backend', '/BACKEND'),
    ]
    for (const role of ['SUPER_ADMIN', 'ADMIN', 'VIEWER'] as const) {
      for (const r of ADMIN_PORTAL_ROUTES) {
        for (const spelled of spellings(urlOf(r))) {
          const d = decideAdminRoute(spelled, (l) => canReach(role, l))
          // The spelling must resolve to the same row as the canonical URL...
          expect(d.kind, `${spelled} must not escape the table`).not.toBe('none')
          // ...and a denied row must never reach `page` or `canonical` (the page would mount).
          if (!canReach(role, r.label)) expect(d.kind, `${role} ${spelled}`).toBe('home')
          else expect(['page', 'canonical']).toContain(d.kind)
        }
      }
    }
  })

  it('never denies a row to a role that may reach it, and never mounts a denied one (Hubs 4 to 6)', () => {
    const cases: [AdminRouteLabel, SystemRole, boolean][] = [
      [EXPORT, 'SUPER_ADMIN', true],
      [EXPORT, 'ADMIN', true],
      [EXPORT, 'VIEWER', false],
      [ACTIVITY, 'SUPER_ADMIN', true],
      [ACTIVITY, 'ADMIN', true],
      [ACTIVITY, 'VIEWER', false],
      [ERR, 'SUPER_ADMIN', true],
      [ERR, 'ADMIN', false],
      [ERR, 'VIEWER', false],
    ]
    for (const [label, role, allowed] of cases) {
      const row = ADMIN_PORTAL_ROUTES.find((r) => r.label === label)!
      const kind = decide(role, `${urlOf(row)}/`)
      expect(kind).toBe(allowed ? 'canonical' : 'home')
    }
  })
})
