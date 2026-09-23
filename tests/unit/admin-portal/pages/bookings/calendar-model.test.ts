import {
  barBox,
  barLabel,
  barTip,
  clashLabel,
  clashesOf,
  LAND_AT,
  minutesOf,
  packLanes,
  rowHeight,
  slotMinutes,
  timelineRows,
  UNKNOWN_VENUE,
} from '@/admin-portal/pages/bookings/calendar-model'
import type { CalendarBookingSlot } from '@/lib/api-client'

/**
 * The day timeline's pure half: geometry, lanes, rows, and the PO's clash rule, which the agenda
 * card and the timeline bar share. Pure functions, which is the kind of unit the test policy asks for.
 */

let n = 0
/** A slot on 2026-09-21 (Bangkok), `HH:mm` in, instants derived as the server would send them. */
function slot(p: Partial<CalendarBookingSlot> & { start: string; end: string }): CalendarBookingSlot {
  n++
  const at = (hhmm: string) =>
    new Date(Date.UTC(2026, 8, 21, 0, minutesOf(hhmm)) - 7 * 3600_000).toISOString()
  return {
    id: `s${n}`,
    bookingRequestId: `b${n}`,
    code: `BR-25690921-${String(n).padStart(3, '0')}`,
    status: 'PENDING',
    purpose: 'ประชุม',
    requesterName: 'ครูสมชาย',
    venueId: 'v1',
    venueName: 'หอประชุม',
    date: '2026-09-21',
    slotIndex: 1,
    slotCount: 1,
    startAt: at(p.start),
    endAt: at(p.end),
    ...p,
  }
}

describe('clashLabel — PENDING only (PO)', () => {
  it('never flags an APPROVED slot, whatever overlaps it', () => {
    const ok = slot({ status: 'APPROVED', start: '09:00', end: '12:00' })
    const req = slot({ start: '10:00', end: '11:00' })
    const pool = [ok, req]
    expect(clashesOf(ok, pool)).toHaveLength(1)
    expect(clashLabel(ok, clashesOf(ok, pool))).toBeNull()
  })

  it('says "blocked by an approval" when any overlap is approved', () => {
    const ok = slot({ status: 'APPROVED', start: '09:00', end: '12:00' })
    const req = slot({ start: '10:00', end: '11:00' })
    const other = slot({ start: '10:30', end: '13:00' })
    expect(clashLabel(req, clashesOf(req, [ok, req, other]))).toBe(
      'ช่วงเวลาทับซ้อนกับการจองที่อนุมัติแล้ว',
    )
  })

  it('counts the other requests when none is approved', () => {
    const a = slot({ start: '09:00', end: '12:00' })
    const b = slot({ start: '11:00', end: '13:15' })
    const c = slot({ start: '08:00', end: '09:30' })
    expect(clashLabel(a, clashesOf(a, [a, b, c]))).toBe('ช่วงเวลาทับซ้อนกับคำขออื่น 2 รายการ')
  })

  it('is half-open: 12:00 end and 12:00 start do not clash', () => {
    const a = slot({ start: '09:00', end: '12:00' })
    const b = slot({ start: '12:00', end: '13:00' })
    expect(clashLabel(a, clashesOf(a, [a, b]))).toBeNull()
  })
})

describe('timeline geometry', () => {
  it('reads 24:00 as the end of the day', () => {
    expect(minutesOf('24:00')).toBe(1440)
    expect(slotMinutes({ start: '22:00', end: '24:00' })).toEqual({ start: 1320, end: 1440 })
  })

  it('clips a slot that crosses midnight to 24:00', () => {
    expect(slotMinutes({ start: '22:00', end: '02:00' })).toEqual({ start: 1320, end: 1440 })
  })

  it('places a bar to the minute, with a 44px floor', () => {
    const b = barBox(minutesOf('08:20'), minutesOf('09:45'))
    expect(b.left).toBeCloseTo(583.33, 2)
    expect(b.width).toBeCloseTo(99.17, 2)
    expect(barBox(0, 15)).toEqual({ left: 0, width: 44 })
    expect(barBox(1320, 1440)).toEqual({ left: 1540, width: 140 })
  })

  it('lands on 08:00 with 20px of 07:xx showing', () => {
    expect(LAND_AT).toBe(540)
  })

  it('grows a row by a lane: 56, 96, 136', () => {
    expect([1, 2, 3].map(rowHeight)).toEqual([56, 96, 136])
  })

  it('frees a lane at the DRAWN end, not the booked one', () => {
    // 00:00–00:15 is drawn 44px ≈ 37.7 minutes, so 00:20 must take a second lane.
    const { placed, lanes } = packLanes([
      slot({ start: '00:00', end: '00:15' }),
      slot({ start: '00:20', end: '01:00' }),
      slot({ start: '01:00', end: '02:00' }),
    ])
    expect(placed.map((p) => p.lane)).toEqual([0, 1, 0])
    expect(lanes).toBe(2)
  })

  it('has one lane on an empty row', () => {
    expect(packLanes([]).lanes).toBe(1)
  })
})

