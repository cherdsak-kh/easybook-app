import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useGate } from '@/client-portal/hooks/gate-context'
import { SplashScreen } from '@/client-portal/pages/gate/SplashScreen'
import { ALLOWED_SCREENS, type ScreenName } from '@/client-portal/routes'

/**
 * Enforces `ALLOWED_SCREENS` — on **every navigation**, not only on boot.
 *
 * ── 🔴 WHY IT RE-CHECKS RATHER THAN JUST REDIRECTING ──
 * `D-C3` rule 3: a URL can be typed, restored by LINE when the LIFF is reopened, or reached with
 * the forward button. A deep link the current access does not permit therefore goes back to `/`
 * and **restarts the four checks**, landing the user where they actually belong — rather than
 * being quietly rewritten to a screen chosen from a status that might itself be stale. A user
 * whose approval came through five minutes ago gets in on the second look; one whose access was
 * revoked does not get in at all.
 *
 * ⚠️ `gate` IS ALWAYS PERMITTED, and it has to be: `/` is not in any row of `ALLOWED_SCREENS`,
 * so without this short-circuit the bounce target would itself be forbidden and the two would
 * ping-pong forever. The prototype makes the same short-circuit one line earlier, as
 * `if (!name) { show('gate'); return; }`.
 *
 * ⚠️ THE SPLASH IS RENDERED WHILE THE BOUNCE RESOLVES, never the forbidden screen. Navigation is
 * an effect, so there is one commit in between — and painting the screen someone was not allowed
 * to see, even for a frame, is the whole thing this component exists to stop.
 */
export function GateGuard({ screen, children }: { screen: ScreenName | null; children: ReactNode }) {
  const { phase, access, steps, recheck } = useGate()
  const navigate = useNavigate()

  const permitted =
    screen === 'gate' ||
    (phase === 'settled' && access !== null && screen !== null && ALLOWED_SCREENS[access].includes(screen))
  const forbidden = phase === 'settled' && !permitted

  useEffect(() => {
    if (!forbidden) return
    recheck()
    void navigate('/', { replace: true })
  }, [forbidden, recheck, navigate])

  if (phase === 'checking' || forbidden) return <SplashScreen steps={steps} />
  return children
}
