import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { AdminLoginPage } from '@/pages/admin/AdminLoginPage'
import { UI_STRINGS } from '@/constants/ui-strings'
import * as apiClient from '@/lib/api-client'
import type { LoginResponse } from '@/lib/api-client'

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

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/admin/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/dashboard" element={<div>Dashboard Home</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
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
})
