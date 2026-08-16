import { canAdminSetAccess, canReject } from '@/lib/access-policy'
import type { AppAccess, SystemRole } from '@/lib/api-client'

const ALL: readonly AppAccess[] = ['UNREGISTERED', 'PENDING', 'ALLOWED', 'BLOCKED', 'REJECTED']

/**
 * The full 5×5 ADMIN transition matrix, written out as an INDEPENDENT expectation
 * rather than by re-deriving the predicate. Recomputing the rule here would be a
 * tautology; instead each `true` cell is the concrete pair the backend policy
 * permits, so a change to the rule reddens exactly the cells that moved.
 */
const ALLOWED_PAIRS: ReadonlyArray<[AppAccess, AppAccess]> = [
  // The four PO transitions…
  ['PENDING', 'ALLOWED'], // approve
  ['PENDING', 'BLOCKED'], // block
  ['ALLOWED', 'BLOCKED'], // block
  ['BLOCKED', 'ALLOWED'], // reinstate
  // …plus the two idempotent same-state writes kept for the 502 retry.
  ['ALLOWED', 'ALLOWED'],
  ['BLOCKED', 'BLOCKED'],
  // …plus the Reject action's three legal starting states (never UNREGISTERED,
  // and — for ADMIN — never a re-reject of an already-REJECTED user).
  ['PENDING', 'REJECTED'],
  ['ALLOWED', 'REJECTED'],
  ['BLOCKED', 'REJECTED'],
  // …plus the two ways OUT of REJECTED an operator has: approve or block directly.
  ['REJECTED', 'ALLOWED'],
  ['REJECTED', 'BLOCKED'],
]

function isAllowed(from: AppAccess, to: AppAccess): boolean {
  return ALLOWED_PAIRS.some(([f, t]) => f === from && t === to)
}

describe('canAdminSetAccess', () => {
  it('permits exactly the eleven backend-sanctioned cells and nothing else (full 5×5 matrix)', () => {
    for (const from of ALL) {
      for (const to of ALL) {
        expect(canAdminSetAccess(from, to)).toBe(isAllowed(from, to))
      }
    }
  })

  it('never lets an ADMIN act FROM an unregistered row', () => {
    for (const to of ALL) {
      expect(canAdminSetAccess('UNREGISTERED', to)).toBe(false)
    }
  })

  it('never lets an ADMIN set UNREGISTERED or PENDING as the target', () => {
    for (const from of ALL) {
      expect(canAdminSetAccess(from, 'UNREGISTERED')).toBe(false)
      expect(canAdminSetAccess(from, 'PENDING')).toBe(false)
    }
  })

  it('permits the idempotent same-state writes an ADMIN needs to re-drive a 502', () => {
    expect(canAdminSetAccess('ALLOWED', 'ALLOWED')).toBe(true)
    expect(canAdminSetAccess('BLOCKED', 'BLOCKED')).toBe(true)
    // …but not for the states an ADMIN has no reason to re-drive.
    expect(canAdminSetAccess('PENDING', 'PENDING')).toBe(false)
    expect(canAdminSetAccess('UNREGISTERED', 'UNREGISTERED')).toBe(false)
  })

  describe('the →REJECTED branch', () => {
    it('permits a Reject from every reviewable state', () => {
      expect(canAdminSetAccess('PENDING', 'REJECTED')).toBe(true)
      expect(canAdminSetAccess('ALLOWED', 'REJECTED')).toBe(true)
      expect(canAdminSetAccess('BLOCKED', 'REJECTED')).toBe(true)
    })

    it('never permits a Reject from UNREGISTERED (nothing was submitted to send back)', () => {
      expect(canAdminSetAccess('UNREGISTERED', 'REJECTED')).toBe(false)
    })

    it('denies an ADMIN re-reject (REJECTED → REJECTED) — no state change, no retry rationale', () => {
      expect(canAdminSetAccess('REJECTED', 'REJECTED')).toBe(false)
    })

    it('still lets an operator approve or block a rejected user directly', () => {
      expect(canAdminSetAccess('REJECTED', 'ALLOWED')).toBe(true)
      expect(canAdminSetAccess('REJECTED', 'BLOCKED')).toBe(true)
    })
  })
})

describe('canReject', () => {
  const ROLES: readonly SystemRole[] = ['ADMIN', 'SUPER_ADMIN']

  it('is true for BOTH ADMIN and SUPER_ADMIN from every reviewable state', () => {
    for (const role of ROLES) {
      expect(canReject('PENDING', role)).toBe(true)
      expect(canReject('ALLOWED', role)).toBe(true)
      expect(canReject('BLOCKED', role)).toBe(true)
    }
  })

  it('is false from UNREGISTERED for EVERY role — the rule is a business invariant, not RBAC', () => {
    for (const role of ROLES) {
      expect(canReject('UNREGISTERED', role)).toBe(false)
    }
  })

  it('splits on a re-reject: SUPER_ADMIN may, ADMIN may not', () => {
    expect(canReject('REJECTED', 'SUPER_ADMIN')).toBe(true)
    expect(canReject('REJECTED', 'ADMIN')).toBe(false)
  })

  it('is false for STAFF and for a missing role (read-only / unauthenticated)', () => {
    for (const from of ALL) {
      expect(canReject(from, 'VIEWER')).toBe(false)
      expect(canReject(from, undefined)).toBe(false)
    }
  })
})
