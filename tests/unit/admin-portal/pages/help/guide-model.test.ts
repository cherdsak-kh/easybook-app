import { GUIDE_ARTICLES, GUIDE_GROUPS } from '@/admin-portal/pages/help/guide-content'
import {
  countLabel,
  describeEmpty,
  neighbours,
  plainText,
  relevanceLine,
  resolveActive,
  searchTextOf,
  topicMatches,
  type GuideRole,
  type RoleFilter,
} from '@/admin-portal/pages/help/guide-model'
import { canReach } from '@/admin-portal/lib/use-acl'
import { routeOf } from '@/admin-portal/routes'
import type { SystemRole } from '@/admin-portal/labels'

/**
 * The pure half of `/backend/help/guide`: which topics a role pill + a search leave in the menu,
 * what the count and the empty state say, which topic is open, and that every deep link in the
 * articles is a real, role-correct destination. The page itself is verified in a browser.
 */

const FACTS = GUIDE_ARTICLES.map((a) => ({
  id: a.id,
  roles: a.roles,
  text: searchTextOf(a, GUIDE_GROUPS),
}))
const shown = (q: string, role: RoleFilter) =>
  FACTS.filter((f) => topicMatches(f, q, role)).map((f) => f.id)

describe('guide data', () => {
  it('has the eleven articles in the prototype order', () => {
    expect(GUIDE_ARTICLES.map((a) => a.id)).toEqual([
      'rbac',
      'lifecycle',
      'approve-flow',
      'calendar-check',
      'venue-mgmt',
      'amenities',
      'staff-mgmt',
      'broadcast',
      'integrations',
      'reports',
      'faq',
    ])
  })

  it('every article belongs to a declared group, and every group has an article', () => {
    const ids = new Set(GUIDE_GROUPS.map((g) => g.id))
    expect(GUIDE_ARTICLES.every((a) => ids.has(a.group))).toBe(true)
    expect(GUIDE_GROUPS.every((g) => GUIDE_ARTICLES.some((a) => a.group === g.id))).toBe(true)
  })

  it('links to 19 distinct screens, every one a real route', () => {
    const labels = new Set(GUIDE_ARTICLES.flatMap((a) => a.sections.flatMap((s) => s.links ?? [])))
    expect(labels.size).toBe(19)
    for (const l of labels) expect(routeOf(l), l).toBeDefined()
  })

  it.each<[SystemRole, string[]]>([
    ['VIEWER', [
      'การเชื่อมต่อระบบ',
      'บันทึกข้อผิดพลาด',
      'ประเภทสถานที่',
      'สิ่งอำนวยความสะดวก',
      'ส่งออกรายงานราชการ',
      'ประวัติการทำรายการ',
    ]],
    ['ADMIN', ['บันทึกข้อผิดพลาด']],
    ['SUPER_ADMIN', []],
  ])('the ACL refuses %s exactly the links the plan lists', (role, refused) => {
    const labels = new Set(GUIDE_ARTICLES.flatMap((a) => a.sections.flatMap((s) => s.links ?? [])))
    const denied = [...labels].filter((l) => !canReach(role, l))
    expect(denied.sort()).toEqual([...refused].sort())
  })
})

describe('topicMatches — role pill', () => {
  it('all and super show every topic; viewer shows 5; admin shows 10', () => {
    expect(shown('', 'all')).toHaveLength(11)
    expect(shown('', 'super')).toHaveLength(11)
    expect(shown('', 'viewer')).toEqual(['rbac', 'lifecycle', 'calendar-check', 'reports', 'faq'])
    expect(shown('', 'admin')).toEqual(GUIDE_ARTICLES.map((a) => a.id).filter((id) => id !== 'staff-mgmt'))
  })
})

