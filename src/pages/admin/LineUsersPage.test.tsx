import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { UI_STRINGS } from '@/constants/ui-strings-backend'
import { ID_COUNT, PHONE_COUNT } from '@/components/RegistrationForm'
import { LineUsersPage } from '@/pages/admin/LineUsersPage'
import * as apiClient from '@/lib/api-client'
import type {
  Department,
  LineUser,
  PaginatedLineUsers,
  PersonnelRole,
  SystemUser,
} from '@/lib/api-client'

const LU = UI_STRINGS.lineUsers

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
    // The registration-edit modal reaches for these; stubbed so opening it in the
    // integration tests below does not crash on an undefined import.
    patchLineUserRegistration: vi.fn(),
    listDepartments: vi.fn(),
    listPersonnelRoles: vi.fn(),
  }
})

const mockGetMe = vi.mocked(apiClient.getMe)
const mockList = vi.mocked(apiClient.listLineUsers)
const mockPatch = vi.mocked(apiClient.patchLineUserAccess)
const mockPatchRegistration = vi.mocked(apiClient.patchLineUserRegistration)
const mockListDepartments = vi.mocked(apiClient.listDepartments)
const mockListPersonnelRoles = vi.mocked(apiClient.listPersonnelRoles)

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
  staffId: '6412345678',
  phone: '081-234-5678',
  departmentId: 2,
  department: 'Computer Science',
  personnelRoleId: 1,
  personnelRole: 'Teacher',
  ...overrides,
})

function page(data: LineUser[], meta: Partial<PaginatedLineUsers['meta']> = {}): PaginatedLineUsers {
  return {
    data,
    meta: { page: 1, limit: 20, total: data.length, totalPages: 1, ...meta },
  }
}

