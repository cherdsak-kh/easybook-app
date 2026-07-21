import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { ROUTES } from '@/constants/routes'
import { ADMIN_PORTAL_ROUTES } from '@/components/admin-portal/routes'
import * as apiClient from '@/lib/api-client'
import type { SystemUser } from '@/lib/api-client'

// Phase 5.1 — proves the PARAMETERIZED guard used on the `/admin-portal` branch:
// an unauthenticated visitor lands on `/admin-portal/login` (NOT `/backend/login`),
// the no-prop default still targets `/backend/login` (legacy default intact), and
// `forcePasswordChangePath={null}` skips the force-reset bounce. The legacy
// `ProtectedRoute.test.tsx` is left untouched — this file adds coverage, it does not
// weaken it.

// Mock the API client at the module boundary — AuthProvider probes getMe.
vi.mock('@/lib/api-client', () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}))

const mockGetMe = vi.mocked(apiClient.getMe)

function makeUser(overrides: Partial<SystemUser> = {}): SystemUser {
  return {
    id: 'u1',
    email: 'admin@easybook.local',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'ADMIN',
    personnelRole: { id: 1, name: 'Director' },
    department: { id: 2, name: 'CS' },
    mustChangePassword: false,
    phoneNumber: null,
    profilePictureUrl: null,
    isActive: true,
    lineUserId: null,
    lastLoginAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

/**
 * Mounts BOTH portals' login routes plus one guarded route, so a redirect target is
 * observable by which login screen renders. `guardProps` decides which portal the
 * guarded route belongs to.
 */
function renderGuarded(
  initialPath: string,
  guardProps: React.ComponentProps<typeof ProtectedRoute>,
) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path={ROUTES.login} element={<div>Backend Login</div>} />
          <Route path={ADMIN_PORTAL_ROUTES.login} element={<div>Admin Portal Login</div>} />
          <Route
            path={ROUTES.forcePasswordChange}
            element={<div>Backend Force Reset</div>}
          />
          <Route
            path={initialPath}
            element={<ProtectedRoute {...guardProps} />}
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ProtectedRoute — admin-portal parameterization (Phase 5.1)', () => {
  it('redirects an unauthenticated /admin-portal visitor to /admin-portal/login, not /backend/login (AC-3)', async () => {
    mockGetMe.mockResolvedValue(null) // 401 → unauthenticated

    renderGuarded(ADMIN_PORTAL_ROUTES.dashboard, {
      loginPath: ADMIN_PORTAL_ROUTES.login,
      forcePasswordChangePath: null,
      children: <div>Admin Portal Dashboard</div>,
    })

    expect(await screen.findByText('Admin Portal Login')).toBeInTheDocument()
    // Crucially, it must NOT cross-bounce to the legacy backend login.
    expect(screen.queryByText('Backend Login')).not.toBeInTheDocument()
    expect(screen.queryByText('Admin Portal Dashboard')).not.toBeInTheDocument()
  })

  it('still redirects an unauthenticated visitor to /backend/login with the no-prop default (legacy default intact, AC-1)', async () => {
    mockGetMe.mockResolvedValue(null) // 401 → unauthenticated

    // No loginPath prop → defaults to ROUTES.login (/backend/login).
    renderGuarded(ROUTES.dashboard, {
      children: <div>Backend Dashboard</div>,
    })

    expect(await screen.findByText('Backend Login')).toBeInTheDocument()
    expect(screen.queryByText('Admin Portal Login')).not.toBeInTheDocument()
    expect(screen.queryByText('Backend Dashboard')).not.toBeInTheDocument()
  })

  it('admits a mustChangePassword admin on /admin-portal when forcePasswordChangePath is null (no cross-portal bounce, AC-4)', async () => {
    mockGetMe.mockResolvedValue(makeUser({ mustChangePassword: true }))

    renderGuarded(ADMIN_PORTAL_ROUTES.dashboard, {
      loginPath: ADMIN_PORTAL_ROUTES.login,
      forcePasswordChangePath: null,
      children: <div>Admin Portal Dashboard</div>,
    })

    // The null sentinel skips the force-reset redirect entirely: the admin is
    // admitted rather than bounced to /backend/force-password-change.
    expect(await screen.findByText('Admin Portal Dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Backend Force Reset')).not.toBeInTheDocument()
  })
})
