import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { AuthProvider } from '@/auth/AuthProvider'
import { AdminPortalProfilePage } from '@/pages/admin-portal/AdminPortalProfilePage'
import {
  PROFILE_STRINGS,
  type BilingualLabel,
} from '@/constants/ui-strings-profile'
import { formatThaiDateTime } from '@/lib/format-th-datetime'
import * as apiClient from '@/lib/api-client'
import {
  ApiError,
  AVATAR_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  type Department,
  type PersonnelRole,
  type SystemRole,
  type SystemUser,
} from '@/lib/api-client'
import { makeSystemUser } from '@/test/system-user-factory'

const T = PROFILE_STRINGS

/** Copy is NEVER hardcoded here — every query derives from the strings module. */
const labelOf = (l: BilingualLabel) => `${l.th} (${l.en})`

// --- Mocks: the api-client boundary, never `fetch` ---------------------------
vi.mock('@/lib/api-client', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/api-client')>()
  return {
    ...actual,
    getMe: vi.fn(),
    getOwnProfile: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    updateOwnProfile: vi.fn(),
    patchSystemUser: vi.fn(),
    changeOwnPassword: vi.fn(),
    uploadOwnAvatar: vi.fn(),
    listDepartments: vi.fn(),
    listPersonnelRoles: vi.fn(),
  }
})

// The canvas pipeline (`croppedAreaPixels` → canvas → Blob → File) needs a real 2D
// context, which jsdom does not implement — mock the module, not the browser.
vi.mock('@/lib/crop-image', () => ({
  cropImageToFile: vi.fn(),
  croppedFileName: (name: string) => `${name}.jpg`,
}))

// `react-easy-crop` measures the DOM. Stub it, capture the props the page passes
// (so the 1:1 aspect is assertable) and expose a way to emit `onCropComplete`.
const cropSpy = vi.hoisted(() => ({ aspect: 0, complete: null as null | (() => void) }))
vi.mock('react-easy-crop', () => ({
  default: (props: {
    aspect: number
    onCropComplete?: (a: unknown, b: unknown) => void
  }) => {
    cropSpy.aspect = props.aspect
    const area = { x: 0, y: 0, width: 200, height: 200 }
    cropSpy.complete = () => props.onCropComplete?.(area, area)
    return <div data-testid="mock-cropper" />
  },
}))

const cropImage = await import('@/lib/crop-image')
const mockCropImageToFile = vi.mocked(cropImage.cropImageToFile)

const mockGetMe = vi.mocked(apiClient.getMe)
const mockGetOwnProfile = vi.mocked(apiClient.getOwnProfile)
const mockUpdateOwnProfile = vi.mocked(apiClient.updateOwnProfile)
const mockPatchSystemUser = vi.mocked(apiClient.patchSystemUser)
const mockChangeOwnPassword = vi.mocked(apiClient.changeOwnPassword)
const mockUploadOwnAvatar = vi.mocked(apiClient.uploadOwnAvatar)
const mockListDepartments = vi.mocked(apiClient.listDepartments)
const mockListPersonnelRoles = vi.mocked(apiClient.listPersonnelRoles)

// jsdom implements <dialog> in recent versions; shim ONLY what is missing so the suite
// stays robust across jsdom versions without clobbering native behaviour.
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
  // Selecting a file creates an object URL; jsdom has neither method.
  URL.createObjectURL = vi.fn(() => 'blob:mock-avatar')
  URL.revokeObjectURL = vi.fn()
})

function dept(o: Partial<Department> = {}): Department {
  return {
    id: 2,
    name: 'CS',
    isSystemReserved: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...o,
  }
}

function personnelRole(o: Partial<PersonnelRole> = {}): PersonnelRole {
  return {
    id: 1,
    name: 'Director',
    isSystemReserved: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...o,
  }
}

/** Render the page inside the REAL AuthProvider (only the api-client is mocked). */
async function renderProfile(user: SystemUser | null = makeSystemUser()) {
  if (user) mockGetOwnProfile.mockResolvedValue(user)
  mockGetMe.mockResolvedValue(user)
  const view = render(
    <AuthProvider>
      <AdminPortalProfilePage />
    </AuthProvider>,
  )
  if (user) await screen.findByRole('heading', { name: new RegExp(T.cards.account.en) })
  return view
}

function forRole(role: SystemRole, o: Partial<SystemUser> = {}) {
  return makeSystemUser({ role, ...o })
}