/** Admin option-list rows the edit modal's selects are fed from. */
function department(overrides: Partial<Department> = {}): Department {
  return {
    id: 2,
    name: 'Computer Science',
    isSystemReserved: false,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

function personnelRole(overrides: Partial<PersonnelRole> = {}): PersonnelRole {
  return {
    id: 1,
    name: 'Teacher',
    isSystemReserved: false,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

/** A registration whose staffId/phone already satisfy the client validator, so the
 *  edit modal can be submitted unchanged in an integration test. */
const validReg = (overrides: Partial<NonNullable<LineUser['registration']>> = {}) =>
  registration({ staffId: '1'.repeat(ID_COUNT), phone: '0'.repeat(PHONE_COUNT), ...overrides })

/**
 * The signed-in back-office actor `getMe` hydrates. The Actions column is
 * role-gated, so the session's `role` decides which affordances render — ADMIN
 * gets the matrix quick actions, SUPER_ADMIN gets the override picker.
 */
function sessionUser(role: SystemUser['role']): SystemUser {
  return {
    id: 'me',
    email: 'admin@easybook.local',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role,
    personnelRole: { id: 1, name: 'Teacher' },
    department: { id: 2, name: 'CS' },
    mustChangePassword: false,
    phoneNumber: null,
    profilePictureUrl: null,
    isActive: true,
    lineUserId: null,
    lastLoginAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
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
  // Default to an ADMIN session so the quick-action tests below drive the matrix
  // affordances; the SUPER_ADMIN override tests opt in per-case.
  mockGetMe.mockResolvedValue(sessionUser('ADMIN'))
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

    fireEvent.change(screen.getByLabelText(UI_STRINGS.lineUsers.searchLabel), {
      target: { value: 'ali' },
    })

    await waitFor(() =>
      expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'ali' })),
    )
  })

  it('drives the access filter query param (AC-F10)', async () => {
    mockList.mockResolvedValue(page([lineUser()]))
    renderPage()
    await screen.findByText('Alice')

    fireEvent.change(screen.getByLabelText(UI_STRINGS.lineUsers.accessFilterLabel), {
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

    fireEvent.click(screen.getByRole('button', { name: UI_STRINGS.lineUsers.pagination.next }))

    await waitFor(() =>
      expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })),
    )
  })

  it('blocks a row and reflects BLOCKED in place without a reload (AC-F11)', async () => {
    const alice = lineUser({ id: 'a', displayName: 'Alice', access: 'PENDING' })
    mockList.mockResolvedValue(page([alice]))
    mockPatch.mockResolvedValue({ ...alice, access: 'BLOCKED' })
    renderPage()
    // findByRole (not getByRole) so we wait for the ADMIN session to hydrate the
    // Actions cell before clicking — the button is role-gated now.
    const block = await screen.findByRole('button', { name: UI_STRINGS.lineUsers.blockUser('Alice') })

    fireEvent.click(block)

    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('a', 'BLOCKED'))
    // Scope to the row so the "Blocked" access-filter <option> isn't matched too
    // — the filter and the badge now render the SAME `access` constant.
    const row = screen.getByText('Alice').closest('li') as HTMLElement
    expect(await within(row).findByText(UI_STRINGS.access.BLOCKED)).toBeInTheDocument()
    // The Block button is gone once the row is BLOCKED.
    expect(
      within(row).queryByRole('button', { name: UI_STRINGS.lineUsers.blockUser('Alice') }),
    ).not.toBeInTheDocument()
    // The list was not re-fetched: only the initial mount call happened.
    expect(mockList).toHaveBeenCalledTimes(1)
  })

  it('surfaces a 403 as a non-crashing error state (AC-F12)', async () => {
    mockList.mockRejectedValue(new apiClient.ApiError(403, 'Forbidden'))
    renderPage()

    // The FORBIDDEN copy specifically, not the generic failure: a 403 that
    // rendered `loadFailed` would tell the admin to "try again" forever.
    expect(await screen.findByText(UI_STRINGS.lineUsers.loadForbidden)).toBeInTheDocument()
    expect(screen.queryByText(UI_STRINGS.lineUsers.loadFailed)).not.toBeInTheDocument()
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
            staffId: '6412345678',
            phone: '081-234-5678',
            personnelRole: 'Teacher',
            department: 'Computer Science',
          }),
        }),
      ]),
    )
    renderPage()

    const row = (await screen.findByText('Alice')).closest('li') as HTMLElement
    expect(within(row).getByText('Somchai Jaidee')).toBeInTheDocument()
    expect(within(row).getByText('6412345678')).toBeInTheDocument()
    // The applicant's phone is surfaced alongside the rest (PII decision reversed).
    expect(within(row).getByText(UI_STRINGS.lineUsers.registration.phone)).toBeInTheDocument()
    expect(within(row).getByText('081-234-5678')).toBeInTheDocument()
    // The resolved personnel-role + department names render (dynamic options).
    expect(within(row).getByText('Teacher')).toBeInTheDocument()
    expect(within(row).getByText('Computer Science')).toBeInTheDocument()
  })

  it('renders the "Not registered" fallback (no phone shown) for a row without a registration (AC-F7)', async () => {
    mockList.mockResolvedValue(
      page([lineUser({ id: 'a', displayName: 'Bob', access: 'UNREGISTERED', registration: null })]),
    )
    renderPage()

    const row = (await screen.findByText('Bob')).closest('li') as HTMLElement
    expect(within(row).getByText(UI_STRINGS.lineUsers.registration.none)).toBeInTheDocument()
    // No registration → no phone label/value leaks into the row.
    expect(within(row).queryByText(UI_STRINGS.lineUsers.registration.phone)).not.toBeInTheDocument()
    expect(within(row).queryByText('081-234-5678')).not.toBeInTheDocument()
  })

  it('shows an ADMIN the matrix quick actions and NOT the SUPER_ADMIN override (role gate, Item 3/4)', async () => {
    mockGetMe.mockResolvedValue(sessionUser('ADMIN'))
    mockList.mockResolvedValue(page([lineUser({ id: 'a', displayName: 'Alice', access: 'PENDING' })]))
    renderPage()

    const row = within((await screen.findByText('Alice')).closest('li') as HTMLElement)
    // PENDING → both Approve (→ALLOWED) and Block (→BLOCKED) per the matrix.
    expect(await row.findByRole('button', { name: LU.approveUser('Alice') })).toBeInTheDocument()
    expect(row.getByRole('button', { name: LU.blockUser('Alice') })).toBeInTheDocument()
    // The full-state override is SUPER_ADMIN-only — an ADMIN must never see it. This
    // ABSENT assertion is what still proves the two roles differ now that the quick
    // actions are shared: ADMIN = quick actions only, no override.
    expect(row.queryByRole('button', { name: LU.editAccessFor('Alice') })).not.toBeInTheDocument()
  })

  it('shows a SUPER_ADMIN the SAME quick actions PLUS the override picker (role gate, additive)', async () => {
    mockGetMe.mockResolvedValue(sessionUser('SUPER_ADMIN'))
    mockList.mockResolvedValue(page([lineUser({ id: 'a', displayName: 'Alice', access: 'PENDING' })]))
    renderPage()

    const row = within((await screen.findByText('Alice')).closest('li') as HTMLElement)
    // The same PENDING quick actions an ADMIN gets, rendered by the shared control…
    expect(await row.findByRole('button', { name: LU.approveUser('Alice') })).toBeInTheDocument()
    expect(row.getByRole('button', { name: LU.blockUser('Alice') })).toBeInTheDocument()
    // …PLUS the full-state override on top (the additive SUPER_ADMIN affordance).
    expect(row.getByRole('button', { name: LU.editAccessFor('Alice') })).toBeInTheDocument()
  })

  it('offers an ADMIN no action on an UNREGISTERED row (matrix: from ≠ UNREGISTERED)', async () => {
    mockGetMe.mockResolvedValue(sessionUser('ADMIN'))
    mockList.mockResolvedValue(
      page([
        lineUser({ id: 'p', displayName: 'Pat', access: 'PENDING' }),
        lineUser({ id: 'u', displayName: 'Uma', access: 'UNREGISTERED' }),
      ]),
    )
    renderPage()

    // Pat's Approve button proves the ADMIN session has hydrated the Actions cell,
    // so Uma's empty cell is the matrix at work, not an un-loaded role.
    await screen.findByRole('button', { name: LU.approveUser('Pat') })
    const umaRow = within(screen.getByText('Uma').closest('li') as HTMLElement)
    expect(umaRow.queryByRole('button', { name: LU.approveUser('Uma') })).not.toBeInTheDocument()
    expect(umaRow.queryByRole('button', { name: LU.reinstateUser('Uma') })).not.toBeInTheDocument()
    expect(umaRow.queryByRole('button', { name: LU.blockUser('Uma') })).not.toBeInTheDocument()
  })

  it('labels an ADMIN →ALLOWED as Reinstate on a BLOCKED row and hides the idempotent Block (matrix)', async () => {
    mockGetMe.mockResolvedValue(sessionUser('ADMIN'))
    const alice = lineUser({ id: 'a', displayName: 'Alice', access: 'BLOCKED' })
    mockList.mockResolvedValue(page([alice]))
    mockPatch.mockResolvedValue({ ...alice, access: 'ALLOWED' })
    renderPage()

    const row = within((await screen.findByText('Alice')).closest('li') as HTMLElement)
    const reinstate = await row.findByRole('button', { name: LU.reinstateUser('Alice') })
    // The →ALLOWED verb for a blocked user is "Reinstate", never "Approve"…
    expect(row.queryByRole('button', { name: LU.approveUser('Alice') })).not.toBeInTheDocument()
    // …and Block is hidden because its target equals the current state.
    expect(row.queryByRole('button', { name: LU.blockUser('Alice') })).not.toBeInTheDocument()

    fireEvent.click(reinstate)
    // Reinstate is still the ALLOWED PATCH, sent against the row's id.
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('a', 'ALLOWED'))
  })

  it('lets a SUPER_ADMIN force a state an ADMIN cannot, sending the exact PATCH (id, state) (Item 3)', async () => {
    mockGetMe.mockResolvedValue(sessionUser('SUPER_ADMIN'))
    const alice = lineUser({ id: 'a', displayName: 'Alice', access: 'ALLOWED' })
    mockList.mockResolvedValue(page([alice]))
    mockPatch.mockResolvedValue({ ...alice, access: 'UNREGISTERED' })
    renderPage()

    const row = within((await screen.findByText('Alice')).closest('li') as HTMLElement)
    fireEvent.click(await row.findByRole('button', { name: LU.editAccessFor('Alice') }))
    // UNREGISTERED is a state the ADMIN matrix forbids — the override offers it.
    fireEvent.change(row.getByRole('combobox', { name: LU.overridePickerLabel('Alice') }), {
      target: { value: 'UNREGISTERED' },
    })
    fireEvent.click(row.getByRole('button', { name: LU.applyOverrideFor('Alice') }))

    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('a', 'UNREGISTERED'))
    // The row reflects the forced state in place; the list is not re-fetched.
    expect(await row.findByText(UI_STRINGS.access.UNREGISTERED)).toBeInTheDocument()
    expect(mockList).toHaveBeenCalledTimes(1)
  })

  it('surfaces a 403 on an access change as a row notice, without a logout (403 backstop, AC-F12)', async () => {
    mockGetMe.mockResolvedValue(sessionUser('ADMIN'))
    mockList.mockResolvedValue(page([lineUser({ id: 'a', displayName: 'Alice', access: 'PENDING' })]))
    // Server state drifted since load: the transition the client offered now 403s.
    mockPatch.mockRejectedValue(new apiClient.ApiError(403, 'Forbidden'))
    renderPage()

    const block = await screen.findByRole('button', { name: LU.blockUser('Alice') })
    fireEvent.click(block)

    // The row-level forbidden notice appears (a 403 is NOT the 401 logout signal),
    // the row stays put, and nothing was re-fetched.
    expect(await screen.findByText(LU.rowForbidden)).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(mockList).toHaveBeenCalledTimes(1)
  })

  // -------------------------------------------------- Card re-layout (Item 1)

  it('puts the status badge in the header and ALL controls in the footer (AC-F1/F2/F3)', async () => {
    mockGetMe.mockResolvedValue(sessionUser('ADMIN'))
    mockList.mockResolvedValue(
      page([lineUser({ id: 'a', displayName: 'Alice', access: 'PENDING', registration: registration() })]),
    )
    renderPage()

    const row = within((await screen.findByText('Alice')).closest('li') as HTMLElement)
    const statusGroup = row.getByRole('group', { name: LU.statusHeader })
    const footer = row.getByRole('group', { name: LU.actionsHeader })

    // The badge is in the header status group, NOT clustered with the controls.
    expect(within(statusGroup).getByText(UI_STRINGS.access.PENDING)).toBeInTheDocument()
    expect(within(footer).queryByText(UI_STRINGS.access.PENDING)).not.toBeInTheDocument()
    // The status group is read-only: it holds no interactive controls.
    expect(within(statusGroup).queryByRole('button')).not.toBeInTheDocument()

    // Every control — Approve, Block, Edit — lives together in the footer.
    expect(
      await within(footer).findByRole('button', { name: LU.approveUser('Alice') }),
    ).toBeInTheDocument()
    expect(within(footer).getByRole('button', { name: LU.blockUser('Alice') })).toBeInTheDocument()
    expect(within(footer).getByRole('button', { name: LU.edit.actionFor('Alice') })).toBeInTheDocument()
  })

  // --------------------------------------------- Edit gating + modal (Item 2)

  it('hides Edit on a row with no registration and shows it on a registered row (AC-F10)', async () => {
    mockGetMe.mockResolvedValue(sessionUser('ADMIN'))
    mockList.mockResolvedValue(
      page([
        lineUser({ id: 'r', displayName: 'Reg', access: 'PENDING', registration: registration() }),
        lineUser({ id: 'u', displayName: 'Unreg', access: 'UNREGISTERED', registration: null }),
      ]),
    )
    renderPage()

    const regRow = within((await screen.findByText('Reg')).closest('li') as HTMLElement)
    expect(regRow.getByRole('button', { name: LU.edit.actionFor('Reg') })).toBeInTheDocument()

    // registration == null → nothing to edit → no Edit affordance at all.
    const unregRow = within(screen.getByText('Unreg').closest('li') as HTMLElement)
    expect(
      unregRow.queryByRole('button', { name: LU.edit.actionFor('Unreg') }),
    ).not.toBeInTheDocument()
  })

  it('shows Edit to a SUPER_ADMIN on a registered row too, distinct from the access override (AC-F10)', async () => {
    mockGetMe.mockResolvedValue(sessionUser('SUPER_ADMIN'))
    mockList.mockResolvedValue(
      page([lineUser({ id: 'a', displayName: 'Alice', access: 'ALLOWED', registration: registration() })]),
    )
    renderPage()

    const row = within((await screen.findByText('Alice')).closest('li') as HTMLElement)
    // Both roles edit a registration; the SUPER_ADMIN also keeps the access override.
    expect(await row.findByRole('button', { name: LU.edit.actionFor('Alice') })).toBeInTheDocument()
    expect(row.getByRole('button', { name: LU.editAccessFor('Alice') })).toBeInTheDocument()
  })

  it('opens the edit modal, saves a Number-coerced payload, and patches the row in place (AC-F7/F9)', async () => {
    mockGetMe.mockResolvedValue(sessionUser('ADMIN'))
    const alice = lineUser({ id: 'a', displayName: 'Alice', access: 'PENDING', registration: validReg() })
    mockList.mockResolvedValue(page([alice]))
    mockListDepartments.mockResolvedValue([department({ id: 2, name: 'Computer Science' })])
    mockListPersonnelRoles.mockResolvedValue([personnelRole({ id: 1, name: 'Teacher' })])
    // The server echoes the edited row back (new first name) — no list re-fetch.
    mockPatchRegistration.mockResolvedValue({
      ...alice,
      registration: validReg({ firstName: 'Somsak' }),
    })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: LU.edit.actionFor('Alice') }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: UI_STRINGS.common.save }))

    // The PATCH targets the row id with integer (not string) option ids.
    await waitFor(() =>
      expect(mockPatchRegistration).toHaveBeenCalledWith(
        'a',
        expect.objectContaining({ departmentId: 2, personnelRoleId: 1 }),
      ),
    )
    // Row updated in place; the list was never re-fetched.
    const row = within(screen.getByText('Alice').closest('li') as HTMLElement)
    expect(await row.findByText('Somsak Jaidee')).toBeInTheDocument()
    expect(mockList).toHaveBeenCalledTimes(1)
  })
})
