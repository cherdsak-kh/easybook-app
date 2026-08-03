import { act } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { PHONE_COUNT } from '@/components/RegistrationForm'
import { UI_STRINGS_CLIENT as UI } from '@/constants/ui-strings-client'
import * as liffLib from '@/lib/liff'
import * as apiClient from '@/lib/api-client'
import type {
  AppAccess,
  LineUserRegistration,
  LineUserStatus,
  RegistrationOptions,
} from '@/lib/api-client'

/**
 * Derived from `RegistrationForm`'s own phone rule rather than hardcoded: a
 * hardcoded literal here went silently invalid when a length rule last changed,
 * blocking submit and reddening the payload assertions below for
 * unrelated-looking reasons. Digits-only and exactly `PHONE_COUNT` long. Used on
 * BOTH sides of the submit assertions — typed into the form and expected in the
 * DTO — so they still pin the form's pass-through of the value.
 */
const VALID_PHONE = '0'.repeat(PHONE_COUNT)

/**
 * `HomePage`'s greeting screen renders a `<Link>` to the demo portal, and any
 * react-router primitive throws outside a router context. Every case here goes
 * through this helper so a future `<Link>`/`useNavigate` added anywhere else in
 * the page cannot redden an unrelated test. `MemoryRouter` matches the repo
 * convention (see `AdminPortalLoginPage.test.tsx`); no route table is needed
 * because nothing here asserts on navigation, only that the link renders.
 */
const renderHome = () =>
  render(<HomePage />, {
    wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
  })

// Mock the LIFF wrapper AND the api-client at their import boundaries (repo
// convention). These are the only two places @line/liff and network calls live,
// so the whole onboarding state machine is driven from these fakes.
vi.mock('@/lib/liff', () => ({
  initLiff: vi.fn(),
  isInLineClient: vi.fn(),
  isLiffConfigured: vi.fn(),
  isLoggedIn: vi.fn(),
  login: vi.fn(),
  getFriendship: vi.fn(),
  getIdToken: vi.fn(),
}))

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
    getLineUserStatus: vi.fn(),
    getRegistrationOptions: vi.fn(),
    registerLineUser: vi.fn(),
    updateLineUserRegistration: vi.fn(),
  }
})

const mockInitLiff = vi.mocked(liffLib.initLiff)
const mockIsInLineClient = vi.mocked(liffLib.isInLineClient)
const mockIsLiffConfigured = vi.mocked(liffLib.isLiffConfigured)
const mockIsLoggedIn = vi.mocked(liffLib.isLoggedIn)
const mockLogin = vi.mocked(liffLib.login)
const mockGetFriendship = vi.mocked(liffLib.getFriendship)
const mockGetIdToken = vi.mocked(liffLib.getIdToken)
const mockGetStatus = vi.mocked(apiClient.getLineUserStatus)
const mockGetOptions = vi.mocked(apiClient.getRegistrationOptions)
const mockRegister = vi.mocked(apiClient.registerLineUser)
const mockUpdate = vi.mocked(apiClient.updateLineUserRegistration)

const MARK_LOGO = '/logo/easybook-logo-512px-no-bg.svg'
const WORDMARK_LOGO = '/logo/easybook-logo-text-1024px-no-bg.svg'
const TOKEN = 'id-token-xyz'
/**
 * OBS-2 auth-error copy — must match HomePage's AuthErrorScreen verbatim.
 *
 * A DELIBERATE ANCHOR: this literal is NOT imported from `ui-strings-client.ts`,
 * unlike every label below. Asserting `UI.authError.body` against a component
 * rendering `UI.authError.body` would prove nothing, and this string is not
 * decoration — it is the security-adjacent notice shown when a configured LIFF
 * channel yields no ID token (typically a missing `openid` scope). The copy was
 * localised to Thai for end users, so it no longer names the scope itself; the
 * pin stays so a silent re-word still reddens CI instead of shipping.
 * Precedent: `routes.test.ts`.
 */
