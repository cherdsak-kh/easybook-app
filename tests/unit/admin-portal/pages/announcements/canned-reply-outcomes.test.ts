import { SAVE_INVALID, WRITE_FAIL } from '@/admin-portal/pages/announcements/announcement-outcomes'
import type { WriteFailure } from '@/admin-portal/pages/announcements/announcements-api'
import type { CannedReply } from '@/admin-portal/pages/announcements/canned-replies-api'
import {
  applyChange,
  CANNED_DELETED_ALREADY,
  CANNED_FIELD_ERR,
  CANNED_LIMIT,
  CANNED_NOT_FOUND,
  CANNED_REPLIES_MAX,
  cannedDeleteOutcome,
  cannedSaveOutcome,
  createdToast,
  firstInvalidCanned,
  isUnchanged,
  removedToast,
  toInput,
  updatedToast,
  validateCanned,
  valuesOf,
} from '@/admin-portal/pages/announcements/canned-reply-outcomes'

/**
 * ANNOUNCE-UI-6 design §2.2 — the canned-reply writes as return values. The card and the modal only
 * apply these, so this is where the D-4 outcome map is pinned.
 */

const fail = (status: number, p: Partial<WriteFailure> = {}): WriteFailure => ({ ok: false, status, ...p })

const row = (id: string, title: string, sortOrder: number): CannedReply => ({
  id,
  title,
  text: `${title} — ข้อความ`,
  sortOrder,
  createdAt: '2026-09-22T08:00:00.000Z',
  updatedAt: '2026-09-22T08:00:00.000Z',
})

const A = row('canned_reply_default_1', 'แจ้งวิธีจองสถานที่', 0)
const B = row('canned_reply_default_2', 'แจ้งเงื่อนไขการยกเลิก', 1)
const C = row('canned_reply_default_3', 'แจ้งสถานะคำขอรออนุมัติ', 2)

describe('limits and copy', () => {
  it('mirror the server: 5 rows, and the limit text byte-equal to its Thai message', () => {
    expect(CANNED_REPLIES_MAX).toBe(5)
    expect(CANNED_LIMIT).toBe('ข้อความตอบกลับด่วนสามารถมีได้สูงสุดไม่เกิน 5 ข้อความ')
  })

  it('the three success toasts name the title', () => {
    expect(createdToast('ก')).toBe("เพิ่มข้อความ 'ก' แล้ว")
    expect(updatedToast('ก')).toBe("บันทึกข้อความ 'ก' แล้ว")
    expect(removedToast('ก')).toBe("ลบข้อความ 'ก' แล้ว")
  })
})

describe('validateCanned / firstInvalidCanned', () => {
  it.each([
    ['blank', { title: '', text: '' }],
    ['spaces only', { title: '   ', text: ' \n\t ' }],
  ])('%s fields are both refused, title first', (_label, v) => {
    const errs = validateCanned(v)
    expect(errs).toEqual({ title: CANNED_FIELD_ERR.title, text: CANNED_FIELD_ERR.text })
    expect(firstInvalidCanned(errs)).toBe('title')
    expect(CANNED_FIELD_ERR).toEqual({ title: 'กรุณากรอกหัวข้อ', text: 'กรุณากรอกข้อความ' })
  })

  it('only the empty field is refused; a valid pair passes', () => {
    expect(validateCanned({ title: 'หัวข้อ', text: ' ' })).toEqual({ text: CANNED_FIELD_ERR.text })
    expect(firstInvalidCanned({ text: CANNED_FIELD_ERR.text })).toBe('text')
    expect(validateCanned({ title: 'หัวข้อ', text: 'ข้อความ' })).toEqual({})
    expect(firstInvalidCanned({})).toBeNull()
  })
})

describe('the payload and the unchanged check', () => {
  it('trims both fields and never sends sortOrder', () => {
    expect(toInput({ title: '  หัวข้อ ', text: '\nข้อความ  ' })).toEqual({ title: 'หัวข้อ', text: 'ข้อความ' })
  })

  it('surrounding spaces do not count as a change (no PATCH)', () => {
    expect(isUnchanged({ title: ` ${A.title} `, text: `${A.text}\n` }, A)).toBe(true)
    expect(isUnchanged({ title: A.title, text: `${A.text}!` }, A)).toBe(false)
  })

  it('prefills from the row, or blank for a create', () => {
    expect(valuesOf(A)).toEqual({ title: A.title, text: A.text })
    expect(valuesOf(null)).toEqual({ title: '', text: '' })
  })
})

