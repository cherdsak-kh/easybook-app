import {
  bucketLongLabel,
  bucketShortLabel,
  bucketTooltip,
  defaultPickIndex,
  inclusiveDays,
  monthPresets,
  occupancyTrend,
  pickLineText,
  previousRangeOf,
  rangeEcho,
  termLabel,
  termOf,
  termPresets,
  termRange,
  thaiDateOf,
  validateRange,
  type TrendBucketLike,
} from '@/admin-portal/pages/reports/report-presets'

/**
 * ภาพรวมสถิติ's pure preset/validation/echo helpers (AC-R1, AC-R2, AC-R3, D-10, D-14). Ported
 * 1:1 from the prototype's `termOf`/`termRange`/`termPresets`, so these pin the SAME term
 * boundaries the prototype's own reviewers signed off on.
 */

describe('termOf', () => {
  it('resolves term 1 for a date inside 16 พ.ค.–31 ต.ค.', () => {
    expect(termOf('2026-09-28')).toEqual({ n: 1, be: 2569 })
  })
  it('resolves term 2 for a date from 1 พ.ย. onward, labelled with the starting BE year', () => {
    expect(termOf('2026-11-15')).toEqual({ n: 2, be: 2569 })
  })
  it('resolves term 2 for Jan–Mar, labelled with the PREVIOUS BE year (the term started last year)', () => {
    expect(termOf('2027-02-01')).toEqual({ n: 2, be: 2569 })
  })
  it('is null during the 1 เม.ย.–15 พ.ค. break — no current term', () => {
    expect(termOf('2026-04-20')).toBeNull()
    expect(termOf('2026-05-15')).toBeNull()
  })
})

describe('termRange / termLabel', () => {
  it('term 1 runs 16 พ.ค.–31 ต.ค. of its own BE year', () => {
    expect(termRange({ n: 1, be: 2569 })).toEqual({ from: '2026-05-16', to: '2026-10-31' })
  })
  it('term 2 runs 1 พ.ย. of its BE year to 31 มี.ค. of the next', () => {
    expect(termRange({ n: 2, be: 2569 })).toEqual({ from: '2026-11-01', to: '2027-03-31' })
  })
  it('labels as "ภาคเรียนที่ N/BE"', () => {
    expect(termLabel({ n: 2, be: 2569 })).toBe('ภาคเรียนที่ 2/2569')
  })
})

describe('termPresets', () => {
  it('marks the current term (ปัจจุบัน) and lists the two before it, newest first', () => {
    const presets = termPresets('2026-09-28')
    expect(presets).toHaveLength(3)
    expect(presets[0].label).toBe('ภาคเรียนที่ 1/2569 (ปัจจุบัน)')
    expect(presets[1].label).toBe('ภาคเรียนที่ 2/2568')
    expect(presets[2].label).toBe('ภาคเรียนที่ 1/2568')
  })
  it('marks nobody current during the summer break, and the newest preset is the term that just ended', () => {
    const presets = termPresets('2026-04-20')
    expect(presets[0].label).toBe('ภาคเรียนที่ 2/2568')
    expect(presets.every((p) => !p.label.includes('ปัจจุบัน'))).toBe(true)
  })
})

describe('monthPresets', () => {
  it('runs newest-first back to the floor date, marking the current month', () => {
    const presets = monthPresets('2026-09-28', '2026-07-01')
    expect(presets.map((p) => p.id)).toEqual(['2026-09', '2026-08', '2026-07'])
    expect(presets[0].label).toContain('(เดือนนี้)')
    expect(presets[1].label).not.toContain('(เดือนนี้)')
  })
})

describe('inclusiveDays / validateRange', () => {
  it('counts both endpoints', () => {
    expect(inclusiveDays('2026-09-01', '2026-09-01')).toBe(1)
    expect(inclusiveDays('2026-09-01', '2026-09-30')).toBe(30)
  })
  it('flags a missing date', () => {
    expect(validateRange('', '2026-09-01')).toMatch(/ระบุวันที่/)
  })
  it('flags an inverted range', () => {
    expect(validateRange('2026-09-10', '2026-09-01')).toMatch(/ถึงวันที่/)
  })
  it('flags a span over 366 days (D-14) and accepts exactly 366', () => {
    expect(validateRange('2026-01-01', '2027-01-02')).toBe('ช่วงวันที่ต้องไม่เกิน 366 วัน') // 367 days
    expect(validateRange('2024-01-01', '2024-12-31')).toBeNull() // 366-day leap year span
  })
  it('accepts an ordinary valid range', () => {
    expect(validateRange('2026-05-16', '2026-10-31')).toBeNull()
  })
})

describe('previousRangeOf', () => {
  it('term mode compares against the immediately preceding term', () => {
    const preset = { id: '1-2569', from: '2026-05-16', to: '2026-10-31', label: 'x' }
    const prev = previousRangeOf('term', preset.from, preset.to, preset)
    expect(prev).toEqual({ from: '2025-11-01', to: '2026-03-31', label: 'ภาคเรียนที่ 2/2568' })
  })
  it('month mode compares against the preceding calendar month', () => {
    const prev = previousRangeOf('month', '2026-09-01', '2026-09-30', null)
    expect(prev.from).toBe('2026-08-01')
    expect(prev.to).toBe('2026-08-31')
  })
  it('month mode rolls the year back across January', () => {
    const prev = previousRangeOf('month', '2026-01-01', '2026-01-31', null)
    expect(prev.from).toBe('2025-12-01')
    expect(prev.to).toBe('2025-12-31')
  })
  it('custom mode uses the same-length span immediately before, labelled generically', () => {
    const prev = previousRangeOf('custom', '2026-09-10', '2026-09-19', null) // 10-day span
    expect(prev).toEqual({ from: '2026-08-31', to: '2026-09-09', label: 'ช่วงก่อนหน้าที่ยาวเท่ากัน' })
  })
})

