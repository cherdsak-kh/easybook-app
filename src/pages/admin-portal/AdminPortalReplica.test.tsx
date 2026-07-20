import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AdminPortalLoginPage } from '@/pages/admin-portal/AdminPortalLoginPage'
import { AdminPortalStubPage } from '@/pages/admin-portal/AdminPortalStubPage'
import { AdminPortalSidebar } from '@/components/admin-portal/AdminPortalSidebar'
import { AdminPortalHeader } from '@/components/admin-portal/AdminPortalHeader'
import { AdminPortalLayout } from '@/components/admin-portal/AdminPortalLayout'
import { AdminPortalThemeLayout } from '@/components/admin-portal/AdminPortalThemeLayout'
import { TeamMembers } from '@/components/admin-portal/TeamMembers'

/**
 * Smoke coverage for the isolated `/admin-portal` replica: it must render with NO
 * backend, NO auth, NO Redux. These prove the visual-only login navigation, the frozen
 * (deterministic) Team table, the fully-clickable sidebar, and the Phase-3.5
 * interactivity (working theme toggle, notification panel, navigable stub pages).
 */

// jsdom doesn't implement Element.prototype.scrollTo; the shell's scroll-reset effect
// (identical to the real portal's DashboardLayout) calls it on navigation. Shim it so
// the full-shell render below doesn't throw — production code is unchanged.
beforeAll(() => {
  if (typeof Element.prototype.scrollTo !== 'function') {
    Element.prototype.scrollTo = () => {}
  }
})
describe('AdminPortal replica — login (visual-only)', () => {
  it('blocks an empty submit with a presence error and does not navigate', () => {
    render(
      <MemoryRouter initialEntries={['/admin-portal/login']}>
        <Routes>
          <Route path="/admin-portal/login" element={<AdminPortalLoginPage />} />
          <Route path="/admin-portal/dashboard" element={<div>DASHBOARD REACHED</div>} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Login' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/Email Id is required/)
    expect(screen.queryByText('DASHBOARD REACHED')).not.toBeInTheDocument()
  })

  it('navigates to the replica dashboard when both fields are present (no auth)', () => {
    render(
      <MemoryRouter initialEntries={['/admin-portal/login']}>
        <Routes>
          <Route path="/admin-portal/login" element={<AdminPortalLoginPage />} />
          <Route path="/admin-portal/dashboard" element={<div>DASHBOARD REACHED</div>} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('Email Id'), { target: { value: 'anything' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'anything' } })
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))

    expect(screen.getByText('DASHBOARD REACHED')).toBeInTheDocument()
  })
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
})

describe('AdminPortal replica — sidebar is fully navigable (Phase 3.5)', () => {
  it('renders every top-level entry as a real link, and submenu parents as toggles', () => {
    render(
      <MemoryRouter initialEntries={['/admin-portal/dashboard']}>
        <AdminPortalSidebar />
      </MemoryRouter>,
    )

    // Previously-inert entries are now live links (no visual-only buttons remain).
    expect(screen.getByRole('link', { name: /Dashboard/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Leads/ })).toBeInTheDocument()
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
      <Routes>
        <Route element={<AdminPortalThemeLayout />}>
          <Route path="/admin-portal/dashboard" element={<AdminPortalHeader />} />
        </Route>
      </Routes>
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
        <Routes>
          <Route element={<AdminPortalThemeLayout />}>
            <Route path="/admin-portal" element={<AdminPortalLayout />}>
              <Route path="leads" element={<AdminPortalStubPage title="Leads" />} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    // Both the header title and the stub body read the parameterised title.
    expect(screen.getAllByText('Leads').length).toBeGreaterThan(0)
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
  })
})
