import type { SystemUser } from '@/lib/api-client'

/**
 * One `SystemUserResponseDto` fixture for the whole suite.
 *
 * It exists because the DTO is generated (`npm run gen:api`) and therefore grows
 * without warning: when the backend added the REQUIRED `createdBy` + `updatedAt`
 * fields, every hand-rolled copy of this literal broke `tsc -b` at once (vitest
 * does not typecheck, so the suite stayed green and only `npm run build` caught
 * it). Keeping a single factory means the next additive contract change is a
 * one-line fix here instead of an N-file hunt.
 *
 * Defaults describe an ordinary ADMIN with a creator, no phone, no avatar and no
 * LINE link. Override anything per test — `makeSystemUser({ role: 'STAFF' })`.
 */
export function makeSystemUser(overrides: Partial<SystemUser> = {}): SystemUser {
  return {
    id: 'u1',
    email: 'admin@easybook.local',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'ADMIN',
    personnelRole: { id: 1, name: 'Director' },
    department: { id: 2, name: 'CS' },
    mustChangePassword: false,
    phoneNumber: null,
    profilePictureUrl: null,
    isActive: true,
    lineUserId: null,
    lastLoginAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    // Added by the admin-profile contract change: `createdBy` is nullable (the
    // seeded first SUPER_ADMIN has none), `updatedAt` never is.
    createdBy: { id: 'u0', firstName: 'Somsri', lastName: 'Systemadmin' },
    updatedAt: '2026-07-20T09:30:00.000Z',
    ...overrides,
  }
}
