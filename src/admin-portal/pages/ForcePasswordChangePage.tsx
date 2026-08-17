/**
 * The forced reset. Shown while `mustChangePassword` is true, in place of the whole shell.
 *
 * ⚠️ IT IS NOT A REDIRECT — it is what `/backend/*` renders. The server is the control: with
 * that flag set, **every** route except six answers 403, so routing the operator to the shell
 * "and letting them find out" produces a portal where nothing works and nothing says why. The
 * exempt six exist precisely so this screen can function: `GET csrf`, `POST login`,
 * `POST logout`, `GET me`, `POST password`, `GET health`. Widening that set on the server is a
 * hole; narrowing it is a permanent lockout.
 *
 * ⚠️ A WRONG `currentPassword` IS A 400, NEVER A 401. It is rendered inline on the field and
 * must never be treated as session death — the session is valid, only the re-auth failed, and
 * bouncing to login for a typo is the classic self-inflicted logout.
 *
 * The logout link at the bottom is the way out, and rendering it is what makes the server's own
 * exemption real. Trapping someone in a screen they cannot leave is not a security gain:
 * logging out destroys the authority anyway.
 *
 * ⚠️ `confirmPassword` IS NEVER SENT. `forbidNonWhitelisted` rejects any key that is not
 * `currentPassword` or `newPassword`, so posting it would be a 400. It exists purely to catch a
 * typo in a value the user cannot see.
 */

import { useState } from 'react'
import { ApiError, changeOwnPassword } from '@/lib/api-client'
import { InlineAlert } from '../components/feedback/InlineAlert'
import { PasswordField } from '../components/ui/PasswordField'
import { PasswordRules } from '../components/ui/PasswordRules'
import { checkPassword, passwordOk, PASSWORD_MAX } from '../lib/password-policy'
import { useAuth } from '../lib/auth-context'