/** Enter edit mode and wait for the option lists the dept/position selects need. */
async function enterEdit() {
  fireEvent.click(screen.getByRole('button', { name: T.actions.edit }))
  await waitFor(() => expect(mockListDepartments).toHaveBeenCalled())
  await screen.findByRole('button', { name: T.actions.save })
}

beforeEach(() => {
  vi.clearAllMocks()
  cropSpy.aspect = 0
  cropSpy.complete = null
  mockListDepartments.mockResolvedValue([dept(), dept({ id: 3, name: 'Maths' })])
  mockListPersonnelRoles.mockResolvedValue([
    personnelRole(),
    personnelRole({ id: 4, name: 'Manager' }),
  ])
})

// ---------------------------------------------------------------------------
describe('AdminPortalProfilePage — sidebar wiring', () => {
  it('exposes exactly ONE Profile leaf, pointing at the real page (no stub duplicate)', async () => {
    const { ADMIN_PORTAL_ROUTES, ADMIN_PORTAL_STUB_ROUTES } = await import(
      '@/components/admin-portal/routes'
    )
    const { NAV_ITEMS, isSubmenu } = await import('@/components/admin-portal/nav-config')

    const leaves = NAV_ITEMS.flatMap((e) => (isSubmenu(e) ? e.submenu : [e]))
    const profileLeaves = leaves.filter((l) => l.label === 'Profile')

    expect(profileLeaves).toHaveLength(1)
    expect(profileLeaves[0].to).toBe(ADMIN_PORTAL_ROUTES.profile)
    expect(ADMIN_PORTAL_ROUTES.profile).toBe('/admin-portal/profile')
    // The DashWind `settings-profile` placeholder is gone, so it cannot re-appear
    // as a second "Profile" entry.
    expect(ADMIN_PORTAL_STUB_ROUTES.map((s) => s.segment)).not.toContain('settings-profile')
    expect(ADMIN_PORTAL_STUB_ROUTES.map((s) => s.title)).not.toContain('Profile')
  })
})