const AUTH_ERROR_MESSAGE =
  'การตรวจสอบสิทธิ์ LINE ล้มเหลว กรุณาติดต่อเจ้าหน้าที่เพื่อตรวจสอบข้อมูล'

/** Pinned alongside the body, for the same reason: the alert's accessible name. */
const AUTH_ERROR_TITLE = 'การตรวจสอบสิทธิ์ล้มเหลว'

const OPTIONS: RegistrationOptions = {
  departments: [
    { id: 1, name: 'Computer Science' },
    { id: 2, name: 'Mathematics' },
  ],
  personnelRoles: [
    { id: 10, name: 'Teacher' },
    { id: 11, name: 'Support Staff' },
  ],
}

function registration(overrides: Partial<LineUserRegistration> = {}): LineUserRegistration {
  return {
    id: 'reg1',
    firstName: 'Somchai',
    lastName: 'Jaidee',
    phone: VALID_PHONE,
    departmentId: 1,
    department: 'Computer Science',
    personnelRoleId: 10,
    personnelRole: 'Teacher',
    createdAt: '2026-07-14T10:00:00.000Z',
    updatedAt: '2026-07-14T10:00:00.000Z',
    ...overrides,
  }
}

/**
 * A `LineUserStatus` fixture.
 *
 * `rejectionReason` became a REQUIRED field on the status DTO with the REJECTED
 * feature, so every fixture must carry it; the backend invariant is that it is
 * non-null IFF `access === 'REJECTED'`, hence the `null` default. Introduced as a
 * factory (rather than adding `rejectionReason: null` to ~15 object literals) so
 * the next contract addition is a one-line change here.
 */
function status(
  access: AppAccess,
  reg: LineUserRegistration | null = null,
  rejectionReason: string | null = null,
): LineUserStatus {
  return { access, registration: reg, rejectionReason }
}

/** Advance past the minimum splash window and flush the async gate chain. */
async function resolveSplash() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1600)
  })
  await flush()
}

/** Flush a few microtask turns for the awaited gate/handler/option promises. */
async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

/** Fill the registration form with valid values, selecting the dynamic options. */
function fillRegistration() {
  fireEvent.change(screen.getByLabelText(UI.registration.firstName), { target: { value: 'Somchai' } })
  fireEvent.change(screen.getByLabelText(UI.registration.lastName), { target: { value: 'Jaidee' } })
  fireEvent.change(screen.getByLabelText(UI.registration.phone), { target: { value: VALID_PHONE } })
  // <select> values are DOM strings — the stringified integer option ids.
  fireEvent.change(screen.getByLabelText(UI.registration.department), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText(UI.registration.personnelRole), { target: { value: '10' } })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  // Defaults: external web browser, LIFF configured, signed out, friend, has token.
  mockInitLiff.mockResolvedValue(null)
  mockIsInLineClient.mockReturnValue(false)
  mockIsLiffConfigured.mockReturnValue(true)
  mockIsLoggedIn.mockReturnValue(false)
  mockGetFriendship.mockResolvedValue({ friendFlag: true })
  mockGetIdToken.mockReturnValue(TOKEN)
  mockGetStatus.mockResolvedValue(status('UNREGISTERED'))
  mockGetOptions.mockResolvedValue(OPTIONS)
  mockRegister.mockResolvedValue(status('PENDING', registration()))
  mockUpdate.mockResolvedValue(status('PENDING', registration()))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('HomePage — splash', () => {
  it('shows the splash on mount (before the flow resolves)', () => {
    renderHome()
    expect(screen.getByRole('status', { name: UI.splash.loading })).toBeInTheDocument()
    expect(screen.queryByText(/Hello,/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: UI.lineLogin.submit })).not.toBeInTheDocument()
  })

  it('uses the wordmark logo on the splash in a web browser', () => {
    mockIsInLineClient.mockReturnValue(false)
    renderHome()
    expect(screen.getByAltText(UI.splash.logoAlt)).toHaveAttribute('src', WORDMARK_LOGO)
  })

  it('uses the square mark logo on the splash inside the LINE client', () => {
    mockIsInLineClient.mockReturnValue(true)
    renderHome()
    expect(screen.getByAltText(UI.splash.logoAlt)).toHaveAttribute('src', MARK_LOGO)
  })
})

