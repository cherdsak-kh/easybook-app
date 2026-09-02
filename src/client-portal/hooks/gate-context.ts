import { createContext, useContext } from 'react'
import type { GateAccess } from '@/client-portal/routes'
import type { LineUserStatus } from '@/lib/api-client'

/**
 * The gate's context, split from the provider component so `GateProvider.tsx` exports a
 * component and nothing else — a module that exports both loses React Fast Refresh for the
 * whole file, and `oxlint`'s `only-export-components` says so out loud.
 */

/** The four boot checks, in the order they run. Prototype `KEYS`. */
export type BootStepKey = 'login' | 'friend' | 'register' | 'status'

/**
 * What one check is doing. Prototype `CASES[*].steps`.
 *
 * - `wait`   — not reached. The chain stops at the first step that is not `pass`.
 * - `busy`   — in flight. A step left here forever is a *hang*, which is a real case.
 * - `pass`   — answered yes.
 * - `action` — answered no, and the user can do something about it (log in, add the OA).
 * - `fail`   — answered no, and they cannot (LINE unreachable, status call failed).
 */
export type BootStepState = 'wait' | 'busy' | 'pass' | 'action' | 'fail'

export type BootSteps = Record<BootStepKey, BootStepState>

export type GateValue = {
  /**
   * `checking` while the four checks run — including *forever*, which is what the two hang
   * cases are. `settled` means `access` is populated and routing may proceed.
   */
  phase: 'checking' | 'settled'
  /** The conclusion. `null` until `phase === 'settled'`. */
  access: GateAccess | null
  /**
   * The tape the checks write to, and the reason it exists at all: `DECISIONS.md` §3.1 keeps
   * `<ul id="boot-steps">` in the DOM as `hidden` because deleting it deletes the *checking*,
   * not the *display*. It is also the only thing that tells `hang-friend` from `hang-status`,
   * since both look like a splash that never leaves.
   */
  steps: BootSteps
  /** The Thai one-liner the `status` step ends with, e.g. `รออนุมัติ`. `null` before then. */
  answer: string | null
  /**
   * The payload `GET /line-users/status` returned, kept so the registration screens (P3) do not
   * have to fetch it a second time. `null` whenever the call did not happen or did not succeed.
   */
  status: LineUserStatus | null
  /** Re-run all four checks from the top. Sets `phase` back to `checking`. */
  recheck: () => void
  /**
   * How many times the checks have been re-run since the session started. `0` on the first pass.
   *
   * ⚠️ It exists for ONE sentence on ONE screen: `#/add-friend`'s hint (prototype 559) says the
   * friendship still has not been found, and that is only true after a check has run again and
   * still concluded `not-friend`. Being on that screen with `attempts > 0` IS that fact — the
   * screen unmounts while `phase` is `checking`, so it cannot remember the button press itself.
   */
  attempts: number
  /**
   * Adopt a fresh status payload as the gate's verdict, without re-running the four checks.
   *
   * 🔴 THIS IS HOW `TRANSPORT.md` §3.1's RULE IS KEPT — *"the next screen is read from this
   * response, never inferred from the action taken"*. `POST /line-users/register` and
   * `PATCH /line-users/registration` both answer with the caller's refreshed
   * `LineUserStatusResponseDto`, so the screen after a submit is whatever `access` that body
   * carries. A submit handler that navigated to `/pending` on its own would be guessing, and
   * would be wrong the first time the backend decides otherwise.
   *
   * ⚠️ It does NOT bump {@link attempts}: nothing was re-checked, a newer answer was handed over.
   */
  applyStatus: (status: LineUserStatus) => void
}

export const GateContext = createContext<GateValue | null>(null)

/**
 * Read the gate. Throws outside `GateProvider` rather than returning a plausible-looking
 * default — a component that silently believes it is `checking` forever is harder to find than
 * a component that fails on first render.
 */
export function useGate(): GateValue {
  const value = useContext(GateContext)
  if (!value) throw new Error('useGate must be used inside <GateProvider>')
  return value
}
