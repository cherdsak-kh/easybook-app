import type { ReportHeatCell, ReportVenueRow, ReportsVenues } from '@/lib/api-client'
import {
  HEAT_LEVEL_CLASSES,
  cellLabel,
  demandTier,
  hasAnyUse,
  heatLevel,
  isVenuesEmpty,
  peakOf,
  pickLineText,
  quietOf,
  recommendations,
  scopeCells,
  slotLabel,
  typeClashRows,
  venueOptions,
} from '@/admin-portal/pages/reports/report-venues-view'

const zeros = (): ReportHeatCell[] => Array.from({ length: 40 }, () => ({ heldHours: 0, segments: 0 }))

const venue = (over: Partial<ReportVenueRow>): ReportVenueRow => ({
  venueId: 'v1',
  name: 'ห้องประชุม 1',
  typeName: 'ห้องประชุม',
  capacity: 40,
  isOpen: true,
  isDeleted: false,
  heldHours: 0,
  occupancyPercent: 20,
  requests: 0,
  approved: 0,
  autoRejected: 0,
  autoRejectedPercent: null,
  cells: zeros(),
  topClash: null,
  ...over,
})

const data = (over: Partial<ReportsVenues> = {}): ReportsVenues =>
  ({
    serverTime: '2026-09-28T00:00:00.000Z',
    range: { schoolDays: 10 } as ReportsVenues['range'],
    requests: { total: 10, autoRejected: 2 } as ReportsVenues['requests'],
    occupancy: { heldHours: 8, schoolDays: 10, venueCount: 2, occupancyPercent: 5 },
    clashPercent: 20,
    weekdaySchoolDays: [2, 2, 2, 2, 2],
    heatmap: zeros(),
    venues: [],
    ...over,
  }) as ReportsVenues

describe('heatLevel (D-16)', () => {
  it.each([
    [null, 0],
    [0, 0],
    [0.01, 1],
    [0.3, 1],
    [0.31, 2],
    [0.6, 2],
    [0.61, 3],
    [0.85, 3],
    [0.86, 4],
    [1.4, 4],
  ])('%s → level %i', (d, want) => {
    expect(heatLevel(d)).toBe(want)
    expect(HEAT_LEVEL_CLASSES[want]).toBeTruthy()
  })
})

describe('scopeCells', () => {
  it('all scope divides by weekday school days × open venue count, and the index is (day × 8 + slot)', () => {
    const heat = zeros()
    heat[8] = { heldHours: 2, segments: 3 } // Tuesday 08:30
    const cells = scopeCells(data({ heatmap: heat }), 'all')
    expect(cells).toHaveLength(40)
    expect(cells[8]).toMatchObject({ day: 1, slot: 0, capacityHours: 4, density: 0.5, segments: 3 })
  })

  it('one venue uses k = 1 and its own cells, with no other input', () => {
    const cells0 = zeros()
    cells0[0] = { heldHours: 1, segments: 1 }
    const d = data({ venues: [venue({ venueId: 'a', cells: cells0 })] })
    expect(scopeCells(d, 'a')[0]).toMatchObject({ capacityHours: 2, density: 0.5 })
  })

  it('a weekday with no school days has a null density', () => {
    const cells = scopeCells(data({ weekdaySchoolDays: [0, 2, 2, 2, 2] }), 'all')
    expect(cells[0].density).toBeNull()
    expect(cellLabel(cells[0])).toBe('จันทร์ 08:30–09:30: ไม่มีวันทำการในช่วงนี้')
  })
})

describe('peakOf / quietOf', () => {
  it('peak breaks ties by segments; quiet never lands on the lunch hour', () => {
    const heat = Array.from({ length: 40 }, () => ({ heldHours: 2, segments: 1 }))
    heat[3] = { heldHours: 0, segments: 0 } // Monday 11:30 — lunch, emptiest
    heat[10] = { heldHours: 4, segments: 1 }
    heat[11] = { heldHours: 4, segments: 5 }
    const cells = scopeCells(data({ heatmap: heat, occupancy: { heldHours: 0, schoolDays: 10, venueCount: 2, occupancyPercent: 0 } }), 'all')
    expect(peakOf(cells)?.i).toBe(11)
    const q = quietOf(cells)
    expect(q?.slot).not.toBe(3)
    expect(q?.slot).not.toBe(4)
  })

  it('both are null when no cell has a density', () => {
    const cells = scopeCells(data({ weekdaySchoolDays: [0, 0, 0, 0, 0] }), 'all')
    expect(peakOf(cells)).toBeNull()
    expect(quietOf(cells)).toBeNull()
    expect(hasAnyUse(cells)).toBe(false)
  })
})

describe('pickLineText (AC-V11, DV-5)', () => {
  it('says there is no use when nothing is held in scope', () => {
    expect(pickLineText(null, 'ทุกสถานที่ (ภาพรวม)')).toBe('ยังไม่มีการใช้สถานที่ในช่วงนี้')
  })

  it('reads the full sentence for a cell', () => {
    const heat = zeros()
    heat[0] = { heldHours: 2, segments: 3 }
    const cell = scopeCells(data({ heatmap: heat }), 'all')[0]
    expect(pickLineText(cell, 'ทุกสถานที่ (ภาพรวม)')).toBe(
      'วันจันทร์ 08:30–09:30 · ทุกสถานที่ (ภาพรวม) — มีการใช้งาน 3 รายการ รวม 2 ชม. จากเวลาที่เปิดให้จอง 4 ชม. (50.0%)',
    )
  })
})

