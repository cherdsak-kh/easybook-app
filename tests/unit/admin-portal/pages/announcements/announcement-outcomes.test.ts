import { FIELD_ERR } from '@/admin-portal/pages/announcements/announcement-form'
import {
  afterReread,
  ALREADY_SENT,
  DELETE_IN_PROGRESS,
  DELETED_ALREADY,
  deletedToast,
  deleteOutcome,
  NOT_FOUND,
  partialText,
  SAVE_INVALID,
  SAVED_PREFIX,
  saveOutcome,
  SEND_TEXT,
  sendOutcome,
  SENT_DELETED_ALREADY,
  SENT_ELSEWHERE,
  SENT_ELSEWHERE_ALERT,
  sentToast,
  WRITE_FAIL,
} from '@/admin-portal/pages/announcements/announcement-outcomes'
import type { Announcement, WriteFailure } from '@/admin-portal/pages/announcements/announcements-api'

/**
 * Every row of plan D-3 / D-4 (design §3) as a return value. The dialog only applies these, so this
 * is where the error map is pinned.
 */

const fail = (status: number, p: Partial<WriteFailure> = {}): WriteFailure => ({ ok: false, status, ...p })

const rec: Announcement = {
  id: 'cmfann015x7k2q9w4e1r5t8y0',
  title: 'หัวข้อ',
  body: 'เนื้อหา',
  format: 'TEXT',
  status: 'DRAFT',
  audience: 'ALL',
  department: null,
  sentAt: null,
  sentCount: 0,
  createdBy: null,
  createdAt: '2026-09-21T03:00:00.000Z',
  updatedAt: '2026-09-21T03:05:00.000Z',
}

describe('sendOutcome — coded answers', () => {
  it.each([
    ['ANNOUNCEMENT_SEND_IN_PROGRESS', 409, SEND_TEXT.inProgress],
    ['LINE_SEND_FAILED', 502, SEND_TEXT.lineFailed],
    ['LINE_NOT_CONFIGURED', 503, SEND_TEXT.notConfigured],
    ['LINE_RATE_LIMITED', 503, SEND_TEXT.rateLimited],
  ])('%s stays open with its error alert', (code, status, text) => {
    expect(sendOutcome(fail(status, { code }), false)).toEqual({
      kind: 'alert',
      alert: { tone: 'error', text },
    })
  })

  it('LINE_SEND_FAILED never claims the announcement did not reach anyone (main-thread ruling F-1)', () => {
    expect(SEND_TEXT.lineFailed).not.toContain('ยังไม่ได้ส่งถึงผู้รับ')
    expect(SEND_TEXT.lineFailed).toContain('ประกาศยังเป็นฉบับร่าง')
  })

  it('prefixes the inline text when this attempt saved the draft first (plan D-2)', () => {
    const o = sendOutcome(fail(502, { code: 'LINE_SEND_FAILED' }), true)
    expect(o).toEqual({ kind: 'alert', alert: { tone: 'error', text: `${SAVED_PREFIX}${SEND_TEXT.lineFailed}` } })
  })

  it('BODY_REQUIRED and DEPARTMENT_INVALID are field errors; only the department re-reads its list', () => {
    expect(sendOutcome(fail(400, { code: 'ANNOUNCEMENT_BODY_REQUIRED' }), false)).toEqual({
      kind: 'field',
      field: 'body',
      text: FIELD_ERR.bodyRequired,
      refetchDepts: false,
      alert: null,
    })
    const dept = sendOutcome(fail(400, { code: 'ANNOUNCEMENT_DEPARTMENT_INVALID' }), true)
    expect(dept).toMatchObject({ kind: 'field', field: 'departmentId', refetchDepts: true })
    // With the prefix, the saved state is also stated in the alert region.
    expect(dept).toMatchObject({ alert: { text: `${SAVED_PREFIX}${FIELD_ERR.departmentInvalid}` } })
  })

  it('404 closes with the not-found toast', () => {
    expect(sendOutcome(fail(404, { code: 'ANNOUNCEMENT_NOT_FOUND' }), false)).toEqual({
      kind: 'close',
      toast: { kind: 'error', text: NOT_FOUND },
    })
    expect(sendOutcome(fail(404), false)).toMatchObject({ kind: 'close' })
  })

  it('ALREADY_SENT and PARTIALLY_SENT re-read, unprefixed — the record is SENT by then', () => {
    expect(sendOutcome(fail(409, { code: 'ANNOUNCEMENT_ALREADY_SENT' }), true)).toEqual({
      kind: 'reread',
      reason: 'already-sent',
      alert: { tone: 'info', text: ALREADY_SENT },
    })
    const partial = sendOutcome(
      fail(502, { code: 'ANNOUNCEMENT_PARTIALLY_SENT', acceptedCount: 500, targetedCount: 734 }),
      true,
    )
    expect(partial).toEqual({
      kind: 'reread',
      reason: 'partial',
      alert: { tone: 'warn', text: partialText(500, 734) },
      acceptedCount: 500,
    })
    expect(partialText(500, 734)).toContain('500 จาก 734 คน')
    expect(partialText(undefined, 1248)).toContain('— จาก 1,248 คน')
  })
})

