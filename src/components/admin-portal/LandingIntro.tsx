// Adapted from DashWind (daisyui-admin-dashboard-template),
// https://github.com/robbins23/daisyui-admin-dashboard-template — MIT (c) 2022 Dashwind.
// See THIRD_PARTY_NOTICES.md. Ports `features/user/LandingIntro.js` and inlines its
// `components/TemplatePointers` bullet list as static copy. The `logo192.png` mark
// and `intro.png` hero art are replaced by inline-SVG / placeholder surfaces (no
// binary asset, no hotlink — design §6). Pure presentational.
import { BRAND_NAME } from './nav-config'

/** Verbatim DashWind starter-kit pointers (was `TemplatePointers`), inlined. */
const POINTERS: readonly string[] = [
  'Light/dark mode toggle',
  'Redux toolkit and other utility libraries configured',
  'Calendar, Modal, Sidebar components',
  'User-friendly documentation',
  'Daisy UI components, Tailwind CSS support',
]

/**
 * The login-screen left panel: brand wordmark, a placeholder hero surface at the
 * template's footprint, and the feature bullet list. Semantic tokens only, so it
 * adopts the active `dashwind-*` theme.
 */
export function LandingIntro() {
  return (
    <div className="hero min-h-full rounded-l-xl bg-base-200">
      <div className="hero-content py-12">
        <div className="max-w-md">
          <h1 className="flex items-center justify-center gap-2 text-center text-3xl font-bold">
            <span
              aria-hidden
              className="mask mask-circle flex h-12 w-12 items-center justify-center bg-primary text-primary-content"
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
                <path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z" />
              </svg>
            </span>
            {BRAND_NAME}
          </h1>

          {/* Hero art placeholder — same visual footprint as `intro.png`, no binary. */}
          <div className="mt-12 flex justify-center">
            <div className="flex h-40 w-48 items-center justify-center rounded-box bg-base-300 text-sm text-base-content/60">
              Admin Template
            </div>
          </div>

          <h2 className="mt-8 text-2xl font-bold">Admin Dashboard Starter Kit</h2>
          <ul className="mt-4">
            {POINTERS.map((pointer) => (
              <li key={pointer} className="py-2">
                <span aria-hidden className="mr-1 text-success">
                  ✓
                </span>
                {pointer}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