describe('HomePage — web login card', () => {
  it('web + signed out → shows the LINE login card after the splash resolves', async () => {
    renderHome()
    await resolveSplash()

    expect(screen.getByRole('button', { name: UI.lineLogin.submit })).toBeInTheDocument()
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('login button triggers liff.login() when a LIFF id is configured', async () => {
    renderHome()
    await resolveSplash()

    fireEvent.click(screen.getByRole('button', { name: UI.lineLogin.submit }))

    expect(mockLogin).toHaveBeenCalledTimes(1)
  })
})

describe('HomePage — friendship gate (AC-F)', () => {
  it('friendFlag:false → shows the Add-Friend screen with the OA QR', async () => {
    mockInitLiff.mockResolvedValue({ displayName: 'Alice', userId: 'U1' })
    mockGetFriendship.mockResolvedValue({ friendFlag: false })
    renderHome()

    await resolveSplash()

    expect(screen.getByAltText(UI.addFriend.qrAlt)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: UI.addFriend.recheck })).toBeInTheDocument()
    // The status gate never ran while the friendship gate is open.
    expect(mockGetStatus).not.toHaveBeenCalled()
  })

  it('"Check Friendship Status" proceeds to the status gate once it flips to friend', async () => {
    mockInitLiff.mockResolvedValue({ displayName: 'Alice', userId: 'U1' })
    mockGetFriendship
      .mockResolvedValueOnce({ friendFlag: false }) // initial gate
      .mockResolvedValue({ friendFlag: true }) // the re-check
    mockGetStatus.mockResolvedValue(status('ALLOWED'))
    renderHome()
    await resolveSplash()

    fireEvent.click(screen.getByRole('button', { name: UI.addFriend.recheck }))
    await flush()

    expect(mockGetStatus).toHaveBeenCalledTimes(1)
    expect(screen.getByText(UI.hello.greeting('Alice'))).toBeInTheDocument()
  })
})

describe('HomePage — access-status gate (AC-F1/F3/F4/F5)', () => {
  beforeEach(() => {
    mockInitLiff.mockResolvedValue({ displayName: 'Alice', userId: 'U1' })
  })

  it('UNREGISTERED → shows the registration form with option dropdowns (SC-F2)', async () => {
    mockGetStatus.mockResolvedValue(status('UNREGISTERED'))
    renderHome()
    await resolveSplash()

    expect(screen.getByRole('button', { name: UI.registration.createSubmit })).toBeInTheDocument()
    expect(mockGetStatus).toHaveBeenCalledWith(TOKEN)
    // Options were fetched with the bearer token and rendered as <option>s.
    expect(mockGetOptions).toHaveBeenCalledWith(TOKEN)
    const dept = screen.getByLabelText(UI.registration.department) as HTMLSelectElement
    expect(within(dept).getByRole('option', { name: 'Computer Science' })).toBeInTheDocument()
    expect(within(dept).getByRole('option', { name: 'Mathematics' })).toBeInTheDocument()
    const role = screen.getByLabelText(UI.registration.personnelRole) as HTMLSelectElement
    expect(within(role).getByRole('option', { name: 'Teacher' })).toBeInTheDocument()
  })

  it('PENDING → shows the pending screen with an Edit affordance', async () => {
    mockGetStatus.mockResolvedValue(status('PENDING', registration()))
    renderHome()
    await resolveSplash()

    expect(screen.getByText(UI.pending.title)).toBeInTheDocument()
    // The body interpolates the LINE display name ahead of the fixed message.
    expect(screen.getByText(UI.pending.body('Alice'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: UI.pending.edit })).toBeInTheDocument()
  })

  it('ALLOWED → shows the greeting', async () => {
    mockGetStatus.mockResolvedValue(status('ALLOWED'))
    renderHome()
    await resolveSplash()

    expect(screen.getByText(UI.hello.greeting('Alice'))).toBeInTheDocument()
  })

  it('BLOCKED → shows the suspended screen', async () => {
    mockGetStatus.mockResolvedValue(status('BLOCKED'))
    renderHome()
    await resolveSplash()

    expect(screen.getByText(UI.blocked.title)).toBeInTheDocument()
    expect(screen.getByText(UI.blocked.body)).toBeInTheDocument()
  })

  it('a failing status call → shows the error screen with a retry', async () => {
    mockGetStatus.mockRejectedValue(new apiClient.ApiError(500, 'boom'))
    renderHome()
    await resolveSplash()

    expect(screen.getByText(UI.gateError.title)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: UI.common.tryAgain })).toBeInTheDocument()
  })
})