describe('sendOutcome — no code, or an unknown one', () => {
  it('the session store 503 never mentions LINE', () => {
    const o = sendOutcome(fail(503), false)
    expect(o).toEqual({ kind: 'alert', alert: { tone: 'error', text: SEND_TEXT.noCode } })
    expect(SEND_TEXT.noCode).not.toContain('LINE')
  })

  it('a 403 that survived the CSRF retry is the house copy', () => {
    expect(sendOutcome(fail(403), false)).toEqual({ kind: 'alert', alert: { tone: 'error', text: SEND_TEXT.csrf } })
  })

  it('401 does nothing inline — the session dialog owns it', () => {
    expect(sendOutcome(fail(401), true)).toEqual({ kind: 'none' })
  })

  it.each([
    ['a dropped socket', fail(0)],
    ['a 500', fail(500)],
    ['a future 502 code', fail(502, { code: 'SOMETHING_NEW' })],
    ['an unknown code on a 503', fail(503, { code: 'LINE_BOT_INFO_UNAVAILABLE' })],
  ])('%s is UNKNOWN, re-read, and never says ยังไม่ได้ส่ง', (_label, f) => {
    const o = sendOutcome(f, false)
    expect(o).toEqual({ kind: 'reread', reason: 'unknown', alert: { tone: 'error', text: SEND_TEXT.unknown } })
    expect(SEND_TEXT.unknown).not.toContain('ยังไม่ได้ส่ง')
  })
})

describe('saveOutcome', () => {
  it.each([
    'departmentId is required when audience is DEPARTMENT.',
    'departmentId must be null when audience is ALL.',
    'The selected department does not exist or is not available.',
  ])('the phase-1 department 400 "%s" is a department field error', (message) => {
    expect(saveOutcome(fail(400, { message }), 'patch')).toEqual({
      kind: 'field',
      field: 'departmentId',
      text: FIELD_ERR.departmentInvalid,
      refetchDepts: true,
      alert: null,
    })
  })

  it('any other 400 is the invalid-data alert', () => {
    expect(saveOutcome(fail(400), 'create')).toEqual({ kind: 'alert', alert: { tone: 'error', text: SAVE_INVALID } })
    expect(saveOutcome(fail(400, { message: 'Provide at least one field to update.' }), 'patch')).toMatchObject({
      alert: { text: SAVE_INVALID },
    })
  })

  it('PATCH 404 closes; PATCH 409 re-reads with the sent-elsewhere warning', () => {
    expect(saveOutcome(fail(404), 'patch')).toEqual({ kind: 'close', toast: { kind: 'error', text: NOT_FOUND } })
    expect(saveOutcome(fail(409), 'patch')).toEqual({
      kind: 'reread',
      reason: 'immutable',
      alert: { tone: 'warn', text: SENT_ELSEWHERE_ALERT },
    })
  })

  it('403 / 503 / 0 are the house WRITE_FAIL copies; anything else falls back to 503', () => {
    for (const s of [403, 503, 0]) {
      expect(saveOutcome(fail(s), 'create')).toEqual({ kind: 'alert', alert: { tone: 'error', text: WRITE_FAIL[s] } })
    }
    expect(saveOutcome(fail(500), 'patch')).toMatchObject({ alert: { text: WRITE_FAIL[503] } })
    expect(saveOutcome(fail(401), 'patch')).toEqual({ kind: 'none' })
  })
})

