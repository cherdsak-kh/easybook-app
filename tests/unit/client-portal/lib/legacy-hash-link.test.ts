import { legacyHashTarget } from '@/client-portal/lib/legacy-hash-link'

/**
 * The forward for LINE cards that still carry `#/booking/:id` / `#/venue/:id` (App.tsx runs it once
 * at module load). A pure route resolver, which is the kind of unit the test policy asks for.
 */
describe('legacyHashTarget', () => {
  it.each([
    ['#/booking/abc', '', '/booking/abc'],
    ['#/venue/v1', '', '/venue/v1'],
    ['#/booking/BR-25690903-001', '', '/booking/BR-25690903-001'],
    ['#/', '', '/'],
  ])('forwards %s to its path', (hash, search, expected) => {
    expect(legacyHashTarget(hash, search)).toBe(expected)
  })

  it('keeps a query string that was inside the hash', () => {
    expect(legacyHashTarget('#/booking/abc?x=1', '')).toBe('/booking/abc?x=1')
    expect(legacyHashTarget('#/booking/abc?x=1#top', '')).toBe('/booking/abc?x=1#top')
  })

  it('keeps the outer query verbatim, so liff.state, ?code= and ?gate= survive', () => {
    expect(legacyHashTarget('#/booking/abc', '?gate=allowed')).toBe('/booking/abc?gate=allowed')
    expect(legacyHashTarget('#/booking/abc?x=1', '?gate=allowed')).toBe(
      '/booking/abc?x=1&gate=allowed',
    )
    expect(legacyHashTarget('#/venue/v1', '?liff.state=%2Fbooking%2Fa%20b')).toBe(
      '/venue/v1?liff.state=%2Fbooking%2Fa%20b',
    )
  })

  it.each(['', '#', '#top', '#access_token=a&id_token=b&context_token=c'])(
    'leaves %j alone: not a hash route, and LIFF may still need to read it',
    (hash) => {
      expect(legacyHashTarget(hash, '?gate=allowed')).toBeNull()
    },
  )

  it.each([
    '#//evil.example/booking/abc',
    '#/\\evil.example/booking/abc',
    '#//evil.com',
    '#/\\evil.com',
  ])('refuses %s, which would resolve to another origin', (hash) => {
    expect(legacyHashTarget(hash, '')).toBeNull()
  })

  /**
   * QA R2-OBS-1. The old guard read only `inner[1]`, so these three walked past it and produced a
   * target whose *pathname* is the protocol-relative `//evil.com`. The origin comparison alone does
   * not catch them either — they resolve to this origin.
   */
  it.each(['#/..//evil.com', '#/%2e%2e//evil.com', '#/.//evil.com'])(
    'refuses %s, whose dot segments normalise to the pathname //evil.com',
    (hash) => {
      expect(legacyHashTarget(hash, '')).toBeNull()
      expect(legacyHashTarget(hash, '?gate=allowed')).toBeNull()
    },
  )

  /**
   * The encoded cousins are NOT off-site: `%2F`, `%5C` and a `https://` that sits after the hash's
   * own `/` all stay one same-origin path segment. They are forwarded verbatim and land on the
   * client 404 — the point is that they land on THIS origin, with exactly one leading slash.
   */
  it.each([
    ['#/%5Cevil.com', '/%5Cevil.com'],
    ['#/%2F%2Fevil.com', '/%2F%2Fevil.com'],
    ['#/https://evil.com', '/https://evil.com'],
    ['#/https:%2F%2Fevil.com', '/https:%2F%2Fevil.com'],
  ])('forwards %s to the same-origin path %s', (hash, expected) => {
    expect(legacyHashTarget(hash, '')).toBe(expected)
  })

  it('never returns a target that leaves this origin or starts with //', () => {
    const hostile = [
      '#/..//evil.com',
      '#/%2e%2e//evil.com',
      '#/.//evil.com',
      '#//evil.com',
      '#/\\evil.com',
      '#/%5Cevil.com',
      '#/https://evil.com',
      '#/https:%2F%2Fevil.com',
    ]
    for (const hash of hostile) {
      const target = legacyHashTarget(hash, '?gate=allowed')
      if (target === null) continue // not forwarded at all: the page stays where it is
      const resolved = new URL(target, window.location.origin)
      expect(resolved.origin).toBe(window.location.origin)
      expect(resolved.pathname.startsWith('//')).toBe(false)
      expect(target.startsWith('/')).toBe(true)
    }
  })
})
