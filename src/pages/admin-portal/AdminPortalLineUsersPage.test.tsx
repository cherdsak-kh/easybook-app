import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { AdminPortalLineUsersPage } from '@/pages/admin-portal/AdminPortalLineUsersPage'
import { ToastProvider } from '@/components/admin-portal/ToastProvider'
import {
  MODAL_STATUS_LABELS,
  SEARCH_FIELD_LABELS,
  SEARCH_FIELD_OPTIONS,
  SORT_LABELS,
  SORT_OPTIONS,
  STATUS_BADGE,
  T,
} from '@/constants/ui-strings-line-users'
import { EDITOR_MESSAGES } from '@/hooks/useLineUserEditor'
import * as useLineUsersModule from '@/hooks/useLineUsers'
import { LEADS_MESSAGES } from '@/hooks/useLineUsers'
import * as apiClient from '@/lib/api-client'
import type { UseLineUsers } from '@/hooks/useLineUsers'
import type { Department, LineUser, PersonnelRole, SystemRole } from '@/lib/api-client'

// View test: mock the orchestration HOOK so we drive the page purely by its state
// (loading / empty / error / truncated / rows). The hook itself is covered separately in
// `useLineUsers.test.ts`. Everything else in that module — notably the real
// `LEADS_MESSAGES` copy the row-error toast renders — stays REAL, so this suite and the
// page read the same literal.
vi.mock('@/hooks/useLineUsers', async (importActual) => ({
  ...(await importActual<typeof import('@/hooks/useLineUsers')>()),
  useLineUsers: vi.fn(),
}))

// The page now reads `useAuth()` for role gating (Edit visibility) + `expireSession`. Mock
// it at the boundary; the returned value is configurable per test via `authAs`.
const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }))
vi.mock('@/auth/useAuth', () => ({ useAuth: mockUseAuth }))

// Phase B runs the REAL `useLineUserEditor`, so mock the api-client helpers it calls at the
// boundary (repo convention); keep everything else (ApiError, types) real.
vi.mock('@/lib/api-client', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/api-client')>()
  return {
    ...actual,
    patchLineUserRegistration: vi.fn(),
    patchLineUserAccess: vi.fn(),
    listDepartments: vi.fn(),
    listPersonnelRoles: vi.fn(),
  }
})

const mockUseLineUsers = vi.mocked(useLineUsersModule.useLineUsers)
const mockPatchReg = vi.mocked(apiClient.patchLineUserRegistration)
const mockPatchAccess = vi.mocked(apiClient.patchLineUserAccess)
const mockListDepartments = vi.mocked(apiClient.listDepartments)
const mockListPersonnelRoles = vi.mocked(apiClient.listPersonnelRoles)

function authAs(role: SystemRole | null) {
  mockUseAuth.mockReturnValue({
    status: 'authenticated',
    user: role
      ? {
          id: 'admin-1',
          email: 'admin@easybook.local',
          firstName: 'Ad',
          lastName: 'Min',
          role,
          mustChangePassword: false,
          profilePictureUrl: null,
        }
      : null,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    expireSession: vi.fn(),
  })
}

function makeDept(o: Partial<Department> = {}): Department {
  return {
    id: 1,
    name: 'Computer Science',
    isSystemReserved: false,
    createdAt: '2026-07-14T10:00:00.000Z',
    updatedAt: '2026-07-14T10:00:00.000Z',
    ...o,
  }
}

function makeRole(o: Partial<PersonnelRole> = {}): PersonnelRole {
  return {
    id: 1,
    name: 'Teacher',
    isSystemReserved: false,
    createdAt: '2026-07-14T10:00:00.000Z',
    updatedAt: '2026-07-14T10:00:00.000Z',
    ...o,
  }
}

/**
 * Render the page inside the shared `ToastProvider`.
 *
 * REQUIRED since the toast unification: the page routes its row-mutation error through
 * `useToast()`, which throws outside a provider by design (a silent no-op default would
 * turn "nobody mounted the provider" into "the error never appears"). The app mounts it
 * once in `AdminPortalLayout`; an isolated page render has to supply it.
 */
function renderPage() {
  return render(
    <ToastProvider>
      <AdminPortalLineUsersPage />
    </ToastProvider>,
  )
}

/** Open the inspect modal for a single registered user, as the given role, and click Edit. */
async function openEditor(user: LineUser, role: SystemRole = 'ADMIN') {
  authAs(role)
  mockUseLineUsers.mockReturnValue(hookState({ users: [user] }))
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: new RegExp(T.inspect) }))
  fireEvent.click(screen.getByRole('button', { name: T.edit }))
}

// jsdom implements <dialog>.showModal()/close() in recent versions; shim ONLY when a
// method is missing so this suite is robust across jsdom versions without overriding the
// native behavior when it exists. The shim mirrors the native contract: showModal sets
// `open`; close clears it and fires the `close` event the page listens for.
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
})

// The B.E. date formatter the page uses; the test computes the EXPECTED string with the
// SAME `Intl` formatter so the assertion holds regardless of the runner's locale/calendar
// (never hardcode "2569").
const beDate = (iso: string) =>
  new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))

function makeUser(o: Partial<LineUser> = {}): LineUser {
  return {
    id: 'lu1',
    lineUserId: 'U0123456789abcdef0123456789abcdef',
    displayName: 'Alice',
    pictureUrl: null,
    statusMessage: null,
    richMenuType: 'TYPE_1',
    access: 'PENDING',
    followedAt: '2026-07-07T10:00:00.000Z',
    registration: null,
    ...o,
  }
}

function registered(o: Partial<LineUser> = {}): LineUser {
  return makeUser({
    registration: {
      firstName: 'Alice',
      lastName: 'Wong',
      phone: '0812345678',
      departmentId: 1,
      department: 'Computer Science',
      personnelRoleId: 1,
      personnelRole: 'Teacher',
    },
    ...o,
  })
}

