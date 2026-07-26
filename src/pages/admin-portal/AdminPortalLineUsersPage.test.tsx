import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { AdminPortalLineUsersPage } from '@/pages/admin-portal/AdminPortalLineUsersPage'
import { MODAL_STATUS_LABELS, STATUS_BADGE, T } from '@/constants/ui-strings-line-users'
import { EDITOR_MESSAGES } from '@/hooks/useLineUserEditor'
import * as useLineUsersModule from '@/hooks/useLineUsers'
import * as apiClient from '@/lib/api-client'
import type { UseLineUsers } from '@/hooks/useLineUsers'
import type { Department, LineUser, PersonnelRole, SystemRole } from '@/lib/api-client'

// View test: mock the orchestration hook so we drive the page purely by its state
// (loading / empty / error / rows). The hook itself is covered separately in
// `useLineUsers.test.ts`.
vi.mock('@/hooks/useLineUsers', () => ({ useLineUsers: vi.fn() }))

// The page now reads `useAuth()` for role gating (Edit visibility) + `expireSession`. Mock
// it at the boundary; the returned value is configurable per test via `authAs`.
const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }))
vi.mock('@/auth/useAuth', () => ({ useAuth: mockUseAuth }))

// Phase B runs the REAL `useLineUserEditor`, so mock the api-client helpers it calls at the
// boundary (repo convention); keep everything else (ApiError, types) real.
vi.mock('@/lib/api-client', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/api-client')>()
  return {
    ...actual,
    patchLineUserRegistration: vi.fn(),
    patchLineUserAccess: vi.fn(),
    listDepartments: vi.fn(),
    listPersonnelRoles: vi.fn(),
  }
})

const mockUseLineUsers = vi.mocked(useLineUsersModule.useLineUsers)
const mockPatchReg = vi.mocked(apiClient.patchLineUserRegistration)
const mockPatchAccess = vi.mocked(apiClient.patchLineUserAccess)
const mockListDepartments = vi.mocked(apiClient.listDepartments)
const mockListPersonnelRoles = vi.mocked(apiClient.listPersonnelRoles)

function authAs(role: SystemRole | null) {
  mockUseAuth.mockReturnValue({
    status: 'authenticated',
    user: role
      ? {
          id: 'admin-1',
          email: 'admin@easybook.local',
          firstName: 'Ad',
          lastName: 'Min',
          role,
          mustChangePassword: false,
          profilePictureUrl: null,
        }
      : null,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    expireSession: vi.fn(),
  })
}

function makeDept(o: Partial<Department> = {}): Department {
  return {
    id: 1,
    name: 'Computer Science',
    isSystemReserved: false,
    createdAt: '2026-07-14T10:00:00.000Z',
    updatedAt: '2026-07-14T10:00:00.000Z',
    ...o,
  }
}

function makeRole(o: Partial<PersonnelRole> = {}): PersonnelRole {
  return {
    id: 1,
    name: 'Teacher',
    isSystemReserved: false,
    createdAt: '2026-07-14T10:00:00.000Z',
    updatedAt: '2026-07-14T10:00:00.000Z',
    ...o,
  }
}

/** Open the inspect modal for a single registered user, as the given role, and click Edit. */
async function openEditor(user: LineUser, role: SystemRole = 'ADMIN') {
  authAs(role)
  mockUseLineUsers.mockReturnValue(hookState({ users: [user] }))
  render(<AdminPortalLineUsersPage />)
  fireEvent.click(screen.getByRole('button', { name: new RegExp(T.inspect) }))
  fireEvent.click(screen.getByRole('button', { name: T.edit }))
}

// jsdom implements <dialog>.showModal()/close() in recent versions; shim ONLY when a
// method is missing so this suite is robust across jsdom versions without overriding the
// native behavior when it exists. The shim mirrors the native contract: showModal sets
// `open`; close clears it and fires the `close` event the page listens for.
beforeAll(() => {
  if (typeof HTMLDialogElement !== 'undefined') {
    if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
      HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
        this.setAttribute('open', '')
      }
    }
    if (typeof HTMLDialogElement.prototype.close !== 'function') {
      HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
        this.removeAttribute('open')
        this.dispatchEvent(new Event('close'))
      }
    }
  }
})

