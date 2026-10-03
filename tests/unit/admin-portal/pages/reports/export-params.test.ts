import {
  HUB_EXPORT_TEMPLATE,
  NOTICE_PRESET_DATES,
  NOTICE_RANGE,
  NOTICE_SCOPE,
  NOTICE_TEMPLATE,
  defaultExportParams,
  exportLinkOf,
  isIsoDate,
  parseExportParams,
  reconcileScope,
  serializeExportParams,
  toExportApiParams,
} from '@/admin-portal/pages/reports/export-params'

/**
 * Hub 4's URL contract (AC-E3, D-9, D-10). `parseExportParams` reads whatever is in the address bar,
 * so every case below is a link somebody could actually produce: hand-edited, stale, or shared.
 * Today is fixed at 3 ต.ค. 2569, inside term 1/2569 (16 May to 31 Oct 2026).
 */
const TODAY = '2026-10-03'
const TERM = { preset: '1-2569', startDate: '2026-05-16', endDate: '2026-10-31' }

describe('isIsoDate', () => {
  it('accepts real calendar days and rejects the rest', () => {
    expect(isIsoDate('2026-10-03')).toBe(true)
    expect(isIsoDate('2028-02-29')).toBe(true)
    expect(isIsoDate('2027-02-29')).toBe(false)
    expect(isIsoDate('2026-13-01')).toBe(false)
    expect(isIsoDate('2026-1-3')).toBe(false)
    expect(isIsoDate('')).toBe(false)
    expect(isIsoDate('not-a-date')).toBe(false)
  })
})

describe('parseExportParams: defaults', () => {
  it('opens on แบบ 1, the current term and every scope for an empty query, with no notice', () => {
    const { params, notice } = parseExportParams('', TODAY)
    expect(params).toEqual({ template: 'summary', period: 'term', ...TERM, venueId: null, departmentId: null })
    expect(notice).toBeNull()
    expect(params).toEqual(defaultExportParams(TODAY))
  })

  it('treats a lone `?` and unknown keys as empty: they are ignored, not an error', () => {
    expect(parseExportParams('?', TODAY).notice).toBeNull()
    const r = parseExportParams('?utm=1&foo=bar', TODAY)
    expect(r.notice).toBeNull()
    expect(r.params).toEqual(defaultExportParams(TODAY))
  })

  it('uses the newest preset of the family for `period=term` or `period=month` alone', () => {
    expect(parseExportParams('period=term', TODAY).params).toMatchObject(TERM)
    expect(parseExportParams('period=month', TODAY).params).toMatchObject({
      period: 'month',
      preset: '2026-10',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
    })
  })
})

describe('parseExportParams: a clean deep link renders exactly that document (AC-E3)', () => {
  it('term', () => {
    const q = 'template=venues&period=term&preset=2-2568&startDate=2025-11-01&endDate=2026-03-31'
    const r = parseExportParams(q, TODAY)
    expect(r.notice).toBeNull()
    expect(r.params).toMatchObject({
      template: 'venues',
      period: 'term',
      preset: '2-2568',
      startDate: '2025-11-01',
      endDate: '2026-03-31',
    })
  })

  it('month', () => {
    const q = 'template=summary&period=month&preset=2026-09&startDate=2026-09-01&endDate=2026-09-30'
    const r = parseExportParams(q, TODAY)
    expect(r.notice).toBeNull()
    expect(r.params).toMatchObject({ period: 'month', preset: '2026-09', endDate: '2026-09-30' })
  })

  it('custom, with a scope', () => {
    const q =
      'template=ledger&period=custom&startDate=2026-09-01&endDate=2026-09-15&venueId=cm1abc&departmentId=7'
    const r = parseExportParams(q, TODAY)
    expect(r.notice).toBeNull()
    expect(r.params).toEqual({
      template: 'ledger',
      period: 'custom',
      preset: null,
      startDate: '2026-09-01',
      endDate: '2026-09-15',
      venueId: 'cm1abc',
      departmentId: 7,
    })
  })

  it('resolves a term or month from its dates alone when the preset id is absent', () => {
    const r = parseExportParams('period=term&startDate=2026-05-16&endDate=2026-10-31', TODAY)
    expect(r.notice).toBeNull()
    expect(r.params.preset).toBe('1-2569')
  })
})