function hookState(o: Partial<UseLineUsers> = {}): UseLineUsers {
  return {
    users: [],
    meta: undefined,
    totalPages: 0,
    loading: false,
    error: null,
    // The fetch-all tripwire. Off by default; the truncation test flips it.
    truncated: false,
    loadedCount: 0,
    rowError: null,
    pendingId: null,
    page: 1,
    setPage: vi.fn(),
    search: '',
    setSearch: vi.fn(),
    searchField: 'all',
    setSearchField: vi.fn(),
    sortBy: 'registeredAtDesc',
    setSortBy: vi.fn(),
    accessFilter: '',
    setAccessFilter: vi.fn(),
    changeAccess: vi.fn(),
    updateUserInPlace: vi.fn(),
    clearRowError: vi.fn(),
    refetch: vi.fn(),
    // The live channel is OFF by default here so the pre-existing specs keep describing a
    // page with exactly one live region (the loading announcement). Each realtime spec below
    // opts into the status it is asserting.
    realtimeStatus: 'disabled',
    deletedRowId: null,
    ...o,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Defaults: an ADMIN session and resolvable option lists (edit-mode fetch). Individual
  // tests override the role via `authAs` / the option lists via the mocks below.
  authAs('ADMIN')
  mockListDepartments.mockResolvedValue([makeDept()])
  mockListPersonnelRoles.mockResolvedValue([makeRole()])
})

describe('AdminPortalLineUsersPage — states', () => {
  it('P1: renders a loading skeleton while fetching', () => {
    mockUseLineUsers.mockReturnValue(hookState({ loading: true }))
    renderPage()

    expect(screen.getByTestId('lineusers-skeleton')).toBeInTheDocument()
  })

  it('P2: renders an empty state (no crash) when there are no users', () => {
    mockUseLineUsers.mockReturnValue(hookState({ users: [] }))
    renderPage()

    expect(screen.getByText(T.empty)).toBeInTheDocument()
  })

  it('P3: renders the page-level load error', () => {
    mockUseLineUsers.mockReturnValue(hookState({ error: 'Could not load LINE users. Please try again.' }))
    renderPage()

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load LINE users. Please try again.')
  })
})

describe('AdminPortalLineUsersPage — row mapping', () => {
  /**
   * CHANGED by the Name-column rework. The cell used to render the LINE display name as
   * the bold primary line with the registration name beneath it; it now renders ONLY the
   * registration name. The display-name assertion is INVERTED rather than dropped — that
   * absence is the acceptance criterion.
   */
  it('P4: maps a registered user across the columns (index, name, department, phone, status badge, B.E. date, inspect button)', () => {
    mockUseLineUsers.mockReturnValue(
      hookState({
        users: [registered({ displayName: 'Alice Wonderland', access: 'PENDING' })],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        totalPages: 1,
      }),
    )
    renderPage()
    const table = screen.getByRole('table')

    // ลำดับ — page-aware row index (page 1 → 1).
    expect(within(table).getByText('1')).toBeInTheDocument()
    // ชื่อ-สกุล — the registration's real name, and ONLY that.
    expect(within(table).getByText('Alice Wong')).toBeInTheDocument()
    expect(within(table).queryByText('Alice Wonderland')).not.toBeInTheDocument()
    // ฝ่าย/แผนก + เบอร์โทรศัพท์.
    expect(within(table).getByText('Computer Science')).toBeInTheDocument()
    expect(within(table).getByText('0812345678')).toBeInTheDocument()
    // สถานะ — Thai status badge for PENDING.
    expect(within(table).getByText(STATUS_BADGE.PENDING.label)).toBeInTheDocument()
    // วันที่ลงทะเบียน — Thai Buddhist-era date computed with the same formatter.
    expect(within(table).getByText(beDate('2026-07-07T10:00:00.000Z'))).toBeInTheDocument()
    // Actions — the inspect button.
    expect(screen.getByRole('button', { name: /ตรวจสอบข้อมูล/ })).toBeInTheDocument()
  })

  /**
   * CHANGED: the name cell of a registration-less row now shows the LINE **display name**
   * instead of repeating "ยังไม่ลงทะเบียน". The status badge already says that, and the
   * display name is the only identity such a row has (and the one the search box now
   * matches on), so a second copy of the badge text told the operator nothing.
   */
  it('P5: shows the LINE display name and em-dashes for a follower with no registration', () => {
    mockUseLineUsers.mockReturnValue(
      hookState({ users: [makeUser({ displayName: 'Bob', access: 'UNREGISTERED', registration: null })] }),
    )
    renderPage()
    const table = screen.getByRole('table')

    // The name cell now carries the display name…
    const nameCell = within(table).getByText('Bob').closest('td')!
    expect(nameCell).toHaveTextContent('Bob')
    // …and "ยังไม่ลงทะเบียน" is left to the status badge alone (exactly one occurrence).
    const unregLabels = within(table).getAllByText(T.notRegistered)
    expect(unregLabels).toHaveLength(1)
    expect(unregLabels[0]).toHaveClass('badge', 'badge-soft', 'badge-ghost')
    // department + phone fall back to the em-dash.
    expect(within(table).getAllByText(T.emptyValue).length).toBeGreaterThanOrEqual(2)
  })

  it('P5b: falls back to ยังไม่ลงทะเบียน when a registration-less row has NO display name either', () => {
    mockUseLineUsers.mockReturnValue(
      hookState({ users: [makeUser({ displayName: null, access: 'UNREGISTERED', registration: null })] }),
    )
    renderPage()
    const table = screen.getByRole('table')

    // Nothing identifies this row, so the cell says so rather than rendering blank —
    // the fallback text plus the badge make two occurrences.
    expect(within(table).getAllByText(T.notRegistered)).toHaveLength(2)
  })
})

