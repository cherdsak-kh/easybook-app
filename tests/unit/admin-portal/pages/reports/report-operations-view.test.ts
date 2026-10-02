import type { ReportDepartmentRow, ReportPurposeRow, ReportSla } from '@/lib/api-client'
import {
  approvalBadge,
  bangkokParts,
  departmentName,
  equityBadge,
  lapseBadge,
  registryExtraSlots,
  registryLeadText,
  slaBadge,
  slaNote,
  topDepartment,
  topPurpose,
} from '@/admin-portal/pages/reports/report-operations-view'

const dept = (over: Partial<ReportDepartmentRow>): ReportDepartmentRow => ({
  departmentId: 1,
  name: 'ฝ่ายวิชาการ',
  isDeleted: false,
  requests: 0,
  approved: 0,
  approvalPercent: null,
  heldHours: 0,
  sharePercent: 0,
  lateCancellations: 0,
  ...over,
})

describe('approvalBadge (D-21)', () => {
  it.each([
    [null, 'badge-neutral', '—'],
    [75, 'badge-success', '75%'],
    [74.9, 'badge-warning', '75%'],
    [60, 'badge-warning', '60%'],
    [59.9, 'badge-error', '60%'],
  ])('%s → %s %s', (pct, cls, text) => {
    expect(approvalBadge(pct)).toEqual({ cls, text })
  })
})

describe('equityBadge (D-21)', () => {
  it('sums the top two REAL departments and ignores the unassigned row', () => {
    const rows = [
      dept({ departmentId: 1, sharePercent: 40 }),
      dept({ departmentId: null, name: null, sharePercent: 30 }),
      dept({ departmentId: 2, sharePercent: 25 }),
    ]
    expect(equityBadge(rows)).toEqual({ cls: 'badge-warning', text: '2 อันดับแรกใช้ 65% ของชั่วโมง' })
  })
  it('is neutral at or under 60 and absent with no department', () => {
    expect(equityBadge([dept({ sharePercent: 60 })])?.cls).toBe('badge-neutral')
    expect(equityBadge([dept({ departmentId: null, name: null })])).toBeNull()
  })
})

describe('lapseBadge (D-12: late cancellations only)', () => {
  it('counts late cancellations and never mentions no-shows', () => {
    expect(lapseBadge(3)).toEqual({ cls: 'badge-warning', text: 'ยกเลิกช้า 3' })
    expect(lapseBadge(0)).toEqual({ cls: 'badge-ghost', text: 'ไม่มี' })
  })
})

describe('topDepartment / departmentName', () => {
  it('skips the unassigned row and zero-hour rows', () => {
    const rows = [
      dept({ departmentId: null, name: null, heldHours: 99 }),
      dept({ departmentId: 2, name: 'ศิลปะ', heldHours: 0 }),
      dept({ departmentId: 3, name: 'ภาษา', heldHours: 5, isDeleted: true }),
    ]
    const top = topDepartment(rows)
    expect(top?.departmentId).toBe(3)
    expect(top && departmentName(top)).toBe('ภาษา (ลบแล้ว)')
    expect(departmentName(rows[0])).toBe('ไม่ระบุกลุ่ม/ฝ่าย')
  })
})

describe('topPurpose', () => {
  it('excludes OTHER even when it has the most hours', () => {
    const rows: ReportPurposeRow[] = [
      { category: 'OTHER', requests: 9, heldHours: 90, sharePercent: 90 },
      { category: 'MEETING', requests: 1, heldHours: 10, sharePercent: 10 },
    ]
    expect(topPurpose(rows)?.category).toBe('MEETING')
    expect(topPurpose([{ category: 'OTHER', requests: 1, heldHours: 1, sharePercent: 100 }])).toBeNull()
  })
})

describe('slaBadge (D-24)', () => {
  it('is neutral with nothing decided, success at 90 %, otherwise warning', () => {
    expect(slaBadge({ decided: 0, withinSlaPercent: null, slaHours: 24 }).text).toBe('ยังไม่มีคำขอที่พิจารณา')
    expect(slaBadge({ decided: 10, withinSlaPercent: 90, slaHours: 24 })).toEqual({
      cls: 'badge-success',
      text: '90.0% ในเกณฑ์ 24 ชม.',
    })
    expect(slaBadge({ decided: 10, withinSlaPercent: 89.9, slaHours: 24 }).cls).toBe('badge-warning')
  })
})

describe('registry text (D-25)', () => {
  it('reads before / after start, and (+N ช่วง) only beyond one slot', () => {
    expect(registryLeadText({ cancelledAfterStart: false, minutes: 10 })).toBe('ก่อนเริ่ม 10 นาที')
    expect(registryLeadText({ cancelledAfterStart: true, minutes: 15 })).toBe('หลังเริ่ม 15 นาที')
    expect(registryExtraSlots({ lateSlotCount: 1 })).toBe('')
    expect(registryExtraSlots({ lateSlotCount: 3 })).toBe('(+2 ช่วง)')
  })
})

describe('bangkokParts', () => {
  it('reads Bangkok wall time whatever the device zone, across a UTC date boundary', () => {
    expect(bangkokParts('2026-09-15T06:00:00.000Z')).toEqual({ date: '2026-09-15', time: '13:00' })
    expect(bangkokParts('2026-09-14T18:30:00.000Z')).toEqual({ date: '2026-09-15', time: '01:30' })
  })
})

describe('slaNote (AC-O11)', () => {
  it('states every exclusion count and the estimate caveat', () => {
    const sla = {
      excluded: { autoRejected: 1, withdrawn: 2, staffCreated: 3, expired: 4, pending: 5 },
    } as ReportSla
    const note = slaNote(sla)
    expect(note).toContain('(ADR-001) 1 รายการ')
    expect(note).toContain('ก่อนมีการพิจารณา 2 รายการ')
    expect(note).toContain('เจ้าหน้าที่สร้างเอง 3 รายการ')
    expect(note).toContain('หมดอายุก่อนมีการพิจารณา 4 รายการ')
    expect(note).toContain('เป็นค่าประมาณ')
  })
})
