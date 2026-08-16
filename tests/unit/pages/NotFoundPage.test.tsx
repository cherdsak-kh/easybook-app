import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ThemeLayout } from '@/components/client-portal/ThemeLayout'

/**
 * Mirrors the route shape of `App.tsx` after the old back-office was deleted (2026-08-16):
 * ONE branch, the client theme layout, holding the client index and the single global
 * `path="*"` → `NotFoundPage`, kept LAST.
 *
 * The two admin cases this file used to carry are gone with the branch they described — but
 * one of them is REPLACED rather than dropped, because the behaviour it guarded changed
 * meaning: `/admin-portal/*` used to fall through to the global 404 after failing to match a
 * leaf inside a real branch. It now 404s because there is no branch at all. Same status code,
 * different reason, and worth pinning: it is what stops a half-restored admin route from
 * quietly redirecting to a login screen that no longer exists.
 *
 * The client index is a lightweight STAND-IN (`HOME`) — the real `HomePage` runs LIFF and API
 * effects, so it is never mounted here.
 */
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ThemeLayout portal="client" />}>
          <Route index element={<div>HOME</div>} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('NotFoundPage', () => {
  it('renders the 404 heading and a frown glyph (static component smoke)', () => {
    // The component is purely presentational — no router hook, no countdown, no redirect.
    // The `MemoryRouter` wrapper is kept deliberately (harmless) to guard a future
    // re-introduction of a router hook.
    const { container } = render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: '404 - Not Found' })).toBeInTheDocument()
    // The frown glyph is decorative (`aria-hidden`), so assert its presence structurally.
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders the global 404 for an unknown CLIENT path (AC-4)', () => {
    renderAt('/fake-client')

    expect(screen.getByRole('heading', { name: '404 - Not Found' })).toBeInTheDocument()
    // The client index stand-in is NOT rendered for a bogus client path.
    expect(screen.queryByText('HOME')).not.toBeInTheDocument()
  })

  it.each(['/admin-portal', '/admin-portal/login', '/admin-portal/line-users'])(
    '404s %s — the old back-office is gone, and nothing pretends otherwise',
    (path) => {
      renderAt(path)

      expect(screen.getByRole('heading', { name: '404 - Not Found' })).toBeInTheDocument()
      // No shell chrome, and no bounce to a login screen that no longer exists.
      expect(screen.queryByRole('navigation')).toBeNull()
    },
  )

  it('resolves the client root to HomePage — index beats the global splat (AC-6)', () => {
    renderAt('/')

    expect(screen.getByText('HOME')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '404 - Not Found' })).not.toBeInTheDocument()
  })
})
