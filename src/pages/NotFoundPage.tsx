// Adapted from DashWind (daisyui-admin-dashboard-template),
// https://github.com/robbins23/daisyui-admin-dashboard-template — MIT (c) 2022 Dashwind.
// See THIRD_PARTY_NOTICES.md. Ports `pages/protected/404.js` as a typed `.tsx`. Redux is
// stripped entirely (the original `useDispatch(setPageTitle(''))` effect): the replica
// has no store. daisyUI semantic tokens only (zero `dark:` variants) so the page renders
// correctly under whichever `data-theme` the surrounding theme layout stamps.
import FaceFrownIcon from '@heroicons/react/24/solid/FaceFrownIcon'

/**
 * The app's single GLOBAL 404 page — portal-agnostic. It backs the one `path="*"` fallback
 * in `App.tsx`, so ANY unmatched URL (an unknown `/admin-portal/*` sub-path OR an unknown
 * client path) lands here, regardless of authentication. It is purely static and
 * presentational: the frown glyph and the `404 - Not Found` heading, with no router hook,
 * no countdown, no auto-redirect, and no login link. The global fallback lives inside the
 * client theme layout, so it renders in the client theme even for admin paths (deliberate
 * — see `App.tsx`); it uses only theme-agnostic semantic tokens so it looks correct under
 * either portal's `data-theme`.
 */
export function NotFoundPage() {
  return (
    <div className="hero min-h-screen bg-base-200">
      <div className="hero-content text-center text-error">
        <div className="max-w-md">
          <FaceFrownIcon className="inline-block h-48 w-48" aria-hidden />
          <h1 className="text-5xl font-bold">404 - Not Found</h1>
        </div>
      </div>
    </div>
  )
}
