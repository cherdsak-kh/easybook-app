import { useEffect, useRef } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { ProfilePage } from '@/pages/admin/ProfilePage'
import { UI_STRINGS } from '@/constants/ui-strings-backend'
import * as apiClient from '@/lib/api-client'
import * as cropImage from '@/lib/crop-image'
import type { SystemUser } from '@/lib/api-client'

const UI = UI_STRINGS.profile
const CROP = UI_STRINGS.profile.avatarCrop

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

/**
 * jsdom has no canvas 2D context and decodes no images, so the real crop→Blob
 * path cannot run here. Mocking it at the import boundary (the repo's
 * `vi.mock('@/lib/...')` convention) is exactly why that logic lives in its own
 * module: it leaves the COMPONENT's behaviour — dialog opens, confirm uploads
 * the returned file, errors render — fully assertable.
 */
vi.mock('@/lib/crop-image', () => {
  class CropError extends Error {
    reason: string
    constructor(reason: string, message: string) {
      super(message)
      this.name = 'CropError'
      this.reason = reason
    }
  }
  return { CropError, cropImageToFile: vi.fn() }
})

/**
 * The real cropper reports its selection only after the image loads and its
 * container is measured — neither happens in jsdom, so `onCropComplete` would
 * never fire and Confirm would stay disabled forever. This stand-in reports a
 * fixed selection once on mount.
 */
const CROPPED_AREA = { x: 10, y: 20, width: 300, height: 300 }

vi.mock('react-easy-crop', () => {
  // Named (not an inline arrow) so it reads as a component to rules-of-hooks.
  function CropperStub({
    onCropComplete,
  }: {
    onCropComplete: (area: unknown, areaPixels: typeof CROPPED_AREA) => void
  }) {
    // Held in a ref so the one-shot effect never re-fires on the parent's
    // inline-arrow identity change (which would loop through setState).
    const cb = useRef(onCropComplete)
    cb.current = onCropComplete
    useEffect(() => {
      cb.current({ x: 0, y: 0, width: 100, height: 100 }, CROPPED_AREA)
    }, [])
    return <div data-testid="cropper" />
  }
  return { default: CropperStub }
})

const mockGetMe = vi.mocked(apiClient.getMe)
const mockUpdate = vi.mocked(apiClient.updateOwnProfile)
const mockUpload = vi.mocked(apiClient.uploadOwnAvatar)
const mockCrop = vi.mocked(cropImage.cropImageToFile)

/** What the crop module hands back: already square, JPEG, and size-checked. */
function croppedFile(): File {
  return new File(['cropped-jpeg-bytes'], 'avatar.jpg', { type: 'image/jpeg' })
}

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
  mockCrop.mockResolvedValue(croppedFile())
})

