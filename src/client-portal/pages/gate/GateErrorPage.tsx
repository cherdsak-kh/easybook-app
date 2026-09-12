import { StatusCard } from '@/client-portal/components/feedback/StatusCard'
import { useGate } from '@/client-portal/hooks/gate-context'
import { LIcon } from '@/client-portal/icons/LucideIcon'
import type { GateErrorReason } from '@/client-portal/routes'
import { closeWindow, isInLineClient } from '@/lib/liff'

/**
 * The screen a failed check lands on. Prototype 502–519 and 529–549.
 *
 * ── Why it exists at all ──
 * The splash has nothing left to say once a check fails. Without somewhere for the result to
 * stand, it would sit there silently forever — so a failure is a *screen*, never a red line at
 * the bottom of a list.
 *
 * ── 🔴 THE REASON COMES FROM THE GATE, NOT FROM `?reason=` ──
 * The brief specified `/gate-error?reason=line-down`. It is driven off the gate's own access
 * state instead, because a query parameter is a second, editable copy of something that already
 * exists: `access` IS the reason (`line-down` / `status-down` / `session-expired` / `obs2` are
 * four of the eleven access values, and `ALLOWED_SCREENS` maps each to exactly `['gate-error']`).
 * Two copies can disagree, and the way they disagree here is the worst one available —
 * `?reason=line-down` on an `obs2` session draws a retry button that cannot ever work, which is
 * precisely what the no-retry ruling exists to prevent. There is nothing the parameter buys back:
 * this screen is unreachable unless the guard has already established one of the four.
 *
 * ── 🔴 RETRY IS A HARD RELOAD, AND THAT IS THE WHOLE OF `#ISSUE-08` ──
 * It used to be `recheck()` + `navigate('/')`, which re-runs the four checks *inside the JS
 * context that is already broken*. For `line-down` that is fine. For an expired ID token it is a
 * closed loop: `liff.getIDToken()` hands back the token minted when the webview opened, the status
 * call 401s again, and the user arrives back on this screen having changed nothing — measured on a
 * phone woken after an hour of screen-lock, and reported as an app that simply stops working.
 * `window.location.reload()` tears the context down, so `liff.init()` runs again and the SDK mints
 * a fresh token from the native client.
 *
 * ⚠️ IT IS THE HARD RELOAD FOR **EVERY** REASON, NOT ONLY THE EXPIRED ONE. A reload is a strictly
 * stronger version of what the soft retry did, and picking per-case would mean this screen deciding
 * which failures are "really" stale — a judgement it has no information to make, since a
 * `status-down` can perfectly well be a 502 sitting on top of a token that has also expired.
 *
 * ⚠️ `announce` IS ON. `StatusCard` keeps `role="alert"` opt-in because an assertive region that
 * fires on every neutral screen trains people to ignore the one that matters. This is the one
 * that matters.
 *
 * Copy is inline, per `Q9`, and is lifted from the prototype's `CASES` (2334) unchanged.
 */

const MESSAGE: Record<
  GateErrorReason,
  { title: string; body: string; hint?: string; retry: boolean; close: boolean }
