import type { AppAccess } from '@/lib/api-client'

/**
 * The ADMIN access-transition matrix, mirrored from the backend
 * (`easybook-service` `line-access.policy.ts`). Pure, no I/O.
 *
 * ```
 * canAdminSetAccess(from, to) = (to ∈ {ALLOWED, BLOCKED}) && (from ≠ UNREGISTERED)
 * ```
 *
 * The backend is the authority — a forbidden ADMIN transition comes back as a
 * 403 regardless. This client-side copy exists so an ADMIN never *sees* a button
 * that would 403: the row's quick actions are gated by it. SUPER_ADMIN bypasses
 * it entirely (the override picker can force any state), exactly as the service
 * bypasses the predicate for SUPER_ADMIN.
 *
 * The idempotent same-state cells the backend permits for a 502 retry
 * (`ALLOWED→ALLOWED`, `BLOCKED→BLOCKED`) are `true` here too, but the row UI
 * additionally hides a button whose target equals the current state — there is
 * no "Approve" on an already-ALLOWED user — so the retry affordance is a
 * backend capability, not a rendered control.
 */
export function canAdminSetAccess(from: AppAccess, to: AppAccess): boolean {
  return (to === 'ALLOWED' || to === 'BLOCKED') && from !== 'UNREGISTERED'
}
