import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { UI_STRINGS } from '@/constants/ui-strings-backend'
import { ID_COUNT, PHONE_COUNT } from '@/components/RegistrationForm'
import { LineUserRegistrationModal } from '@/components/admin/LineUserRegistrationModal'
import * as apiClient from '@/lib/api-client'
import type { Department, LineUser, PersonnelRole } from '@/lib/api-client'

const LU = UI_STRINGS.lineUsers
const UI = LU.edit
const REG = LU.registration

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
    patchLineUserRegistration: vi.fn(),
    listDepartments: vi.fn(),
    listPersonnelRoles: vi.fn(),
  }
})

const mockPatch = vi.mocked(apiClient.patchLineUserRegistration)
const mockListDepartments = vi.mocked(apiClient.listDepartments)
const mockListPersonnelRoles = vi.mocked(apiClient.listPersonnelRoles)

// Anchor the pre-filled fixtures to the validator's own constants (precedent:
// `RegistrationForm`'s ID_COUNT/PHONE_COUNT): a 13-digit staffId and a 10-digit
// phone so the pre-filled form is submittable unchanged.
const VALID_STAFF_ID = '1'.repeat(ID_COUNT)
const VALID_PHONE = '0'.repeat(PHONE_COUNT)

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

function lineUser(overrides: Partial<LineUser> = {}): LineUser {
  return {
    id: 'lu-42',
    lineUserId: 'U0000000000000000000000000000042',
    displayName: 'Alice',
    pictureUrl: null,
    statusMessage: null,
    richMenuType: 'TYPE_1',
    access: 'PENDING',
    followedAt: '2026-07-01T00:00:00.000Z',
    registration: {
      firstName: 'Somchai',
      lastName: 'Jaidee',
      staffId: VALID_STAFF_ID,
      phone: VALID_PHONE,
      departmentId: 2,
      department: 'Computer Science',
      personnelRoleId: 1,
      personnelRole: 'Teacher',
    },
    ...overrides,
  }
}

function renderModal(handlers: Partial<Parameters<typeof LineUserRegistrationModal>[0]> = {}) {
  const props = {
    user: lineUser(),
    onClose: vi.fn(),
    onSaved: vi.fn(),
    onSessionExpired: vi.fn(),
    onRowGone: vi.fn(),
    ...handlers,
  }
  render(<LineUserRegistrationModal {...props} />)
  return props
}

beforeEach(() => {
  vi.clearAllMocks()
  mockListDepartments.mockResolvedValue([department()])
  mockListPersonnelRoles.mockResolvedValue([personnelRole()])
})

