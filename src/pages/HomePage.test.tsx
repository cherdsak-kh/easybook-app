import { act } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { HomePage } from '@/pages/HomePage'
import { ID_COUNT, PHONE_COUNT } from '@/components/RegistrationForm'
import { UI_STRINGS_CLIENT as UI } from '@/constants/ui-strings-client'
import * as liffLib from '@/lib/liff'
import * as apiClient from '@/lib/api-client'
import type { LineUserRegistration, RegistrationOptions } from '@/lib/api-client'

/**
 * Derived from `RegistrationForm`'s own rule rather than hardcoded: a 13-char
 * literal here went silently invalid when that rule last changed, blocking
 * submit and reddening the payload assertions below for unrelated-looking
 * reasons.
 */
const VALID_STAFF_ID = '6'.repeat(ID_COUNT)

/**
 * Same reason as {@link VALID_STAFF_ID}, for the phone rule: digits-only and
 * exactly `PHONE_COUNT` long, derived rather than hardcoded so a change to the
 * required length cannot leave this fixture silently invalid. Used on BOTH sides
 * of the submit assertions — typed into the form and expected in the DTO — so
 * they still pin the form's pass-through of the value.
 */
const VALID_PHONE = '0'.repeat(PHONE_COUNT)

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
 * decoration — it is the security-adjacent diagnostic that tells an operator a
 * configured LIFF channel is missing the `openid` scope. Pinning it here means a
 * silent re-word reddens CI instead of shipping. Precedent: `routes.test.ts`.
 */
const AUTH_ERROR_MESSAGE =
  "LINE Authentication failed: Missing ID Token. Please contact support or verify that the LINE login channel has the 'openid' scope configured."

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
    staffId: VALID_STAFF_ID,
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
  fireEvent.change(screen.getByLabelText(UI.registration.staffId), { target: { value: VALID_STAFF_ID } })
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
  mockGetStatus.mockResolvedValue({ access: 'UNREGISTERED', registration: null })
  mockGetOptions.mockResolvedValue(OPTIONS)
  mockRegister.mockResolvedValue({ access: 'PENDING', registration: registration() })
  mockUpdate.mockResolvedValue({ access: 'PENDING', registration: registration() })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('HomePage — splash', () => {
  it('shows the splash on mount (before the flow resolves)', () => {
    render(<HomePage />)
    expect(screen.getByRole('status', { name: UI.splash.loading })).toBeInTheDocument()
    expect(screen.queryByText(/Hello,/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: UI.lineLogin.submit })).not.toBeInTheDocument()
  })

  it('uses the wordmark logo on the splash in a web browser', () => {
    mockIsInLineClient.mockReturnValue(false)
    render(<HomePage />)
    expect(screen.getByAltText(UI.splash.logoAlt)).toHaveAttribute('src', WORDMARK_LOGO)
  })

  it('uses the square mark logo on the splash inside the LINE client', () => {
    mockIsInLineClient.mockReturnValue(true)
    render(<HomePage />)
    expect(screen.getByAltText(UI.splash.logoAlt)).toHaveAttribute('src', MARK_LOGO)
  })
})

