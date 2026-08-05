import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { AdminPortalStubPage } from '@/pages/admin-portal/AdminPortalStubPage'
import { AdminPortalSidebar } from '@/components/admin-portal/AdminPortalSidebar'
import { AdminPortalHeader } from '@/components/admin-portal/AdminPortalHeader'
import { AdminPortalLayout } from '@/components/admin-portal/AdminPortalLayout'
import { AdminPortalThemeLayout } from '@/components/admin-portal/AdminPortalThemeLayout'
import { LandingIntro } from '@/components/admin-portal/LandingIntro'
import { NAV_SECTIONS, allNavLeaves } from '@/components/admin-portal/nav-config'
import {
  ADMIN_PORTAL_ROUTES,
  ADMIN_PORTAL_SEGMENTS,
  ADMIN_PORTAL_STUB_ROUTES,
} from '@/components/admin-portal/routes'
import { ADMIN_NAV_STRINGS } from '@/constants/ui-strings-admin-nav'
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
 * Smoke coverage for the `/admin-portal` shell chrome: the sidebar, header and stub pages
 * render with NO backend and NO Redux. These prove the fully-clickable 31-leaf sidebar and
 * the interactivity (working theme toggle, notification panel, navigable stub pages). The
 * login is REAL cookie-session auth — its behavior is covered separately in
 * `AdminPortalLoginPage.test.tsx` (with `AuthProvider` + a mocked api-client), and the 404
 * in `AdminPortalNotFoundPage.test.tsx`. The former "Leads" table is now the
 * re-contextualised LINE-user registration page wired to REAL data — its coverage lives in
 * `AdminPortalLineUsersPage.test.tsx`, so the old frozen-mock assertions were removed here.
 *
 * The DashWind "Team members" cases are GONE with the component: that table rendered mock
 * members (fake names/emails/join dates) to a real operator and was deleted in the
 * side-menu overhaul, together with `AdminPortalTeamPage` and the `team` route.
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

