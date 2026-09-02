import { useEffect, useState } from 'react'
import type { BootSteps } from '@/client-portal/hooks/gate-context'

/**
 * The boot screen. Prototype 469–501.
 *
 * ── 🔴 IT SHOWS THE LOGO AND THREE LINES OF TEXT. NOTHING ELSE. ──
 * `DECISIONS.md` §3.1: the four checks still run, they are simply not displayed. This was a
 * return to what the real app already did, not a new design — v1's `SplashScreen` always showed
 * a single logo and made every failure a separate screen.
 *
 * ⚠️ THE HIDDEN `<ul>` IS NOT DEAD MARKUP AND MUST NOT BE DELETED. It is the tape the state
 * machine writes to, and it is the only thing on screen that tells `hang-friend` from
 * `hang-status` — two cases that otherwise look identical, because both are a splash that never
 * leaves. Deleting it deletes the *checking*, not the *display*. Removing the `hidden` attribute
 * brings the whole original screen back.
 *
 * ⚠️ `bg-base-100`, NOT the body's `base-200`. This is not a card resting on a page; it is one
 * full-screen sheet, which is what `fixed inset-0 bg-base-100` meant in v1.
 *
 * ⚠️ `<p>`, NOT `<h1>`, for the brand name. It is the product's name, not the heading of this
 * page — this screen has no content for a heading to introduce. And it is live text rather than
 * a wordmark image so it takes `base-content` and stays readable in both themes.
 *
 * ⚠️ THE SUBTITLE'S LINE BREAK IS MANUAL. Thai has no word spaces, so the browser breaks by its
 * own dictionary and, left alone, splits the school's name down the middle.
 *
 * Copy is inline, per `Q9`.
 */
export function SplashScreen({ steps }: { steps: BootSteps }) {
  /**
   * ⚠️ 50 ms AFTER MOUNT, NOT ON MOUNT. The transition needs a frame in which the "before" state
   * was actually painted; setting both in the same commit means the browser sees no change and
   * plays nothing. The delay matches `DECISIONS.md` §3.1 and v1's own `setTimeout(…, 50)`.
   */
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setEntered(true), 50)
    return () => clearTimeout(id)
  }, [])

  return (
    <section className="pad-safe grid min-h-dvh place-items-center bg-base-100">
      {/* ⚠️ THE LIVE REGION'S LABEL IS THE ONLY THING A SCREEN READER HEARS FROM THIS SCREEN —
          everything else on it is branding, not progress. */}
      <div
        className="gate-splash w-full max-w-sm text-center md:max-w-md"
        {...(entered ? { 'data-entered': '' } : {})}
        role="status"
        aria-label="กำลังตรวจสอบการเข้าใช้งาน"
      >
        <img
          src="/logo/easybook-logo-512px-no-bg.svg"
          alt=""
          className="mx-auto h-24 w-24 select-none md:h-28 md:w-28"
        />
        <p className="mt-5 text-2xl font-semibold tracking-tight">EasyBook</p>
        <p className="mt-2 leading-relaxed text-base-content/70">
          <span className="block">ระบบจองสถานที่จัดกิจกรรม</span>
          <span className="block">ภายในโรงเรียนเทศบาลท่าโขลง 1</span>
        </p>
      </div>

      {/* The tape. `hidden` by ruling, populated for real. */}
      <ul hidden className="steps steps-vertical w-full">
        <li className="step" data-step="login" data-state={steps.login}>
          <span className="ps-1 text-start">เข้าสู่ระบบ LINE</span>
        </li>
        <li className="step" data-step="friend" data-state={steps.friend}>
          <span className="ps-1 text-start">เพิ่มเพื่อน EasyBook</span>
        </li>
        <li className="step" data-step="register" data-state={steps.register}>
          <span className="ps-1 text-start">การลงทะเบียน</span>
        </li>
        <li className="step" data-step="status" data-state={steps.status}>
          <span className="ps-1 text-start">สถานะการใช้งาน</span>
        </li>
      </ul>
    </section>
  )
}
