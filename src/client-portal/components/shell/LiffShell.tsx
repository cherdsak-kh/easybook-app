import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { ClientRealtimeProvider } from './ClientRealtimeProvider'
import { Dock } from './Dock'
import { DockItem } from './DockItem'
import { GateGuard } from './GateGuard'
import { NavScrim } from './NavScrim'
import { ToastProvider } from '@/client-portal/components/feedback/Toast'
import { useGate } from '@/client-portal/hooks/gate-context'
import { useVisualViewport } from '@/client-portal/hooks/useVisualViewport'
import { DOCK_TABS, NAV_SCREENS, NAV_TAB, screenOf } from '@/client-portal/routes'

/**
 * The LIFF surface: viewport, gate and dock. Every gated route renders inside this.
 *
 * ⚠️ `data-theme` IS NOT WRITTEN HERE — it is written once, in `ClientRoutes`, one level up.
 * It started on this element and was moved on the day the 404 was measured with no theme at all
 * (2 ก.ย. 2569): the 404 sits outside the shell on purpose, so a writer here can never reach it,
 * and "exactly one place writes `data-theme`" was quietly buying a themeless screen.
 *
 * ── ⚠️ `.pad-nav` IS APPLIED HERE, ON THE SAME CONDITION AS THE DOCK ──
 * `D-C5` puts the burden on each screen ("a floating nav is out of flow, so every screen it
 * appears on must reserve room for it itself"), and the prototype has no choice: its screens are
 * static sections and the dock's visibility is decided elsewhere. Here the two decisions are one
 * expression, so binding the padding to it removes the failure that rule was warning about —
 * a screen that forgets `.pad-nav` and hides its own last row behind the pill. The same argument
 * the prototype makes for tying `.nav-scrim` to `nav.hidden`: they are a pair, so they should not
 * be two facts that can disagree.
 *
 * ── The dock renders for `ALLOWED` and nothing else ──
 * Not because the other states lack tabs, but because none of the dock's destinations is
 * reachable from them — the screen and the menu underneath it should agree.
 */
export function LiffShell() {
  useVisualViewport()
  const { phase, access } = useGate()
  const { pathname } = useLocation()
  const screen = screenOf(pathname)

  /* Every route change starts at the top. The prototype does this in `show()`; a router keeps
     the scroll position by default, which on a phone means arriving at a new screen already
     scrolled halfway down it. */
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  const showDock =
    phase === 'settled' && access === 'allowed' && screen !== null && NAV_SCREENS.includes(screen)
  const activeTab = screen ? NAV_TAB[screen] : undefined

  /* 🔴 THE SAME CONDITION THE DOCK'S FIRST TWO CLAUSES USE, AND NOT THE SAME EXPRESSION. The socket
     does not care which screen is showing — it has to stay open across every one of them, which is
     the entire reason it lives at the shell — so it must not inherit `showDock`'s `NAV_SCREENS`
     test. The gateway refuses anyone whose `AppAccess` is not `ALLOWED`, and a session that is still
     `checking` has no verdict to act on; both are covered here rather than by a failed handshake. */
  const realtime = phase === 'settled' && access === 'allowed'

  return (
    /* 🔴 `ToastProvider` WRAPS THE WHOLE SHELL, AND IT WAS MISSING UNTIL PHASE 6b (3 ก.ย. 2569).
       The component was built in Phase 1 and mounted **only inside the showcase page**, so
       `useToast()` threw "must be used inside <ToastProvider>" the first time a real screen asked
       for one — caught in the browser, not by `tsc`, because the error is a runtime context lookup.
       It belongs here rather than in a page: the toast is fixed-position feedback about something
       that just happened, and a provider per screen would unmount the queue on navigation, which is
       exactly when a "cancelled successfully" message still needs to be on screen. */
    <ToastProvider>
      {/* 🔴 INSIDE `ToastProvider`, NEVER OUTSIDE IT. The provider raises the global toast for an
          approval or a refusal arriving over the socket, so it calls `useToast()` — which THROWS
          rather than no-oping when there is no provider above it, on the reasoning in
          `toast-context.ts` (a portal whose notices silently go nowhere looks exactly like one where
          nothing has happened). Swapping these two lines is a blank screen, not a missing toast. */}
      <ClientRealtimeProvider enabled={realtime}>
        <div className={showDock ? 'pad-nav' : undefined}>
          <GateGuard screen={screen}>
            <Outlet />
          </GateGuard>
        </div>

        {/* 🔴 THE SCRIM AND THE DOCK ARE ONE DECISION. Left behind on a screen with no dock, the
            fade covers the bottom of the page with nothing under it — and the submit button at the
            end of a form looks disabled while being perfectly clickable. */}
        {showDock ? (
          <>
            <NavScrim />
            <Dock>
              {DOCK_TABS.map((tab) => (
                <DockItem
                  key={tab.href}
                  href={tab.href}
                  label={tab.label}
                  icon={tab.icon}
                  active={activeTab === tab.href}
                />
              ))}
            </Dock>
          </>
        ) : null}
      </ClientRealtimeProvider>
    </ToastProvider>
  )
}