describe('HomePage — web login card', () => {
  it('web + signed out → shows the LINE login card after the splash resolves', async () => {
    render(<HomePage />)
    await resolveSplash()

    expect(screen.getByRole('button', { name: UI.lineLogin.submit })).toBeInTheDocument()
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('login button triggers liff.login() when a LIFF id is configured', async () => {
    render(<HomePage />)
    await resolveSplash()

    fireEvent.click(screen.getByRole('button', { name: UI.lineLogin.submit }))

    expect(mockLogin).toHaveBeenCalledTimes(1)
  })
})

describe('HomePage — friendship gate (AC-F)', () => {
  it('friendFlag:false → shows the Add-Friend screen with the OA QR', async () => {
    mockInitLiff.mockResolvedValue({ displayName: 'Alice', userId: 'U1' })
    mockGetFriendship.mockResolvedValue({ friendFlag: false })
    render(<HomePage />)

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
    mockGetStatus.mockResolvedValue({ access: 'ALLOWED', registration: null })
    render(<HomePage />)
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
    mockGetStatus.mockResolvedValue({ access: 'UNREGISTERED', registration: null })
    render(<HomePage />)
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
    mockGetStatus.mockResolvedValue({ access: 'PENDING', registration: registration() })
    render(<HomePage />)
    await resolveSplash()

    expect(screen.getByText(UI.pending.title)).toBeInTheDocument()
    // The body interpolates the LINE display name ahead of the fixed message.
    expect(screen.getByText(UI.pending.body('Alice'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: UI.pending.edit })).toBeInTheDocument()
  })

  it('ALLOWED → shows the greeting', async () => {
    mockGetStatus.mockResolvedValue({ access: 'ALLOWED', registration: null })
    render(<HomePage />)
    await resolveSplash()

    expect(screen.getByText(UI.hello.greeting('Alice'))).toBeInTheDocument()
  })

  it('BLOCKED → shows the suspended screen', async () => {
    mockGetStatus.mockResolvedValue({ access: 'BLOCKED', registration: null })
    render(<HomePage />)
    await resolveSplash()

    expect(screen.getByText(UI.blocked.title)).toBeInTheDocument()
    expect(screen.getByText(UI.blocked.body)).toBeInTheDocument()
  })

  it('a failing status call → shows the error screen with a retry', async () => {
    mockGetStatus.mockRejectedValue(new apiClient.ApiError(500, 'boom'))
    render(<HomePage />)
    await resolveSplash()

    expect(screen.getByText(UI.gateError.title)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: UI.common.tryAgain })).toBeInTheDocument()
  })
})

describe('HomePage — registration submit (AC-F2 / SC-F2)', () => {
  beforeEach(() => {
    mockInitLiff.mockResolvedValue({ displayName: 'Alice', userId: 'U1' })
    mockGetStatus.mockResolvedValue({ access: 'UNREGISTERED', registration: null })
  })

  it('submits the id-based DTO with the bearer token and moves to Pending', async () => {
    mockRegister.mockResolvedValue({ access: 'PENDING', registration: registration() })
    render(<HomePage />)
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
        staffId: VALID_STAFF_ID,
        phone: VALID_PHONE,
        departmentId: 1,
        personnelRoleId: 10,
      },
      TOKEN,
    )
    expect(screen.getByText(UI.pending.title)).toBeInTheDocument()
  })

  it('blocks submit and shows field errors when required fields are empty', async () => {
    render(<HomePage />)
    await resolveSplash()

    fireEvent.click(screen.getByRole('button', { name: UI.registration.createSubmit }))
    await flush()

    expect(mockRegister).not.toHaveBeenCalled()
    expect(screen.getByText(UI.registration.firstNameRequired)).toBeInTheDocument()
    expect(screen.getByText(UI.registration.departmentRequired)).toBeInTheDocument()
  })

  it('surfaces a 409 (staff ID taken) as a non-crashing error, staying on the form', async () => {
    mockRegister.mockRejectedValue(new apiClient.ApiError(409, 'STAFF_ID_TAKEN'))
    render(<HomePage />)
    await resolveSplash()

    fillRegistration()
    fireEvent.click(screen.getByRole('button', { name: UI.registration.createSubmit }))
    await flush()

    expect(screen.getByRole('button', { name: UI.registration.createSubmit })).toBeInTheDocument()
    expect(screen.getByText('STAFF_ID_TAKEN')).toBeInTheDocument()
  })
})