describe('HomePage — registration submit (AC-F2 / SC-F2)', () => {
  beforeEach(() => {
    mockInitLiff.mockResolvedValue({ displayName: 'Alice', userId: 'U1' })
    mockGetStatus.mockResolvedValue(status('UNREGISTERED'))
  })

  it('submits the id-based DTO with the bearer token and moves to Pending', async () => {
    mockRegister.mockResolvedValue(status('PENDING', registration()))
    renderHome()
    await resolveSplash()

    fillRegistration()
    fireEvent.click(screen.getByRole('button', { name: UI.registration.createSubmit }))
    await flush()

    // Regression guard: the option ids must be submitted as NUMBERS (the backend
    // now validates them with `@IsInt()` and 400s a stringified id).
    expect(mockRegister).toHaveBeenCalledWith(
      {
        firstName: 'Somchai',
        lastName: 'Jaidee',
        phone: VALID_PHONE,
        departmentId: 1,
        personnelRoleId: 10,
      },
      TOKEN,
    )
    expect(screen.getByText(UI.pending.title)).toBeInTheDocument()
  })

  it('blocks submit and shows field errors when required fields are empty', async () => {
    renderHome()
    await resolveSplash()

    fireEvent.click(screen.getByRole('button', { name: UI.registration.createSubmit }))
    await flush()

    expect(mockRegister).not.toHaveBeenCalled()
    expect(screen.getByText(UI.registration.firstNameRequired)).toBeInTheDocument()
    expect(screen.getByText(UI.registration.departmentRequired)).toBeInTheDocument()
  })

  /**
   * The SURVIVING 409 on this surface. `lineUserId` is still `@unique`, so a second
   * registration for the same LINE account is still a conflict — this is the only
   * remaining cause, and it must keep rendering inline rather than crashing.
   */
  it('surfaces a 409 (already registered) as a non-crashing error, staying on the form', async () => {
    mockRegister.mockRejectedValue(new apiClient.ApiError(409, 'ALREADY_REGISTERED'))
    renderHome()
    await resolveSplash()

    fillRegistration()
    fireEvent.click(screen.getByRole('button', { name: UI.registration.createSubmit }))
    await flush()

    expect(screen.getByRole('button', { name: UI.registration.createSubmit })).toBeInTheDocument()
    expect(screen.getByText('ALREADY_REGISTERED')).toBeInTheDocument()
  })
})

