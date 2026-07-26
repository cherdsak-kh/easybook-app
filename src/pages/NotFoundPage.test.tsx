import { render, screen } from '@testing-library/react'
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { AdminPortalLayout } from '@/components/admin-portal/AdminPortalLayout'
import { AdminPortalThemeLayout } from '@/components/admin-portal/AdminPortalThemeLayout'
import { ThemeLayout } from '@/components/ThemeLayout'
import { ADMIN_PORTAL_ROUTES, ADMIN_PORTAL_SEGMENTS } from '@/components/admin-portal/routes'
import * as apiClient from '@/lib/api-client'

// Mock the api-client boundary (never the network) — the same convention as
// `AdminPortalLoginPage.test.tsx`. Only the bare-base→dashboard test below mounts the real
// admin shell (which probes `getMe`); the global-404 renders do not touch the api-client.
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
 * Mirrors the NEW global-404 shape of `App.tsx`: the admin `AdminPortalThemeLayout` branch
 * holds only the guarded layout (index → dashboard) with NO local 404, and a separate client
 * `ThemeLayout portal="client"` branch holds the client index plus the single global
 * `path="*"` → `NotFoundPage`, kept LAST. So an unknown URL under EITHER portal falls through
 * to that one global fallback, while the bare admin base still resolves through the layout's
 * `index`.
 *
 * The leaves are lightweight STAND-INS (`HOME`, `DASHBOARD REACHED`) — the real `HomePage`
 * runs LIFF/api effects, so it is never mounted here. The admin `AdminPortalLayout` (the real
 * shell) is mounted only for the bare-base precedence case, wrapped in `AuthProvider` (it
 * probes `getMe`); the global-404 renders never mount the shell, so they stay in a bare router.
 */
function renderAt(path: string, { withAuth = false }: { withAuth?: boolean } = {}) {
  const tree = (
    <Routes>
      <Route element={<AdminPortalThemeLayout />}>
        <Route path={ADMIN_PORTAL_ROUTES.base} element={<AdminPortalLayout />}>
          <Route index element={<Navigate to={ADMIN_PORTAL_ROUTES.dashboard} replace />} />
          <Route path={ADMIN_PORTAL_SEGMENTS.dashboard} element={<div>DASHBOARD REACHED</div>} />
        </Route>
      </Route>
      <Route element={<ThemeLayout portal="client" />}>
        <Route index element={<div>HOME</div>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
  return render(
    <MemoryRouter initialEntries={[path]}>
      {withAuth ? <AuthProvider>{tree}</AuthProvider> : tree}
    </MemoryRouter>,
  )
}

describe('NotFoundPage', () => {
  it('renders the 404 heading and a frown glyph (static component smoke)', () => {
    // The component is purely presentational — no router hook, no countdown, no redirect.
    // The `MemoryRouter` wrapper is kept deliberately (harmless) to stay consistent with the
    // shell-mounting tests below and guard a future re-introduction of a router hook.
    const { container } = render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: '404 - Not Found' })).toBeInTheDocument()
    // The frown glyph is decorative (`aria-hidden`), so assert its presence structurally.
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders the global 404 for an unknown ADMIN sub-path, with no shell chrome (AC-3)', () => {
    // `/admin-portal/fake` matches no leaf in the admin branch and there is no local splat,
    // so the admin branch is discarded and the URL falls through to the global `path="*"`.
    renderAt('/admin-portal/fake')

    expect(screen.getByRole('heading', { name: '404 - Not Found' })).toBeInTheDocument()
    // The admin shell never mounts (its route did not match), so there is no sidebar/header
    // navigation landmark...
    expect(screen.queryByRole('navigation')).toBeNull()
    // ...and it does not fall through to the dashboard.
    expect(screen.queryByText('DASHBOARD REACHED')).not.toBeInTheDocument()
  })

  it('renders the global 404 for an unknown CLIENT path (AC-4)', () => {
    renderAt('/fake-client')

    expect(screen.getByRole('heading', { name: '404 - Not Found' })).toBeInTheDocument()
    // The client index stand-in is NOT rendered for a bogus client path.
    expect(screen.queryByText('HOME')).not.toBeInTheDocument()
  })

  it('resolves the bare admin base to the dashboard — index beats the global splat (AC-5)', () => {
    renderAt(ADMIN_PORTAL_ROUTES.base, { withAuth: true })

    expect(screen.getByText('DASHBOARD REACHED')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '404 - Not Found' })).not.toBeInTheDocument()
  })

  it('resolves the client root to HomePage — index beats the global splat (AC-6)', () => {
    renderAt('/')

    expect(screen.getByText('HOME')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '404 - Not Found' })).not.toBeInTheDocument()
  })
})
