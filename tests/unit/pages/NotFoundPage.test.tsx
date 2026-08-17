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
 *
 * The COPY changed on 2026-08-17: the ported DashWind placeholder was replaced by the
 * prototype's full-page 404 (PO ruling). The routing assertions below are the part worth
 * keeping and are unchanged; only the strings they look for moved.
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
  it('names the page, echoes the URL that missed, and offers only the PUBLIC home', () => {
    // `MemoryRouter` is required now, not decorative: the page reads the location to quote the
    // failed URL back and calls `navigate` for its one way out.
    renderAt('/fake-client?ref=old-bookmark')

    expect(screen.getByRole('heading', { name: 'ไม่พบหน้าที่คุณค้นหา' })).toBeInTheDocument()
    // The query string is part of the quote — a stale link's query is often why it is stale.
    expect(screen.getByText('/fake-client?ref=old-bookmark')).toBeInTheDocument()
    // ONE button, and it goes to the public home. A public error page must never advertise
    // where the staff entrance is.
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).toHaveTextContent('กลับสู่หน้าแรก')
  })

  it('renders the global 404 for an unknown CLIENT path (AC-4)', () => {
    renderAt('/fake-client')

    expect(screen.getByRole('heading', { name: 'ไม่พบหน้าที่คุณค้นหา' })).toBeInTheDocument()
    // The client index stand-in is NOT rendered for a bogus client path.
    expect(screen.queryByText('HOME')).not.toBeInTheDocument()
  })

  it.each(['/admin-portal', '/admin-portal/login', '/admin-portal/line-users'])(
    '404s %s — the old back-office is gone, and nothing pretends otherwise',
    (path) => {
      renderAt(path)

      expect(screen.getByRole('heading', { name: 'ไม่พบหน้าที่คุณค้นหา' })).toBeInTheDocument()
      // No shell chrome, and no bounce to a login screen that no longer exists.
      expect(screen.queryByRole('navigation')).toBeNull()
    },
  )

  it('resolves the client root to HomePage — index beats the global splat (AC-6)', () => {
    renderAt('/')

    expect(screen.getByText('HOME')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'ไม่พบหน้าที่คุณค้นหา' })).not.toBeInTheDocument()
  })
})
