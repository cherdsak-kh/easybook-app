import { fireEvent, render, screen, within } from '@testing-library/react'
import { AdminPortalLeadsPage } from '@/pages/admin-portal/AdminPortalLeadsPage'
import * as useLineUsersModule from '@/hooks/useLineUsers'
import type { UseLineUsers } from '@/hooks/useLineUsers'
import type { LineUser } from '@/lib/api-client'

// View test: mock the orchestration hook so we drive the page purely by its state
// (loading / empty / error / rows / actions). The hook itself is covered separately in
// `useLineUsers.test.ts`.
vi.mock('@/hooks/useLineUsers', () => ({ useLineUsers: vi.fn() }))

const mockUseLineUsers = vi.mocked(useLineUsersModule.useLineUsers)

function makeUser(o: Partial<LineUser> = {}): LineUser {
  return {
    id: 'lu1',
    lineUserId: 'U0123456789abcdef0123456789abcdef',
    displayName: 'Alice',
    pictureUrl: null,
    statusMessage: null,
    richMenuType: 'TYPE_1',
    access: 'PENDING',
    followedAt: '2026-07-07T10:00:00.000Z',
    registration: null,
    ...o,
  }
}

function registered(o: Partial<LineUser> = {}): LineUser {
  return makeUser({
    registration: {
      firstName: 'Alice',
      lastName: 'Wong',
      staffId: 'STAFF-123',
      phone: '0812345678',
      departmentId: 1,
      department: 'Computer Science',
      personnelRoleId: 1,
      personnelRole: 'Teacher',
    },
    ...o,
  })
}

function hookState(o: Partial<UseLineUsers> = {}): UseLineUsers {
  return {
    users: [],
    meta: undefined,
    totalPages: 0,
    loading: false,
    error: null,
    rowError: null,
    pendingId: null,
    page: 1,
    setPage: vi.fn(),
    search: '',
    setSearch: vi.fn(),
    accessFilter: '',
    setAccessFilter: vi.fn(),
    changeAccess: vi.fn(),
    clearRowError: vi.fn(),
    refetch: vi.fn(),
    ...o,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AdminPortalLeadsPage — states', () => {
  it('renders a loading skeleton while fetching', () => {
    mockUseLineUsers.mockReturnValue(hookState({ loading: true }))
    render(<AdminPortalLeadsPage />)

    expect(screen.getByTestId('leads-skeleton')).toBeInTheDocument()
  })

  it('renders an empty state (no crash) when there are no users', () => {
    mockUseLineUsers.mockReturnValue(hookState({ users: [] }))
    render(<AdminPortalLeadsPage />)

    expect(screen.getByText('No LINE users match the current filters.')).toBeInTheDocument()
  })

  it('renders the page-level load error', () => {
    mockUseLineUsers.mockReturnValue(hookState({ error: 'Could not load LINE users. Please try again.' }))
    render(<AdminPortalLeadsPage />)

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load LINE users. Please try again.')
  })

  it('surfaces a dismissible row error and dismisses it via the hook', () => {
    const clearRowError = vi.fn()
    mockUseLineUsers.mockReturnValue(
      hookState({ users: [registered()], rowError: 'That user no longer exists. Refresh the list.', clearRowError }),
    )
    render(<AdminPortalLeadsPage />)

    expect(screen.getByRole('alert')).toHaveTextContent('That user no longer exists. Refresh the list.')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(clearRowError).toHaveBeenCalledTimes(1)
  })
})

describe('AdminPortalLeadsPage — row mapping', () => {
  it('maps a registered LINE user across the columns (name, staffId, department, status, followedAt)', () => {
    mockUseLineUsers.mockReturnValue(
      hookState({ users: [registered({ displayName: 'Alice Wonderland', access: 'PENDING' })] }),
    )
    render(<AdminPortalLeadsPage />)
    const table = screen.getByRole('table')

    expect(within(table).getByText('Alice Wonderland')).toBeInTheDocument() // displayName
    expect(within(table).getByText('Alice Wong')).toBeInTheDocument() // registration real name
    expect(within(table).getByText('STAFF-123')).toBeInTheDocument()
    expect(within(table).getByText('Computer Science')).toBeInTheDocument()
    expect(within(table).getByText('Pending')).toBeInTheDocument() // AccessBadge
    // followedAt is rendered via toLocaleDateString — compute the expected string with the
    // same formatter so the assertion holds regardless of the runner's locale/calendar.
    const expectedDate = new Date('2026-07-07T10:00:00.000Z').toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
    expect(within(table).getByText(expectedDate)).toBeInTheDocument()
  })

  it('shows "Not registered" and em-dashes for a follower with no registration', () => {
    mockUseLineUsers.mockReturnValue(
      hookState({ users: [makeUser({ displayName: 'Bob', registration: null })] }),
    )
    render(<AdminPortalLeadsPage />)
    const table = screen.getByRole('table')

    expect(within(table).getByText('Not registered')).toBeInTheDocument()
    expect(within(table).getAllByText('—').length).toBeGreaterThanOrEqual(2) // staffId + department
  })
})

describe('AdminPortalLeadsPage — row actions gated by canAdminSetAccess', () => {
  it('shows Approve + Block for a PENDING user and calls changeAccess with ALLOWED on Approve', () => {
    const changeAccess = vi.fn()
    const user = registered({ displayName: 'Alice', access: 'PENDING' })
    mockUseLineUsers.mockReturnValue(hookState({ users: [user], changeAccess }))
    render(<AdminPortalLeadsPage />)

    expect(screen.getByRole('button', { name: 'Approve Alice' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Block Alice' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Approve Alice' }))
    expect(changeAccess).toHaveBeenCalledWith(user, 'ALLOWED')
  })

  it('labels the →ALLOWED action "Reinstate" for a BLOCKED user and hides Block', () => {
    mockUseLineUsers.mockReturnValue(
      hookState({ users: [registered({ displayName: 'Carol', access: 'BLOCKED' })] }),
    )
    render(<AdminPortalLeadsPage />)

    expect(screen.getByRole('button', { name: 'Reinstate Carol' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Block Carol' })).not.toBeInTheDocument()
  })

  it('shows no access actions for an UNREGISTERED row (matrix forbids it)', () => {
    mockUseLineUsers.mockReturnValue(
      hookState({ users: [makeUser({ displayName: 'Dave', access: 'UNREGISTERED' })] }),
    )
    render(<AdminPortalLeadsPage />)

    expect(screen.queryByRole('button', { name: /Approve|Block|Reinstate/ })).not.toBeInTheDocument()
  })
})

describe('AdminPortalLeadsPage — pagination', () => {
  it('renders a page summary and advances the page via setPage', () => {
    const setPage = vi.fn()
    mockUseLineUsers.mockReturnValue(
      hookState({
        users: [registered()],
        meta: { page: 1, limit: 20, total: 45, totalPages: 3 },
        totalPages: 3,
        page: 1,
        setPage,
      }),
    )
    render(<AdminPortalLeadsPage />)

    expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument()
    const prev = screen.getByRole('button', { name: 'Previous' })
    expect(prev).toBeDisabled() // on page 1

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(setPage).toHaveBeenCalledWith(2)
  })
})
