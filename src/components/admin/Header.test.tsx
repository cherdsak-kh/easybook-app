import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { Header } from '@/components/admin/Header'
import { ROUTES } from '@/constants/routes'
import { UI_STRINGS } from '@/constants/ui-strings-backend'
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

function renderHeader() {
  return render(
    <MemoryRouter initialEntries={[ROUTES.lineUsers]}>
      <AuthProvider>
        <Routes>
          <Route path={ROUTES.lineUsers} element={<Header />} />
          <Route path={ROUTES.login} element={<div>Login Page</div>} />
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
    mockGetMe.mockResolvedValue(makeUser({ role: 'SUPER_ADMIN' }))
    renderHeader()

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    // The session's role picks its own label — not ADMIN's, not STAFF's.
    expect(screen.getByText(UI_STRINGS.roles.SUPER_ADMIN)).toBeInTheDocument()
    expect(screen.queryByText(UI_STRINGS.roles.STAFF)).not.toBeInTheDocument()
  })

  it('renders the brand mark beside the product name, decoratively', async () => {
    mockGetMe.mockResolvedValue(makeUser())
    const { container } = renderHeader()
    await screen.findByText('Ada Lovelace')

    // Not queryable by role/alt precisely BECAUSE it is decorative, which is the
    // property under test.
    const logo = container.querySelector('img[src="/logo/easybook-logo-512px-no-bg.svg"]')
    expect(logo).toBeInTheDocument()
    // The adjacent "EasyBook" text already names the product;
    // alt text here would announce it twice.
    expect(logo).toHaveAttribute('alt', '')
  })

  it("shows the signed-in user's avatar from the /me probe", async () => {
    mockGetMe.mockResolvedValue(makeUser({ profilePictureUrl: 'https://cdn.example.com/me.jpg' }))
    renderHeader()

    // Proves the session probe carries profilePictureUrl through to the header —
    // the login response has no such field, so only /me can supply it.
    const img = await screen.findByTestId<HTMLImageElement>('avatar-image')
    expect(img.src).toBe('https://cdn.example.com/me.jpg')
  })

  it('falls back to initials when the signed-in user has no picture', async () => {
    mockGetMe.mockResolvedValue(makeUser({ profilePictureUrl: null }))
    renderHeader()

    expect(await screen.findByTestId('avatar-fallback')).toHaveTextContent('AL')
    expect(screen.queryByTestId('avatar-image')).not.toBeInTheDocument()
  })

  it('logs out and returns to the login page (AC-F5)', async () => {
    mockGetMe.mockResolvedValue(makeUser())
    mockLogout.mockResolvedValue(undefined)
    renderHeader()

    await screen.findByText('Ada Lovelace')
    fireEvent.click(screen.getByRole('button', { name: UI_STRINGS.header.logout }))

    expect(await screen.findByText('Login Page')).toBeInTheDocument()
    expect(mockLogout).toHaveBeenCalled()
  })
})