// ---------------------------------------------------------------------------
describe('AdminPortalProfilePage — load states', () => {
  it('shows a skeleton while the profile is in flight, then the real cards', async () => {
    let resolveMe: (u: SystemUser) => void = () => {}
    mockGetMe.mockResolvedValue(null)
    mockGetOwnProfile.mockReturnValue(
      new Promise<SystemUser>((resolve) => {
        resolveMe = resolve
      }),
    )

    render(
      <AuthProvider>
        <AdminPortalProfilePage />
      </AuthProvider>,
    )

    expect(screen.getByText(T.loading)).toBeInTheDocument()

    await act(async () => {
      resolveMe(makeSystemUser())
    })

    expect(screen.queryByText(T.loading)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: new RegExp(T.cards.account.en) })).toBeInTheDocument()
  })

  it('renders an error with a retry that refetches — never a silent no-op', async () => {
    mockGetMe.mockResolvedValue(null)
    mockGetOwnProfile.mockRejectedValueOnce(new ApiError(500, 'boom'))

    render(
      <AuthProvider>
        <AdminPortalProfilePage />
      </AuthProvider>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(T.loadFailed)

    mockGetOwnProfile.mockResolvedValue(makeSystemUser())
    fireEvent.click(screen.getByRole('button', { name: T.retry }))

    expect(
      await screen.findByRole('heading', { name: new RegExp(T.cards.account.en) }),
    ).toBeInTheDocument()
    expect(mockGetOwnProfile).toHaveBeenCalledTimes(2)
  })

  it('treats a 401 on load as session death, not as a page error', async () => {
    mockGetMe.mockResolvedValue(makeSystemUser())
    mockGetOwnProfile.mockRejectedValue(new ApiError(401, 'dead'))

    render(
      <AuthProvider>
        <AdminPortalProfilePage />
      </AuthProvider>,
    )

    // No inline load-failure copy: `expireSession()` fired and the route guard owns
    // the redirect (there is no router in this harness, hence no assertion on it).
    await waitFor(() => expect(mockGetOwnProfile).toHaveBeenCalled())
    expect(screen.queryByText(T.loadFailed)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
describe('AdminPortalProfilePage — rendering', () => {
  it('renders the name, id, email and role badge', async () => {
    await renderProfile(makeSystemUser({ id: 'clx-abc', email: 'ada@easybook.local' }))

    expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument()
    expect(screen.getByText(`${T.idPrefix} clx-abc`)).toBeInTheDocument()
    expect(screen.getByText('ada@easybook.local')).toBeInTheDocument()
    expect(screen.getAllByText('ADMIN').length).toBeGreaterThan(0)
  })

  it('renders department and position by NAME, never by id', async () => {
    await renderProfile(
      makeSystemUser({
        department: { id: 7, name: 'IT Department' },
        personnelRole: { id: 5, name: 'Director' },
      }),
    )

    expect(screen.getByLabelText(labelOf(T.fields.department))).toHaveDisplayValue(
      'IT Department',
    )
    expect(screen.getByLabelText(labelOf(T.fields.position))).toHaveDisplayValue('Director')
    // The prototypes' "7 (IT Department)" placeholder shorthand must not ship.
    expect(screen.queryByText(/7 \(IT Department\)/)).not.toBeInTheDocument()
  })

  it('renders the initials fallback and emits no <img> when there is no avatar', async () => {
    const { container } = await renderProfile(makeSystemUser({ profilePictureUrl: null }))

    expect(screen.getByText('AL')).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })

  it('never renders the prototypes’ developer scaffolding subtitle', async () => {
    const { container } = await renderProfile()

    expect(container.textContent).not.toMatch(/Excluded:/i)
    expect(container.textContent).not.toMatch(/passwordHash/i)
  })

  it('ships no hard-coded LINE-green or `dark:` classes', async () => {
    const { container } = await renderProfile()
    const markup = container.innerHTML

    expect(markup).not.toContain('#00B900')
    expect(markup).not.toContain('#009900')
    expect(markup).not.toMatch(/\bdark:/)
  })

  it('shows the LINE row as an explicitly disabled "coming soon" affordance', async () => {
    await renderProfile(makeSystemUser({ lineUserId: null }))

    const connect = screen.getByRole('button', { name: T.line.connect })
    expect(connect).toBeDisabled()
    expect(connect).toHaveAttribute('title', T.line.comingSoonHint)
    expect(screen.getByText(T.line.comingSoon)).toBeInTheDocument()
    expect(screen.getByText(T.line.notLinked)).toBeInTheDocument()
  })

  it('shows the linked state (masked, never the full id) when lineUserId is set', async () => {
    await renderProfile(makeSystemUser({ lineUserId: 'clx9z8y7x6w5v4u3t2s1r0q9' }))

    expect(screen.getByText(T.line.linked)).toBeInTheDocument()
    expect(screen.queryByText('clx9z8y7x6w5v4u3t2s1r0q9')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: T.line.connect })).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
describe('AdminPortalProfilePage — audit trail', () => {
  it('renders all four rows for an ADMIN', async () => {
    const user = makeSystemUser({
      createdBy: { id: 'u0', firstName: 'Somsri', lastName: 'Systemadmin' },
      createdAt: '2026-01-15T09:00:00.000Z',
      updatedAt: '2026-07-26T14:30:00.000Z',
      lastLoginAt: '2026-07-26T15:00:00.000Z',
    })
    await renderProfile(user)

    const card = screen
      .getByRole('heading', { name: new RegExp(T.cards.audit.en) })
      .closest('section') as HTMLElement
    expect(within(card).getByText('Somsri Systemadmin')).toBeInTheDocument()
    expect(
      within(card).getByText(formatThaiDateTime(user.createdAt, T.emptyValue)),
    ).toBeInTheDocument()
    expect(
      within(card).getByText(formatThaiDateTime(user.updatedAt, T.emptyValue)),
    ).toBeInTheDocument()
    expect(
      within(card).getByText(formatThaiDateTime(user.lastLoginAt, T.emptyValue)),
    ).toBeInTheDocument()
  })

  it('falls back for a NULL createdBy (the seeded first SUPER_ADMIN) without throwing', async () => {
    await renderProfile(forRole('SUPER_ADMIN', { createdBy: null }))

    const card = screen
      .getByRole('heading', { name: new RegExp(T.cards.audit.en) })
      .closest('section') as HTMLElement
    expect(within(card).getByText(T.createdBySystem)).toBeInTheDocument()
  })

  it('renders the placeholder for a null lastLoginAt, never "Invalid Date"', async () => {
    const { container } = await renderProfile(makeSystemUser({ lastLoginAt: null }))

    const card = screen
      .getByRole('heading', { name: new RegExp(T.cards.audit.en) })
      .closest('section') as HTMLElement
    expect(within(card).getByText(T.emptyValue)).toBeInTheDocument()
    expect(container.textContent).not.toContain('Invalid Date')
  })
})

// ---------------------------------------------------------------------------
describe('AdminPortalProfilePage — role matrix', () => {
  it.each<[SystemRole]>([['SUPER_ADMIN'], ['ADMIN']])(
    '%s sees the edit button, the audit card and the change-password button',
    async (role) => {
      await renderProfile(forRole(role))

      expect(screen.getByRole('button', { name: T.actions.edit })).toBeInTheDocument()
      expect(
        screen.getByRole('heading', { name: new RegExp(T.cards.audit.en) }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: T.actions.changePassword }),
      ).toBeInTheDocument()
    },
  )

  it('STAFF gets no edit button, no cancel, no audit card and NO editable input at all', async () => {
    await renderProfile(forRole('STAFF', { phoneNumber: '0812345678' }))

    expect(screen.queryByRole('button', { name: T.actions.edit })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: T.actions.cancel })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: new RegExp(T.cards.audit.en) }),
    ).not.toBeInTheDocument()
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(screen.queryAllByRole('combobox')).toHaveLength(0)
    // …but the values are still shown as text.
    expect(screen.getByText('0812345678')).toBeInTheDocument()
    expect(screen.getByText('CS')).toBeInTheDocument()
  })

  it('STAFF KEEPS the change-password button (this app has no force-reset screen)', async () => {
    await renderProfile(forRole('STAFF'))

    expect(screen.getByRole('button', { name: T.actions.changePassword })).toBeInTheDocument()
  })

  it('STAFF can still change their avatar', async () => {
    await renderProfile(forRole('STAFF'))

    expect(screen.getByRole('button', { name: T.actions.changeAvatar })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
describe('AdminPortalProfilePage — edit mode', () => {
  it('view mode keeps the personal fields read-only', async () => {
    await renderProfile()

    expect(screen.getByLabelText(labelOf(T.fields.firstName))).toHaveAttribute('readonly')
    expect(screen.getByLabelText(labelOf(T.fields.department))).toBeDisabled()
  })

  it('entering edit makes the fields writable and swaps the primary action', async () => {
    await renderProfile()
    await enterEdit()

    expect(screen.getByLabelText(labelOf(T.fields.firstName))).not.toHaveAttribute('readonly')
    expect(screen.getByLabelText(labelOf(T.fields.department))).toBeEnabled()
    expect(screen.queryByRole('button', { name: T.actions.edit })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: T.actions.cancel })).toBeInTheDocument()
  })

  it('cancel restores the original values and calls NO endpoint', async () => {
    await renderProfile()
    await enterEdit()

    const firstName = screen.getByLabelText(labelOf(T.fields.firstName))
    fireEvent.change(firstName, { target: { value: 'Grace' } })
    expect(firstName).toHaveValue('Grace')

    fireEvent.click(screen.getByRole('button', { name: T.actions.cancel }))

    expect(screen.getByLabelText(labelOf(T.fields.firstName))).toHaveValue('Ada')
    expect(screen.getByRole('button', { name: T.actions.edit })).toBeInTheDocument()
    expect(mockUpdateOwnProfile).not.toHaveBeenCalled()
    expect(mockPatchSystemUser).not.toHaveBeenCalled()
  })

  it('the save button opens the confirm dialog WITHOUT calling the API', async () => {
    await renderProfile()
    await enterEdit()
    fireEvent.change(screen.getByLabelText(labelOf(T.fields.firstName)), {
      target: { value: 'Grace' },
    })

    fireEvent.click(screen.getByRole('button', { name: T.actions.save }))

    expect(screen.getByText(T.save.confirmTitle)).toBeVisible()
    expect(mockUpdateOwnProfile).not.toHaveBeenCalled()
  })

  it('confirming saves once, re-renders from the RESPONSE body, and re-probes the session', async () => {
    await renderProfile()
    const getMeCallsBefore = mockGetMe.mock.calls.length
    mockUpdateOwnProfile.mockResolvedValue(makeSystemUser({ firstName: 'Grace' }))

    await enterEdit()
    fireEvent.change(screen.getByLabelText(labelOf(T.fields.firstName)), {
      target: { value: 'Grace' },
    })
    fireEvent.click(screen.getByRole('button', { name: T.actions.save }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: T.actions.confirm }))
    })

    expect(mockUpdateOwnProfile).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('heading', { name: 'Grace Lovelace' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: T.actions.edit })).toBeInTheDocument()
    // `refresh()` re-probes /auth/system/me so the shell header follows.
    expect(mockGetMe.mock.calls.length).toBeGreaterThan(getMeCallsBefore)
  })

  it('a department change goes to PATCH /system-users/:id, not to /auth/system/me', async () => {
    await renderProfile(makeSystemUser({ id: 'me-1' }))
    mockPatchSystemUser.mockResolvedValue(
      makeSystemUser({ id: 'me-1', department: { id: 3, name: 'Maths' } }),
    )

    await enterEdit()
    fireEvent.change(screen.getByLabelText(labelOf(T.fields.department)), {
      target: { value: '3' },
    })
    fireEvent.click(screen.getByRole('button', { name: T.actions.save }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: T.actions.confirm }))
    })

    expect(mockUpdateOwnProfile).not.toHaveBeenCalled()
    expect(mockPatchSystemUser).toHaveBeenCalledWith('me-1', { departmentId: 3 })
  })

  it('a save with no changes issues no request and says so', async () => {
    await renderProfile()
    await enterEdit()

    fireEvent.click(screen.getByRole('button', { name: T.actions.save }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: T.actions.confirm }))
    })

    expect(mockUpdateOwnProfile).not.toHaveBeenCalled()
    expect(mockPatchSystemUser).not.toHaveBeenCalled()
    expect(await screen.findByText(T.save.noChanges)).toBeInTheDocument()
  })

  it('a failed save keeps the draft and shows the error inline', async () => {
    await renderProfile()
    mockUpdateOwnProfile.mockRejectedValue(new ApiError(400, 'bad'))

    await enterEdit()
    fireEvent.change(screen.getByLabelText(labelOf(T.fields.firstName)), {
      target: { value: 'Grace' },
    })
    fireEvent.click(screen.getByRole('button', { name: T.actions.save }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: T.actions.confirm }))
    })

    expect(await screen.findByText(T.save.invalid)).toBeInTheDocument()
    expect(screen.getByLabelText(labelOf(T.fields.firstName))).toHaveValue('Grace')
  })
})

