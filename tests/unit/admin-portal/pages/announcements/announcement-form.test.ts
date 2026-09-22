import {
  altTextOf,
  cardTime,
  FIELD_ERR,
  firstInvalid,
  fromRecord,
  isDirty,
  previewText,
  toPayload,
  validate,
  type FormValues,
} from '@/admin-portal/pages/announcements/announcement-form'
import type { Announcement } from '@/admin-portal/pages/announcements/announcements-api'

/**
 * The compose dialog's form model — defaults, the payload the server gets, the dirty check that
 * protects the send's retry keys, validation, and the preview's server-mirrored strings. Pure
 * functions, which is the kind of unit the test policy asks for.
 */

const draft = (p: Partial<Announcement> = {}): Announcement => ({
  id: 'cmfann015x7k2q9w4e1r5t8y0',
  title: 'กำหนดการสอบปลายภาค',
  body: 'รายละเอียด',
  format: 'TEXT',
  status: 'DRAFT',
  audience: 'ALL',
  department: null,
  sentAt: null,
  sentCount: 0,
  createdBy: { id: 'u1', firstName: 'ผู้ทดสอบ', lastName: 'ระบบ' },
  createdAt: '2026-09-21T03:00:00.000Z',
  updatedAt: '2026-09-21T03:05:00.000Z',
  ...p,
})

const values = (p: Partial<FormValues> = {}): FormValues => ({ ...fromRecord(null), ...p })

describe('fromRecord', () => {
  it('gives the create defaults for null (plan D-2)', () => {
    expect(fromRecord(null)).toEqual({
      title: '',
      body: '',
      format: 'TEXT',
      audience: 'ALL',
      departmentId: null,
    })
  })

  it('reads a DEPARTMENT record, and a hard-deleted department as null', () => {
    expect(fromRecord(draft({ audience: 'DEPARTMENT', department: { id: 2, name: 'ก' } })).departmentId).toBe(2)
    expect(fromRecord(draft({ audience: 'DEPARTMENT', department: null })).departmentId).toBeNull()
  })
})

describe('toPayload', () => {
  it('trims both fields and always sends all five keys', () => {
    expect(toPayload(values({ title: '  หัวข้อ ', body: '\n เนื้อหา \n' }))).toEqual({
      title: 'หัวข้อ',
      body: 'เนื้อหา',
      format: 'TEXT',
      audience: 'ALL',
      departmentId: null,
    })
  })

  it('nulls a department kept in local state when the audience is ALL', () => {
    expect(toPayload(values({ audience: 'ALL', departmentId: 3 })).departmentId).toBeNull()
    expect(toPayload(values({ audience: 'DEPARTMENT', departmentId: 3 })).departmentId).toBe(3)
  })
})

describe('isDirty', () => {
  it('is always dirty before anything was saved', () => {
    expect(isDirty(values(), null)).toBe(true)
  })

  it('is clean for an untouched record, and for whitespace the server would trim away', () => {
    const r = draft()
    expect(isDirty(fromRecord(r), r)).toBe(false)
    expect(isDirty({ ...fromRecord(r), title: `  ${r.title}  ` }, r)).toBe(false)
  })

  it('sees each field change', () => {
    const r = draft({ audience: 'DEPARTMENT', department: { id: 1, name: 'ก' } })
    const f = fromRecord(r)
    expect(isDirty({ ...f, title: 'อื่น' }, r)).toBe(true)
    expect(isDirty({ ...f, body: '' }, r)).toBe(true)
    expect(isDirty({ ...f, format: 'FLEX' }, r)).toBe(true)
    expect(isDirty({ ...f, departmentId: 2 }, r)).toBe(true)
    expect(isDirty({ ...f, audience: 'ALL' }, r)).toBe(true)
  })

  it('ignores a department held in local state while the audience is ALL', () => {
    const r = draft()
    expect(isDirty({ ...fromRecord(r), departmentId: 7 }, r)).toBe(false)
  })
})

describe('validate', () => {
  it('passes a titled ALL draft with an empty body for save, and blocks it for send', () => {
    const f = values({ title: 'หัวข้อ' })
    expect(validate(f, 'save', false)).toEqual({})
    expect(validate(f, 'send', false)).toEqual({ body: FIELD_ERR.bodyRequired })
  })

  it('reports every failing field at once, in DOM order for focus', () => {
    const errs = validate(values({ title: '   ', audience: 'DEPARTMENT' }), 'send', false)
    expect(errs).toEqual({
      title: FIELD_ERR.titleRequired,
      departmentId: FIELD_ERR.departmentRequired,
      body: FIELD_ERR.bodyRequired,
    })
    expect(firstInvalid(errs)).toBe('title')
    expect(firstInvalid({ body: 'x', departmentId: 'y' })).toBe('departmentId')
    expect(firstInvalid({})).toBeNull()
  })

  it('refuses an unavailable department only when the audience is DEPARTMENT', () => {
    const f = values({ title: 'ก', body: 'ข', audience: 'DEPARTMENT', departmentId: 9 })
    expect(validate(f, 'save', true)).toEqual({ departmentId: FIELD_ERR.departmentInvalid })
    expect(validate({ ...f, audience: 'ALL' }, 'save', true)).toEqual({})
  })
})

describe('the preview mirrors the server', () => {
  it('TEXT is title, a blank line, body — of the trimmed values, spaces kept inside', () => {
    expect(previewText({ title: ' A  B ', body: 'x\n\n  y ' })).toBe('A  B\n\nx\n\n  y')
  })

  it('altText collapses every run of • and whitespace to one space', () => {
    expect(altTextOf('ปิด•ปรับปรุง  หอประชุม')).toBe('ประกาศ: ปิด ปรับปรุง หอประชุม')
    expect(altTextOf('')).toBe('ประกาศ:')
  })

  it('the card time is `d MMM 25xx HH:MM น.`, from sentAt when there is one', () => {
    const now = new Date(2026, 8, 22, 14, 5)
    expect(cardTime(null, now)).toBe('22 ก.ย. 2569 14:05 น.')
    expect(cardTime(null, now)).toMatch(/^\d{1,2} \S+ 25\d\d \d\d:\d\d น\.$/)
    expect(cardTime(new Date(2026, 6, 8, 9, 0).toISOString(), now)).toBe('8 ก.ค. 2569 09:00 น.')
  })
})
