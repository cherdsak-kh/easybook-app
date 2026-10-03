import {
  LOG_ERR_INCOMPLETE,
  LOG_ERR_INVERTED,
  LOG_ERR_TOO_WIDE,
  clockOf,
  logDateBounds,
  logPresetRange,
  logRangeEcho,
  validateLogRange,
} from '@/admin-portal/pages/reports/log-range'
import {
  bangkokClock,
  bangkokClockMs,
  bangkokDateClock,
  bangkokDateFull,
  bangkokDateShort,
  bangkokParts,
  bangkokTimestampFull,
  bangkokTimestampMs,
  rowNumber,
} from '@/admin-portal/pages/reports/log-format'

/**
 * Hub 5 / Hub 6 range and time formatting. Today is fixed at 3 ต.ค. 2569 (a Saturday), inside term
 * 1/2569. Every preset ENDS TODAY (D-16): a log is about what just happened, unlike Hubs 1 to 3.
 */
const TODAY = '2026-10-03'

describe('logPresetRange', () => {
  it('ends every preset today', () => {
    expect(logPresetRange('today', TODAY)).toEqual({ from: TODAY, to: TODAY })
    expect(logPresetRange('7d', TODAY)).toEqual({ from: '2026-09-27', to: TODAY })
    expect(logPresetRange('30d', TODAY)).toEqual({ from: '2026-09-04', to: TODAY })
    expect(logPresetRange('term', TODAY)).toEqual({ from: '2026-05-16', to: TODAY })
  })

  it('counts 7d and 30d inclusively (7 and 30 days)', () => {
    const day = (r: { from: string; to: string }) =>
      (Date.parse(r.to) - Date.parse(r.from)) / 86_400_000 + 1
    expect(day(logPresetRange('7d', TODAY))).toBe(7)
    expect(day(logPresetRange('30d', TODAY))).toBe(30)
  })

  it('crosses month and year boundaries and a leap day', () => {
    expect(logPresetRange('7d', '2027-01-03').from).toBe('2026-12-28')
    expect(logPresetRange('30d', '2028-03-10').from).toBe('2028-02-10')
    expect(logPresetRange('7d', '2028-03-02').from).toBe('2028-02-25')
  })

  it('uses the previous term during the 1 เม.ย.–15 พ.ค. break', () => {
    expect(logPresetRange('term', '2027-04-20').from).toBe('2026-11-01')
  })
})

describe('logDateBounds', () => {
  it('runs from the oldest known term start to today', () => {
    expect(logDateBounds(TODAY)).toEqual({ min: '2025-05-16', max: TODAY })
  })
})

describe('validateLogRange (AC-A2)', () => {
  it('accepts a valid range, including one day', () => {
    expect(validateLogRange('2026-09-01', '2026-10-03')).toBeNull()
    expect(validateLogRange(TODAY, TODAY)).toBeNull()
  })
  it('refuses a missing date, an inverted range and more than 366 days', () => {
    expect(validateLogRange('', TODAY)).toBe(LOG_ERR_INCOMPLETE)
    expect(validateLogRange(TODAY, '')).toBe(LOG_ERR_INCOMPLETE)
    expect(validateLogRange('2026-10-03', '2026-09-01')).toBe(LOG_ERR_INVERTED)
    expect(validateLogRange('2025-01-01', '2026-01-02')).toBe(LOG_ERR_TOO_WIDE)
  })
  it('allows exactly 366 days and refuses 367', () => {
    expect(validateLogRange('2025-10-03', '2026-10-03')).toBeNull() // 366 inclusive days
    expect(validateLogRange('2025-10-02', '2026-10-03')).toBe(LOG_ERR_TOO_WIDE)
  })
})

