import {
  busySlotRangeText,
  dayOffsetBadge,
  freeWindowHeadline,
  nextSlotText,
  remainingText,
  roomMetaText,
  serverDateHeading,
  slotSpanText,
  thaiDayShortDate,
  todayActivityDesc,
  updatedAtLine,
} from '@/admin-portal/pages/dashboard/dashboard-format'
import { thaiTime } from '@/admin-portal/lib/thai-date'

/**
 * ภาพรวมระบบ's pure formatters (D-2, D-3, D-6, AC-D7/D8/D11). `thaiTime` is imported here too, not
 * duplicated — these tests pin the BRANCHING and COMPOSITION this module owns (day-offset tone
 * selection, the "เหลืออีก" unit split, which free-window string wins), not the hour-of-day digits
 * `thai-date.ts` already formats and is not this module's job to re-verify.
 */

describe('serverDateHeading / updatedAtLine', () => {
  it('reads the Thai weekday and Buddhist-era year from serverTime, never the device clock', () => {
    const iso = '2026-09-28T06:40:12.345Z'
    const d = new Date(iso)
    expect(serverDateHeading(iso)).toContain(String(d.getFullYear() + 543))
    expect(serverDateHeading(iso)).toMatch(/^วัน.+ที่ \d+ .+ \d{4}$/)
  })

  it('answers — for an unparsable instant rather than "Invalid Date"', () => {
    expect(serverDateHeading('not-a-date')).toBe('—')
  })

  it('formats "อัปเดต HH:MM น." from serverTime', () => {
    const iso = '2026-09-28T06:40:00.000Z'
    expect(updatedAtLine(iso)).toBe(`อัปเดต ${thaiTime(iso)} น.`)
  })
})

describe('thaiDayShortDate / slotSpanText', () => {
  it('prints a short weekday + full BE year', () => {
    const iso = '2026-09-28T06:40:00.000Z'
    const d = new Date(iso)
    expect(thaiDayShortDate(iso)).toContain(String(d.getFullYear() + 543))
  })

  it('joins two instants with an en dash and the trailing น.', () => {
    const a = '2026-09-28T01:30:00.000Z'
    const b = '2026-09-28T04:30:00.000Z'
    expect(slotSpanText(a, b)).toBe(`${thaiTime(a)}–${thaiTime(b)} น.`)
  })
})

describe('busySlotRangeText', () => {
  it('marks a cross-midnight start with เมื่อวาน and a cross-midnight end with พรุ่งนี้', () => {
    const a = '2026-09-27T18:00:00.000Z'
    const b = '2026-09-28T01:00:00.000Z'
    const out = busySlotRangeText(a, b, true, true)
    expect(out).toContain('เมื่อวาน')
    expect(out).toContain('พรุ่งนี้')
  })

  it('carries no day marker for a same-day slot', () => {
    const a = '2026-09-28T01:00:00.000Z'
    const b = '2026-09-28T04:00:00.000Z'
    const out = busySlotRangeText(a, b, false, false)
    expect(out).not.toContain('เมื่อวาน')
    expect(out).not.toContain('พรุ่งนี้')
  })
})

describe('remainingText', () => {
  it('shows both units when the remainder spans an hour', () => {
    expect(remainingText(110)).toBe('เหลืออีก 1 ชม. 50 นาที')
  })
  it('drops the hour unit under 60 minutes', () => {
    expect(remainingText(45)).toBe('เหลืออีก 45 นาที')
  })
  it('drops the minute unit on an exact hour, never printing "0 นาที"', () => {
    expect(remainingText(60)).toBe('เหลืออีก 1 ชม.')
  })
  it('still prints a value at zero minutes left rather than an empty string', () => {
    expect(remainingText(0)).toBe('เหลืออีก 0 นาที')
  })
})

