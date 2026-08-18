/**
 * What the signed-in role may SEE. Decisions D-1 … D-5.
 *
 * ⚠️⚠️ THE FRONTEND IS NOT THE CONTROL, and nothing in this file may ever be treated as one.
 * Everything here hides affordances. The real boundary is `@Roles` on the server plus
 * `system-users.policy.ts`, and a route that forgets to list a role fails CLOSED. Hiding a
 * button is UX; the backend is the enforcement point. If this module were deleted the portal
 * would look wrong and stay exactly as secure.
 *
 * It exists so a VIEWER is not shown a menu of things that answer 403 — a screen that offers
 * a capability the account does not have costs a click every time it is believed.
 *
 * ⚠️ `SystemRole` is the ONLY thing that grants anything. `personnelRole` ("ตำแหน่ง") is an
 * admin-curated job title that grants NOTHING, and the two are adjacent fields on one model,
 * so the mistake is typeable: a `PersonnelRole` named `"ADMIN"` on a VIEWER is a string, and
 * that account still gets 403 everywhere. Never branch on a position name.
 */

import { useMemo } from 'react'
import type { SystemRole } from '../labels'
import type { AdminRouteLabel } from '../routes'

/**
 * The destinations a VIEWER cannot reach, BY LABEL — the same keys the route table uses.
 *
 * ⚠️ TYPED AS `AdminRouteLabel`, not `string`, and that is the whole guard. The prototype could
 * only warn in a comment that "a typo here is a menu row that never hides rather than a silent
 * half-grant" — and a half-grant is the failure nobody reports, because the row keeps working
 * for the role that was supposed to lose it. Now a label that is not one of the 31 fails the
 * build, and a label RENAMED in the route table fails it too.
 *
 * การตั้งค่าระบบ (all of it): configuration is an ACTION surface. There is no read-only value
 *   in seeing a switch you cannot flip, and rendering one promises a capability the role does
 *   not have.
 * บันทึกข้อผิดพลาด: a debugging tool, not data. It leaks internal structure and invites
 *   "ทำไมระบบ error" to someone who cannot act on the answer.
 *
 * Everything else IS visible — including เจ้าหน้าที่ระบบ (a supervisor may see who holds an
 * account) and รายงานการใช้งานระบบ (who did what, which is the whole point of the role).
 */
export const VIEWER_DENY: readonly AdminRouteLabel[] = [
  'ระบบการจอง',
  'ประเภทสถานที่',
  'กลุ่ม/ฝ่ายบุคลากร',
  'ตำแหน่งบุคลากร',
  'เทมเพลตข้อความ',
  'การเชื่อมต่อระบบ',
  'บันทึกข้อผิดพลาด',
]

/**
 * `SystemRole` → the value stamped on `data-acl`.
 *
 * ⚠️ It is a CSS HOOK, not a permission. `admin-portal.css` keys three things off it: the profile
 * cover's colour pair (super ชมพู · admin เขียว · viewer ฟ้า, project 12 ส.ค. 2569) and the two
 * `[data-write-only]` / `[data-super-only]` visibility rules. All three are presentation — see this
 * module's header, and the shell's.
 *
 * ⚠️ `data-acl`, NOT `data-role`: `[data-role]` is ARIA's, and reusing it would put a styling hook
 * on the same attribute assistive technology reads. The CSS says so at the point of use.
 *
 * The short words are the prototype's own (`super` / `admin` / `viewer`) because the stylesheet was
 * ported verbatim with those selectors already in it — spelling them `SUPER_ADMIN` here would mean
 * editing measured CSS to match a preference.
 */
export const ACL_ATTR: Record<SystemRole, 'super' | 'admin' | 'viewer'> = {
  SUPER_ADMIN: 'super',
  ADMIN: 'admin',
  VIEWER: 'viewer',
}

export interface Acl {
  role: SystemRole
  /** What to stamp on `data-acl`. See `ACL_ATTR`. */
  attr: 'super' | 'admin' | 'viewer'
  /** May this session change anything at all? VIEWER is read-only by definition. */
  write: boolean
  /**
   * Is this destination reachable? Takes the menu LABEL, matching the route table.
   *
   * ⚠️ `AdminRouteLabel`, not `string`, for the same reason `VIEWER_DENY` is: `can('typo')`
   * would answer `true` — reachable — and look exactly like a correct allow.
   */
  can: (label: AdminRouteLabel) => boolean
  /**
   * The actions-column heading. For a read-only session the column is no longer a จัดการ
   * column — it holds exactly one thing and that thing opens a record, so a header still
   * reading "จัดการ" would be the screen claiming a capability it just removed.
   */
  actionsColumnLabel: string
}

export function useAcl(role: SystemRole): Acl {
  return useMemo(() => {
    const write = role !== 'VIEWER'
    const denied = role === 'VIEWER' ? new Set(VIEWER_DENY) : null
    return {
      role,
      attr: ACL_ATTR[role],
      write,
      can: (label: AdminRouteLabel) => !denied?.has(label),
      actionsColumnLabel: write ? 'จัดการ' : 'ดูข้อมูล',
    }
  }, [role])
}