describe('parseExportParams: anything invalid falls back with ONE notice, never throws (AC-E3)', () => {
  it('an unknown template keeps the range and says so', () => {
    const r = parseExportParams('template=nope&period=month&preset=2026-09', TODAY)
    expect(r.params.template).toBe('summary')
    expect(r.params).toMatchObject({ period: 'month', preset: '2026-09' })
    expect(r.notice).toBe(NOTICE_TEMPLATE)
  })

  it.each([
    ['an unknown period', 'period=weekly&startDate=2026-09-01&endDate=2026-09-02'],
    ['dates with no period', 'startDate=2026-09-01&endDate=2026-09-02'],
    ['an unknown term preset', 'period=term&preset=3-2569'],
    ['a term id under period=month', 'period=month&preset=1-2569'],
    ['a month older than the oldest term', 'period=month&preset=2020-01'],
    ['custom with a missing date', 'period=custom&startDate=2026-09-01'],
    ['custom with a malformed date', 'period=custom&startDate=2026-9-1&endDate=2026-09-30'],
    ['custom with an impossible date', 'period=custom&startDate=2027-02-30&endDate=2027-03-01'],
    ['custom with an inverted range', 'period=custom&startDate=2026-09-30&endDate=2026-09-01'],
    ['custom over 366 days', 'period=custom&startDate=2025-01-01&endDate=2026-12-31'],
    ['dates that are no term', 'period=term&startDate=2026-05-17&endDate=2026-10-31'],
  ])('%s → the current term and the range notice', (_name, query) => {
    const r = parseExportParams(query, TODAY)
    expect(r.params).toMatchObject({ period: 'term', ...TERM })
    expect(r.notice).toBe(NOTICE_RANGE)
  })

  it('a preset whose dates disagree resolves to the PRESET, with a notice', () => {
    const r = parseExportParams(
      'period=month&preset=2026-09&startDate=2026-09-02&endDate=2026-09-30',
      TODAY,
    )
    expect(r.params).toMatchObject({ preset: '2026-09', startDate: '2026-09-01', endDate: '2026-09-30' })
    expect(r.notice).toBe(NOTICE_PRESET_DATES)
  })

  it('drops a malformed scope id and keeps a good one', () => {
    const r = parseExportParams('venueId=a%20b&departmentId=3', TODAY)
    expect(r.params.venueId).toBeNull()
    expect(r.params.departmentId).toBe(3)
    expect(r.notice).toBe(NOTICE_SCOPE)
    expect(parseExportParams('departmentId=0', TODAY).params.departmentId).toBeNull()
    expect(parseExportParams('departmentId=1.5', TODAY).params.departmentId).toBeNull()
    expect(parseExportParams('departmentId=-2', TODAY).params.departmentId).toBeNull()
    expect(parseExportParams(`venueId=${'x'.repeat(65)}`, TODAY).params.venueId).toBeNull()
  })

  it('joins several problems into one line', () => {
    const r = parseExportParams('template=x&period=nope&venueId=%20', TODAY)
    expect(r.notice).toBe([NOTICE_TEMPLATE, NOTICE_RANGE, NOTICE_SCOPE].join(' · '))
  })
})

describe('reconcileScope', () => {
  const options = {
    venues: [{ id: 'v1', name: 'หอประชุม', isDeleted: false, isOpen: true }],
    departments: [{ id: 3, name: 'ฝ่ายวิชาการ', isDeleted: false }],
  }

  it('keeps ids the server offers', () => {
    const p = { ...defaultExportParams(TODAY), venueId: 'v1', departmentId: 3 }
    expect(reconcileScope(p, options)).toEqual({ params: p, notice: null })
  })

  it('drops an unknown venue, or a department the role is not offered (the reserved one for ADMIN)', () => {
    const p = { ...defaultExportParams(TODAY), venueId: 'gone', departmentId: 99 }
    const r = reconcileScope(p, options)
    expect(r.params.venueId).toBeNull()
    expect(r.params.departmentId).toBeNull()
    expect(r.notice).toBe(NOTICE_SCOPE)
  })
})

