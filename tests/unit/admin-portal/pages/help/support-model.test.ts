import {
  DESCRIPTION_MAX,
  DIAGNOSTICS_MAX,
  DISCORD_INVITE_URL,
  acceptFiles,
  bangkokParts,
  buildDiagnostics,
  buildProbeTiles,
  failureMessage,
  formatSize,
  healthFooter,
  incidentDateLine,
  incidentHeading,
  phoneLine,
  quotaPercent,
  reporterLine,
  validateReport,
  type HealthSnapshot,
  type ProbeState,
} from '@/admin-portal/pages/help/support-model'

/**
 * The pure half of `/backend/help/support`. The properties that matter most here are the ones a
 * browser cannot show: that ADMIN/VIEWER never get a number out of the tile builder (the server
 * sends them none, and the builder must not invent one), and that a refused upload / failed relay
 * maps to the right Thai sentence.
 */

const healthFor = (over: Partial<HealthSnapshot> = {}): HealthSnapshot => ({
  checkedAt: '2026-10-05T15:31:07.000Z',
  overall: 'OK',
  detail: 'SUMMARY',
  services: {
    database: { status: 'UP' },
    line: { status: 'UP' },
    storage: { status: 'UP' },
  },
  telemetry: null,
  apiLatencyMs: 40,
  ...over,
})

const FULL: Partial<HealthSnapshot> = {
  detail: 'FULL',
  telemetry: {
    database: { latencyMs: 12 },
    line: { quotaTotal: 1000, quotaUsed: 150, quotaRemaining: 850, observedAt: null },
    storage: { latencyMs: 84, observedAt: null },
  },
}

const done = (health: HealthSnapshot | null): ProbeState => ({
  phase: 'done',
  health,
  version: { ok: true, value: { version: '1.4.0', build: '5b90ee4', releasedAt: null } },
})

const byKey = (state: ProbeState) => Object.fromEntries(buildProbeTiles(state).map((t) => [t.key, t]))

describe('buildProbeTiles', () => {
  it('shows four "checking" tiles with no detail while loading', () => {
    const tiles = buildProbeTiles({ phase: 'loading' })
    expect(tiles.map((t) => t.key)).toEqual(['db', 'line', 'r2', 'api'])
    for (const t of tiles) {
      expect(t.word).toBe('กำลังตรวจสอบ')
      expect(t.tone).toBe('neutral')
      expect(t.detail).toBeNull()
    }
  })

  it('gives SUPER_ADMIN the DB latency and the LINE quota percentage', () => {
    const t = byKey(done(healthFor(FULL)))
    expect(t.db.detail).toBe('Latency 12 ms')
    expect(t.line.detail).toBe('โควตาคงเหลือ 85%')
  })

  it('never produces a latency or a quota for ADMIN / VIEWER (telemetry is null on the wire)', () => {
    const t = byKey(done(healthFor({ detail: 'SUMMARY', telemetry: null })))
    expect(t.db.detail).toBeNull()
    expect(t.line.detail).toBeNull()
    const text = JSON.stringify(Object.values(t))
    expect(text).not.toMatch(/Latency|โควตา|\bms\b|%/)
  })

  it('omits the quota when the plan is unlimited (quotaTotal null)', () => {
    const t = byKey(
      done(
        healthFor({
          ...FULL,
          telemetry: {
            database: { latencyMs: 12 },
            line: { quotaTotal: null, quotaUsed: null, quotaRemaining: null, observedAt: null },
            storage: { latencyMs: 84, observedAt: null },
          },
        }),
      ),
    )
    expect(t.line.detail).toBeNull()
  })

  it('shows the static storage line only when storage is UP', () => {
    expect(byKey(done(healthFor())).r2.detail).toBe('อัปโหลดและแสดงรูปได้ตามปกติ')
    const down = byKey(
      done(healthFor({ services: { database: { status: 'UP' }, line: { status: 'UP' }, storage: { status: 'DOWN' } } })),
    )
    expect(down.r2.detail).toBeNull()
    expect(down.r2.word).toBe('ขัดข้อง')
    expect(down.r2.tone).toBe('error')
  })

  it('draws NOT_CONFIGURED as neutral, never success', () => {
    const t = byKey(
      done(
        healthFor({
          services: { database: { status: 'UP' }, line: { status: 'NOT_CONFIGURED' }, storage: { status: 'UP' } },
        }),
      ),
    )
    expect(t.line.tone).toBe('neutral')
    expect(t.line.word).toBe('ยังไม่ได้ตั้งค่า')
  })

  it('reads the API tile from /system/version, and survives that call failing', () => {
    expect(byKey(done(healthFor())).api).toMatchObject({
      tone: 'success',
      word: 'ตอบสนองปกติ',
      detail: 'v1.4.0 · build 5b90ee4',
    })
    const noVersion = byKey({ phase: 'done', health: healthFor(), version: { ok: false, reason: 'down' } })
    expect(noVersion.api.tone).toBe('success')
    expect(noVersion.api.detail).toBe('ไม่ทราบเวอร์ชัน')
  })

  it('marks the API tile DOWN and the other three unknown when /system/health failed', () => {
    const t = byKey(done(null))
    expect(t.api).toMatchObject({ tone: 'error', word: 'ขัดข้อง' })
    for (const k of ['db', 'line', 'r2'] as const) {
      expect(t[k]).toMatchObject({ tone: 'neutral', word: 'ไม่ทราบสถานะ', detail: null })
    }
  })
})