export function ForcePasswordChangePage() {
  const { user, refresh, signOut } = useAuth()

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [currentErr, setCurrentErr] = useState('')
  const [nextErr, setNextErr] = useState('')
  const [confirmErr, setConfirmErr] = useState('')
  const [alert, setAlert] = useState('')
  const [busy, setBusy] = useState(false)

  const rules = checkPassword(next, current)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setAlert('')

    const cErr = current ? '' : 'โปรดระบุรหัสผ่านปัจจุบัน'
    const nErr = !next
      ? 'โปรดระบุรหัสผ่านใหม่'
      : passwordOk(rules)
        ? ''
        : 'รหัสผ่านใหม่ยังไม่ผ่านเงื่อนไขทั้งหมด'
    const fErr = !confirm
      ? 'โปรดยืนยันรหัสผ่านใหม่'
      : confirm === next
        ? ''
        : 'รหัสผ่านทั้งสองช่องไม่ตรงกัน'
    setCurrentErr(cErr)
    setNextErr(nErr)
    setConfirmErr(fErr)
    if (cErr || nErr || fErr) return

    setBusy(true)
    try {
      await changeOwnPassword(current, next)
      // The server has cleared the flag; re-probe rather than trusting local state. The very
      // next request on the SAME cookie succeeds — `SessionGuard` re-reads the user every
      // request, so there is nothing to re-login for.
      await refresh()
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0
      const message = err instanceof ApiError ? err.message : ''
      if (status === 400) {
        // The server does not say WHICH rule failed in a machine-readable way, and the common
        // 400 by far is the wrong current password — so it lands on that field, where the fix
        // is, rather than in a banner that makes the operator guess.
        setCurrentErr(message || 'รหัสผ่านปัจจุบันไม่ถูกต้อง')
        setCurrent('')
      } else if (status === 503) {
        setAlert('ระบบไม่สามารถใช้งานได้ชั่วคราว โปรดลองใหม่อีกครั้งในภายหลัง')
      } else if (status === 0) {
        setAlert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ โปรดลองใหม่อีกครั้ง')
      } else {
        // A 401 here is genuine session death, and the session-expired dialog is already
        // wired to it centrally — so this says nothing rather than competing with it.
        setAlert(message || 'บันทึกรหัสผ่านใหม่ไม่สำเร็จ โปรดลองใหม่อีกครั้ง')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-base-200 px-4 py-8 sm:px-6">
      <div className="w-full max-w-[400px]">
        {/* Logo and wordmark only — no subtitle. On the login screen the subtitle orients
            someone who has just arrived; by the time they are here they have authenticated and
            know what product they are in, and this screen has three fields to fit instead of
            two. */}
        <div className="flex flex-col items-center gap-3 text-center">
          <img
            src="/logo/easybook-logo-512px-no-bg.svg"
            alt="โลโก้ EasyBook"
            width={48}
            height={48}
            className="h-12 w-12"
          />
          <p className="m-0 text-[18px] font-semibold leading-tight tracking-wide text-base-content">
            EasyBook
          </p>
        </div>

        <form
          noValidate
          onSubmit={(e) => void onSubmit(e)}
          className="mt-5 rounded-card border border-base-300/70 bg-base-100 p-5 shadow-e1 sm:p-6"
        >
          <h1 className="m-0 text-[20px] font-semibold leading-tight text-base-content th-tight">
            ตั้งรหัสผ่านใหม่
          </h1>
          <p className="m-0 mt-1.5 text-[13px] leading-[1.6] text-base-content/70 th-tight">
            คุณกำลังใช้รหัสผ่านชั่วคราวที่ผู้ดูแลระบบออกให้ ต้องตั้งรหัสผ่านใหม่ก่อนจึงจะเริ่มใช้งานได้
          </p>
          {/* Which account is being changed. Cheap, and it is the only confirmation available to
              someone who has just been handed credentials for an account they have never signed
              into before. */}
          {user && (
            <p className="m-0 mt-2 truncate text-[13px] text-base-content/70">{user.email}</p>
          )}

          <InlineAlert message={alert} className="mb-0 mt-4" />

          <div className="mt-4">
            <PasswordField
              id="pw-current"
              name="currentPassword"
              label="รหัสผ่านปัจจุบัน"
              maxLength={PASSWORD_MAX}
              autoComplete="current-password"
              placeholder="รหัสชั่วคราวที่ได้รับ"
              value={current}
              error={currentErr}
              onChange={(e) => {
                setCurrent(e.target.value)
                if (currentErr) setCurrentErr('')
              }}
            />
          </div>

          <div className="mt-3.5">
            <PasswordField
              id="pw-new"
              name="newPassword"
              label="รหัสผ่านใหม่"
              maxLength={PASSWORD_MAX}
              autoComplete="new-password"
              placeholder={`อย่างน้อย ${8} ตัวอักษร`}
              value={next}
              error={nextErr}
              // The WHOLE policy is described by the field, so it is read out on focus rather
              // than discovered one rejection at a time.
              aria-describedby="pw-rules"
              onChange={(e) => {
                setNext(e.target.value)
                if (nextErr) setNextErr('')
              }}
            />
            <PasswordRules id="pw-rules" state={rules} />
          </div>

          <div className="mt-3.5">
            <PasswordField
              id="pw-confirm"
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

          <button
            type="submit"
            disabled={busy}
            className="btn-primary2 mt-5 w-full disabled:cursor-not-allowed disabled:bg-base-200 disabled:text-base-content/70 disabled:hover:brightness-100"
          >
            {busy ? 'กำลังบันทึก' : 'บันทึกรหัสผ่านใหม่'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => void signOut()}
            className="min-h-11 rounded-control px-3 text-[13px] font-medium text-base-content/70 underline underline-offset-4 transition-colors hover:text-base-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            ออกจากระบบ
          </button>
        </div>
      </div>
    </div>
  )
}