describe('LineUserRegistrationModal', () => {
  it('pre-fills all six fields from the current registration', async () => {
    renderModal()

    expect(await screen.findByLabelText(UI.firstName)).toHaveValue('Somchai')
    expect(screen.getByLabelText(UI.lastName)).toHaveValue('Jaidee')
    expect(screen.getByLabelText(REG.staffId)).toHaveValue(VALID_STAFF_ID)
    expect(screen.getByLabelText(REG.phone)).toHaveValue(VALID_PHONE)
    // The selects are pre-set to the assigned option ids (as DOM strings).
    expect(screen.getByLabelText(REG.department)).toHaveValue('2')
    expect(screen.getByLabelText(REG.role)).toHaveValue('1')
  })

  it('does NOT offer a system-reserved option in either select (reserved filtered out)', async () => {
    mockListDepartments.mockResolvedValue([
      department({ id: 2, name: 'Computer Science' }),
      department({ id: 99, name: 'System Developers', isSystemReserved: true }),
    ])
    mockListPersonnelRoles.mockResolvedValue([
      personnelRole({ id: 1, name: 'Teacher' }),
      personnelRole({ id: 98, name: 'System Bot', isSystemReserved: true }),
    ])
    renderModal()

    const deptSelect = await screen.findByLabelText(REG.department)
    expect(within(deptSelect).getByRole('option', { name: 'Computer Science' })).toBeInTheDocument()
    // The reserved developer option must never be offered to a LINE end-user.
    expect(within(deptSelect).queryByRole('option', { name: 'System Developers' })).not.toBeInTheDocument()

    const roleSelect = screen.getByLabelText(REG.role)
    expect(within(roleSelect).getByRole('option', { name: 'Teacher' })).toBeInTheDocument()
    expect(within(roleSelect).queryByRole('option', { name: 'System Bot' })).not.toBeInTheDocument()
  })

  it('submits the correct PATCH id and a Number-coerced payload', async () => {
    mockPatch.mockResolvedValue(lineUser())
    const props = renderModal()

    fireEvent.click(await screen.findByRole('button', { name: UI_STRINGS.common.save }))

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith('lu-42', {
        firstName: 'Somchai',
        lastName: 'Jaidee',
        staffId: VALID_STAFF_ID,
        phone: VALID_PHONE,
        // Coerced from the <select>'s DOM strings to integers.
        departmentId: 2,
        personnelRoleId: 1,
      }),
    )
    // The exact-object assertion above already proves the ids are numbers (2, not
    // "2"); assert the type explicitly too, so a regression to strings is loud.
    const [, body] = mockPatch.mock.calls[0]
    expect(typeof body.departmentId).toBe('number')
    expect(typeof body.personnelRoleId).toBe('number')

    await waitFor(() => expect(props.onSaved).toHaveBeenCalledTimes(1))
  })

  it('renders a 409 (STAFF_ID_TAKEN) inline and does NOT log out', async () => {
    mockPatch.mockRejectedValue(new apiClient.ApiError(409, 'STAFF_ID_TAKEN'))
    const props = renderModal()

    fireEvent.click(await screen.findByRole('button', { name: UI_STRINGS.common.save }))

    expect(await screen.findByText(UI.staffIdTaken)).toBeInTheDocument()
    expect(props.onSessionExpired).not.toHaveBeenCalled()
    expect(props.onRowGone).not.toHaveBeenCalled()
    expect(props.onSaved).not.toHaveBeenCalled()
  })

  it('renders a 400 (validation / reserved option) inline and does NOT log out', async () => {
    mockPatch.mockRejectedValue(new apiClient.ApiError(400, 'INVALID_DEPARTMENT'))
    const props = renderModal()

    fireEvent.click(await screen.findByRole('button', { name: UI_STRINGS.common.save }))

    expect(await screen.findByText(UI.invalid)).toBeInTheDocument()
    expect(props.onSessionExpired).not.toHaveBeenCalled()
  })

  it('logs out on 401 only (no inline message, no row notice)', async () => {
    mockPatch.mockRejectedValue(new apiClient.ApiError(401, 'Unauthorized'))
    const props = renderModal()

    fireEvent.click(await screen.findByRole('button', { name: UI_STRINGS.common.save }))

    await waitFor(() => expect(props.onSessionExpired).toHaveBeenCalledTimes(1))
    expect(props.onRowGone).not.toHaveBeenCalled()
    expect(screen.queryByText(UI.saveFailed)).not.toBeInTheDocument()
  })

  it('surfaces a 404 as a row-gone signal (not an inline message, not a logout)', async () => {
    mockPatch.mockRejectedValue(new apiClient.ApiError(404, 'LINE_USER_REGISTRATION_NOT_FOUND'))
    const props = renderModal()

    fireEvent.click(await screen.findByRole('button', { name: UI_STRINGS.common.save }))

    await waitFor(() => expect(props.onRowGone).toHaveBeenCalledTimes(1))
    expect(props.onSessionExpired).not.toHaveBeenCalled()
  })

  it('blocks submission and shows a field error when the staffId length is wrong (mirrors the backend rule)', async () => {
    const props = renderModal()

    const staff = await screen.findByLabelText(REG.staffId)
    // One digit short of ID_COUNT — the client validator must catch it before the PATCH.
    fireEvent.change(staff, { target: { value: '1'.repeat(ID_COUNT - 1) } })
    fireEvent.click(screen.getByRole('button', { name: UI_STRINGS.common.save }))

    expect(await screen.findByText(UI.staffIdLength(ID_COUNT))).toBeInTheDocument()
    expect(mockPatch).not.toHaveBeenCalled()
    expect(props.onSaved).not.toHaveBeenCalled()
  })
})
