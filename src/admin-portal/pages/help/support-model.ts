/**
 * The pure half of `/backend/help/support` (ติดต่อทีมผู้พัฒนา): what each health tile says, the
 * footer sentence, the form's validation and file rules, the diagnostics string, and which Thai
 * sentence a failed relay becomes.
 *
 * Nothing here touches the DOM or the network, so every rule is unit-testable and the three
 * components stay presentational.
 *
 * ⚠️ THE ONLY LIVE LINK TO THE DEV TEAM THAT MAY LIVE IN THIS REPO IS THE PUBLIC INVITE BELOW. The
 * webhook that the backend relays to is a credential and never reaches the browser — there is no
 * variable, constant or URL for it in `easybook-app`, and there must not be one.
 */

import type {
  HealthServiceStatus,
  SupportErrorCode,
  SupportIncidentCategory,
  SupportIncidentSeverity,
  SystemHealth,
  SystemVersionResult,
} from '@/lib/api-client'
import { HEALTH_STATUS_LABEL } from '../../labels'
import { thaiDateTime } from '../../lib/thai-date'

/** D5 — a PUBLIC invite link, safe in the bundle. Opened with `target="_blank" rel="noopener noreferrer"`. */
export const DISCORD_INVITE_URL = 'https://discord.gg/QPgq3ZxpWZ'

// ── Zone 1 · สถานะการทำงานของระบบ ─────────────────────────────────────────────────────────────

export type ProbeKey = 'db' | 'line' | 'r2' | 'api'

/** `neutral` is both "still checking" and "could not tell" — the WORD says which. */
export type ProbeTone = 'success' | 'error' | 'neutral'

export interface ProbeTile {
  key: ProbeKey
  name: string
  tech: string
  tone: ProbeTone
  /** The badge text. It carries the meaning; the colour only repeats it. */
  word: string
  /** The small line beside the badge, or `null` when the endpoint did not supply one. */
  detail: string | null
}

export type HealthSnapshot = SystemHealth & { apiLatencyMs: number }

/** What the card knows: still waiting, or an answer (`health` is `null` when the request failed). */
export type ProbeState =
  | { phase: 'loading' }
  | { phase: 'done'; health: HealthSnapshot | null; version: SystemVersionResult }

const TILE_META: Record<ProbeKey, { name: string; tech: string; upWord: string }> = {
  db: { name: 'ฐานข้อมูล', tech: 'PostgreSQL', upWord: 'เชื่อมต่อปกติ' },
  line: { name: 'บริการแจ้งเตือน', tech: 'LINE Messaging API', upWord: 'พร้อมใช้งาน' },
  r2: { name: 'พื้นที่จัดเก็บไฟล์', tech: 'Cloudflare R2', upWord: 'พร้อมใช้งาน' },
  api: { name: 'API Backend', tech: 'NestJS', upWord: 'ตอบสนองปกติ' },
}

export const PROBE_ORDER: readonly ProbeKey[] = ['db', 'line', 'r2', 'api']

/**
 * `โควตาคงเหลือ N%`, or `null` when there is no honest number to print.
 *
 * ⚠️ `quotaTotal` is null for an unlimited or unknown plan, and 0 would divide by zero — both are
 * "no percentage", never "0%" or "100%".
 */
export function quotaPercent(remaining: number | null, total: number | null): number | null {
  if (remaining == null || total == null || total <= 0) return null
  return Math.max(0, Math.min(100, Math.round((remaining / total) * 100)))
}

function statusTone(status: HealthServiceStatus): ProbeTone {
  if (status === 'UP') return 'success'
  if (status === 'DOWN') return 'error'
  return 'neutral'
}

/**
 * The four tiles for one probe state.
 *
 * ⚠️ NUMBERS COME ONLY FROM `health.telemetry`, WHICH THE SERVER SENDS TO SUPER_ADMIN ALONE. For
 * ADMIN and VIEWER it is `null`, so latency and quota are unreachable here rather than hidden — the
 * function never computes or invents one (AC-F3). The prototype's hard-coded "85%" is not reproduced.
 */