describe('timelineRows', () => {
  const venues = [
    { id: 'v1', name: 'หอประชุม' },
    { id: 'v2', name: 'ห้องประชุม' },
  ]

  it('omits venues with no slot today', () => {
    const rows = timelineRows(venues, [slot({ venueId: 'v2', start: '09:00', end: '10:00' })], '')
    expect(rows.map((r) => [r.venueId, r.slots.length])).toEqual([['v2', 1]])
  })

  it('keeps the venue list order, not the slot order', () => {
    const rows = timelineRows(
      venues,
      [
        slot({ venueId: 'v2', start: '08:00', end: '09:00' }),
        slot({ venueId: 'v1', start: '10:00', end: '11:00' }),
      ],
      '',
    )
    expect(rows.map((r) => r.venueId)).toEqual(['v1', 'v2'])
  })

  it('returns no rows when the filtered venue has no slot', () => {
    expect(timelineRows(venues, [], 'v2')).toEqual([])
  })

  it('gives each unlisted venue its own trailing row, named by the slot', () => {
    const rows = timelineRows(
      venues,
      [
        slot({ venueId: 'v9', venueName: 'โดมใหม่', start: '09:00', end: '10:00' }),
        slot({ venueId: 'v8', venueName: '', start: '09:00', end: '10:00' }),
        slot({ venueId: 'v2', start: '11:00', end: '12:00' }),
      ],
      '',
    )
    expect(rows.map((r) => r.name)).toEqual(['ห้องประชุม', 'โดมใหม่', UNKNOWN_VENUE])
  })

  it('still draws the booked venues when the venue list is missing', () => {
    const rows = timelineRows(null, [slot({ start: '09:00', end: '10:00' })], '')
    expect(rows.map((r) => r.name)).toEqual(['หอประชุม'])
  })
})

describe('bar words', () => {
  it('leads the tooltip with the clash and drops a missing requester', () => {
    const s = slot({ start: '09:00', end: '12:00', requesterName: null, purpose: 'ซ้อม' })
    expect(barTip(s, 'หอประชุม', 'ช่วงเวลาทับซ้อนกับคำขออื่น 1 รายการ')).toBe(
      '⚠️ ช่วงเวลาทับซ้อนกับคำขออื่น 1 รายการ · 🕒 09:00–12:00 น. · หอประชุม · ซ้อม · รอพิจารณา',
    )
  })

  it('names the requester and the status when calm', () => {
    const s = slot({ status: 'APPROVED', start: '22:00', end: '24:00', purpose: 'ซ้อม' })
    expect(barTip(s, 'หอประชุม', null)).toBe(
      '🕒 22:00–24:00 น. · หอประชุม · ซ้อม (ครูสมชาย) · อนุมัติแล้ว',
    )
  })

  it('carries the code, the slot number and the clash in the accessible name', () => {
    const s = slot({ start: '09:00', end: '12:00', slotIndex: 2, slotCount: 3, purpose: 'ซ้อม' })
    expect(barLabel(s, 'หอประชุม', 'ช่วงเวลาทับซ้อนกับการจองที่อนุมัติแล้ว')).toBe(
      `ดูรายละเอียด ${s.code} ช่วงที่ 2 จาก 3 · 09:00–12:00 น. · หอประชุม · ซ้อม · ครูสมชาย · รอพิจารณา · ช่วงเวลาทับซ้อนกับการจองที่อนุมัติแล้ว`,
    )
  })
})