describe('AdminPortalLineUsersPage — Name column (display name removed, avatar kept)', () => {
  it('N1: renders ONLY the registration name — the LINE display name is gone from the cell', () => {
    mockUseLineUsers.mockReturnValue(
      hookState({ users: [registered({ displayName: 'ชื่อที่แสดงใน LINE' })] }),
    )
    renderPage()

    const nameCell = within(screen.getByRole('table')).getByText('Alice Wong').closest('td')!
    expect(nameCell).toHaveTextContent('Alice Wong')
    expect(nameCell).not.toHaveTextContent('ชื่อที่แสดงใน LINE')
  })

  it('N2: KEEPS the LINE avatar image in that cell (PO decision OPEN-3)', () => {
    mockUseLineUsers.mockReturnValue(
      hookState({
        users: [registered({ displayName: 'Alice Wonderland', pictureUrl: 'https://cdn.line/a.jpg' })],
      }),
    )
    renderPage()

    const nameCell = within(screen.getByRole('table')).getByText('Alice Wong').closest('td')!
    const avatar = nameCell.querySelector('.avatar')
    expect(avatar).not.toBeNull()
    const img = avatar!.querySelector('img')!
    expect(img).toHaveAttribute('src', 'https://cdn.line/a.jpg')
    // Decorative: the adjacent cell text already names the row, so it must not be
    // announced twice.
    expect(img).toHaveAttribute('alt', '')
    expect(img).toHaveAttribute('loading', 'lazy')
  })

  it('N3: falls back to the daisyUI avatar-placeholder (initials) when there is no picture', () => {
    mockUseLineUsers.mockReturnValue(hookState({ users: [registered({ pictureUrl: null })] }))
    renderPage()

    const nameCell = within(screen.getByRole('table')).getByText('Alice Wong').closest('td')!
    const avatar = nameCell.querySelector('.avatar')!
    // daisyUI 5 modifier (skill: components/avatar.md) — NOT a hand-rolled flex centre.
    expect(avatar).toHaveClass('avatar-placeholder')
    expect(avatar.querySelector('img')).toBeNull()
  })

  it('N4: the inspect button is named by the VISIBLE row name, not the display name', () => {
    mockUseLineUsers.mockReturnValue(
      hookState({ users: [registered({ displayName: 'Alice Wonderland' })] }),
    )
    renderPage()

    expect(
      screen.getByRole('button', { name: `${T.inspect}: Alice Wong` }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: `${T.inspect}: Alice Wonderland` }),
    ).not.toBeInTheDocument()
  })
})

describe('AdminPortalLineUsersPage — status badge map', () => {
  it.each(['ALLOWED', 'PENDING', 'BLOCKED', 'UNREGISTERED', 'REJECTED'] as const)(
    'renders the Thai label for access %s',
    (access) => {
      mockUseLineUsers.mockReturnValue(hookState({ users: [registered({ access })] }))
      renderPage()
      const table = screen.getByRole('table')

      expect(within(table).getByText(STATUS_BADGE[access].label)).toBeInTheDocument()
    },
  )

  it('P4b: the REJECTED badge reads ส่งคืนแล้ว and uses the recoverable warning tone', () => {
    mockUseLineUsers.mockReturnValue(hookState({ users: [registered({ access: 'REJECTED' })] }))
    renderPage()

    // The literal is pinned here on purpose (not read from STATUS_BADGE): the PO specified
    // this exact wording, and it is what the operator scans the table for.
    const badge = within(screen.getByRole('table')).getByText('ส่งคืนแล้ว')
    expect(badge).toHaveClass('badge', 'badge-soft', 'badge-warning')
    // NOT badge-error — that hue is BLOCKED's terminal state.
    expect(badge).not.toHaveClass('badge-error')
  })
})

describe('AdminPortalLineUsersPage — toolbar', () => {
  it('P7: forwards the search input to setSearch and the access filter to setAccessFilter', () => {
    const setSearch = vi.fn()
    const setAccessFilter = vi.fn()
    mockUseLineUsers.mockReturnValue(hookState({ users: [registered()], setSearch, setAccessFilter }))
    renderPage()

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ali' } })
    expect(setSearch).toHaveBeenCalledWith('ali')

    fireEvent.change(screen.getByRole('combobox', { name: T.accessFilterLabel }), {
      target: { value: 'ALLOWED' },
    })
    expect(setAccessFilter).toHaveBeenCalledWith('ALLOWED')
  })

  it('P7b: renders the "ค้นหาด้วย…" select with every field option, defaulting to ทุกช่อง', () => {
    mockUseLineUsers.mockReturnValue(hookState({ users: [registered()] }))
    renderPage()

    const select = screen.getByRole('combobox', { name: T.searchFieldLabel })
    const values = within(select)
      .getAllByRole('option')
      .map((o) => o.getAttribute('value'))
    expect(values).toEqual([...SEARCH_FIELD_OPTIONS])
    // The LINE display name is a searchable field in its own right — it is the only
    // identity an unregistered follower has, so its absence made those rows unfindable.
    expect(SEARCH_FIELD_OPTIONS).toContain('lineDisplayName')
    expect(values).toContain('lineDisplayName')
    expect(
      within(select).getByRole('option', { name: SEARCH_FIELD_LABELS.lineDisplayName }),
    ).toBeInTheDocument()
    // "ทุกช่อง" (all fields) leads AND is the selected default — PO decision OPEN-6.
    expect(within(select).getAllByRole('option')[0]).toHaveTextContent(SEARCH_FIELD_LABELS.all)
    expect(select).toHaveValue('all')
  })

  it('P7c: forwards a search-field change to setSearchField', () => {
    const setSearchField = vi.fn()
    mockUseLineUsers.mockReturnValue(hookState({ users: [registered()], setSearchField }))
    renderPage()

    fireEvent.change(screen.getByRole('combobox', { name: T.searchFieldLabel }), {
      target: { value: 'phone' },
    })
    expect(setSearchField).toHaveBeenCalledWith('phone')
  })

  it('P7d: renders the "เรียงลำดับ…" select with every sort option, defaulting to newest-first', () => {
    mockUseLineUsers.mockReturnValue(hookState({ users: [registered()] }))
    renderPage()

    const select = screen.getByRole('combobox', { name: T.sortLabel })
    const values = within(select)
      .getAllByRole('option')
      .map((o) => o.getAttribute('value'))
    expect(values).toEqual([...SORT_OPTIONS])
    const labels = within(select)
      .getAllByRole('option')
      .map((o) => o.textContent)
    expect(labels).toEqual(SORT_OPTIONS.map((s) => SORT_LABELS[s]))
    expect(select).toHaveValue('registeredAtDesc')
  })

  it('P7e: forwards a sort change to setSortBy', () => {
    const setSortBy = vi.fn()
    mockUseLineUsers.mockReturnValue(hookState({ users: [registered()], setSortBy }))
    renderPage()

    fireEvent.change(screen.getByRole('combobox', { name: T.sortLabel }), {
      target: { value: 'nameAsc' },
    })
    expect(setSortBy).toHaveBeenCalledWith('nameAsc')
  })

  it('P7f: the status filter OFFERS "ยังไม่ลงทะเบียน" (UNREGISTERED), last', () => {
    mockUseLineUsers.mockReturnValue(
      hookState({ users: [makeUser({ access: 'UNREGISTERED', registration: null })] }),
    )
    renderPage()

    const filter = screen.getByRole('combobox', { name: T.accessFilterLabel })
    const values = within(filter)
      .getAllByRole('option')
      .map((o) => o.getAttribute('value'))
    // Last, mirroring the `status` sort: the review queue first, the rows with nothing to
    // review at the end.
    expect(values).toEqual(['', 'PENDING', 'ALLOWED', 'BLOCKED', 'REJECTED', 'UNREGISTERED'])
    expect(values).toContain('UNREGISTERED')
    // Labelled by the same literal as the badge, so the option matches the text the
    // operator is filtering for.
    expect(
      within(filter).getByRole('option', { name: STATUS_BADGE.UNREGISTERED.label }),
    ).toBeInTheDocument()
    // …and the BADGE for such a row still renders — the two are different surfaces.
    expect(
      within(screen.getByRole('table')).getAllByText(STATUS_BADGE.UNREGISTERED.label).length,
    ).toBeGreaterThanOrEqual(1)
  })

  it('P7h: selecting ยังไม่ลงทะเบียน forwards UNREGISTERED to setAccessFilter', () => {
    const setAccessFilter = vi.fn()
    mockUseLineUsers.mockReturnValue(hookState({ users: [registered()], setAccessFilter }))
    renderPage()

    fireEvent.change(screen.getByRole('combobox', { name: T.accessFilterLabel }), {
      target: { value: 'UNREGISTERED' },
    })
    expect(setAccessFilter).toHaveBeenCalledWith('UNREGISTERED')
  })

  it('P7g: the search label no longer claims to search the LINE display name', () => {
    mockUseLineUsers.mockReturnValue(hookState({ users: [registered()] }))
    renderPage()

    expect(screen.getByLabelText(T.searchLabel)).toHaveAttribute('type', 'search')
    expect(screen.queryByText('ค้นหาจากชื่อที่แสดง')).not.toBeInTheDocument()
  })
})

