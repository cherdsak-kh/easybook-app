import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { OptionsPage } from '@/pages/admin/OptionsPage'
import { UI_STRINGS } from '@/constants/ui-strings-backend'
import * as apiClient from '@/lib/api-client'
import type { Department, PersonnelRole } from '@/lib/api-client'

const UI = UI_STRINGS.options

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
    listDepartments: vi.fn(),
    createDepartment: vi.fn(),
    patchDepartment: vi.fn(),
    deleteDepartment: vi.fn(),
    listPersonnelRoles: vi.fn(),
    createPersonnelRole: vi.fn(),
    patchPersonnelRole: vi.fn(),
    deletePersonnelRole: vi.fn(),
  }
})

const mockGetMe = vi.mocked(apiClient.getMe)
const mockListDepts = vi.mocked(apiClient.listDepartments)
const mockCreateDept = vi.mocked(apiClient.createDepartment)
const mockPatchDept = vi.mocked(apiClient.patchDepartment)
const mockDeleteDept = vi.mocked(apiClient.deleteDepartment)
const mockListRoles = vi.mocked(apiClient.listPersonnelRoles)
const mockCreateRole = vi.mocked(apiClient.createPersonnelRole)

function dept(overrides: Partial<Department> = {}): Department {
  return {
    id: 1,
    name: 'Computer Science',
    isSystemReserved: false,
    createdAt: '2026-07-14T10:00:00.000Z',
    updatedAt: '2026-07-14T10:00:00.000Z',
    ...overrides,
  }
}

