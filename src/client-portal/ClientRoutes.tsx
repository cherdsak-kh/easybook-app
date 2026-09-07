import { Route, Routes } from 'react-router-dom'
import { GateProvider } from './components/shell/GateProvider'
import { LiffShell } from './components/shell/LiffShell'
import { ComingSoonScreen } from './pages/ComingSoonScreen'
import { BookingDetailPage } from './pages/bookings/BookingDetailPage'
import { MyBookingsPage } from './pages/bookings/MyBookingsPage'
import { GateErrorPage } from './pages/gate/GateErrorPage'
import { GateLanding } from './pages/gate/GateLanding'
import { AddFriendPage } from './pages/register/AddFriendPage'
import { BlockedPage } from './pages/register/BlockedPage'
import { LoginPage } from './pages/register/LoginPage'
import { PendingPage } from './pages/register/PendingPage'
import { RegistrationPage } from './pages/register/RegistrationPage'
import { RejectedPage } from './pages/register/RejectedPage'
import { BookingRequestPage } from './pages/request/BookingRequestPage'
import { BookingSentPage } from './pages/request/BookingSentPage'
import { SettingsPage } from './pages/settings/SettingsPage'
import { IssuesPage, ManualPage, RulesPage } from './pages/settings/SubScreenTemplate'
import { VersionPage } from './pages/settings/VersionPage'
import { VenueDetailPage } from './pages/venues/VenueDetailPage'
import { VenuesCatalogPage } from './pages/venues/VenuesCatalogPage'
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
 * **One, after Phase 7a** — eighteen in Phase 2, then six deleted by Phase 3 and the rest by
 * Phases 4–7a. The built ones are the `<Route>`s written out by hand above it. Each phase deletes
 * its own rows from the table and writes them out in their place, so the table shrinks to nothing
 * and the file ends up as a plain route list. One object to read rather than a branch hidden
 * inside a loop.
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
 * ⚠️ THE EXIT IS PART OF THE STAND-IN. `UnderConstruction`'s contract is that a dead end always
 * offers a labelled way out, and the honest destination differs by screen. The two other spellings
 * this constant used to have — *กลับสู่หน้าตั้งค่า* and *กลับสู่หน้าแรก* — went out with the rows
 * that used them, not because the rule changed: the settings sub-screens now say the first of them
 * for real, from inside `UnderConstruction`'s own default.
 */
const TO_VENUES = { backTo: '/venues', backLabel: 'กลับสู่รายการสถานที่' }

/**
 * ⚠️ ONE ROW LEFT, AND IT EMPTIES IN 7b. Phase 7a wrote out the five settings screens
 * (`/settings` `/issues` `/version` `/manual` `/rules`), so only `#/home` is still a stand-in.
 *
 * 🟠 `#/home`'s EXIT STILL POINTS AT `/venues` and that is now the only honest destination left:
 * every other screen this array used to hold is real, so "back to the start" would land on the
 * screen the visitor is already looking at. 7b deletes this row and, with it, the P5b decision that
 * pointed `#/sent/:id`'s กลับหน้าแรก button at `/venues` for the same reason.
 */
const COMING_SOON: Stand[] = [{ path: '/home', screen: 'home', ...TO_VENUES }]

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

          {/* P4 · discovery. `/venues` is a dock tab; `/venue/:id` is a step in a flow and is
              dockless. Neither says so itself — `NAV_SCREENS` already lists `venues` and omits
              `venue`, and `LiffShell` reads that, so the dock cannot disagree with the table. */}
          <Route path="/venues" element={<VenuesCatalogPage />} />
          <Route path="/venue/:id" element={<VenueDetailPage />} />

          {/* P5 · the booking request. Both dockless for the same reason `/venue/:id` is: they are
              steps in a flow with state in progress, and `NAV_SCREENS` omits both — nothing here
              opts out by hand.
              ⚠️ `/sent/:id` IS ADDRESSED BY THE BOOKING **CODE**, not the cuid — `BR-25690903-001`
              is what a person can read off a screen and type back in, which is the whole reason the
              column exists alongside `id`. */}
          <Route path="/request/:id" element={<BookingRequestPage />} />
          <Route path="/sent/:id" element={<BookingSentPage />} />

          {/* P6 · my bookings. `/bookings` is a dock tab; `/booking/:id` is dockless — and the
              difference is expressed in `NAV_SCREENS`, which lists the first and omits the second,
              not by anything either page says about itself.
              ⚠️ `/booking/:id` ACCEPTS THE CUID **OR** THE `BR-…` CODE. The list links by `id`; a
              person pasting the number out of a LINE chat has the code, and the server resolves
              both through one query. A bad value is a 404 and bounces to `/bookings`
              (`PAGE_INDEX.md` §2.3) — the validator Phase 2 declined to guess at now exists,
              because Phase 6 owns the data it would have been guessing about. */}
          <Route path="/bookings" element={<MyBookingsPage />} />
          <Route path="/booking/:id" element={<BookingDetailPage />} />

          {/* P7a · settings and its four sub-screens. All five keep the DOCK — `NAV_SCREENS` lists
              every one of them and `NAV_TAB` points all four sub-screens back at `/settings`, so
              the ตั้งค่า tab stays highlighted while the reader is inside the branch. They are
              *reading destinations*, not steps with state in progress, which is why they differ
              from `/venue/:id` and `/request/:id` here.
              ⚠️ Nothing below says any of that: the tables in `routes.ts` do, and `LiffShell`
              reads them. */}
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/version" element={<VersionPage />} />
          <Route path="/issues" element={<IssuesPage />} />
          <Route path="/manual" element={<ManualPage />} />
          <Route path="/rules" element={<RulesPage />} />

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
