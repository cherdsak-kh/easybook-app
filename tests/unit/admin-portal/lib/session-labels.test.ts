import type { DeviceInfo } from '@/lib/api-client'
import {
  browserLabel,
  deviceAndOs,
  HISTORY_STATUS,
  ipLabel,
  lastLoginLine,
  osLabel,
  otherDeviceTitle,
} from '@/admin-portal/lib/session-labels'

const device = (over: Partial<DeviceInfo> = {}): DeviceInfo => ({
  deviceType: 'desktop',
  os: 'Windows',
  osVersion: null,
  browser: 'Chrome',
  browserVersion: '128',
  ...over,
})

describe('osLabel', () => {
  it('appends the version only when the server sent one', () => {
    expect(osLabel(device({ os: 'Android', osVersion: '14' }))).toBe('Android 14')
    expect(osLabel(device({ os: 'Windows', osVersion: null }))).toBe('Windows')
  })

  it('never prints a version for iOS or iPadOS, even when the server sends one', () => {
    expect(osLabel(device({ os: 'iOS', osVersion: '26' }))).toBe('iOS')
    expect(osLabel(device({ os: 'iPadOS', osVersion: '17' }))).toBe('iPadOS')
  })

  it('says so when the OS is unknown', () => {
    expect(osLabel(device({ os: null }))).toBe('ไม่ทราบระบบ')
  })
})

describe('browserLabel / titles', () => {
  it('prints the major version when known and the bare name otherwise', () => {
    expect(browserLabel(device())).toBe('Chrome 128')
    expect(browserLabel(device({ browserVersion: null }))).toBe('Chrome')
    expect(browserLabel(device({ browser: null }))).toBe('ไม่ทราบเบราว์เซอร์')
  })

  it('builds card 1 and card 2 labels from the same pieces', () => {
    expect(deviceAndOs(device())).toBe('Desktop - Windows')
    const ipad = device({ deviceType: 'tablet', os: 'iPadOS', osVersion: '17', browser: 'Safari' })
    expect(otherDeviceTitle(ipad)).toBe('Safari บน iPadOS')
  })
})

describe('lastLoginLine', () => {
  const at = '2026-08-12T01:05:00.000Z'

  it('falls back to the time alone when the device is gone from the 90-day history', () => {
    expect(lastLoginLine({ at, device: null })).not.toContain('·')
  })

  it('joins browser, OS and time when the device is known', () => {
    expect(lastLoginLine({ at, device: device() }).startsWith('Chrome 128 · Windows · ')).toBe(true)
  })
})

describe('ipLabel / HISTORY_STATUS', () => {
  it('renders a missing address as an em dash', () => {
    expect(ipLabel(null)).toBe('—')
    expect(ipLabel('203.0.113.7')).toBe('203.0.113.7')
  })

  it('maps every status to its badge and a note with no counter and no actor', () => {
    expect(HISTORY_STATUS.SUCCESS.badge).toContain('badge-success')
    expect(HISTORY_STATUS.FAILED_BAD_PASSWORD.badge).toContain('badge-error')
    expect(HISTORY_STATUS.FORCE_REVOKED.badge).toContain('badge-warning')
    expect(HISTORY_STATUS.SUCCESS.note(true)).toMatch(/อุปกรณ์นี้$/)
    expect(HISTORY_STATUS.SUCCESS.note(false)).not.toContain('อุปกรณ์นี้')
    expect(HISTORY_STATUS.FAILED_BAD_PASSWORD.note(false)).toBe('รหัสผ่านไม่ถูกต้อง')
  })
})