describe('quotaPercent', () => {
  it('rounds and clamps, and refuses to divide by nothing', () => {
    expect(quotaPercent(850, 1000)).toBe(85)
    expect(quotaPercent(1, 3)).toBe(33)
    expect(quotaPercent(0, 1000)).toBe(0)
    expect(quotaPercent(2000, 1000)).toBe(100)
    expect(quotaPercent(null, 1000)).toBeNull()
    expect(quotaPercent(10, null)).toBeNull()
    expect(quotaPercent(10, 0)).toBeNull()
  })
})

describe('healthFooter', () => {
  it('has a sentence for loading, healthy, degraded and unreachable', () => {
    expect(healthFooter({ phase: 'loading' })).toBe('กำลังตรวจสอบสถานะระบบ…')
    expect(healthFooter(done(healthFor()))).toMatch(/^ทุกส่วนทำงานปกติ · ตรวจสอบล่าสุด \d+ \S+ 2569 \d\d:\d\d$/)
    expect(healthFooter(done(healthFor({ overall: 'DEGRADED' })))).toMatch(/^ระบบบางส่วนขัดข้อง · ตรวจสอบล่าสุด /)
    expect(healthFooter(done(null))).toMatch(/^ตรวจสอบสถานะระบบไม่สำเร็จ/)
  })
})

describe('validateReport', () => {
  it('requires a non-blank path and description, with the prototype sentences', () => {
    expect(validateReport('  ', '')).toEqual({
      path: 'ระบุหน้าจอหรือเส้นทางที่พบปัญหา',
      description: 'อธิบายอาการที่พบ อย่างน้อยหนึ่งประโยค',
    })
    expect(validateReport('/backend', ' x ')).toEqual({})
  })
})

