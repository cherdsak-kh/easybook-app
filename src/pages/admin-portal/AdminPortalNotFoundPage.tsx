// Adapted from DashWind (daisyui-admin-dashboard-template),
// https://github.com/robbins23/daisyui-admin-dashboard-template — MIT (c) 2022 Dashwind.
// See THIRD_PARTY_NOTICES.md. Ports `pages/protected/404.js` as a typed `.tsx`. Redux is
// stripped entirely (the original `useDispatch(setPageTitle(''))` effect): the replica
// has no store — its header title comes from the pure `usePageTitle` lookup in
// `nav-config`. daisyUI semantic tokens only (zero `dark:` variants); the `dashwind-*`
// theme is stamped by the parent `AdminPortalThemeLayout`.
import FaceFrownIcon from '@heroicons/react/24/solid/FaceFrownIcon'

/**
 * The replica's 404 page. Rendered by the sibling `/admin-portal/*` catch-all (see
 * `App.tsx`) FULL-SCREEN — OUTSIDE the replica shell (no sidebar/header) and OUTSIDE the
 * auth guard, wrapped only by `AdminPortalThemeLayout`. It is a purely static presentational
 * page: it shows the frown glyph and the `404 - Not Found` heading and stays there
 * indefinitely (no countdown, no auto-redirect, no login link).
 */
export function AdminPortalNotFoundPage() {
  return (
    <div className="hero min-h-screen bg-base-200">
      <div className="hero-content text-center text-red-500">
        <div className="max-w-md">
          <FaceFrownIcon className="inline-block h-48 w-48" aria-hidden />
          <h1 className="text-5xl font-bold">404 - Not Found</h1>
        </div>
      </div>
    </div>
  )
}