describe('HomePage — PENDING self-edit (SC-F3)', () => {
  beforeEach(() => {
    mockInitLiff.mockResolvedValue({ displayName: 'Alice', userId: 'U1' })
    mockGetStatus.mockResolvedValue(status('PENDING', registration()))
  })

  it('Edit → pre-fills the form, PATCHes edited values, and returns to Pending', async () => {
    const edited = registration({ firstName: 'Somsak' })
    mockUpdate.mockResolvedValue(status('PENDING', edited))
    renderHome()
    await resolveSplash()

    fireEvent.click(screen.getByRole('button', { name: UI.pending.edit }))
    await flush()

    // Pre-filled from the existing registration — the numeric option id is
    // stringified so the <select> keeps the current option selected.
    expect(screen.getByLabelText(UI.registration.firstName)).toHaveValue('Somchai')
    expect(screen.getByLabelText(UI.registration.phone)).toHaveValue(VALID_PHONE)
    expect(screen.getByLabelText(UI.registration.department)).toHaveValue('1')

    fireEvent.change(screen.getByLabelText(UI.registration.firstName), { target: { value: 'Somsak' } })
    fireEvent.click(screen.getByRole('button', { name: UI.registration.editSubmit }))
    await flush()

    // Regression guard: the edit PATCH also carries NUMERIC option ids.
    expect(mockUpdate).toHaveBeenCalledWith(
      {
        firstName: 'Somsak',
        lastName: 'Jaidee',
        phone: VALID_PHONE,
        departmentId: 1,
        personnelRoleId: 10,
      },
      TOKEN,
    )
    // Back on the Pending screen with the refreshed name.
    expect(screen.getByText(UI.pending.title)).toBeInTheDocument()
    expect(screen.getByText('Somsak Jaidee')).toBeInTheDocument()
  })

  it('renders a 403 (no longer PENDING) as a refresh prompt, staying on the form', async () => {
    mockUpdate.mockRejectedValue(new apiClient.ApiError(403, 'REGISTRATION_NOT_EDITABLE'))
    renderHome()
    await resolveSplash()

    fireEvent.click(screen.getByRole('button', { name: UI.pending.edit }))
    await flush()
    fireEvent.click(screen.getByRole('button', { name: UI.registration.editSubmit }))
    await flush()

    expect(screen.getByText(UI.registration.editError.notEditable)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: UI.registration.editSubmit })).toBeInTheDocument()
  })

  it('renders a 400 (deleted/invalid option) inline on edit', async () => {
    mockUpdate.mockRejectedValue(new apiClient.ApiError(400, 'INVALID_DEPARTMENT'))
    renderHome()
    await resolveSplash()

    fireEvent.click(screen.getByRole('button', { name: UI.pending.edit }))
    await flush()
    fireEvent.click(screen.getByRole('button', { name: UI.registration.editSubmit }))
    await flush()

    expect(screen.getByText('INVALID_DEPARTMENT')).toBeInTheDocument()
  })

  it('Cancel returns to Pending without calling the backend', async () => {
    renderHome()
    await resolveSplash()

    fireEvent.click(screen.getByRole('button', { name: UI.pending.edit }))
    await flush()
    fireEvent.click(screen.getByRole('button', { name: UI.registration.cancel }))
    await flush()

    expect(mockUpdate).not.toHaveBeenCalled()
    expect(screen.getByText(UI.pending.title)).toBeInTheDocument()
  })
})

