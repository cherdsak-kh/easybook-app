import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { AdminPortalProfilePage } from '@/pages/admin-portal/AdminPortalProfilePage'
import { AdminPortalHeader } from '@/components/admin-portal/AdminPortalHeader'
import { AdminPortalThemeLayout } from '@/components/admin-portal/AdminPortalThemeLayout'
import { ToastProvider } from '@/components/admin-portal/ToastProvider'
import {
  PROFILE_STRINGS,
  ROLE_LABEL,
  type BilingualLabel,
} from '@/constants/ui-strings-profile'
import { TOAST_STRINGS } from '@/constants/ui-strings-toast'
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
import { makeSystemUser } from '@tests/helpers/system-user-factory'

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
    holderCount: 0,
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
    holderCount: 0,
    ...o,
  }
}

/**
 * Render the page inside the REAL AuthProvider (only the api-client is mocked).
 *
 * `ToastProvider` is now REQUIRED here: the page's hand-rolled save toast was extracted
 * into the shared provider, which the app mounts once in `AdminPortalLayout`. `useToast()`
 * throws outside a provider on purpose (a silent no-op default would hide a missing
 * mount), so an isolated page render has to supply it.
 */
async function renderProfile(user: SystemUser | null = makeSystemUser()) {
  if (user) mockGetOwnProfile.mockResolvedValue(user)
  mockGetMe.mockResolvedValue(user)
  const view = render(
    <AuthProvider>
      <ToastProvider>
        <AdminPortalProfilePage />
      </ToastProvider>
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
    const { allNavLeaves } = await import('@/components/admin-portal/nav-config')

    // `allNavLeaves()` flattens sections -> entries -> submenu leaves. The menu is two
    // levels deep now (a submenu nests INSIDE a section), so a hand-rolled `flatMap` over
    // the top level silently misses every submenu leaf — including this one.
    const leaves = allNavLeaves()
    const profileLeaves = leaves.filter((l) => l.to === ADMIN_PORTAL_ROUTES.profile)

    expect(profileLeaves).toHaveLength(1)
    // The leaf is now labelled in Thai, from the SHARED constant the navbar dropdown
    // also renders — so the sidebar and the dropdown cannot drift apart.
    expect(profileLeaves[0].label).toBe(T.navLabel)
    expect(ADMIN_PORTAL_ROUTES.profile).toBe('/admin-portal/profile')
    // The old English label is gone from the whole menu.
    expect(leaves.map((l) => l.label)).not.toContain('Profile')
    // The DashWind `settings-profile` placeholder is gone, so it cannot re-appear
    // as a second profile entry. `/admin-portal/settings-profile` stays a 404 BY
    // DESIGN — no redirect was added (PO decision).
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
        <ToastProvider>
          <AdminPortalProfilePage />
        </ToastProvider>
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
        <ToastProvider>
          <AdminPortalProfilePage />
        </ToastProvider>
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
        <ToastProvider>
          <AdminPortalProfilePage />
        </ToastProvider>
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
  it('renders the name, CUID, email and role badge', async () => {
    await renderProfile(makeSystemUser({ id: 'clx-abc', email: 'ada@easybook.local' }))

    expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument()
    expect(screen.getByText(`${T.idPrefix} clx-abc`)).toBeInTheDocument()
    expect(screen.getByText('ada@easybook.local')).toBeInTheDocument()
    expect(screen.getAllByText(ROLE_LABEL.ADMIN).length).toBeGreaterThan(0)
  })

  it('titles the page EXACTLY "โปรไฟล์ (User Profile)" — the role badge is not in the h1', async () => {
    await renderProfile(forRole('SUPER_ADMIN'))

    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent(`${T.heading.th} (${T.heading.en})`)
    // The role must NOT be part of the page's accessible name any more.
    expect(h1).not.toHaveTextContent(ROLE_LABEL.SUPER_ADMIN)
    expect(h1).not.toHaveTextContent('SUPER_ADMIN')
    expect(h1.querySelector('.badge')).toBeNull()
  })

  it.each<[SystemRole]>([['SUPER_ADMIN'], ['ADMIN'], ['VIEWER']])(
    'renders %s as its Thai label, never the raw enum token',
    async (role) => {
      const { container } = await renderProfile(forRole(role))

      expect(screen.getAllByText(ROLE_LABEL[role]).length).toBeGreaterThan(0)
      expect(container.textContent).not.toContain(role)
    },
  )

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

  /**
   * CHANGED: the no-picture avatar is now the SAME person-icon placeholder the navbar
   * avatar uses (`AdminPortalHeader`), not a text-initials chip — one visual language for
   * "this user has no photo". The `<img>` assertion stays: an empty `src` is still never
   * emitted.
   */
  it('renders the icon placeholder (not initials) and emits no <img> when there is no avatar', async () => {
    const { container } = await renderProfile(makeSystemUser({ profilePictureUrl: null }))

    expect(container.querySelector('img')).toBeNull()
    expect(screen.queryByText('AL')).not.toBeInTheDocument()

    // daisyUI 5 modifier (skill: components/avatar.md) — not a hand-rolled flex centre.
    const placeholder = container.querySelector('.avatar-placeholder')!
    expect(placeholder).not.toBeNull()
    expect(placeholder.querySelector('svg')).not.toBeNull()
    // The icon is decorative, so the avatar region itself carries the accessible name the
    // initials used to provide — the same sentence a real photo carries in `alt`.
    expect(placeholder.querySelector('svg')).toHaveAttribute('aria-hidden')
    expect(screen.getByRole('img', { name: T.avatarAlt('Ada Lovelace') })).toBeInTheDocument()
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

  it('puts Personal Info in the FIRST grid cell and Account Info in the second', async () => {
    await renderProfile()

    const personal = screen
      .getByRole('heading', { name: new RegExp(T.cards.personal.en) })
      .closest('section') as HTMLElement
    const account = screen
      .getByRole('heading', { name: new RegExp(T.cards.account.en) })
      .closest('section') as HTMLElement

    // DOM order IS the visual order (a plain grid, no `order-*`), so this single
    // assertion pins the left/right placement on `md+`, the stacking order on mobile
    // AND the tab order at once.
    expect(personal.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(personal.parentElement).toBe(account.parentElement)
  })
})

// ---------------------------------------------------------------------------
describe('AdminPortalProfilePage — read-only fields read as plain text', () => {
  it('view mode: no border, no focus ring, and OUT of the tab order', async () => {
    await renderProfile()

    const firstName = screen.getByLabelText(labelOf(T.fields.firstName))
    expect(firstName).toHaveAttribute('readonly')
    // daisyUI 5's borderless input variant + an explicit focus-outline kill. A
    // `readOnly` input is still focusable, so `tabIndex=-1` is what makes dropping the
    // ring legitimate instead of an invisible-focus trap.
    expect(firstName).toHaveClass('input-ghost')
    expect(firstName).toHaveClass('focus:outline-none')
    expect(firstName).toHaveAttribute('tabindex', '-1')
    expect(firstName.className).not.toMatch(/focus-visible:ring/)

    // The select gets the same treatment (it is `disabled`, so already untabbable).
    const department = screen.getByLabelText(labelOf(T.fields.department))
    expect(department).toBeDisabled()
    expect(department).toHaveClass('select-ghost')
    expect(department).toHaveClass('bg-none')
  })

  it('edit mode: the border and the focus ring come back, and the field is tabbable', async () => {
    await renderProfile()
    await enterEdit()

    const firstName = screen.getByLabelText(labelOf(T.fields.firstName))
    expect(firstName).not.toHaveAttribute('readonly')
    expect(firstName).not.toHaveClass('input-ghost')
    expect(firstName).not.toHaveAttribute('tabindex')
    expect(firstName.className).toMatch(/focus-visible:ring/)

    const department = screen.getByLabelText(labelOf(T.fields.department))
    expect(department).toBeEnabled()
    expect(department).not.toHaveClass('select-ghost')
  })
})

// ---------------------------------------------------------------------------
describe('AdminPortalProfilePage — change-password button contrast', () => {
  it('uses UNCOLOURED btn-outline, so it cannot fail in any theme', async () => {
    await renderProfile()

    const button = screen.getByRole('button', { name: T.actions.changePassword })
    // `btn-outline` paints text + border with `--btn-color`, so the colour class IS the
    // contrast — and two colour classes have already failed on this exact control:
    //   `btn-neutral` = 1.22:1 on `dashwind-dark`'s base-100
    //   `btn-primary` = 1.40:1 on `cupcake`'s base-100 (it passed on the retired
    //                   `dashwind-light`, which is what makes it a trap)
    // With NO colour class, `--btn-color` falls back to `--color-base-content`: 15.91:1 on
    // `cupcake` and 7.03:1 on `dashwind-dark`, and by definition it cannot fail in a future
    // theme either. This control is the only route to `ChangePasswordModal`, whose
    // unreachability is a documented lockout — so the assertion is pinned deliberately.
    expect(button).toHaveClass('btn-outline')
    expect(button).not.toHaveClass('btn-primary')
    expect(button).not.toHaveClass('btn-neutral')
    // Fixed with a theme-resolved token, NOT a `dark:` utility.
    expect(button.className).not.toMatch(/\bdark:/)
  })
})

// ---------------------------------------------------------------------------
describe('AdminPortalProfilePage — CUID + copy to clipboard', () => {
  /** jsdom ships no `navigator.clipboard`; install a controllable one per test. */
  function stubClipboard(writeText: () => Promise<void>) {
    const spy = vi.fn(writeText)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: spy },
      configurable: true,
    })
    return spy
  }

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard')
  })

  it('labels the id "CUID:" — not "id:"', async () => {
    await renderProfile(makeSystemUser({ id: 'clx-abc' }))

    expect(screen.getByText(`CUID: clx-abc`)).toBeInTheDocument()
    expect(screen.queryByText(`id: clx-abc`)).not.toBeInTheDocument()
  })

  it('copies the CUID and confirms visibly through a live region', async () => {
    const writeText = stubClipboard(() => Promise.resolve())
    await renderProfile(makeSystemUser({ id: 'clx-abc' }))

    const copyButton = screen.getByRole('button', { name: T.actions.copyId })
    await act(async () => {
      fireEvent.click(copyButton)
    })

    expect(writeText).toHaveBeenCalledWith('clx-abc')
    const confirmation = await screen.findByText(T.copy.done)
    // Announced, not merely drawn.
    expect(confirmation).toHaveAttribute('role', 'status')
    expect(confirmation).toHaveAttribute('aria-live', 'polite')
  })

  it('surfaces a REJECTED clipboard write instead of throwing or going silent', async () => {
    stubClipboard(() => Promise.reject(new Error('denied')))
    await renderProfile()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: T.actions.copyId }))
    })

    expect(await screen.findByText(T.copy.failed)).toBeInTheDocument()
    expect(screen.queryByText(T.copy.done)).not.toBeInTheDocument()
  })

  it('survives `navigator.clipboard` being absent entirely (insecure context)', async () => {
    // No stub at all — the property access itself throws. It must be caught, not
    // escape as an unhandled rejection.
    await renderProfile()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: T.actions.copyId }))
    })

    expect(await screen.findByText(T.copy.failed)).toBeInTheDocument()
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
    await renderProfile(forRole('VIEWER', { phoneNumber: '0812345678' }))

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
    await renderProfile(forRole('VIEWER'))

    expect(screen.getByRole('button', { name: T.actions.changePassword })).toBeInTheDocument()
  })

  it('STAFF can still change their avatar', async () => {
    await renderProfile(forRole('VIEWER'))

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
    mockPatchSystemUser.mockResolvedValue(makeSystemUser({ firstName: 'Grace' }))

    await enterEdit()
    fireEvent.change(screen.getByLabelText(labelOf(T.fields.firstName)), {
      target: { value: 'Grace' },
    })
    fireEvent.click(screen.getByRole('button', { name: T.actions.save }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: T.actions.confirm }))
    })

    expect(mockPatchSystemUser).toHaveBeenCalledTimes(1)
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
    mockPatchSystemUser.mockRejectedValue(new ApiError(400, 'bad'))

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

  it.each([
    ['current' as const, T.password.current],
    ['next' as const, T.password.next],
    ['confirm' as const, T.password.confirm],
  ])('gives the %s field its own show/hide eye toggle', async (_key, label) => {
    await renderProfile()
    await openPasswordModal()

    const field = screen.getByLabelText(label)
    expect(field).toHaveAttribute('type', 'password')

    // Each toggle's accessible name embeds ITS OWN field label, so three toggles in one
    // modal are individually addressable (the login screen's single bare "แสดงรหัสผ่าน"
    // would have been ambiguous three times over).
    const toggle = screen.getByRole('button', { name: T.password.show(label) })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(toggle)
    expect(field).toHaveAttribute('type', 'text')
    const pressed = screen.getByRole('button', { name: T.password.hide(label) })
    expect(pressed).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(pressed)
    expect(field).toHaveAttribute('type', 'password')
  })

  it('toggling one field does not reveal the other two', async () => {
    await renderProfile()
    await openPasswordModal()

    fireEvent.click(screen.getByRole('button', { name: T.password.show(T.password.next) }))

    expect(screen.getByLabelText(T.password.next)).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText(T.password.current)).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText(T.password.confirm)).toHaveAttribute('type', 'password')
  })
})

