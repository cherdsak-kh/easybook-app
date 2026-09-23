import { Navigate } from 'react-router-dom'
import { useGate } from '@/client-portal/hooks/gate-context'
import { LANDING } from '@/client-portal/routes'

/**
 * What `/` renders once the checks finish: a redirect to wherever this access belongs.
 *
 * ── 🟠 `/` IS THE GATE, NOT HOME — and this is the one place the written spec is not followed ──
 * `passed/client_portal_v2_spec_en.md` §4.1 says `/` shows the home screen. It does not, and
 * `PAGE_INDEX.md` §2.4 records why: if `/` meant home, the four checks would have no route of
 * their own, and every unpermitted deep link — which bounces to `/` in order to re-check — would
 * become an instant, unchecked entry into the app.
 *
 * ⚠️ `replace`, so the gate does not sit in the history. Without it, LIFF's back button walks
 * from `/home` to `/`, which redirects to `/home`, which is a trap the user cannot get out of by
 * pressing back.
 *
 * ⚠️ This never renders while the gate is running — `GateGuard` shows the splash for as long as
 * `phase` is `checking`. The `null` below is for the frame that cannot happen, not for a state
 * with a meaning.
 */
export function GateLanding() {
  const { phase, access } = useGate()
  if (phase !== 'settled' || !access) return null
  return <Navigate to={LANDING[access]} replace />
}
