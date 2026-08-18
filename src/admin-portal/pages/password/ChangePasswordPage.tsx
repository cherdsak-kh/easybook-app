/**
 * เปลี่ยนรหัสผ่าน — the VOLUNTARY door to `POST /auth/system/password`.
 *
 * ── One endpoint, two screens, and they are not the same screen ──
 * `ForcePasswordChangePage` is what `/backend/*` RENDERS while `mustChangePassword` is true: no
 * shell, no cancel, a logout link as the only exit. This one is a destination inside the shell that
 * the operator chose to visit — so it has a breadcrumb, a cancel button, and a place to go back to.
 * Everything they share — the policy, the checklist, the three fields, the error sentences — is
 * shared as CODE (`password-policy.ts`, `PasswordField`, `PasswordRules`), because the one thing
 * that must never differ between them is what counts as a valid password.
 *
 * ⚠️ A WRONG `currentPassword` IS A 400, NEVER A 401. It renders inline on that field and must not
 * be treated as session death — the session is valid; only the re-auth failed. Bouncing to login
 * for a typo is the classic self-inflicted logout.
 *
 * ⚠️ ONLY THE CURRENT-PASSWORD BOX IS CLEARED ON A 400, and the new password the operator already
 * composed is kept. Retyping a value that was never the problem is how one typo becomes three
 * attempts.
 *
 * ⚠️ `confirmPassword` IS NEVER SENT. `forbidNonWhitelisted` rejects any key that is not
 * `currentPassword` or `newPassword`, so serialising it would be a 400. Read it, compare it,
 * forget it.
 *
 * ── The aside is not filler ──
 * Both of its first two lines answer a question the operator WILL have and would otherwise answer
 * wrongly by guessing. The second is the uncomfortable one and is why the card exists at all:
 * `easybook-service` has no session-revocation machinery, so changing your password does NOT evict
 * anyone already signed in as you. Someone changing their password because they suspect a
 * compromise is doing it to kick an intruder out, and here that does not happen. A screen that
 * stays quiet about that is letting them believe they are safe.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, changeOwnPassword } from '@/lib/api-client'
import { InlineAlert } from '../../components/feedback/InlineAlert'
import { PageHeading } from '../../components/shell/PageHeading'
import { PasswordField } from '../../components/ui/PasswordField'
import { PasswordRules } from '../../components/ui/PasswordRules'
import { useToast } from '../../lib/toast-context'
import {
  checkPassword,
  newPasswordError,
  PASSWORD_MAX,
  PASSWORD_MIN,
} from '../../lib/password-policy'
import { routeOf, urlOf, type AdminRoute } from '../../routes'

const MSG = {
  currentRequired: 'โปรดระบุรหัสผ่านปัจจุบัน',
  confirmRequired: 'โปรดยืนยันรหัสผ่านใหม่',
  mismatch: 'รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน',
  wrongCurrent: 'รหัสผ่านปัจจุบันไม่ถูกต้อง',
  unavailable: 'ระบบไม่สามารถใช้งานได้ชั่วคราว โปรดลองใหม่อีกครั้งในภายหลัง',
  network: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ โปรดลองใหม่อีกครั้ง',
  failed: 'บันทึกรหัสผ่านใหม่ไม่สำเร็จ โปรดลองใหม่อีกครั้ง',
  saved: 'เปลี่ยนรหัสผ่านเรียบร้อย',
} as const

/** The three notes in the aside. `d` is the 24×24 outline path. */
const AFTER: readonly { d: string; text: string }[] = [
  {
    d: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    text: 'คุณจะไม่ถูกออกจากระบบ ใช้งานต่อได้ทันทีโดยไม่ต้องเข้าสู่ระบบใหม่ และครั้งถัดไปให้ใช้รหัสผ่านใหม่',
  },
  {
    d: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
    text: 'อุปกรณ์อื่นที่เข้าสู่ระบบบัญชีนี้อยู่จะไม่ถูกออกจากระบบ ระบบยังไม่รองรับการยกเลิกเซสชันจากระยะไกล หากสงสัยว่ามีผู้อื่นเข้าถึงบัญชีของคุณ ให้ติดต่อผู้ดูแลระบบ',
  },
  {
    d: 'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z',
    text: 'หากจำรหัสผ่านปัจจุบันไม่ได้ ระบบไม่มีการรีเซ็ตด้วยตนเอง ต้องให้ผู้ดูแลระบบออกรหัสผ่านชั่วคราวให้ใหม่',
  },
]