// ---------------------------------------------------------------------------
describe('AdminPortalProfilePage — save success toast', () => {
  it('announces a successful save and can be dismissed', async () => {
    await renderProfile()
    mockPatchSystemUser.mockResolvedValue(makeSystemUser({ firstName: 'Grace' }))

    await enterEdit()
    fireEvent.change(screen.getByLabelText(labelOf(T.fields.firstName)), {
      target: { value: 'Grace' },
    })
    fireEvent.click(screen.getByRole('button', { name: T.actions.save }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: T.actions.confirm }))
    })

    const toast = await screen.findByText(T.save.success)
    // Announced politely — a success must not hijack focus the way `role="alert"` does.
    const live = toast.closest('[role="status"]') as HTMLElement
    expect(live).not.toBeNull()
    expect(live).toHaveAttribute('aria-live', 'polite')
    // daisyUI `toast` wrapper + `alert` body (skill: components/toast.md, alert.md), now
    // from the SHARED provider and therefore pinned to the portal-wide top-center.
    const wrapper = live.closest('.toast') as HTMLElement
    expect(wrapper).not.toBeNull()
    expect(wrapper).toHaveClass('toast-center', 'toast-top')
    expect(live).toHaveClass('alert', 'alert-success')

    // The close button's label moved to the shared toast strings module with the component.
    fireEvent.click(screen.getByRole('button', { name: TOAST_STRINGS.dismiss }))
    expect(screen.queryByText(T.save.success)).not.toBeInTheDocument()
  })

  /**
   * CHANGED (was: "shows NO toast when nothing changed"). The "ไม่มีการเปลี่ยนแปลงข้อมูล"
   * notice used to render as an inline `alert` under the cards; it is a transient outcome
   * of the button the user just pressed, so it is now a neutral `info` toast. The load-
   * bearing assertion — that the SUCCESS copy never appears when nothing was written —
   * is unchanged and is joined by a stronger one on the tone.
   */
  it('shows the neutral no-changes toast, never the success toast, when nothing changed', async () => {
    await renderProfile()
    await enterEdit()

    fireEvent.click(screen.getByRole('button', { name: T.actions.save }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: T.actions.confirm }))
    })

    const notice = await screen.findByText(T.save.noChanges)
    expect(screen.queryByText(T.save.success)).not.toBeInTheDocument()
    // Info, not success: nothing was saved, so it must not be dressed as a save.
    const live = notice.closest('[role="status"]') as HTMLElement
    expect(live).toHaveClass('alert', 'alert-info')
    expect(live.closest('.toast')).not.toBeNull()
  })

  it('shows NO toast when the save FAILS', async () => {
    await renderProfile()
    mockPatchSystemUser.mockRejectedValue(new ApiError(400, 'bad'))

    await enterEdit()
    fireEvent.change(screen.getByLabelText(labelOf(T.fields.firstName)), {
      target: { value: 'Grace' },
    })
    fireEvent.click(screen.getByRole('button', { name: T.actions.save }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: T.actions.confirm }))
    })

    expect(await screen.findByText(T.save.invalid)).toBeInTheDocument()
    expect(screen.queryByText(T.save.success)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
describe('AdminPortalProfilePage — system-reserved options', () => {
  const RESERVED_DEPT = dept({ id: 9, name: 'System Reserved Dept', isSystemReserved: true })
  const RESERVED_ROLE = personnelRole({ id: 8, name: 'System Reserved Role', isSystemReserved: true })

  it('a SUPER_ADMIN SEES and can SELECT a system-reserved department/position', async () => {
    // The backend returns reserved rows to a SUPER_ADMIN (`includeReserved:
    // mayUseSystemReservedOptions(actor)`), so this is that response. The page must not
    // second-guess it — the client has no business re-deciding an authorisation call.
    mockListDepartments.mockResolvedValue([dept(), RESERVED_DEPT])
    mockListPersonnelRoles.mockResolvedValue([personnelRole(), RESERVED_ROLE])
    mockPatchSystemUser.mockResolvedValue(
      makeSystemUser({ id: 'sa-1', role: 'SUPER_ADMIN', department: { id: 9, name: RESERVED_DEPT.name } }),
    )
    await renderProfile(forRole('SUPER_ADMIN', { id: 'sa-1' }))
    await enterEdit()

    const department = screen.getByLabelText(labelOf(T.fields.department))
    const reservedOption = within(department).getByRole('option', {
      name: RESERVED_DEPT.name,
    }) as HTMLOptionElement
    expect(reservedOption).toBeInTheDocument()
    // Present AND selectable — a disabled option would be no better than a hidden one.
    expect(reservedOption).not.toBeDisabled()
    expect(
      within(screen.getByLabelText(labelOf(T.fields.position))).getByRole('option', {
        name: RESERVED_ROLE.name,
      }),
    ).toBeInTheDocument()

    fireEvent.change(department, { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: T.actions.save }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: T.actions.confirm }))
    })

    expect(mockPatchSystemUser).toHaveBeenCalledWith('sa-1', { departmentId: 9 })
  })

  it("an ADMIN's dropdown contains no reserved option — because the SERVER omitted it", async () => {
    // An ADMIN's `GET /departments` response simply has no reserved row in it.
    mockListDepartments.mockResolvedValue([dept(), dept({ id: 3, name: 'Maths' })])
    await renderProfile(forRole('ADMIN'))
    await enterEdit()

    const department = screen.getByLabelText(labelOf(T.fields.department))
    expect(within(department).queryByRole('option', { name: RESERVED_DEPT.name })).toBeNull()
    expect(within(department).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'CS',
      'Maths',
    ])
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

// ---------------------------------------------------------------------------
describe('AdminPortalProfilePage — the NAVBAR avatar follows an upload', () => {
  /**
   * The shell header and the page inside ONE `AuthProvider` — which is the only way to
   * prove item 9 end to end. The header reads `useAuth().user`, the page calls
   * `refresh()` after `uploadOwnAvatar` resolves, and `refresh()` re-probes
   * `GET /auth/system/me`. No new global store is involved.
   */
  async function renderShellWithProfile(initial: SystemUser) {
    mockGetOwnProfile.mockResolvedValue(initial)
    mockGetMe.mockResolvedValue(initial)
    const view = render(
      <MemoryRouter initialEntries={['/admin-portal/profile']}>
        <AuthProvider>
          <Routes>
            <Route element={<AdminPortalThemeLayout />}>
              <Route
                path="/admin-portal/profile"
                element={
                  <ToastProvider>
                    <AdminPortalHeader />
                    <AdminPortalProfilePage />
                  </ToastProvider>
                }
              />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )
    await screen.findByRole('heading', { name: new RegExp(T.cards.account.en) })
    return view
  }

  const navbarAvatar = () =>
    screen.getByRole('button', { name: 'Profile menu' }).querySelector('img')

  it('repaints the small navbar avatar immediately after a successful upload', async () => {
    const before = makeSystemUser({ profilePictureUrl: null })
    const after = makeSystemUser({ profilePictureUrl: 'https://cdn.example.com/new.jpg' })
    await renderShellWithProfile(before)

    // Placeholder while there is no picture — never an <img> with an empty src.
    expect(navbarAvatar()).toBeNull()

    mockCropImageToFile.mockResolvedValue(
      new File([new Uint8Array(8)], 'photo.jpg', { type: 'image/jpeg' }),
    )
    mockUploadOwnAvatar.mockResolvedValue(after)
    // `refresh()` re-probes /me, which now answers with the new URL.
    mockGetMe.mockResolvedValue(after)

    fireEvent.click(screen.getByRole('button', { name: T.actions.changeAvatar }))
    await screen.findByLabelText(T.avatar.pickLabel)
    fireEvent.change(screen.getByLabelText(T.avatar.pickLabel), {
      target: { files: [new File([new Uint8Array(1024)], 'photo.png', { type: 'image/png' })] },
    })
    await screen.findByTestId('mock-cropper')
    act(() => cropSpy.complete?.())
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: T.avatar.submit }))
    })

    // No remount, no reload — the navbar image is simply there now.
    await waitFor(() => expect(navbarAvatar()).not.toBeNull())
    expect(navbarAvatar()).toHaveAttribute('src', 'https://cdn.example.com/new.jpg')
  })

  it('routes the navbar dropdown item to the REAL profile page, in Thai', async () => {
    await renderShellWithProfile(makeSystemUser())

    const link = screen.getByRole('link', { name: T.navLabel })
    expect(link).toHaveAttribute('href', '/admin-portal/profile')
    // The DashWind English label is gone.
    expect(screen.queryByText('Profile Settings')).not.toBeInTheDocument()
  })

  it('renders NO page-title heading in the navbar (it collided with the hamburger)', async () => {
    await renderShellWithProfile(makeSystemUser())

    // The page's own <h1> is the ONLY level-1 heading on screen.
    const h1s = screen.getAllByRole('heading', { level: 1 })
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).toHaveTextContent(`${T.heading.th} (${T.heading.en})`)
  })
})
