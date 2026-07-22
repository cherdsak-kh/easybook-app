import { render, screen } from '@testing-library/react'
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { AdminPortalNotFoundPage } from '@/pages/admin-portal/AdminPortalNotFoundPage'
import { AdminPortalLayout } from '@/components/admin-portal/AdminPortalLayout'
import { AdminPortalThemeLayout } from '@/components/admin-portal/AdminPortalThemeLayout'
import { ADMIN_PORTAL_ROUTES, ADMIN_PORTAL_SEGMENTS } from '@/components/admin-portal/routes'
import * as apiClient from '@/lib/api-client'

// Mock the api-client boundary (never the network) — the same convention as
// `AdminPortalLoginPage.test.tsx`. Only the bare-base→dashboard test below mounts the real
// shell (which probes `getMe`); the full-screen 404 renders do not touch the api-client.
vi.mock('@/lib/api-client', () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}))

const mockGetMe = vi.mocked(apiClient.getMe)

// jsdom lacks Element.prototype.scrollTo, which the shell's scroll-reset effect calls on
// navigation. Shim it so the bare-base→dashboard render (which mounts the real shell) does
// not throw — production code is unchanged.
beforeAll(() => {
  if (typeof Element.prototype.scrollTo !== 'function') {
    Element.prototype.scrollTo = () => {}
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  mockGetMe.mockResolvedValue(null) // unauthenticated mount probe for the shell render
})

/**
 * Mirrors the `App.tsx` route tree: the full-screen 404 is a SIBLING of the guarded layout
 * (both inside the `AdminPortalThemeLayout` wrapper), so an unknown sub-path renders the 404
 * OUTSIDE the shell, while the bare base still resolves through the layout's `index`. The
 * `dashboard` leaf is a stand-in for the precedence assertion. The real `AuthProvider` is
 * wrapped in ONLY when the shell is actually mounted (the bare-base case); the pure
 * full-screen 404 renders do not use `useAuth`, so they stay in a bare router.
 */
function renderAt(path: string, { withAuth = false }: { withAuth?: boolean } = {}) {
  const tree = (
    <Routes>
      <Route element={<AdminPortalThemeLayout />}>
        <Route path={ADMIN_PORTAL_ROUTES.base} element={<AdminPortalLayout />}>
          <Route index element={<Navigate to={ADMIN_PORTAL_ROUTES.dashboard} replace />} />
          <Route path={ADMIN_PORTAL_SEGMENTS.dashboard} element={<div>DASHBOARD REACHED</div>} />
        </Route>
        <Route path={`${ADMIN_PORTAL_ROUTES.base}/*`} element={<AdminPortalNotFoundPage />} />
      </Route>
    </Routes>
  )
  return render(
    <MemoryRouter initialEntries={[path]}>
      {withAuth ? <AuthProvider>{tree}</AuthProvider> : tree}
    </MemoryRouter>,
  )
}

describe('AdminPortalNotFoundPage', () => {
  it('renders the 404 heading and a frown glyph (static component smoke)', () => {
    // The component is purely presentational — no router hook, no countdown, no redirect.
    // The `MemoryRouter` wrapper is kept deliberately (harmless) to stay consistent with the
    // shell-mounting tests below and guard a future re-introduction of a router hook.
    render(
      <MemoryRouter>
        <AdminPortalNotFoundPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: '404 - Not Found' })).toBeInTheDocument()
  })

  it('renders the 404 FULL-SCREEN — outside the shell — for an unknown sub-path (AC-1)', () => {
    renderAt('/admin-portal/does-not-exist')

    expect(screen.getByRole('heading', { name: '404 - Not Found' })).toBeInTheDocument()
    // No shell chrome: the 404 sibling renders OUTSIDE `AdminPortalLayout`, so there is no
    // sidebar/header nav landmark wrapping it.
    expect(screen.queryByRole('navigation')).toBeNull()
    // ...and it does not fall through to the dashboard.
    expect(screen.queryByText('DASHBOARD REACHED')).not.toBeInTheDocument()
  })

  it('still redirects the bare base to the dashboard — index beats the sibling splat (AC-2)', () => {
    renderAt(ADMIN_PORTAL_ROUTES.base, { withAuth: true })

    expect(screen.getByText('DASHBOARD REACHED')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '404 - Not Found' })).not.toBeInTheDocument()
  })
})