describe('applyChange', () => {
  it('created appends at the end — where the server put it', () => {
    const D = row('cmfcan100x7k2q9w4e1r5t8y0', 'ใหม่', 3)
    expect(applyChange([A, B, C], { kind: 'created', row: D }).map((r) => r.id)).toEqual([A.id, B.id, C.id, D.id])
  })

  it('created never duplicates a row a reconciling GET already brought', () => {
    expect(applyChange([A, B], { kind: 'created', row: B })).toEqual([A, B])
  })

  it('updated replaces by id at the SAME index', () => {
    const B2 = { ...B, title: 'แก้แล้ว' }
    expect(applyChange([A, B, C], { kind: 'updated', row: B2 })).toEqual([A, B2, C])
  })

  it('removed filters by id; none changes nothing', () => {
    expect(applyChange([A, B, C], { kind: 'removed', id: B.id })).toEqual([A, C])
    expect(applyChange([A, B], { kind: 'none' })).toEqual([A, B])
  })
})

describe('cannedSaveOutcome (POST / PATCH)', () => {
  it('the coded limit stays open with the limit alert AND re-reads the list behind', () => {
    expect(cannedSaveOutcome(fail(400, { code: 'CANNED_REPLIES_LIMIT_EXCEEDED' }))).toEqual({
      kind: 'stay',
      alert: CANNED_LIMIT,
      reconcile: true,
    })
  })

  it.each([
    ['a code-less pipe 400 (never read as the limit)', fail(400)],
    ['CANNED_REPLY_UPDATE_EMPTY', fail(400, { code: 'CANNED_REPLY_UPDATE_EMPTY' })],
    ['an unknown 400 code', fail(400, { code: 'SOMETHING_NEW' })],
  ])('%s is the invalid-data alert, no re-read', (_label, f) => {
    expect(cannedSaveOutcome(f)).toEqual({ kind: 'stay', alert: SAVE_INVALID, reconcile: false })
  })

  it.each([
    ['CANNED_REPLY_NOT_FOUND', fail(404, { code: 'CANNED_REPLY_NOT_FOUND' })],
    ['no code', fail(404)],
  ])('404 (%s) closes with the not-found ERROR toast', (_label, f) => {
    expect(cannedSaveOutcome(f)).toEqual({ kind: 'gone', toast: { kind: 'error', text: CANNED_NOT_FOUND } })
    expect(CANNED_NOT_FOUND).toBe('ไม่พบข้อความนี้ อาจถูกลบไปแล้ว')
  })

  it('403 / 503 / 0 stay open with the house copy; anything else falls back to 503', () => {
    for (const s of [403, 503, 0]) {
      expect(cannedSaveOutcome(fail(s))).toEqual({ kind: 'stay', alert: WRITE_FAIL[s], reconcile: false })
    }
    expect(cannedSaveOutcome(fail(500))).toEqual({ kind: 'stay', alert: WRITE_FAIL[503], reconcile: false })
  })

  it('401 does nothing — the session dialog owns it', () => {
    expect(cannedSaveOutcome(fail(401))).toEqual({ kind: 'none' })
  })
})

describe('cannedDeleteOutcome (DELETE)', () => {
  it.each([
    ['CANNED_REPLY_NOT_FOUND', fail(404, { code: 'CANNED_REPLY_NOT_FOUND' })],
    ['no code', fail(404)],
  ])('404 (%s) is gone: an INFO toast — the goal is met', (_label, f) => {
    expect(cannedDeleteOutcome(f)).toEqual({ kind: 'gone', toast: { kind: 'info', text: CANNED_DELETED_ALREADY } })
    expect(CANNED_DELETED_ALREADY).toBe('ข้อความนี้ถูกลบไปแล้ว')
  })

  it('403 / 503 / 0 keep the item with an ERROR toast of the house copy', () => {
    for (const s of [403, 503, 0]) {
      expect(cannedDeleteOutcome(fail(s))).toEqual({ kind: 'kept', toast: { kind: 'error', text: WRITE_FAIL[s] } })
    }
  })

  it('401 closes quietly', () => {
    expect(cannedDeleteOutcome(fail(401))).toEqual({ kind: 'none' })
  })
})