describe('HomePage — PENDING self-edit (SC-F3)', () => {
  beforeEach(() => {
    mockInitLiff.mockResolvedValue({ displayName: 'Alice', userId: 'U1' })
    mockGetStatus.mockResolvedValue({ access: 'PENDING', registration: registration() })
  })

  it('Edit → pre-fills the form, PATCHes edited values, and returns to Pending', async () => {
    const edited = registration({ firstName: 'Somsak' })
    mockUpdate.mockResolvedValue({ access: 'PENDING', registration: edited })
    render(<HomePage />)
    await resolveSplash()

    fireEvent.click(screen.getByRole('button', { name: UI.pending.edit }))
    await flush()

    // Pre-filled from the existing registration — the numeric option id is
    // stringified so the <select> keeps the current option selected.
    expect(screen.getByLabelText(UI.registration.firstName)).toHaveValue('Somchai')
    expect(screen.getByLabelText(UI.registration.staffId)).toHaveValue(VALID_STAFF_ID)
    expect(screen.getByLabelText(UI.registration.department)).toHaveValue('1')

    fireEvent.change(screen.getByLabelText(UI.registration.firstName), { target: { value: 'Somsak' } })
    fireEvent.click(screen.getByRole('button', { name: UI.registration.editSubmit }))
    await flush()

    // Regression guard: the edit PATCH also carries NUMERIC option ids.
    expect(mockUpdate).toHaveBeenCalledWith(
      {
        firstName: 'Somsak',
        lastName: 'Jaidee',
        staffId: VALID_STAFF_ID,
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
    render(<HomePage />)
    await resolveSplash()

    fireEvent.click(screen.getByRole('button', { name: UI.pending.edit }))
    await flush()
    fireEvent.click(screen.getByRole('button', { name: UI.registration.editSubmit }))
    await flush()

    expect(screen.getByText(UI.registration.editError.notEditable)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: UI.registration.editSubmit })).toBeInTheDocument()
  })

  it('renders a 409 (staff ID taken) inline on edit', async () => {
    mockUpdate.mockRejectedValue(new apiClient.ApiError(409, 'STAFF_ID_TAKEN'))
    render(<HomePage />)
    await resolveSplash()

    fireEvent.click(screen.getByRole('button', { name: UI.pending.edit }))
    await flush()
    fireEvent.click(screen.getByRole('button', { name: UI.registration.editSubmit }))
    await flush()

    expect(screen.getByText('STAFF_ID_TAKEN')).toBeInTheDocument()
  })

  it('renders a 400 (deleted/invalid option) inline on edit', async () => {
    mockUpdate.mockRejectedValue(new apiClient.ApiError(400, 'INVALID_DEPARTMENT'))
    render(<HomePage />)
    await resolveSplash()

    fireEvent.click(screen.getByRole('button', { name: UI.pending.edit }))
    await flush()
    fireEvent.click(screen.getByRole('button', { name: UI.registration.editSubmit }))
    await flush()

    expect(screen.getByText('INVALID_DEPARTMENT')).toBeInTheDocument()
  })

  it('Cancel returns to Pending without calling the backend', async () => {
    render(<HomePage />)
    await resolveSplash()

    fireEvent.click(screen.getByRole('button', { name: UI.pending.edit }))
    await flush()
    fireEvent.click(screen.getByRole('button', { name: UI.registration.cancel }))
    await flush()

    expect(mockUpdate).not.toHaveBeenCalled()
    expect(screen.getByText(UI.pending.title)).toBeInTheDocument()
  })
})

describe('HomePage — in-client behaviour', () => {
  it('in-client + signed out → calls liff.login() and keeps the splash up', async () => {
    mockIsInLineClient.mockReturnValue(true)
    mockIsLoggedIn.mockReturnValue(false)
    mockInitLiff.mockResolvedValue(null)
    render(<HomePage />)

    await resolveSplash()

    expect(mockLogin).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status', { name: UI.splash.loading })).toBeInTheDocument()
    expect(mockGetStatus).not.toHaveBeenCalled()
  })

  it('in-client + signed in + ALLOWED → greets without calling login()', async () => {
    mockIsInLineClient.mockReturnValue(true)
    mockIsLoggedIn.mockReturnValue(true)
    mockInitLiff.mockResolvedValue({ displayName: 'Bob', userId: 'U456' })
    mockGetStatus.mockResolvedValue({ access: 'ALLOWED', registration: null })
    render(<HomePage />)

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
    render(<HomePage />)
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
    render(<HomePage />)
    await resolveSplash()

    // Loud, labelled alert with the exact support message.
    const alert = screen.getByRole('alert', { name: /authentication failed/i })
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
