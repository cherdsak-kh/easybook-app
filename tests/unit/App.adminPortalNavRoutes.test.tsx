import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '@/App'
import { AuthProvider } from '@/auth/AuthProvider'
import { AdminPortalSidebar } from '@/components/admin-portal/AdminPortalSidebar'
import {
  ADMIN_PORTAL_ROUTES,
  ADMIN_PORTAL_STUB_ROUTES,
} from '@/components/admin-portal/routes'
import { allNavLeaves } from '@/components/admin-portal/nav-config'
import { ADMIN_NAV_STRINGS } from '@/constants/ui-strings-admin-nav'
import { makeSystemUser } from '@tests/helpers/system-user-factory'
import * as apiClient from '@/lib/api-client'

// Mock the api-client boundary (never the network) — the suite-wide convention. An
// authenticated `getMe` is required: `/admin-portal/*` sits behind `ProtectedRoute`, so an
// unauthenticated probe would bounce to the login screen instead of rendering the route.
vi.mock('@/lib/api-client', () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}))

const mockGetMe = vi.mocked(apiClient.getMe)

// jsdom lacks Element.prototype.scrollTo; the shell's scroll-reset effect calls it.
beforeAll(() => {
  if (typeof Element.prototype.scrollTo !== 'function') {
    Element.prototype.scrollTo = () => {}
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  mockGetMe.mockResolvedValue(makeSystemUser())
})

/**
 * "No menu item is ever a dead end" as an executable check, through the REAL `App` tree —
 * `React.lazy` chunks, `Suspense`, `ProtectedRoute` and all.
 *
 * This exists because the side-menu overhaul introduced MULTI-SEGMENT route paths
 * (`reports/analytics`, `account/login-history`, `settings/message-templates`,
 * `help/user-guide`). `App.tsx` registers them as a single `<Route path>` string nested
 * under `/admin-portal` — legal in React Router, but nothing else in the suite proves the
 * nested match actually resolves rather than falling through to the global `path="*"` 404.
 * A structural "every leaf has a stub entry" assertion cannot prove that; only a render can.
 */
describe('App — every admin-portal menu target resolves (zero 404s)', () => {
  it.each(ADMIN_PORTAL_STUB_ROUTES.map((stub) => [stub.segment, stub.title] as const))(
    '/%s renders its placeholder, not the global 404',
    async (segment, title) => {
      render(
        <MemoryRouter initialEntries={[`${ADMIN_PORTAL_ROUTES.base}/${segment}`]}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>,
      )

      // Awaiting the copy also awaits the lazy shell + stub chunks resolving.
      expect(await screen.findByText(/coming soon/i)).toBeInTheDocument()

      const main = screen.getByRole('main')
      // The page is headed by the SAME Thai literal as the menu item that reaches it.
      expect(within(main).getAllByText(title).length).toBeGreaterThan(0)
      expect(screen.queryByRole('heading', { name: '404 - Not Found' })).not.toBeInTheDocument()
    },
  )

  it('routes the two BESPOKE leaves to real segments, not to the stub table', () => {
    const stubPaths = ADMIN_PORTAL_STUB_ROUTES.map(
      (stub) => `${ADMIN_PORTAL_ROUTES.base}/${stub.segment}`,
    )
    expect(stubPaths).not.toContain(ADMIN_PORTAL_ROUTES.lineUsers)
    expect(stubPaths).not.toContain(ADMIN_PORTAL_ROUTES.profile)
    // …and both are still reachable from the menu (their pages are covered by their own suites).
    const leafPaths = allNavLeaves().map((l) => l.to)
    expect(leafPaths).toContain(ADMIN_PORTAL_ROUTES.lineUsers)
    expect(leafPaths).toContain(ADMIN_PORTAL_ROUTES.profile)
  })
})

describe('AdminPortalSidebar — deep links auto-expand the owning submenu', () => {
  it.each([
    [ADMIN_PORTAL_ROUTES.accountLoginHistory, ADMIN_NAV_STRINGS.groups.account],
    [ADMIN_PORTAL_ROUTES.settingsMessageTemplates, ADMIN_NAV_STRINGS.groups.system],
  ])('a direct load of %s opens %s on the first frame', (path, group) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <AdminPortalSidebar />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: group })).toHaveAttribute('aria-expanded', 'true')
  })
})
