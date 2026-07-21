import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { ADMIN_PORTAL_ROUTES } from '@/components/admin-portal/routes'
import * as apiClient from '@/lib/api-client'
import type { SystemUser } from '@/lib/api-client'

// Phase 5 — proves the guard used on the (now sole) `/admin-portal` branch: an
// unauthenticated visitor lands on `/admin-portal/login` via the REQUIRED `loginPath`
// prop, and `forcePasswordChangePath={null}` admits a `mustChangePassword` admin without
// a force-reset bounce (accepted lockout R2). The legacy `/backend` guard test + the
// no-prop default case were removed with the Big Bang cutover: `loginPath` is now
// required, so there is no default to assert.

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
          <Route path={ADMIN_PORTAL_ROUTES.login} element={<div>Admin Portal Login</div>} />
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

describe('ProtectedRoute — admin-portal guard (Phase 5)', () => {
  it('redirects an unauthenticated /admin-portal visitor to /admin-portal/login (AC-D8)', async () => {
    mockGetMe.mockResolvedValue(null) // 401 → unauthenticated

    renderGuarded(ADMIN_PORTAL_ROUTES.dashboard, {
      loginPath: ADMIN_PORTAL_ROUTES.login,
      forcePasswordChangePath: null,
      children: <div>Admin Portal Dashboard</div>,
    })

    expect(await screen.findByText('Admin Portal Login')).toBeInTheDocument()
    expect(screen.queryByText('Admin Portal Dashboard')).not.toBeInTheDocument()
  })

  it('admits a mustChangePassword admin when forcePasswordChangePath is null (accepted lockout R2, AC-D8)', async () => {
    mockGetMe.mockResolvedValue(makeUser({ mustChangePassword: true }))

    renderGuarded(ADMIN_PORTAL_ROUTES.dashboard, {
      loginPath: ADMIN_PORTAL_ROUTES.login,
      forcePasswordChangePath: null,
      children: <div>Admin Portal Dashboard</div>,
    })

    // The null sentinel skips the force-reset redirect entirely: the admin is
    // admitted (there is no in-app reset screen this phase; the server still 403s
    // every mutation until the password is changed out of band).
    expect(await screen.findByText('Admin Portal Dashboard')).toBeInTheDocument()
  })
})