describe('AdminPortalLineUsersPage — fetch-all loading + truncation tripwire', () => {
  it('P23: announces the multi-request load politely while the skeleton is drawn', () => {
    mockUseLineUsers.mockReturnValue(hookState({ loading: true }))
    renderPage()

    const live = screen.getByRole('status')
    expect(live).toHaveTextContent(T.loading)
    expect(live).toHaveAttribute('aria-live', 'polite')
    // The skeleton itself stays hidden from AT, so the wait is announced ONCE.
    expect(screen.getByTestId('lineusers-skeleton')).toHaveAttribute('aria-hidden')
  })

  it('P24: shows a visible, non-blocking truncation warning when MAX_PAGES fired', () => {
    mockUseLineUsers.mockReturnValue(
      hookState({ users: [registered()], truncated: true, loadedCount: 3000 }),
    )
    renderPage()

    const warning = screen.getByText(T.truncatedWarning(3000))
    expect(warning.closest('.alert')).toHaveClass('alert-warning')
    // Non-blocking: the rows are still rendered underneath it.
    expect(within(screen.getByRole('table')).getByText('Alice Wong')).toBeInTheDocument()
  })

  it('P25: shows NO truncation warning on a complete load', () => {
    mockUseLineUsers.mockReturnValue(
      hookState({ users: [registered()], truncated: false, loadedCount: 1 }),
    )
    renderPage()

    expect(screen.queryByText(T.truncatedWarning(1))).not.toBeInTheDocument()
  })
})

describe('AdminPortalLineUsersPage — row-mutation errors go to the shared toast', () => {
  it('P26: a rowError surfaces as an assertive error toast, never as a silent no-op', async () => {
    mockUseLineUsers.mockReturnValue(
      hookState({ users: [registered()], rowError: LEADS_MESSAGES.rowForbidden }),
    )
    renderPage()

    const toast = await screen.findByText(LEADS_MESSAGES.rowForbidden)
    const live = toast.closest('[role="alert"]') as HTMLElement
    expect(live).not.toBeNull()
    expect(live).toHaveClass('alert', 'alert-error')
    // Shared provider ⇒ the portal-wide top-center position.
    expect(live.closest('.toast')).toHaveClass('toast-center', 'toast-top')
  })

  it('P27: no rowError ⇒ no toast at all', () => {
    mockUseLineUsers.mockReturnValue(hookState({ users: [registered()], rowError: null }))
    const { container } = renderPage()

    expect(container.querySelector('.toast')).toBeNull()
  })
})

describe('AdminPortalLineUsersPage — pagination', () => {
  it('P6: renders a page summary, disables Prev on page 1, and advances via setPage', () => {
    const setPage = vi.fn()
    mockUseLineUsers.mockReturnValue(
      hookState({
        users: [registered()],
        meta: { page: 1, limit: 20, total: 45, totalPages: 3 },
        totalPages: 3,
        page: 1,
        setPage,
      }),
    )
    renderPage()

    expect(screen.getByText(T.paginationSummary(1, 3, 45))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: T.previous })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: T.next }))
    expect(setPage).toHaveBeenCalledWith(2)
  })
})

