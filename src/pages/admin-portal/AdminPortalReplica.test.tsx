import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { AdminPortalStubPage } from '@/pages/admin-portal/AdminPortalStubPage'
import { AdminPortalSidebar } from '@/components/admin-portal/AdminPortalSidebar'
import { AdminPortalHeader } from '@/components/admin-portal/AdminPortalHeader'
import { AdminPortalLayout } from '@/components/admin-portal/AdminPortalLayout'
import { AdminPortalThemeLayout } from '@/components/admin-portal/AdminPortalThemeLayout'
import { LandingIntro } from '@/components/admin-portal/LandingIntro'
import { TeamMembers } from '@/components/admin-portal/TeamMembers'
import { NAV_ITEMS, isSubmenu } from '@/components/admin-portal/nav-config'
import {
  ADMIN_PORTAL_ROUTES,
  ADMIN_PORTAL_STUB_ROUTES,
} from '@/components/admin-portal/routes'
import { BRAND } from '@/constants/ui-strings-brand'
import { PROFILE_STRINGS } from '@/constants/ui-strings-profile'
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
  function renderSidebar() {
    return render(
      <MemoryRouter initialEntries={['/admin-portal/dashboard']}>
        <AdminPortalSidebar />
      </MemoryRouter>,
    )
  }

  /**
   * CHANGED: the `Pages` submenu assertion is INVERTED, not deleted. The whole `Pages`
   * group (Login / Register / Forgot Password / Blank Page) was removed along with the
   * three placeholder routes behind it, so "there is no Pages button" is now the
   * requirement — see the "Pages menu removed" block below.
   */
  it('renders every top-level entry as a real link, and submenu parents as toggles', () => {
    renderSidebar()

    // Previously-inert entries are now live links (no visual-only buttons remain). The
    // former "Leads" leaf was re-contextualised to the LINE-user registration data page
    // (label → 'ข้อมูลการลงทะเบียน'); the route target is unchanged.
    expect(screen.getByRole('link', { name: /Dashboard/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ข้อมูลการลงทะเบียน/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Transactions/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Calendar/ })).toBeInTheDocument()
    // The two surviving submenu parents expand rather than navigate, so they stay buttons.
    expect(screen.getByRole('button', { name: /Settings/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Documentation/ })).toBeInTheDocument()
  })

  describe('Pages menu removed (+ its dead routes)', () => {
    it('has NO "Pages" entry and none of its four submenu leaves', () => {
      renderSidebar()

      expect(screen.queryByRole('button', { name: /Pages/ })).not.toBeInTheDocument()
      for (const label of ['Login', 'Register', 'Forgot Password', 'Blank Page']) {
        expect(screen.queryByText(label)).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: new RegExp(label) })).not.toBeInTheDocument()
      }
    })

    it('drops the register / forgot-password / blank ROUTE constants and stub routes', () => {
      // The routes are generated from `ADMIN_PORTAL_STUB_ROUTES`, so an absent entry IS an
      // absent `<Route>`: those paths now fall through to the single global 404.
      const segments = ADMIN_PORTAL_STUB_ROUTES.map((s) => s.segment)
      expect(segments).not.toContain('register')
      expect(segments).not.toContain('forgot-password')
      expect(segments).not.toContain('blank')

      // No nav leaf points at any of them either.
      const leaves = NAV_ITEMS.flatMap((e) => (isSubmenu(e) ? e.submenu : [e]))
      for (const to of leaves.map((l) => l.to)) {
        expect(to).not.toMatch(/\/(register|forgot-password|blank)$/)
      }

      // The route constants themselves are gone from the object.
      const routeKeys = Object.keys(ADMIN_PORTAL_ROUTES)
      expect(routeKeys).not.toContain('register')
      expect(routeKeys).not.toContain('forgotPassword')
      expect(routeKeys).not.toContain('blank')
    })

    it('KEEPS the real login route reachable — it is simply no longer a sidebar entry', () => {
      // `/admin-portal/login` is the working login page and stays registered in `App.tsx`
      // (outside `ProtectedRoute`); only the DashWind "Pages → Login" shortcut is gone.
      expect(ADMIN_PORTAL_ROUTES.login).toBe('/admin-portal/login')
      // …and it is NOT a stub route, so it never renders the "coming soon" placeholder.
      expect(ADMIN_PORTAL_STUB_ROUTES.map((s) => s.segment)).not.toContain('login')
    })

    it('KEEPS AdminPortalStubPage — eight other menu targets still render it', () => {
      // Grep-verified outcome (plan §7 asked for exactly this check): the three deleted
      // routes had NO bespoke components; they all rendered the SHARED stub page, which
      // Transactions / Analytics / Integration / Calendar / Billing / Getting Started /
      // Features / Components still use. Deleting it would break eight live routes.
      expect(ADMIN_PORTAL_STUB_ROUTES.length).toBeGreaterThan(0)
      expect(typeof AdminPortalStubPage).toBe('function')
    })
  })
})

