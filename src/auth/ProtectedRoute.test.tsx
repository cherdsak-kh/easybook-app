import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { ROUTES } from '@/constants/routes'
import * as apiClient from '@/lib/api-client'
import type { SystemUser } from '@/lib/api-client'

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

function renderGuarded(initialPath: string = ROUTES.dashboard) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path={ROUTES.login} element={<div>Login Page</div>} />
          <Route
            path={ROUTES.dashboard}
            element={
              <ProtectedRoute>
                <div>Dashboard Content</div>
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.forcePasswordChange}
            element={
              <ProtectedRoute>
                <div>Force Reset Screen</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ProtectedRoute', () => {
  it('redirects an unauthenticated visitor to /backend/login (AC-F1)', async () => {
    mockGetMe.mockResolvedValue(null) // 401 → unauthenticated
    renderGuarded()

    expect(await screen.findByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument()
  })

  it('shows a spinner during the probe without flashing the dashboard or redirecting', () => {
    mockGetMe.mockReturnValue(new Promise(() => {})) // never resolves → still loading
    renderGuarded()

    expect(screen.getByTestId('full-page-spinner')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument()
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument()
  })

  it('renders the protected children when authenticated (AC-F2)', async () => {
    mockGetMe.mockResolvedValue(makeUser())
    renderGuarded()

    expect(await screen.findByText('Dashboard Content')).toBeInTheDocument()
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument()
  })

  // --- Forced-reset gate (AC-F5). UX on top of the server gate, never a substitute.
  it('routes a gated user away from the dashboard to the force-reset screen (AC-F5)', async () => {
    mockGetMe.mockResolvedValue(makeUser({ mustChangePassword: true }))
    renderGuarded(ROUTES.dashboard)

    expect(await screen.findByText('Force Reset Screen')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument()
  })

  it('renders the force-reset screen itself while gated, without redirect-looping (AC-F5)', async () => {
    mockGetMe.mockResolvedValue(makeUser({ mustChangePassword: true }))
    renderGuarded(ROUTES.forcePasswordChange)

    // The redirect skips its own path, so the screen renders rather than
    // bouncing against itself forever.
    expect(await screen.findByText('Force Reset Screen')).toBeInTheDocument()
  })

  it('lets a user through once mustChangePassword is false (AC-F6)', async () => {
    mockGetMe.mockResolvedValue(makeUser({ mustChangePassword: false }))
    renderGuarded(ROUTES.dashboard)

    expect(await screen.findByText('Dashboard Content')).toBeInTheDocument()
    expect(screen.queryByText('Force Reset Screen')).not.toBeInTheDocument()
  })

  it('sends a gated but unauthenticated visitor to login, not the reset screen', async () => {
    mockGetMe.mockResolvedValue(null)
    renderGuarded(ROUTES.dashboard)

    expect(await screen.findByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Force Reset Screen')).not.toBeInTheDocument()
  })
})