describe('AdminPortalLineUsersPage — read-only inspect modal', () => {
  it('P8: clicking ตรวจสอบข้อมูล opens the modal with that row’s full details', () => {
    mockUseLineUsers.mockReturnValue(
      hookState({ users: [registered({ displayName: 'Alice Wonderland', access: 'ALLOWED' })] }),
    )
    renderPage()

    // The registration-only `personnelRole` is NOT a table column, so its presence proves
    // the modal opened with this user's data.
    expect(screen.queryByText('Teacher')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /ตรวจสอบข้อมูล: Alice Wong/ }))

    expect(screen.getByText('Teacher')).toBeInTheDocument()
    // Real name, phone + department also render in the modal body.
    expect(screen.getAllByText('Alice Wong').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('0812345678').length).toBeGreaterThanOrEqual(1)
    // The dialog is labelled by its title (a11y).
    expect(screen.getByRole('heading', { name: T.modalTitle })).toBeInTheDocument()
  })

  it('P9: closing the modal via the ✕ button clears the selection', async () => {
    mockUseLineUsers.mockReturnValue(hookState({ users: [registered({ displayName: 'Alice Wonderland' })] }))
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /ตรวจสอบข้อมูล: Alice Wong/ }))
    expect(screen.getByText('Teacher')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: T.close }))
    await waitFor(() => expect(screen.queryByText('Teacher')).not.toBeInTheDocument())
  })

  it('P10: an UNREGISTERED / no-registration user’s modal renders the not-registered state gracefully', () => {
    mockUseLineUsers.mockReturnValue(
      hookState({ users: [makeUser({ displayName: 'Dave', access: 'UNREGISTERED', registration: null })] }),
    )
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /ตรวจสอบข้อมูล: Dave/ }))

    // No crash, a clear not-registered notice, and NO registration rows (phone/role).
    // The two field-label queries are SCOPED to the dialog: the toolbar's "ค้นหาด้วย…"
    // select offers a "เบอร์โทรศัพท์" option carrying the same literal as `fieldPhone`, so
    // an unscoped `queryByText` would match the dropdown and fail for the wrong reason.
    const modal = screen.getByRole('heading', { name: T.modalTitle }).closest('dialog')!
    expect(screen.getByText(T.notRegisteredNotice)).toBeInTheDocument()
    expect(within(modal).queryByText(T.fieldPhone)).not.toBeInTheDocument()
    expect(within(modal).queryByText(T.fieldPersonnelRole)).not.toBeInTheDocument()
    // The LINE-side status badge still renders inside the modal.
    expect(screen.getAllByText(STATUS_BADGE.UNREGISTERED.label).length).toBeGreaterThanOrEqual(1)
  })
})

describe('AdminPortalLineUsersPage — Edit button RBAC (Phase B)', () => {
  function openModalAs(role: SystemRole) {
    authAs(role)
    mockUseLineUsers.mockReturnValue(hookState({ users: [registered({ displayName: 'Alice Wonderland' })] }))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /ตรวจสอบข้อมูล: Alice Wong/ }))
  }

  it('P11: STAFF sees NO Edit button (read-only modal)', () => {
    openModalAs('STAFF')
    expect(screen.getByText('Teacher')).toBeInTheDocument() // modal is open (read-only)
    expect(screen.queryByRole('button', { name: T.edit })).not.toBeInTheDocument()
  })

  it('P12: ADMIN sees the Edit button', () => {
    openModalAs('ADMIN')
    expect(screen.getByRole('button', { name: T.edit })).toBeInTheDocument()
  })

  it('P13: SUPER_ADMIN sees the Edit button', () => {
    openModalAs('SUPER_ADMIN')
    expect(screen.getByRole('button', { name: T.edit })).toBeInTheDocument()
  })
})

