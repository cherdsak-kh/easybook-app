/**
 * Words and glyphs for a session's device — shared by ประวัติการเข้าสู่ระบบ and the staff detail
 * dialog's เซสชันและความปลอดภัย section, so the same device is never spelled two ways.
 *
 * Pure: a `DeviceInfo` in, a string out. Nothing here touches the DOM, which is why it is the one
 * part of this feature with a unit test.
 *
 * ⚠️ THE SERVER SENDS WHAT A USER-AGENT CAN PROVE, NOT WHAT THE PROTOTYPE DREW. "Windows 11",
 * "macOS Sonoma" and "Android 14" cannot be told from a UA (Windows 10 and 11 share a token,
 * macOS and Chrome-on-Android are frozen), so `osVersion` is `null` for them and the label is the
 * bare name. Do not fake a version client-side.
 *
 * ⚠️ iOS AND iPadOS NEVER SHOW A VERSION — PO/CTO ruling, even when the server sends one. Safari 26
 * freezes the OS token at 18_6, so the number the parser can see is not the number on the device,
 * and the rule that corrects it is unverified on real hardware. A wrong version in a security
 * screen is worse than none. Remove the exception only after that rule is verified.
 */

import type { DeviceInfo, LoginEventStatus } from '@/lib/api-client'
import { NO_VALUE, thaiDateTime } from './thai-date'

type DeviceType = DeviceInfo['deviceType']

const DEVICE_LABEL: Record<DeviceType, string> = {
  desktop: 'Desktop',
  tablet: 'Tablet',
  phone: 'Phone',
  unknown: 'ไม่ทราบอุปกรณ์',
}

export const deviceLabel = (type: DeviceType): string => DEVICE_LABEL[type]

const NO_OS = 'ไม่ทราบระบบ'
const NO_BROWSER = 'ไม่ทราบเบราว์เซอร์'

/** The OSes whose version is withheld — see the header. */
const VERSIONLESS_OS: readonly string[] = ['iOS', 'iPadOS']

/** `Windows` · `Android 14` · `iPadOS` (never `iPadOS 17`) · `ไม่ทราบระบบ`. */
export function osLabel(d: DeviceInfo): string {
  if (!d.os) return NO_OS
  if (VERSIONLESS_OS.includes(d.os) || !d.osVersion) return d.os
  return `${d.os} ${d.osVersion}`
}

/** `Chrome 128` · `Chrome` (no version known) · `ไม่ทราบเบราว์เซอร์`. */
export function browserLabel(d: DeviceInfo): string {
  if (!d.browser) return NO_BROWSER
  return d.browserVersion ? `${d.browser} ${d.browserVersion}` : d.browser
}

/** Card 1's `อุปกรณ์ / ระบบ`: `Desktop - Windows`. */
export const deviceAndOs = (d: DeviceInfo): string => `${deviceLabel(d.deviceType)} - ${osLabel(d)}`

/** Card 2's row title: `Safari บน iPadOS` — no browser version, as the prototype has it. */
export const otherDeviceTitle = (d: DeviceInfo): string => `${d.browser ?? NO_BROWSER} บน ${osLabel(d)}`

/**
 * The staff dialog's `เข้าสู่ระบบล่าสุดจาก`: `Chrome 128 · Windows · 12 ส.ค. 2569 08:05`. The device
 * is `null` when only `SystemUser.lastLoginAt` survives (the 90-day history has aged out), and the
 * line is then the time alone.
 */
export function lastLoginLine(login: { at: string; device: DeviceInfo | null }): string {
  const when = thaiDateTime(login.at)
  if (!login.device) return when
  return `${browserLabel(login.device)} · ${osLabel(login.device)} · ${when}`
}

/** `ip ?? —`. A `null` address is a session that predates the feature, or a FORCE_REVOKED row. */
export const ipLabel = (ip: string | null | undefined): string => ip || NO_VALUE

/** Heroicons outline `d` strings for card 2's leading tile. `desktop` is the one the prototype omits. */
export const DEVICE_ICON: Record<DeviceType, string> = {
  tablet:
    'M10.5 19.5h3m-6.75 2.25h10.5a2.25 2.25 0 002.25-2.25v-15a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 4.5v15a2.25 2.25 0 002.25 2.25z',
  phone:
    'M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3',
  desktop:
    'M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25',
  unknown:
    'M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25',
}

/**
 * One history row's status, as the badge and the `รายละเอียด` line.
 *
 * ⚠️ NO ATTEMPT COUNTER and no actor. The prototype's "ครั้งที่ 2 · ไม่มีการเข้าสู่ระบบ" is not
 * derivable (OQ-9), and a FORCE_REVOKED row never names the SUPER_ADMIN to the account it targeted
 * (OQ-7) — the sentence says "ผู้ดูแลระบบ" and stops.
 */
export const HISTORY_STATUS: Record<
  LoginEventStatus,
  { label: string; badge: string; note: (isCurrentSession: boolean) => string }
> = {
  SUCCESS: {
    label: 'สำเร็จ',
    badge: 'badge-success badge-soft',
    note: (cur) => `เข้าสู่ระบบด้วยอีเมลและรหัสผ่าน${cur ? ' · อุปกรณ์นี้' : ''}`,
  },
  FAILED_BAD_PASSWORD: {
    label: 'รหัสผ่านไม่ถูกต้อง',
    badge: 'badge-error badge-soft',
    note: () => 'รหัสผ่านไม่ถูกต้อง',
  },
  FORCE_REVOKED: {
    label: 'ถูกบังคับออกจากระบบ',
    badge: 'badge-warning badge-soft',
    note: () => 'ถูกผู้ดูแลระบบบังคับออกจากระบบ',
  },
}
