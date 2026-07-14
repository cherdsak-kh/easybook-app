import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
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
    position: 'Director',
    department: 'CS',
    phoneNumber: null,
    profilePictureUrl: null,
    isActive: true,
    lineUserId: null,
    lastLoginAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

function renderGuarded() {
  return render(
    <MemoryRouter initialEntries={['/admin/dashboard']}>
      <AuthProvider>
        <Routes>
          <Route path="/admin/login" element={<div>Login Page</div>} />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute>
                <div>Dashboard Content</div>
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
  it('redirects an unauthenticated visitor to /admin/login (AC-F1)', async () => {
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
})
