import {
  actionTarget,
  badgeText,
  bellLabel,
  relativeTime,
} from '@/admin-portal/lib/notifications'
import { VIEWER_DENY } from '@/admin-portal/lib/use-acl'
import type { AdminRouteLabel } from '@/admin-portal/routes'

/**
 * The notification centre's pure helpers (`NOTIF-UI-1`): the relative-time formatter (D-17), the CTA
 * route resolver that gates by role and guards the `/backend/` prefix (D-14, QA ADV-1), the badge
 * threshold (D-16) and the bell's accessible name. Pure functions — the kind of unit the test policy
 * asks for; everything on screen is verified in the browser instead.
 */

/** A LOCAL wall-clock time — `relativeTime` reads calendar days in local parts, as the screen does. */
const at = (y: number, mo: number, d: number, h: number, mi: number, s = 0) =>
  new Date(y, mo - 1, d, h, mi, s)

describe('relativeTime', () => {
  const now = at(2026, 9, 26, 10, 0)

  it.each([
    ['30 s in the future (clock skew)', at(2026, 9, 26, 10, 0, 30), 'เมื่อสักครู่'],
    ['59 s ago', at(2026, 9, 26, 9, 59, 1), 'เมื่อสักครู่'],
    ['exactly 60 s ago', at(2026, 9, 26, 9, 59, 0), '1 นาทีที่แล้ว'],
    ['59 min ago', at(2026, 9, 26, 9, 1), '59 นาทีที่แล้ว'],
    ['exactly 60 min ago', at(2026, 9, 26, 9, 0), '1 ชั่วโมงที่แล้ว'],
    ['00:01 the same day', at(2026, 9, 26, 0, 1), '9 ชั่วโมงที่แล้ว'],
    ['yesterday 23:30', at(2026, 9, 25, 23, 30), 'เมื่อวาน 23:30'],
    ['yesterday 08:05', at(2026, 9, 25, 8, 5), 'เมื่อวาน 08:05'],
    ['two calendar days back', at(2026, 9, 24, 23, 59), '2 วันที่แล้ว'],
    ['68 days back — no month unit', at(2026, 7, 20, 9, 0), '68 วันที่แล้ว'],
  ])('%s', (_label, t, want) => {
    expect(relativeTime(t.toISOString(), now)).toBe(want)
  })

  it('crossing midnight inside the hour is still minutes', () => {
    expect(relativeTime(at(2026, 9, 25, 23, 50).toISOString(), at(2026, 9, 26, 0, 20))).toBe(
      '30 นาทีที่แล้ว',
    )
  })

  it('crossing midnight after an hour is yesterday, not "1 ชั่วโมงที่แล้ว"', () => {
    expect(relativeTime(at(2026, 9, 25, 23, 0).toISOString(), at(2026, 9, 26, 0, 30))).toBe(
      'เมื่อวาน 23:00',
    )
  })

  it('an unparseable timestamp reads —', () => {
    expect(relativeTime('not-a-date', now)).toBe('—')
  })
})

describe('actionTarget', () => {
  /** The real VIEWER rule: everything except `VIEWER_DENY`. */
  const viewer = (label: AdminRouteLabel) => !VIEWER_DENY.includes(label)
  const admin = () => true

  it.each([
    ['null', null, admin, null],
    ['empty string', '', admin, null],
    ['a plain reachable route', '/backend/line-users', viewer, '/backend/line-users'],
    ['a VIEWER-denied route is hidden', '/backend/settings/integrations', viewer, null],
    ['the same route for ADMIN', '/backend/settings/integrations', admin, '/backend/settings/integrations'],
    ['denied even behind a query and hash', '/backend/reports/error-log?x=1#y', viewer, null],
    [
      'query and hash ride along to the router',
      '/backend/bookings/requests?status=PENDING#top',
      viewer,
      '/backend/bookings/requests?status=PENDING#top',
    ],
    ['a trailing slash still resolves the route (denied)', '/backend/settings/booking/', viewer, null],
    ['an unknown path passes through for the router to 404', '/backend/no-such-page', viewer, '/backend/no-such-page'],
    ['another origin', 'https://evil.example/backend/x', admin, null],
    ['a protocol-relative URL', '//evil.example/backend/x', admin, null],
    ['a double slash after the prefix', '/backend//evil.example', admin, null],
    ['a backslash', `/backend/${String.fromCharCode(92)}evil.example`, admin, null],
    ['a look-alike prefix', '/backendx/line-users', admin, null],
  ])('%s', (_label, url, can, want) => {
    expect(actionTarget(url, can)).toBe(want)
  })

  // ── QA ADV-1: dot segments are resolved BEFORE the prefix check and the ACL lookup ──
  describe('dot segments (ADV-1)', () => {
    it.each([
      ['`..` out of /backend/', '/backend/../x', admin],
      ['`..` to the site root', '/backend/..', admin],
      ['percent-encoded `..` out of /backend/', '/backend/%2e%2e/x', admin],
      ['`..` twice, back under /backend/ only by name', '/backend/a/../../backend-x/y', admin],
    ])('%s → null', (_label, url, can) => {
      expect(actionTarget(url, can)).toBeNull()
    })

    it('a detour into a VIEWER-denied screen is ACL-checked as that screen, and hidden', () => {
      expect(actionTarget('/backend/x/../settings/integrations', viewer)).toBeNull()
    })

    it('the same detour for ADMIN navigates to the NORMALISED path', () => {
      expect(actionTarget('/backend/x/../settings/integrations', admin)).toBe(
        '/backend/settings/integrations',
      )
    })

    it('`.` and `..` are resolved and the query and hash are kept', () => {
      expect(actionTarget('/backend/./x/../bookings/requests?status=PENDING#top', viewer)).toBe(
        '/backend/bookings/requests?status=PENDING#top',
      )
    })

    it('a percent-encoded `.` detour into a denied screen is still denied', () => {
      expect(actionTarget('/backend/x/%2E%2E/reports/error-log', viewer)).toBeNull()
    })
  })
})

describe('badgeText (D-16)', () => {
  it.each([
    [0, '0'], // the caller hides the badge at 0; the text itself is the plain number
    [1, '1'],
    [9, '9'],
    [10, '9+'],
    [250, '9+'],
  ])('%i → %s', (n, want) => {
    expect(badgeText(n)).toBe(want)
  })
})

describe('bellLabel', () => {
  it('null (not loaded yet) is the bare name, never a zero nobody measured', () => {
    expect(bellLabel(null)).toBe('การแจ้งเตือน')
  })

  it.each([
    [0, 'การแจ้งเตือน ไม่มีรายการที่ยังไม่อ่าน'],
    [1, 'การแจ้งเตือน 1 รายการที่ยังไม่อ่าน'],
    [9, 'การแจ้งเตือน 9 รายการที่ยังไม่อ่าน'],
    [10, 'การแจ้งเตือน 10 รายการที่ยังไม่อ่าน'],
  ])('%i → the exact sentence', (n, want) => {
    expect(bellLabel(n)).toBe(want)
  })
})
