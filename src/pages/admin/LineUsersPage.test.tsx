import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { LineUsersPage } from '@/pages/admin/LineUsersPage'
import * as apiClient from '@/lib/api-client'
import type { LineUser, PaginatedLineUsers } from '@/lib/api-client'

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
    listLineUsers: vi.fn(),
    patchLineUserAccess: vi.fn(),
  }
})

const mockGetMe = vi.mocked(apiClient.getMe)
const mockList = vi.mocked(apiClient.listLineUsers)
const mockPatch = vi.mocked(apiClient.patchLineUserAccess)

function lineUser(overrides: Partial<LineUser> = {}): LineUser {
  return {
    id: 'lu1',
    lineUserId: 'U0000000000000000000000000000001',
    displayName: 'Alice',
    pictureUrl: null,
    statusMessage: null,
    richMenuType: 'TYPE_1',
    access: 'PENDING',
    followedAt: '2026-07-01T00:00:00.000Z',
    registration: null,
    ...overrides,
  }
}

const registration = (
  overrides: Partial<NonNullable<LineUser['registration']>> = {},
): NonNullable<LineUser['registration']> => ({
  firstName: 'Somchai',
  lastName: 'Jaidee',
  studentStaffId: '6412345678',
  phone: '081-234-5678',
  department: 'Computer Science',
  role: 'Student',
  ...overrides,
})

function page(data: LineUser[], meta: Partial<PaginatedLineUsers['meta']> = {}): PaginatedLineUsers {
  return {
    data,
    meta: { page: 1, limit: 20, total: data.length, totalPages: 1, ...meta },
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LineUsersPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetMe.mockResolvedValue(null) // AuthProvider is stable; the page doesn't need a user
})

describe('LineUsersPage', () => {
  it('renders the list from listLineUsers (AC-F8)', async () => {
    mockList.mockResolvedValue(page([lineUser({ id: 'a', displayName: 'Alice' }), lineUser({ id: 'b', displayName: 'Bob' })]))
    renderPage()

    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('drives the search query param from the (debounced) search box (AC-F9)', async () => {
    mockList.mockResolvedValue(page([lineUser()]))
    renderPage()
    await screen.findByText('Alice')

    fireEvent.change(screen.getByLabelText('Search by name'), { target: { value: 'ali' } })

    await waitFor(() =>
      expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'ali' })),
    )
  })

  it('drives the access filter query param (AC-F10)', async () => {
    mockList.mockResolvedValue(page([lineUser()]))
    renderPage()
    await screen.findByText('Alice')

    fireEvent.change(screen.getByLabelText('Filter by access status'), {
      target: { value: 'BLOCKED' },
    })

    await waitFor(() =>
      expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ access: 'BLOCKED' })),
    )
  })

  it('fetches the next page when pagination is used (AC-F8)', async () => {
    mockList.mockResolvedValue(page([lineUser()], { total: 25, totalPages: 2 }))
    renderPage()
    await screen.findByText('Alice')

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    await waitFor(() =>
      expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })),
    )
  })

  it('blocks a row and reflects BLOCKED in place without a reload (AC-F11)', async () => {
    const alice = lineUser({ id: 'a', displayName: 'Alice', access: 'PENDING' })
    mockList.mockResolvedValue(page([alice]))
    mockPatch.mockResolvedValue({ ...alice, access: 'BLOCKED' })
    renderPage()
    await screen.findByText('Alice')

    fireEvent.click(screen.getByRole('button', { name: 'Block Alice' }))

    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('a', 'BLOCKED'))
    // Scope to the row so the "Blocked" access-filter <option> isn't matched too.
    const row = screen.getByText('Alice').closest('li') as HTMLElement
    expect(await within(row).findByText('Blocked')).toBeInTheDocument()
    // The Block button is gone once the row is BLOCKED.
    expect(within(row).queryByRole('button', { name: 'Block Alice' })).not.toBeInTheDocument()
    // The list was not re-fetched: only the initial mount call happened.
    expect(mockList).toHaveBeenCalledTimes(1)
  })

  it('surfaces a 403 as a non-crashing error state (AC-F12)', async () => {
    mockList.mockRejectedValue(new apiClient.ApiError(403, 'Forbidden'))
    renderPage()

    expect(
      await screen.findByText('You do not have permission to view LINE users.'),
    ).toBeInTheDocument()
  })

  it("shows a registered row's registration details (AC-F7)", async () => {
    mockList.mockResolvedValue(
      page([
        lineUser({
          id: 'a',
          displayName: 'Alice',
          access: 'PENDING',
          registration: registration({
            firstName: 'Somchai',
            lastName: 'Jaidee',
            studentStaffId: '6412345678',
            phone: '081-234-5678',
            role: 'Student',
            department: 'Computer Science',
          }),
        }),
      ]),
    )
    renderPage()

    const row = (await screen.findByText('Alice')).closest('li') as HTMLElement
    expect(within(row).getByText('Somchai Jaidee')).toBeInTheDocument()
    expect(within(row).getByText('6412345678')).toBeInTheDocument()
    // The applicant's phone is now surfaced alongside the rest (PII decision reversed).
    expect(within(row).getByText('Phone')).toBeInTheDocument()
    expect(within(row).getByText('081-234-5678')).toBeInTheDocument()
    expect(within(row).getByText('Student')).toBeInTheDocument()
    expect(within(row).getByText('Computer Science')).toBeInTheDocument()
  })

  it('renders the "Not registered" fallback (no phone shown) for a row without a registration (AC-F7)', async () => {
    mockList.mockResolvedValue(
      page([lineUser({ id: 'a', displayName: 'Bob', access: 'UNREGISTERED', registration: null })]),
    )
    renderPage()

    const row = (await screen.findByText('Bob')).closest('li') as HTMLElement
    expect(within(row).getByText('Not registered')).toBeInTheDocument()
    // No registration → no phone label/value leaks into the row.
    expect(within(row).queryByText('Phone')).not.toBeInTheDocument()
    expect(within(row).queryByText('081-234-5678')).not.toBeInTheDocument()
  })
})
