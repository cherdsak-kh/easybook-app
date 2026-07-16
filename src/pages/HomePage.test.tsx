import { act } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { HomePage } from '@/pages/HomePage'
import * as liffLib from '@/lib/liff'
import * as apiClient from '@/lib/api-client'
import type { LineUserRegistration, RegistrationOptions } from '@/lib/api-client'

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
/** OBS-2 auth-error copy — must match HomePage's AuthErrorScreen verbatim. */
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
    staffId: '6412345678901',
    phone: '0812345678',
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
  fireEvent.change(screen.getByLabelText('ชื่อจริง'), { target: { value: 'Somchai' } })
  fireEvent.change(screen.getByLabelText('นามสกุล'), { target: { value: 'Jaidee' } })
  fireEvent.change(screen.getByLabelText('รหัสบุคลากร'), { target: { value: '6412345678901' } })
  fireEvent.change(screen.getByLabelText('เบอร์โทรศัพท์'), { target: { value: '0812345678' } })
  // <select> values are DOM strings — the stringified integer option ids.
  fireEvent.change(screen.getByLabelText('ฝ่าย / แผนก'), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('ตำแหน่ง / บทบาท'), { target: { value: '10' } })
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
    expect(screen.getByRole('status', { name: 'Loading EasyBook' })).toBeInTheDocument()
    expect(screen.queryByText(/Hello,/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /เข้าสู่ระบบด้วย LINE/ })).not.toBeInTheDocument()
  })

  it('uses the wordmark logo on the splash in a web browser', () => {
    mockIsInLineClient.mockReturnValue(false)
    render(<HomePage />)
    expect(screen.getByAltText('EasyBook')).toHaveAttribute('src', WORDMARK_LOGO)
  })

  it('uses the square mark logo on the splash inside the LINE client', () => {
    mockIsInLineClient.mockReturnValue(true)
    render(<HomePage />)
    expect(screen.getByAltText('EasyBook')).toHaveAttribute('src', MARK_LOGO)
  })
})