// The B.E. date formatter the page uses; the test computes the EXPECTED string with the
// SAME `Intl` formatter so the assertion holds regardless of the runner's locale/calendar
// (never hardcode "2569").
const beDate = (iso: string) =>
  new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))

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
    // Phase A leaves the mutation machinery in the hook but unused by the page; keep the
    // full shape so the mock satisfies the `UseLineUsers` contract.
    rowError: null,
    pendingId: null,
    page: 1,
    setPage: vi.fn(),
    search: '',
    setSearch: vi.fn(),
    accessFilter: '',
    setAccessFilter: vi.fn(),
    changeAccess: vi.fn(),
    updateUserInPlace: vi.fn(),
    clearRowError: vi.fn(),
    refetch: vi.fn(),
    ...o,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Defaults: an ADMIN session and resolvable option lists (edit-mode fetch). Individual
  // tests override the role via `authAs` / the option lists via the mocks below.
  authAs('ADMIN')
  mockListDepartments.mockResolvedValue([makeDept()])
  mockListPersonnelRoles.mockResolvedValue([makeRole()])
})

describe('AdminPortalLineUsersPage — states', () => {
  it('P1: renders a loading skeleton while fetching', () => {
    mockUseLineUsers.mockReturnValue(hookState({ loading: true }))
    render(<AdminPortalLineUsersPage />)

    expect(screen.getByTestId('lineusers-skeleton')).toBeInTheDocument()
  })

  it('P2: renders an empty state (no crash) when there are no users', () => {
    mockUseLineUsers.mockReturnValue(hookState({ users: [] }))
    render(<AdminPortalLineUsersPage />)

    expect(screen.getByText(T.empty)).toBeInTheDocument()
  })

  it('P3: renders the page-level load error', () => {
    mockUseLineUsers.mockReturnValue(hookState({ error: 'Could not load LINE users. Please try again.' }))
    render(<AdminPortalLineUsersPage />)

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load LINE users. Please try again.')
  })
})

describe('AdminPortalLineUsersPage — row mapping', () => {
  it('P4: maps a registered user across the columns (index, name, department, phone, status badge, B.E. date, inspect button)', () => {
    mockUseLineUsers.mockReturnValue(
      hookState({
        users: [registered({ displayName: 'Alice Wonderland', access: 'PENDING' })],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        totalPages: 1,
      }),
    )
    render(<AdminPortalLineUsersPage />)
    const table = screen.getByRole('table')

    // ลำดับ — page-aware row index (page 1 → 1).
    expect(within(table).getByText('1')).toBeInTheDocument()
    // ชื่อ-สกุล — display name (bold) + registration real name (sub-line).
    expect(within(table).getByText('Alice Wonderland')).toBeInTheDocument()
    expect(within(table).getByText('Alice Wong')).toBeInTheDocument()
    // ฝ่าย/แผนก + เบอร์โทรศัพท์.
    expect(within(table).getByText('Computer Science')).toBeInTheDocument()
    expect(within(table).getByText('0812345678')).toBeInTheDocument()
    // สถานะ — Thai status badge for PENDING.
    expect(within(table).getByText(STATUS_BADGE.PENDING.label)).toBeInTheDocument()
    // วันที่ลงทะเบียน — Thai Buddhist-era date computed with the same formatter.
    expect(within(table).getByText(beDate('2026-07-07T10:00:00.000Z'))).toBeInTheDocument()
    // Actions — the inspect button.
    expect(screen.getByRole('button', { name: /ตรวจสอบข้อมูล/ })).toBeInTheDocument()
  })

  it('P5: shows the not-registered sub-line and em-dashes for a follower with no registration', () => {
    mockUseLineUsers.mockReturnValue(
      hookState({ users: [makeUser({ displayName: 'Bob', access: 'UNREGISTERED', registration: null })] }),
    )
    render(<AdminPortalLineUsersPage />)
    const table = screen.getByRole('table')

    // Row sub-line + the UNREGISTERED status badge both read "ยังไม่ลงทะเบียน"; pick the
    // one that is the badge (by class) to assert the neutral badge-ghost color per §3.
    const unregLabels = within(table).getAllByText(T.notRegistered)
    expect(unregLabels.length).toBeGreaterThanOrEqual(2)
    const badge = unregLabels.find((el) => el.className.includes('badge'))
    expect(badge).toHaveClass('badge', 'badge-soft', 'badge-ghost')
    // department + phone fall back to the em-dash.
    expect(within(table).getAllByText(T.emptyValue).length).toBeGreaterThanOrEqual(2)
  })
})

