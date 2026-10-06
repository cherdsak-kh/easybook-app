import {
  SECTIONS,
  collectPalette,
  highlightParts,
  rankRoute,
  sectionOf,
  tokenize,
} from '@/admin-portal/lib/command-palette-model'
import { canReach } from '@/admin-portal/lib/use-acl'
import { ADMIN_PORTAL_ROUTES } from '@/admin-portal/routes'
import type { SystemRole } from '@/admin-portal/labels'

/**
 * The command palette's pure half. These pin the behaviours the prototype verified: which words
 * match, how a match is ranked, how rows group into the five sections, and which rows each role is
 * offered (the route counts in the plan: SUPER_ADMIN 26 · ADMIN 25 · VIEWER 18).
 */

const route = (label: string, group: string, desc: string) => ({ label, group, desc })

const labelsOf = (sections: ReturnType<typeof collectPalette>) =>
  sections.flatMap((s) => s.items.map((i) => i.route.label))

const allow = () => true
const run = (query: string, role: SystemRole = 'SUPER_ADMIN') =>
  collectPalette(ADMIN_PORTAL_ROUTES, (l) => canReach(role, l), tokenize(query))

describe('tokenize', () => {
  it.each([
    ['', []],
    ['   ', []],
    ['LINE', ['line']],
    ['  รายงาน   ส่งออก ', ['รายงาน', 'ส่งออก']],
    ['A\tb\nC', ['a', 'b', 'c']],
  ])('%j → %j', (q, want) => {
    expect(tokenize(q)).toEqual(want)
  })
})

describe('sectionOf', () => {
  it('maps the two non-section groups and passes the other four through', () => {
    expect(sectionOf('')).toBe('การบริหารจัดการ')
    expect(sectionOf('การแจ้งเตือน')).toBe('บัญชีผู้ใช้งาน')
    for (const s of SECTIONS) expect(sectionOf(s)).toBe(s)
  })

  it('files an unknown group under the LAST section', () => {
    expect(sectionOf('กลุ่มที่ไม่มี')).toBe('บัญชีผู้ใช้งาน')
  })
})

describe('rankRoute', () => {
  const r = route('ปฏิทินการจอง', 'การบริหารจัดการ', 'ดูตารางการจองสถานที่ทั้งหมดในมุมมองปฏิทิน LINE')

  it('is 0 with no words (everything matches)', () => {
    expect(rankRoute(r, [])).toBe(0)
  })

  it('is 0 when every word is in the label', () => {
    expect(rankRoute(r, ['ปฏิทิน'])).toBe(0)
    expect(rankRoute(r, ['ปฏิทิน', 'จอง'])).toBe(0)
  })

  it('is 1 when every word is in the label or the group', () => {
    expect(rankRoute(r, ['การบริหาร'])).toBe(1)
    expect(rankRoute(r, ['ปฏิทิน', 'บริหาร'])).toBe(1)
  })

  it('is 2 when a word is only in the description', () => {
    expect(rankRoute(r, ['มุมมอง'])).toBe(2)
    expect(rankRoute(r, ['ปฏิทิน', 'line'])).toBe(2)
  })

  it('is -1 when ANY word is missing (words are ANDed)', () => {
    expect(rankRoute(r, ['ปฏิทิน', 'ไม่มีคำนี้'])).toBe(-1)
    expect(rankRoute(r, ['ไม่มีคำนี้'])).toBe(-1)
  })

  it('is case-insensitive on the route side (tokens arrive lower-cased)', () => {
    expect(rankRoute(r, ['line'])).toBe(2)
  })

  it('does not match across the label/group/desc seams', () => {
    // "จองการ" would only exist if label and group were glued together without a separator.
    const glued = route('กข', 'คง', 'จฉ')
    expect(rankRoute(glued, ['กขคง'])).toBe(-1)
    expect(rankRoute(glued, ['คงจฉ'])).toBe(-1)
  })
})

