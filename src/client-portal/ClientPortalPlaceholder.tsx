import { useResolvedTheme } from '@/hooks/useResolvedTheme'

/**
 * TEMPORARY STAND-IN for the client LIFF surface at `/`.
 *
 * ⚠️ Client Portal v1 was deleted on 2 ก.ย. 2569, BEFORE v2 had a line of code — the same
 * clean-slate move the back-office made on 2026-08-16, and for the same reason: at `0.0.0`
 * there is no live capability to lose, while every backend contract change was costing a
 * round of repairs to a surface already scheduled for deletion. What went: `HomePage`
 * (the 11-screen state machine), `RegistrationForm`, `ThemeLayout`, `ui-strings-client.ts`,
 * and the two UI component specs that pinned them.
 *
 * v2 is built from `docs/prototypes/client-portal/client_portal_prototype.html` and will
 * land under `src/client-portal/` as one folder — routes, gate, screens and dock together.
 * Plan and status: `claude_planning/feature/20260902_*_client_portal_v2_build/`.
 *
 * This file exists ONLY so `/` still resolves to something honest while that work is in
 * flight. It renders no product behaviour: no LIFF init, no API call, no registration form.
 * It is expected to be DELETED by Phase 2 (LIFF shell + gate), not grown.
 *
 * It stamps `data-theme` itself because the pathless `ThemeLayout` route that used to do it
 * for the whole client subtree went with v1. That is one line here rather than a layout
 * route on purpose — v2 brings its own shell, and a layout kept alive for a placeholder is
 * a layout v2 would have to argue with.
 */
export function ClientPortalPlaceholder() {
  const theme = useResolvedTheme('client')

  return (
    <div
      data-theme={theme}
      className="grid min-h-screen place-items-center bg-base-200 px-6 text-base-content"
    >
      <main className="max-w-sm text-center">
        <h1 className="text-2xl font-semibold">EasyBook</h1>
        <p className="mt-2 text-base-content/70">ระบบจองสถานที่จัดกิจกรรม</p>
        <p className="mt-6 text-sm text-base-content/70">
          หน้านี้กำลังอยู่ระหว่างการพัฒนา และจะพร้อมใช้งานเร็ว ๆ นี้
        </p>
      </main>
    </div>
  )
}
