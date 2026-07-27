/**
 * The EasyBook brand chrome — the ONE place the product name, logo asset and logo alt
 * text are written down.
 *
 * Why this module exists now (it deliberately did not before): `LandingIntro.tsx` used
 * to carry these three literals inline, with a comment arguing they were "too few to
 * warrant a constants file". That held only while ONE surface rendered them. The
 * admin-portal sidebar now renders the same mark and wordmark, and a login screen whose
 * branding disagrees with the shell it logs you into is exactly the defect this file
 * prevents.
 *
 * It is intentionally **dependency-free** (no heroicons, no route constants, no other
 * strings module). `AdminPortalLoginPage` — and therefore `LandingIntro` — is EAGER in
 * `App.tsx`, so anything imported from here lands in the initial chunk the anonymous
 * LIFF client downloads. Keep it that way: import brand constants from here, never from
 * `nav-config.tsx`.
 *
 * The logo is referenced by its PUBLIC RUNTIME URL — Vite serves `public/` at the web
 * root, so `public/logo/…svg` is fetched at `/logo/…svg` (NOT an ES import, NOT `dist/`).
 */
export const BRAND = {
  /** The user-visible wordmark. Replaced the upstream DashWind template's name. */
  name: 'EasyBook',
  /** Short strapline under the wordmark on the login screen. */
  description: 'ระบบบริหารจัดการส่วนหลังบ้าน',
  logoSrc: '/logo/easybook-logo-512px-no-bg.svg',
  /**
   * Alt text for the mark. Deliberately NOT the bare wordmark: both the sidebar and the
   * login screen render the name as adjacent TEXT, so `alt="EasyBook"` would make a
   * screen reader say "EasyBook EasyBook". "โลโก้ EasyBook" ("EasyBook logo") stays
   * meaningful (it names what the image is) without echoing the neighbouring wordmark.
   */
  logoAlt: 'โลโก้ EasyBook',
} as const
