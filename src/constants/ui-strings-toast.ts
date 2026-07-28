/**
 * Copy for the shared admin-portal toast (`components/admin-portal/ToastProvider.tsx`).
 *
 * Part of the **centralized-but-modularized** UI-string architecture: one
 * `src/constants/ui-strings-<feature>.ts` module per feature/surface, so a component and
 * its tests read the SAME literal. This is a **back-office** module — never import it
 * from a client/LIFF component.
 *
 * The messages themselves are NOT here on purpose: a toast is a delivery mechanism, and
 * each caller passes its own copy from its own feature module (`PROFILE_STRINGS.save.*`,
 * `LEADS_MESSAGES.*`, …). Only the toast's own chrome lives here.
 */
export const TOAST_STRINGS = {
  /**
   * Accessible name of every toast's close button. Previously
   * `PROFILE_STRINGS.actions.dismiss`; it moved here when the profile page's hand-rolled
   * toast became the shared one, so there is exactly ONE literal for the control.
   */
  dismiss: 'ปิดข้อความแจ้งเตือน',
} as const