describe('HomePage — REJECTED (sent back for revision)', () => {
  const REASON = 'เบอร์โทรศัพท์ไม่ถูกต้อง กรุณากรอกใหม่'

  beforeEach(() => {
    mockInitLiff.mockResolvedValue({ displayName: 'Alice', userId: 'U1' })
    mockGetStatus.mockResolvedValue(status('REJECTED', registration(), REASON))
  })

  it('routes a REJECTED status to the Rejected screen and shows the reason prominently', async () => {
    renderHome()
    await resolveSplash()

    expect(screen.getByText(UI.rejected.title)).toBeInTheDocument()
    expect(screen.getByText(UI.rejected.body('Alice'))).toBeInTheDocument()
    // The reason itself — the point of the screen — renders under its own heading.
    expect(screen.getByText(UI.rejected.reasonLabel)).toBeInTheDocument()
    expect(screen.getByText(REASON)).toBeInTheDocument()
    // Not the Pending or Blocked screen.
    expect(screen.queryByText(UI.pending.title)).not.toBeInTheDocument()
    expect(screen.queryByText(UI.blocked.title)).not.toBeInTheDocument()
  })

  it('falls back to an explanation rather than a blank box when the reason is null', async () => {
    mockGetStatus.mockResolvedValue(status('REJECTED', registration(), null))
    renderHome()
    await resolveSplash()

    expect(screen.getByText(UI.rejected.reasonFallback)).toBeInTheDocument()
  })

  it('the edit button opens the EXISTING registration form, pre-filled', async () => {
    renderHome()
    await resolveSplash()

    fireEvent.click(screen.getByRole('button', { name: UI.rejected.edit }))
    await flush()

    // The same `mode="edit"` RegistrationForm a PENDING user gets — not a new screen.
    expect(screen.getByRole('button', { name: UI.registration.editSubmit })).toBeInTheDocument()
    expect(screen.getByLabelText(UI.registration.firstName)).toHaveValue('Somchai')
    expect(screen.getByLabelText(UI.registration.department)).toHaveValue('1')
  })

  it('re-submitting goes through the EXISTING update-registration path and lands on Pending', async () => {
    const edited = registration({ firstName: 'Somsak' })
    // The backend flips REJECTED → PENDING and clears the reason on a resubmit.
    mockUpdate.mockResolvedValue(status('PENDING', edited, null))
    renderHome()
    await resolveSplash()

    fireEvent.click(screen.getByRole('button', { name: UI.rejected.edit }))
    await flush()
    fireEvent.change(screen.getByLabelText(UI.registration.firstName), { target: { value: 'Somsak' } })
    fireEvent.click(screen.getByRole('button', { name: UI.registration.editSubmit }))
    await flush()

    // No new endpoint: the SAME self-edit call, with the bearer token and numeric ids.
    expect(mockUpdate).toHaveBeenCalledWith(
      {
        firstName: 'Somsak',
        lastName: 'Jaidee',
        phone: VALID_PHONE,
        departmentId: 1,
        personnelRoleId: 10,
      },
      TOKEN,
    )
    expect(mockRegister).not.toHaveBeenCalled()
    // Routed from the RESPONSE's access → Pending, and the reason is gone.
    expect(screen.getByText(UI.pending.title)).toBeInTheDocument()
    expect(screen.queryByText(REASON)).not.toBeInTheDocument()
  })

  it('Cancel returns to the Rejected screen (not Pending) with the reason intact', async () => {
    renderHome()
    await resolveSplash()

    fireEvent.click(screen.getByRole('button', { name: UI.rejected.edit }))
    await flush()
    fireEvent.click(screen.getByRole('button', { name: UI.registration.cancel }))
    await flush()

    expect(mockUpdate).not.toHaveBeenCalled()
    expect(screen.getByText(UI.rejected.title)).toBeInTheDocument()
    expect(screen.getByText(REASON)).toBeInTheDocument()
  })

  it('surfaces a failed re-submit inline, staying on the form', async () => {
    // A status with no dedicated branch: proves the GENERIC fallback in
    // `messageForEdit` still renders the server message inline, non-crashing.
    mockUpdate.mockRejectedValue(new apiClient.ApiError(500, 'REGISTRATION_UPDATE_FAILED'))
    renderHome()
    await resolveSplash()

    fireEvent.click(screen.getByRole('button', { name: UI.rejected.edit }))
    await flush()
    fireEvent.click(screen.getByRole('button', { name: UI.registration.editSubmit }))
    await flush()

    expect(screen.getByText('REGISTRATION_UPDATE_FAILED')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: UI.registration.editSubmit })).toBeInTheDocument()
  })
})

