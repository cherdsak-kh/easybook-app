import { canAdminSetAccess } from '@/lib/access-policy'
import type { AppAccess } from '@/lib/api-client'

const ALL: readonly AppAccess[] = ['UNREGISTERED', 'PENDING', 'ALLOWED', 'BLOCKED']

/**
 * The full 4×4 ADMIN transition matrix, written out as an INDEPENDENT expectation
 * rather than by re-deriving the predicate. Recomputing `(to ∈ …) && (from ≠ …)`
 * here would be a tautology; instead each `true` cell is the concrete pair the PO
 * matrix permits, so a change to the rule reddens exactly the cells that moved.
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
]

function isAllowed(from: AppAccess, to: AppAccess): boolean {
  return ALLOWED_PAIRS.some(([f, t]) => f === from && t === to)
}

describe('canAdminSetAccess', () => {
  it('permits exactly the six PO-sanctioned cells and nothing else (full 4×4 matrix)', () => {
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
})