it('slotLabel spans the half-hour grid', () => {
  expect(slotLabel(0)).toBe('08:30–09:30')
  expect(slotLabel(7)).toBe('15:30–16:30')
})

describe('demandTier (D-17)', () => {
  it.each([
    [{ isOpen: false, occupancyPercent: 90 }, 'ปิดให้จอง'],
    [{ occupancyPercent: 35 }, 'หนาแน่นสูง'],
    [{ occupancyPercent: 9.9 }, 'ใช้งานน้อย'],
    [{ occupancyPercent: 20 }, 'เหมาะสม'],
    [{ occupancyPercent: 20, requests: 5, autoRejectedPercent: 20 }, 'หนาแน่นสูง'],
    [{ occupancyPercent: 20, requests: 4, autoRejectedPercent: 50 }, 'เหมาะสม'],
  ])('%j → %s', (over, want) => {
    expect(demandTier(venue(over)).text).toBe(want)
  })
})

describe('venueOptions', () => {
  it('lists all first, then venues by name with the deleted / closed suffix', () => {
    const opts = venueOptions([
      venue({ venueId: 'b', name: 'ข', isOpen: false }),
      venue({ venueId: 'a', name: 'ก', isDeleted: true }),
    ])
    expect(opts.map((o) => o.label)).toEqual(['ทุกสถานที่ (ภาพรวม)', 'ก (ลบแล้ว)', 'ข (ปิดให้จอง)'])
  })
})

describe('typeClashRows (AC-V13)', () => {
  it('groups by type, drops types with no requests, sorts by rate then requests', () => {
    const rows = typeClashRows([
      venue({ venueId: '1', typeName: 'A', requests: 10, autoRejected: 1 }),
      venue({ venueId: '2', typeName: 'B', requests: 4, autoRejected: 2, name: 'บ' }),
      venue({ venueId: '3', typeName: 'C', requests: 0, autoRejected: 0 }),
    ])
    expect(rows.map((r) => r.typeName)).toEqual(['B', 'A'])
    expect(rows[0].venues).toEqual(['บ 2 ครั้ง'])
  })
})

describe('recommendations (AC-V13, D-18)', () => {
  it('says there is no bottleneck when nothing was auto-rejected', () => {
    const recs = recommendations(data({ venues: [venue({})] }))
    expect(recs[0].key).toBe('ยังไม่มีจุดคอขวด')
  })

  it('offers a SAME-TYPE alternative only, never a different type', () => {
    const hot = venue({
      venueId: 'hot',
      name: 'หอ',
      typeName: 'หอประชุม',
      capacity: 100,
      autoRejected: 3,
      requests: 6,
      autoRejectedPercent: 50,
      topClash: { isoWeekday: 1, startTime: '09:00', endTime: '11:00', count: 3 },
    })
    const otherType = venue({ venueId: 'x', name: 'ยิม', typeName: 'โรงยิม', capacity: 500 })
    const sameType = venue({ venueId: 'y', name: 'หอสอง', typeName: 'หอประชุม', capacity: 200 })
    const withAlt = recommendations(data({ venues: [hot, otherType, sameType] }))
    expect(withAlt[0].text).toContain('หอสอง')
    expect(withAlt[0].text).not.toContain('ยิม')
    const noAlt = recommendations(data({ venues: [hot, otherType] }))
    expect(noAlt[0].text).toContain('ไม่มีสถานที่ประเภทใกล้เคียง')
  })

  it('a weekend top clash has no cell, so it takes the no-alternative sentence (DV-7)', () => {
    const hot = venue({
      autoRejected: 1,
      topClash: { isoWeekday: 6, startTime: '09:00', endTime: '11:00', count: 1 },
    })
    expect(recommendations(data({ venues: [hot] }))[0].text).toContain('ไม่มีสถานที่ประเภทใกล้เคียง')
  })

  it('lists venues under 10% as the spare-capacity recommendation', () => {
    const low = venue({ name: 'ว่าง', occupancyPercent: 4 })
    const recs = recommendations(data({ venues: [low] }))
    expect(recs.at(-1)?.text).toContain('ว่าง (4%)')
  })
})

describe('isVenuesEmpty (D-19)', () => {
  it('is empty with no school day even when requests exist', () => {
    expect(isVenuesEmpty(data({ range: { schoolDays: 0 } as ReportsVenues['range'] }))).toBe(true)
  })
  it('is empty with no requests and no hours', () => {
    expect(
      isVenuesEmpty(
        data({
          requests: { total: 0 } as ReportsVenues['requests'],
          occupancy: { heldHours: 0, schoolDays: 10, venueCount: 1, occupancyPercent: 0 },
        }),
      ),
    ).toBe(true)
  })
  it('is not empty otherwise', () => {
    expect(isVenuesEmpty(data())).toBe(false)
  })
})