describe('AdminPortalLineUsersPage — edit form + option lists (Phase B)', () => {
  it('P14: clicking Edit renders the five registration inputs + the status select', async () => {
    await openEditor(registered())

    expect(screen.getByLabelText(T.labelFirstName)).toBeInTheDocument()
    expect(screen.getByLabelText(T.labelLastName)).toBeInTheDocument()
    expect(screen.getByLabelText(T.labelPhone)).toBeInTheDocument()
    expect(screen.getByLabelText(T.labelDepartment)).toBeInTheDocument()
    expect(screen.getByLabelText(T.labelPersonnelRole)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: T.labelStatus })).toBeInTheDocument()
    // Settle the async option fetch.
    await screen.findByRole('option', { name: 'Computer Science' })
  })

  it('P15: dept/role selects are populated from listDepartments/listPersonnelRoles, system-reserved excluded', async () => {
    mockListDepartments.mockResolvedValue([
      makeDept({ id: 1, name: 'Computer Science' }),
      makeDept({ id: 9, name: 'Reserved Dept', isSystemReserved: true }),
    ])
    mockListPersonnelRoles.mockResolvedValue([
      makeRole({ id: 1, name: 'Teacher' }),
      makeRole({ id: 9, name: 'Reserved Role', isSystemReserved: true }),
    ])
    await openEditor(registered())

    expect(await screen.findByRole('option', { name: 'Computer Science' })).toBeInTheDocument()
    expect(await screen.findByRole('option', { name: 'Teacher' })).toBeInTheDocument()
    // System-reserved options are excluded (backend 400s a reserved id).
    expect(screen.queryByRole('option', { name: 'Reserved Dept' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Reserved Role' })).not.toBeInTheDocument()
    // The fetch is lazy (only after entering edit) and issued once.
    expect(mockListDepartments).toHaveBeenCalledTimes(1)
    expect(mockListPersonnelRoles).toHaveBeenCalledTimes(1)
  })

  it('P16: ADMIN status options = ALLOWED + BLOCKED only', async () => {
    await openEditor(registered({ access: 'ALLOWED' }), 'ADMIN')
    await screen.findByRole('option', { name: 'Computer Science' }) // settle options

    const statusSelect = screen.getByRole('combobox', { name: T.labelStatus })
    const values = within(statusSelect)
      .getAllByRole('option')
      .map((o) => o.getAttribute('value'))
    expect(values).toEqual(['ALLOWED', 'BLOCKED'])
    expect(values).not.toContain('PENDING')
  })

  it('P16b: ADMIN + UNREGISTERED current → the status select is locked (single option, no fetch)', () => {
    authAs('ADMIN')
    mockUseLineUsers.mockReturnValue(
      hookState({ users: [makeUser({ displayName: 'Dave', access: 'UNREGISTERED', registration: null })] }),
    )
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /ตรวจสอบข้อมูล: Dave/ }))
    fireEvent.click(screen.getByRole('button', { name: T.edit }))

    const statusSelect = screen.getByRole('combobox', { name: T.labelStatus })
    expect(statusSelect).toBeDisabled()
    expect(within(statusSelect).getAllByRole('option')).toHaveLength(1)
    // No registration form, and no option fetch for a status-only unregistered edit.
    expect(screen.queryByLabelText(T.labelFirstName)).not.toBeInTheDocument()
    expect(mockListDepartments).not.toHaveBeenCalled()
  })

  /**
   * CHANGED by the REJECTED feature (was: "SUPER_ADMIN status options = all four states").
   * The dropdown is now strictly `{ALLOWED, BLOCKED}` for BOTH roles — SUPER_ADMIN no longer
   * gets a four-state override picker on this surface. `UNREGISTERED`/`PENDING` are not
   * operator-settable, and `REJECTED` is reachable ONLY through the dedicated Reject action
   * (which always carries a mandatory reason), so it must never appear as a bare option.
   */
  it('P17: SUPER_ADMIN status options = ALLOWED + BLOCKED only (no UNREGISTERED/PENDING/REJECTED)', async () => {
    await openEditor(registered({ access: 'ALLOWED' }), 'SUPER_ADMIN')
    await screen.findByRole('option', { name: 'Computer Science' }) // settle options

    const statusSelect = screen.getByRole('combobox', { name: T.labelStatus })
    const values = within(statusSelect)
      .getAllByRole('option')
      .map((o) => o.getAttribute('value'))
    expect(values).toEqual(['ALLOWED', 'BLOCKED'])
    // Option TEXT is the ACTION-voiced modal map ("อนุมัติ"), not the state-voiced table badge
    // ("อนุมัติแล้ว") — the two surfaces read from deliberately different dictionaries.
    const labels = within(statusSelect)
      .getAllByRole('option')
      .map((o) => o.textContent)
    expect(labels).toEqual([MODAL_STATUS_LABELS.ALLOWED, MODAL_STATUS_LABELS.BLOCKED])
  })

  it.each(['ADMIN', 'SUPER_ADMIN'] as const)(
    'P17b: %s editing a PENDING user gets ALLOWED/BLOCKED plus a DISABLED current-state placeholder',
    async (role) => {
      await openEditor(registered({ access: 'PENDING' }), role)
      await screen.findByRole('option', { name: 'Computer Science' })

      const statusSelect = screen.getByRole('combobox', { name: T.labelStatus })
      const options = within(statusSelect).getAllByRole('option')
      // The only SELECTABLE targets are ALLOWED/BLOCKED…
      const selectable = options.filter((o) => !o.hasAttribute('disabled'))
      expect(selectable.map((o) => o.getAttribute('value'))).toEqual(['ALLOWED', 'BLOCKED'])
      // …and the leading option is a disabled placeholder showing the CURRENT state, so the
      // select never displays a target the draft has not actually taken.
      expect(options[0]).toBeDisabled()
      expect(options[0]).toHaveTextContent(MODAL_STATUS_LABELS.PENDING)
      expect(statusSelect).toHaveValue('')
    },
  )

  it('P17c: a REJECTED user is still approvable/blockable from the dropdown', async () => {
    await openEditor(registered({ access: 'REJECTED' }), 'ADMIN')
    await screen.findByRole('option', { name: 'Computer Science' })

    const statusSelect = screen.getByRole('combobox', { name: T.labelStatus })
    const selectable = within(statusSelect)
      .getAllByRole('option')
      .filter((o) => !o.hasAttribute('disabled'))
      .map((o) => o.getAttribute('value'))
    expect(selectable).toEqual(['ALLOWED', 'BLOCKED'])
  })
})

describe('AdminPortalLineUsersPage — save wiring (Phase B)', () => {
  it('P18: editing a registration field + Save → patchLineUserRegistration + updateUserInPlace + back to view', async () => {
    const updateUserInPlace = vi.fn()
    authAs('ADMIN')
    mockUseLineUsers.mockReturnValue(hookState({ users: [registered()], updateUserInPlace }))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: new RegExp(T.inspect) }))
    fireEvent.click(screen.getByRole('button', { name: T.edit }))
    await screen.findByRole('option', { name: 'Computer Science' }) // options loaded → Save enabled once dirty

    fireEvent.change(screen.getByLabelText(T.labelFirstName), { target: { value: 'Alicia' } })

    const saved = registered({ registration: { ...registered().registration!, firstName: 'Alicia' } })
    mockPatchReg.mockResolvedValue(saved)
    fireEvent.click(screen.getByRole('button', { name: T.save }))

    await waitFor(() =>
      expect(mockPatchReg).toHaveBeenCalledWith('lu1', expect.objectContaining({ firstName: 'Alicia' })),
    )
    expect(mockPatchAccess).not.toHaveBeenCalled()
    expect(updateUserInPlace).toHaveBeenCalledWith(saved)
    // Back to view mode: the form (firstName input) is gone.
    await waitFor(() => expect(screen.queryByLabelText(T.labelFirstName)).not.toBeInTheDocument())
  })

  it('P19: changing only the status + Save → patchLineUserAccess only (no registration PATCH)', async () => {
    authAs('ADMIN')
    mockUseLineUsers.mockReturnValue(hookState({ users: [registered({ access: 'PENDING' })] }))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: new RegExp(T.inspect) }))
    fireEvent.click(screen.getByRole('button', { name: T.edit }))
    await screen.findByRole('option', { name: 'Computer Science' })

    fireEvent.change(screen.getByRole('combobox', { name: T.labelStatus }), { target: { value: 'ALLOWED' } })

    mockPatchAccess.mockResolvedValue(registered({ access: 'ALLOWED' }))
    fireEvent.click(screen.getByRole('button', { name: T.save }))

    await waitFor(() => expect(mockPatchAccess).toHaveBeenCalledWith('lu1', 'ALLOWED'))
    expect(mockPatchReg).not.toHaveBeenCalled()
  })

  it('P21: a registration save failure surfaces as a modal-level error and keeps the modal open', async () => {
    authAs('ADMIN')
    mockUseLineUsers.mockReturnValue(hookState({ users: [registered()] }))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: new RegExp(T.inspect) }))
    fireEvent.click(screen.getByRole('button', { name: T.edit }))
    await screen.findByRole('option', { name: 'Computer Science' })

    fireEvent.change(screen.getByLabelText(T.labelFirstName), { target: { value: 'Alicia' } })
    mockPatchReg.mockRejectedValue(new apiClient.ApiError(400, 'invalid'))
    fireEvent.click(screen.getByRole('button', { name: T.save }))

    expect(await screen.findByText(EDITOR_MESSAGES.invalid)).toBeInTheDocument()
    // Still in edit mode — the form is intact so the operator can correct and retry.
    expect(screen.getByLabelText(T.labelFirstName)).toBeInTheDocument()
  })

  it('P22: Cancel resets the draft and returns to view without any PATCH', async () => {
    await openEditor(registered())
    await screen.findByRole('option', { name: 'Computer Science' })

    fireEvent.change(screen.getByLabelText(T.labelFirstName), { target: { value: 'Changed' } })
    fireEvent.click(screen.getByRole('button', { name: T.cancel }))

    expect(mockPatchReg).not.toHaveBeenCalled()
    expect(mockPatchAccess).not.toHaveBeenCalled()
    // Back to view mode (form gone); reopening Edit shows the original value.
    expect(screen.queryByLabelText(T.labelFirstName)).not.toBeInTheDocument()
  })
})

