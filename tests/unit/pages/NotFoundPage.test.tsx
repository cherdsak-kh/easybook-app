import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { NotFoundPage } from '@/pages/NotFoundPage'

/**
 * Mirrors the route shape of `App.tsx`: the client index and the single global
 * `path="*"` → `NotFoundPage`, kept LAST.
 *
 * ⚠️ The pathless `ThemeLayout` wrapper this file used to render is GONE (2 ก.ย. 2569) —
 * it was deleted with Client Portal v1. It was presentational only (it stamped
 * `data-theme` and added no path segment), so every routing assertion below is unchanged
 * and still describes the real route table.
 *
 * The two admin cases this file used to carry are gone with the branch they described — but
 * one of them is REPLACED rather than dropped, because the behaviour it guarded changed
 * meaning: `/admin-portal/*` used to fall through to the global 404 after failing to match a
 * leaf inside a real branch. It now 404s because there is no branch at all. Same status code,
 * different reason, and worth pinning: it is what stops a half-restored admin route from
 * quietly redirecting to a login screen that no longer exists.
 *
 * The client index is a lightweight STAND-IN (`HOME`). It stays a stand-in even now that the
 * real index is only a placeholder: this file tests which route WINS, not what the winner
 * renders, and pinning it to whatever occupies `/` this week would make it fail on the day v2
 * puts the real gate there.
 *
 * The COPY changed on 2026-08-17: the ported DashWind placeholder was replaced by the
 * prototype's full-page 404 (PO ruling). The routing assertions below are the part worth
 * keeping and are unchanged; only the strings they look for moved.
 */
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route index element={<div>HOME</div>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('NotFoundPage', () => {
  it('names the page, echoes the URL that missed, and offers only the PUBLIC home', () => {
    // `MemoryRouter` is required now, not decorative: the page reads the location to quote the
    // failed URL back, and its one way out is a router link.
    renderAt('/fake-client?ref=old-bookmark')

    expect(screen.getByRole('heading', { name: 'ไม่พบหน้าที่คุณค้นหา' })).toBeInTheDocument()
    // The query string is part of the quote — a stale link's query is often why it is stale.
    expect(screen.getByText('/fake-client?ref=old-bookmark')).toBeInTheDocument()
    // ⚠️ A LINK, not a button, and this assertion changed on purpose (18 ส.ค. 2569): it used to
    // pin `role="button"`, which is what the first port rendered and what the prototype does
    // NOT — home has a real URL, so it must be middle-clickable and copyable. The spec was
    // holding the defect in place.
    //
    // ONE way out and it is the PUBLIC home; a public error page must never advertise where the
    // staff entrance is. That is what `toHaveLength(1)` is really guarding, so it stays.
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveTextContent('กลับสู่หน้าแรก')
    expect(links[0]).toHaveAttribute('href', '/')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
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
