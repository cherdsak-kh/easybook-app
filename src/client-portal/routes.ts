/**
 * The client portal's route table, and the four lookup tables the gate reads.
 *
 * Ported from the prototype's `CASES` (2334), `NAV_SCREENS` / `ALLOWED_SCREENS` (2366),
 * `NAV_TAB` (2481) and `ROUTE_ALIAS` (2528). Everything here is data; the behaviour that
 * consumes it lives in `hooks/useLiffGate.ts` and `components/shell/GateGuard.tsx`.
 *
 * ── 🔴 THE HASHES ARE GONE, AND THAT IS THE PORT, NOT A DEVIATION ──
 * The prototype routes on `location.hash` because it is one static file. `PAGE_INDEX.md` §2.4
 * says so explicitly — *"in the real app this is not a routing question at all… port the
 * behaviour, not the hash"* — and `D-C3` asks for real URL navigation, which is what this app
 * already has (`BrowserRouter`, `main.tsx`). So `#/venue/3` becomes `/venue/3`.
 *
 * ⚠️ SCREEN NAMES, NOT PATHS, ARE THE CURRENCY OF EVERY TABLE BELOW. `ALLOWED_SCREENS`,
 * `NAV_SCREENS` and `NAV_TAB` all speak screen names, and since `#/booking/:id` arrived the two
 * are no longer the same word. `screenOf()` is the ONE place the conversion happens — the
 * prototype makes the same point at 2528, having been bitten by a deep link to
 * `/booking/BR-0902` that failed to find `booking` in the permitted list and bounced to the
 * gate in silence.
 */

/** Every screen in the portal. 20 of them, matching `PAGE_INDEX.md` §1. */
export type ScreenName =
  | 'gate'
  | 'gate-error'
  | 'login'
  | 'add-friend'
  | 'register'
  | 'pending'
  | 'rejected'
  | 'blocked'
  | 'home'
  | 'venues'
  | 'bookings'
  | 'settings'
  | 'venue'
  | 'request'
  | 'sent'
  | 'booking-detail'
  | 'issues'
  | 'version'
  | 'manual'
  | 'rules'

/**
 * What the four boot checks concluded. These are the ten values `ALLOWED_SCREENS` is keyed by
 * — the prototype's `CASES` names minus the two hang cases, which are not outcomes at all:
 * they are the checks never finishing, so the portal stays on the splash and `access` stays
 * `null` (`PAGE_INDEX.md` §2.1, rows 11 and 12).
 */
export type GateAccess =
  | 'allowed'
  | 'pending'
  | 'rejected'
  | 'blocked'
  | 'unregistered'
  | 'not-friend'
  | 'not-logged-in'
  | 'line-down'
  | 'status-down'
  | 'obs2'

/** The three gate failures, which are the three faces of `/gate-error`. */
export type GateErrorReason = Extract<GateAccess, 'line-down' | 'status-down' | 'obs2'>

/**
 * 🔴 ROUTE SEGMENT → SCREEN NAME. Exactly one entry, and it earns its table.
 *
 * The route says `booking` because a URL people read and type should be short; the screen is
 * `booking-detail` because `booking` sitting next to `bookings` is the pair that gets misread
 * every time somebody scans one against the other. Applied ONCE, in `screenOf()`, before any
 * other table sees the value.
 */
const ROUTE_ALIAS: Record<string, ScreenName> = { booking: 'booking-detail' }

/** Every screen that is a real route, keyed by its first path segment. */
const SEGMENT_SCREEN: Record<string, ScreenName> = {
  'gate-error': 'gate-error',
  login: 'login',
  'add-friend': 'add-friend',
  register: 'register',
  pending: 'pending',
  rejected: 'rejected',
  blocked: 'blocked',
  home: 'home',
  venues: 'venues',
  bookings: 'bookings',
  settings: 'settings',
  venue: 'venue',
  request: 'request',
  sent: 'sent',
  issues: 'issues',
  version: 'version',
  manual: 'manual',
  rules: 'rules',
}

/**
 * The screen a pathname belongs to, or `null` when nothing in this portal owns it.
 *
 * `/` is the **gate**, not home — the same ruling `PAGE_INDEX.md` §2.4 records. If `/` meant
 * home the four checks would have no route of their own, and every unpermitted deep link (which
 * bounces to `/` to re-check) would become an instant, unchecked entry into the app.
 *
 * ⚠️ `null` is NOT "forbidden", it is "not ours" — it becomes the app's 404. The prototype
 * bounces an unknown screen name back to the gate because a static file has no 404 to offer;
 * this app has one, and sending someone who mistyped a URL through a LIFF re-check only to land
 * on a screen they did not ask for is a worse answer than saying the page does not exist.
 */
