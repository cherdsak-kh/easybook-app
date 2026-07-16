import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { OptionsPage } from '@/pages/admin/OptionsPage'
import * as apiClient from '@/lib/api-client'
import type { Department, PersonnelRole } from '@/lib/api-client'

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

function dept(overrides: Partial<Department> = {}): Department {
  return {
    id: 1,
    name: 'Computer Science',
    createdAt: '2026-07-14T10:00:00.000Z',
    updatedAt: '2026-07-14T10:00:00.000Z',
    ...overrides,
  }
}

function role(overrides: Partial<PersonnelRole> = {}): PersonnelRole {
  return {
    id: 1,
    name: 'Teacher',
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

/** The Departments management section, as a labelled region. */
function departmentsRegion() {
  return within(screen.getByRole('region', { name: 'Departments' }))
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
    expect(
      within(screen.getByRole('region', { name: 'Personnel Roles' })).getByText('Teacher'),
    ).toBeInTheDocument()
    expect(mockListDepts).toHaveBeenCalledTimes(1)
    expect(mockListRoles).toHaveBeenCalledTimes(1)
  })

  it('creates a department and re-fetches the list', async () => {
    mockCreateDept.mockResolvedValue(dept({ id: 2, name: 'Physics' }))
    renderPage()
    await departmentsRegion().findByText('Computer Science')

    fireEvent.click(departmentsRegion().getByRole('button', { name: 'Add' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Physics' } })
    // After the successful create, the list re-fetch returns both rows.
    mockListDepts.mockResolvedValue([dept(), dept({ id: 2, name: 'Physics' })])
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(mockCreateDept).toHaveBeenCalledWith({ name: 'Physics' }))
    expect(await departmentsRegion().findByText('Physics')).toBeInTheDocument()
    expect(mockListDepts).toHaveBeenCalledTimes(2)
  })

  it('surfaces a 409 (name taken) inline in the create dialog', async () => {
    mockCreateDept.mockRejectedValue(new apiClient.ApiError(409, 'NAME_TAKEN'))
    renderPage()
    await departmentsRegion().findByText('Computer Science')

    fireEvent.click(departmentsRegion().getByRole('button', { name: 'Add' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Computer Science' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('That name is already in use.')).toBeInTheDocument()
    // The dialog stays open (list not re-fetched beyond the initial mount).
    expect(mockListDepts).toHaveBeenCalledTimes(1)
  })

  it('renames a department', async () => {
    mockPatchDept.mockResolvedValue(dept({ name: 'Computer Engineering' }))
    renderPage()
    await departmentsRegion().findByText('Computer Science')

    fireEvent.click(departmentsRegion().getByRole('button', { name: 'Rename' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Computer Engineering' } })
    mockListDepts.mockResolvedValue([dept({ name: 'Computer Engineering' })])
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(mockPatchDept).toHaveBeenCalledWith(1, { name: 'Computer Engineering' }),
    )
    expect(await departmentsRegion().findByText('Computer Engineering')).toBeInTheDocument()
  })

  it('soft-deletes a department (confirm) and the row disappears', async () => {
    mockDeleteDept.mockResolvedValue(undefined)
    renderPage()
    await departmentsRegion().findByText('Computer Science')

    fireEvent.click(departmentsRegion().getByRole('button', { name: 'Delete Computer Science' }))
    // Confirm step, then the re-fetch returns an empty list.
    mockListDepts.mockResolvedValue([])
    fireEvent.click(departmentsRegion().getByRole('button', { name: 'Confirm' }))

    await waitFor(() => expect(mockDeleteDept).toHaveBeenCalledWith(1))
    await waitFor(() =>
      expect(departmentsRegion().queryByText('Computer Science')).not.toBeInTheDocument(),
    )
    expect(mockListDepts).toHaveBeenCalledTimes(2)
  })

  it('surfaces a 403 (STAFF denied) as a non-crashing notice', async () => {
    mockListDepts.mockRejectedValue(new apiClient.ApiError(403, 'Forbidden'))
    renderPage()

    expect(
      await departmentsRegion().findByText('You do not have permission to manage departments.'),
    ).toBeInTheDocument()
  })
})
