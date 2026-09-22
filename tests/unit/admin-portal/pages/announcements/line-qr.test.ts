import {
  addFriendUrl,
  cleanId,
  hasQrId,
  QR_SIZE,
  qrFileName,
} from '@/admin-portal/pages/announcements/line-qr'

/**
 * LINE-OA-QR-1 design §3 — the add-friend URL and the PNG name as return values. The modal only
 * renders these, so this is where AC-5's exact string and AC-9's `cleanId` rules are pinned.
 */

describe('addFriendUrl', () => {
  it('builds LINE’s documented percent-encoded form, byte for byte (AC-5)', () => {
    expect(addFriendUrl('@easybook')).toBe('https://line.me/R/ti/p/%40easybook')
  })

  it('encodes exactly once — no %2540, no literal @, no trailing slash', () => {
    const url = addFriendUrl('@easybook')
    expect(url).not.toContain('%2540')
    expect(url).not.toContain('@')
    expect(url.endsWith('/')).toBe(false)
  })

  it('leaves an id without @ as it is', () => {
    expect(addFriendUrl('easybook')).toBe('https://line.me/R/ti/p/easybook')
  })

  it('trims before encoding, so a stray space never becomes %20', () => {
    expect(addFriendUrl(' @easybook ')).toBe('https://line.me/R/ti/p/%40easybook')
  })
})

describe('cleanId', () => {
  it('strips the leading @', () => {
    expect(cleanId('@easybook')).toBe('easybook')
  })

  it('strips only ONE @', () => {
    expect(cleanId('@@x')).toBe('_x')
  })

  it('maps every character outside [A-Za-z0-9._-] to _', () => {
    expect(cleanId('@a/b c')).toBe('a_b_c')
  })

  it('keeps dots, underscores, hyphens and digits', () => {
    expect(cleanId('@a.b_c-1')).toBe('a.b_c-1')
  })
})

describe('qrFileName', () => {
  it('is LINE_OA_{cleanId}_QR.png (AC-9)', () => {
    expect(qrFileName('@easybook')).toBe('LINE_OA_easybook_QR.png')
  })
})

describe('hasQrId', () => {
  it.each(['', '  ', '@'])('is false for %j — no pill, no dialog (D-5)', (id) => {
    expect(hasQrId(id)).toBe(false)
  })

  it('is true for a real id', () => {
    expect(hasQrId('@easybook')).toBe(true)
  })
})

describe('QR_SIZE', () => {
  it('is the 220px the design measured the dialog against (AC-6, AC-13)', () => {
    expect(QR_SIZE).toBe(220)
  })
})
