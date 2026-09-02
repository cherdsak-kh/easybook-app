import { Route, Routes } from 'react-router-dom'
import { GateProvider } from './components/shell/GateProvider'
import { LiffShell } from './components/shell/LiffShell'
import { ComingSoonScreen } from './pages/ComingSoonScreen'
import { GateErrorPage } from './pages/gate/GateErrorPage'
import { GateLanding } from './pages/gate/GateLanding'
import { AddFriendPage } from './pages/register/AddFriendPage'
import { BlockedPage } from './pages/register/BlockedPage'
import { LoginPage } from './pages/register/LoginPage'
import { PendingPage } from './pages/register/PendingPage'
import { RegistrationPage } from './pages/register/RegistrationPage'
import { RejectedPage } from './pages/register/RejectedPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { useResolvedTheme } from '@/hooks/useResolvedTheme'
import type { ScreenName } from './routes'

/**
 * The client LIFF surface: twenty routes, one shell, one gate.
 *
 * ── ⚠️ THE ROUTES ARE MAPPED, NEVER HAND-LISTED ──
 * The same rule the back-office follows for its 31: a hand-written `<Route>` list is a second
 * copy of the route table, and what it produces is a dock tab that 404s — or worse, a URL that
 * works while every table says the screen does not exist. Adding a destination means adding a row
 * here and a segment to `SEGMENT_SCREEN` in `routes.ts`, and nothing else.
 *
 * ── `COMING_SOON` is the answer to "which of the twenty are NOT real yet?" ──
 * Twelve, after Phase 3 — eighteen in Phase 2, minus the six of the identity lifecycle. The built
 * ones are the `<Route>`s written out by hand above it. Each phase deletes its own rows from the
 * table and writes them out in their place, so the table shrinks to nothing and the file ends up
 * as a plain route list. One object to read rather than a branch hidden inside a loop.
 *
 * ⚠️ `RESTART` HAS NO ROWS LEFT and that is why it is gone: every screen that offered "start the
 * checks again" as its way out was a gate outcome, and all six are now real.
 *
 * ⚠️ PARAMETER VALIDATION IS NOT HERE, AND IS NOT MISSING. `PAGE_INDEX.md` §2.3 sends a bad
 * `/venue/:id` to `/venues` and a bad `/booking/:id` to `/bookings` — but "bad" means *not in the
 * data*, and Phases 4 and 6 own the data. Guessing at it now would mean writing a validator
 * against a fixture and deleting it later.
 */

type Stand = { path: string; screen: ScreenName; backTo: string; backLabel: string }

/**
 * ⚠️ THE EXITS ARE PART OF THE STAND-IN. `UnderConstruction`'s contract is that a dead end always
 * offers a labelled way out, and the honest destination differs by screen: a settings sub-screen
 * goes back to Settings (which is what the prototype draws), a flow step goes back to the list it
 * came from, and a gate-outcome screen goes back to `/` — which restarts the checks and lands the
 * user wherever they actually belong, the only thing that is true for all six of them.
 */
const TO_SETTINGS = { backTo: '/settings', backLabel: 'กลับสู่หน้าตั้งค่า' }
const TO_VENUES = { backTo: '/venues', backLabel: 'กลับสู่รายการสถานที่' }
const TO_HOME = { backTo: '/home', backLabel: 'กลับสู่หน้าแรก' }

const COMING_SOON: Stand[] = [
  // 🟠 Q-C7 · unassigned to any phase — the PO's call, not a phase's to adopt quietly.
  { path: '/home', screen: 'home', ...TO_VENUES },
  { path: '/settings', screen: 'settings', ...TO_HOME },
  { path: '/issues', screen: 'issues', ...TO_SETTINGS },
  { path: '/version', screen: 'version', ...TO_SETTINGS },
  { path: '/manual', screen: 'manual', ...TO_SETTINGS },
  { path: '/rules', screen: 'rules', ...TO_SETTINGS },

  // P4 · venue browsing.
  { path: '/venues', screen: 'venues', ...TO_HOME },
  { path: '/venue/:id', screen: 'venue', ...TO_VENUES },

  // P5 · the booking request.
  { path: '/request/:id', screen: 'request', ...TO_VENUES },
  { path: '/sent/:id', screen: 'sent', ...TO_VENUES },

  // P6 · my bookings.
  { path: '/bookings', screen: 'bookings', ...TO_HOME },
  {
    path: '/booking/:id',
    screen: 'booking-detail',
    backTo: '/bookings',
    backLabel: 'กลับสู่การจองของฉัน',
  },
]

export function ClientRoutes() {
  /**
   * ── 🔴 THE ONE PLACE `data-theme` IS WRITTEN FOR THE CLIENT PORTAL ──
   * Not on `<html>`, for the reason the back-office gives on `BackendLayout`: two portals in one
   * SPA must not be able to reach each other's tokens, and an attribute on the shared root is the
   * one place they could. Not on `LiffShell` either, which is where it started — the 404 lives
   * OUTSIDE the shell on purpose (a URL this portal does not own must not run four LINE checks),
   * so a writer down there cannot reach it, and measuring found exactly that: a themeless 404
   * rendering in daisyUI's default light for a user whose phone is in dark mode. It has had no
   * theme since `ThemeLayout` was deleted with v1; this is where that gets closed.
   *
   * ⚠️ Dialogs still inherit from here. The top layer changes where an element *paints*, not
   * where it sits in the tree.
   */
  const theme = useResolvedTheme('client')

  return (
    <div data-theme={theme} className="min-h-dvh bg-base-200 text-base-content">
      <Routes>
        {/* The layout route. `GateProvider` wraps the SHELL, not the `<Routes>`, so the four
            checks run once for the session rather than once per navigation — and so a 404 (below,
            outside this branch) never starts a LIFF init for a URL this portal does not own. */}
        <Route
          element={
            <GateProvider>
              <LiffShell />
            </GateProvider>
          }
        >
          {/* P2 · the gate. */}
          <Route index element={<GateLanding />} />
          <Route path="/gate-error" element={<GateErrorPage />} />

          {/* P3 · the identity lifecycle. Six screens, all dockless — none of the dock's
              destinations is reachable by somebody who is not yet `ALLOWED`, so the screen and the
              rich menu underneath it agree (`PAGE_INDEX.md` §1.1). Nothing here opts out of the
              dock by hand: `NAV_SCREENS` excludes all six, and `LiffShell` reads that. */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/add-friend" element={<AddFriendPage />} />
          <Route path="/register" element={<RegistrationPage />} />
          <Route path="/pending" element={<PendingPage />} />
          <Route path="/rejected" element={<RejectedPage />} />
          <Route path="/blocked" element={<BlockedPage />} />

          {COMING_SOON.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={<ComingSoonScreen backTo={route.backTo} backLabel={route.backLabel} />}
            />
          ))}
        </Route>

        {/* 🔴 THE 404 IS OUTSIDE THE SHELL, AND OUTSIDE THE GATE. A URL this portal does not own
            is not a permission problem, so it must not be answered by running four LINE checks and
            then landing the visitor on a screen they never asked for. The prototype bounces an
            unknown screen name back to the gate only because a static file has no 404 to offer.
            ⚠️ It stays LAST and stays the CLIENT's 404: the back-office's shell 404 would
            advertise the staff entrance to everyone who mistyped an address. */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  )
}
