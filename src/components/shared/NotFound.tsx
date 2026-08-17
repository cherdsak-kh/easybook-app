/**
 * Two 404s, and the difference between them is a security boundary, not a layout choice.
 *
 *  · `variant="shell"` — inside `/backend`, for a signed-in operator who followed a stale
 *    link. The chrome around it is fine: they can already see the menu.
 *  · `variant="full"`  — ANY unmatched URL outside `/backend`, reachable by anyone including
 *    LIFF users who never sign in (PO ruling, 17 ส.ค. 2569). Rendering the back-office chrome
 *    here would hand every mistyped address a full listing of the portal's menu names. For the
 *    same reason it offers no route to the staff entrance: a public error page must not
 *    advertise where the staff door is. The only way out is the public home.
 *
 * ⚠️ IT LIVES IN `components/shared/`, NOT IN `admin-portal/`, and that is the folder rule
 * working rather than an exception to it: `full` is the whole app's 404 and `shell` is the
 * back-office's, so the file has two portals as consumers. Keeping the pair in ONE file is
 * deliberate — the note above is the only place the distinction is written down, and split
 * across two folders nobody would read them together.
 *
 * ⚠️ Deliberately NOT a giant "404". The number means nothing to the school staff who use
 * this; it goes at the bottom, small, where it is good for the one thing it IS good for —
 * quoting on the phone when they report the broken link.
 *
 * The path is echoed back because "หน้านี้ไม่มีอยู่" without saying WHICH page is unquotable
 * and unfixable. It is rendered as text in a `break-all` box, never as a link.
 *
 * Focus moves to the heading on mount: the content an assistive tech was reading has been
 * replaced, and without moving focus a screen reader keeps reciting a page that is gone.
 */

import { useEffect, useRef } from 'react'

export function NotFound({
  variant = 'shell',
  path,
  onBack,
  onHome,
}: {
  variant?: 'shell' | 'full'
  /** The URL that missed. Shown verbatim. */
  path: string
  onBack?: () => void
  onHome?: () => void
}) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  if (variant === 'full') {
    return (
      <div className="grid min-h-screen place-items-center overflow-y-auto bg-base-200 px-6 py-10">
        <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
          <img
            src="/logo/easybook-logo-512px-no-bg.svg"
            alt="โลโก้ EasyBook"
            width={56}
            height={56}
            className="h-14 w-14"
          />
          <div>
            <h1
              ref={titleRef}
              tabIndex={-1}
              className="m-0 text-[22px] font-semibold leading-tight text-base-content th-tight outline-none"
            >
              ไม่พบหน้าที่คุณค้นหา
            </h1>
            <p className="m-0 mt-2 text-[14px] leading-[1.6] text-base-content/70 th-tight">
              ลิงก์อาจไม่ถูกต้อง หรือหน้านี้ถูกย้ายไปแล้ว
            </p>
          </div>
          <p className="m-0 max-w-full break-all rounded-control bg-base-100 px-3 py-1.5 font-mono text-[12px] text-base-content/70">
            {path}
          </p>
          {/* One way out, and it is the PUBLIC home. See the note at the top. */}
          <button type="button" className="btn-primary2 w-full sm:w-auto" onClick={onHome}>
            กลับสู่หน้าแรก
          </button>
          <p className="m-0 text-[12px] text-base-content/70 tabular-nums">รหัสข้อผิดพลาด 404</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-1 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-y-auto">
      <div className="flex flex-col items-center gap-4 rounded-card border border-base-300/70 bg-base-100 px-5 py-12 text-center shadow-e1 sm:px-6 sm:py-14 lg:flex-1 lg:justify-center">
        <span
          aria-hidden="true"
          className="flex h-14 w-14 items-center justify-center rounded-card bg-base-content/8 text-base-content/70"
        >
          <svg
            className="h-7 w-7"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"
            />
          </svg>
        </span>

        <div className="max-w-md">
          <h1
            ref={titleRef}
            tabIndex={-1}
            className="m-0 text-[20px] font-semibold text-base-content th-tight outline-none sm:text-[22px]"
          >
            ไม่พบหน้าที่คุณเปิด
          </h1>
          <p className="m-0 mt-2 text-[14px] leading-[1.6] text-base-content/70 th-tight">
            หน้านี้อาจถูกย้าย เปลี่ยนชื่อ หรือไม่เคยมีอยู่
            <br className="hidden sm:inline" />
            หากคุณมาจากลิงก์ที่บันทึกไว้ ลิงก์นั้นอาจเก่าแล้ว
          </p>
        </div>

        <p className="m-0 max-w-full break-all rounded-control bg-base-200 px-3 py-1.5 font-mono text-[12px] text-base-content/70">
          {path}
        </p>

        <div className="mt-1 flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
          <button type="button" className="btn-ghost2" onClick={onBack}>
            ย้อนกลับ
          </button>
          <button type="button" className="btn-primary2" onClick={onHome}>
            ไปหน้าภาพรวมระบบ
          </button>
        </div>

        <p className="m-0 text-[12px] text-base-content/70 tabular-nums">รหัสข้อผิดพลาด 404</p>
      </div>
    </div>
  )
}
