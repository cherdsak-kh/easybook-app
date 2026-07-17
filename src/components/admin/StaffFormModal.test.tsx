import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { StaffFormModal } from '@/components/admin/StaffFormModal'
import { UI_STRINGS } from '@/constants/ui-strings-backend'
import * as apiClient from '@/lib/api-client'
import type { Department, PersonnelRole, SystemUser } from '@/lib/api-client'

const UI = UI_STRINGS.staff.form

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
    listDepartments: vi.fn(),
    listPersonnelRoles: vi.fn(),
    createSystemUser: vi.fn(),
    patchSystemUser: vi.fn(),
  }
})

const mockListDepts = vi.mocked(apiClient.listDepartments)
const mockListRoles = vi.mocked(apiClient.listPersonnelRoles)
const mockCreate = vi.mocked(apiClient.createSystemUser)
const mockPatch = vi.mocked(apiClient.patchSystemUser)

function dept(id: number, name: string): Department {
  return {
    id,
    name,
    createdAt: '2026-07-14T10:00:00.000Z',
    updatedAt: '2026-07-14T10:00:00.000Z',
  }
}

function role(id: number, name: string): PersonnelRole {
  return {
    id,
    name,
    createdAt: '2026-07-14T10:00:00.000Z',
    updatedAt: '2026-07-14T10:00:00.000Z',
  }
}

