import { Route, Routes } from 'react-router-dom'
import { GateProvider } from './components/shell/GateProvider'
import { LiffShell } from './components/shell/LiffShell'
import { ComingSoonScreen } from './pages/ComingSoonScreen'
import { BookingDetailPage } from './pages/bookings/BookingDetailPage'
import { MyBookingsPage } from './pages/bookings/MyBookingsPage'
import { GateErrorPage } from './pages/gate/GateErrorPage'
import { GateLanding } from './pages/gate/GateLanding'
import { HomePage } from './pages/home/HomePage'
import { AddFriendPage } from './pages/register/AddFriendPage'
import { BlockedPage } from './pages/register/BlockedPage'
import { LoginPage } from './pages/register/LoginPage'
import { PendingPage } from './pages/register/PendingPage'
import { RegistrationPage } from './pages/register/RegistrationPage'
import { RejectedPage } from './pages/register/RejectedPage'
import { BookingRequestPage } from './pages/request/BookingRequestPage'
import { BookingSentPage } from './pages/request/BookingSentPage'
import { IssuesPage } from './pages/settings/IssuesPage'
import { SettingsPage } from './pages/settings/SettingsPage'
import { ManualPage, RulesPage } from './pages/settings/SubScreenTemplate'
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
 * **None, after Phase 7b.** Eighteen in Phase 2, then six deleted by Phase 3 and the rest by
 * Phases 4–7b: `#/home` was the last row and 7b wrote it out. The table has shrunk to nothing
 * exactly as designed, and the file is now the plain route list it was always heading for.
 *
 * 🟠 `COMING_SOON`, `Stand`, `TO_VENUES` and the `ComingSoonScreen`/`UnderConstruction` pair are
 * therefore **dead as of this phase, and are deliberately left in place** rather than deleted here.
 * They are shared machinery, `#/issues` is still an "under development" screen by ruling (`Q-C5`)
 * and renders `UnderConstruction` for real, and pruning the scaffold is a decision for whoever
 * closes the phase — not a side effect of adding the last route. Recorded so nobody has to
 * rediscover that the empty array is intentional.
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
 * 🔴 **EMPTY — the twenty screens are all real.** Phase 7b wrote out `#/home`, the last stand-in,
 * so this renders nothing and the `.map()` below emits no routes.
 *
 * ⚠️ THE `TO_VENUES` CONSTANT WENT WITH THE ROW THAT USED IT, because `noUnusedLocals` leaves no
 * choice — not because the rule it carried changed. The rule was: a stand-in always offers a
 * *labelled* way out, and the honest destination differs by screen. `UnderConstruction` still owns
 * that contract and still has a live caller, the settings sub-screens.
 *
 * ⚠️ The type and the `.map()` are kept: an empty table with the machinery still attached is one
 * line to fill in, and deleting shared scaffolding is a separate decision from adding a route.
 */
const COMING_SOON: Stand[] = []

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

          {/* P7b · the home screen — the org-wide approved schedule, and the landing screen for
              every `ALLOWED` user (`LANDING.allowed`). A dock tab: `NAV_SCREENS` lists `home` and
              `NAV_TAB` maps it to `/home`, so the หน้าแรก pill highlights itself and nothing on the
              page says so.
              ⚠️ IT IS NOT THE INDEX ROUTE. `/` is the GATE (`routes.ts` `screenOf`), because the
              four checks need a route of their own — otherwise every unpermitted deep link, which
              bounces to `/` to re-check, becomes an unchecked entry into the app. */}
          <Route path="/home" element={<HomePage />} />

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