// ---------------------------------------------------------------------------
describe('AdminPortalProfilePage — change password', () => {
  async function openPasswordModal() {
    fireEvent.click(screen.getByRole('button', { name: T.actions.changePassword }))
    await screen.findByLabelText(T.password.current)
  }

  function fillPassword(current: string, next: string, confirm: string) {
    fireEvent.change(screen.getByLabelText(T.password.current), { target: { value: current } })
    fireEvent.change(screen.getByLabelText(T.password.next), { target: { value: next } })
    fireEvent.change(screen.getByLabelText(T.password.confirm), { target: { value: confirm } })
  }

  it('rejects a confirm mismatch client-side with NO request', async () => {
    await renderProfile()
    await openPasswordModal()

    fillPassword('oldpassword12', 'newpassword12', 'newpassword99')
    fireEvent.click(screen.getByRole('button', { name: T.password.submit }))

    expect(await screen.findByText(T.password.mismatch)).toBeInTheDocument()
    expect(mockChangeOwnPassword).not.toHaveBeenCalled()
  })

  it('rejects a too-short new password client-side with NO request', async () => {
    await renderProfile()
    await openPasswordModal()

    fillPassword('oldpassword12', 'short', 'short')
    fireEvent.click(screen.getByRole('button', { name: T.password.submit }))

    expect(
      await screen.findByText(T.password.tooShort(PASSWORD_MIN_LENGTH)),
    ).toBeInTheDocument()
    expect(mockChangeOwnPassword).not.toHaveBeenCalled()
  })

  it('sends EXACTLY (currentPassword, newPassword) — the confirm value is never transmitted', async () => {
    await renderProfile()
    mockChangeOwnPassword.mockResolvedValue(undefined)
    await openPasswordModal()

    fillPassword('oldpassword12', 'newpassword12', 'newpassword12')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: T.password.submit }))
    })

    expect(mockChangeOwnPassword).toHaveBeenCalledTimes(1)
    expect(mockChangeOwnPassword).toHaveBeenCalledWith('oldpassword12', 'newpassword12')
    expect(await screen.findByText(T.password.success)).toBeInTheDocument()
  })

  it('a 400 (wrong current password) renders inline and does NOT end the session', async () => {
    await renderProfile()
    mockChangeOwnPassword.mockRejectedValue(new ApiError(400, 'wrong'))
    await openPasswordModal()

    fillPassword('wrongpassword', 'newpassword12', 'newpassword12')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: T.password.submit }))
    })

    expect(await screen.findByText(T.password.wrongCurrent)).toBeInTheDocument()
    // Still signed in: the profile is still on screen, no session teardown happened.
    expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