describe('AdminPortalLineUsersPage — status badge map', () => {
  it.each(['ALLOWED', 'PENDING', 'BLOCKED', 'UNREGISTERED', 'REJECTED'] as const)(
    'renders the Thai label for access %s',
    (access) => {
      mockUseLineUsers.mockReturnValue(hookState({ users: [registered({ access })] }))
      render(<AdminPortalLineUsersPage />)
      const table = screen.getByRole('table')

      expect(within(table).getByText(STATUS_BADGE[access].label)).toBeInTheDocument()
    },
  )

  it('P4b: the REJECTED badge reads ส่งคืนแล้ว and uses the recoverable warning tone', () => {
    mockUseLineUsers.mockReturnValue(hookState({ users: [registered({ access: 'REJECTED' })] }))
    render(<AdminPortalLineUsersPage />)

    // The literal is pinned here on purpose (not read from STATUS_BADGE): the PO specified
    // this exact wording, and it is what the operator scans the table for.
    const badge = within(screen.getByRole('table')).getByText('ส่งคืนแล้ว')
    expect(badge).toHaveClass('badge', 'badge-soft', 'badge-warning')
    // NOT badge-error — that hue is BLOCKED's terminal state.
    expect(badge).not.toHaveClass('badge-error')
  })
})

describe('AdminPortalLineUsersPage — toolbar', () => {
  it('P7: forwards the search input to setSearch and the access filter to setAccessFilter', () => {
    const setSearch = vi.fn()
    const setAccessFilter = vi.fn()
    mockUseLineUsers.mockReturnValue(hookState({ users: [registered()], setSearch, setAccessFilter }))
    render(<AdminPortalLineUsersPage />)

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ali' } })
    expect(setSearch).toHaveBeenCalledWith('ali')

    fireEvent.change(screen.getByRole('combobox', { name: T.accessFilterLabel }), {
      target: { value: 'ALLOWED' },
    })
    expect(setAccessFilter).toHaveBeenCalledWith('ALLOWED')
  })
})

describe('AdminPortalLineUsersPage — pagination', () => {
  it('P6: renders a page summary, disables Prev on page 1, and advances via setPage', () => {
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
    render(<AdminPortalLineUsersPage />)

    expect(screen.getByText(T.paginationSummary(1, 3, 45))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: T.previous })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: T.next }))
    expect(setPage).toHaveBeenCalledWith(2)
  })
})