describe('occupancyTrend', () => {
  it('is neutral when either rate is null', () => {
    expect(occupancyTrend(null, 10, '2026-01-01', 'x', '2020-01-01').tone).toBe('neutral')
    expect(occupancyTrend(10, null, '2026-01-01', 'x', '2020-01-01').tone).toBe('neutral')
  })
  it('is neutral when the previous range ends before the earliest data on record', () => {
    const t = occupancyTrend(10, 5, '2019-12-31', 'x', '2020-01-01')
    expect(t.tone).toBe('neutral')
    expect(t.text).toBe('ไม่มีข้อมูลช่วงก่อนหน้าให้เทียบ')
  })
  it('is success on a positive delta ≥ 0.05 points, with a + sign', () => {
    const t = occupancyTrend(21, 18, '2026-01-01', 'เดือนก่อน', '2020-01-01')
    expect(t.tone).toBe('success')
    expect(t.text).toBe('+3.0 จุด เทียบกับเดือนก่อน')
  })
  it('is error on a negative delta, with a − sign', () => {
    const t = occupancyTrend(18, 21, '2026-01-01', 'เดือนก่อน', '2020-01-01')
    expect(t.tone).toBe('error')
    expect(t.text).toBe('−3.0 จุด เทียบกับเดือนก่อน')
  })
  it('is neutral for a negligible delta under 0.05 points', () => {
    const t = occupancyTrend(20.01, 20, '2026-01-01', 'x', '2020-01-01')
    expect(t.tone).toBe('neutral')
  })
})

describe('rangeEcho', () => {
  it('states the span and school-day count', () => {
    const s = rangeEcho({
      from: '2026-09-01',
      to: '2026-09-10',
      dataUntilDate: '2026-09-27',
      schoolDays: 8,
    })
    expect(s).toBe(`ช่วงข้อมูล ${thaiDateOf('2026-09-01')} – ${thaiDateOf('2026-09-10')} (10 วัน) · วันทำการ 8 วัน`)
  })
  it('adds the "มีข้อมูลถึง" clause when the range extends past yesterday', () => {
    const s = rangeEcho({
      from: '2026-09-01',
      to: '2026-10-31',
      dataUntilDate: '2026-09-27',
      schoolDays: 19,
    })
    expect(s).toContain('มีข้อมูลถึง')
  })
  it('omits the school-day clause when there are none (E-13, an all-future range)', () => {
    const s = rangeEcho({
      from: '2026-11-01',
      to: '2026-11-30',
      dataUntilDate: '2026-09-27',
      schoolDays: 0,
    })
    expect(s).not.toContain('วันทำการ')
  })
})

function bucket(overrides: Partial<TrendBucketLike> = {}): TrendBucketLike {
  return {
    from: '2026-09-01',
    to: '2026-09-30',
    partial: false,
    future: false,
    total: 10,
    approved: 7,
    rejected: 2,
    autoRejected: 1,
    cancelled: 1,
    occupancyPercent: 20.456,
    ...overrides,
  }
}

describe('trend chart labels (AC-R9)', () => {
  it('month grain labels with the bare month name, flagging a clipped bucket', () => {
    expect(bucketShortLabel(bucket(), 'month')).toBe('ก.ย.')
    expect(bucketLongLabel(bucket({ partial: true }), 'month')).toBe('กันยายน 2569 (บางส่วน)')
    expect(bucketLongLabel(bucket(), 'month')).toBe('กันยายน 2569')
  })
  it('week grain labels with day + month, long label spans from–to', () => {
    expect(bucketShortLabel(bucket({ from: '2026-09-07' }), 'week')).toBe('7 ก.ย.')
    expect(bucketLongLabel(bucket(), 'week')).toBe(`สัปดาห์ ${thaiDateOf('2026-09-01')} – ${thaiDateOf('2026-09-30')}`)
  })
  it('a future bucket tooltip says so instead of the breakdown', () => {
    expect(bucketTooltip(bucket({ future: true }), 'month')).toBe('กันยายน 2569 · ยังไม่ถึงช่วงเวลานี้')
  })
  it('a normal bucket tooltip states the breakdown', () => {
    expect(bucketTooltip(bucket(), 'month')).toBe('กันยายน 2569 · คำขอ 10 · อนุมัติ 7 · ปฏิเสธ 2 · ยกเลิก 1')
  })
})

describe('defaultPickIndex / pickLineText', () => {
  it('picks the latest non-future bucket with data', () => {
    const buckets = [bucket({ total: 5 }), bucket({ total: 0 }), bucket({ future: true, total: 0 })]
    expect(defaultPickIndex(buckets)).toBe(0)
  })
  it('answers -1 when nothing qualifies', () => {
    expect(defaultPickIndex([bucket({ total: 0 }), bucket({ future: true })])).toBe(-1)
  })
  it('pick line names the auto-reject subset only when it is non-zero', () => {
    expect(pickLineText(bucket(), 'month')).toBe(
      'กันยายน 2569 — คำขอ 10 รายการ · อนุมัติ 7 · ปฏิเสธ 2 (เวลาชน 1) · ยกเลิก 1 · อัตราการใช้สถานที่ 20.5%',
    )
    expect(pickLineText(bucket({ autoRejected: 0 }), 'month')).not.toContain('เวลาชน')
  })
  it('the empty sentence when nothing is picked', () => {
    expect(pickLineText(null, 'month')).toBe('ยังไม่มีคำขอในช่วงนี้')
  })
})
