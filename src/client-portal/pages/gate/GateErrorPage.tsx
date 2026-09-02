import { useNavigate } from 'react-router-dom'
import { StatusCard } from '@/client-portal/components/feedback/StatusCard'
import { useGate } from '@/client-portal/hooks/gate-context'
import { LIcon } from '@/client-portal/icons/LucideIcon'
import type { GateErrorReason } from '@/client-portal/routes'

/**
 * The screen a failed check lands on. Prototype 502–519.
 *
 * ── Why it exists at all ──
 * The splash has nothing left to say once a check fails. Without somewhere for the result to
 * stand, it would sit there silently forever — so a failure is a *screen*, never a red line at
 * the bottom of a list.
 *
 * ── 🔴 THE REASON COMES FROM THE GATE, NOT FROM `?reason=` ──
 * The brief specified `/gate-error?reason=line-down`. It is driven off the gate's own access
 * state instead, because a query parameter is a second, editable copy of something that already
 * exists: `access` IS the reason (`line-down` / `status-down` / `obs2` are three of the ten
 * access values, and `ALLOWED_SCREENS` maps each to exactly `['gate-error']`). Two copies can
 * disagree, and the way they disagree here is the worst one available — `?reason=line-down` on
 * an `obs2` session draws a retry button that cannot ever work, which is precisely what the
 * no-retry ruling exists to prevent. There is nothing the parameter buys back: this screen is
 * unreachable unless the guard has already established one of the three.
 *
 * ⚠️ `announce` IS ON. `StatusCard` keeps `role="alert"` opt-in because an assertive region that
 * fires on every neutral screen trains people to ignore the one that matters. This is the one
 * that matters.
 *
 * Copy is inline, per `Q9`, and is lifted from the prototype's `CASES` (2334) unchanged.
 */

const MESSAGE: Record<GateErrorReason, { title: string; body: string; retry: boolean }> = {
  'line-down': {
    title: 'เกิดข้อผิดพลาด',
    body: 'ไม่สามารถติดต่อ LINE ได้ในขณะนี้ กรุณาตรวจสอบการเชื่อมต่อและลองอีกครั้ง',
    retry: true,
  },
  'status-down': {
    title: 'เกิดข้อผิดพลาด',
    body: 'ตรวจสอบสถานะการลงทะเบียนไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและลองอีกครั้ง',
    retry: true,
  },
  /* 🔴 NO RETRY, ON PURPOSE. `obs2` is configured-but-tokenless: `VITE_LIFF_ID` is set but
     `getIdToken()` returns null, because the LINE channel lacks the `openid` scope. Retrying
     cannot fix a channel configuration, so a button here would be a lie — and one that fails
     identically every time teaches the user the app is broken rather than that somebody has to
     be told. The copy sends them to the staff instead, which is the only thing that works. */
  obs2: {
    title: 'การตรวจสอบสิทธิ์ล้มเหลว',
    body: 'การตรวจสอบสิทธิ์ LINE ล้มเหลว กรุณาติดต่อเจ้าหน้าที่เพื่อตรวจสอบข้อมูล',
    retry: false,
  },
}

function isGateError(access: string | null): access is GateErrorReason {
  return access === 'line-down' || access === 'status-down' || access === 'obs2'
}

export function GateErrorPage() {
  const { access, recheck } = useGate()
  const navigate = useNavigate()

  /* Not reachable through the guard — it only permits `gate-error` for the three failing access
     values. Rendering nothing beats rendering a wrong reason if that ever stops being true. */
  if (!isGateError(access)) return null
  const { title, body, retry } = MESSAGE[access]

  return (
    <StatusCard
      tone="error"
      announce
      icon={<LIcon name="circleAlert" className="h-7 w-7" />}
      title={title}
      description={body}
      actions={
        retry ? (
          <button
            type="button"
            className="btn btn-app btn-outline w-full"
            onClick={() => {
              /* Order matters: start the checks, THEN move to the gate route. The guard renders
                 the splash for as long as `phase` is `checking`, so the error screen is replaced
                 in the same commit rather than flashing while the navigation resolves. */
              recheck()
              void navigate('/', { replace: true })
            }}
          >
            ลองใหม่อีกครั้ง
          </button>
        ) : null
      }
    />
  )
}