describe('HomePage — in-client behaviour', () => {
  it('in-client + signed out → calls liff.login() and keeps the splash up', async () => {
    mockIsInLineClient.mockReturnValue(true)
    mockIsLoggedIn.mockReturnValue(false)
    mockInitLiff.mockResolvedValue(null)
    renderHome()

    await resolveSplash()

    expect(mockLogin).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status', { name: UI.splash.loading })).toBeInTheDocument()
    expect(mockGetStatus).not.toHaveBeenCalled()
  })

  it('in-client + signed in + ALLOWED → greets without calling login()', async () => {
    mockIsInLineClient.mockReturnValue(true)
    mockIsLoggedIn.mockReturnValue(true)
    mockInitLiff.mockResolvedValue({ displayName: 'Bob', userId: 'U456' })
    mockGetStatus.mockResolvedValue(status('ALLOWED'))
    renderHome()

    await resolveSplash()

    expect(screen.getByText(UI.hello.greeting('Bob'))).toBeInTheDocument()
    expect(mockLogin).not.toHaveBeenCalled()
  })
})

describe('HomePage — local-dev mock path (no LIFF id)', () => {
  it('is walkable to Pending without a real token or a backend call', async () => {
    // No LIFF id → no real token; the flow must stay walkable + testable.
    mockIsLiffConfigured.mockReturnValue(false)
    mockGetIdToken.mockReturnValue(null)
    mockInitLiff.mockResolvedValue(null)
    renderHome()
    await resolveSplash()

    // Web signed-out → login card; the dev mock login enters the gate flow.
    fireEvent.click(screen.getByRole('button', { name: UI.lineLogin.submit }))
    await flush()

    // Status short-circuits to a mock UNREGISTERED → the registration form, whose
    // dropdowns are populated by the mock options (no backend call).
    expect(screen.getByRole('button', { name: UI.registration.createSubmit })).toBeInTheDocument()
    expect(mockGetStatus).not.toHaveBeenCalled()
    expect(mockGetOptions).not.toHaveBeenCalled()
    expect(screen.getByLabelText(UI.registration.department)).toBeInTheDocument()

    // A mock submit transitions to Pending WITHOUT hitting the backend.
    fillRegistration()
    fireEvent.click(screen.getByRole('button', { name: UI.registration.createSubmit }))
    await flush()

    expect(mockRegister).not.toHaveBeenCalled()
    expect(screen.getByText(UI.pending.title)).toBeInTheDocument()
  })
})

describe('HomePage — OBS-2: configured LIFF but no ID token', () => {
  it('renders the auth-error alert and calls NEITHER the mock flow NOR the backend', async () => {
    // Real, configured LIFF channel (VITE_LIFF_ID set) but getIdToken() returns
    // null — e.g. the LINE Login channel is missing the `openid` scope. This must
    // NOT silently enter mock mode and must NOT hit /status or /register.
    mockIsLiffConfigured.mockReturnValue(true)
    mockGetIdToken.mockReturnValue(null)
    mockInitLiff.mockResolvedValue({ displayName: 'Alice', userId: 'U1' })
    mockGetFriendship.mockResolvedValue({ friendFlag: true })
    renderHome()
    await resolveSplash()

    // Loud, labelled alert with the exact support message.
    const alert = screen.getByRole('alert', { name: AUTH_ERROR_TITLE })
    expect(alert).toBeInTheDocument()
    expect(screen.getByText(AUTH_ERROR_MESSAGE)).toBeInTheDocument()

    // No backend calls were issued …
    expect(mockGetStatus).not.toHaveBeenCalled()
    expect(mockGetOptions).not.toHaveBeenCalled()
    expect(mockRegister).not.toHaveBeenCalled()
    // … and the mock flow did NOT run (no registration form appeared).
    expect(screen.queryByRole('button', { name: UI.registration.createSubmit })).not.toBeInTheDocument()
  })
})