describe('collectPalette — grouping', () => {
  it('lists the five sections in order for an empty query', () => {
    expect(run('').map((s) => s.name)).toEqual([...SECTIONS])
  })

  it('files ภาพรวมระบบ under การบริหารจัดการ and ดูการแจ้งเตือนทั้งหมด under บัญชีผู้ใช้งาน', () => {
    const sections = run('')
    const nameOf = (label: string) =>
      sections.find((s) => s.items.some((i) => i.route.label === label))!.name
    expect(nameOf('ภาพรวมระบบ')).toBe('การบริหารจัดการ')
    expect(nameOf('ดูการแจ้งเตือนทั้งหมด')).toBe('บัญชีผู้ใช้งาน')
  })

  it('keeps table order inside a section for an empty query (first row is ภาพรวมระบบ)', () => {
    const first = run('')[0]
    expect(first.items[0].route.label).toBe('ภาพรวมระบบ')
    expect(first.items[1].route.label).toBe('ประกาศและข่าวสาร')
  })

  it('never returns an empty section', () => {
    for (const q of ['', 'ปฏิทิน', 'ช่วยเหลือ', 'LINE']) {
      for (const s of run(q)) expect(s.items.length).toBeGreaterThan(0)
    }
  })

  it('returns nothing when no row matches', () => {
    expect(run('zzzไม่มีทางเจอ')).toEqual([])
  })
})

describe('collectPalette — matching', () => {
  it('matches a label substring', () => {
    expect(labelsOf(run('ปฏิทิน'))).toEqual(['ปฏิทินการจอง'])
  })

  it('matches by group: ช่วยเหลือ returns exactly the 3 help pages', () => {
    expect(labelsOf(run('ช่วยเหลือ')).sort()).toEqual(
      ['คู่มือการใช้งาน', 'ติดต่อทีมผู้พัฒนา', 'ข้อมูลเวอร์ชันระบบ'].sort(),
    )
  })

  it('matches by description, case-insensitively', () => {
    const got = labelsOf(run('LINE'))
    expect(got).toContain('การลงทะเบียน')
    expect(got).toContain('ประกาศและข่าวสาร')
    expect(labelsOf(run('line'))).toEqual(got)
  })

  it('ANDs several words: รายงาน ส่งออก leaves only ส่งออกรายงานราชการ', () => {
    expect(labelsOf(run('รายงาน ส่งออก'))).toEqual(['ส่งออกรายงานราชการ'])
  })
})

describe('collectPalette — ranking', () => {
  const routes = [
    route('หนึ่ง', 'กลุ่มหนึ่ง', 'มีคำว่า ปลา อยู่ในคำอธิบาย'),
    route('ปลาทอง', 'กลุ่มสอง', 'ไม่เกี่ยว'),
    route('สาม', 'ปลากลุ่ม', 'ไม่เกี่ยว'),
    route('ปลาเค็ม', 'กลุ่มสอง', 'ไม่เกี่ยว'),
  ]
  const ranked = (tokens: string[]) => collectPalette(routes, allow, tokens)

  it('orders label matches, then group-only, then description-only', () => {
    const items = ranked(['ปลา']).flatMap((s) => s.items)
    // All four fall under an unknown group, so they share one section and the rank decides.
    expect(items.map((i) => [i.route.label, i.rank])).toEqual([
      ['ปลาทอง', 0],
      ['ปลาเค็ม', 0],
      ['สาม', 1],
      ['หนึ่ง', 2],
    ])
  })

  it('is stable: equal ranks keep table order', () => {
    const items = ranked(['ปลา']).flatMap((s) => s.items)
    expect(items.filter((i) => i.rank === 0).map((i) => i.route.label)).toEqual(['ปลาทอง', 'ปลาเค็ม'])
  })

  it('sorts a section by its BEST item, and ties by SECTIONS order', () => {
    const sections = collectPalette(
      [
        route('ก', 'ช่วยเหลือ', 'ปลา'), // desc-only → section rank 2
        route('ปลา', 'การตั้งค่าระบบ', 'x'), // label → section rank 0
        route('ปลา', 'การบริหารจัดการ', 'x'), // label → section rank 0
      ],
      allow,
      ['ปลา'],
    )
    expect(sections.map((s) => s.name)).toEqual(['การบริหารจัดการ', 'การตั้งค่าระบบ', 'ช่วยเหลือ'])
    expect(sections.map((s) => s.rank)).toEqual([0, 0, 2])
  })

  it('ignores rank when ordering sections for an empty query', () => {
    const sections = collectPalette(
      [route('ก', 'ช่วยเหลือ', 'x'), route('ข', 'การบริหารจัดการ', 'x')],
      allow,
      [],
    )
    expect(sections.map((s) => s.name)).toEqual(['การบริหารจัดการ', 'ช่วยเหลือ'])
  })

  it('files an unknown group under the last section', () => {
    const sections = collectPalette([route('ก', 'ไม่รู้จัก', 'x')], allow, [])
    expect(sections.map((s) => s.name)).toEqual(['บัญชีผู้ใช้งาน'])
  })
})