/** Pick a file, then confirm the crop — the only route to an upload now. */
async function pickAndConfirm(file: File) {
  fireEvent.change(await screen.findByLabelText(UI.avatarLabel), { target: { files: [file] } })
  const confirm = await screen.findByRole('button', { name: CROP.confirm })
  await waitFor(() => expect(confirm).toBeEnabled())
  fireEvent.click(confirm)
}

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

  it('uploads the CROPPED file and re-renders from the response without a reload (AC-F8)', async () => {
    const file = fakeFile('me.png', 'image/png', 1024)
    const cropped = croppedFile()
    mockCrop.mockResolvedValue(cropped)
    mockUpload.mockResolvedValue(
      makeUser({ profilePictureUrl: 'https://cdn.example.com/avatars/u1/abc.png' }),
    )
    renderPage()

    await pickAndConfirm(file)

    // The CROPPED file goes to the wire, never the original the user picked.
    //
    // `toBe`, NOT `toHaveBeenCalledWith`: vitest deep-compares by enumerable own
    // properties, and a File has none — so every File matches every other File
    // and `toHaveBeenCalledWith(cropped)` would pass even when the ORIGINAL was
    // uploaded. Reference identity is the only assertion with teeth here.
    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1))
    expect(mockUpload.mock.calls[0][0]).toBe(cropped)
    expect(mockUpload.mock.calls[0][0]).not.toBe(file)

    const img = await screen.findByAltText<HTMLImageElement>(UI.avatarAlt)
    // Rendered from the response body — the URL is never constructed client-side.
    expect(img.src).toBe('https://cdn.example.com/avatars/u1/abc.png')
  })

  it('crops against the backend size limit, from the cropper selection (AC-F8)', async () => {
    renderPage()
    await pickAndConfirm(fakeFile('me.png', 'image/png', 1024))

    await waitFor(() => expect(mockCrop).toHaveBeenCalledTimes(1))
    const [, area, options] = mockCrop.mock.calls[0]
    // The region the cropper reported — not the whole image.
    expect(area).toEqual(CROPPED_AREA)
    // Bounded by the SAME limit the server enforces, so the two cannot drift.
    expect(options.maxBytes).toBe(apiClient.AVATAR_MAX_BYTES)
  })

  it('renders a server 400 (bad type / failed sniff) inline (AC-F8)', async () => {
    const file = fakeFile('evil.png', 'image/png', 1024)
    mockUpload.mockRejectedValue(
      new apiClient.ApiError(400, 'Avatar must be a JPEG, PNG or WEBP image.'),
    )
    renderPage()

    await pickAndConfirm(file)

    // Literal on purpose: the SERVER's sniff-failure message, surfaced verbatim
    // rather than replaced by the canned `avatarRejected` fallback.
    expect(await screen.findByText('Avatar must be a JPEG, PNG or WEBP image.')).toBeInTheDocument()
    expect(screen.queryByText(UI.avatarRejected)).not.toBeInTheDocument()
  })

  it('maps a 502 (storage unreachable) to its own message (AC-F8)', async () => {
    const file = fakeFile('me.png', 'image/png', 1024)
    mockUpload.mockRejectedValue(new apiClient.ApiError(502, 'Bad Gateway'))
    renderPage()

    await pickAndConfirm(file)

    // A 502 gets its own branch — never the raw 'Bad Gateway' and never the
    // generic upload-failed message.
    expect(await screen.findByText(UI.avatarStorageDown)).toBeInTheDocument()
    expect(screen.queryByText('Bad Gateway')).not.toBeInTheDocument()
    expect(screen.queryByText(UI.avatarUploadFailed)).not.toBeInTheDocument()
  })

  it('rejects an oversized file client-side without cropping or calling the API (AC-F8)', async () => {
    const file = fakeFile('huge.png', 'image/png', 2 * 1024 * 1024 + 1)
    renderPage()

    fireEvent.change(await screen.findByLabelText(UI.avatarLabel), {
      target: { files: [file] },
    })

    expect(await screen.findByText(UI.avatarTooLarge)).toBeInTheDocument()
    expect(mockUpload).not.toHaveBeenCalled()
    // Rejected at the door: no point opening a cropper for a file that cannot
    // be sent.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mockCrop).not.toHaveBeenCalled()
  })

  it('accepts a file of EXACTLY 2 MiB — the backend limit is exclusive (AC-F8)', async () => {
    const file = fakeFile('exact.png', 'image/png', 2 * 1024 * 1024)
    const cropped = croppedFile()
    mockCrop.mockResolvedValue(cropped)
    mockUpload.mockResolvedValue(makeUser({ profilePictureUrl: 'https://cdn.example.com/a.png' }))
    renderPage()

    await pickAndConfirm(file)

    // The pre-check must be `> 2 MiB`, not `>=`, or it would refuse a file the
    // server would have accepted. Identity again — see the note above.
    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1))
    expect(mockUpload.mock.calls[0][0]).toBe(cropped)
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
    expect(mockCrop).not.toHaveBeenCalled()
  })

  it('shows a pending state while the upload is in flight (AC-F8)', async () => {
    const file = fakeFile('me.png', 'image/png', 1024)
    mockUpload.mockReturnValue(new Promise(() => {}))
    renderPage()

    await pickAndConfirm(file)

    expect(await screen.findByText(UI.avatarUploading)).toBeInTheDocument()
  })

  // --------------------------------------------------- Crop dialog (Task 3)

  it('opens the 1:1 crop dialog on file select instead of uploading straight away', async () => {
    const file = fakeFile('me.png', 'image/png', 1024)
    renderPage()

    fireEvent.change(await screen.findByLabelText(UI.avatarLabel), { target: { files: [file] } })

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: CROP.title })).toBeInTheDocument()
    // Picking is NOT confirming: nothing is cropped or sent until they say so.
    expect(mockCrop).not.toHaveBeenCalled()
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('cancelling the crop dialog uploads nothing', async () => {
    const file = fakeFile('me.png', 'image/png', 1024)
    renderPage()

    fireEvent.change(await screen.findByLabelText(UI.avatarLabel), { target: { files: [file] } })
    fireEvent.click(await screen.findByRole('button', { name: UI_STRINGS.common.cancel }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(mockCrop).not.toHaveBeenCalled()
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('closes the crop dialog once the crop is confirmed', async () => {
    mockUpload.mockResolvedValue(makeUser({ profilePictureUrl: 'https://cdn.example.com/a.jpg' }))
    renderPage()

    await pickAndConfirm(fakeFile('me.png', 'image/png', 1024))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('surfaces an oversize-AFTER-crop result in the dialog and uploads nothing (AC-F8)', async () => {
    // The pre-check passed on the ORIGINAL, but re-encoding can grow a file past
    // 2 MiB — the quality ladder bottomed out and still overshot.
    mockCrop.mockRejectedValue(
      new cropImage.CropError('too-large', 'The cropped image is still over the size limit.'),
    )
    renderPage()

    await pickAndConfirm(fakeFile('me.png', 'image/png', 1024))

    expect(await screen.findByText(CROP.stillTooLarge)).toBeInTheDocument()
    // Never fire a request that is a guaranteed 400...
    expect(mockUpload).not.toHaveBeenCalled()
    // ...and keep the dialog open, because zooming in is the fix and the zoom
    // control lives inside it.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText(CROP.zoom)).toBeInTheDocument()
  })

  it('surfaces a failed crop (undecodable image) in the dialog (AC-F8)', async () => {
    mockCrop.mockRejectedValue(new cropImage.CropError('decode', 'nope'))
    renderPage()

    await pickAndConfirm(fakeFile('me.png', 'image/png', 1024))

    // A decode failure is a different message from the size failure: a different
    // action fixes each.
    expect(await screen.findByText(CROP.failed)).toBeInTheDocument()
    expect(screen.queryByText(CROP.stillTooLarge)).not.toBeInTheDocument()
    expect(mockUpload).not.toHaveBeenCalled()
  })
})