describe('AdminPortal replica — EasyBook branding', () => {
  it('renders the EasyBook logo asset and wordmark in the sidebar brand row', () => {
    render(
      <MemoryRouter initialEntries={['/admin-portal/dashboard']}>
        <AdminPortalSidebar />
      </MemoryRouter>,
    )

    const logo = screen.getByAltText(BRAND.logoAlt)
    expect(logo.tagName).toBe('IMG')
    expect(logo).toHaveAttribute('src', '/logo/easybook-logo-512px-no-bg.svg')
    expect(screen.getByText(BRAND.name)).toBeInTheDocument()
    expect(BRAND.name).toBe('EasyBook')
  })

  it('renders the SAME brand on the login screen, so the shell and login cannot disagree', () => {
    render(<LandingIntro />)

    expect(screen.getByRole('heading', { name: BRAND.name })).toBeInTheDocument()
    // Decorative here: the <h1> right below already announces the brand.
    const logo = document.querySelector('img[alt=""]') as HTMLImageElement
    expect(logo).not.toBeNull()
    expect(logo).toHaveAttribute('src', BRAND.logoSrc)
  })

  it('renders "DashWind" nowhere in the sidebar — the wordmark is EasyBook now', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/admin-portal/dashboard']}>
        <AdminPortalSidebar />
      </MemoryRouter>,
    )

    // Only the user-visible wordmark changed; the DashWind ATTRIBUTION comments in the
    // source (a THIRD_PARTY_NOTICES.md licence obligation) are untouched and are not DOM.
    expect(container.textContent).not.toMatch(/DashWind/)
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
  function renderStubInShell() {
    return render(
      <MemoryRouter initialEntries={['/admin-portal/line-users']}>
        <AuthProvider>
          <Routes>
            <Route element={<AdminPortalThemeLayout />}>
              <Route path="/admin-portal" element={<AdminPortalLayout />}>
                <Route path="line-users" element={<AdminPortalStubPage title="Leads" />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )
  }

  it('renders a navigable placeholder inside the shell for a stubbed menu target', () => {
    renderStubInShell()

    // UPDATED (PO review): the title now comes from the stub BODY only — the navbar's
    // `<h1>{pageTitle}</h1>` was removed for every page at every breakpoint, so the two
    // remaining occurrences are the TitleCard heading and the hero `<h2>`, both inside
    // `<main>`. This used to be `getAllByText('Leads').length > 0` with the header
    // counted in; it is tightened rather than relaxed.
    const main = screen.getByRole('main')
    expect(within(main).getAllByText('Leads').length).toBeGreaterThan(0)
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
  })

  it('renders NO navbar page title, at any breakpoint, and keeps <main> named', () => {
    renderStubInShell()

    // The stub page tops out at <h2>, so after removing the navbar <h1> there is no
    // level-1 heading at all here — which is exactly why `<main>` carries an explicit
    // accessible name instead.
    expect(screen.queryAllByRole('heading', { level: 1 })).toHaveLength(0)
    expect(screen.getByRole('main')).toHaveAccessibleName('Main content')

    // The hamburger is the only thing left in the navbar's leading slot, so nothing can
    // overlap it. (`Open menu` is the label on the drawer <label>.)
    const hamburger = screen.getByLabelText('Open menu')
    const navbar = hamburger.closest('.navbar') as HTMLElement
    expect(within(navbar).queryAllByRole('heading')).toHaveLength(0)
  })
})

describe('AdminPortal replica — navbar profile dropdown', () => {
  it('links to the real profile page under its Thai label (no "Profile Settings")', () => {
    renderHeaderAt('/admin-portal/dashboard')

    const link = screen.getByRole('link', { name: PROFILE_STRINGS.navLabel })
    expect(link).toHaveAttribute('href', ADMIN_PORTAL_ROUTES.profile)
    expect(screen.queryByText('Profile Settings')).not.toBeInTheDocument()
  })

  it('falls back to the icon placeholder when the session has no avatar', () => {
    renderHeaderAt('/admin-portal/dashboard')

    // `getMe` resolves null in this suite → unauthenticated → no picture, and never an
    // <img> with an empty src.
    expect(screen.getByRole('button', { name: 'Profile menu' }).querySelector('img')).toBeNull()
  })
})