describe('HomePage — web login card', () => {
  it('web + signed out → shows the LINE login card after the splash resolves', async () => {
    render(<HomePage />)
    await resolveSplash()

    expect(screen.getByRole('button', { name: /เข้าสู่ระบบด้วย LINE/ })).toBeInTheDocument()
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('login button triggers liff.login() when a LIFF id is configured', async () => {
    render(<HomePage />)
    await resolveSplash()

    fireEvent.click(screen.getByRole('button', { name: /เข้าสู่ระบบด้วย LINE/ }))

    expect(mockLogin).toHaveBeenCalledTimes(1)
  })
})

describe('HomePage — friendship gate (AC-F)', () => {
  it('friendFlag:false → shows the Add-Friend screen with the OA QR', async () => {
    mockInitLiff.mockResolvedValue({ displayName: 'Alice', userId: 'U1' })
    mockGetFriendship.mockResolvedValue({ friendFlag: false })
    render(<HomePage />)

    await resolveSplash()

    expect(
      screen.getByAltText('QR code to add the EasyBook LINE Official Account'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ตรวจสอบสถานะการเพิ่มเพื่อน/ })).toBeInTheDocument()
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

    fireEvent.click(screen.getByRole('button', { name: /ตรวจสอบสถานะการเพิ่มเพื่อน/ }))
    await flush()

    expect(mockGetStatus).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Hello, Alice/)).toBeInTheDocument()
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

    expect(screen.getByRole('button', { name: 'ยืนยันการลงทะเบียน' })).toBeInTheDocument()
    expect(mockGetStatus).toHaveBeenCalledWith(TOKEN)
    // Options were fetched with the bearer token and rendered as <option>s.
    expect(mockGetOptions).toHaveBeenCalledWith(TOKEN)
    const dept = screen.getByLabelText('ฝ่าย / แผนก') as HTMLSelectElement
    expect(within(dept).getByRole('option', { name: 'Computer Science' })).toBeInTheDocument()
    expect(within(dept).getByRole('option', { name: 'Mathematics' })).toBeInTheDocument()
    const role = screen.getByLabelText('ตำแหน่ง / บทบาท') as HTMLSelectElement
    expect(within(role).getByRole('option', { name: 'Teacher' })).toBeInTheDocument()
  })

  it('PENDING → shows the pending screen with an Edit affordance', async () => {
    mockGetStatus.mockResolvedValue({ access: 'PENDING', registration: registration() })
    render(<HomePage />)
    await resolveSplash()

    expect(screen.getByText(/รอการอนุมัติลงทะเบียน/)).toBeInTheDocument()
    expect(
      screen.getByText(/โปรดรอผู้ดูแลระบบพิจารณาอนุมัติสิทธิ์การเข้าใช้งาน/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'แก้ไขข้อมูลลงทะเบียน' })).toBeInTheDocument()
  })

  it('ALLOWED → shows the greeting', async () => {
    mockGetStatus.mockResolvedValue({ access: 'ALLOWED', registration: null })
    render(<HomePage />)
    await resolveSplash()

    expect(screen.getByText(/Hello, Alice/)).toBeInTheDocument()
  })

  it('BLOCKED → shows the suspended screen', async () => {
    mockGetStatus.mockResolvedValue({ access: 'BLOCKED', registration: null })
    render(<HomePage />)
    await resolveSplash()

    expect(screen.getByText(/Account suspended/i)).toBeInTheDocument()
    expect(screen.getByText(/contact the administration/i)).toBeInTheDocument()
  })

  it('a failing status call → shows the error screen with a retry', async () => {
    mockGetStatus.mockRejectedValue(new apiClient.ApiError(500, 'boom'))
    render(<HomePage />)
    await resolveSplash()

    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
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
    fireEvent.click(screen.getByRole('button', { name: 'ยืนยันการลงทะเบียน' }))
    await flush()

    // Regression guard: the option ids must be submitted as NUMBERS (the backend
    // now validates them with `@IsInt()` and 400s a stringified id).
    expect(mockRegister).toHaveBeenCalledWith(
      {
        firstName: 'Somchai',
        lastName: 'Jaidee',
        staffId: '6412345678901',
        phone: '0812345678',
        departmentId: 1,
        personnelRoleId: 10,
      },
      TOKEN,
    )
    expect(screen.getByText(/รอการอนุมัติลงทะเบียน/)).toBeInTheDocument()
  })

  it('blocks submit and shows field errors when required fields are empty', async () => {
    render(<HomePage />)
    await resolveSplash()

    fireEvent.click(screen.getByRole('button', { name: 'ยืนยันการลงทะเบียน' }))
    await flush()

    expect(mockRegister).not.toHaveBeenCalled()
    expect(screen.getByText('โปรดระบุชื่อจริง')).toBeInTheDocument()
    expect(screen.getByText('โปรดเลือกฝ่าย/แผนก')).toBeInTheDocument()
  })

  it('surfaces a 409 (staff ID taken) as a non-crashing error, staying on the form', async () => {
    mockRegister.mockRejectedValue(new apiClient.ApiError(409, 'STAFF_ID_TAKEN'))
    render(<HomePage />)
    await resolveSplash()

    fillRegistration()
    fireEvent.click(screen.getByRole('button', { name: 'ยืนยันการลงทะเบียน' }))
    await flush()

    expect(screen.getByRole('button', { name: 'ยืนยันการลงทะเบียน' })).toBeInTheDocument()
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

    fireEvent.click(screen.getByRole('button', { name: 'แก้ไขข้อมูลลงทะเบียน' }))
    await flush()

    // Pre-filled from the existing registration — the numeric option id is
    // stringified so the <select> keeps the current option selected.
    expect(screen.getByLabelText('ชื่อจริง')).toHaveValue('Somchai')
    expect(screen.getByLabelText('รหัสบุคลากร')).toHaveValue('6412345678901')
    expect(screen.getByLabelText('ฝ่าย / แผนก')).toHaveValue('1')

    fireEvent.change(screen.getByLabelText('ชื่อจริง'), { target: { value: 'Somsak' } })
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกข้อมูล' }))
    await flush()

    // Regression guard: the edit PATCH also carries NUMERIC option ids.
    expect(mockUpdate).toHaveBeenCalledWith(
      {
        firstName: 'Somsak',
        lastName: 'Jaidee',
        staffId: '6412345678901',
        phone: '0812345678',
        departmentId: 1,
        personnelRoleId: 10,
      },
      TOKEN,
    )
    // Back on the Pending screen with the refreshed name.
    expect(screen.getByText(/รอการอนุมัติลงทะเบียน/)).toBeInTheDocument()
    expect(screen.getByText('Somsak Jaidee')).toBeInTheDocument()
  })

  it('renders a 403 (no longer PENDING) as a refresh prompt, staying on the form', async () => {
    mockUpdate.mockRejectedValue(new apiClient.ApiError(403, 'REGISTRATION_NOT_EDITABLE'))
    render(<HomePage />)
    await resolveSplash()

    fireEvent.click(screen.getByRole('button', { name: 'แก้ไขข้อมูลลงทะเบียน' }))
    await flush()
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกข้อมูล' }))
    await flush()

    expect(screen.getByText(/can no longer be edited/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'บันทึกข้อมูล' })).toBeInTheDocument()
  })

  it('renders a 409 (staff ID taken) inline on edit', async () => {
    mockUpdate.mockRejectedValue(new apiClient.ApiError(409, 'STAFF_ID_TAKEN'))
    render(<HomePage />)
    await resolveSplash()

    fireEvent.click(screen.getByRole('button', { name: 'แก้ไขข้อมูลลงทะเบียน' }))
    await flush()
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกข้อมูล' }))
    await flush()

    expect(screen.getByText('STAFF_ID_TAKEN')).toBeInTheDocument()
  })

  it('renders a 400 (deleted/invalid option) inline on edit', async () => {
    mockUpdate.mockRejectedValue(new apiClient.ApiError(400, 'INVALID_DEPARTMENT'))
    render(<HomePage />)
    await resolveSplash()

    fireEvent.click(screen.getByRole('button', { name: 'แก้ไขข้อมูลลงทะเบียน' }))
    await flush()
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกข้อมูล' }))
    await flush()

    expect(screen.getByText('INVALID_DEPARTMENT')).toBeInTheDocument()
  })

  it('Cancel returns to Pending without calling the backend', async () => {
    render(<HomePage />)
    await resolveSplash()

    fireEvent.click(screen.getByRole('button', { name: 'แก้ไขข้อมูลลงทะเบียน' }))
    await flush()
    fireEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }))
    await flush()

    expect(mockUpdate).not.toHaveBeenCalled()
    expect(screen.getByText(/รอการอนุมัติลงทะเบียน/)).toBeInTheDocument()
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
    expect(screen.getByRole('status', { name: 'Loading EasyBook' })).toBeInTheDocument()
    expect(mockGetStatus).not.toHaveBeenCalled()
  })

  it('in-client + signed in + ALLOWED → greets without calling login()', async () => {
    mockIsInLineClient.mockReturnValue(true)
    mockIsLoggedIn.mockReturnValue(true)
    mockInitLiff.mockResolvedValue({ displayName: 'Bob', userId: 'U456' })
    mockGetStatus.mockResolvedValue({ access: 'ALLOWED', registration: null })
    render(<HomePage />)

    await resolveSplash()

    expect(screen.getByText(/Hello, Bob/)).toBeInTheDocument()
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
    fireEvent.click(screen.getByRole('button', { name: /เข้าสู่ระบบด้วย LINE/ }))
    await flush()

    // Status short-circuits to a mock UNREGISTERED → the registration form, whose
    // dropdowns are populated by the mock options (no backend call).
    expect(screen.getByRole('button', { name: 'ยืนยันการลงทะเบียน' })).toBeInTheDocument()
    expect(mockGetStatus).not.toHaveBeenCalled()
    expect(mockGetOptions).not.toHaveBeenCalled()
    expect(screen.getByLabelText('ฝ่าย / แผนก')).toBeInTheDocument()

    // A mock submit transitions to Pending WITHOUT hitting the backend.
    fillRegistration()
    fireEvent.click(screen.getByRole('button', { name: 'ยืนยันการลงทะเบียน' }))
    await flush()

    expect(mockRegister).not.toHaveBeenCalled()
    expect(screen.getByText(/รอการอนุมัติลงทะเบียน/)).toBeInTheDocument()
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
    expect(screen.queryByRole('button', { name: 'ยืนยันการลงทะเบียน' })).not.toBeInTheDocument()
  })
})