describe('logRangeEcho', () => {
  const sync = new Date(2026, 9, 3, 9, 5)
  it('names the range, the last update and any per-hub tail', () => {
    expect(logRangeEcho('2026-09-04', TODAY, sync)).toBe(
      'ช่วงข้อมูล 4 ก.ย. 2569 – 3 ต.ค. 2569 · อัปเดตล่าสุด 09.05 น.',
    )
    expect(logRangeEcho('2026-09-04', TODAY, sync, ['เก็บย้อนหลังสูงสุด 90 วัน', 'อัปเดตสดทุก 30 วินาที'])).toBe(
      'ช่วงข้อมูล 4 ก.ย. 2569 – 3 ต.ค. 2569 · อัปเดตล่าสุด 09.05 น. · เก็บย้อนหลังสูงสุด 90 วัน · อัปเดตสดทุก 30 วินาที',
    )
  })
  it('shows one date for one day and omits the stamp before the first load', () => {
    expect(logRangeEcho(TODAY, TODAY, null)).toBe('ช่วงข้อมูล 3 ต.ค. 2569')
  })
  it('clockOf pads with a period, not a colon', () => {
    expect(clockOf(new Date(2026, 0, 1, 0, 7))).toBe('00.07')
  })
})

describe('bangkok time formatting: Bangkok, never the browser zone (E-6)', () => {
  // 2026-09-30T16:30:45.123Z is 1 ต.ค. 23.30 น. in Bangkok: the NEXT day in the UTC date.
  const LATE = '2026-09-30T16:30:45.123Z'
  it('puts a late-evening UTC instant on the Bangkok day', () => {
    expect(bangkokParts(LATE)).toMatchObject({ date: '2026-09-30', hour: 23, minute: 30, second: 45, ms: 123 })
    // 17:00Z is already past Bangkok midnight.
    expect(bangkokParts('2026-09-30T17:00:00.000Z')).toMatchObject({ date: '2026-10-01', hour: 0 })
  })
  it('formats the short date and the Hub 5 clock (a period, then น.)', () => {
    expect(bangkokDateShort(LATE)).toBe('30 ก.ย. 2569')
    expect(bangkokClock(LATE)).toBe('23.30 น.')
    expect(bangkokDateClock('2026-09-30T17:05:00.000Z')).toBe('1 ต.ค. 2569 00.05 น.')
  })
  it('formats the full Thai timestamp with seconds, and flags a proxy time', () => {
    expect(bangkokDateFull('2026-09-28T03:15:42.000Z')).toBe('วันจันทร์ที่ 28 กันยายน พ.ศ. 2569')
    expect(bangkokTimestampFull('2026-09-28T03:15:42.000Z')).toBe(
      'วันจันทร์ที่ 28 กันยายน พ.ศ. 2569 เวลา 10.15.42 น.',
    )
    expect(bangkokTimestampFull('2026-09-28T03:15:42.000Z', true)).toMatch(/\(เวลาโดยประมาณ\)$/)
  })
  it('keeps colons and milliseconds for Hub 6, an engineer reading against a log line', () => {
    expect(bangkokClockMs('2026-09-28T03:15:42.007Z')).toBe('10:15:42.007')
    expect(bangkokTimestampMs('2026-09-28T03:15:42.007Z')).toBe(
      'วันจันทร์ที่ 28 กันยายน พ.ศ. 2569 10:15:42.007 (UTC+7)',
    )
  })
  it('renders a dash, never NaN, for an unparseable instant', () => {
    expect(bangkokParts('not a date')).toBeNull()
    expect(bangkokDateShort('x')).toBe('—')
    expect(bangkokClock('x')).toBe('—')
    expect(bangkokTimestampFull('x')).toBe('—')
    expect(bangkokClockMs('x')).toBe('—')
  })
})

describe('rowNumber', () => {
  it('is the position in the filtered view, not an id', () => {
    expect(rowNumber(1, 10, 0)).toBe(1)
    expect(rowNumber(2, 10, 0)).toBe(11)
    expect(rowNumber(3, 20, 4)).toBe(45)
  })
})