describe('deleteOutcome (ANNOUNCE-UI-6 D-1: DRAFT and SENT are both deletable)', () => {
  it.each([
    ['no code', fail(404)],
    ['ANNOUNCEMENT_NOT_FOUND', fail(404, { code: 'ANNOUNCEMENT_NOT_FOUND' })],
  ])('404 (%s) is an INFO toast worded by the record status — the goal is already met', (_label, f) => {
    expect(deleteOutcome(f, 'DRAFT')).toEqual({ kind: 'close', toast: { kind: 'info', text: DELETED_ALREADY } })
    expect(deleteOutcome(f, 'SENT')).toEqual({ kind: 'close', toast: { kind: 'info', text: SENT_DELETED_ALREADY } })
    expect(SENT_DELETED_ALREADY).toBe('ประกาศนี้ถูกลบไปแล้ว')
  })

  it.each([
    ['ANNOUNCEMENT_SEND_IN_PROGRESS', fail(409, { code: 'ANNOUNCEMENT_SEND_IN_PROGRESS' })],
    ['no code', fail(409)],
  ])('ANY 409 (%s) is the in-progress alert, with NO re-read', (_label, f) => {
    for (const status of ['DRAFT', 'SENT'] as const) {
      const o = deleteOutcome(f, status)
      expect(o).toEqual({ kind: 'alert', alert: { tone: 'error', text: DELETE_IN_PROGRESS } })
      expect(o.kind).not.toBe('reread')
    }
    expect(DELETE_IN_PROGRESS).toBe('ประกาศนี้กำลังถูกส่งอยู่ ยังไม่ได้ลบ รอสักครู่แล้วลองใหม่')
  })

  it('403 / 503 / 0 are the house WRITE_FAIL copies; 401 does nothing inline', () => {
    for (const s of [403, 503, 0]) {
      expect(deleteOutcome(fail(s), 'SENT')).toEqual({ kind: 'alert', alert: { tone: 'error', text: WRITE_FAIL[s] } })
    }
    expect(deleteOutcome(fail(401), 'SENT')).toEqual({ kind: 'none' })
  })
})

describe('SENT_ELSEWHERE (PATCH only since ANNOUNCE-API-5)', () => {
  it('no longer claims the row cannot be deleted', () => {
    expect(SENT_ELSEWHERE).toBe('ประกาศนี้ถูกส่งไปแล้วโดยผู้ใช้อื่น จึงแก้ไขไม่ได้')
    expect(SENT_ELSEWHERE).not.toContain('หรือลบ')
    expect(SENT_ELSEWHERE_ALERT.endsWith(' · การแก้ไขของคุณยังไม่ได้บันทึก')).toBe(true)
  })
})

describe('afterReread', () => {
  const sent = { ...rec, status: 'SENT' as const, sentCount: 1248, sentAt: '2026-09-22T07:00:00.000Z' }

  it('a SENT record switches to view; a DRAFT stays and replaces the snapshot', () => {
    expect(afterReread('unknown', { ok: true, value: sent }, rec)).toEqual({ kind: 'view', record: sent })
    expect(afterReread('unknown', { ok: true, value: rec }, rec)).toEqual({ kind: 'stay', record: rec })
  })

  it('partial falls back to a LOCAL view as SENT with the accepted count — never a resend', () => {
    const s = afterReread('partial', fail(0), rec, 500)
    expect(s).toEqual({ kind: 'view', record: { ...rec, status: 'SENT', sentCount: 500, sentAt: null } })
  })

  it('404 closes with not-found; other failures close or stay by reason (A-11, A-12)', () => {
    expect(afterReread('already-sent', fail(404), rec)).toEqual({ kind: 'close', toast: { kind: 'error', text: NOT_FOUND } })
    expect(afterReread('already-sent', fail(503), rec)).toEqual({ kind: 'close', toast: { kind: 'info', text: ALREADY_SENT } })
    expect(afterReread('immutable', fail(0), rec)).toEqual({ kind: 'close', toast: { kind: 'error', text: SENT_ELSEWHERE } })
    expect(afterReread('unknown', fail(0), rec)).toEqual({ kind: 'stay', record: null })
  })
})

describe('toasts', () => {
  it('the send toast quotes the response sentCount in th-TH', () => {
    expect(sentToast('ปิดหอประชุม', 1248)).toBe("ส่งประกาศ 'ปิดหอประชุม' ถึง 1,248 คนแล้ว")
  })

  it('zero recipients is still a success, worded without a count (ANNOUNCE-UI-6 D-2)', () => {
    expect(sentToast('ปิดหอประชุม', 0)).toBe("ส่งประกาศ 'ปิดหอประชุม' แล้ว (ไม่มีผู้รับที่เปิดรับการแจ้งเตือน)")
  })

  it('the delete toast follows the record status', () => {
    expect(deletedToast('ปิดหอประชุม', 'DRAFT')).toBe("ลบฉบับร่าง 'ปิดหอประชุม' แล้ว")
    expect(deletedToast('ปิดหอประชุม', 'SENT')).toBe("ลบประกาศ 'ปิดหอประชุม' แล้ว")
  })
})
