import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { AdminLoginPage } from '@/pages/admin/AdminLoginPage'
import { ROUTES } from '@/constants/routes'
import { UI_STRINGS } from '@/constants/ui-strings'
import * as apiClient from '@/lib/api-client'
import type { LoginResponse, SystemUser } from '@/lib/api-client'

const UI = UI_STRINGS.auth.login

vi.mock('@/lib/api-client', () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}))

const mockGetMe = vi.mocked(apiClient.getMe)
const mockLogin = vi.mocked(apiClient.login)

function loginResponse(): LoginResponse {
  return {
    id: 'u1',
    email: 'admin@easybook.local',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'ADMIN',
  }
}

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
 * Mounts the login route alongside a REAL `ProtectedRoute`-guarded deep page, so
 * the return-path tests exercise the whole loop (guard stashes `location.state.
 * from` → login page reads it back → navigates there) rather than a stand-in.
 */
function renderLogin(initialPath: string = ROUTES.login) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path={ROUTES.login} element={<AdminLoginPage />} />
          <Route path={ROUTES.dashboard} element={<div>Dashboard Home</div>} />
          <Route
            path={ROUTES.staff}
            element={
              <ProtectedRoute>
                <div>Staff Page</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

async function fillAndSubmit(password = 'secret') {
  fireEvent.change(await screen.findByLabelText(UI.email), {
    target: { value: 'admin@easybook.local' },
  })
  fireEvent.change(screen.getByLabelText(UI.password), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: UI.submit }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetMe.mockResolvedValue(null) // start unauthenticated so the form shows
})

describe('AdminLoginPage', () => {
  it('logs in with valid credentials and navigates to the dashboard (AC-F3/F4)', async () => {
    mockLogin.mockResolvedValue({ ok: true, user: loginResponse() })
    renderLogin()

    fireEvent.change(await screen.findByLabelText(UI.email), {
      target: { value: 'admin@easybook.local' },
    })
    fireEvent.change(screen.getByLabelText(UI.password), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: UI.submit }))

    expect(await screen.findByText('Dashboard Home')).toBeInTheDocument()
    // Behavioural: the exact credentials typed are forwarded, in order, untouched.
    expect(mockLogin).toHaveBeenCalledWith('admin@easybook.local', 'secret')
  })

  it('shows an inline error and stays on login when credentials are rejected (401)', async () => {
    mockLogin.mockResolvedValue({ ok: false, status: 401, message: 'Invalid' })
    renderLogin()

    fireEvent.change(await screen.findByLabelText(UI.email), {
      target: { value: 'admin@easybook.local' },
    })
    fireEvent.change(screen.getByLabelText(UI.password), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: UI.submit }))

    // Behavioural: a 401 maps to the bad-credentials branch (not the generic
    // `failed` one) and does NOT navigate away.
    expect(await screen.findByText(UI.badCredentials)).toBeInTheDocument()
    expect(screen.queryByText('Dashboard Home')).not.toBeInTheDocument()
    // Still on the login form.
    expect(screen.getByLabelText(UI.email)).toBeInTheDocument()
  })

  it('validates the email format before calling the API', async () => {
    renderLogin()

    fireEvent.change(await screen.findByLabelText(UI.email), { target: { value: 'not-an-email' } })
    fireEvent.change(screen.getByLabelText(UI.password), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: UI.submit }))

    expect(await screen.findByText(UI.emailInvalid)).toBeInTheDocument()
    // Behavioural: the client-side guard short-circuits — no request is made.
    expect(mockLogin).not.toHaveBeenCalled()
  })

  // --- Return-path plumbing. This is the piece that fails SILENTLY: lose the
  // `from` state and the user still logs in fine, just lands on the dashboard
  // instead of the page they asked for. Nothing errors, so only a test catches it.
  it('returns the user to the protected page they originally requested (deep-link → login → back)', async () => {
    mockLogin.mockResolvedValue({ ok: true, user: loginResponse() })

    // Deep-link to a guarded page while signed out: the real ProtectedRoute
    // bounces to login and stashes the intended path in router state.
    renderLogin(ROUTES.staff)
    expect(await screen.findByLabelText(UI.email)).toBeInTheDocument()
    expect(screen.queryByText('Staff Page')).not.toBeInTheDocument()

    await fillAndSubmit()

    // Back to the ORIGINAL target, not the dashboard fallback.
    expect(await screen.findByText('Staff Page')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard Home')).not.toBeInTheDocument()
  })

  it('falls back to the dashboard when there is no return path (direct visit to login)', async () => {
    mockLogin.mockResolvedValue({ ok: true, user: loginResponse() })
    renderLogin(ROUTES.login)

    await fillAndSubmit()

    // No `from` state → the DASHBOARD fallback, not a dead end.
    expect(await screen.findByText('Dashboard Home')).toBeInTheDocument()
  })

  it('sends an already-authenticated visitor from the login route to the dashboard', async () => {
    mockGetMe.mockResolvedValue(makeUser()) // session probe resolves signed-in
    renderLogin(ROUTES.login)

    expect(await screen.findByText('Dashboard Home')).toBeInTheDocument()
    // The form is skipped entirely — no credentials are re-submitted.
    expect(mockLogin).not.toHaveBeenCalled()
  })
})
