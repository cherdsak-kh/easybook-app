import type { AuditActor, AuditEvent, IncidentDetail } from '@/lib/api-client'
import {
  ACTOR_DELETED,
  ACTOR_UNRECORDED,
  NO_DEPARTMENT,
  RESOURCE_UNRECORDED,
  actorView,
  decisionsOf,
  diffRowsOf,
  filtersActive,
  gotoOf,
  noMatchDesc,
  positionLine,
  resourceOf,
  searchPlaceholder,
  topActorOf,
  totalDesc,
} from '@/admin-portal/pages/reports/activity-view'
import {
  availabilityBadge,
  availabilityOf,
  contextOf,
  criticalDesc,
  externalOf,
  last24hDesc,
  pathOf,
  purgeOf,
  retentionNote,
  statusClass,
  statusLabel,
  viewLabel,
} from '@/admin-portal/pages/reports/error-log-view'
import { canReach } from '@/admin-portal/lib/use-acl'

const active: AuditActor = {
  id: 'u4',
  name: 'สมหญิง เรืองศรี',
  role: 'ADMIN',
  position: 'เจ้าหน้าที่',
  department: 'ฝ่ายบริหารงานทั่วไป',
  state: 'ACTIVE',
}

describe('actorView: every state of AC-A10', () => {
  it('renders an active actor with role and department', () => {
    expect(actorView(active)).toMatchObject({ name: 'สมหญิง เรืองศรี', role: 'ADMIN', department: 'ฝ่ายบริหารงานทั่วไป', known: true })
  })
  it('suffixes a soft-deleted actor, keeping the name', () => {
    expect(actorView({ ...active, state: 'SOFT_DELETED' })).toMatchObject({ name: 'สมหญิง เรืองศรี (ลบแล้ว)', known: true })
  })
  it('says a hard-deleted actor is unknown, and keeps no department; CANCEL still carries the role at the time', () => {
    const v = actorView({ id: null, name: null, role: null, position: null, department: null, state: 'HARD_DELETED' })
    expect(v).toEqual({ name: ACTOR_DELETED, role: null, department: null, position: null, known: false })
    expect(actorView({ id: 'x', name: null, role: 'ADMIN', position: null, department: null, state: 'HARD_DELETED' }).role).toBe('ADMIN')
  })
  it('says an unrecorded actor (reject, broadcast) is unrecorded, never a person', () => {
    expect(actorView(null)).toEqual({ name: ACTOR_UNRECORDED, role: null, department: null, position: null, known: false })
  })
  it('folds a null department (the reserved one for ADMIN) to ไม่ระบุกลุ่ม/ฝ่าย', () => {
    expect(actorView({ ...active, department: null }).department).toBe(NO_DEPARTMENT)
  })
  it('joins position and department for the dialog, or says nothing', () => {
    expect(positionLine(actorView(active))).toBe('เจ้าหน้าที่ · ฝ่ายบริหารงานทั่วไป')
    expect(positionLine(actorView(null))).toBeNull()
  })
})

describe('Hub 5 KPI sentences (AC-A4)', () => {
  it('averages over the range, or says since midnight for one day', () => {
    expect(totalDesc({ total: 33, days: 30 })).toBe('เฉลี่ยวันละ 1.1 รายการ ใน 30 วัน')
    expect(totalDesc({ total: 4, days: 1 })).toBe('ตั้งแต่เวลา 00.00 น. ของวันนี้')
  })
  it('counts approve + reject + cancel as decisions and tails the direct bookings', () => {
    expect(decisionsOf({ approve: 13, reject: 6, cancel: 6, directBooking: 5 })).toEqual({
      count: 25,
      desc: 'อนุมัติ 13 · ปฏิเสธ 6 · ยกเลิก 6 · และจองแทนอีก 5 รายการ',
    })
    expect(decisionsOf({ approve: 1, reject: 0, cancel: 0, directBooking: 0 }).desc).toBe('อนุมัติ 1 · ปฏิเสธ 0 · ยกเลิก 0')
  })
  it('shows — with its reason while the source records no venue changes', () => {
    expect(resourceOf({ resourceChanges: null })).toEqual({ value: '—', desc: RESOURCE_UNRECORDED })
    expect(resourceOf({ resourceChanges: 3 }).value).toBe('3')
    expect(resourceOf({ resourceChanges: 0 }).desc).toBe('ไม่มีการแก้ไขข้อมูลสถานที่ในช่วงนี้')
  })
  it('names the top actor with role, department and share, or shows —', () => {
    expect(topActorOf({ topActor: { actor: active, count: 8, percent: 24.24 } })).toEqual({
      name: 'สมหญิง เรืองศรี',
      badge: '8 รายการ',
      desc: 'เจ้าหน้าที่ดูแลระบบ · ฝ่ายบริหารงานทั่วไป · 24% ของทั้งหมด',
    })
    expect(topActorOf({ topActor: null })).toEqual({ name: '—', badge: null, desc: '' })
  })
})

