import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { ProfilePage } from '@/pages/admin/ProfilePage'
import * as apiClient from '@/lib/api-client'
import type { SystemUser } from '@/lib/api-client'

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
    AVATAR_MAX_BYTES: 2 * 1024 * 1024,
    AVATAR_ACCEPTED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    getMe: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    updateOwnProfile: vi.fn(),
    uploadOwnAvatar: vi.fn(),
  }
})

const mockGetMe = vi.mocked(apiClient.getMe)
const mockUpdate = vi.mocked(apiClient.updateOwnProfile)
const mockUpload = vi.mocked(apiClient.uploadOwnAvatar)

function makeUser(overrides: Partial<SystemUser> = {}): SystemUser {
  return {
    id: 'u1',
    email: 'ada@easybook.local',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'ADMIN',
    personnelRole: { id: 1, name: 'Teacher' },
    department: { id: 2, name: 'Computer Science' },
    mustChangePassword: false,
    phoneNumber: '02-123-4567',
    profilePictureUrl: null,
    isActive: true,
    lineUserId: null,
    lastLoginAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ProfilePage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

/** A file whose reported size/type we control (jsdom does not read bytes). */
function fakeFile(name: string, type: string, size: number): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetMe.mockResolvedValue(makeUser())
})

describe('ProfilePage', () => {
  it('shows a skeleton while /me is in flight, then the profile', async () => {
    mockGetMe.mockReturnValue(new Promise(() => {}))
    renderPage()

    expect(screen.getByTestId('profile-skeleton')).toBeInTheDocument()
  })

  it('surfaces a failed load with a retry rather than a silent no-op', async () => {
    mockGetMe.mockResolvedValue(null)
    renderPage()

    expect(await screen.findByText('Could not load your profile. Please try again.')).toBeInTheDocument()

    mockGetMe.mockResolvedValue(makeUser())
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByLabelText('First name')).toBeInTheDocument()
  })

  // ------------------------------------------------------------------- AC-F7

  it('renders role, Position and department READ-ONLY with a managed-by note (AC-F7)', async () => {
    renderPage()
    await screen.findByLabelText('First name')

    // Present as values...
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByText('Teacher')).toBeInTheDocument()
    expect(screen.getByText('Computer Science')).toBeInTheDocument()
    expect(screen.getByText(/A Super Admin manages this/)).toBeInTheDocument()

    // ...but not as editable form controls. The self-edit DTO has no such
    // fields, so there must be nothing to type into.
    expect(screen.queryByLabelText('Role')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Position')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Department')).not.toBeInTheDocument()
  })

  it('PATCHes ONLY the self-editable fields — never role/department/personnelRole (AC-F7)', async () => {
    mockUpdate.mockResolvedValue(makeUser({ firstName: 'Grace' }))
    renderPage()

    fireEvent.change(await screen.findByLabelText('First name'), { target: { value: 'Grace' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
    const body = mockUpdate.mock.calls[0][0]
    expect(body).toEqual({
      firstName: 'Grace',
      lastName: 'Lovelace',
      phoneNumber: '02-123-4567',
    })
    // `forbidNonWhitelisted` makes any of these a 400 — they must be absent.
    expect(body).not.toHaveProperty('role')
    expect(body).not.toHaveProperty('department')
    expect(body).not.toHaveProperty('departmentId')
    expect(body).not.toHaveProperty('personnelRole')
    expect(body).not.toHaveProperty('personnelRoleId')
    expect(body).not.toHaveProperty('email')
    expect(body).not.toHaveProperty('isActive')
  })

  it('sends phoneNumber (not `phone`) and clears it with an explicit null', async () => {
    mockUpdate.mockResolvedValue(makeUser({ phoneNumber: null }))
    renderPage()

    fireEvent.change(await screen.findByLabelText('Phone number (optional)'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
    const body = mockUpdate.mock.calls[0][0]
    expect(body.phoneNumber).toBeNull()
    expect(body).not.toHaveProperty('phone')
  })

  it('confirms a successful save', async () => {
    mockUpdate.mockResolvedValue(makeUser({ firstName: 'Grace' }))
    renderPage()

    fireEvent.change(await screen.findByLabelText('First name'), { target: { value: 'Grace' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Profile saved.')).toBeInTheDocument()
  })

  it('surfaces a save failure inline', async () => {
    mockUpdate.mockRejectedValue(new apiClient.ApiError(400, 'phoneNumber contains unsupported characters.'))
    renderPage()

    fireEvent.change(await screen.findByLabelText('Phone number (optional)'), {
      target: { value: '!!!' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(
      await screen.findByText('phoneNumber contains unsupported characters.'),
    ).toBeInTheDocument()
  })

  // ------------------------------------------------------- Avatar (AC-F8)

  it('uploads an avatar and re-renders from the response without a reload (AC-F8)', async () => {
    const file = fakeFile('me.png', 'image/png', 1024)
    mockUpload.mockResolvedValue(
      makeUser({ profilePictureUrl: 'https://cdn.example.com/avatars/u1/abc.png' }),
    )
    renderPage()

    const input = await screen.findByLabelText('Profile picture')
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(mockUpload).toHaveBeenCalledWith(file))
    const img = await screen.findByAltText<HTMLImageElement>('Your profile picture')
    // Rendered from the response body — the URL is never constructed client-side.
    expect(img.src).toBe('https://cdn.example.com/avatars/u1/abc.png')
  })

  it('renders a server 400 (bad type / failed sniff) inline (AC-F8)', async () => {
    const file = fakeFile('evil.png', 'image/png', 1024)
    mockUpload.mockRejectedValue(
      new apiClient.ApiError(400, 'Avatar must be a JPEG, PNG or WEBP image.'),
    )
    renderPage()

    fireEvent.change(await screen.findByLabelText('Profile picture'), {
      target: { files: [file] },
    })

    expect(await screen.findByText('Avatar must be a JPEG, PNG or WEBP image.')).toBeInTheDocument()
  })

  it('maps a 502 (storage unreachable) to its own message (AC-F8)', async () => {
    const file = fakeFile('me.png', 'image/png', 1024)
    mockUpload.mockRejectedValue(new apiClient.ApiError(502, 'Bad Gateway'))
    renderPage()

    fireEvent.change(await screen.findByLabelText('Profile picture'), {
      target: { files: [file] },
    })

    expect(
      await screen.findByText('Image storage is unavailable right now. Please try again in a moment.'),
    ).toBeInTheDocument()
  })

  it('rejects an oversized file client-side without calling the API (AC-F8)', async () => {
    const file = fakeFile('huge.png', 'image/png', 2 * 1024 * 1024 + 1)
    renderPage()

    fireEvent.change(await screen.findByLabelText('Profile picture'), {
      target: { files: [file] },
    })

    expect(
      await screen.findByText('That image is larger than 2 MB. Please choose a smaller one.'),
    ).toBeInTheDocument()
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('accepts a file of EXACTLY 2 MiB — the backend limit is exclusive (AC-F8)', async () => {
    const file = fakeFile('exact.png', 'image/png', 2 * 1024 * 1024)
    mockUpload.mockResolvedValue(makeUser({ profilePictureUrl: 'https://cdn.example.com/a.png' }))
    renderPage()

    fireEvent.change(await screen.findByLabelText('Profile picture'), {
      target: { files: [file] },
    })

    // The pre-check must be `> 2 MiB`, not `>=`, or it would refuse a file the
    // server would have accepted.
    await waitFor(() => expect(mockUpload).toHaveBeenCalledWith(file))
  })

  it('rejects an unsupported type client-side without calling the API (AC-F8)', async () => {
    const file = fakeFile('doc.pdf', 'application/pdf', 1024)
    renderPage()

    fireEvent.change(await screen.findByLabelText('Profile picture'), {
      target: { files: [file] },
    })

    expect(
      await screen.findByText('Unsupported image type. Please choose a JPEG, PNG or WEBP file.'),
    ).toBeInTheDocument()
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('shows a pending state while the upload is in flight (AC-F8)', async () => {
    const file = fakeFile('me.png', 'image/png', 1024)
    mockUpload.mockReturnValue(new Promise(() => {}))
    renderPage()

    fireEvent.change(await screen.findByLabelText('Profile picture'), {
      target: { files: [file] },
    })

    expect(await screen.findByText('Uploading…')).toBeInTheDocument()
  })
})