describe('collectPalette — ACL filter against the real route table', () => {
  it.each([
    ['SUPER_ADMIN', 26],
    ['ADMIN', 25],
    ['VIEWER', 18],
  ] as const)('%s is offered %i rows', (role, want) => {
    expect(labelsOf(run('', role))).toHaveLength(want)
  })

  it('offers exactly the routes canReach allows, nothing more', () => {
    for (const role of ['SUPER_ADMIN', 'ADMIN', 'VIEWER'] as const) {
      const want = ADMIN_PORTAL_ROUTES.filter((r) => canReach(role, r.label)).map((r) => r.label)
      expect(labelsOf(run('', role)).sort()).toEqual(want.sort())
    }
  })

  it('hides บันทึกข้อผิดพลาด from ADMIN but not SUPER_ADMIN', () => {
    expect(labelsOf(run('บันทึกข้อผิดพลาด', 'SUPER_ADMIN'))).toEqual(['บันทึกข้อผิดพลาด'])
    expect(labelsOf(run('บันทึกข้อผิดพลาด', 'ADMIN'))).toEqual([])
  })

  it('drops the whole การตั้งค่าระบบ section for a VIEWER', () => {
    expect(run('', 'VIEWER').map((s) => s.name)).not.toContain('การตั้งค่าระบบ')
  })

  it('filters BEFORE matching: a denied row is not found even by its exact label', () => {
    expect(labelsOf(run('ส่งออกรายงานราชการ', 'VIEWER'))).toEqual([])
  })
})

describe('highlightParts', () => {
  it('returns one plain run when there are no words', () => {
    expect(highlightParts('ปฏิทินการจอง', [])).toEqual([{ text: 'ปฏิทินการจอง', hit: false }])
  })

  it('marks the matched run and keeps the rest', () => {
    expect(highlightParts('ปฏิทินการจอง', ['การ'])).toEqual([
      { text: 'ปฏิทิน', hit: false },
      { text: 'การ', hit: true },
      { text: 'จอง', hit: false },
    ])
  })

  it('merges overlapping and adjacent hits from several words into one run', () => {
    expect(highlightParts('abcdef', ['abc', 'cde'])).toEqual([
      { text: 'abcde', hit: true },
      { text: 'f', hit: false },
    ])
  })

  it('marks every occurrence of a word', () => {
    expect(highlightParts('abab', ['ab'])).toEqual([{ text: 'abab', hit: true }])
  })

  it('is case-insensitive but returns the ORIGINAL casing', () => {
    expect(highlightParts('LINE Notify', ['line'])).toEqual([
      { text: 'LINE', hit: true },
      { text: ' Notify', hit: false },
    ])
  })

  it('never returns the text as markup, and the runs always rejoin to the input', () => {
    const text = '<b>x</b> & ค้นหา'
    const parts = highlightParts(text, ['b', 'ค้น'])
    expect(parts.map((p) => p.text).join('')).toBe(text)
  })

  it('gives up (one plain run) when lower-casing changes the length', () => {
    // 'İ' lower-cases to two code units, so indices into the lower-cased copy would be wrong.
    expect(highlightParts('İx', ['x'])).toEqual([{ text: 'İx', hit: false }])
  })
})
