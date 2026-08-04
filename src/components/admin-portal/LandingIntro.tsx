// Ported from DashWind (daisyui-admin-dashboard-template) — MIT (c) 2022 Dashwind. See THIRD_PARTY_NOTICES.md

// The three brand literals used to be declared inline here, on the argument that they
// were "too few to warrant a constants file". That held only while ONE surface rendered
// them. The admin-portal SIDEBAR now renders the same mark and wordmark (PO decision
// OPEN-7 brought the login screen into the rebrand precisely so the two agree), so they
// moved to the shared, dependency-free `@/constants/ui-strings-brand` module.
//
// Import the BRAND module, never `nav-config.tsx`: this component is reached from the
// EAGER `AdminPortalLoginPage`, so anything it imports lands in the initial chunk the
// anonymous LIFF client downloads.
import { BRAND } from '@/constants/ui-strings-brand'

/**
 * The login-screen left panel: the EasyBook logo, brand title, and a short description.
 * Semantic tokens only, so it adopts the active `dashwind-*` theme.
 *
 * The mark carries `alt=""` + `aria-hidden` here — unlike the sidebar's, where the mark is
 * the only thing identifying the brand at a glance — because the `<h1>` immediately below
 * already announces "EasyBook". Naming the image too would make a screen reader say the
 * brand twice in a row.
 */
export function LandingIntro() {
  return (
    <div className="hero min-h-full rounded-l-xl bg-base-200">
      <div className="hero-content py-12">
        <div className="max-w-md text-center">
          <img
            src={BRAND.logoSrc}
            alt=""
            aria-hidden
            width={96}
            height={96}
            className="mx-auto h-24 w-24 object-contain"
          />
          <h1 className="mt-6 text-3xl font-bold">{BRAND.name}</h1>
          <p className="mt-2 text-lg text-base-content/70">{BRAND.description}</p>
        </div>
      </div>
    </div>
  )
}
