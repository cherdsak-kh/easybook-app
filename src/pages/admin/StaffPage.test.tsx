import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { StaffPage } from '@/pages/admin/StaffPage'
import * as apiClient from '@/lib/api-client'
import type { PaginatedSystemUsers, SystemUser } from '@/lib/api-client'

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
    getMe: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    listSystemUsers: vi.fn(),
    createSystemUser: vi.fn(),
    patchSystemUser: vi.fn(),
    deleteSystemUser: vi.fn(),
    restoreSystemUser: vi.fn(),
  }
})

const mockGetMe = vi.mocked(apiClient.getMe)
const mockList = vi.mocked(apiClient.listSystemUsers)
const mockDelete = vi.mocked(apiClient.deleteSystemUser)

function systemUser(overrides: Partial<SystemUser> = {}): SystemUser {
  return {
    id: 'u1',
    email: 'user@easybook.local',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'STAFF',
    position: 'Teacher',
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

function page(data: SystemUser[]): PaginatedSystemUsers {
  return { data, meta: { page: 1, limit: 20, total: data.length, totalPages: 1 } }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <StaffPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('StaffPage', () => {
  it('renders the staff list from listSystemUsers (AC-F13)', async () => {
    mockGetMe.mockResolvedValue(systemUser({ id: 'me', role: 'SUPER_ADMIN' }))
    mockList.mockResolvedValue(
      page([systemUser({ id: 'other', firstName: 'Bob', lastName: 'Smith', role: 'STAFF' })]),
    )
    renderPage()

    expect(await screen.findByText('Bob Smith')).toBeInTheDocument()
    expect(screen.getByText(/Teacher, CS/)).toBeInTheDocument()
  })

  it('hides super-admin-only actions from a non-super-admin (AC-F14)', async () => {
    mockGetMe.mockResolvedValue(systemUser({ id: 'me', role: 'ADMIN' }))
    mockList.mockResolvedValue(
      page([systemUser({ id: 'other', firstName: 'Bob', lastName: 'Smith', role: 'STAFF' })]),
    )
    renderPage()

    await screen.findByText('Bob Smith')
    // ADMIN may edit, but not create or deactivate.
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.queryByText('Add staff')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Deactivate/ })).not.toBeInTheDocument()
  })

  it('surfaces a 403 on deactivate as a graceful message (AC-F14)', async () => {
    mockGetMe.mockResolvedValue(systemUser({ id: 'me', role: 'SUPER_ADMIN' }))
    mockList.mockResolvedValue(
      page([systemUser({ id: 'other', firstName: 'Bob', lastName: 'Smith', role: 'STAFF' })]),
    )
    mockDelete.mockRejectedValue(new apiClient.ApiError(403, 'Forbidden'))
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Deactivate Bob Smith' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))

    expect(
      await screen.findByText('You do not have permission to deactivate this account.'),
    ).toBeInTheDocument()
    expect(mockDelete).toHaveBeenCalledWith('other')
  })
})