describe('dayOffsetBadge — D-6', () => {
  const at = '2026-09-28T04:00:00.000Z'

  it('overdue (<0) is badge-error and states the days elapsed, no time', () => {
    const b = dayOffsetBadge(-2, at)
    expect(b.badgeClass).toBe('badge-error')
    expect(b.text).toBe('เลยวันใช้งานมาแล้ว 2 วัน')
  })
  it('today (0) is badge-warning and includes the time', () => {
    const b = dayOffsetBadge(0, at)
    expect(b.badgeClass).toBe('badge-warning')
    expect(b.text).toBe(`ใช้งานวันนี้ ${thaiTime(at)} น.`)
  })
  it('tomorrow (1) is badge-warning and includes the time', () => {
    const b = dayOffsetBadge(1, at)
    expect(b.badgeClass).toBe('badge-warning')
    expect(b.text).toBe(`ใช้งานพรุ่งนี้ ${thaiTime(at)} น.`)
  })
  it('2–7 days out is badge-info with no time', () => {
    expect(dayOffsetBadge(2, at)).toEqual({ badgeClass: 'badge-info', text: 'ใช้งานอีก 2 วัน' })
    expect(dayOffsetBadge(7, at)).toEqual({ badgeClass: 'badge-info', text: 'ใช้งานอีก 7 วัน' })
  })
  it('past 7 days is badge-neutral', () => {
    expect(dayOffsetBadge(8, at)).toEqual({ badgeClass: 'badge-neutral', text: 'ใช้งานอีก 8 วัน' })
  })
})

describe('freeWindowHeadline — D-3', () => {
  it('UNTIL_NEXT reads the freeUntil time', () => {
    const iso = '2026-09-28T07:30:00.000Z'
    expect(freeWindowHeadline('UNTIL_NEXT', iso)).toBe(`ว่างจนถึง ${thaiTime(iso)} น.`)
  })
  it('ALL_DAY / AFTERNOON / REST_OF_DAY print the server-computed window verbatim', () => {
    expect(freeWindowHeadline('ALL_DAY', null)).toBe('ว่างตลอดทั้งวัน')
    expect(freeWindowHeadline('AFTERNOON', null)).toBe('ว่างตลอดช่วงบ่าย')
    expect(freeWindowHeadline('REST_OF_DAY', null)).toBe('ว่างจนถึงสิ้นวัน')
  })
  it('a null window (OFF/BUSY venues never call this) falls back rather than throwing', () => {
    expect(freeWindowHeadline(null, null)).toBe('ว่าง')
  })
})

describe('nextSlotText', () => {
  it('states the range and purpose when there is a next slot', () => {
    const next = {
      startAt: '2026-09-28T07:30:00.000Z',
      endAt: '2026-09-28T09:00:00.000Z',
      endsAfterToday: false,
      purpose: 'ประชุมคณะกรรมการ',
    }
    expect(nextSlotText(next)).toBe(
      `ถัดไป ${thaiTime(next.startAt)} – ${thaiTime(next.endAt)} น. · ${next.purpose}`,
    )
  })
  it('falls back when there is none', () => {
    expect(nextSlotText(null)).toBe('ไม่มีการจองต่อจากนี้ในวันนี้')
  })
})

describe('roomMetaText — AC-D11', () => {
  it('an OFF venue always reads ไม่รับจองชั่วคราว, regardless of todaySlotCount', () => {
    expect(roomMetaText(300, 2, true)).toBe('ความจุ 300 คน · ไม่รับจองชั่วคราว')
  })
  it('an open venue with bookings states the count', () => {
    expect(roomMetaText(60, 3, false)).toBe('ความจุ 60 คน · จองวันนี้ 3 ช่วง')
  })
  it('an open venue with none reads ไม่มีการจองวันนี้', () => {
    expect(roomMetaText(60, 0, false)).toBe('ความจุ 60 คน · ไม่มีการจองวันนี้')
  })
})

describe('todayActivityDesc — card 3 (D-4)', () => {
  it('states the in-use count when positive', () => {
    expect(todayActivityDesc(3)).toBe('กำลังใช้งานอยู่ 3 ห้อง')
  })
  it('falls back to the empty sentence at zero', () => {
    expect(todayActivityDesc(0)).toBe('ขณะนี้ไม่มีห้องที่กำลังใช้งาน')
  })
})
