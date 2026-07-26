import type { AppAccess, SystemRole } from '@/lib/api-client'

/**
 * The ADMIN access-transition matrix, mirrored from the backend
 * (`easybook-service` `line-access.policy.ts`). Pure, no I/O.
 *
 * ```
 * canAdminSetAccess(from, to) =
 *   to === REJECTED
 *     ? from ∈ {PENDING, ALLOWED, BLOCKED}          // Reject: never from UNREGISTERED
 *     : (to ∈ {ALLOWED, BLOCKED}) && from ≠ UNREGISTERED   // dropdown targets
 * ```
 *
 * | from ↓ \ to → | UNREGISTERED | PENDING | ALLOWED | BLOCKED | REJECTED |
 * |---------------|:---:|:---:|:---:|:---:|:---:|
 * | UNREGISTERED  | ❌ | ❌ | ❌ | ❌ | ❌ (nothing to reject) |
 * | PENDING       | ❌ | ❌ | ✅ | ✅ | ✅ reject |
 * | ALLOWED       | ❌ | ❌ | ✅ (idmp) | ✅ | ✅ reject |
 * | BLOCKED       | ❌ | ❌ | ✅ | ✅ (idmp) | ✅ reject |
 * | REJECTED      | ❌ | ❌ | ✅ approve | ✅ block | ❌ (ADMIN re-reject denied) |
 *
 * The backend is the authority — a forbidden ADMIN transition comes back as a
 * 403 regardless. This client-side copy exists so an ADMIN never *sees* a control
 * that would 403. SUPER_ADMIN bypasses this predicate entirely (exactly as the
 * service does), but a `→REJECTED` transition is ALSO bound, for every role, by
 * two service-level business rules that the bypass does NOT skip: the reason is
 * mandatory (400 when blank) and `from` may never be `UNREGISTERED` (400). Those
 * are what {@link canReject} mirrors.
 *
 * `REJECTED` is **never** a dropdown value — the status `<select>` offers strictly
 * `{ALLOWED, BLOCKED}` for both roles; REJECTED is reachable only via the
 * dedicated Reject action, which submits `access: 'REJECTED'` + a reason.
 *
 * The idempotent same-state cells the backend permits for a 502 retry
 * (`ALLOWED→ALLOWED`, `BLOCKED→BLOCKED`) are `true` here too, but the UI
 * additionally hides a control whose target equals the current state, so the
 * retry affordance is a backend capability, not a rendered control.
 */
export function canAdminSetAccess(from: AppAccess, to: AppAccess): boolean {
  if (to === 'REJECTED') {
    return from === 'PENDING' || from === 'ALLOWED' || from === 'BLOCKED'
  }
  return (to === 'ALLOWED' || to === 'BLOCKED') && from !== 'UNREGISTERED'
}

/**
 * May this role open the Reject ("ส่งคืนเพื่อตรวจสอบข้อมูลใหม่") action on a user currently in
 * `from`? This is the gate for the dedicated Reject button — `canAdminSetAccess`
 * alone is not enough, because SUPER_ADMIN bypasses that predicate on the server.
 *
 * - **Never from `UNREGISTERED`**, for ANY role: nothing was submitted to send
 *   back, and the server 400s it (`CANNOT_REJECT_UNREGISTERED`) independently of
 *   the SUPER_ADMIN policy bypass.
 * - **SUPER_ADMIN** may reject from any other state — including a re-reject of an
 *   already-`REJECTED` user with a new reason (the service bypass permits it, and
 *   only the two 400 guards above still bind).
 * - **ADMIN** is bound by {@link canAdminSetAccess}, so `{PENDING, ALLOWED,
 *   BLOCKED} → REJECTED` only; `REJECTED → REJECTED` is denied (the backend's
 *   deliberate anti-notification-spam resolution — an ADMIN re-drives the review
 *   loop by approving/blocking, or waits for the user's resubmit).
 * - **STAFF** (and an unknown/absent role) never sees the action: STAFF is
 *   strictly read-only in this surface.
 *
 * The reason itself is validated separately (mandatory, ≤500 chars) — this
 * predicate only answers "is the action reachable at all".
 */
export function canReject(from: AppAccess, role: SystemRole | undefined): boolean {
  if (from === 'UNREGISTERED') return false
  if (role === 'SUPER_ADMIN') return true
  if (role === 'ADMIN') return canAdminSetAccess(from, 'REJECTED')
  return false
}