> = {
  'line-down': {
    title: 'เกิดข้อผิดพลาด',
    body: 'ไม่สามารถติดต่อ LINE ได้ในขณะนี้ กรุณาตรวจสอบการเชื่อมต่อและลองอีกครั้ง',
    retry: true,
    close: false,
  },
  'status-down': {
    title: 'เกิดข้อผิดพลาด',
    body: 'ตรวจสอบสถานะการลงทะเบียนไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและลองอีกครั้ง',
    retry: true,
    close: false,
  },
  /* 🔴 IT NAMES THE REAL CAUSE INSTEAD OF BLAMING THE CONNECTION (`#ISSUE-08`). This case used to
     arrive as `status-down` and print "กรุณาตรวจสอบการเชื่อมต่อ" at somebody whose connection is
     demonstrably fine — they are reading the sentence over it. Telling them the session expired is
     both true and actionable: the two things that fix it are the two buttons underneath.
     ⚠️ THE SECOND LINE IS A SEPARATE `hint`, NOT MORE `body`. `body` says what happened; the hint
     says what to do, and it is the only copy on this screen that refers to the buttons by name —
     merged into one paragraph the instruction disappears into the diagnosis. */
  'session-expired': {
    title: 'เซสชันหมดอายุ',
    body: 'เซสชัน LINE หมดอายุเนื่องจากไม่มีการใช้งานเป็นเวลานาน',
    hint: 'กรุณากดลองใหม่อีกครั้งเพื่อเริ่มเซสชันใหม่ หรือปิดหน้าต่างแล้วเปิดใหม่อีกครั้ง',
    retry: true,
    close: true,
  },
  /* 🔴 NO RETRY, ON PURPOSE. `obs2` is configured-but-tokenless: `VITE_LIFF_ID` is set but
     `getIdToken()` returns null, because the LINE channel lacks the `openid` scope. Retrying
     cannot fix a channel configuration, so a button here would be a lie — and one that fails
     identically every time teaches the user the app is broken rather than that somebody has to
     be told. The copy sends them to the staff instead, which is the only thing that works.
     ⚠️ AND NO CLOSE BUTTON EITHER. Reopening the LIFF re-runs the same misconfigured channel;
     offering it would be the same lie wearing a different label. */
  obs2: {
    title: 'การตรวจสอบสิทธิ์ล้มเหลว',
    body: 'การตรวจสอบสิทธิ์ LINE ล้มเหลว กรุณาติดต่อเจ้าหน้าที่เพื่อตรวจสอบข้อมูล',
    retry: false,
    close: false,
  },
}

function isGateError(access: string | null): access is GateErrorReason {
  return (
    access === 'line-down' ||
    access === 'status-down' ||
    access === 'session-expired' ||
    access === 'obs2'
  )
}

export function GateErrorPage() {
  const { access } = useGate()

  /* Not reachable through the guard — it only permits `gate-error` for the four failing access
     values. Rendering nothing beats rendering a wrong reason if that ever stops being true. */
  if (!isGateError(access)) return null
  const { title, body, hint, retry, close } = MESSAGE[access]

  /* ⚠️ READ AT RENDER, NOT IN AN EFFECT. `isInLineClient()` never throws and answers `false` in a
     plain dev browser, so there is no async moment to wait for — and gating on it is what keeps
     "ปิดหน้าต่าง" off a screen where `liff.closeWindow()` has no window to close. */
  const canClose = close && isInLineClient()

  return (
    <StatusCard
      tone="error"
      announce
      icon={<LIcon name="circleAlert" className="h-7 w-7" />}
      title={title}
      description={body}
    >
      {hint ? <p className="mt-2 text-sm text-base-content/60">{hint}</p> : null}
      {/* ⚠️ THE ACTIONS ARE A COLUMN INSIDE `StatusCard`'s ROW. Its `actions` slot is
          `mt-6 flex gap-3`, which is right for the one-button screens it was built for and would
          put two full-width buttons side by side here — 44 px targets at 375 px become two 155 px
          ones. Widening `StatusCard` for this would touch the seven screens that share it, so the
          column lives here, as its single child. */}
      {retry || canClose ? (
        <div className="mt-6 flex w-full flex-col gap-2">
          {retry ? (
            <button
              type="button"
              className="btn btn-app btn-outline w-full"
              onClick={() => window.location.reload()}
            >
              ลองใหม่อีกครั้ง
            </button>
          ) : null}
          {canClose ? (
            <button
              type="button"
              className="btn btn-app btn-outline w-full border-base-300 text-base-content/80"
              onClick={() => closeWindow()}
            >
              ปิดหน้าต่าง
            </button>
          ) : null}
        </div>
      ) : null}
    </StatusCard>
  )
}
