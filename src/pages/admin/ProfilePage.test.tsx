import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { ProfilePage } from '@/pages/admin/ProfilePage'
import { UI_STRINGS } from '@/constants/ui-strings'
import * as apiClient from '@/lib/api-client'
import type { SystemUser } from '@/lib/api-client'

const UI = UI_STRINGS.profile

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

    expect(await screen.findByText(UI.loadFailed)).toBeInTheDocument()

    mockGetMe.mockResolvedValue(makeUser())
    // Counted relative to the calls already made (AuthProvider probes /me on
    // mount too), so this asserts the retry genuinely re-issues the request
    // rather than just re-rendering stale state.
    const before = mockGetMe.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: UI_STRINGS.common.tryAgain }))
    expect(await screen.findByLabelText(UI.firstName)).toBeInTheDocument()
    expect(mockGetMe.mock.calls.length).toBeGreaterThan(before)
  })

  // ------------------------------------------------------------------- AC-F7

  it('renders role, Position and department READ-ONLY with a managed-by note (AC-F7)', async () => {
    renderPage()
    await screen.findByLabelText(UI.firstName)

    // Present as values. `Teacher`/`Computer Science` stay literal on purpose:
    // they are FIXTURE data flowing out of the `/me` embed, not UI copy — the
    // assertion is that the resolved embed renders, which a dictionary constant
    // would not express.
    expect(screen.getByText('Teacher')).toBeInTheDocument()
    expect(screen.getByText('Computer Science')).toBeInTheDocument()
    // The wire role `ADMIN` maps through the label table to its display name.
    expect(screen.getByText(UI_STRINGS.roles.ADMIN)).toBeInTheDocument()
    expect(screen.getByText(UI.managedNote, { exact: false })).toBeInTheDocument()

    // ...but not as editable form controls. The self-edit DTO has no such
    // fields, so there must be nothing to type into.
    expect(screen.queryByLabelText(UI.role)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(UI.position)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(UI.department)).not.toBeInTheDocument()
  })

  it('PATCHes ONLY the self-editable fields — never role/department/personnelRole (AC-F7)', async () => {
    mockUpdate.mockResolvedValue(makeUser({ firstName: 'Grace' }))
    renderPage()

    fireEvent.change(await screen.findByLabelText(UI.firstName), { target: { value: 'Grace' } })
    fireEvent.click(screen.getByRole('button', { name: UI.saveChanges }))

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

    fireEvent.change(await screen.findByLabelText(UI.phoneNumber), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: UI.saveChanges }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
    const body = mockUpdate.mock.calls[0][0]
    expect(body.phoneNumber).toBeNull()
    expect(body).not.toHaveProperty('phone')
  })

  it('confirms a successful save', async () => {
    mockUpdate.mockResolvedValue(makeUser({ firstName: 'Grace' }))
    renderPage()

    fireEvent.change(await screen.findByLabelText(UI.firstName), { target: { value: 'Grace' } })
    fireEvent.click(screen.getByRole('button', { name: UI.saveChanges }))

    expect(await screen.findByText(UI.saved)).toBeInTheDocument()
  })

  it('surfaces a save failure inline', async () => {
    mockUpdate.mockRejectedValue(new apiClient.ApiError(400, 'phoneNumber contains unsupported characters.'))
    renderPage()

    fireEvent.change(await screen.findByLabelText(UI.phoneNumber), {
      target: { value: '!!!' },
    })
    fireEvent.click(screen.getByRole('button', { name: UI.saveChanges }))

    // Literal on purpose: the SERVER's 400 message, proving it is rendered
    // verbatim instead of being replaced by the canned `saveInvalid` fallback.
    expect(
      await screen.findByText('phoneNumber contains unsupported characters.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(UI.saveInvalid)).not.toBeInTheDocument()
    // A failed save must not claim success.
    expect(screen.queryByText(UI.saved)).not.toBeInTheDocument()
  })

  // ------------------------------------------------------- Avatar (AC-F8)

  it('uploads an avatar and re-renders from the response without a reload (AC-F8)', async () => {
    const file = fakeFile('me.png', 'image/png', 1024)
    mockUpload.mockResolvedValue(
      makeUser({ profilePictureUrl: 'https://cdn.example.com/avatars/u1/abc.png' }),
    )
    renderPage()

    const input = await screen.findByLabelText(UI.avatarLabel)
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(mockUpload).toHaveBeenCalledWith(file))
    const img = await screen.findByAltText<HTMLImageElement>(UI.avatarAlt)
    // Rendered from the response body — the URL is never constructed client-side.
    expect(img.src).toBe('https://cdn.example.com/avatars/u1/abc.png')
  })

  it('renders a server 400 (bad type / failed sniff) inline (AC-F8)', async () => {
    const file = fakeFile('evil.png', 'image/png', 1024)
    mockUpload.mockRejectedValue(
      new apiClient.ApiError(400, 'Avatar must be a JPEG, PNG or WEBP image.'),
    )
    renderPage()

    fireEvent.change(await screen.findByLabelText(UI.avatarLabel), {
      target: { files: [file] },
    })

    // Literal on purpose: the SERVER's sniff-failure message, surfaced verbatim
    // rather than replaced by the canned `avatarRejected` fallback.
    expect(await screen.findByText('Avatar must be a JPEG, PNG or WEBP image.')).toBeInTheDocument()
    expect(screen.queryByText(UI.avatarRejected)).not.toBeInTheDocument()
  })

  it('maps a 502 (storage unreachable) to its own message (AC-F8)', async () => {
    const file = fakeFile('me.png', 'image/png', 1024)
    mockUpload.mockRejectedValue(new apiClient.ApiError(502, 'Bad Gateway'))
    renderPage()

    fireEvent.change(await screen.findByLabelText(UI.avatarLabel), {
      target: { files: [file] },
    })

    // A 502 gets its own branch — never the raw 'Bad Gateway' and never the
    // generic upload-failed message.
    expect(await screen.findByText(UI.avatarStorageDown)).toBeInTheDocument()
    expect(screen.queryByText('Bad Gateway')).not.toBeInTheDocument()
    expect(screen.queryByText(UI.avatarUploadFailed)).not.toBeInTheDocument()
  })

  it('rejects an oversized file client-side without calling the API (AC-F8)', async () => {
    const file = fakeFile('huge.png', 'image/png', 2 * 1024 * 1024 + 1)
    renderPage()

    fireEvent.change(await screen.findByLabelText(UI.avatarLabel), {
      target: { files: [file] },
    })

    expect(await screen.findByText(UI.avatarTooLarge)).toBeInTheDocument()
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('accepts a file of EXACTLY 2 MiB — the backend limit is exclusive (AC-F8)', async () => {
    const file = fakeFile('exact.png', 'image/png', 2 * 1024 * 1024)
    mockUpload.mockResolvedValue(makeUser({ profilePictureUrl: 'https://cdn.example.com/a.png' }))
    renderPage()

    fireEvent.change(await screen.findByLabelText(UI.avatarLabel), {
      target: { files: [file] },
    })

    // The pre-check must be `> 2 MiB`, not `>=`, or it would refuse a file the
    // server would have accepted.
    await waitFor(() => expect(mockUpload).toHaveBeenCalledWith(file))
    expect(screen.queryByText(UI.avatarTooLarge)).not.toBeInTheDocument()
  })

  it('rejects an unsupported type client-side without calling the API (AC-F8)', async () => {
    const file = fakeFile('doc.pdf', 'application/pdf', 1024)
    renderPage()

    fireEvent.change(await screen.findByLabelText(UI.avatarLabel), {
      target: { files: [file] },
    })

    expect(await screen.findByText(UI.avatarBadType)).toBeInTheDocument()
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('shows a pending state while the upload is in flight (AC-F8)', async () => {
    const file = fakeFile('me.png', 'image/png', 1024)
    mockUpload.mockReturnValue(new Promise(() => {}))
    renderPage()

    fireEvent.change(await screen.findByLabelText(UI.avatarLabel), {
      target: { files: [file] },
    })

    expect(await screen.findByText(UI.avatarUploading)).toBeInTheDocument()
  })
})