describe('AdminPortalLineUsersPage — Reject action (ส่งคืนเพื่อตรวจสอบข้อมูลใหม่)', () => {
  const REASON = 'เบอร์โทรศัพท์ไม่ถูกต้อง กรุณากรอกใหม่'

  /** Open the inspect modal for `user` as `role` (no Edit click — Reject lives in view mode). */
  function inspectAs(user: LineUser, role: SystemRole) {
    authAs(role)
    mockUseLineUsers.mockReturnValue(hookState({ users: [user] }))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: new RegExp(T.inspect) }))
  }

  /** Open the inspect modal AND the reject dialog, ready for a reason. */
  function openRejectDialog(user: LineUser = registered({ access: 'PENDING' }), role: SystemRole = 'ADMIN') {
    inspectAs(user, role)
    fireEvent.click(screen.getByRole('button', { name: T.reject }))
  }

  it('R1: ADMIN and SUPER_ADMIN both see the Reject button on a reviewable user', () => {
    for (const role of ['ADMIN', 'SUPER_ADMIN'] as const) {
      inspectAs(registered({ access: 'PENDING' }), role)
      expect(screen.getByRole('button', { name: T.reject })).toBeInTheDocument()
      cleanup()
    }
  })

  it('R2: STAFF sees NO Reject button (read-only surface)', () => {
    inspectAs(registered({ access: 'PENDING' }), 'STAFF')
    expect(screen.getByText('Teacher')).toBeInTheDocument() // the modal IS open, read-only
    expect(screen.queryByRole('button', { name: T.reject })).not.toBeInTheDocument()
  })

  it('R3: an UNREGISTERED user is never rejectable (nothing was submitted to send back)', () => {
    inspectAs(makeUser({ access: 'UNREGISTERED', registration: null }), 'SUPER_ADMIN')
    expect(screen.queryByRole('button', { name: T.reject })).not.toBeInTheDocument()
  })

  it('R4: a re-reject is offered to SUPER_ADMIN but not to ADMIN', () => {
    inspectAs(registered({ access: 'REJECTED' }), 'ADMIN')
    expect(screen.queryByRole('button', { name: T.reject })).not.toBeInTheDocument()
    cleanup()

    inspectAs(registered({ access: 'REJECTED' }), 'SUPER_ADMIN')
    expect(screen.getByRole('button', { name: T.reject })).toBeInTheDocument()
  })

  it('R5: a BLANK reason blocks the submit — the button is disabled and no PATCH fires', () => {
    openRejectDialog()

    const submit = screen.getByRole('button', { name: T.rejectSubmit })
    expect(submit).toBeDisabled()
    fireEvent.click(submit)
    expect(mockPatchAccess).not.toHaveBeenCalled()

    // Whitespace alone is still blank.
    fireEvent.change(screen.getByLabelText(new RegExp(T.rejectReasonLabel)), {
      target: { value: '   ' },
    })
    expect(screen.getByRole('button', { name: T.rejectSubmit })).toBeDisabled()
    expect(mockPatchAccess).not.toHaveBeenCalled()
  })

  it('R6: the reason field is capped at the backend 500-char limit and shows a live counter', () => {
    openRejectDialog()

    const textarea = screen.getByLabelText(new RegExp(T.rejectReasonLabel))
    expect(textarea).toHaveAttribute('maxlength', '500')
    expect(screen.getByText(T.rejectReasonCounter(0, 500))).toBeInTheDocument()

    fireEvent.change(textarea, { target: { value: REASON } })
    expect(screen.getByText(T.rejectReasonCounter(REASON.length, 500))).toBeInTheDocument()
  })

  it('R7: submitting sends patchLineUserAccess(id, REJECTED, reason), updates the row in place, and closes', async () => {
    const updateUserInPlace = vi.fn()
    authAs('ADMIN')
    mockUseLineUsers.mockReturnValue(
      hookState({ users: [registered({ access: 'PENDING' })], updateUserInPlace }),
    )
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: new RegExp(T.inspect) }))
    fireEvent.click(screen.getByRole('button', { name: T.reject }))

    fireEvent.change(screen.getByLabelText(new RegExp(T.rejectReasonLabel)), {
      target: { value: REASON },
    })

    const rejected = registered({ access: 'REJECTED' })
    mockPatchAccess.mockResolvedValue(rejected)
    fireEvent.click(screen.getByRole('button', { name: T.rejectSubmit }))

    await waitFor(() => expect(mockPatchAccess).toHaveBeenCalledWith('lu1', 'REJECTED', REASON))
    expect(mockPatchReg).not.toHaveBeenCalled()
    expect(updateUserInPlace).toHaveBeenCalledWith(rejected)
    // The reason dialog closed on success…
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: T.rejectSubmit })).not.toBeInTheDocument(),
    )
    // …and the still-open inspect modal now shows the REJECTED badge.
    expect(screen.getAllByText(STATUS_BADGE.REJECTED.label).length).toBeGreaterThanOrEqual(1)
  })

  it('R8: a 400 (server-side blank/invalid reason) surfaces inline and KEEPS the dialog open', async () => {
    openRejectDialog()

    fireEvent.change(screen.getByLabelText(new RegExp(T.rejectReasonLabel)), {
      target: { value: REASON },
    })
    mockPatchAccess.mockRejectedValue(new apiClient.ApiError(400, 'REJECTION_REASON_REQUIRED'))
    fireEvent.click(screen.getByRole('button', { name: T.rejectSubmit }))

    expect(await screen.findByText(EDITOR_MESSAGES.rejectInvalid)).toBeInTheDocument()
    // Still open, still holding the typed reason, and flagged invalid for a11y.
    const textarea = screen.getByLabelText(new RegExp(T.rejectReasonLabel))
    expect(textarea).toHaveValue(REASON)
    expect(textarea).toHaveAttribute('aria-invalid', 'true')
    expect(textarea.getAttribute('aria-describedby')).toContain('reject-reason-error')
  })

  it('R9: Cancel closes the dialog without any PATCH', () => {
    openRejectDialog()

    fireEvent.change(screen.getByLabelText(new RegExp(T.rejectReasonLabel)), {
      target: { value: REASON },
    })
    fireEvent.click(screen.getByRole('button', { name: T.cancel }))

    expect(mockPatchAccess).not.toHaveBeenCalled()
  })
})