describe('serializeExportParams', () => {
  it('writes a fixed key order and omits what does not apply', () => {
    expect(serializeExportParams(defaultExportParams(TODAY))).toBe(
      'template=summary&period=term&preset=1-2569&startDate=2026-05-16&endDate=2026-10-31',
    )
    expect(
      serializeExportParams({
        template: 'ledger',
        period: 'custom',
        preset: 'stale-id',
        startDate: '2026-09-01',
        endDate: '2026-09-15',
        venueId: 'v1',
        departmentId: 4,
      }),
    ).toBe('template=ledger&period=custom&startDate=2026-09-01&endDate=2026-09-15&venueId=v1&departmentId=4')
  })

  it('round-trips through parse for every mode, so F5 reproduces the document', () => {
    for (const q of [
      'template=summary&period=term&preset=1-2569&startDate=2026-05-16&endDate=2026-10-31',
      'template=venues&period=month&preset=2026-09&startDate=2026-09-01&endDate=2026-09-30',
      'template=ledger&period=custom&startDate=2026-09-01&endDate=2026-09-15&venueId=v1&departmentId=4',
    ]) {
      const { params, notice } = parseExportParams(q, TODAY)
      expect(notice).toBeNull()
      expect(serializeExportParams(params)).toBe(q)
    }
  })

  it('drops unknown keys on the first write-back', () => {
    const { params } = parseExportParams('foo=1&template=ledger&bar=2', TODAY)
    expect(serializeExportParams(params)).not.toMatch(/foo|bar/)
  })
})

describe('toExportApiParams', () => {
  it('upper-cases the enums and sends a scope only when set', () => {
    expect(toExportApiParams(defaultExportParams(TODAY))).toEqual({
      template: 'SUMMARY',
      period: 'TERM',
      startDate: '2026-05-16',
      endDate: '2026-10-31',
    })
    expect(
      toExportApiParams({
        ...defaultExportParams(TODAY),
        template: 'venues',
        period: 'custom',
        venueId: 'v1',
        departmentId: 4,
      }),
    ).toEqual({
      template: 'VENUES',
      period: 'CUSTOM',
      startDate: '2026-05-16',
      endDate: '2026-10-31',
      venueId: 'v1',
      departmentId: 4,
    })
  })
})

describe('exportLinkOf: the hub buttons (D-10, AC-E4)', () => {
  it('builds the documented deep-link URL for a term', () => {
    expect(
      exportLinkOf({
        template: HUB_EXPORT_TEMPLATE.venues,
        mode: 'term',
        presetId: '1-2569',
        from: '2026-05-16',
        to: '2026-10-31',
      }),
    ).toBe(
      '/backend/reports/export?template=venues&period=term&preset=1-2569&startDate=2026-05-16&endDate=2026-10-31',
    )
  })

  it('carries a month, and drops the preset for a custom range', () => {
    expect(
      exportLinkOf({ template: 'summary', mode: 'month', presetId: '2026-09', from: '2026-09-01', to: '2026-09-30' }),
    ).toContain('period=month&preset=2026-09&')
    const custom = exportLinkOf({
      template: 'summary',
      mode: 'custom',
      presetId: '1-2569',
      from: '2026-09-01',
      to: '2026-09-15',
    })
    expect(custom).toBe(
      '/backend/reports/export?template=summary&period=custom&startDate=2026-09-01&endDate=2026-09-15',
    )
    expect(custom).not.toContain('preset')
  })

  it('opens Hub 4 on exactly the range the hub showed (parse(link) is clean)', () => {
    for (const mode of ['term', 'month', 'custom'] as const) {
      const link = exportLinkOf({
        template: 'summary',
        mode,
        presetId: mode === 'month' ? '2026-09' : '1-2569',
        from: mode === 'month' ? '2026-09-01' : mode === 'term' ? '2026-05-16' : '2026-09-01',
        to: mode === 'month' ? '2026-09-30' : mode === 'term' ? '2026-10-31' : '2026-09-12',
      })
      const { params, notice } = parseExportParams(link.slice(link.indexOf('?')), TODAY)
      expect(notice, link).toBeNull()
      expect(params.period).toBe(mode)
    }
  })

  it('pins the per-hub template defaults: Hub 1 แบบ 1, Hub 2 แบบ 3, Hub 3 แบบ 1', () => {
    expect(HUB_EXPORT_TEMPLATE).toEqual({ overview: 'summary', venues: 'venues', operations: 'summary' })
  })
})