export function buildProbeTiles(state: ProbeState): ProbeTile[] {
  return PROBE_ORDER.map((key): ProbeTile => {
    const meta = TILE_META[key]
    const base = { key, name: meta.name, tech: meta.tech }

    if (state.phase === 'loading') {
      return { ...base, tone: 'neutral', word: 'กำลังตรวจสอบ', detail: null }
    }

    const { health, version } = state

    if (key === 'api') {
      // The API tile is "did /system/health answer at all?" — its own failure is the news.
      if (!health) return { ...base, tone: 'error', word: HEALTH_STATUS_LABEL.DOWN, detail: null }
      return {
        ...base,
        tone: 'success',
        word: meta.upWord,
        detail: version.ok
          ? `v${version.value.version} · build ${version.value.build}`
          : 'ไม่ทราบเวอร์ชัน',
      }
    }

    // The other three come from the same response; when it failed, none of them is known.
    if (!health) return { ...base, tone: 'neutral', word: 'ไม่ทราบสถานะ', detail: null }

    const status =
      key === 'db'
        ? health.services.database.status
        : key === 'line'
          ? health.services.line.status
          : health.services.storage.status
    const tone = statusTone(status)
    const word = status === 'UP' ? meta.upWord : HEALTH_STATUS_LABEL[status]

    let detail: string | null = null
    if (status === 'UP') {
      const t = health.telemetry
      if (key === 'db' && t) detail = `Latency ${t.database.latencyMs} ms`
      if (key === 'line' && t) {
        const pct = quotaPercent(t.line.quotaRemaining, t.line.quotaTotal)
        if (pct != null) detail = `โควตาคงเหลือ ${pct}%`
      }
      if (key === 'r2') detail = 'อัปโหลดและแสดงรูปได้ตามปกติ'
    }
    return { ...base, tone, word, detail }
  })
}

/** The line under the tiles (`#sp-health-at`). Three outcomes beyond "still checking". */
export function healthFooter(state: ProbeState): string {
  if (state.phase === 'loading') return 'กำลังตรวจสอบสถานะระบบ…'
  const { health } = state
  if (!health) {
    return 'ตรวจสอบสถานะระบบไม่สำเร็จ · เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ในขณะนี้ หากเปิดหน้าอื่นไม่ได้ด้วย ให้แจ้งทีมพัฒนาด้านล่าง'
  }
  const at = thaiDateTime(health.checkedAt)
  return health.overall === 'OK'
    ? `ทุกส่วนทำงานปกติ · ตรวจสอบล่าสุด ${at}`
    : `ระบบบางส่วนขัดข้อง · ตรวจสอบล่าสุด ${at}`
}

// ── Zone 3 · แจ้งปัญหา ───────────────────────────────────────────────────────────────────────

export const PATH_MAX = 200
export const DESCRIPTION_MAX = 1000
/** The server's cap on the client-built diagnostics string; a long user agent must not cause a 400. */
export const DIAGNOSTICS_MAX = 2000
export const FILES_MAX = 3
export const FILE_MAX_BYTES = 5 * 1024 * 1024

export const CATEGORY_OPTIONS: readonly { value: SupportIncidentCategory; label: string }[] = [
  { value: 'web', label: 'บั๊กหน้าเว็บ' },
  { value: 'line', label: 'การเชื่อมต่อ LINE' },
  { value: 'booking', label: 'การจองและปฏิทิน' },
  { value: 'access', label: 'สิทธิ์การใช้งาน' },
  { value: 'other', label: 'อื่นๆ' },
]

export const SEVERITY_OPTIONS: readonly { value: SupportIncidentSeverity; label: string }[] = [
  { value: 'normal', label: 'ปกติ' },
  { value: 'urgent', label: 'เร่งด่วน (กระทบการใช้งานทั่วไป)' },
  { value: 'critical', label: 'วิกฤต (ระบบหยุดชะงัก)' },
]

