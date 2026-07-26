/**
 * User-facing copy for the **admin-portal auth surface** — the login screen and the
 * session-probe gate — in one place so a component and its tests read the SAME string.
 *
 * Part of the **centralized-but-modularized** UI-string architecture: instead of one
 * monolithic dictionary, each feature/surface owns a `src/constants/ui-strings-<feature>.ts`
 * module exporting named `as const` objects. The client/LIFF copy lives in its own module
 * (`ui-strings-client.ts`) and must never be imported here, or vice versa, so an internal
 * re-word can never reach an end user's screen.
 *
 * This is **not** i18n: no locale, no framework, no `t()` lookup — just an `as const` object
 * reached by property access. Some values are template *formatters* (`(seconds) => string`)
 * because the message interpolates runtime data; that is string building at the call site,
 * not a lookup layer. Do not grow this into a locale system without a plan that asks for one.
 */
export const AUTH_STRINGS = {
  /** The session-probe spinner shown by `ProtectedRoute` before it decides. */
  checkingSession: 'Checking your session…',

  login: {
    heading: 'EasyBook',
    subheading: 'เข้าสู่ระบบบริหารจัดการส่วนหลังบ้าน',
    title: 'เข้าสู่ระบบ',
    email: 'อีเมล',
    emailPlaceholder: 'example@mail.com',
    password: 'รหัสผ่าน',
    passwordPlaceholder: '********',
    /** Toggle `aria-label` when the password is HIDDEN — the button's action is "show". */
    showPassword: 'แสดงรหัสผ่าน',
    /** Toggle `aria-label` when the password is VISIBLE — the button's action is "hide". */
    hidePassword: 'ซ่อนรหัสผ่าน',
    submit: 'เข้าสู่ระบบ',
    submitting: 'กำลังเข้าสู่ระบบ…',

    emailRequired: 'โปรดระบุอีเมล',
    emailInvalid: 'โปรดระบุอีเมลให้ถูกต้อง',
    passwordRequired: 'โปรดระบุรหัสผ่าน',
    badCredentials: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    forbidden: 'บัญชีนี้ถูกระงับการใช้งาน โปรดติดต่อผู้ดูแลระบบ',
    sessionExpired: 'เซสชันหมดอายุหรือไม่ปลอดภัย โปรดรีเฟรชหน้าเว็บแล้วลองใหม่อีกครั้ง',
    rateLimitedIn: (seconds: number) =>
      `ทำรายการซ้ำหลายครั้งเกินไป โปรดลองใหม่อีกครั้งใน ${seconds} วินาที`,
    rateLimited: 'ทำรายการซ้ำหลายครั้งเกินไป โปรดลองใหม่อีกครั้งในภายหลัง',
    unavailable: 'ระบบไม่สามารถใช้งานได้ชั่วคราว โปรดลองใหม่อีกครั้งในภายหลัง',
    failed: 'ไม่สามารถเข้าสู่ระบบได้ โปรดลองใหม่อีกครั้ง',
    networkFailed: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ โปรดลองใหม่อีกครั้ง',
  },
} as const