export function screenOf(pathname: string): ScreenName | null {
  const segment = pathname.replace(/^\/+/, '').split('/')[0]
  if (!segment) return 'gate'
  return ROUTE_ALIAS[segment] ?? SEGMENT_SCREEN[segment] ?? null
}

/**
 * The screens that show the dock. Deliberately NOT the same list as `ALLOWED_SCREENS.allowed`.
 *
 * ⚠️ `venue` / `request` / `sent` are permitted but dockless: they are steps in a flow with one
 * way in and one way out, and a nav bar there invites abandoning a half-filled form.
 *
 * ⚠️ `issues` `version` `manual` `rules` KEEP the dock even though none is a tab. They are
 * *reading destinations* reached from Settings, not steps with state in progress — somebody who
 * opened the manual and now wants the home screen should not have to walk back out first.
 *
 * 🟠 `booking-detail` IS ABSENT, AND THE DOCUMENTS DISAGREE WITH EACH OTHER ABOUT THAT — open for
 * the PO, do not "fix" it either way without a ruling. `PAGE_INDEX.md` §1.4 lists `#/booking/:id`
 * under a heading that reads *"reached from Settings, **dock stays visible**"*, but the ⚠️ note
 * directly beneath it enumerates only four screens and `booking-detail` is not one of them —
 * and it is not reached from Settings either, it is reached from `/bookings`. The prototype's own
 * `NAV_SCREENS` (2366) excludes it, so that is what is built here: the prototype is the design
 * authority, and it is the artefact the PO actually reviewed. Its way back is the breadcrumb
 * (`D-C14` names `#/booking/:id` explicitly), so the screen is not a dead end without the dock.
 * ⚠️ It still has a `NAV_TAB` row below, which is deliberate — see the note there.
 */
export const NAV_SCREENS: readonly ScreenName[] = [
  'home',
  'venues',
  'bookings',
  'issues',
  'settings',
  'version',
  'manual',
  'rules',
]

/**
 * Which screens each access level may reach. Prototype 2366, verbatim.
 *
 * 🔴 This is checked on EVERY navigation, not only on boot (`D-C3` rule 3). A URL can be typed,
 * restored by LINE when the LIFF is reopened, or reached with the forward button. A deep link to
 * `/home` during a network outage therefore restarts the gate rather than leaking into the app
 * with an unknown status.
 */
export const ALLOWED_SCREENS: Record<GateAccess, readonly ScreenName[]> = {
  allowed: [
    'home',
    'venues',
    'bookings',
    'issues',
    'settings',
    'version',
    'manual',
    'rules',
    'venue',
    'request',
    'sent',
    'booking-detail',
  ],
  pending: ['pending', 'register'],
  rejected: ['rejected', 'register'],
  blocked: ['blocked'],
  unregistered: ['register'],
  'not-friend': ['add-friend'],
  'not-logged-in': ['login'],
  /* The error screen is the only destination of a failed check, which is why a deep link to
     `/home` while the network is down still bounces back to re-check rather than slipping into
     the app with a status nobody has read. */
  'line-down': ['gate-error'],
  'status-down': ['gate-error'],
  obs2: ['gate-error'],
}

/** Where each access level lands once the checks finish. Prototype `CASES[*].to`. */
export const LANDING: Record<GateAccess, string> = {
  allowed: '/home',
  pending: '/pending',
  rejected: '/rejected',
  blocked: '/blocked',
  unregistered: '/register',
  'not-friend': '/add-friend',
  'not-logged-in': '/login',
  'line-down': '/gate-error',
  'status-down': '/gate-error',
  obs2: '/gate-error',
}

/**
 * Which dock tab a screen highlights. Prototype 2481.
 *
 * ⚠️ `venue` / `request` / `sent` are in here even though the dock never renders on them. The
 * highlighting rule should be a whole truth rather than the part that happens to be reachable
 * today — the day somebody turns the dock on for those screens it is already right.
 */
export const NAV_TAB: Partial<Record<ScreenName, string>> = {
  home: '/home',
  venues: '/venues',
  venue: '/venues',
  request: '/venues',
  sent: '/venues',
  bookings: '/bookings',
  'booking-detail': '/bookings',
  settings: '/settings',
  version: '/settings',
  issues: '/settings',
  manual: '/settings',
  rules: '/settings',
}

/** The four dock tabs, in order. Icons are Lucide names from `icons/licon.ts`. */
export const DOCK_TABS = [
  { href: '/home', label: 'หน้าแรก', icon: 'house' },
  { href: '/venues', label: 'จองสถานที่', icon: 'building2' },
  { href: '/bookings', label: 'การจองของฉัน', icon: 'calendarCheck' },
  { href: '/settings', label: 'ตั้งค่า', icon: 'settings' },
] as const
