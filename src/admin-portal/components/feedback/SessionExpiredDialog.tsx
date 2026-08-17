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
 */

import { useEffect, useRef } from 'react'

export function SessionExpiredDialog({ open, onRelogin }: { open: boolean; onRelogin: () => void }) {
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
                เซสชันหมดอายุ
              </h2>
              <p
                id="session-modal-desc"
                className="m-0 mt-1.5 text-[14px] leading-[1.6] text-base-content/70 th-tight"
              >
                คุณถูกออกจากระบบเนื่องจากไม่ได้ใช้งานเป็นเวลานาน โปรดเข้าสู่ระบบอีกครั้งเพื่อทำงานต่อ
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
        </div>
        <div className="flex border-t border-base-300 bg-base-200 px-5 py-4">
          <button type="button" className="btn-primary2 w-full" onClick={onRelogin}>
            เข้าสู่ระบบอีกครั้ง
          </button>
        </div>
      </div>
    </dialog>
  )
}
