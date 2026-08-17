/**
 * "อยู่ระหว่างการพัฒนา" — the body of **24 of the portal's 31 destinations**.
 *
 * It is not a placeholder to be replaced later by something better: it IS the designed state
 * of a page that exists in the menu and does not exist yet, and `Q1` routes login straight to
 * one of them (`ภาพรวมระบบ`). That is deliberate — landing somewhere else "for now" creates a
 * "remember to move it back" debt and highlights a sidebar entry you are not standing on.
 *
 * ⚠️ NO DATE, and no "เร็ว ๆ นี้". A promised date that slips costs more trust than saying
 * nothing, and there is no release plan to quote from.
 *
 * `<h2>`, not `<h1>`: the page already has one and it is the page's name. This is the STATE
 * of that page, one level down.
 *
 * The button pair is declared with the primary SECOND so it lands on the right on desktop and
 * on top on a phone (`flex-col-reverse`), where the thumb is. On desktop the sidebar is the
 * real way out; this pair exists for the phone, where the sidebar is behind a drawer — which
 * is why `onHome` may be omitted when you are already on the home destination.
 */

export function ComingSoon({ onBack, onHome }: { onBack?: () => void; onHome?: () => void }) {
  return (
    <div className="card-shell rounded-card border border-base-300/70 bg-base-100 shadow-e1">
      <div className="flex flex-col items-center gap-4 px-5 py-14 text-center sm:px-6 lg:flex-1 lg:justify-center">
        <span
          aria-hidden="true"
          className="flex h-14 w-14 items-center justify-center rounded-card bg-primary/10 text-primary"
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
              d="M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 11-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 016.336-4.486l-3.276 3.276a3.004 3.004 0 002.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852z"
            />
          </svg>
        </span>

        <div className="max-w-md">
          <h2 className="m-0 text-[18px] font-semibold text-base-content th-tight sm:text-[20px]">
            อยู่ระหว่างการพัฒนา
          </h2>
          <p className="m-0 mt-2 text-[14px] leading-[1.7] text-base-content/70 th-tight">
            หน้านี้อยู่ในแผนพัฒนาของระบบ แต่ยังไม่เปิดให้ใช้งานในเวอร์ชันนี้
            <br className="hidden sm:inline" />
            เมื่อพัฒนาเสร็จ เมนูนี้จะเปิดให้ใช้งานทันที โดยคุณไม่ต้องติดตั้งอะไรเพิ่ม
          </p>
        </div>

        <div className="mt-1 flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
          <button type="button" className="btn-ghost2" onClick={onBack}>
            ย้อนกลับ
          </button>
          {onHome && (
            <button type="button" className="btn-primary2" onClick={onHome}>
              ไปหน้าภาพรวมระบบ
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
