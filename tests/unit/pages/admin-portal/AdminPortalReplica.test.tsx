import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { AdminPortalStubPage } from '@/pages/admin-portal/AdminPortalStubPage'
import { AdminPortalSidebar } from '@/components/admin-portal/AdminPortalSidebar'
import { AdminPortalHeader } from '@/components/admin-portal/AdminPortalHeader'
import { AdminPortalLayout } from '@/components/admin-portal/AdminPortalLayout'
import { AdminPortalThemeLayout } from '@/components/admin-portal/AdminPortalThemeLayout'
import { LandingIntro } from '@/components/admin-portal/LandingIntro'
import { ADMIN_PORTAL_DRAWER_ID, NAV_SECTIONS, allNavLeaves } from '@/components/admin-portal/nav-config'
import { ADMIN_PORTAL_THEME_STORAGE_KEY } from '@/components/admin-portal/admin-portal-theme'
import {
  ADMIN_PORTAL_ROUTES,
  ADMIN_PORTAL_SEGMENTS,
  ADMIN_PORTAL_STUB_ROUTES,
} from '@/components/admin-portal/routes'
import { ADMIN_NAV_STRINGS } from '@/constants/ui-strings-admin-nav'
import { ADMIN_THEME_STRINGS } from '@/constants/ui-strings-admin-theme'
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
  // The theme wrapper reads a PERSISTED preference at mount, so every render in this file
  // starts from a clean browser profile unless a test seeds the key itself.
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals() // drops any `matchMedia` stub a theme test installed
  vi.restoreAllMocks()
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

/**
 * REWRITTEN from the old binary `swap` toggle block: the navbar control is now a 3-option
 * daisyUI dropdown backed by a persisted `light | dark | system` PREFERENCE, so the old
 * `getByRole('checkbox', { name: 'Toggle light and dark theme' })` has no counterpart.
 */

/**
 * Accessible name of an option row — the bare Thai label (icons are `aria-hidden`).
 * The parenthesised English gloss was dropped by PO review; `noEnglishGloss` below is the
 * regression guard that keeps it from creeping back.
 */
function optionName(option: 'light' | 'dark' | 'system'): string {
  return ADMIN_THEME_STRINGS.options[option]
}

/**
 * jsdom implements NO `matchMedia`, so `system` mode has nothing to read. This is the
 * smallest stand-in that still exercises the real code path: it hands back one
 * `MediaQueryList`-shaped object, records the listeners the layout attaches, and lets a
 * test flip the OS scheme the way devtools' "Emulate prefers-color-scheme" does.
 */
function stubPrefersColorScheme(initialDark: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const mediaQueryList = {
    matches: initialDark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener)
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener)
    },
  }
  vi.stubGlobal('matchMedia', vi.fn(() => mediaQueryList))

  return {
    /** How many live subscriptions the wrapper currently holds (leak detector). */
    get listenerCount() {
      return listeners.size
    },
    /** Emulate the OS flipping scheme while the page stays open. */
    emit(dark: boolean) {
      mediaQueryList.matches = dark
      act(() => {
        for (const listener of [...listeners]) listener({ matches: dark } as MediaQueryListEvent)
      })
    },
  }
}

/** The `d` of the first `<path>` in an element's icon — identifies WHICH heroicon it is. */
function iconPathOf(element: HTMLElement): string | null {
  return element.querySelector('svg path')?.getAttribute('d') ?? null
}

function openThemeMenu() {
  const trigger = screen.getByRole('button', { name: ADMIN_THEME_STRINGS.triggerLabel })
  fireEvent.click(trigger)
  return trigger
}

function selectTheme(option: 'light' | 'dark' | 'system') {
  openThemeMenu()
  fireEvent.click(screen.getByRole('menuitemradio', { name: optionName(option) }))
}