function role(overrides: Partial<PersonnelRole> = {}): PersonnelRole {
  return {
    id: 1,
    name: 'Teacher',
    isSystemReserved: false,
    createdAt: '2026-07-14T10:00:00.000Z',
    updatedAt: '2026-07-14T10:00:00.000Z',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <OptionsPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

/**
 * The Departments management section, as a labelled region.
 *
 * Matched on the EXACT heading the page renders, because both sides now read it
 * from the same dictionary entry. Previously this had to match a loose `/^Departments/`
 * prefix to survive the Thai gloss being appended out-of-band — that workaround
 * is what the dictionary removes the need for.
 */
function departmentsRegion() {
  return within(screen.getByRole('region', { name: UI.departments.title }))
}

function personnelRolesRegion() {
  return within(screen.getByRole('region', { name: UI.personnelRoles.title }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetMe.mockResolvedValue(null) // AuthProvider is stable; the page doesn't need a user
  mockListDepts.mockResolvedValue([dept()])
  mockListRoles.mockResolvedValue([role()])
})

describe('OptionsPage', () => {
  it('lists both Departments and Personnel Roles (SC-F4)', async () => {
    renderPage()

    expect(await departmentsRegion().findByText('Computer Science')).toBeInTheDocument()
    expect(personnelRolesRegion().getByText('Teacher')).toBeInTheDocument()
    expect(mockListDepts).toHaveBeenCalledTimes(1)
    expect(mockListRoles).toHaveBeenCalledTimes(1)
    // Each section is wired to its OWN endpoint — a swap here would render the
    // roles list under the Departments heading and still look plausible.
    expect(departmentsRegion().queryByText('Teacher')).not.toBeInTheDocument()
    expect(personnelRolesRegion().queryByText('Computer Science')).not.toBeInTheDocument()
  })

  it('creates a department and re-fetches the list', async () => {
    mockCreateDept.mockResolvedValue(dept({ id: 2, name: 'Physics' }))
    renderPage()
    await departmentsRegion().findByText('Computer Science')

    fireEvent.click(departmentsRegion().getByRole('button', { name: UI.add }))
    // The dialog is scoped to the resource it was opened from.
    expect(
      screen.getByRole('heading', { name: UI.form.addTitle(UI.departments.noun) }),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(UI.nameLabel), { target: { value: 'Physics' } })
    // After the successful create, the list re-fetch returns both rows.
    mockListDepts.mockResolvedValue([dept(), dept({ id: 2, name: 'Physics' })])
    fireEvent.click(screen.getByRole('button', { name: UI_STRINGS.common.save }))

    await waitFor(() => expect(mockCreateDept).toHaveBeenCalledWith({ name: 'Physics' }))
    expect(await departmentsRegion().findByText('Physics')).toBeInTheDocument()
    expect(mockListDepts).toHaveBeenCalledTimes(2)
    // The department create must never leak into the roles resource.
    expect(mockCreateRole).not.toHaveBeenCalled()
  })

  it('surfaces a 409 (name taken) inline in the create dialog', async () => {
    mockCreateDept.mockRejectedValue(new apiClient.ApiError(409, 'NAME_TAKEN'))
    renderPage()
    await departmentsRegion().findByText('Computer Science')

    fireEvent.click(departmentsRegion().getByRole('button', { name: UI.add }))
    fireEvent.change(screen.getByLabelText(UI.nameLabel), { target: { value: 'Computer Science' } })
    fireEvent.click(screen.getByRole('button', { name: UI_STRINGS.common.save }))

    expect(await screen.findByText(UI.form.nameTaken)).toBeInTheDocument()
    // The dialog stays open (list not re-fetched beyond the initial mount) so the
    // typed name is not lost.
    expect(mockListDepts).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText(UI.nameLabel)).toHaveValue('Computer Science')
  })

  it('renames a department', async () => {
    mockPatchDept.mockResolvedValue(dept({ name: 'Computer Engineering' }))
    renderPage()
    await departmentsRegion().findByText('Computer Science')

    fireEvent.click(departmentsRegion().getByRole('button', { name: UI.rename }))
    // Rename pre-fills the row's current name rather than opening blank.
    expect(screen.getByLabelText(UI.nameLabel)).toHaveValue('Computer Science')
    fireEvent.change(screen.getByLabelText(UI.nameLabel), {
      target: { value: 'Computer Engineering' },
    })
    mockListDepts.mockResolvedValue([dept({ name: 'Computer Engineering' })])
    fireEvent.click(screen.getByRole('button', { name: UI_STRINGS.common.save }))

    // PATCHes the row's id (not its index/name) with the new name.
    await waitFor(() =>
      expect(mockPatchDept).toHaveBeenCalledWith(1, { name: 'Computer Engineering' }),
    )
    expect(await departmentsRegion().findByText('Computer Engineering')).toBeInTheDocument()
    expect(mockCreateDept).not.toHaveBeenCalled()
  })

  it('soft-deletes a department (confirm) and the row disappears', async () => {
    mockDeleteDept.mockResolvedValue(undefined)
    renderPage()
    await departmentsRegion().findByText('Computer Science')

    fireEvent.click(
      departmentsRegion().getByRole('button', { name: UI.deleteRow('Computer Science') }),
    )
    // Nothing is sent until the confirm step is clicked.
    expect(mockDeleteDept).not.toHaveBeenCalled()

    // Confirm step, then the re-fetch returns an empty list.
    mockListDepts.mockResolvedValue([])
    fireEvent.click(departmentsRegion().getByRole('button', { name: UI_STRINGS.common.confirm }))

    await waitFor(() => expect(mockDeleteDept).toHaveBeenCalledWith(1))
    await waitFor(() =>
      expect(departmentsRegion().queryByText('Computer Science')).not.toBeInTheDocument(),
    )
    expect(mockListDepts).toHaveBeenCalledTimes(2)
    // The now-empty list shows its own empty state, not a blank panel.
    expect(departmentsRegion().getByText(UI.empty(UI.departments.title))).toBeInTheDocument()
  })

  it('surfaces a 403 (STAFF denied) as a non-crashing notice', async () => {
    mockListDepts.mockRejectedValue(new apiClient.ApiError(403, 'Forbidden'))
    renderPage()

    // The message interpolates the section title. Both sides build it from the
    // same entry, so this can now assert the WHOLE message (as an alert) rather
    // than a loose prefix regex.
    const alert = await departmentsRegion().findByRole('alert')
    expect(alert).toHaveTextContent(UI.loadForbidden(UI.departments.title))
    // A 403 on one resource must not blank the other, nor the page itself.
    expect(personnelRolesRegion().getByText('Teacher')).toBeInTheDocument()
  })

  it('distinguishes a 403 from a generic load failure', async () => {
    mockListDepts.mockRejectedValue(new apiClient.ApiError(500, 'Boom'))
    renderPage()

    const alert = await departmentsRegion().findByRole('alert')
    expect(alert).toHaveTextContent(UI.loadFailed(UI.departments.title))
    expect(alert).not.toHaveTextContent(UI.loadForbidden(UI.departments.title))
  })

  it('shows a read-only Reserved badge on a system-reserved row and hides its Rename/Delete (AC-2)', async () => {
    // Only a SUPER_ADMIN ever receives `isSystemReserved: true` from the API; the
    // badge is keyed purely on the flag, and the backend 404s any PATCH/DELETE of
    // such a row — so the controls must not render.
    mockListDepts.mockResolvedValue([
      dept({ id: 1, name: 'System Developer', isSystemReserved: true }),
      dept({ id: 2, name: 'Computer Science', isSystemReserved: false }),
    ])
    renderPage()

    const reservedRow = within(
      (await departmentsRegion().findByText('System Developer')).closest('li')!,
    )
    expect(reservedRow.getByText(UI.reservedBadge)).toBeInTheDocument()
    // The dead controls are gone, not merely disabled.
    expect(reservedRow.queryByRole('button', { name: UI.rename })).not.toBeInTheDocument()
    expect(
      reservedRow.queryByRole('button', { name: UI.deleteRow('System Developer') }),
    ).not.toBeInTheDocument()

    // A normal row in the SAME list keeps its controls and shows no badge — the
    // suppression is per-row, keyed on the flag, not a whole-section toggle.
    const normalRow = within(departmentsRegion().getByText('Computer Science').closest('li')!)
    expect(normalRow.getByRole('button', { name: UI.rename })).toBeInTheDocument()
    expect(
      normalRow.getByRole('button', { name: UI.deleteRow('Computer Science') }),
    ).toBeInTheDocument()
    expect(normalRow.queryByText(UI.reservedBadge)).not.toBeInTheDocument()
  })

  it('suppresses Rename/Delete on a reserved personnel-role row too (AC-2)', async () => {
    mockListRoles.mockResolvedValue([role({ id: 1, name: 'System Developer', isSystemReserved: true })])
    renderPage()

    const reservedRow = within(
      (await personnelRolesRegion().findByText('System Developer')).closest('li')!,
    )
    expect(reservedRow.getByText(UI.reservedBadge)).toBeInTheDocument()
    expect(reservedRow.queryByRole('button', { name: UI.rename })).not.toBeInTheDocument()
    expect(
      reservedRow.queryByRole('button', { name: UI.deleteRow('System Developer') }),
    ).not.toBeInTheDocument()
  })
})