const file = (name: string, type: string, size = 100) => {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

describe('acceptFiles', () => {
  it('accepts PNG, JPEG and WEBP', () => {
    const { files, error } = acceptFiles([], [file('a.png', 'image/png'), file('b.jpg', 'image/jpeg'), file('c.webp', 'image/webp')])
    expect(files).toHaveLength(3)
    expect(error).toBe('')
  })

  it('refuses a non-image with the prototype message', () => {
    const { files, error } = acceptFiles([], [file('doc.pdf', 'application/pdf')])
    expect(files).toHaveLength(0)
    expect(error).toBe('"doc.pdf" ไม่ใช่ไฟล์ภาพ PNG, JPG หรือ WEBP')
  })

  it('treats 5 MiB as fine and 5 MiB + 1 as too large', () => {
    expect(acceptFiles([], [file('ok.png', 'image/png', 5 * 1024 * 1024)]).files).toHaveLength(1)
    const big = acceptFiles([], [file('big.png', 'image/png', 5 * 1024 * 1024 + 1)])
    expect(big.files).toHaveLength(0)
    expect(big.error).toBe('"big.png" มีขนาดเกิน 5 MB')
  })

  it('refuses a 4th file and keeps the first three', () => {
    const three = [file('1.png', 'image/png'), file('2.png', 'image/png'), file('3.png', 'image/png')]
    const { files, error } = acceptFiles(three, [file('4.png', 'image/png')])
    expect(files).toHaveLength(3)
    expect(error).toBe('แนบได้สูงสุด 3 ภาพ')
  })
})

describe('formatSize', () => {
  it('prints KB with a 1 KB floor and MB to one decimal', () => {
    expect(formatSize(10)).toBe('1 KB')
    expect(formatSize(340 * 1024)).toBe('340 KB')
    expect(formatSize(1.5 * 1048576)).toBe('1.5 MB')
  })
})

describe('buildDiagnostics', () => {
  const base = {
    appVersion: '1.2.1',
    appBuild: 'abc1234',
    server: { version: '1.2.1', build: '5b90ee4' },
    roleLabel: 'ผู้ดูข้อมูล',
    userAgent: 'Mozilla/5.0 test',
    platform: 'Win32',
    width: 390,
    height: 844,
    stamp: '5 ต.ค. 2569 22:31',
  }

  it('carries versions, role, browser, screen and time — and says so when the server is unknown', () => {
    const text = buildDiagnostics(base)
    expect(text).toContain('หน้าเว็บ: 1.2.1 (abc1234)')
    expect(text).toContain('เซิร์ฟเวอร์: 1.2.1 (5b90ee4)')
    expect(text).toContain('บทบาท: ผู้ดูข้อมูล')
    expect(text).toContain('หน้าจอ 390 × 844')
    expect(buildDiagnostics({ ...base, server: null })).toContain('เซิร์ฟเวอร์: ตรวจสอบไม่ได้')
  })

  it('is capped at the server limit even with an enormous user agent', () => {
    expect(buildDiagnostics({ ...base, userAgent: 'x'.repeat(5000) }).length).toBe(DIAGNOSTICS_MAX)
  })
})

describe('failureMessage', () => {
  it('shows the server sentence for a CODED failure, whatever the status', () => {
    expect(failureMessage(429, 'SUPPORT_RATE_LIMITED', 'ส่งแจ้งปัญหาบ่อยเกินไป')).toBe('ส่งแจ้งปัญหาบ่อยเกินไป')
    expect(failureMessage(413, 'SUPPORT_FILE_TOO_LARGE', 'ไฟล์ใหญ่เกินไป')).toBe('ไฟล์ใหญ่เกินไป')
    expect(failureMessage(503, 'SUPPORT_NOT_CONFIGURED', 'ยังไม่พร้อม')).toBe('ยังไม่พร้อม')
  })

  it('falls back by status when there is no code', () => {
    expect(failureMessage(400, undefined, 'Request failed (400)')).toMatch(/^ข้อมูลที่ส่งไม่ถูกต้อง/)
    expect(failureMessage(503, undefined, 'Request failed (503)')).toMatch(/^ระบบไม่พร้อมใช้งานชั่วคราว/)
    expect(failureMessage(500, undefined, 'Request failed (500)')).toMatch(/^ส่งแจ้งปัญหาถึงทีมพัฒนาไม่สำเร็จ/)
    expect(failureMessage(null, undefined, '')).toMatch(/^เชื่อมต่อเซิร์ฟเวอร์ไม่ได้/)
  })

  it('never echoes the English transport message for an uncoded failure', () => {
    expect(failureMessage(502, undefined, 'Request failed (502)')).not.toContain('Request failed')
  })
})

describe('constants', () => {
  it('keeps the public invite and the server caps', () => {
    expect(DISCORD_INVITE_URL).toBe('https://discord.gg/QPgq3ZxpWZ')
    expect(DESCRIPTION_MAX).toBe(1000)
  })
})

describe('Discord message preview', () => {
  // 2026-10-05 16:33 UTC is 23:33 in Bangkok, still the 5th.
  const T = '2026-10-05T16:33:00.000Z'

  it('reads the Bangkok wall clock, not the machine zone', () => {
    expect(bangkokParts(T)).toEqual({ day: 5, month: 'ตุลาคม', year: 2569, hh: '23', mm: '33' })
  })

  it('rolls the date forward past UTC midnight (17:00 UTC is 00:00 the next day)', () => {
    expect(bangkokParts('2026-12-31T17:05:00.000Z')).toEqual({
      day: 1,
      month: 'มกราคม',
      year: 2570,
      hh: '00',
      mm: '05',
    })
  })

  it('answers null for an unparseable instant', () => {
    expect(bangkokParts('not a date')).toBeNull()
  })

  it('writes the date line with two spaces before เวลา and a dot in the time', () => {
    expect(incidentDateLine(T)).toBe('วันที่ 5 ตุลาคม 2569  เวลา 23.33 น.')
  })

  it('ends the heading with the severity emoji and the Buddhist year of the timestamp', () => {
    expect(incidentHeading('INC-1146', T, 'normal')).toBe('รายการปัญหาจากระบบ ที่ INC-1146/2569 🔵')
    expect(incidentHeading('INC-1146', T, 'urgent').endsWith('🟡')).toBe(true)
    expect(incidentHeading('INC-1146', T, 'critical').endsWith('🔴')).toBe(true)
  })

  it('formats the reporter with two spaces and falls back for a missing phone', () => {
    expect(reporterLine('สมชาย', 'ใจดี', 'ผู้ดูข้อมูล')).toBe('สมชาย ใจดี  (ผู้ดูข้อมูล)')
    expect(phoneLine('0812345678')).toBe('0812345678')
    expect(phoneLine(null)).toBe('ไม่ได้ระบุ')
    expect(phoneLine('  ')).toBe('ไม่ได้ระบุ')
  })
})
