/**
 * รหัสผ่านชั่วคราว — the response body of `POST /system-users` and of
 * `POST /system-users/:id/reset-password`, shown EXACTLY ONCE.
 *
 * `temporaryPassword` is argon2id-hashed at rest, never logged and never retrievable again; the
 * only recovery from losing it is another reset, which burns the one the operator has just handed
 * over.
 *
 * ⚠️ SO IT REFUSES EVERY CASUAL DISMISSAL. No Escape, no backdrop click, and NO ✕ in the header.
 * There is exactly one way out and its label is an acknowledgement, not "ปิด" — the same treatment
 * the session-expired dialog gets, for the same reason: dismissing by reflex costs something that
 * cannot be undone. `dismissable={false}` on `Modal` is what removes all three at once.
 *
 * A toast was the obvious first answer and is wrong twice over: toasts auto-dismiss, and a
 * 16-character random string is not something anyone reads off a strip that is fading out.
 */

import { useEffect } from 'react'
import { Btn } from '../../../components/ui/Btn'
import { FieldRow } from '../../../components/ui/FieldRow'
import { Modal } from '../../../components/ui/Modal'
import { useCopy } from '../../../lib/use-copy'

const COPY_ICON =
  'M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184'

export function TempPasswordDialog({
  open,
  onClose,
  kind,
  name,
  email,
  password,
}: {
  open: boolean
  onClose: () => void
  /** Which endpoint produced it — the heading and the lead sentence differ, the rest does not. */
  kind: 'created' | 'reset'
  name: string
  email: string
  password: string
}) {
  const copy = useCopy()

  // A dialog reopened for a DIFFERENT account must not still show "คัดลอกแล้ว" from the last one —
  // a receipt for a string that is no longer on screen.
  const { reset } = copy
  useEffect(() => reset(), [password, reset])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={kind === 'created' ? 'สร้างบัญชีเรียบร้อย' : 'รีเซ็ตรหัสผ่านเรียบร้อย'}
      subtitle={
        kind === 'created'
          ? 'บัญชีถูกสร้างแล้ว และนี่คือรหัสผ่านชั่วคราวสำหรับเข้าสู่ระบบครั้งแรก'
          : 'รหัสผ่านเดิมใช้ไม่ได้แล้ว และนี่คือรหัสผ่านชั่วคราวอันใหม่'
      }
      width={520}
      // ⚠️ Removes Escape, the backdrop and the ✕ together. See the header.
      dismissable={false}
      footerClassName="flex"
      footer={
        <Btn variant="primary" className="w-full" onClick={onClose}>
          บันทึกรหัสผ่านไว้แล้ว ปิดหน้าต่าง
        </Btn>
      }
    >
      <div className="mb-4">
        <FieldRow label="บัญชี">{name}</FieldRow>
        <FieldRow label="อีเมล (ชื่อผู้ใช้)">
          <span className="break-all">{email}</span>
        </FieldRow>
      </div>

      <p className="form-label">รหัสผ่านชั่วคราว</p>
      <div className="flex items-stretch gap-2">
        {/* NOT an `<input readonly>`: a text box invites editing a value that cannot be edited,
            and its own selection UI competes with the copy button. `select-all` and `tracking-wide`
            because this string gets transcribed by hand as often as it gets pasted — the server's
            alphabet already excludes 0/O and 1/l/I for the same reason. */}
        <code
          ref={copy.ref as React.Ref<HTMLElement>}
          className="flex min-w-0 flex-1 select-all items-center break-all rounded-control border border-base-300 bg-base-200 px-3.5 py-2.5 font-mono text-[16px] tracking-wide text-base-content"
        >
          {password}
        </code>
        <Btn
          variant="ghost"
          className="shrink-0 px-3"
          aria-label="คัดลอกรหัสผ่าน"
          onClick={() => void copy.copy()}
        >
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={COPY_ICON} />
          </svg>
          {copy.state === 'copied' ? 'คัดลอกแล้ว' : 'คัดลอก'}
        </Btn>
      </div>
      {/* Announced, because a copy that silently failed is worse than one that never claimed to
          work — and `navigator.clipboard` is exactly the API that fails quietly in an embedded or
          insecure context. Always in the DOM: a live region created with its text is not read. */}
      <p
        role="status"
        className="m-0 mt-1.5 min-h-[19px] text-[13px] leading-[1.45] text-base-content/70"
      >
        {copy.announcement}
      </p>

      <div className="mt-4 flex items-start gap-2.5 rounded-control border border-warning/35 bg-warning/10 px-3.5 py-3 text-[14px] leading-[1.55] text-warning">
        <svg
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        <p className="m-0">
          ปิดหน้าต่างนี้แล้วจะดูรหัสผ่านนี้อีกไม่ได้ · หากทำหาย ต้องรีเซ็ตรหัสผ่านใหม่ซึ่งจะทำให้รหัสที่ส่งไปแล้วใช้ไม่ได้
        </p>
      </div>

      <p className="m-0 mt-3 text-[13px] leading-[1.6] text-base-content/70">
        ส่งให้เจ้าตัวผ่านช่องทางที่ยืนยันตัวตนได้ เช่น บอกด้วยตนเองหรือโทรศัพท์ · เมื่อเข้าสู่ระบบครั้งแรก
        ระบบจะบังคับให้ตั้งรหัสผ่านใหม่ก่อนใช้งาน
      </p>
    </Modal>
  )
}
