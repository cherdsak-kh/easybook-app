import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '@/App'
import { AuthProvider } from '@/auth/AuthProvider'
import { ADMIN_PORTAL_ROUTES } from '@/components/admin-portal/routes'
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
 * Route-wiring coverage for `/admin-portal/dashboard` through the REAL `App` tree —
 * `React.lazy` chunks, `Suspense`, `ProtectedRoute` and all. Every other admin suite
 * mounts its page directly, so nothing else would notice if the dashboard leaf stopped
 * being registered.
 *
 * The DashWind mock-data dashboard was deleted (fake stat cards + Chart.js canvases
 * showing invented numbers to a real operator). The segment now lives in
 * `ADMIN_PORTAL_STUB_ROUTES`, so `App` generates its `<Route>` alongside the other
 * placeholders — there is no bespoke lazy import for it any more.
 */
describe('App — /admin-portal/dashboard is an inert stub', () => {
  it('renders the shared "coming soon" placeholder titled ภาพรวมระบบ, with no console error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <MemoryRouter initialEntries={[ADMIN_PORTAL_ROUTES.dashboard]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    )

    // Awaiting the copy also awaits the lazy shell + stub chunks resolving.
    expect(await screen.findByText(/coming soon/i)).toBeInTheDocument()

    const main = screen.getByRole('main')
    // The segment is still `dashboard` (it is the shell's `index` redirect target); only
    // the LABEL changed, to the Thai `ภาพรวมระบบ` shared with the sidebar leaf.
    expect(within(main).getAllByText(ADMIN_NAV_STRINGS.items.dashboard).length).toBeGreaterThan(0)
    // The 404 never wins: the leaf is registered, so the global splat is not reached.
    expect(screen.queryByRole('heading', { name: '404 - Not Found' })).not.toBeInTheDocument()
    // Nothing renders mock data any more — no Chart.js canvas, no invented figures.
    expect(main.querySelector('canvas')).toBeNull()
    expect(within(main).queryByText('New Users')).not.toBeInTheDocument()
    expect(within(main).queryByText('$34,545')).not.toBeInTheDocument()

    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
