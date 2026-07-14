import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { AdminLoginPage } from '@/pages/admin/AdminLoginPage'
import * as apiClient from '@/lib/api-client'
import type { LoginResponse } from '@/lib/api-client'

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

    fireEvent.change(await screen.findByLabelText('Email'), {
      target: { value: 'admin@easybook.local' },
    })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Dashboard Home')).toBeInTheDocument()
    expect(mockLogin).toHaveBeenCalledWith('admin@easybook.local', 'secret')
  })

  it('shows an inline error and stays on login when credentials are rejected (401)', async () => {
    mockLogin.mockResolvedValue({ ok: false, status: 401, message: 'Invalid' })
    renderLogin()

    fireEvent.change(await screen.findByLabelText('Email'), {
      target: { value: 'admin@easybook.local' },
    })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Incorrect email or password.')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard Home')).not.toBeInTheDocument()
    // Still on the login form.
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('validates the email format before calling the API', async () => {
    renderLogin()

    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'not-an-email' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(mockLogin).not.toHaveBeenCalled()
  })
})
