import { render, screen } from '@testing-library/react'
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { AdminPortalNotFoundPage } from '@/pages/admin-portal/AdminPortalNotFoundPage'
import { AdminPortalLayout } from '@/components/admin-portal/AdminPortalLayout'
import { AdminPortalThemeLayout } from '@/components/admin-portal/AdminPortalThemeLayout'
import { ADMIN_PORTAL_ROUTES, ADMIN_PORTAL_SEGMENTS } from '@/components/admin-portal/routes'
import * as apiClient from '@/lib/api-client'

// The shell's header now reads `useAuth().logout`, so the full-shell renders below must
// sit inside a real `AuthProvider`. Mock the api-client boundary (never the network) —
// the same convention as `AdminPortalLoginPage.test.tsx`; only `getMe` matters here (the
// mount probe), resolved unauthenticated so no session is required to render the shell.
vi.mock('@/lib/api-client', () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}))

const mockGetMe = vi.mocked(apiClient.getMe)

// jsdom lacks Element.prototype.scrollTo, which the shell's scroll-reset effect calls on
// navigation (same as the real DashboardLayout). Shim it so the full-shell render below
// does not throw — production code is unchanged.
beforeAll(() => {
  if (typeof Element.prototype.scrollTo !== 'function') {
    Element.prototype.scrollTo = () => {}
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  mockGetMe.mockResolvedValue(null) // unauthenticated mount probe — the shell renders regardless
})

/** Mirrors the inner `/admin-portal/*` route tree from `App.tsx` (Phase 4 wiring). */
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route element={<AdminPortalThemeLayout />}>
            <Route path={ADMIN_PORTAL_ROUTES.base} element={<AdminPortalLayout />}>
              <Route index element={<Navigate to={ADMIN_PORTAL_ROUTES.dashboard} replace />} />
              <Route path={ADMIN_PORTAL_SEGMENTS.dashboard} element={<div>DASHBOARD REACHED</div>} />
              <Route path="*" element={<AdminPortalNotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('AdminPortalNotFoundPage', () => {
  it('renders the 404 heading and a frown glyph (component smoke)', () => {
    render(<AdminPortalNotFoundPage />)
    expect(screen.getByRole('heading', { name: '404 - Not Found' })).toBeInTheDocument()
  })

  it('renders the 404 INSIDE the replica shell for an unknown sub-path (AC-7)', () => {
    renderAt('/admin-portal/does-not-exist')

    expect(screen.getByRole('heading', { name: '404 - Not Found' })).toBeInTheDocument()
    // It no longer redirects to the dashboard...
    expect(screen.queryByText('DASHBOARD REACHED')).not.toBeInTheDocument()
    // ...and the shell chrome is still present around it (a nav landmark from the sidebar).
    expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0)
  })

  it('still redirects the bare base to the dashboard — the index match wins over `*` (AC-7 edge case)', () => {
    renderAt(ADMIN_PORTAL_ROUTES.base)

    expect(screen.getByText('DASHBOARD REACHED')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '404 - Not Found' })).not.toBeInTheDocument()
  })
})
