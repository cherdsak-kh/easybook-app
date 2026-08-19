/**
 * "เซสชันหมดอายุ" — the one dialog the operator did not open.
 *
 * ⚠️ IT DOES NOT DISMISS. No ✕, no Esc, no backdrop click, and exactly one button. Everything
 * behind it is a screen the session can no longer act on; offering a way to close it would
 * leave someone typing into a form whose save is already impossible, and letting them believe
 * the app is still working is the worse failure by far.
 *
 * It is a real modal `<dialog>` via `showModal()`, so it stacks ABOVE any dialog already open
 * (the top layer is ordered by insertion). That matters: the half-finished form underneath
 * stays visible and readable, so the operator can copy what they had typed before signing in
 * again.
 *
 * ⚠️ WHEN IT MUST NOT FIRE. A wrong `currentPassword` on the reset screen is a **400**, and the
 * login endpoint's own **401 is "bad credentials"** — wiring this to "any 401 anywhere" would
 * make both of those log the operator out. It belongs to authenticated reads and writes only,
 * which is why the filter lives in `AuthProvider` next to the client rather than in here.
 *
 * ── ⚠️ IT MUST NOT NAME A CAUSE IT CANNOT KNOW (PO, 19 ส.ค. 2569) ──
 * The first version said "คุณถูกออกจากระบบเนื่องจากไม่ได้ใช้งานเป็นเวลานาน" — one cause, stated as
 * fact. `resolveSessionUser` in the service rejects for FOUR distinct reasons:
 *
 *   NO_SESSION       no cookie, no `systemUserId` — signed out elsewhere, or the session store lost it
 *   SESSION_EXPIRED  past `SESSION_ABSOLUTE_MAX_AGE_MS`
 *   USER_NOT_FOUND   the row the session points at is gone
 *   USER_REVOKED     `deletedAt != null` OR `isActive === false` — deleted, or suspended
 *
 * …and all four arrive here as the SAME 401 carrying the same `Authentication required.`, so the
 * bundle genuinely cannot tell them apart. Inactivity is therefore a guess, and on the two account
 * reasons it is a wrong one that also sends the operator to retry a login that cannot succeed.
 *
 * ── AUTH-401-REASON (19 ส.ค. 2569) — the server now says which ──
 * `SessionGuard` answers `Account is no longer active.` for `USER_NOT_FOUND` / `USER_REVOKED` and
 * keeps the anonymous-safe `Authentication required.` for the other two, so this dialog has TWO
 * copies instead of one hedge:
 *
 *   `ended`   the session stopped working. Signing in again fixes it, and the button says so.
 *   `account` the account itself was suspended or deleted. Signing in again CANNOT fix it, so the
 *             button no longer promises to, and the line about contacting an admin is the action.
 *
 * ⚠️ `ended` IS THE FALLBACK, not a claim of knowledge. An unparseable body, an older service, or a
 * reworded constant all land there — which is the safe direction: it names two possibilities
 * without asserting either, where a wrong `account` would tell somebody their account was deleted
 * when it was not.
 */

import { useEffect, useRef } from 'react'

/** Which of the two the 401 turned out to be. See the header. */
export type SessionEndKind = 'ended' | 'account'

const COPY: Record<SessionEndKind, { title: string; desc: string; button: string }> = {
  ended: {
    title: 'เซสชันสิ้นสุดแล้ว',
    desc: 'เซสชันของคุณใช้งานต่อไม่ได้แล้ว อาจเพราะไม่ได้ใช้งานเป็นเวลานาน หรือมีการออกจากระบบจากอุปกรณ์อื่น',
    button: 'เข้าสู่ระบบอีกครั้ง',
  },
  account: {
    title: 'บัญชีนี้ใช้งานไม่ได้แล้ว',
    // Does not say WHICH of the two, because the server does not either — and because "ถูกลบ" and
    // "ถูกระงับ" call for the same next step from the person reading it.
    desc: 'บัญชีของคุณถูกระงับหรือถูกลบโดยผู้ดูแลระบบสูงสุด การเข้าสู่ระบบอีกครั้งจะยังไม่สำเร็จจนกว่าบัญชีจะถูกเปิดใช้งานใหม่',
    // Not "เข้าสู่ระบบอีกครั้ง": the button leads to the login screen, and on this branch that
    // screen will refuse. Naming the destination instead of promising the outcome.
    button: 'ไปหน้าเข้าสู่ระบบ',
  },
}

export function SessionExpiredDialog({
  open,
  kind = 'ended',
  onRelogin,
}: {
  open: boolean
  kind?: SessionEndKind
  onRelogin: () => void
}) {
  const copy = COPY[kind]
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // `showModal()`, never the `open` ATTRIBUTE: the attribute gives a NON-modal dialog with no
    // focus trap, no backdrop and no top layer — it looks identical and behaves like a div.
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby="session-modal-title"
      aria-describedby="session-modal-desc"
      // Esc is the browser's own dismissal and the only one that does not go through a control
      // we removed. Cancelling it is what makes "does not dismiss" true.
      onCancel={(e) => e.preventDefault()}
    >
      <div className="mx-auto w-[min(440px,calc(100vw-24px))] overflow-hidden rounded-card bg-base-100 shadow-e2">
        <div className="px-5 py-5">
          <div className="flex items-start gap-3.5">
            <span className="cm-icon-shell bg-warning/15 text-warning">
              <svg
                aria-hidden="true"
                className="cm-icon-glyph"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </span>
            <div className="min-w-0">
              <h2
                id="session-modal-title"
                className="m-0 text-[18px] font-semibold leading-tight text-base-content th-tight"
              >
                {copy.title}
              </h2>
              <p
                id="session-modal-desc"
                className="m-0 mt-1.5 text-[14px] leading-[1.6] text-base-content/70 th-tight"
              >
                {copy.desc}
              </p>
            </div>
          </div>
          {/* Says the unsaved work is gone AND why nothing can be done about it. "ข้อมูลจะหายไป"
              alone reads as a threat the app could have prevented. */}
          <div className="inline-note mt-4">
            <svg
              aria-hidden="true"
              className="inline-note-ico"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
              />
            </svg>
            <p className="m-0">
              การเปลี่ยนแปลงที่ยังไม่ได้บันทึกจะหายไป ระบบไม่สามารถบันทึกให้ได้เพราะเซสชันสิ้นสุดแล้ว
            </p>
          </div>
          {/* ACCOUNT ONLY. On the `ended` branch the button is the whole answer, and a line telling
              somebody to contact an admin about a session that simply timed out is noise that
              teaches them to ignore the next one. Here the button cannot help, so this IS the
              action. */}
          {kind === 'account' && (
            <p className="m-0 mt-3 text-[13px] leading-[1.55] text-base-content/70 th-tight">
              โปรดติดต่อผู้ดูแลระบบสูงสุดเพื่อตรวจสอบสถานะบัญชีของคุณ
            </p>
          )}
        </div>
        <div className="flex border-t border-base-300 bg-base-200 px-5 py-4">
          <button type="button" className="btn-primary2 w-full" onClick={onRelogin}>
            {copy.button}
          </button>
        </div>
      </div>
    </dialog>
  )
}