describe('AdminPortal — theme preference dropdown (structure)', () => {
  it('renders exactly three options, in the PO order สว่าง · มืด · ตามระบบ', () => {
    renderHeaderAt('/admin-portal/dashboard')
    openThemeMenu()

    expect(screen.getAllByRole('menuitemradio').map((item) => item.textContent?.trim())).toEqual([
      optionName('light'),
      optionName('dark'),
      optionName('system'),
    ])
  })

  it('labels the options in Thai ONLY — no parenthesised English gloss', () => {
    renderHeaderAt('/admin-portal/dashboard')
    openThemeMenu()

    expect(Object.values(ADMIN_THEME_STRINGS.options)).toEqual(['สว่าง', 'มืด', 'ตามระบบ'])
    for (const item of screen.getAllByRole('menuitemradio')) {
      // No Latin letters and no parentheses anywhere in the VISIBLE row text.
      expect(item.textContent).not.toMatch(/[A-Za-z()]/)
    }
    // The two aria-labels stay bilingual on purpose — they are never rendered as text.
    expect(screen.getByRole('button', { name: ADMIN_THEME_STRINGS.triggerLabel }).textContent).toBe('')
  })

  it('centres each row on the cross axis instead of packing it to the top', () => {
    renderHeaderAt('/admin-portal/dashboard')
    openThemeMenu()

    for (const item of screen.getAllByRole('menuitemradio')) {
      // daisyUI's menu row is `display:grid` with `align-content:flex-start`, so `min-h-11`
      // pushed the whole icon/label/check block 4px above centre. jsdom evaluates no CSS,
      // so the CLASS is the assertable surface here; the painted geometry is measured in
      // the browser pass (see 03_implement_log.md).
      expect(item).toHaveClass('min-h-11', 'content-center', 'items-center')
      // daisyUI forces `outline-style:none` on a focused menu row, so the visible keyboard
      // indicator has to be a box-shadow ring — on EVERY row, selected included.
      expect(item).toHaveClass('focus-visible:ring-2', 'focus-visible:ring-base-content')
    }
  })

  it('marks the active option programmatically, not by colour alone', () => {
    renderHeaderAt('/admin-portal/dashboard')
    openThemeMenu()

    const light = screen.getByRole('menuitemradio', { name: optionName('light') })
    const dark = screen.getByRole('menuitemradio', { name: optionName('dark') })

    expect(light).toHaveAttribute('aria-checked', 'true')
    expect(light).toHaveClass('menu-active')
    expect(dark).toHaveAttribute('aria-checked', 'false')
    expect(dark).not.toHaveClass('menu-active')
  })

  it('is a ghost trigger with a >=44px tap floor — never a bright primary fill', () => {
    renderHeaderAt('/admin-portal/dashboard')

    const trigger = screen.getByRole('button', { name: ADMIN_THEME_STRINGS.triggerLabel })
    expect(trigger).toHaveClass('btn', 'btn-ghost', 'btn-square', 'btn-md', 'min-h-11', 'min-w-11')
    expect(trigger).not.toHaveClass('btn-primary')
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
  })

  it('opens on click, closes on Esc, and hands focus BACK to the trigger', () => {
    const { container } = renderHeaderAt('/admin-portal/dashboard')
    const trigger = screen.getByRole('button', { name: ADMIN_THEME_STRINGS.triggerLabel })
    const dropdown = trigger.parentElement as HTMLElement

    // Visibility itself is daisyUI CSS, which jsdom does not evaluate — so the CLASS and
    // `aria-expanded` are what is asserted (same convention as the sidebar submenu test).
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(dropdown).toHaveClass('dropdown-close')

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(dropdown).toHaveClass('dropdown-open')

    fireEvent.keyDown(dropdown, { key: 'Escape' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(dropdown).toHaveClass('dropdown-close')
    // The point of the controlled dropdown: focus never lands on <body>.
    expect(document.activeElement).toBe(trigger)
    expect(document.activeElement).not.toBe(container.ownerDocument.body)
  })

  it('closes on selection and on click-away, keeping focus on the trigger', () => {
    renderHeaderAt('/admin-portal/dashboard')
    const trigger = screen.getByRole('button', { name: ADMIN_THEME_STRINGS.triggerLabel })
    const dropdown = trigger.parentElement as HTMLElement

    selectTheme('dark')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(document.activeElement).toBe(trigger)

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    // Click-away = focus leaving the dropdown subtree; no document listener is involved.
    fireEvent.focusOut(dropdown, { relatedTarget: document.body })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows a Sun for a light resolved theme and a Moon for a dark one', () => {
    renderHeaderAt('/admin-portal/dashboard')
    const trigger = screen.getByRole('button', { name: ADMIN_THEME_STRINGS.triggerLabel })
    openThemeMenu()

    // Compare against the icons the options themselves render, so the assertion never
    // hard-codes heroicon path data.
    const sun = iconPathOf(screen.getByRole('menuitemradio', { name: optionName('light') }))
    const moon = iconPathOf(screen.getByRole('menuitemradio', { name: optionName('dark') }))
    expect(sun).not.toBe(moon)

    expect(iconPathOf(trigger)).toBe(sun)
    selectTheme('dark')
    expect(iconPathOf(trigger)).toBe(moon)
  })
})

describe('AdminPortal — theme preference dropdown (behaviour)', () => {
  it('defaults to cupcake with no stored preference, EVEN on a dark-mode OS', () => {
    stubPrefersColorScheme(true)

    const { container } = renderHeaderAt('/admin-portal/dashboard')

    // Deliberate change from the old init-once behaviour: a first-time visitor on a dark
    // OS now lands in the pastel light theme until they pick ตามระบบ themselves.
    expect(container.querySelector('[data-theme]')).toHaveAttribute('data-theme', 'cupcake')
    expect(window.localStorage.getItem(ADMIN_PORTAL_THEME_STORAGE_KEY)).toBeNull()
  })

  it('stamps dashwind-dark on มืด and cupcake on สว่าง, persisting each choice', () => {
    const { container } = renderHeaderAt('/admin-portal/dashboard')
    const wrapper = container.querySelector('[data-theme]')

    selectTheme('dark')
    // The dark branch is still `dashwind-dark`: `cupcake` is light-only, and the `-dark`
    // SUFFIX is load-bearing for `index.css`'s `@custom-variant dark` selector.
    expect(wrapper).toHaveAttribute('data-theme', 'dashwind-dark')
    expect(window.localStorage.getItem(ADMIN_PORTAL_THEME_STORAGE_KEY)).toBe('dark')

    selectTheme('light')
    expect(wrapper).toHaveAttribute('data-theme', 'cupcake')
    expect(window.localStorage.getItem(ADMIN_PORTAL_THEME_STORAGE_KEY)).toBe('light')
  })

  it('restores a persisted preference at mount (the reload case)', () => {
    window.localStorage.setItem(ADMIN_PORTAL_THEME_STORAGE_KEY, 'dark')

    const { container } = renderHeaderAt('/admin-portal/dashboard')

    expect(container.querySelector('[data-theme]')).toHaveAttribute('data-theme', 'dashwind-dark')
    expect(
      screen.getByRole('menuitemradio', { name: optionName('dark') }),
    ).toHaveAttribute('aria-checked', 'true')
  })

  it('treats a corrupt stored value as "no preference" and falls back to light', () => {
    window.localStorage.setItem(ADMIN_PORTAL_THEME_STORAGE_KEY, 'cupcake') // hand-edited junk

    const { container } = renderHeaderAt('/admin-portal/dashboard')

    expect(container.querySelector('[data-theme]')).toHaveAttribute('data-theme', 'cupcake')
    expect(
      screen.getByRole('menuitemradio', { name: optionName('light') }),
    ).toHaveAttribute('aria-checked', 'true')
  })

  it('follows the OS LIVE while ตามระบบ is selected, with no reload and no remount', () => {
    const os = stubPrefersColorScheme(true)
    window.localStorage.setItem(ADMIN_PORTAL_THEME_STORAGE_KEY, 'system')

    const { container } = renderHeaderAt('/admin-portal/dashboard')
    const wrapper = container.querySelector('[data-theme]')

    expect(wrapper).toHaveAttribute('data-theme', 'dashwind-dark')
    expect(os.listenerCount).toBe(1)

    os.emit(false)
    expect(wrapper).toHaveAttribute('data-theme', 'cupcake')
    os.emit(true)
    expect(wrapper).toHaveAttribute('data-theme', 'dashwind-dark')
    // Same DOM node throughout — the theme is state-driven, not a remount.
    expect(container.querySelector('[data-theme]')).toBe(wrapper)
  })

  it('never lets an OS change clobber an explicit light/dark choice', () => {
    const os = stubPrefersColorScheme(false)
    renderHeaderAt('/admin-portal/dashboard')
    const wrapper = document.querySelector('[data-theme]')

    selectTheme('dark')
    expect(wrapper).toHaveAttribute('data-theme', 'dashwind-dark')
    // No subscription exists at all while the preference is explicit.
    expect(os.listenerCount).toBe(0)

    os.emit(true)
    os.emit(false)
    expect(wrapper).toHaveAttribute('data-theme', 'dashwind-dark')
  })

  it('subscribes exactly once for ตามระบบ and unsubscribes when it is left', () => {
    const os = stubPrefersColorScheme(false)
    renderHeaderAt('/admin-portal/dashboard')

    selectTheme('system')
    expect(os.listenerCount).toBe(1)

    // Re-selecting the SAME option is idempotent — no second subscription.
    selectTheme('system')
    expect(os.listenerCount).toBe(1)

    selectTheme('light')
    expect(os.listenerCount).toBe(0)
  })

  it('still renders and still switches when localStorage throws (LINE webview case)', () => {
    const denied = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(denied)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(denied)

    const { container } = renderHeaderAt('/admin-portal/dashboard')
    const wrapper = container.querySelector('[data-theme]')

    expect(wrapper).toHaveAttribute('data-theme', 'cupcake')
    expect(() => selectTheme('dark')).not.toThrow()
    expect(wrapper).toHaveAttribute('data-theme', 'dashwind-dark')
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
    // overlap it. It is a <label htmlFor> (not a <button>) because it drives the drawer
    // checkbox, so `aria-label` is the only handle on it — hence `getByLabelText`.
    const hamburger = screen.getByLabelText('Open menu')
    expect(hamburger.tagName).toBe('LABEL')
    const navbar = hamburger.closest('.navbar') as HTMLElement
    expect(within(navbar).queryAllByRole('heading')).toHaveLength(0)
  })
})

describe('AdminPortal — navbar icon controls (ghost, age-inclusive tap targets)', () => {
  /** The full shell, so the drawer checkbox the hamburger points at really exists. */
  function renderHamburger() {
    render(
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
    return screen.getByLabelText('Open menu')
  }

  it('is a ghost square button, never the bright btn-primary the PO flagged', () => {
    const hamburger = renderHamburger()

    expect(hamburger).toHaveClass('btn', 'btn-ghost', 'btn-square', 'btn-md')
    expect(hamburger).not.toHaveClass('btn-primary')
    // No bright hover fill may be smuggled back in as a utility either.
    expect(hamburger.className).not.toMatch(/hover:(bg|btn)-(primary|secondary|accent)/)
  })

  it('keeps the 44px tap floor, the drawer wiring and the mobile-only visibility', () => {
    const hamburger = renderHamburger()

    // `btn-md` alone renders 40x40 (`--size-field * 10`); the min-* pair is the 44px floor.
    expect(hamburger).toHaveClass('min-h-11', 'min-w-11')
    expect(hamburger).toHaveClass('drawer-button', 'lg:hidden')
    expect(hamburger).toHaveAttribute('for', ADMIN_PORTAL_DRAWER_ID)
    expect(document.getElementById(ADMIN_PORTAL_DRAWER_ID)).not.toBeNull()
  })

  it('renders the Bars3 glyph at h-6 w-6 (24px) with a visible focus ring', () => {
    const hamburger = renderHamburger()

    expect(hamburger.querySelector('svg')).toHaveClass('h-6', 'w-6')
    expect(hamburger.className).toMatch(/focus-visible:outline-base-content/)
  })

  it('lifts the bell and profile triggers to the same 44px floor, unrestyled', () => {
    renderHamburger()

    const bell = screen.getByRole('button', { name: /Notifications, 2 unread/ })
    const profile = screen.getByRole('button', { name: 'Profile menu' })

    for (const control of [bell, profile]) {
      // Tap target ONLY — `btn-circle` (40x40) is KEPT, never swapped for ghost/square.
      expect(control).toHaveClass('btn', 'btn-ghost', 'btn-circle', 'min-h-11', 'min-w-11')
      expect(control).not.toHaveClass('btn-square')
    }
    // …and their contents are untouched: badge, avatar placeholder, menu items.
    expect(within(bell).getByText('2')).toBeInTheDocument()
    expect(profile.querySelector('svg')).not.toBeNull()
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