describe('AdminPortalProfilePage — avatar crop + upload', () => {
  function makeFile(bytes: number, type: string, name = 'photo.png'): File {
    return new File([new Uint8Array(bytes)], name, { type })
  }

  async function openAvatarModal() {
    fireEvent.click(screen.getByRole('button', { name: T.actions.changeAvatar }))
    await screen.findByLabelText(T.avatar.pickLabel)
  }

  it('opens a 1:1 cropper once a valid file is picked', async () => {
    await renderProfile()
    await openAvatarModal()

    fireEvent.change(screen.getByLabelText(T.avatar.pickLabel), {
      target: { files: [makeFile(1024, 'image/png')] },
    })

    expect(await screen.findByTestId('mock-cropper')).toBeInTheDocument()
    expect(cropSpy.aspect).toBe(1)
  })

  it('rejects an oversize file client-side but ACCEPTS one of exactly AVATAR_MAX_BYTES', async () => {
    await renderProfile()
    await openAvatarModal()
    const input = screen.getByLabelText(T.avatar.pickLabel)

    // `AVATAR_MAX_BYTES + 1` → rejected, no upload, no cropper.
    fireEvent.change(input, {
      target: { files: [makeFile(AVATAR_MAX_BYTES + 1, 'image/png')] },
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(T.avatar.tooLarge(2))
    expect(screen.queryByTestId('mock-cropper')).not.toBeInTheDocument()
    expect(mockUploadOwnAvatar).not.toHaveBeenCalled()

    // Exactly `AVATAR_MAX_BYTES` → accepted (the bound is `>`, never `>=`).
    fireEvent.change(input, {
      target: { files: [makeFile(AVATAR_MAX_BYTES, 'image/png')] },
    })
    expect(await screen.findByTestId('mock-cropper')).toBeInTheDocument()
  })

  it('rejects an unsupported file type client-side', async () => {
    await renderProfile()
    await openAvatarModal()

    fireEvent.change(screen.getByLabelText(T.avatar.pickLabel), {
      target: { files: [makeFile(1024, 'image/gif', 'a.gif')] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(T.avatar.badType)
    expect(mockUploadOwnAvatar).not.toHaveBeenCalled()
  })

  it('uploads a File (not a Blob) and re-renders the avatar from the RESPONSE body', async () => {
    await renderProfile()
    const cropped = new File([new Uint8Array(8)], 'photo.jpg', { type: 'image/jpeg' })
    mockCropImageToFile.mockResolvedValue(cropped)
    mockUploadOwnAvatar.mockResolvedValue(
      makeSystemUser({ profilePictureUrl: 'https://cdn.example.com/new.jpg' }),
    )

    await openAvatarModal()
    fireEvent.change(screen.getByLabelText(T.avatar.pickLabel), {
      target: { files: [makeFile(1024, 'image/png')] },
    })
    await screen.findByTestId('mock-cropper')
    act(() => cropSpy.complete?.())

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: T.avatar.submit }))
    })

    expect(mockUploadOwnAvatar).toHaveBeenCalledTimes(1)
    const sent = mockUploadOwnAvatar.mock.calls[0][0]
    expect(sent).toBeInstanceOf(File)
    const img = await screen.findByRole('img')
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/new.jpg')
  })

  it('keeps the modal open and shows the error when the upload fails', async () => {
    await renderProfile()
    mockCropImageToFile.mockResolvedValue(
      new File([new Uint8Array(8)], 'photo.jpg', { type: 'image/jpeg' }),
    )
    mockUploadOwnAvatar.mockRejectedValue(new ApiError(500, 'boom'))

    await openAvatarModal()
    fireEvent.change(screen.getByLabelText(T.avatar.pickLabel), {
      target: { files: [makeFile(1024, 'image/png')] },
    })
    await screen.findByTestId('mock-cropper')
    act(() => cropSpy.complete?.())

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: T.avatar.submit }))
    })

    expect(await screen.findByText(T.avatar.failed)).toBeInTheDocument()
    expect(screen.getByTestId('mock-cropper')).toBeInTheDocument()
  })
})
