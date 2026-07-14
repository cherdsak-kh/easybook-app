import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { Header } from '@/components/admin/Header'
import * as apiClient from '@/lib/api-client'
import type { SystemUser } from '@/lib/api-client'

vi.mock('@/lib/api-client', () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}))

const mockGetMe = vi.mocked(apiClient.getMe)
const mockLogout = vi.mocked(apiClient.logout)

function makeUser(overrides: Partial<SystemUser> = {}): SystemUser {
  return {
    id: 'u1',
    email: 'admin@easybook.local',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'SUPER_ADMIN',
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

function renderHeader() {
  return render(
    <MemoryRouter initialEntries={['/admin/dashboard/line-users']}>
      <AuthProvider>
        <Routes>
          <Route
            path="/admin/dashboard/line-users"
            element={<Header onMenuToggle={() => {}} />}
          />
          <Route path="/admin/login" element={<div>Login Page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Header', () => {
  it('shows the admin name and role from the session', async () => {
    mockGetMe.mockResolvedValue(makeUser())
    renderHeader()

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Super Admin')).toBeInTheDocument()
  })

  it('logs out and returns to the login page (AC-F5)', async () => {
    mockGetMe.mockResolvedValue(makeUser())
    mockLogout.mockResolvedValue(undefined)
    renderHeader()

    await screen.findByText('Ada Lovelace')
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))

    expect(await screen.findByText('Login Page')).toBeInTheDocument()
    expect(mockLogout).toHaveBeenCalled()
  })
})