function systemUser(overrides: Partial<SystemUser> = {}): SystemUser {
  return {
    id: 'u1',
    email: 'ada@easybook.local',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'STAFF',
    personnelRole: { id: 10, name: 'Teacher' },
    department: { id: 20, name: 'Computer Science' },
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

beforeEach(() => {
  vi.clearAllMocks()
  mockListDepts.mockResolvedValue([dept(20, 'Computer Science'), dept(21, 'Registrar')])
  mockListRoles.mockResolvedValue([role(10, 'Teacher'), role(11, 'Director')])
})

/** Wait for the option lists to land and the form to replace the spinner. */
async function awaitForm() {
  await waitFor(() =>
    expect(screen.queryByTestId('staff-options-loading')).not.toBeInTheDocument(),
  )
}

describe('StaffFormModal', () => {
  it('populates Position and Department selects from the option endpoints (AC-F1)', async () => {
    render(<StaffFormModal mode="create" canEditRole onClose={vi.fn()} onSaved={vi.fn()} />)
    await awaitForm()

    expect(mockListDepts).toHaveBeenCalledTimes(1)
    expect(mockListRoles).toHaveBeenCalledTimes(1)

    // The personnelRole field is labelled "Position" in the UI.
    const position = screen.getByLabelText(UI.position)
    const department = screen.getByLabelText(UI.department)
    expect(within(position).getByRole('option', { name: 'Teacher' })).toBeInTheDocument()
    expect(within(position).getByRole('option', { name: 'Director' })).toBeInTheDocument()
    expect(within(department).getByRole('option', { name: 'Computer Science' })).toBeInTheDocument()
    expect(within(department).getByRole('option', { name: 'Registrar' })).toBeInTheDocument()
  })

  it('submits option ids as NUMBERS, not the DOM strings (AC-F1)', async () => {
    mockCreate.mockResolvedValue({ ...systemUser(), temporaryPassword: 'Kp7Rn2Tq9Wx4Yb6C' })
    render(<StaffFormModal mode="create" canEditRole onClose={vi.fn()} onSaved={vi.fn()} />)
    await awaitForm()

    fireEvent.change(screen.getByLabelText(UI.email), {
      target: { value: 'new@easybook.local' },
    })
    fireEvent.change(screen.getByLabelText(UI.firstName), { target: { value: 'Grace' } })
    fireEvent.change(screen.getByLabelText(UI.lastName), { target: { value: 'Hopper' } })
    fireEvent.change(screen.getByLabelText(UI.position), { target: { value: '11' } })
    fireEvent.change(screen.getByLabelText(UI.department), { target: { value: '21' } })
    fireEvent.click(screen.getByRole('button', { name: UI_STRINGS.common.save }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    const body = mockCreate.mock.calls[0][0]
    // The backend types both ids as @IsInt() with no implicit conversion: a
    // string "21" would be a 400.
    expect(body.departmentId).toBe(21)
    expect(body.personnelRoleId).toBe(11)
    expect(typeof body.departmentId).toBe('number')
    expect(typeof body.personnelRoleId).toBe('number')
  })

  it('never sends a password on create — the server issues one (AC-F3)', async () => {
    mockCreate.mockResolvedValue({ ...systemUser(), temporaryPassword: 'Kp7Rn2Tq9Wx4Yb6C' })
    render(<StaffFormModal mode="create" canEditRole onClose={vi.fn()} onSaved={vi.fn()} />)
    await awaitForm()

    // There is no password input at all.
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(UI.email), { target: { value: 'new@easybook.local' } })
    fireEvent.change(screen.getByLabelText(UI.firstName), { target: { value: 'Grace' } })
    fireEvent.change(screen.getByLabelText(UI.lastName), { target: { value: 'Hopper' } })
    fireEvent.change(screen.getByLabelText(UI.position), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText(UI.department), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: UI_STRINGS.common.save }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('password')
  })

  it('hands the created user (with its one-time password) to onSaved (AC-F3)', async () => {
    const onSaved = vi.fn()
    mockCreate.mockResolvedValue({ ...systemUser(), temporaryPassword: 'Kp7Rn2Tq9Wx4Yb6C' })
    render(<StaffFormModal mode="create" canEditRole onClose={vi.fn()} onSaved={onSaved} />)
    await awaitForm()

    fireEvent.change(screen.getByLabelText(UI.email), { target: { value: 'new@easybook.local' } })
    fireEvent.change(screen.getByLabelText(UI.firstName), { target: { value: 'Grace' } })
    fireEvent.change(screen.getByLabelText(UI.lastName), { target: { value: 'Hopper' } })
    fireEvent.change(screen.getByLabelText(UI.position), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText(UI.department), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: UI_STRINGS.common.save }))

    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({ temporaryPassword: 'Kp7Rn2Tq9Wx4Yb6C' }),
      ),
    )
  })

  it('pre-fills the selects from the assigned options in edit mode (AC-F1)', async () => {
    render(
      <StaffFormModal
        mode="edit"
        user={systemUser()}
        canEditRole
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )
    await awaitForm()

    expect(screen.getByLabelText<HTMLSelectElement>(UI.position).value).toBe('10')
    expect(screen.getByLabelText<HTMLSelectElement>(UI.department).value).toBe('20')
  })

  it('submits numeric ids on edit too (AC-F1)', async () => {
    mockPatch.mockResolvedValue(systemUser())
    render(
      <StaffFormModal
        mode="edit"
        user={systemUser()}
        canEditRole={false}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )
    await awaitForm()

    fireEvent.change(screen.getByLabelText(UI.department), { target: { value: '21' } })
    fireEvent.click(screen.getByRole('button', { name: UI_STRINGS.common.save }))

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1))
    const [id, body] = mockPatch.mock.calls[0]
    expect(id).toBe('u1')
    expect(body.departmentId).toBe(21)
    expect(body.personnelRoleId).toBe(10)
    expect(typeof body.departmentId).toBe('number')
    // `canEditRole={false}` → the field is neither offered nor sent. Sending it
    // would be a privilege escalation the server would have to reject.
    expect(screen.queryByLabelText(UI.role)).not.toBeInTheDocument()
    expect(body).not.toHaveProperty('role')
  })

  it('sends `role` only when the admin is allowed to edit it (AC-F1)', async () => {
    mockPatch.mockResolvedValue(systemUser())
    render(
      <StaffFormModal
        mode="edit"
        user={systemUser()}
        canEditRole
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )
    await awaitForm()

    fireEvent.change(screen.getByLabelText(UI.role), { target: { value: 'ADMIN' } })
    fireEvent.click(screen.getByRole('button', { name: UI_STRINGS.common.save }))

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1))
    // The wire value is the enum, not the display label.
    expect(mockPatch.mock.calls[0][1].role).toBe('ADMIN')
  })

  // ------------------------------------------------------------------- AC-F2

  it('still shows a soft-deleted assigned option, disabled, without blanking the form (AC-F2)', async () => {
    // The assignment survives its option being soft-deleted, so the option is
    // absent from the active list the select is fed from.
    const user = systemUser({ department: { id: 99, name: 'Retired Dept' } })
    render(
      <StaffFormModal mode="edit" user={user} canEditRole onClose={vi.fn()} onSaved={vi.fn()} />,
    )
    await awaitForm()

    const department = screen.getByLabelText<HTMLSelectElement>(UI.department)
    // Not blanked to the placeholder — that is the crash path AC-F2 forbids.
    expect(department.value).toBe('99')
    const stale = within(department).getByRole<HTMLOptionElement>('option', {
      name: UI.removedOption('Retired Dept'),
    })
    expect(stale).toBeInTheDocument()
    expect(stale.disabled).toBe(true)
  })

  it('refuses to save while a removed option is still selected (AC-F2)', async () => {
    const user = systemUser({ department: { id: 99, name: 'Retired Dept' } })
    render(
      <StaffFormModal mode="edit" user={user} canEditRole onClose={vi.fn()} onSaved={vi.fn()} />,
    )
    await awaitForm()

    fireEvent.click(screen.getByRole('button', { name: UI_STRINGS.common.save }))

    expect(
      await screen.findByText(UI.departmentRemoved),
    ).toBeInTheDocument()
    expect(mockPatch).not.toHaveBeenCalled()

    // Picking an active one clears the block and saves.
    mockPatch.mockResolvedValue(systemUser())
    fireEvent.change(screen.getByLabelText(UI.department), { target: { value: '21' } })
    fireEvent.click(screen.getByRole('button', { name: UI_STRINGS.common.save }))

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1))
    expect(mockPatch.mock.calls[0][1].departmentId).toBe(21)
  })

  // --------------------------------------------------------- Loading / errors

  it('shows a loading state while the options are in flight', () => {
    mockListDepts.mockReturnValue(new Promise(() => {}))
    render(<StaffFormModal mode="create" canEditRole onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(screen.getByTestId('staff-options-loading')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: UI_STRINGS.common.save })).not.toBeInTheDocument()
  })

  it('surfaces an options load failure with a retry rather than a silent no-op', async () => {
    mockListDepts.mockRejectedValue(new apiClient.ApiError(500, 'Boom'))
    render(<StaffFormModal mode="create" canEditRole onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(
      await screen.findByText(UI.optionsFailed),
    ).toBeInTheDocument()

    mockListDepts.mockResolvedValue([dept(20, 'Computer Science')])
    fireEvent.click(screen.getByRole('button', { name: UI_STRINGS.common.tryAgain }))
    await awaitForm()
    expect(screen.getByLabelText(UI.department)).toBeInTheDocument()
  })

  it('surfaces a 400 from the server inline (AC-F1)', async () => {
    mockCreate.mockRejectedValue(new apiClient.ApiError(400, 'Bad Request'))
    render(<StaffFormModal mode="create" canEditRole onClose={vi.fn()} onSaved={vi.fn()} />)
    await awaitForm()

    fireEvent.change(screen.getByLabelText(UI.email), { target: { value: 'new@easybook.local' } })
    fireEvent.change(screen.getByLabelText(UI.firstName), { target: { value: 'Grace' } })
    fireEvent.change(screen.getByLabelText(UI.lastName), { target: { value: 'Hopper' } })
    fireEvent.change(screen.getByLabelText(UI.position), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText(UI.department), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: UI_STRINGS.common.save }))

    expect(
      await screen.findByText(UI.invalid),
    ).toBeInTheDocument()
  })
})