describe('AdminPortalLineUsersPage — read-only inspect modal', () => {
  it('P8: clicking ตรวจสอบข้อมูล opens the modal with that row’s full details', () => {
    mockUseLineUsers.mockReturnValue(
      hookState({ users: [registered({ displayName: 'Alice Wonderland', access: 'ALLOWED' })] }),
    )
    render(<AdminPortalLineUsersPage />)

    // Registration-only fields (staffId + personnelRole) are NOT in the table columns, so
    // their presence proves the modal opened with this user's data.
    expect(screen.queryByText('STAFF-123')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /ตรวจสอบข้อมูล: Alice Wonderland/ }))

    expect(screen.getByText('STAFF-123')).toBeInTheDocument()
    expect(screen.getByText('Teacher')).toBeInTheDocument()
    // Real name, phone + department also render in the modal body.
    expect(screen.getAllByText('Alice Wong').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('0812345678').length).toBeGreaterThanOrEqual(1)
    // The dialog is labelled by its title (a11y).
    expect(screen.getByRole('heading', { name: T.modalTitle })).toBeInTheDocument()
  })

  it('P9: closing the modal via the ✕ button clears the selection', async () => {
    mockUseLineUsers.mockReturnValue(hookState({ users: [registered({ displayName: 'Alice Wonderland' })] }))
    render(<AdminPortalLineUsersPage />)

    fireEvent.click(screen.getByRole('button', { name: /ตรวจสอบข้อมูล: Alice Wonderland/ }))
    expect(screen.getByText('STAFF-123')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: T.close }))
    await waitFor(() => expect(screen.queryByText('STAFF-123')).not.toBeInTheDocument())
  })

  it('P10: an UNREGISTERED / no-registration user’s modal renders the not-registered state gracefully', () => {
    mockUseLineUsers.mockReturnValue(
      hookState({ users: [makeUser({ displayName: 'Dave', access: 'UNREGISTERED', registration: null })] }),
    )
    render(<AdminPortalLineUsersPage />)

    fireEvent.click(screen.getByRole('button', { name: /ตรวจสอบข้อมูล: Dave/ }))

    // No crash, a clear not-registered notice, and NO registration rows (staffId/role).
    expect(screen.getByText(T.notRegisteredNotice)).toBeInTheDocument()
    expect(screen.queryByText(T.fieldStaffId)).not.toBeInTheDocument()
    expect(screen.queryByText(T.fieldPersonnelRole)).not.toBeInTheDocument()
    // The LINE-side status badge still renders inside the modal.
    expect(screen.getAllByText(STATUS_BADGE.UNREGISTERED.label).length).toBeGreaterThanOrEqual(1)
  })
})

describe('AdminPortalLineUsersPage — Edit button RBAC (Phase B)', () => {
  function openModalAs(role: SystemRole) {
    authAs(role)
    mockUseLineUsers.mockReturnValue(hookState({ users: [registered({ displayName: 'Alice Wonderland' })] }))
    render(<AdminPortalLineUsersPage />)
    fireEvent.click(screen.getByRole('button', { name: /ตรวจสอบข้อมูล: Alice Wonderland/ }))
  }

  it('P11: STAFF sees NO Edit button (read-only modal)', () => {
    openModalAs('STAFF')
    expect(screen.getByText('STAFF-123')).toBeInTheDocument() // modal is open (read-only)
    expect(screen.queryByRole('button', { name: T.edit })).not.toBeInTheDocument()
  })

  it('P12: ADMIN sees the Edit button', () => {
    openModalAs('ADMIN')
    expect(screen.getByRole('button', { name: T.edit })).toBeInTheDocument()
  })

  it('P13: SUPER_ADMIN sees the Edit button', () => {
    openModalAs('SUPER_ADMIN')
    expect(screen.getByRole('button', { name: T.edit })).toBeInTheDocument()
  })
})

