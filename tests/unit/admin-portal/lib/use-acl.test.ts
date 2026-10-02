import { canReach } from '@/admin-portal/lib/use-acl'
import type { AdminRouteLabel } from '@/admin-portal/routes'
import type { SystemRole } from '@/admin-portal/labels'

/**
 * `canReach` — the pure `(role, label) → boolean` `useAcl().can` delegates to (Phase 2, AC-M6).
 * This pins the FULL D-4 matrix for the `รายงานและสถิติ` section's 6 rows × 3 roles = 18 cells, so
 * a future edit to `VIEWER_DENY`/`ADMIN_DENY` that silently drifts from the design's table is
 * caught here rather than discovered as a visible menu row in the wrong session.
 */
describe('canReach — รายงานและสถิติ (D-4)', () => {
  it.each([
    // Hubs 1–3: every role.
    ['ภาพรวมสถิติ', 'SUPER_ADMIN', true],
    ['ภาพรวมสถิติ', 'ADMIN', true],
    ['ภาพรวมสถิติ', 'VIEWER', true],
    ['การใช้สถานที่และช่วงเวลา', 'SUPER_ADMIN', true],
    ['การใช้สถานที่และช่วงเวลา', 'ADMIN', true],
    ['การใช้สถานที่และช่วงเวลา', 'VIEWER', true],
    ['สถิติตามฝ่ายและการดำเนินงาน', 'SUPER_ADMIN', true],
    ['สถิติตามฝ่ายและการดำเนินงาน', 'ADMIN', true],
    ['สถิติตามฝ่ายและการดำเนินงาน', 'VIEWER', true],
    // Hub 4 ส่งออกรายงานราชการ: SA/ADMIN, not VIEWER.
    ['ส่งออกรายงานราชการ', 'SUPER_ADMIN', true],
    ['ส่งออกรายงานราชการ', 'ADMIN', true],
    ['ส่งออกรายงานราชการ', 'VIEWER', false],
    // Hub 5 ประวัติการทำรายการ: SA/ADMIN, not VIEWER (reverses the pre-Phase-2 grant).
    ['ประวัติการทำรายการ', 'SUPER_ADMIN', true],
    ['ประวัติการทำรายการ', 'ADMIN', true],
    ['ประวัติการทำรายการ', 'VIEWER', false],
    // Hub 6 บันทึกข้อผิดพลาด: SUPER_ADMIN only.
    ['บันทึกข้อผิดพลาด', 'SUPER_ADMIN', true],
    ['บันทึกข้อผิดพลาด', 'ADMIN', false],
    ['บันทึกข้อผิดพลาด', 'VIEWER', false],
  ] as const satisfies readonly [AdminRouteLabel, SystemRole, boolean][])(
    '%s × %s → %s',
    (label, role, want) => {
      expect(canReach(role, label)).toBe(want)
    },
  )
})