describe('Hub 5 toolbar helpers', () => {
  it('drops the IP wording from the placeholder when the source records none', () => {
    expect(searchPlaceholder(true)).toContain('IP')
    expect(searchPlaceholder(false)).not.toContain('IP')
  })
  it('knows when a filter narrows the list', () => {
    expect(filtersActive({ q: '  ', action: '', actorId: '' })).toBe(false)
    expect(filtersActive({ q: 'x', action: '', actorId: '' })).toBe(true)
    expect(filtersActive({ q: '', action: 'APPROVE', actorId: '' })).toBe(true)
    expect(filtersActive({ q: '', action: '', actorId: 'u1' })).toBe(true)
  })
  it('names the range the filter miss happened in', () => {
    expect(noMatchDesc('7 วันล่าสุด')).toContain('ใน7 วันล่าสุดที่ตรงกับ')
  })
})

describe('Hub 5 dialog helpers', () => {
  it('marks changed rows and returns null when the source has no before/after', () => {
    expect(diffRowsOf(null)).toBeNull()
    expect(diffRowsOf([])).toBeNull()
    expect(
      diffRowsOf([
        { field: 'สถานะ', before: 'รอพิจารณา', after: 'อนุมัติแล้ว' },
        { field: 'สถานที่', before: 'ก', after: 'ก' },
      ]),
    ).toEqual([
      { field: 'สถานะ', before: 'รอพิจารณา', after: 'อนุมัติแล้ว', changed: true },
      { field: 'สถานที่', before: 'ก', after: 'ก', changed: false },
    ])
  })
  it('offers ไปที่หน้า<owner> only when the role can reach the owner route', () => {
    const e = { target: { kind: 'STAFF_ACCOUNT' } } as Pick<AuditEvent, 'target'>
    expect(gotoOf(e, (l) => canReach('SUPER_ADMIN', l))).toEqual({ label: 'ไปที่หน้าเจ้าหน้าที่ระบบ', owner: 'เจ้าหน้าที่ระบบ' })
    const venue = { target: { kind: 'VENUE' } } as Pick<AuditEvent, 'target'>
    expect(gotoOf(venue, () => false)).toBeNull()
  })
})

describe('Hub 6 availability (D-23, AC-D6)', () => {
  const base = { failed: 22, requests: 61050, daysWithoutData: 0, targetPercent: 99.5 }
  it('judges the number that is printed: ปกติ from 99.9, เฝ้าระวัง from 99.5, else ต่ำกว่าเป้า', () => {
    expect(availabilityBadge(99.96).text).toBe('ปกติ')
    expect(availabilityBadge(99.9).text).toBe('ปกติ')
    expect(availabilityBadge(99.896).text).toBe('ปกติ') // prints as 99.90
    expect(availabilityBadge(99.89).text).toBe('เฝ้าระวัง')
    expect(availabilityBadge(99.5).text).toBe('เฝ้าระวัง')
    expect(availabilityBadge(99.494).text).toBe('ต่ำกว่าเป้า')
    expect(availabilityBadge(99.9).cls).toBe('badge-success')
    expect(availabilityBadge(99.6).cls).toBe('badge-warning')
    expect(availabilityBadge(90).cls).toBe('badge-error')
  })
  it('prints 2 dp with the counts and the target', () => {
    expect(availabilityOf({ ...base, percent: 99.96396 })).toEqual({
      value: '99.96%',
      badge: { text: 'ปกติ', cls: 'badge-success' },
      desc: 'คำขอล้มเหลว (5xx) 22 จาก 61,050 คำขอ · เป้าหมาย 99.5%',
    })
  })
  it('is — with no badge when no request was counted, never 100% or 0%', () => {
    const v = availabilityOf({ percent: null, failed: 0, requests: 0, daysWithoutData: 3, targetPercent: 99.5 })
    expect(v.value).toBe('—')
    expect(v.badge).toBeNull()
    expect(v.desc).toContain('ไม่มีข้อมูล 3 วัน')
  })
  it('reports days without counter data', () => {
    expect(availabilityOf({ ...base, percent: 99.9, daysWithoutData: 2 }).desc).toMatch(/ไม่มีข้อมูล 2 วัน$/)
  })
})