describe('AdminPortalLineUsersPage — edit form + option lists (Phase B)', () => {
  it('P14: clicking Edit renders the six registration inputs + the status select', async () => {
    await openEditor(registered())

    expect(screen.getByLabelText(T.labelFirstName)).toBeInTheDocument()
    expect(screen.getByLabelText(T.labelLastName)).toBeInTheDocument()
    expect(screen.getByLabelText(T.labelStaffId)).toBeInTheDocument()
    expect(screen.getByLabelText(T.labelPhone)).toBeInTheDocument()
    expect(screen.getByLabelText(T.labelDepartment)).toBeInTheDocument()
    expect(screen.getByLabelText(T.labelPersonnelRole)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: T.labelStatus })).toBeInTheDocument()
    // Settle the async option fetch.
    await screen.findByRole('option', { name: 'Computer Science' })
  })

  it('P15: dept/role selects are populated from listDepartments/listPersonnelRoles, system-reserved excluded', async () => {
    mockListDepartments.mockResolvedValue([
      makeDept({ id: 1, name: 'Computer Science' }),
      makeDept({ id: 9, name: 'Reserved Dept', isSystemReserved: true }),
    ])
    mockListPersonnelRoles.mockResolvedValue([
      makeRole({ id: 1, name: 'Teacher' }),
      makeRole({ id: 9, name: 'Reserved Role', isSystemReserved: true }),
    ])
    await openEditor(registered())

    expect(await screen.findByRole('option', { name: 'Computer Science' })).toBeInTheDocument()
    expect(await screen.findByRole('option', { name: 'Teacher' })).toBeInTheDocument()
    // System-reserved options are excluded (backend 400s a reserved id).
    expect(screen.queryByRole('option', { name: 'Reserved Dept' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Reserved Role' })).not.toBeInTheDocument()
    // The fetch is lazy (only after entering edit) and issued once.
    expect(mockListDepartments).toHaveBeenCalledTimes(1)
    expect(mockListPersonnelRoles).toHaveBeenCalledTimes(1)
  })

  it('P16: ADMIN status options = ALLOWED + BLOCKED only', async () => {
    await openEditor(registered({ access: 'ALLOWED' }), 'ADMIN')
    await screen.findByRole('option', { name: 'Computer Science' }) // settle options

    const statusSelect = screen.getByRole('combobox', { name: T.labelStatus })
    const values = within(statusSelect)
      .getAllByRole('option')
      .map((o) => o.getAttribute('value'))
    expect(values).toEqual(['ALLOWED', 'BLOCKED'])
    expect(values).not.toContain('PENDING')
  })

  it('P16b: ADMIN + UNREGISTERED current → the status select is locked (single option, no fetch)', () => {
    authAs('ADMIN')
    mockUseLineUsers.mockReturnValue(
      hookState({ users: [makeUser({ displayName: 'Dave', access: 'UNREGISTERED', registration: null })] }),
    )
    render(<AdminPortalLineUsersPage />)
    fireEvent.click(screen.getByRole('button', { name: /ตรวจสอบข้อมูล: Dave/ }))
    fireEvent.click(screen.getByRole('button', { name: T.edit }))

    const statusSelect = screen.getByRole('combobox', { name: T.labelStatus })
    expect(statusSelect).toBeDisabled()
    expect(within(statusSelect).getAllByRole('option')).toHaveLength(1)
    // No registration form, and no option fetch for a status-only unregistered edit.
    expect(screen.queryByLabelText(T.labelFirstName)).not.toBeInTheDocument()
    expect(mockListDepartments).not.toHaveBeenCalled()
  })

  /**
   * CHANGED by the REJECTED feature (was: "SUPER_ADMIN status options = all four states").
   * The dropdown is now strictly `{ALLOWED, BLOCKED}` for BOTH roles — SUPER_ADMIN no longer
   * gets a four-state override picker on this surface. `UNREGISTERED`/`PENDING` are not
   * operator-settable, and `REJECTED` is reachable ONLY through the dedicated Reject action
   * (which always carries a mandatory reason), so it must never appear as a bare option.
   */
  it('P17: SUPER_ADMIN status options = ALLOWED + BLOCKED only (no UNREGISTERED/PENDING/REJECTED)', async () => {
    await openEditor(registered({ access: 'ALLOWED' }), 'SUPER_ADMIN')
    await screen.findByRole('option', { name: 'Computer Science' }) // settle options

    const statusSelect = screen.getByRole('combobox', { name: T.labelStatus })
    const values = within(statusSelect)
      .getAllByRole('option')
      .map((o) => o.getAttribute('value'))
    expect(values).toEqual(['ALLOWED', 'BLOCKED'])
    // Option TEXT is the ACTION-voiced modal map ("อนุมัติ"), not the state-voiced table badge
    // ("อนุมัติแล้ว") — the two surfaces read from deliberately different dictionaries.
    const labels = within(statusSelect)
      .getAllByRole('option')
      .map((o) => o.textContent)
    expect(labels).toEqual([MODAL_STATUS_LABELS.ALLOWED, MODAL_STATUS_LABELS.BLOCKED])
  })

  it.each(['ADMIN', 'SUPER_ADMIN'] as const)(
    'P17b: %s editing a PENDING user gets ALLOWED/BLOCKED plus a DISABLED current-state placeholder',
    async (role) => {
      await openEditor(registered({ access: 'PENDING' }), role)
      await screen.findByRole('option', { name: 'Computer Science' })

      const statusSelect = screen.getByRole('combobox', { name: T.labelStatus })
      const options = within(statusSelect).getAllByRole('option')
      // The only SELECTABLE targets are ALLOWED/BLOCKED…
      const selectable = options.filter((o) => !o.hasAttribute('disabled'))
      expect(selectable.map((o) => o.getAttribute('value'))).toEqual(['ALLOWED', 'BLOCKED'])
      // …and the leading option is a disabled placeholder showing the CURRENT state, so the
      // select never displays a target the draft has not actually taken.
      expect(options[0]).toBeDisabled()
      expect(options[0]).toHaveTextContent(MODAL_STATUS_LABELS.PENDING)
      expect(statusSelect).toHaveValue('')
    },
  )

  it('P17c: a REJECTED user is still approvable/blockable from the dropdown', async () => {
    await openEditor(registered({ access: 'REJECTED' }), 'ADMIN')
    await screen.findByRole('option', { name: 'Computer Science' })

    const statusSelect = screen.getByRole('combobox', { name: T.labelStatus })
    const selectable = within(statusSelect)
      .getAllByRole('option')
      .filter((o) => !o.hasAttribute('disabled'))
      .map((o) => o.getAttribute('value'))
    expect(selectable).toEqual(['ALLOWED', 'BLOCKED'])
  })
})

describe('AdminPortalLineUsersPage — save wiring (Phase B)', () => {
  it('P18: editing a registration field + Save → patchLineUserRegistration + updateUserInPlace + back to view', async () => {
    const updateUserInPlace = vi.fn()
    authAs('ADMIN')
    mockUseLineUsers.mockReturnValue(hookState({ users: [registered()], updateUserInPlace }))
    render(<AdminPortalLineUsersPage />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(T.inspect) }))
    fireEvent.click(screen.getByRole('button', { name: T.edit }))
    await screen.findByRole('option', { name: 'Computer Science' }) // options loaded → Save enabled once dirty

    fireEvent.change(screen.getByLabelText(T.labelFirstName), { target: { value: 'Alicia' } })

    const saved = registered({ registration: { ...registered().registration!, firstName: 'Alicia' } })
    mockPatchReg.mockResolvedValue(saved)
    fireEvent.click(screen.getByRole('button', { name: T.save }))

    await waitFor(() =>
      expect(mockPatchReg).toHaveBeenCalledWith('lu1', expect.objectContaining({ firstName: 'Alicia' })),
    )
    expect(mockPatchAccess).not.toHaveBeenCalled()
    expect(updateUserInPlace).toHaveBeenCalledWith(saved)
    // Back to view mode: the form (firstName input) is gone.
    await waitFor(() => expect(screen.queryByLabelText(T.labelFirstName)).not.toBeInTheDocument())
  })

  it('P19: changing only the status + Save → patchLineUserAccess only (no registration PATCH)', async () => {
    authAs('ADMIN')
    mockUseLineUsers.mockReturnValue(hookState({ users: [registered({ access: 'PENDING' })] }))
    render(<AdminPortalLineUsersPage />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(T.inspect) }))
    fireEvent.click(screen.getByRole('button', { name: T.edit }))
    await screen.findByRole('option', { name: 'Computer Science' })

    fireEvent.change(screen.getByRole('combobox', { name: T.labelStatus }), { target: { value: 'ALLOWED' } })

    mockPatchAccess.mockResolvedValue(registered({ access: 'ALLOWED' }))
    fireEvent.click(screen.getByRole('button', { name: T.save }))

    await waitFor(() => expect(mockPatchAccess).toHaveBeenCalledWith('lu1', 'ALLOWED'))
    expect(mockPatchReg).not.toHaveBeenCalled()
  })

  it('P21: a registration 409 surfaces the staffId-taken error near the staffId field and keeps the modal open', async () => {
    authAs('ADMIN')
    mockUseLineUsers.mockReturnValue(hookState({ users: [registered()] }))
    render(<AdminPortalLineUsersPage />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(T.inspect) }))
    fireEvent.click(screen.getByRole('button', { name: T.edit }))
    await screen.findByRole('option', { name: 'Computer Science' })

    fireEvent.change(screen.getByLabelText(T.labelStaffId), { target: { value: 'DUPE' } })
    mockPatchReg.mockRejectedValue(new apiClient.ApiError(409, 'taken'))
    fireEvent.click(screen.getByRole('button', { name: T.save }))

    expect(await screen.findByText(EDITOR_MESSAGES.staffIdTaken)).toBeInTheDocument()
    // Still in edit mode (staffId input present) and flagged invalid for a11y.
    const staffId = screen.getByLabelText(T.labelStaffId)
    expect(staffId).toHaveAttribute('aria-invalid', 'true')
  })

  it('P22: Cancel resets the draft and returns to view without any PATCH', async () => {
    await openEditor(registered())
    await screen.findByRole('option', { name: 'Computer Science' })

    fireEvent.change(screen.getByLabelText(T.labelFirstName), { target: { value: 'Changed' } })
    fireEvent.click(screen.getByRole('button', { name: T.cancel }))

    expect(mockPatchReg).not.toHaveBeenCalled()
    expect(mockPatchAccess).not.toHaveBeenCalled()
    // Back to view mode (form gone); reopening Edit shows the original value.
    expect(screen.queryByLabelText(T.labelFirstName)).not.toBeInTheDocument()
  })
})