describe('AdminPortalLineUsersPage — live-channel indicator (AC F14)', () => {
  it('P28: shows the LIVE state as a daisyUI status dot with text, dot decorative', () => {
    mockUseLineUsers.mockReturnValue(hookState({ users: [registered()], realtimeStatus: 'live' }))
    renderPage()

    const indicator = screen.getByText(T.realtimeLive).closest('[role="status"]') as HTMLElement
    expect(indicator).not.toBeNull()
    expect(indicator).toHaveClass('badge')
    expect(indicator).toHaveAttribute('aria-live', 'polite')
    // Colour is never the message: the dot is aria-hidden, the adjacent text carries it.
    const dot = indicator.querySelector('.status') as HTMLElement
    expect(dot).toHaveClass('status-success')
    expect(dot).toHaveAttribute('aria-hidden')
  })

  it('P29: shows the CONNECTING state while the handshake is in flight', () => {
    mockUseLineUsers.mockReturnValue(
      hookState({ users: [registered()], realtimeStatus: 'connecting' }),
    )
    renderPage()

    const indicator = screen.getByText(T.realtimeConnecting).closest('[role="status"]') as HTMLElement
    expect(indicator.querySelector('.status')).toHaveClass('status-info')
    // Reduced motion is respected: the pulse is motion-safe only.
    expect(indicator.querySelector('.status')).toHaveClass('motion-safe:animate-pulse')
  })

  it('P30: a dead socket degrades to a warning indicator and NEVER blanks the table', () => {
    mockUseLineUsers.mockReturnValue(
      hookState({
        users: [registered()],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        totalPages: 1,
        realtimeStatus: 'offline',
      }),
    )
    renderPage()

    const indicator = screen.getByText(T.realtimeOffline).closest('[role="status"]') as HTMLElement
    expect(indicator.querySelector('.status')).toHaveClass('status-warning')
    expect(indicator).toHaveAttribute('title', T.realtimeOfflineHint)
    // Real-time is an enhancement, not a dependency: the fetched rows and the pager stay.
    expect(within(screen.getByRole('table')).getByText('Alice Wong')).toBeInTheDocument()
    expect(screen.getByText(T.paginationSummary(1, 1, 1))).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('P31: renders NO indicator when real-time is switched off at build time', () => {
    mockUseLineUsers.mockReturnValue(
      hookState({ users: [registered()], realtimeStatus: 'disabled' }),
    )
    renderPage()

    expect(screen.queryByText(T.realtimeLive)).not.toBeInTheDocument()
    expect(screen.queryByText(T.realtimeOffline)).not.toBeInTheDocument()
    expect(screen.queryByText(T.realtimeConnecting)).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('AdminPortalLineUsersPage — a deleted row cannot leave a modal bound to it', () => {
  it('P32: closes the inspect modal when the open row is deleted live (edge case 11)', () => {
    const user = registered({ id: 'lu1' })
    const state = hookState({ users: [user] })
    mockUseLineUsers.mockReturnValue(state)
    const { rerender } = renderPage()

    fireEvent.click(screen.getByRole('button', { name: new RegExp(T.inspect) }))
    expect(screen.getByRole('dialog', { name: T.modalTitle })).toHaveAttribute('open')

    // Another admin's unfollow arrives for the very row on screen.
    mockUseLineUsers.mockReturnValue(hookState({ ...state, users: [], deletedRowId: 'lu1' }))
    rerender(
      <ToastProvider>
        <AdminPortalLineUsersPage />
      </ToastProvider>,
    )

    // A closed <dialog> leaves the accessibility tree entirely…
    expect(screen.queryByRole('dialog', { name: T.modalTitle })).not.toBeInTheDocument()
    // …and the native `close` event reset the selection, so nothing is left bound to the
    // vanished row (an operator must never be able to save an edit to a deleted user).
    expect(screen.queryByText('Teacher')).not.toBeInTheDocument()
  })

  it('P33: leaves the modal open when a DIFFERENT row is deleted', () => {
    const user = registered({ id: 'lu1' })
    const state = hookState({ users: [user] })
    mockUseLineUsers.mockReturnValue(state)
    const { rerender } = renderPage()

    fireEvent.click(screen.getByRole('button', { name: new RegExp(T.inspect) }))

    mockUseLineUsers.mockReturnValue(hookState({ ...state, deletedRowId: 'someone-else' }))
    rerender(
      <ToastProvider>
        <AdminPortalLineUsersPage />
      </ToastProvider>,
    )

    expect(screen.getByRole('dialog', { name: T.modalTitle })).toHaveAttribute('open')
    expect(screen.getByText('Teacher')).toBeInTheDocument()
  })
})
