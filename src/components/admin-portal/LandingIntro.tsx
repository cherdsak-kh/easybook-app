// Adapted from DashWind (daisyui-admin-dashboard-template),
// https://github.com/robbins23/daisyui-admin-dashboard-template — MIT (c) 2022 Dashwind.
// See THIRD_PARTY_NOTICES.md. Ports `features/user/LandingIntro.js` as the login-screen
// left panel. Phase 4 reworks it to EasyBook branding: the DashWind placeholder mark +
// hero box + starter-kit bullet list are replaced by the real EasyBook logo and a
// title/description. Pure presentational, semantic tokens only (adopts `dashwind-*`).

// Inline brand chrome (design §2). These are app-brand literals, NOT portal UI copy, so
// they deliberately do NOT live in the shared `ui-strings-backend.ts` (whose
// `auth.login.heading` is not a shared brand source) and are too few to warrant a
// constants file. The logo is referenced by its PUBLIC RUNTIME URL — Vite serves
// `public/` at the web root, so `public/logo/…svg` is fetched at `/logo/…svg` (NOT an
// ES import, NOT `dist/`, NOT the non-existent `@easybook-app` alias).
const BRAND_TITLE = 'EasyBook'
const BRAND_DESCRIPTION = 'ระบบบริหารจัดการส่วนหลังบ้าน'
const BRAND_LOGO_SRC = '/logo/easybook-logo-512px-no-bg.svg'

/**
 * The login-screen left panel: the EasyBook logo, brand title, and a short description.
 * Semantic tokens only, so it adopts the active `dashwind-*` theme.
 */
export function LandingIntro() {
  return (
    <div className="hero min-h-full rounded-l-xl bg-base-200">
      <div className="hero-content py-12">
        <div className="max-w-md text-center">
          <img
            src={BRAND_LOGO_SRC}
            alt={BRAND_TITLE}
            width={96}
            height={96}
            className="mx-auto h-24 w-24"
          />
          <h1 className="mt-6 text-3xl font-bold">{BRAND_TITLE}</h1>
          <p className="mt-2 text-lg text-base-content/70">{BRAND_DESCRIPTION}</p>
        </div>
      </div>
    </div>
  )
}