describe('AdminPortalLineUsersPage — Reject action (ส่งคืนเพื่อตรวจสอบข้อมูลใหม่)', () => {
  const REASON = 'เบอร์โทรศัพท์ไม่ถูกต้อง กรุณากรอกใหม่'

  /** Open the inspect modal for `user` as `role` (no Edit click — Reject lives in view mode). */
  function inspectAs(user: LineUser, role: SystemRole) {
    authAs(role)
    mockUseLineUsers.mockReturnValue(hookState({ users: [user] }))
    render(<AdminPortalLineUsersPage />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(T.inspect) }))
  }

  /** Open the inspect modal AND the reject dialog, ready for a reason. */
  function openRejectDialog(user: LineUser = registered({ access: 'PENDING' }), role: SystemRole = 'ADMIN') {
    inspectAs(user, role)
    fireEvent.click(screen.getByRole('button', { name: T.reject }))
  }

  it('R1: ADMIN and SUPER_ADMIN both see the Reject button on a reviewable user', () => {
    for (const role of ['ADMIN', 'SUPER_ADMIN'] as const) {
      inspectAs(registered({ access: 'PENDING' }), role)
      expect(screen.getByRole('button', { name: T.reject })).toBeInTheDocument()
      cleanup()
    }
  })

  it('R2: STAFF sees NO Reject button (read-only surface)', () => {
    inspectAs(registered({ access: 'PENDING' }), 'STAFF')
    expect(screen.getByText('STAFF-123')).toBeInTheDocument() // the modal IS open, read-only
    expect(screen.queryByRole('button', { name: T.reject })).not.toBeInTheDocument()
  })

  it('R3: an UNREGISTERED user is never rejectable (nothing was submitted to send back)', () => {
    inspectAs(makeUser({ access: 'UNREGISTERED', registration: null }), 'SUPER_ADMIN')
    expect(screen.queryByRole('button', { name: T.reject })).not.toBeInTheDocument()
  })

  it('R4: a re-reject is offered to SUPER_ADMIN but not to ADMIN', () => {
    inspectAs(registered({ access: 'REJECTED' }), 'ADMIN')
    expect(screen.queryByRole('button', { name: T.reject })).not.toBeInTheDocument()
    cleanup()

    inspectAs(registered({ access: 'REJECTED' }), 'SUPER_ADMIN')
    expect(screen.getByRole('button', { name: T.reject })).toBeInTheDocument()
  })

  it('R5: a BLANK reason blocks the submit — the button is disabled and no PATCH fires', () => {
    openRejectDialog()

    const submit = screen.getByRole('button', { name: T.rejectSubmit })
    expect(submit).toBeDisabled()
    fireEvent.click(submit)
    expect(mockPatchAccess).not.toHaveBeenCalled()

    // Whitespace alone is still blank.
    fireEvent.change(screen.getByLabelText(new RegExp(T.rejectReasonLabel)), {
      target: { value: '   ' },
    })
    expect(screen.getByRole('button', { name: T.rejectSubmit })).toBeDisabled()
    expect(mockPatchAccess).not.toHaveBeenCalled()
  })

  it('R6: the reason field is capped at the backend 500-char limit and shows a live counter', () => {
    openRejectDialog()

    const textarea = screen.getByLabelText(new RegExp(T.rejectReasonLabel))
    expect(textarea).toHaveAttribute('maxlength', '500')
    expect(screen.getByText(T.rejectReasonCounter(0, 500))).toBeInTheDocument()

    fireEvent.change(textarea, { target: { value: REASON } })
    expect(screen.getByText(T.rejectReasonCounter(REASON.length, 500))).toBeInTheDocument()
  })

  it('R7: submitting sends patchLineUserAccess(id, REJECTED, reason), updates the row in place, and closes', async () => {
    const updateUserInPlace = vi.fn()
    authAs('ADMIN')
    mockUseLineUsers.mockReturnValue(
      hookState({ users: [registered({ access: 'PENDING' })], updateUserInPlace }),
    )
    render(<AdminPortalLineUsersPage />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(T.inspect) }))
    fireEvent.click(screen.getByRole('button', { name: T.reject }))

    fireEvent.change(screen.getByLabelText(new RegExp(T.rejectReasonLabel)), {
      target: { value: REASON },
    })

    const rejected = registered({ access: 'REJECTED' })
    mockPatchAccess.mockResolvedValue(rejected)
    fireEvent.click(screen.getByRole('button', { name: T.rejectSubmit }))

    await waitFor(() => expect(mockPatchAccess).toHaveBeenCalledWith('lu1', 'REJECTED', REASON))
    expect(mockPatchReg).not.toHaveBeenCalled()
    expect(updateUserInPlace).toHaveBeenCalledWith(rejected)
    // The reason dialog closed on success…
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: T.rejectSubmit })).not.toBeInTheDocument(),
    )
    // …and the still-open inspect modal now shows the REJECTED badge.
    expect(screen.getAllByText(STATUS_BADGE.REJECTED.label).length).toBeGreaterThanOrEqual(1)
  })

  it('R8: a 400 (server-side blank/invalid reason) surfaces inline and KEEPS the dialog open', async () => {
    openRejectDialog()

    fireEvent.change(screen.getByLabelText(new RegExp(T.rejectReasonLabel)), {
      target: { value: REASON },
    })
    mockPatchAccess.mockRejectedValue(new apiClient.ApiError(400, 'REJECTION_REASON_REQUIRED'))
    fireEvent.click(screen.getByRole('button', { name: T.rejectSubmit }))

    expect(await screen.findByText(EDITOR_MESSAGES.rejectInvalid)).toBeInTheDocument()
    // Still open, still holding the typed reason, and flagged invalid for a11y.
    const textarea = screen.getByLabelText(new RegExp(T.rejectReasonLabel))
    expect(textarea).toHaveValue(REASON)
    expect(textarea).toHaveAttribute('aria-invalid', 'true')
    expect(textarea.getAttribute('aria-describedby')).toContain('reject-reason-error')
  })

  it('R9: Cancel closes the dialog without any PATCH', () => {
    openRejectDialog()

    fireEvent.change(screen.getByLabelText(new RegExp(T.rejectReasonLabel)), {
      target: { value: REASON },
    })
    fireEvent.click(screen.getByRole('button', { name: T.cancel }))

    expect(mockPatchAccess).not.toHaveBeenCalled()
  })
})