describe('topicMatches — search', () => {
  it('is case-insensitive and matches the title', () => {
    expect(shown('WEBHOOK', 'all')).toContain('faq')
  })

  it('reads the body, not just the title', () => {
    // "ใบหน้า" appears only in the venue photo warning, never in a title.
    expect(shown('ใบหน้า', 'all')).toEqual(['venue-mgmt'])
  })

  it('requires EVERY word, so more words narrow the result', () => {
    const one = shown('ปฏิเสธ', 'all')
    const two = shown('ปฏิเสธ เหตุผล', 'all')
    expect(two.length).toBeLessThanOrEqual(one.length)
    expect(two.every((id) => one.includes(id))).toBe(true)
  })

  it('ANDs with the role pill', () => {
    expect(shown('ผู้ดูแลระบบสูงสุด', 'viewer')).not.toContain('staff-mgmt')
    expect(shown('บัญชี', 'super')).toContain('staff-mgmt')
  })

  it('treats whitespace-only input as no search', () => {
    expect(shown('   ', 'all')).toHaveLength(11)
  })

  it('finds nothing for a word that is nowhere', () => {
    expect(shown('zzzqqq', 'all')).toEqual([])
  })
})

describe('countLabel', () => {
  it('reads ทั้งหมด when shown equals total, even under a pill', () => {
    expect(countLabel(11, 11)).toBe('ทั้งหมด 11 หัวข้อ')
  })
  it('reads พบ N จาก M otherwise', () => {
    expect(countLabel(5, 11)).toBe('พบ 5 จาก 11 หัวข้อ')
    expect(countLabel(0, 11)).toBe('พบ 0 จาก 11 หัวข้อ')
  })
})

describe('describeEmpty', () => {
  it('names the search term', () => {
    expect(describeEmpty('  xyz ', 'all')).toBe(
      'ไม่มีหัวข้อที่ตรงกับ คำค้น “xyz” ลองใช้คำอื่น หรือล้างตัวกรอง',
    )
  })
  it('names the role', () => {
    expect(describeEmpty('', 'viewer')).toBe(
      'ไม่มีหัวข้อที่ตรงกับ บทบาท ผู้ดูข้อมูล ลองใช้คำอื่น หรือล้างตัวกรอง',
    )
  })
  it('names both, joined by และ', () => {
    expect(describeEmpty('x', 'admin')).toBe(
      'ไม่มีหัวข้อที่ตรงกับ คำค้น “x” และ บทบาท เจ้าหน้าที่ดูแลระบบ ลองใช้คำอื่น หรือล้างตัวกรอง',
    )
  })
})

describe('resolveActive / neighbours', () => {
  const visible = ['a', 'b', 'c']
  it('keeps the requested topic while it is visible', () => {
    expect(resolveActive('b', visible)).toBe('b')
  })
  it('falls to the first visible topic when the requested one is filtered out', () => {
    expect(resolveActive('z', visible)).toBe('a')
  })
  it('is null when nothing is visible', () => {
    expect(resolveActive('a', [])).toBeNull()
  })
  it('walks the visible list and has no neighbour past the ends', () => {
    expect(neighbours(visible, 'a')).toEqual({ prev: null, next: 'b' })
    expect(neighbours(visible, 'b')).toEqual({ prev: 'a', next: 'c' })
    expect(neighbours(visible, 'c')).toEqual({ prev: 'b', next: null })
    expect(neighbours(visible, 'zzz')).toEqual({ prev: null, next: null })
  })
})

describe('relevanceLine', () => {
  it('says the topic fits the role when it does', () => {
    const r: GuideRole[] = ['admin', 'super']
    expect(relevanceLine('admin', r)).toBe(
      'บทบาทของคุณ: เจ้าหน้าที่ดูแลระบบ · หัวข้อนี้ตรงกับงานของบทบาทนี้',
    )
  })
  it('says read-only-for-information when it does not', () => {
    expect(relevanceLine('viewer', ['super'])).toBe(
      'บทบาทของคุณ: ผู้ดูข้อมูล · อ่านเพื่อทราบได้ แต่บทบาทนี้ไม่มีสิทธิ์ดำเนินการตามขั้นตอนในหัวข้อนี้',
    )
  })
})

describe('plainText', () => {
  it('reads strings, numbers and arrays, and ignores booleans and null', () => {
    expect(plainText(['a', 1, null, false, undefined, 'b'])).toBe('a 1    b')
  })
})