describe('Hub 6 KPI sentences', () => {
  it('the rolling 24 h card carries the range count as context', () => {
    expect(last24hDesc({ inRange: 28 })).toBe('นับย้อนหลัง 24 ชั่วโมงจากตอนนี้ · ทั้งช่วงที่เลือก 28 รายการ')
  })
  it('critical: none, or the latest instant in Bangkok time', () => {
    expect(criticalDesc({ count: 0, latestAt: null })).toBe('ไม่มีข้อผิดพลาดระดับวิกฤตในช่วงนี้')
    expect(criticalDesc({ count: 2, latestAt: '2026-09-30T16:30:00.000Z' })).toBe(
      'ฐานข้อมูลเชื่อมต่อไม่ได้หรือเกิด deadlock · ล่าสุด 30 ก.ย. 2569 23.30 น.',
    )
  })
  it('sums and itemises the external integrations', () => {
    expect(externalOf({ lineOa: 8, cloudflareR2: 10, redis: 4 })).toEqual({
      count: 22,
      desc: 'LINE OA 8 · Cloudflare R2 10 · Redis 4',
    })
  })
  it('states the retention', () => {
    expect(retentionNote({ maxEntries: 5000, maxDays: 90 })).toBe('เก็บย้อนหลังสูงสุด 90 วัน หรือ 5,000 รายการ')
  })
})

describe('Hub 6 rows', () => {
  it('colours status by class and names a response-less incident SYS', () => {
    expect(statusClass(500)).toBe('text-error')
    expect(statusClass(503)).toBe('text-error')
    expect(statusClass(404)).toBe('text-warning')
    expect(statusClass(200)).toBe('text-base-content')
    expect(statusClass(null)).toBe('text-base-content')
    expect(statusLabel(null)).toBe('SYS')
    expect(statusLabel(504)).toBe('504')
  })
  it('falls back from path to route template to a dash', () => {
    expect(pathOf({ path: '/a/1', routeTemplate: '/a/:id' })).toBe('/a/1')
    expect(pathOf({ path: null, routeTemplate: '/a/:id' })).toBe('/a/:id')
    expect(pathOf({ path: null, routeTemplate: null })).toBe('—')
  })
  it('builds the view button label without double spaces for a method-less incident', () => {
    const i = { id: 'ERR-SYS-0003', status: null, method: null, path: null, routeTemplate: null } as never
    expect(viewLabel(i)).toBe('ดูรายละเอียด ERR-SYS-0003 SYS —')
  })
})

describe('Hub 6 purge (D-24)', () => {
  it('is disabled with its reason when nothing is older than 30 days', () => {
    expect(purgeOf({ count: 0, cutoffDate: '2026-09-04' })).toMatchObject({
      disabled: true,
      title: 'ไม่มีบันทึกที่เก่ากว่า 30 วัน',
    })
  })
  it('names the count and the cut-off date in the confirmation', () => {
    const v = purgeOf({ count: 27, cutoffDate: '2026-09-04' })
    expect(v.disabled).toBe(false)
    expect(v.who).toBe('บันทึกข้อผิดพลาดเก่า 27 รายการ')
    expect(v.description).toContain('4 ก.ย. 2569')
  })
})

describe('contextOf (the inspector, AC-D9)', () => {
  const d = (over: Partial<IncidentDetail>) =>
    ({ context: {}, errorCode: null, queryKeys: [], ...over }) as Pick<IncidentDetail, 'context' | 'errorCode' | 'queryKeys'>
  it('is null when there is nothing to show', () => {
    expect(contextOf(d({}))).toBeNull()
    expect(contextOf(d({ context: { params: {} } }))).toBeNull()
  })
  it('shows the whitelisted keys, the error code and the query KEYS', () => {
    const s = contextOf(d({ errorCode: 'P2034', queryKeys: ['venueId'], context: { attempt: 2, params: { id: 'br42' } } }))
    expect(JSON.parse(s!)).toEqual({ errorCode: 'P2034', queryKeys: ['venueId'], attempt: 2, params: { id: 'br42' } })
  })
})