/**
 * Severity → the emoji that ends the message's header line, the plain-text mention that opens it, and
 * the Thai label. The relay sends Markdown `content` (no embed), so there is no colour to mirror:
 * the emoji is the accent. `ping` is empty for `normal` — no mention line at all.
 */
export const SEVERITY_STYLE: Record<
  SupportIncidentSeverity,
  { label: string; emoji: string; ping: string }
> = {
  normal: { label: 'ปกติ', emoji: '🔵', ping: '' },
  urgent: { label: 'เร่งด่วน', emoji: '🟡', ping: '@Tech Support' },
  critical: { label: 'วิกฤต', emoji: '🔴', ping: '@here' },
}

const TH_MONTHS_FULL = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
] as const

export interface BangkokParts {
  day: number
  /** Full Thai month name. */
  month: string
  /** Buddhist era. */
  year: number
  /** Zero-padded, 24-hour. */
  hh: string
  mm: string
}

/**
 * An instant as the Bangkok wall clock, or `null` when it does not parse.
 *
 * ⚠️ UTC+7 IS ADDED BY HAND and read back with the `getUTC*` accessors, so the result is the same on
 * a laptop in Tokyo and on the school's PCs — the Discord message is stamped in Bangkok time whatever
 * the viewer's machine says. Thailand has no DST, so a fixed offset is exact.
 */
export function bangkokParts(value: string | Date): BangkokParts | null {
  const t = (value instanceof Date ? value : new Date(value)).getTime()
  if (Number.isNaN(t)) return null
  const d = new Date(t + 7 * 3_600_000)
  return {
    day: d.getUTCDate(),
    month: TH_MONTHS_FULL[d.getUTCMonth()],
    year: d.getUTCFullYear() + 543,
    hh: String(d.getUTCHours()).padStart(2, '0'),
    mm: String(d.getUTCMinutes()).padStart(2, '0'),
  }
}

/** `รายการปัญหาจากระบบ ที่ INC-1146/2569 🔵` — the `#` heading line, without the `#`. */
export function incidentHeading(
  code: string,
  timestamp: string,
  severity: SupportIncidentSeverity,
): string {
  const year = bangkokParts(timestamp)?.year ?? '—'
  return `รายการปัญหาจากระบบ ที่ ${code}/${year} ${SEVERITY_STYLE[severity].emoji}`
}

/** `วันที่ 5 ตุลาคม 2569  เวลา 23.33 น.` — two spaces before `เวลา`, a dot in the time. */
export function incidentDateLine(timestamp: string): string {
  const p = bangkokParts(timestamp)
  if (!p) return 'วันที่ —  เวลา — น.'
  return `วันที่ ${p.day} ${p.month} ${p.year}  เวลา ${p.hh}.${p.mm} น.`
}

/** `ชื่อ นามสกุล  (บทบาท)` — the two spaces are the message's own. */
export function reporterLine(firstName: string, lastName: string, roleLabel: string): string {
  return `${`${firstName} ${lastName}`.trim()}  (${roleLabel})`
}

/** The phone line, or the sentence the message prints when the account has none. */
export function phoneLine(phone: string | null | undefined): string {
  return phone?.trim() || 'ไม่ได้ระบุ'
}

export function categoryLabel(value: SupportIncidentCategory): string {
  return CATEGORY_OPTIONS.find((o) => o.value === value)?.label ?? value
}

export interface ReportErrors {
  path?: string
  description?: string
}

/** The two required fields, trimmed, with the prototype's own sentences. */
export function validateReport(path: string, description: string): ReportErrors {
  const errors: ReportErrors = {}
  if (!path.trim()) errors.path = 'ระบุหน้าจอหรือเส้นทางที่พบปัญหา'
  if (!description.trim()) errors.description = 'อธิบายอาการที่พบ อย่างน้อยหนึ่งประโยค'
  return errors
}

const IMAGE_TYPE = /^image\/(png|jpeg|webp)$/

/**
 * Add `incoming` to `existing`, refusing what the server would refuse — PNG/JPEG/WEBP, ≤ 5 MB each
 * (exclusive: 5 MiB itself passes), ≤ 3 in all. The LAST refusal's message wins, as in the prototype.
 *
 * ⚠️ This is a courtesy, not the control: the server sniffs the bytes and ignores the declared type.
 */