describe('AdminPortal — sidebar information architecture (5 sections / 31 leaves)', () => {
  function renderSidebar(path = '/admin-portal/dashboard') {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <AdminPortalSidebar />
      </MemoryRouter>,
    )
  }

  it('renders exactly 5 sections, 4 visible Thai category headers and 31 leaves', () => {
    expect(NAV_SECTIONS).toHaveLength(5)
    // Section 0 is deliberately unlabelled; the other four carry a header.
    expect(NAV_SECTIONS.filter((s) => s.title !== undefined).map((s) => s.title)).toEqual([
      ADMIN_NAV_STRINGS.sections.management,
      ADMIN_NAV_STRINGS.sections.reports,
      ADMIN_NAV_STRINGS.sections.settings,
      ADMIN_NAV_STRINGS.sections.support,
    ])
    expect(allNavLeaves()).toHaveLength(31)

    renderSidebar()
    for (const title of Object.values(ADMIN_NAV_STRINGS.sections)) {
      const header = screen.getByText(title)
      // A header is a label, never a link and never a button.
      expect(header.tagName).toBe('LI')
      expect(header).toHaveClass('menu-title')
    }
  })

  it('renders every leaf as a real link and both submenu parents as toggles', () => {
    renderSidebar()

    // A sample across all four labelled sections + the unlabelled one.
    for (const label of [
      ADMIN_NAV_STRINGS.items.dashboard,
      ADMIN_NAV_STRINGS.items.bookingCalendar,
      ADMIN_NAV_STRINGS.items.lineUsers,
      ADMIN_NAV_STRINGS.items.staff,
      ADMIN_NAV_STRINGS.items.reportsErrorLogs,
      ADMIN_NAV_STRINGS.items.helpVersion,
    ]) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }

    // The two submenu parents expand rather than navigate, so they stay buttons.
    for (const label of Object.values(ADMIN_NAV_STRINGS.groups)) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('gives all 31 leaves a live route — bespoke or generated stub, never a 404', () => {
    const stubPaths = new Set(
      ADMIN_PORTAL_STUB_ROUTES.map((stub) => `${ADMIN_PORTAL_ROUTES.base}/${stub.segment}`),
    )
    const bespokePaths = new Set<string>([
      ADMIN_PORTAL_ROUTES.lineUsers,
      ADMIN_PORTAL_ROUTES.profile,
    ])

    for (const leaf of allNavLeaves()) {
      expect(stubPaths.has(leaf.to) || bespokePaths.has(leaf.to)).toBe(true)
    }
    // 31 leaves = 2 bespoke + 29 generated placeholders.
    expect(ADMIN_PORTAL_STUB_ROUTES).toHaveLength(29)
  })

  it('titles every stub page with the SAME literal as its sidebar label', () => {
    const labelByPath = new Map(allNavLeaves().map((leaf) => [leaf.to, leaf.label]))

    for (const stub of ADMIN_PORTAL_STUB_ROUTES) {
      expect(stub.title).toBe(labelByPath.get(`${ADMIN_PORTAL_ROUTES.base}/${stub.segment}`))
      // No English leftovers: every stub title is the Thai menu label.
      expect(stub.title).not.toMatch(/^[\x20-\x7E]+$/)
    }
  })

  it('drops every DashWind leftover route, constant and nav leaf', () => {
    const dead = [
      'transactions',
      'charts',
      'integration',
      'calendar',
      'settings-billing',
      'getting-started',
      'features',
      'components',
      'team',
    ]
    const segments = ADMIN_PORTAL_STUB_ROUTES.map((s) => s.segment)
    const routeValues = Object.values(ADMIN_PORTAL_ROUTES)
    const leafPaths = allNavLeaves().map((l) => l.to)

    for (const segment of dead) {
      expect(segments).not.toContain(segment)
      expect(routeValues).not.toContain(`${ADMIN_PORTAL_ROUTES.base}/${segment}`)
      expect(leafPaths).not.toContain(`${ADMIN_PORTAL_ROUTES.base}/${segment}`)
    }
    // The old DashWind auth-screen placeholders stay gone too.
    for (const to of leafPaths) {
      expect(to).not.toMatch(/\/(register|forgot-password|blank)$/)
    }
    // `ADMIN_PORTAL_SEGMENTS` is exactly the two bespoke pages.
    expect(Object.keys(ADMIN_PORTAL_SEGMENTS).sort()).toEqual(['lineUsers', 'profile'])
  })

  it('KEEPS the real login route reachable — it is simply not a sidebar entry', () => {
    // `/admin-portal/login` is the working login page and stays registered in `App.tsx`
    // (outside `ProtectedRoute`); the sidebar only renders inside the authenticated shell.
    expect(ADMIN_PORTAL_ROUTES.login).toBe('/admin-portal/login')
    expect(ADMIN_PORTAL_STUB_ROUTES.map((s) => s.segment)).not.toContain('login')
    expect(allNavLeaves().map((l) => l.to)).not.toContain(ADMIN_PORTAL_ROUTES.login)
  })

  it('KEEPS AdminPortalStubPage — 29 menu targets render it', () => {
    expect(ADMIN_PORTAL_STUB_ROUTES).toHaveLength(29)
    expect(typeof AdminPortalStubPage).toBe('function')
  })

  it('keeps both submenus collapsed by default, and toggles on click', () => {
    renderSidebar()

    for (const label of Object.values(ADMIN_NAV_STRINGS.groups)) {
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-expanded', 'false')
    }

    const toggle = screen.getByRole('button', { name: ADMIN_NAV_STRINGS.groups.system })
    // `aria-controls` must resolve — the visibility itself is daisyUI CSS
    // (`li > .menu-dropdown:not(.menu-dropdown-show) { display: none }`), which jsdom does
    // not evaluate, so the CLASS is what is asserted here rather than computed visibility.
    const list = document.getElementById(toggle.getAttribute('aria-controls') as string)
    expect(list).not.toBeNull()
    expect(list).toHaveClass('menu-dropdown')
    expect(list).not.toHaveClass('menu-dropdown-show')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveClass('menu-dropdown-show')
    expect(list).toHaveClass('menu-dropdown-show')
    expect(
      screen.getByRole('link', { name: ADMIN_NAV_STRINGS.items.settingsRoles }),
    ).toBeInTheDocument()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(list).not.toHaveClass('menu-dropdown-show')
  })

  it('auto-expands the submenu owning the route on a DIRECT deep link', () => {
    renderSidebar(ADMIN_PORTAL_ROUTES.settingsRoles)

    expect(
      screen.getByRole('button', { name: ADMIN_NAV_STRINGS.groups.system }),
    ).toHaveAttribute('aria-expanded', 'true')
    // …and the sibling submenu stays shut.
    expect(
      screen.getByRole('button', { name: ADMIN_NAV_STRINGS.groups.account }),
    ).toHaveAttribute('aria-expanded', 'false')
  })

  it('marks only the exact path active — a nested sibling never lights up', () => {
    renderSidebar(ADMIN_PORTAL_ROUTES.reportsAnalytics)

    expect(
      screen.getByRole('link', { name: ADMIN_NAV_STRINGS.items.reportsAnalytics }),
    ).toHaveAttribute('aria-current', 'page')
    expect(
      screen.getByRole('link', { name: ADMIN_NAV_STRINGS.items.reportsBookingRequests }),
    ).not.toHaveAttribute('aria-current')
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

describe('AdminPortal — theme toggle', () => {
  it('flips the wrapper data-theme between cupcake and dashwind-dark', () => {
    const { container } = renderHeaderAt('/admin-portal/dashboard')
    const wrapper = container.querySelector('[data-theme]')

    // jsdom has no matchMedia → initialises to light, which is now `cupcake` (the pastel
    // light theme adopted for the WHOLE portal, not just the sidebar).
    expect(wrapper).toHaveAttribute('data-theme', 'cupcake')

    fireEvent.click(screen.getByRole('checkbox', { name: 'Toggle light and dark theme' }))
    // The dark branch is still `dashwind-dark`: `cupcake` is light-only, and the `-dark`
    // SUFFIX is load-bearing for `index.css`'s `@custom-variant dark` selector.
    expect(wrapper).toHaveAttribute('data-theme', 'dashwind-dark')

    fireEvent.click(screen.getByRole('checkbox', { name: 'Toggle light and dark theme' }))
    expect(wrapper).toHaveAttribute('data-theme', 'cupcake')
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

  it('keeps `dashboard` as the segment, relabelled to ภาพรวมระบบ and still in the sidebar', () => {
    // The segment is REUSED rather than renamed to `overview`, because it is the shell's
    // `index` redirect target — reusing it means the redirect needs no change.
    const dashboard = ADMIN_PORTAL_STUB_ROUTES.find((stub) => stub.segment === 'dashboard')
    expect(dashboard).toEqual({
      segment: 'dashboard',
      title: ADMIN_NAV_STRINGS.items.dashboard,
    })

    expect(allNavLeaves().some((leaf) => leaf.to === ADMIN_PORTAL_ROUTES.dashboard)).toBe(true)
  })

  it('renders the inert placeholder — not mock data — at the dashboard route', () => {
    render(
      <MemoryRouter initialEntries={[ADMIN_PORTAL_ROUTES.dashboard]}>
        <AuthProvider>
          <Routes>
            <Route element={<AdminPortalThemeLayout />}>
              <Route path={ADMIN_PORTAL_ROUTES.base} element={<AdminPortalLayout />}>
                <Route
                  path="dashboard"
                  element={<AdminPortalStubPage title={ADMIN_NAV_STRINGS.items.dashboard} />}
                />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    const main = screen.getByRole('main')
    expect(within(main).getAllByText(ADMIN_NAV_STRINGS.items.dashboard).length).toBeGreaterThan(0)
    expect(within(main).getByText(/coming soon/i)).toBeInTheDocument()
    // No Chart.js canvas and none of the deleted mock figures survive.
    expect(main.querySelector('canvas')).toBeNull()
    expect(within(main).queryByText('New Users')).not.toBeInTheDocument()
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
