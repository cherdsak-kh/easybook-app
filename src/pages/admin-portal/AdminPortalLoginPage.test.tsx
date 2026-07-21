import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { AdminPortalLoginPage } from '@/pages/admin-portal/AdminPortalLoginPage'
import { ADMIN_PORTAL_ROUTES } from '@/components/admin-portal/routes'
import { UI_STRINGS } from '@/constants/ui-strings-backend'
import * as apiClient from '@/lib/api-client'
import type { LoginResponse, LoginResult, SystemUser } from '@/lib/api-client'

const UI = UI_STRINGS.auth.login

// Mock the api-client boundary (never the network) — the same convention the real
// `admin/AdminLoginPage.test.tsx` uses. `AuthProvider` calls `getMe` (mount probe +
// post-login re-probe), `login`, and `logout`.
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
 * Mounts the replica login route alongside a stand-in `/admin-portal/dashboard`, wrapped
 * in the REAL `AuthProvider` so the mount probe + `useAuth().login` path run exactly as
 * in production (only the api-client is mocked).
 */
function renderLogin(initialPath: string = ADMIN_PORTAL_ROUTES.login) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path={ADMIN_PORTAL_ROUTES.login} element={<AdminPortalLoginPage />} />
          <Route path={ADMIN_PORTAL_ROUTES.dashboard} element={<div>DASHBOARD REACHED</div>} />
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
  fireEvent.click(screen.getByRole('button'))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetMe.mockResolvedValue(null) // start unauthenticated so the form shows
})

describe('AdminPortalLoginPage — functional auth', () => {
  it('logs in with valid credentials and redirects to the REPLICA dashboard (AC-1)', async () => {
    mockLogin.mockResolvedValue({ ok: true, user: loginResponse() })
    renderLogin()

    await fillAndSubmit()

    // Lands on the replica dashboard, in-namespace — never `/backend`.
    expect(await screen.findByText('DASHBOARD REACHED')).toBeInTheDocument()
    // The exact credentials typed are forwarded, in order, untouched.
    expect(mockLogin).toHaveBeenCalledWith('admin@easybook.local', 'secret')
  })

  it('maps a 401 to bad-credentials and stays on the form (AC-2)', async () => {
    mockLogin.mockResolvedValue({ ok: false, status: 401, message: 'Invalid' })
    renderLogin()

    await fillAndSubmit('wrong')

    expect(await screen.findByText(UI.badCredentials)).toBeInTheDocument()
    expect(screen.queryByText('DASHBOARD REACHED')).not.toBeInTheDocument()
    expect(screen.getByLabelText(UI.email)).toBeInTheDocument()
  })

  it('maps a 429 with a numeric retryAfter to the countdown message (AC-2)', async () => {
    mockLogin.mockResolvedValue({ ok: false, status: 429, message: 'Slow down', retryAfter: '30' })
    renderLogin()

    await fillAndSubmit()

    expect(await screen.findByText(UI.rateLimitedIn(30))).toBeInTheDocument()
    expect(screen.queryByText('DASHBOARD REACHED')).not.toBeInTheDocument()
  })

  it('maps a 429 without a retryAfter to the generic rate-limit message (AC-2)', async () => {
    mockLogin.mockResolvedValue({ ok: false, status: 429, message: 'Slow down' })
    renderLogin()

    await fillAndSubmit()

    expect(await screen.findByText(UI.rateLimited)).toBeInTheDocument()
  })

  it('maps a 503 to the unavailable message (AC-2)', async () => {
    mockLogin.mockResolvedValue({ ok: false, status: 503, message: 'Down' })
    renderLogin()

    await fillAndSubmit()

    expect(await screen.findByText(UI.unavailable)).toBeInTheDocument()
  })

  it('maps any other non-ok status to the generic failed message (AC-2)', async () => {
    mockLogin.mockResolvedValue({ ok: false, status: 500, message: 'Boom' })
    renderLogin()

    await fillAndSubmit()

    expect(await screen.findByText(UI.failed)).toBeInTheDocument()
  })

  it('maps a thrown/network error to the network-failed message (AC-2)', async () => {
    mockLogin.mockRejectedValue(new Error('offline'))
    renderLogin()

    await fillAndSubmit()

    expect(await screen.findByText(UI.networkFailed)).toBeInTheDocument()
    expect(screen.queryByText('DASHBOARD REACHED')).not.toBeInTheDocument()
  })

  it('rejects an invalid email before any network call (AC-3)', async () => {
    renderLogin()

    fireEvent.change(await screen.findByLabelText(UI.email), { target: { value: 'not-an-email' } })
    fireEvent.change(screen.getByLabelText(UI.password), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button'))

    expect(await screen.findByText(UI.emailInvalid)).toBeInTheDocument()
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('rejects an empty password before any network call (AC-3)', async () => {
    renderLogin()

    fireEvent.change(await screen.findByLabelText(UI.email), {
      target: { value: 'admin@easybook.local' },
    })
    fireEvent.click(screen.getByRole('button'))

    expect(await screen.findByText(UI.passwordRequired)).toBeInTheDocument()
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('disables the submit button and shows the submitting label while in flight (AC-4)', async () => {
    let resolveLogin: (r: LoginResult) => void = () => {}
    mockLogin.mockReturnValue(
      new Promise<LoginResult>((resolve) => {
        resolveLogin = resolve
      }),
    )
    renderLogin()

    await fillAndSubmit()

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(screen.getByText(UI.submitting)).toBeInTheDocument()

    resolveLogin({ ok: true, user: loginResponse() })
    expect(await screen.findByText('DASHBOARD REACHED')).toBeInTheDocument()
  })

  it('redirects an already-authenticated visitor to the replica dashboard (AC-5)', async () => {
    mockGetMe.mockResolvedValue(makeUser()) // session probe resolves signed-in
    renderLogin()

    expect(await screen.findByText('DASHBOARD REACHED')).toBeInTheDocument()
    // The form is skipped — no credentials are submitted.
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('redirects a temp-password (mustChangePassword) user to the replica dashboard, not a reset gate (AC-5/D4)', async () => {
    // Mount probe: unauthenticated → form shows. Post-login re-probe: temp-password user.
    mockGetMe.mockResolvedValueOnce(null).mockResolvedValue(makeUser({ mustChangePassword: true }))
    mockLogin.mockResolvedValue({ ok: true, user: loginResponse() })
    renderLogin()

    await fillAndSubmit()

    // The unprotected replica has no force-reset screen — it lands on its own dashboard.
    expect(await screen.findByText('DASHBOARD REACHED')).toBeInTheDocument()
  })
})