export function acceptFiles(
  existing: readonly File[],
  incoming: readonly File[],
): { files: File[]; error: string } {
  const files = [...existing]
  let error = ''
  for (const f of incoming) {
    if (!IMAGE_TYPE.test(f.type)) {
      error = `"${f.name}" ไม่ใช่ไฟล์ภาพ PNG, JPG หรือ WEBP`
    } else if (f.size > FILE_MAX_BYTES) {
      error = `"${f.name}" มีขนาดเกิน 5 MB`
    } else if (files.length >= FILES_MAX) {
      error = `แนบได้สูงสุด ${FILES_MAX} ภาพ`
    } else {
      files.push(f)
    }
  }
  return { files, error }
}

/** `1.2 MB` / `340 KB` — a floor of 1 KB so a tiny file never reads "0 KB". */
export function formatSize(bytes: number): string {
  return bytes >= 1048576
    ? `${(bytes / 1048576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export interface DiagnosticsInput {
  appVersion: string
  appBuild: string
  /** `null` when `/system/version` could not be read. */
  server: { version: string; build: string } | null
  roleLabel: string
  userAgent: string
  platform: string
  width: number
  height: number
  /** Already formatted, Buddhist era. */
  stamp: string
}

/**
 * The string that rides on EVERY report, built at submit time so เวลา and บทบาท are the moment it
 * was sent. บทบาท yes; name, email and phone never — the same rule as the version screen's block.
 * Capped at the server's limit, because a long user agent must not turn a report into a 400.
 */
export function buildDiagnostics(d: DiagnosticsInput): string {
  return [
    'EasyBook · ข้อมูลวินิจฉัย',
    `หน้าเว็บ: ${d.appVersion} (${d.appBuild})`,
    `เซิร์ฟเวอร์: ${d.server ? `${d.server.version} (${d.server.build})` : 'ตรวจสอบไม่ได้'}`,
    `บทบาท: ${d.roleLabel}`,
    `เบราว์เซอร์: ${d.userAgent}`,
    `แพลตฟอร์ม: ${d.platform} · หน้าจอ ${d.width} × ${d.height}`,
    `เวลา: ${d.stamp}`,
  ]
    .join('\n')
    .slice(0, DIAGNOSTICS_MAX)
}

const MSG_BAD_INPUT = 'ข้อมูลที่ส่งไม่ถูกต้อง กรุณาตรวจสอบแบบฟอร์มแล้วลองใหม่'
const MSG_UNAVAILABLE =
  'ระบบไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่อีกครั้ง หรือติดต่อทีมพัฒนาผ่าน Discord'
const MSG_RELAY_FAILED =
  'ส่งแจ้งปัญหาถึงทีมพัฒนาไม่สำเร็จ กรุณาลองใหม่อีกครั้ง หรือติดต่อทีมพัฒนาผ่าน Discord'
const MSG_NO_CONNECTION =
  'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง หรือติดต่อทีมพัฒนาผ่าน Discord'

/**
 * Which Thai sentence a failed submit shows.
 *
 *  · a CODED failure (400 file type, 413, 429, 502, 503) already carries the server's own sentence —
 *    switch on the CODE, never on the text, and show that text;
 *  · an UNCODED one falls back by status: the pipe's 400 (`message` is a `string[]`, so the client
 *    only sees a generic string), the session layer's 503, and anything else reads as a relay failure;
 *  · `status === null` is a request that never completed.
 *
 * 401 belongs to `AuthProvider` and 403 is retried once by `withCsrfRetry`, so neither needs a branch.
 */
export function failureMessage(
  status: number | null,
  code: SupportErrorCode | undefined,
  serverMessage: string,
): string {
  if (code && serverMessage) return serverMessage
  if (status == null) return MSG_NO_CONNECTION
  if (status === 400) return MSG_BAD_INPUT
  if (status === 503) return MSG_UNAVAILABLE
  return MSG_RELAY_FAILED
}