export function ChangePasswordPage({ route }: { route: AdminRoute }) {
  const navigate = useNavigate()
  const toast = useToast()

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [currentErr, setCurrentErr] = useState('')
  const [nextErr, setNextErr] = useState('')
  const [confirmErr, setConfirmErr] = useState('')
  const [alert, setAlert] = useState('')
  const [busy, setBusy] = useState(false)

  // The current-password box feeds the checklist too: "ไม่ซ้ำกับรหัสผ่านปัจจุบัน" cannot be
  // evaluated without it, so editing either box re-answers the question.
  const rules = checkPassword(next, current)

  /**
   * ยกเลิก and the post-save exit both land on โปรไฟล์ — the card that linked here — rather than on
   * `navigate(-1)`. History is not the answer: the operator may have arrived from the account menu,
   * from a deep link, or by reloading, and "back" then means three different places. The route is
   * looked up rather than hardcoded so renaming it breaks the build instead of the button.
   */
  const profile = routeOf('โปรไฟล์')
  const back = () => {
    if (profile) void navigate(urlOf(profile))
    else void navigate(-1)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setAlert('')

    const cErr = current ? '' : MSG.currentRequired
    const nErr = newPasswordError(next, current)
    // An EMPTY confirm box gets "โปรดยืนยัน", not "ไม่ตรงกัน" — the latter accuses the operator of
    // a typo they have not made yet.
    const fErr = !confirm ? MSG.confirmRequired : confirm === next ? '' : MSG.mismatch
    setCurrentErr(cErr)
    setNextErr(nErr)
    setConfirmErr(fErr)
    if (cErr || nErr || fErr) return

    setBusy(true)
    try {
      await changeOwnPassword(current, next)
      // Nothing to re-probe: `mustChangePassword` was already false to be standing here, and the
      // same cookie keeps working — `SessionGuard` re-reads the user every request. Clear the three
      // values so a half-typed password cannot survive the navigation, then say so and leave.
      setCurrent('')
      setNext('')
      setConfirm('')
      toast('success', MSG.saved)
      back()
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0
      const message = err instanceof ApiError ? err.message : ''
      if (status === 400) {
        // The server does not name the failing rule in a machine-readable way, and the common 400
        // by far is the wrong current password — the client already checked every other rule
        // before sending. So it lands on that field, where the fix is.
        setCurrentErr(MSG.wrongCurrent)
        setCurrent('')
      } else if (status === 503) {
        setAlert(MSG.unavailable)
      } else if (status === 0) {
        setAlert(MSG.network)
      } else {
        // A 401 is genuine session death and the session-expired dialog is wired to it centrally,
        // so this must not compete with it — it says nothing specific.
        setAlert(message || MSG.failed)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card-shell lg:overflow-y-auto">
      <PageHeading route={route} desc="ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ" />

      {/* One column up to `lg`, two from `xl`. The form never exceeds 680px at any width — a text
          input wider than that is worse to fill in, not better — so the question was only ever what
          goes BESIDE it. Stacking the note card underneath left ~440px of dead space on a 1440px
          screen, which reads as an unfinished page rather than a deliberately narrow form.

          `xl` and not `lg`, measured: the content region is `viewport − 336px` with the sidebar
          open, and the form column is what is left after the 320px aside and the 16px gap — so
          `viewport − 672px`. At `lg` (1024) that is a 352px form, NARROWER than the single column it
          replaced. At `xl` (1280) it is 608px, and by 1440 the 680px cap takes over. The 680 is a
          MAXIMUM (`minmax(0,680px)`), which is why 1280 works at all.

          `items-start` so the aside keeps its own height instead of stretching to the form's — a
          3-item list rendered 600px tall with all its text at the top is not a card, it is a box. */}
      <div className="grid w-full max-w-[680px] gap-4 pb-1 xl:max-w-[1016px] xl:grid-cols-[minmax(0,680px)_minmax(0,320px)] xl:items-start">
        <form noValidate onSubmit={(e) => void onSubmit(e)} className="pf-card overflow-hidden">
          <div className="pf-head">
            <div className="min-w-0">
              <h2 className="pf-title">ตั้งรหัสผ่านใหม่</h2>
              <p className="pf-note">ต้องกรอกรหัสผ่านปัจจุบันเพื่อยืนยันว่าเป็นคุณ</p>
            </div>
          </div>

          <div className="pf-body">
            {/* Server answers about the REQUEST, not about one field. A wrong current password is
                deliberately not one of them — it goes on the field it is about. */}
            <InlineAlert message={alert} className="mb-4 mt-0" />

            {/* The reveal toggle is here for a different reason than on the forced screen. There it
                is because the value is being transcribed off paper. Here it is because a wrong
                current password costs a round trip and a cleared box, and the operator has no other
                way to check what they typed. */}
            <PasswordField
              id="pwp-current"
              name="currentPassword"
              label="รหัสผ่านปัจจุบัน"
              maxLength={PASSWORD_MAX}
              autoComplete="current-password"
              placeholder="รหัสผ่านที่ใช้อยู่ตอนนี้"
              value={current}
              error={currentErr}
              onChange={(e) => {
                setCurrent(e.target.value)
                if (currentErr) setCurrentErr('')
              }}
            />

            <div className="mt-4">
              <PasswordField
                id="pwp-new"
                name="newPassword"
                label="รหัสผ่านใหม่"
                maxLength={PASSWORD_MAX}
                autoComplete="new-password"
                placeholder={`อย่างน้อย ${PASSWORD_MIN} ตัวอักษร`}
                value={next}
                error={nextErr}
                // The WHOLE policy is described by the field, so it is read out on focus rather
                // than discovered one rejection at a time.
                aria-describedby="pwp-rules"
                onChange={(e) => {
                  setNext(e.target.value)
                  if (nextErr) setNextErr('')
                }}
              />
              <PasswordRules id="pwp-rules" state={rules} />
            </div>

            <div className="mt-4">
              <PasswordField
                id="pwp-confirm"
                name="confirmPassword"
                label="ยืนยันรหัสผ่านใหม่"
                maxLength={PASSWORD_MAX}
                autoComplete="new-password"
                placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง"
                value={confirm}
                error={confirmErr}
                onChange={(e) => {
                  setConfirm(e.target.value)
                  if (confirmErr) setConfirmErr('')
                }}
              />
            </div>
          </div>

          {/* The footer the forced gate cannot have. `flex-col-reverse` so the primary is DECLARED
              second (tab order follows the form) yet lands on top on a phone, where the thumb is. */}
          <div className="flex flex-col-reverse gap-2 border-t border-base-300 px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
            <button
              type="button"
              onClick={back}
              disabled={busy}
              className="btn-ghost2 sm:min-w-[120px]"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={busy}
              aria-busy={busy || undefined}
              className="btn-primary2 disabled:cursor-not-allowed disabled:bg-base-200 disabled:text-base-content/70 disabled:hover:brightness-100 sm:min-w-[180px]"
            >
              {busy ? 'กำลังบันทึกรหัสผ่านใหม่' : 'บันทึกรหัสผ่านใหม่'}
            </button>
          </div>
        </form>

        <section className="pf-card" aria-labelledby="pwp-after-title">
          <div className="pf-body">
            <h2 id="pwp-after-title" className="m-0 text-[14px] font-semibold text-base-content">
              หลังเปลี่ยนรหัสผ่าน
            </h2>
            <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">
              {AFTER.map((note) => (
                <li
                  key={note.d}
                  className="th-tight flex items-start gap-2.5 text-[13px] leading-[1.6] text-base-content/70"
                >
                  <svg
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-base-content/60"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={note.d} />
                  </svg>
                  <span>{note.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  )
}
