/**
 * What is on screen while `/auth/system/me` is still deciding.
 *
 * ⚠️ IT ONLY APPEARS AFTER A SHORT DELAY. On a warm connection the probe resolves in well under
 * 200ms, and a loading screen that flashes up and vanishes reads as a glitch — worse than
 * nothing, because it draws the eye to a moment that had no news in it. Before the delay
 * elapses this renders literally nothing.
 *
 * A spinner, not a progress bar: at this point nobody knows whether the answer is the dashboard
 * or a redirect to the login form, and "still working" is the only honest thing to say.
 *
 * ⚠️ THE TWO THAI LINES ARE SPLIT BY HAND and must stay that way. Thai has no word spaces, so
 * the browser breaks on its own dictionary — measured at 13px the full name is 314px against a
 * 304px box and it broke as "…เทศบาลท่า / โขลง 1", a cut through the middle of the school's
 * name with a two-syllable orphan under it. Splitting at the clause boundary gives 147px and
 * 167px, both comfortably inside the box down to 375px.
 *
 * This is also the one surface that gets the WHOLE viewport, is seen once per session, and is
 * answering exactly "what am I looking at" — so it carries the full name, where the sidebar's
 * short subtitle would be under-informative.
 */

import { useEffect, useState } from 'react'

/** Long enough that a fast probe never paints, short enough that a slow one is not silence. */
const APPEAR_AFTER_MS = 250

export function BootScreen() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), APPEAR_AFTER_MS)
    return () => clearTimeout(t)
  }, [])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-base-200">
      <div role="status" className="flex flex-col items-center gap-5 px-6 text-center">
        <img
          src="/logo/easybook-logo-512px-no-bg.svg"
          alt="โลโก้ EasyBook"
          width={64}
          height={64}
          className="h-16 w-16"
        />
        <div>
          <p className="m-0 text-[22px] font-semibold leading-tight tracking-wide text-base-content">
            EasyBook
          </p>
          <p className="m-0 mt-1.5 text-[13px] leading-relaxed text-base-content/70 th-tight">
            <span className="block">ระบบจองสถานที่จัดกิจกรรม</span>
            <span className="block">ภายในโรงเรียนเทศบาลท่าโขลง&nbsp;1</span>
          </p>
        </div>
        <div className="flex flex-col items-center gap-3">
          <span className="spinner spinner-lg text-primary" />
          <p className="m-0 text-[15px] text-base-content/80">กำลังเข้าสู่ระบบจัดการ</p>
        </div>
      </div>
    </div>
  )
}
