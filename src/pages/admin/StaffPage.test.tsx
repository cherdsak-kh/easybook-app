import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { StaffPage } from '@/pages/admin/StaffPage'
import { UI_STRINGS } from '@/constants/ui-strings'
import * as apiClient from '@/lib/api-client'
import type { PaginatedSystemUsers, SystemUser } from '@/lib/api-client'

const UI = UI_STRINGS.staff
/** `TempPasswordDialog`'s copy, rendered through `StaffPage`. */
const TEMP = UI_STRINGS.staff.tempPassword

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
    resetSystemUserPassword: vi.fn(),
    listDepartments: vi.fn(),
    listPersonnelRoles: vi.fn(),
  }
})

const mockGetMe = vi.mocked(apiClient.getMe)
const mockList = vi.mocked(apiClient.listSystemUsers)
const mockDelete = vi.mocked(apiClient.deleteSystemUser)
const mockReset = vi.mocked(apiClient.resetSystemUserPassword)

function systemUser(overrides: Partial<SystemUser> = {}): SystemUser {
  return {
    id: 'u1',
    email: 'user@easybook.local',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'STAFF',
    // The resolved `{id,name}` embeds — `position` is gone from the wire.
    personnelRole: { id: 1, name: 'Teacher' },
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
    // Renders the RESOLVED option names, not ids.
    expect(screen.getByText(/Teacher, CS/)).toBeInTheDocument()
    // The list is fetched paginated, from page 1.
    expect(mockList).toHaveBeenCalledWith({ page: 1, limit: 20 })
    // The row's role badge renders the mapped label, never the raw wire enum.
    const row = within(screen.getByText('Bob Smith').closest('li')!)
    expect(row.getByText(UI_STRINGS.roles.STAFF)).toBeInTheDocument()
    expect(row.queryByText('STAFF')).not.toBeInTheDocument()
  })

  it('still displays a soft-deleted option name on a list row (AC-F2)', async () => {
    mockGetMe.mockResolvedValue(systemUser({ id: 'me', role: 'SUPER_ADMIN' }))
    mockList.mockResolvedValue(
      page([
        systemUser({
          id: 'other',
          firstName: 'Bob',
          lastName: 'Smith',
          // The option was soft-deleted; the read embed keeps resolving its name.
          department: { id: 99, name: 'Retired Dept' },
        }),
      ]),
    )
    renderPage()

    await screen.findByText('Bob Smith')
    expect(screen.getByText(/Teacher, Retired Dept/)).toBeInTheDocument()
  })

  it('hides super-admin-only actions from a non-super-admin (AC-F14)', async () => {
    mockGetMe.mockResolvedValue(systemUser({ id: 'me', role: 'ADMIN' }))
    mockList.mockResolvedValue(
      page([systemUser({ id: 'other', firstName: 'Bob', lastName: 'Smith', role: 'STAFF' })]),
    )
    renderPage()

    await screen.findByText('Bob Smith')
    // ADMIN may edit, but not create or deactivate.
    expect(screen.getByRole('button', { name: UI.edit })).toBeInTheDocument()
    expect(screen.queryByText(UI.addStaff)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: UI.deactivateUser('Bob Smith') }),
    ).not.toBeInTheDocument()
  })

  it('surfaces a 403 on deactivate as a graceful message (AC-F14)', async () => {
    mockGetMe.mockResolvedValue(systemUser({ id: 'me', role: 'SUPER_ADMIN' }))
    mockList.mockResolvedValue(
      page([systemUser({ id: 'other', firstName: 'Bob', lastName: 'Smith', role: 'STAFF' })]),
    )
    mockDelete.mockRejectedValue(new apiClient.ApiError(403, 'Forbidden'))
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: UI.deactivateUser('Bob Smith') }))
    // Nothing is sent until the confirm step.
    expect(mockDelete).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: UI_STRINGS.common.confirm }))

    expect(await screen.findByText(UI.deactivateForbidden)).toBeInTheDocument()
    // Deactivates by the row's id, and the row survives the rejection.
    expect(mockDelete).toHaveBeenCalledWith('other')
    expect(screen.getByText('Bob Smith')).toBeInTheDocument()
  })

  // --------------------------------------------------------- Reset password (AC-F4)

  it('shows a Reset Password action to a SUPER_ADMIN but never on their own row (AC-F4)', async () => {
    mockGetMe.mockResolvedValue(systemUser({ id: 'me', role: 'SUPER_ADMIN' }))
    mockList.mockResolvedValue(
      page([
        systemUser({ id: 'me', firstName: 'Ada', lastName: 'Lovelace', role: 'SUPER_ADMIN' }),
        systemUser({ id: 'other', firstName: 'Bob', lastName: 'Smith' }),
      ]),
    )
    renderPage()

    await screen.findByText('Bob Smith')
    expect(
      screen.getByRole('button', { name: UI.resetPasswordFor('Bob Smith') }),
    ).toBeInTheDocument()
    // Self-reset is a 403 server-side, so the action is hidden on your own row.
    expect(
      screen.queryByRole('button', { name: UI.resetPasswordFor('Ada Lovelace') }),
    ).not.toBeInTheDocument()
    // Same for deactivate: a SUPER_ADMIN must not be able to disable themselves.
    expect(
      screen.queryByRole('button', { name: UI.deactivateUser('Ada Lovelace') }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: UI.deactivateUser('Bob Smith') }),
    ).toBeInTheDocument()
  })

  it('hides the Reset Password action from a non-super-admin (AC-F4)', async () => {
    mockGetMe.mockResolvedValue(systemUser({ id: 'me', role: 'ADMIN' }))
    mockList.mockResolvedValue(page([systemUser({ id: 'other', firstName: 'Bob', lastName: 'Smith' })]))
    renderPage()

    await screen.findByText('Bob Smith')
    expect(
      screen.queryByRole('button', { name: UI.resetPasswordFor('Bob Smith') }),
    ).not.toBeInTheDocument()
  })

  it('requires a confirmation step before resetting (AC-F4)', async () => {
    mockGetMe.mockResolvedValue(systemUser({ id: 'me', role: 'SUPER_ADMIN' }))
    mockList.mockResolvedValue(page([systemUser({ id: 'other', firstName: 'Bob', lastName: 'Smith' })]))
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: UI.resetPasswordFor('Bob Smith') }))
    // Nothing is sent until the confirmation is clicked.
    expect(mockReset).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: UI.confirmReset })).toBeInTheDocument()

    // Backing out cancels for good: still no call, and no dialog appears.
    fireEvent.click(screen.getByRole('button', { name: UI_STRINGS.common.cancel }))
    expect(mockReset).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the temporary password once, in a copy-once dialog, after a reset (AC-F3)', async () => {
    mockGetMe.mockResolvedValue(systemUser({ id: 'me', role: 'SUPER_ADMIN' }))
    mockList.mockResolvedValue(page([systemUser({ id: 'other', firstName: 'Bob', lastName: 'Smith' })]))
    mockReset.mockResolvedValue({
      ...systemUser({ id: 'other', firstName: 'Bob', lastName: 'Smith', mustChangePassword: true }),
      temporaryPassword: 'Kp7Rn2Tq9Wx4Yb6C',
    })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: UI.resetPasswordFor('Bob Smith') }))
    fireEvent.click(screen.getByRole('button', { name: UI.confirmReset }))

    const dialog = await screen.findByRole('dialog')
    expect(mockReset).toHaveBeenCalledWith('other')
    expect(within(dialog).getByTestId('temp-password-value')).toHaveTextContent('Kp7Rn2Tq9Wx4Yb6C')
    // States plainly that it is not retrievable, and titles itself by the action
    // that issued the password — a reset, not a create.
    expect(within(dialog).getByText(TEMP.warning)).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: TEMP.resetTitle })).toBeInTheDocument()

    // Closing drops the plaintext for good — it is not re-derivable from state.
    fireEvent.click(within(dialog).getByRole('button', { name: TEMP.acknowledge }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByText('Kp7Rn2Tq9Wx4Yb6C')).not.toBeInTheDocument()
  })

  it('copies the temporary password to the clipboard (AC-F3)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    mockGetMe.mockResolvedValue(systemUser({ id: 'me', role: 'SUPER_ADMIN' }))
    mockList.mockResolvedValue(page([systemUser({ id: 'other', firstName: 'Bob', lastName: 'Smith' })]))
    mockReset.mockResolvedValue({
      ...systemUser({ id: 'other', firstName: 'Bob', lastName: 'Smith' }),
      temporaryPassword: 'Kp7Rn2Tq9Wx4Yb6C',
    })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: UI.resetPasswordFor('Bob Smith') }))
    fireEvent.click(screen.getByRole('button', { name: UI.confirmReset }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: TEMP.copy }))

    // The exact plaintext reaches the clipboard — not a truncated or stale value.
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Kp7Rn2Tq9Wx4Yb6C'))
    expect(await within(dialog).findByRole('button', { name: TEMP.copied })).toBeInTheDocument()
    // The success status is announced, not just the button label flipped.
    expect(await within(dialog).findByText(TEMP.copySuccess)).toBeInTheDocument()
  })

  it('surfaces a failed reset inline and shows no dialog', async () => {
    mockGetMe.mockResolvedValue(systemUser({ id: 'me', role: 'SUPER_ADMIN' }))
    mockList.mockResolvedValue(page([systemUser({ id: 'other', firstName: 'Bob', lastName: 'Smith' })]))
    mockReset.mockRejectedValue(new apiClient.ApiError(403, 'Forbidden'))
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: UI.resetPasswordFor('Bob Smith') }))
    fireEvent.click(screen.getByRole('button', { name: UI.confirmReset }))

    expect(await screen.findByText(UI.resetForbidden)).toBeInTheDocument()
    // A failed reset must never open the dialog: there is no password to show.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mockReset).toHaveBeenCalledWith('other')
  })

  it('surfaces a 403 on the list itself as a graceful message, not a crash', async () => {
    mockGetMe.mockResolvedValue(systemUser({ id: 'me', role: 'STAFF' }))
    mockList.mockRejectedValue(new apiClient.ApiError(403, 'Forbidden'))
    renderPage()

    expect(await screen.findByText(UI.listForbidden)).toBeInTheDocument()
    // The skeleton is torn down rather than spinning forever.
    expect(screen.queryByTestId('staff-skeleton')).not.toBeInTheDocument()
  })
})
