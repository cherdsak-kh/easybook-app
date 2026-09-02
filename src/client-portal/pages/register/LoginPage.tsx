import { StatusCard } from '@/client-portal/components/feedback/StatusCard'
import { login as lineLogin } from '@/lib/liff'

/**
 * `#/login` — the way in for somebody who opened the LIFF outside the LINE app. Prototype 520–543.
 *
 * ── 🔴 THE ONE PLACE `#06C755` IS ALLOWED IN THE WHOLE PORTAL (`D-C17`) ──
 * `.btn-line` is white-on-LINE-green, which measures **2.26 : 1** and fails AA — deliberately, and
 * only here. The button has to be recognised as LINE's *before* it is read, the user meets it
 * exactly once per session, and the heading and body above it carry the meaning at full contrast.
 * Anywhere else, the semantic tokens: `btn-primary` is 5.48 : 1 light and 9.29 : 1 dark. There is
 * no second exception and this one is one button wide.
 *
 * ── ⚠️ THE MARK, NOT THE WORDMARK (PO, 26 ส.ค. 2569) ──
 * The card says `ยินดีต้อนรับ` in text directly beneath, so a wordmark would print the brand twice
 * — and the gate the reader just came from shows this same mark, which is what makes the two
 * screens read as one flow rather than as two apps.
 *
 * ⚠️ NO `announce`. This is a neutral screen, and an assertive region that fires on "welcome, sign
 * in" trains people to ignore the one that says verification failed.
 *
 * ── 🟠 THE BUTTON IS INERT IN A `VITE_LIFF_ID`-LESS BROWSER, AND THAT IS NOT A BUG HERE ──
 * `login()` in `lib/liff.ts` is a no-op when LIFF is unconfigured, which is the fail-soft contract
 * every helper in that module keeps. A dev fallback would be a second sign-in path living next to
 * the real one, on the one screen where that is least acceptable — so the button stays honest and
 * the dev browser simply has nothing to sign in to. Measured, not assumed: see `CHECKLIST.md`.
 */
export function LoginPage() {
  return (
    <StatusCard
      tone="none"
      icon={
        <img
          src="/logo/easybook-logo-512px-no-bg.svg"
          alt="EasyBook"
          className="mx-auto h-16 w-16 select-none"
        />
      }
      title="ยินดีต้อนรับ"
      description="เข้าสู่ระบบด้วยบัญชี LINE ของคุณเพื่อใช้งานระบบ"
      actions={
        <button
          type="button"
          onClick={() => lineLogin()}
          className="btn btn-app btn-line w-full gap-2"
        >
          {/* LINE's own mark, `fill="currentColor"` so it takes the button's white. */}
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-5 w-5">
            <path d="M12 3.5C6.9 3.5 2.75 6.86 2.75 11c0 3.71 3.29 6.82 7.74 7.41.3.06.71.2.82.46.09.24.06.6.03.85l-.13.79c-.04.24-.19.93.82.51 1.02-.42 5.46-3.22 7.45-5.51C20.86 14.05 21.5 12.6 21.5 11c0-4.14-4.15-7.5-9.5-7.5z" />
          </svg>
          เข้าสู่ระบบด้วย LINE
        </button>
      }
    />
  )
}
