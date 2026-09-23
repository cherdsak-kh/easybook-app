import { StatusCard } from '@/client-portal/components/feedback/StatusCard'
import { useGate } from '@/client-portal/hooks/gate-context'
import { LIcon } from '@/client-portal/icons/LucideIcon'
import type { GateErrorReason } from '@/client-portal/routes'
import { clearSession, closeWindow, isInLineClient, login } from '@/lib/liff'

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
 * ── 🔴 RETRY IS A HARD RELOAD (`#ISSUE-08`) — EXCEPT FOR `session-expired` (`#ISSUE-13`) ──
 * It used to be `recheck()` + `navigate('/')`, which re-runs the four checks *inside the JS
 * context that is already broken*. `window.location.reload()` is a strictly stronger version of
 * that, and it is still the retry for `line-down` and `status-down`.
 *
 * ⚠️ `session-expired` DOES NOT RELOAD, BECAUSE `#ISSUE-08` ASSUMED A RELOAD MINTS A FRESH TOKEN
 * AND IT DOES NOT. The SDK caches its tokens in web storage, a reload keeps that storage, and
 * `liff.init()` prefers the cached copy — so the status call 401s again and the user lands straight
 * back here, forever (reported from system testing as `#ISSUE-13`). {@link renewSession} clears the
 * cache first, then re-authenticates through the one door each environment has: inside LINE the
 * permanent `liff.line.me` URL, which LINE intercepts and relaunches with a new token; in a browser
 * `liff.login()`. Why the cache has to go first is on `clearSession()` in `lib/liff.ts`.
 *
 * ⚠️ PICKING PER-CASE IS SAFE NOW BECAUSE THE GATE HAS ALREADY JUDGED IT: `session-expired` is set
 * on a 401 and nothing else (`useLiffGate`). A `status-down` hiding an expired token is still
 * possible — its reload then lands here as `session-expired`, and this retry takes over.
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

/**
 * The retry for `session-expired`: clear the SDK's token cache, then re-authenticate (`#ISSUE-13`).
 *
 * ⚠️ NO LIFF ID MEANS A PLAIN DEV BROWSER (`?gate=session-expired`). There is nothing to
 * re-authenticate against and `login()` is a no-op there, so it keeps the reload rather than
 * drawing a button that does nothing.
 * ⚠️ `isInLineClient()` IS READ BEFORE THE CACHE IS CLEARED, so nothing the clear touches can
 * change which door is taken.
 * ⚠️ THE EXTERNAL REDIRECT IS `origin + '/'`, NOT THE CURRENT PATH. The app uses `BrowserRouter`,
 * so the path here is `/gate-error`; returning there lets the gate pass, then `GateGuard` bounces the
 * now-allowed user to `/` and the gate runs a second time. Sending the login to `/` lets it run once
 * from the top — and `/` is the safest `redirectUri` to sit under the LIFF endpoint URL.
 */
function renewSession(): void {
  const liffId = import.meta.env.VITE_LIFF_ID
  if (!liffId) {
    window.location.reload()
    return
  }
  const inClient = isInLineClient()
  clearSession()
  if (inClient) {
    window.location.replace(`https://liff.line.me/${liffId}`)
  } else {
    login(window.location.origin + '/')
  }
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
              onClick={
                access === 'session-expired' ? renewSession : () => window.location.reload()
              }
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
