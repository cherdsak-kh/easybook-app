import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { AdminPortalStubPage } from '@/pages/admin-portal/AdminPortalStubPage'
import { AdminPortalSidebar } from '@/components/admin-portal/AdminPortalSidebar'
import { AdminPortalHeader } from '@/components/admin-portal/AdminPortalHeader'
import { AdminPortalLayout } from '@/components/admin-portal/AdminPortalLayout'
import { AdminPortalThemeLayout } from '@/components/admin-portal/AdminPortalThemeLayout'
import { TeamMembers } from '@/components/admin-portal/TeamMembers'
import * as apiClient from '@/lib/api-client'

// The header now reads `useAuth().logout`, so any render that mounts it must sit inside a
// real `AuthProvider`. Mock the api-client boundary (never the network) — the same
// convention as `AdminPortalLoginPage.test.tsx`; only `getMe` matters here (the mount
// probe), resolved unauthenticated so no session is required to render the chrome.
vi.mock('@/lib/api-client', () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}))

const mockGetMe = vi.mocked(apiClient.getMe)

/**
 * Smoke coverage for the isolated `/admin-portal` replica: the mock surfaces (Team,
 * sidebar, header, stub pages) render with NO backend and NO Redux. These prove the
 * frozen (deterministic) Team table, the fully-clickable sidebar, and the Phase-3.5
 * interactivity (working theme toggle, notification panel, navigable stub pages). The
 * login is now REAL cookie-session auth (Phase 4) — its behavior is covered separately
 * in `AdminPortalLoginPage.test.tsx` (with `AuthProvider` + a mocked api-client), and
 * the 404 in `AdminPortalNotFoundPage.test.tsx`. The former "Leads" table is now the
 * re-contextualised LINE-user registration page wired to REAL data — its coverage lives in
 * `AdminPortalLineUsersPage.test.tsx`, so the old frozen-mock assertions were removed here.
 */

// jsdom doesn't implement Element.prototype.scrollTo; the shell's scroll-reset effect
// (identical to the real portal's DashboardLayout) calls it on navigation. Shim it so
// the full-shell render below doesn't throw — production code is unchanged.
beforeAll(() => {
  if (typeof Element.prototype.scrollTo !== 'function') {
    Element.prototype.scrollTo = () => {}
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  mockGetMe.mockResolvedValue(null) // unauthenticated mount probe — chrome renders regardless
})

describe('AdminPortal replica — Team members table (frozen mock)', () => {
  it('renders the verbatim members with frozen join dates and role badges', () => {
    render(<TeamMembers />)

    expect(screen.getByText('Active Members')).toBeInTheDocument()
    const table = screen.getByRole('table')

    // Verbatim member data.
    expect(within(table).getByText('alex@dashwind.com')).toBeInTheDocument()
    expect(within(table).getByText('miya@dashwind.com')).toBeInTheDocument()
    // Frozen (deterministic) join date — was a live `moment()` in the template.
    expect(within(table).getByText('26 Jun 2024')).toBeInTheDocument()
    // Role badge parity.
    expect(within(table).getByText('Owner')).toBeInTheDocument()
    expect(within(table).getAllByText('Support')).toHaveLength(2)
  })

  it('renders each row avatar from a LOCAL asset (dead reqres image host removed)', () => {
    render(<TeamMembers />)
    const table = screen.getByRole('table')

    // Avatar carries the member name as its alt (a11y) and a real, non-empty src that
    // is NOT the dead `reqres.in` image host — it now points at a bundled local SVG.
    const avatar = within(table).getByAltText('Alex')
    expect(avatar.tagName).toBe('IMG')
    expect(avatar.getAttribute('src')).toBeTruthy()
    expect(avatar.getAttribute('src')).not.toMatch(/reqres/)
    expect(avatar).toHaveAttribute('loading', 'lazy')
  })
})

describe('AdminPortal replica — sidebar is fully navigable (Phase 3.5)', () => {
  it('renders every top-level entry as a real link, and submenu parents as toggles', () => {
    render(
      <MemoryRouter initialEntries={['/admin-portal/dashboard']}>
        <AdminPortalSidebar />
      </MemoryRouter>,
    )

    // Previously-inert entries are now live links (no visual-only buttons remain). The
    // former "Leads" leaf was re-contextualised to the LINE-user registration data page
    // (label → 'ข้อมูลการลงทะเบียน'); the route target is unchanged.
    expect(screen.getByRole('link', { name: /Dashboard/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ข้อมูลการลงทะเบียน/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Transactions/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Calendar/ })).toBeInTheDocument()
    // Submenu parents expand rather than navigate, so they stay buttons.
    expect(screen.getByRole('button', { name: /Pages/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Settings/ })).toBeInTheDocument()
  })
})

/** Renders the header inside the theme wrapper at a given replica path. */
function renderHeaderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route element={<AdminPortalThemeLayout />}>
            <Route path="/admin-portal/dashboard" element={<AdminPortalHeader />} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('AdminPortal replica — theme toggle (Phase 3.5)', () => {
  it('flips the wrapper data-theme between dashwind-light and dashwind-dark', () => {
    const { container } = renderHeaderAt('/admin-portal/dashboard')
    const wrapper = container.querySelector('[data-theme]')

    // jsdom has no matchMedia → initialises to light.
    expect(wrapper).toHaveAttribute('data-theme', 'dashwind-light')

    fireEvent.click(screen.getByRole('checkbox', { name: 'Toggle light and dark theme' }))
    expect(wrapper).toHaveAttribute('data-theme', 'dashwind-dark')

    fireEvent.click(screen.getByRole('checkbox', { name: 'Toggle light and dark theme' }))
    expect(wrapper).toHaveAttribute('data-theme', 'dashwind-light')
  })
})

describe('AdminPortal replica — notification panel (Phase 3.5)', () => {
  it('exposes a bell with an unread badge and a panel of mock notifications', () => {
    renderHeaderAt('/admin-portal/dashboard')

    expect(screen.getByRole('button', { name: /Notifications, 2 unread/ })).toBeInTheDocument()
    expect(screen.getByText('2 new')).toBeInTheDocument()
    // Verbatim-style template copy, populated (Phase 3 dropped the panel entirely).
    expect(screen.getAllByText('Your sales has increased by 30% yesterday').length).toBeGreaterThan(0)
  })
})

describe('AdminPortal replica — stub pages (Phase 3.5)', () => {
  it('renders a navigable placeholder inside the shell for a stubbed menu target', () => {
    render(
      <MemoryRouter initialEntries={['/admin-portal/leads']}>
        <AuthProvider>
          <Routes>
            <Route element={<AdminPortalThemeLayout />}>
              <Route path="/admin-portal" element={<AdminPortalLayout />}>
                <Route path="leads" element={<AdminPortalStubPage title="Leads" />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    // Both the header title and the stub body read the parameterised title.
    expect(screen.getAllByText('Leads').length).toBeGreaterThan(0)
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
  })
})
