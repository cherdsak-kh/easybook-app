import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { ForcePasswordChangePage } from '@/pages/admin/ForcePasswordChangePage'
import { ROUTES } from '@/constants/routes'
import { UI_STRINGS } from '@/constants/ui-strings-backend'
import * as apiClient from '@/lib/api-client'
import type { SystemUser } from '@/lib/api-client'

const UI = UI_STRINGS.auth.forcePasswordChange

vi.mock('@/lib/api-client', () => {
  class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.name = 'ApiError'
      this.status = status
    }
  }
  return {
    ApiError,
    PASSWORD_MIN_LENGTH: 12,
    PASSWORD_MAX_LENGTH: 128,
    getMe: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    changeOwnPassword: vi.fn(),
  }
})

const mockGetMe = vi.mocked(apiClient.getMe)
const mockLogout = vi.mocked(apiClient.logout)
const mockChange = vi.mocked(apiClient.changeOwnPassword)

const VALID_NEW = 'a-brand-new-password'

function makeUser(overrides: Partial<SystemUser> = {}): SystemUser {
  return {
    id: 'u1',
    email: 'ada@easybook.local',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'STAFF',
    personnelRole: { id: 1, name: 'Teacher' },
    department: { id: 2, name: 'CS' },
    mustChangePassword: true,
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
 * Render the real gate around the real screen, so the routing assertions
 * exercise `ProtectedRoute` rather than a stand-in.
 */
function renderScreen() {
  return render(
    <MemoryRouter initialEntries={[ROUTES.forcePasswordChange]}>
      <AuthProvider>
        <Routes>
          <Route path={ROUTES.login} element={<div>Login Page</div>} />
          <Route
            path={ROUTES.forcePasswordChange}
            element={
              <ProtectedRoute>
                <ForcePasswordChangePage />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.dashboard}
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

async function fillForm({
  current = 'TempPass123456',
  next = VALID_NEW,
  confirm = next,
}: { current?: string; next?: string; confirm?: string } = {}) {
  fireEvent.change(await screen.findByLabelText(UI.currentPassword), {
    target: { value: current },
  })
  fireEvent.change(screen.getByLabelText(UI.newPassword), { target: { value: next } })
  fireEvent.change(screen.getByLabelText(UI.confirmPassword), { target: { value: confirm } })
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: UI.submit }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetMe.mockResolvedValue(makeUser())
})

describe('ForcePasswordChangePage', () => {
  it('submits currentPassword plus the new password (AC-F5)', async () => {
    mockChange.mockResolvedValue(undefined)
    renderScreen()

    await fillForm({ current: 'TempPass123456', next: VALID_NEW })
    submit()

    // The backend requires the current password; confirmPassword is client-only
    // and must never be sent (the DTO would 400 on the extra key).
    await waitFor(() => expect(mockChange).toHaveBeenCalledWith('TempPass123456', VALID_NEW))
  })

  it('renders a 400 (wrong current password) INLINE and does NOT log the user out', async () => {
    mockChange.mockRejectedValue(
      new apiClient.ApiError(400, 'The current password is incorrect.'),
    )
    renderScreen()

    await fillForm()
    submit()

    // The message is rendered inline. This literal is deliberately NOT a
    // dictionary constant: it is the SERVER's message, asserted against the
    // fixture above to prove the backend text is surfaced verbatim rather than
    // swallowed and replaced with the canned `UI.invalid` fallback.
    expect(await screen.findByText('The current password is incorrect.')).toBeInTheDocument()
    expect(screen.queryByText(UI.invalid)).not.toBeInTheDocument()
    // ...and the user stays on the screen: no bounce to login, no logout call.
    // A 400 here is a typo, not session death — treating it as a 401 would dump
    // the user at a login screen whose password no longer works.
    expect(screen.getByLabelText(UI.currentPassword)).toBeInTheDocument()
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument()
    expect(mockLogout).not.toHaveBeenCalled()
  })

  it('treats a genuine 401 as session death and bounces to login', async () => {
    mockChange.mockRejectedValue(new apiClient.ApiError(401, 'Unauthorized'))
    renderScreen()

    await fillForm()
    submit()

    expect(await screen.findByText('Login Page')).toBeInTheDocument()
  })

  it('re-probes /me on success and proceeds to the dashboard without re-login (AC-F6)', async () => {
    mockChange.mockResolvedValue(undefined)
    // First probe: gated. After the change: the server clears the flag.
    mockGetMe
      .mockResolvedValueOnce(makeUser({ mustChangePassword: true }))
      .mockResolvedValue(makeUser({ mustChangePassword: false }))
    renderScreen()

    await fillForm()
    submit()

    expect(await screen.findByText('Dashboard Content')).toBeInTheDocument()
    // The flag was re-read from the server rather than assumed locally.
    expect(mockGetMe).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument()
  })

  it('keeps a still-gated user on the screen if the server did not clear the flag', async () => {
    mockChange.mockResolvedValue(undefined)
    mockGetMe.mockResolvedValue(makeUser({ mustChangePassword: true }))
    renderScreen()

    await fillForm()
    submit()

    // ProtectedRoute bounces them straight back — the server's view wins.
    await waitFor(() => expect(mockChange).toHaveBeenCalled())
    expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument()
  })

  it('mirrors the >= 12 char rule client-side without calling the API', async () => {
    renderScreen()

    await fillForm({ next: 'short', confirm: 'short' })
    submit()

    // The bound is read from the api-client constant the component itself uses,
    // so tightening the rule cannot leave this message asserting a stale number.
    expect(
      await screen.findByText(UI.tooShort(apiClient.PASSWORD_MIN_LENGTH)),
    ).toBeInTheDocument()
    expect(mockChange).not.toHaveBeenCalled()
  })

  it('mirrors the must-differ rule client-side without calling the API', async () => {
    renderScreen()

    await fillForm({ current: VALID_NEW, next: VALID_NEW, confirm: VALID_NEW })
    submit()

    expect(await screen.findByText(UI.mustDiffer)).toBeInTheDocument()
    expect(mockChange).not.toHaveBeenCalled()
  })

  it('requires the confirmation to match', async () => {
    renderScreen()

    await fillForm({ next: VALID_NEW, confirm: 'something-else-entirely' })
    submit()

    expect(await screen.findByText(UI.mismatch)).toBeInTheDocument()
    expect(mockChange).not.toHaveBeenCalled()
  })

  it('surfaces an unexpected failure rather than failing silently', async () => {
    mockChange.mockRejectedValue(new apiClient.ApiError(503, 'Service Unavailable'))
    renderScreen()

    await fillForm()
    submit()

    // A 503 is neither 400 nor 401: it must land on the generic failure message
    // rather than being mistaken for a wrong password or a dead session.
    expect(await screen.findByText(UI.failed)).toBeInTheDocument()
    expect(mockLogout).not.toHaveBeenCalled()
  })

  it('always lets the user log out of the gated screen', async () => {
    mockLogout.mockResolvedValue(undefined)
    renderScreen()

    fireEvent.click(await screen.findByRole('button', { name: UI.logout }))

    await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Login Page')).toBeInTheDocument()
  })
})
