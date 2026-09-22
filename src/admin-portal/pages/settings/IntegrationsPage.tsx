/**
 * `การเชื่อมต่อระบบ` — `/backend/settings/integrations`. Prototype `[data-route="integrations"]`.
 *
 * A diagnostics hub, not a settings form: four cards, one per external dependency, each answering
 * "is it connected?" (a badge) and "prove it" (a probe that re-stamps its check time).
 *
 * ── Live since INTEGRATIONS-API-1 ──
 * Everything reads and writes `/api/v1/system/integrations` (`integrations-api.ts`):
 *   · entry and ตรวจสอบอีกครั้ง → `GET` (fail-soft: LINE / DB / Redis trouble comes back as null or
 *     `error` fields in a 200, so the page renders exactly when something is down);
 *   · the Swagger switch → `PATCH /swagger`, which the server applies to the next `/docs` request;
 *   · the LINE card's บันทึก → `PATCH /line`, which hot-swaps the live credentials;
 *   · Verify Token → `POST /line/verify` (bot info + quota, nothing sent);
 *   · the R2 probe → `POST /storage/probe` (list one key + write/delete two bytes).
 *
 * ── Roles ──
 * VIEWER never gets here (`VIEWER_DENY`; the server also answers 403). SUPER_ADMIN flips Swagger and
 * edits the LINE card; ADMIN reads everything and runs every probe, with the switch disabled and no
 * edit affordance rendered. The server's `@Roles` is the control.
 *
 * ── Decisions carried from the prototype (22 ก.ย. 2569) ──
 *   · Swagger is OFF unless someone turned it on — the server holds the answer now.
 *   · Editing is PER CARD and only the LINE card edits.
 *   · R2 is READ-ONLY for every role: bucket and base URL are baked into every stored object URL.
 *   · No test push: it would spend the monthly LINE quota to prove what a read proves free.
 *
 * Secrets never reach the browser. Channel ID arrives masked; Secret and Token are write-only, so all
 * three edit inputs start EMPTY and "blank = keep" — the server never sends a value to prefill.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { LoadError, type LoadErrorKind } from '../../components/feedback/LoadError'
import { Spinner } from '../../components/feedback/Spinner'
import { PageHeading } from '../../components/shell/PageHeading'
import { Badge, type BadgeTone } from '../../components/ui/Badge'
import { Btn } from '../../components/ui/Btn'
import { FormField } from '../../components/ui/FormField'
import { chatModeOf } from '../../labels'
import { useAuth } from '../../lib/auth-context'
import { thaiDateTime } from '../../lib/thai-date'
import { useToast } from '../../lib/toast-context'
import { COPY_SELECT_MESSAGE } from '../../lib/use-copy'
import type { AdminRoute } from '../../routes'
import type { WriteFailure } from '../announcements/announcements-api'
import {
  getIntegrations,
  probeStorage,
  setSwaggerEnabled,
  updateLineIntegration,
  verifyLine,
  type LineIntegrationInput,
  type StorageProbeResult,
  type SystemIntegrations,
} from './integrations-api'

const DESC = 'ตรวจสอบสถานะการเชื่อมต่อบริการภายนอก และควบคุมการเข้าถึงระบบ'

/** Same origin rule as `api-client.ts`: empty in dev ⇒ this origin, set in prod ⇒ the backend's. */
const API_ORIGIN = import.meta.env.VITE_API_URL || window.location.origin
const DOCS_URL = `${API_ORIGIN}/docs`
const WEBHOOK_URL = `${API_ORIGIN}/api/v1/line/webhook`
const LIFF_ID = import.meta.env.VITE_LIFF_ID as string | undefined
const LIFF_URL = LIFF_ID ? `https://liff.line.me/${LIFF_ID}` : null

const MSG = {
  swaggerOn: 'เปิดใช้งาน Swagger UI แล้ว',
  swaggerOff: 'ปิดการเข้าถึง Swagger UI แล้ว',
  copied: 'คัดลอกลิงก์สำเร็จ',
  line: 'ตรวจสอบการเชื่อมต่อ LINE สำเร็จ: Token ถูกต้องและบอทพร้อมทำงาน',
  saved: 'บันทึกการตั้งค่า LINE สำเร็จ',
  noChange: 'ไม่มีค่าที่เปลี่ยนแปลง',
} as const

/** Heroicons outline paths used on this page. */
const ICON = {
  refresh:
    'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99',
  code: 'M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z',
  chat: 'M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z',
  cloud:
    'M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z',
  db: 'M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125',
  warn: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  external:
    'M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25',
  copy: 'M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75',
  shield:
    'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
  pencil:
    'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10',
  lock: 'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z',
} as const

function Icon({ d, className = 'h-4.5 w-4.5 shrink-0' }: { d: string; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

/** A thrown fetch is status 0; a 403 here means the role changed under us; anything else is server. */
function kindOf(f: WriteFailure): LoadErrorKind {
  if (f.status === 0) return 'network'
  if (f.status === 403) return 'forbidden'
  return 'server'
}

/** One sentence for a failed write/probe toast. A pipe 400's `string[]` message is never shown raw. */
function failureMessage(f: WriteFailure, fallback: string): string {
  if (f.status === 0) return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง'
  if (f.status === 403) return 'บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้'
  return f.message ?? fallback
}

/** The prototype's `.btn-sm` — smaller type and padding, never smaller than 44px. */
const SMALL_BTN = 'gap-1.5 px-3 text-[13px]'
/** Section-card shell: the portal's card plus the column layout every card here uses. */
const CARD = 'pf-card flex min-w-0 flex-col gap-4 p-4 sm:p-5'
const PILL = 'px-2 py-0.5 text-[12px]'

function CardTitle({
  id,
  icon,
  iconTone,
  title,
  sub,
  aside,
}: {
  id: string
  icon: string
  iconTone: string
  title: string
  sub: string
  aside?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-control ${iconTone}`}
        >
          <Icon d={icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 id={id} className="pf-title">
            {title}
          </h2>
          <p className="m-0 mt-0.5 text-[14px] leading-[1.55] text-base-content/70">{sub}</p>
        </div>
      </div>
      {aside && <div className="flex flex-wrap items-center gap-2">{aside}</div>}
    </div>
  )
}

function Checked({ at }: { at: string }) {
  return (
    <p className="m-0 text-[13px] text-base-content/70">
      ตรวจสอบล่าสุด <span className="tabular-nums">{at}</span>
    </p>
  )
}

/** Spinner in place of the icon while busy, visible label unchanged (`useBusy`'s rule). */
function ProbeBtn({
  busy,
  onClick,
  icon,
  label,
  busyLabel,
  primary = false,
  disabled = false,
}: {
  busy: boolean
  onClick: () => void
  icon?: string
  label: string
  busyLabel: string
  primary?: boolean
  disabled?: boolean
}) {
  return (
    <Btn
      className={`${SMALL_BTN} ${primary ? 'border-primary/60 text-primary hover:bg-primary/10' : ''}`}
      onClick={onClick}
      disabled={busy || disabled}
      aria-busy={busy || undefined}
      aria-label={busy ? busyLabel : undefined}
    >
      {busy ? <Spinner /> : icon ? <Icon d={icon} /> : null}
      {label}
    </Btn>
  )
}

function CopyRow({
  id,
  label,
  value,
  onCopy,
}: {
  id: string
  label: string
  value: string
  onCopy: (input: HTMLInputElement | null) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      <div className="flex min-w-0 items-stretch">
        <input
          ref={ref}
          id={id}
          type="text"
          readOnly
          value={value}
          className="min-h-11 w-full min-w-0 rounded-l-control rounded-r-none border border-base-300 bg-base-200 px-3.5 font-mono text-[12px] text-base-content/80 outline-offset-[-1px] focus-visible:outline-2 focus-visible:outline-primary"
        />
        <button
          type="button"
          onClick={() => onCopy(ref.current)}
          aria-label={`คัดลอก ${label}`}
          className="btn-ghost2 -ml-px min-w-11 shrink-0 whitespace-nowrap rounded-l-none px-3 text-[13px]"
        >
          <Icon d={ICON.copy} />
          <span className="hidden sm:inline">คัดลอก</span>
        </button>
      </div>
    </div>
  )
}

function Service({
  name,
  meta,
  status,
  latencyMs,
}: {
  name: string
  meta: string
  status: { tone: BadgeTone; label: string }
  latencyMs: number
}) {
  return (
    <div className="rounded-control border border-base-300 p-3.5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="m-0 text-[14px] font-semibold text-base-content">
          {name} <span className="font-normal text-base-content/70">· {meta}</span>
        </p>
        <Badge tone={status.tone} className={PILL}>
          {status.label}
        </Badge>
      </div>
      <div className="rounded-control bg-base-200 px-3 py-2.5">
        <p className="m-0 text-[12px] text-base-content/70">Latency</p>
        <p className="m-0 text-[20px] font-semibold tabular-nums text-base-content">
          {latencyMs}
          <span className="ml-0.5 text-[13px] font-normal text-base-content/70">ms</span>
        </p>
      </div>
    </div>
  )
}

const DB_STATUS = {
  ok: { tone: 'emerald', label: 'ปกติ' },
  degraded: { tone: 'amber', label: 'ตอบสนองช้า' },
  error: { tone: 'rose', label: 'ขัดข้อง' },
} as const satisfies Record<string, { tone: BadgeTone; label: string }>
const REDIS_STATUS = {
  up: { tone: 'emerald', label: 'ปกติ' },
  down: { tone: 'rose', label: 'ขัดข้อง' },
} as const satisfies Record<string, { tone: BadgeTone; label: string }>

interface Draft {
  channelId: string
  secret: string
  token: string
}
type DraftErrors = Partial<Record<keyof Draft, string>>
type ProbeKey = 'line' | 'r2' | 'infra'

export function IntegrationsPage({ route }: { route: AdminRoute }) {
  const { user } = useAuth()
  const isSuper = user?.role === 'SUPER_ADMIN'
  const toast = useToast()

  // Results that land after the operator has left must not toast over the next page.
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const say = (kind: 'success' | 'error' | 'info', msg: string) => {
    if (alive.current) toast(kind, msg)
  }

  const now = () => thaiDateTime(new Date())

  // ── Load ──
  const [data, setData] = useState<SystemIntegrations | null>(null)
  const [loadError, setLoadError] = useState<LoadErrorKind | null>(null)
  const [checked, setChecked] = useState<Record<ProbeKey, string>>({ line: '—', r2: '—', infra: '—' })
  const [live, setLive] = useState('')

  /** `GET`. `stamp` says which cards' check times the answer refreshes. */
  const load = useCallback(async (stamp: readonly ProbeKey[]) => {
    const res = await getIntegrations()
    if (!alive.current) return null
    if (!res.ok) {
      // Replaces the page only while there is no data yet — the render checks `!data`; after a good
      // load, a failed refresh is reported by the probe that asked, and the last answer stays up.
      setLoadError(kindOf(res))
      return res
    }
    setData(res.value)
    setLoadError(null)
    const at = thaiDateTime(new Date())
    setChecked((c) => ({ ...c, ...Object.fromEntries(stamp.map((k) => [k, at])) }))
    return res
  }, [])

  useEffect(() => {
    void load(['line', 'r2', 'infra'])
  }, [load])

  // ── Swagger ──
  const [swaggerBusy, setSwaggerBusy] = useState(false)
  async function toggleSwagger() {
    // `disabled` already stops the click; a stale handler must never be what lets ADMIN write.
    if (!isSuper || !data || swaggerBusy) return
    const next = !data.swagger.enabled
    setSwaggerBusy(true)
    const res = await setSwaggerEnabled(next)
    if (!alive.current) return
    setSwaggerBusy(false)
    if (!res.ok) {
      say('error', failureMessage(res, 'เปลี่ยนการตั้งค่า Swagger UI ไม่สำเร็จ'))
      return
    }
    setData((d) => (d ? { ...d, swagger: { enabled: res.value } } : d))
    say(res.value ? 'success' : 'info', res.value ? MSG.swaggerOn : MSG.swaggerOff)
  }

  // ── Probes ──
  const [busy, setBusy] = useState<Record<ProbeKey, boolean>>({ line: false, r2: false, infra: false })
  const [allBusy, setAllBusy] = useState(false)
  const [tokenPending, setTokenPending] = useState(false)
  const [storageProbe, setStorageProbe] = useState<StorageProbeResult | null>(null)

  /** Each resolves to `[ok, sentence]` and never throws. */
  async function probeLine(): Promise<[boolean, string]> {
    setBusy((b) => ({ ...b, line: true }))
    const res = await verifyLine()
    if (!alive.current) return [false, '']
    setBusy((b) => ({ ...b, line: false }))
    setChecked((c) => ({ ...c, line: now() }))
    if (!res.ok) {
      // A 503 is a fresh verdict — the card must stop saying เชื่อมต่อแล้ว, or it contradicts the toast
      // it just raised. (A 0 / 403 says nothing about LINE, so the last answer stays.)
      if (res.status === 503) {
        setData((d) => (d ? { ...d, line: { ...d.line, botInfo: null, quota: null } } : d))
      }
      const msg =
        res.code === 'LINE_NOT_CONFIGURED'
          ? 'ยังไม่ได้ตั้งค่า LINE หรือ Channel Access Token ไม่ถูกต้อง'
          : failureMessage(res, 'ติดต่อ LINE ไม่ได้ชั่วคราว ลองใหม่อีกครั้ง')
      return [false, msg]
    }
    setTokenPending(false)
    setData((d) =>
      d ? { ...d, line: { ...d.line, botInfo: res.value.botInfo, quota: res.value.quota } } : d,
    )
    return [true, MSG.line]
  }

  async function probeR2(): Promise<[boolean, string]> {
    setBusy((b) => ({ ...b, r2: true }))
    const res = await probeStorage()
    if (!alive.current) return [false, '']
    setBusy((b) => ({ ...b, r2: false }))
    setChecked((c) => ({ ...c, r2: now() }))
    if (!res.ok) return [false, failureMessage(res, 'ทดสอบ Cloudflare R2 ไม่สำเร็จ')]
    setStorageProbe(res.value)
    const p = res.value
    return p.ok
      ? [true, `Cloudflare R2 อ่านและเขียนไฟล์ทดสอบสำเร็จ (${p.latencyMs} ms)`]
      : [false, `Cloudflare R2 ใช้งานไม่ได้ — อ่าน ${p.read ? '✓' : '✗'} · เขียน ${p.write ? '✓' : '✗'}`]
  }

  async function probeInfra(): Promise<[boolean, string]> {
    setBusy((b) => ({ ...b, infra: true }))
    const res = await load(['infra'])
    if (!alive.current || !res) return [false, '']
    setBusy((b) => ({ ...b, infra: false }))
    if (!res.ok) return [false, failureMessage(res, 'ตรวจสอบโครงสร้างพื้นฐานไม่สำเร็จ')]
    const { database, redis } = res.value.infrastructure
    return database.status === 'ok' && redis.status === 'up'
      ? [true, 'PostgreSQL และ Redis ทำงานปกติ']
      : [false, `PostgreSQL: ${DB_STATUS[database.status].label} · Redis: ${REDIS_STATUS[redis.status].label}`]
  }

  const PROBES: Record<ProbeKey, () => Promise<[boolean, string]>> = {
    line: probeLine,
    r2: probeR2,
    infra: probeInfra,
  }

  async function runOne(key: ProbeKey) {
    if (busy[key]) return
    const [ok, msg] = await PROBES[key]()
    if (!msg) return
    setLive(msg)
    say(ok ? 'success' : 'error', msg)
  }

  async function runAll() {
    if (allBusy) return
    setAllBusy(true)
    const results = await Promise.all((['line', 'r2', 'infra'] as const).map((k) => PROBES[k]()))
    if (!alive.current) return
    setAllBusy(false)
    const failed = results.filter(([ok]) => !ok)
    const msg = failed.length
      ? `พบปัญหา ${failed.length} จาก 3 บริการ — ${failed.map(([, m]) => m).join(' · ')}`
      : 'ทดสอบครบ 3 บริการ ทุกบริการเชื่อมต่อได้ตามปกติ'
    setLive(msg)
    say(failed.length ? 'error' : 'success', msg)
  }

  // ── Copy ── the same three tiers as `use-copy.ts` (which reads textContent, not an input value).
  async function copy(input: HTMLInputElement | null) {
    if (!input) return
    try {
      await navigator.clipboard.writeText(input.value)
      say('success', MSG.copied)
      return
    } catch {
      // Falls through: existing is not working.
    }
    input.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    if (ok) say('success', MSG.copied)
    else say('error', COPY_SELECT_MESSAGE)
  }

  // ── LINE card edit (SUPER_ADMIN only, this card only) ──
  const [draft, setDraft] = useState<Draft | null>(null)
  const [errors, setErrors] = useState<DraftErrors>({})
  const [saving, setSaving] = useState(false)
  // Bumped whenever an edit is abandoned, so a save already in flight is not applied to the page.
  const editSeq = useRef(0)
  const firstField = useRef<HTMLInputElement>(null)
  const editBtn = useRef<HTMLButtonElement>(null)

  // Leaving SUPER_ADMIN mid-edit discards the draft at once — adjusted during render, React's
  // pattern for "state derived from a prop change", so no frame shows inputs to the wrong role.
  const [wasSuper, setWasSuper] = useState(isSuper)
  if (wasSuper !== isSuper) {
    setWasSuper(isSuper)
    if (!isSuper) {
      setDraft(null)
      setErrors({})
      setSaving(false)
    }
  }
  // …and orphans a save in flight. In an effect: a ref must not be written during render.
  useEffect(() => {
    if (!isSuper) editSeq.current += 1
  }, [isSuper])

  const editing = draft !== null && isSuper

  useEffect(() => {
    if (editing) firstField.current?.focus()
  }, [editing])

  function startEdit() {
    if (!isSuper) return
    setDraft({ channelId: '', secret: '', token: '' })
    setErrors({})
  }

  function cancelEdit() {
    editSeq.current += 1
    setDraft(null)
    setErrors({})
    setSaving(false)
    requestAnimationFrame(() => editBtn.current?.focus())
  }

  function setField(k: keyof Draft, v: string) {
    setDraft((d) => (d ? { ...d, [k]: v } : d))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  async function saveEdit() {
    if (!isSuper || !draft || saving) return
    const id = draft.channelId.trim()
    const secret = draft.secret.trim()
    const token = draft.token.trim()
    // Blank = keep, for all three — the server never sends a value to prefill. The same rules the
    // server enforces, checked here first so the answer is a field error, not a toast.
    const next: DraftErrors = {}
    if (id && !/^\d{10}$/.test(id)) next.channelId = 'Channel ID ต้องเป็นตัวเลข 10 หลัก'
    if (secret && !/^[0-9a-f]{32}$/i.test(secret))
      next.secret = 'Channel Secret ต้องเป็นตัวอักษร 0-9 a-f จำนวน 32 ตัว'
    if (token && (token.length < 40 || /\s/.test(token)))
      next.token = 'Access Token ต้องยาวอย่างน้อย 40 ตัวอักษรและไม่มีช่องว่าง'
    setErrors(next)
    if (Object.keys(next).length) return

    const body: LineIntegrationInput = {}
    if (id) body.channelId = id
    if (secret) body.channelSecret = secret
    if (token) body.channelAccessToken = token
    if (!Object.keys(body).length) {
      say('info', MSG.noChange)
      cancelEdit()
      return
    }

    const seq = ++editSeq.current
    setSaving(true)
    const res = await updateLineIntegration(body)
    if (!alive.current || seq !== editSeq.current) return // left, cancelled, or demoted meanwhile
    setSaving(false)
    if (!res.ok) {
      say('error', failureMessage(res, 'บันทึกการตั้งค่า LINE ไม่สำเร็จ'))
      return
    }
    setData((d) => (d ? { ...d, line: { ...d.line, channelId: res.value } } : d))
    // A new token is unproven until the next verify says otherwise — and `configured` may have
    // flipped, so the card re-reads the server's view of LINE.
    if (token) {
      setTokenPending(true)
      void load(['line'])
    }
    setDraft(null)
    setLive(MSG.saved)
    say('success', MSG.saved)
    requestAnimationFrame(() => editBtn.current?.focus())
  }

  // ── Render ──
  const heading = (actions?: ReactNode) => (
    <PageHeading route={route} desc={DESC} actions={actions} />
  )

  if (loadError && !data) {
    return (
      <div className="card-shell">
        {heading()}
        <div className="pf-card flex flex-1 flex-col">
          <LoadError
            kind={loadError}
            onRetry={() => {
              setLoadError(null)
              void load(['line', 'r2', 'infra'])
            }}
          />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="card-shell">
        {heading()}
        <div className="pf-card flex flex-1 items-center justify-center p-10">
          <Spinner size="lg" label="กำลังตรวจสอบสถานะการเชื่อมต่อ" />
        </div>
      </div>
    )
  }

  const { swagger, line, storage, infrastructure } = data
  const swaggerOn = swagger.enabled
  const lineBadge: { tone: BadgeTone; label: string } = !line.configured
    ? { tone: 'amber', label: 'ยังไม่ได้ตั้งค่า' }
    : line.botInfo
      ? { tone: 'emerald', label: 'เชื่อมต่อแล้ว' }
      : { tone: 'rose', label: 'ติดต่อ LINE ไม่ได้' }
  const storageBadge: { tone: BadgeTone; label: string } = !storage.configured
    ? { tone: 'amber', label: 'ยังไม่ได้ตั้งค่า' }
    : storageProbe && !storageProbe.ok
      ? { tone: 'rose', label: 'ใช้งานไม่ได้' }
      : { tone: 'emerald', label: 'พร้อมใช้งาน' }
  const quota = line.quota
  const quotaSentence = quota
    ? quota.total === null
      ? `Token ถูกต้อง · ใช้ไป ${quota.used} ข้อความ (ไม่จำกัดโควต้า)`
      : `Token ถูกต้อง · โควต้าคงเหลือ ${Math.max(quota.total - quota.used, 0)}/${quota.total} ข้อความ`
    : line.configured
      ? 'ยังอ่านโควต้าไม่ได้ — กดตรวจสอบสถานะ Token'
      : 'ยังไม่ได้ตั้งค่า Channel Access Token'
  const quotaPct =
    quota && quota.total ? Math.min(100, Math.round((quota.used / quota.total) * 100)) : 0
  const bot = line.botInfo
  const perm = (v: boolean | undefined) =>
    v === undefined ? (
      <Badge tone="slate" className={PILL}>
        ยังไม่ได้ทดสอบ
      </Badge>
    ) : (
      <Badge tone={v ? 'emerald' : 'rose'} className={PILL}>
        {v ? '✓' : '✗'}
      </Badge>
    )

  return (
    <div className="card-shell relative lg:overflow-y-auto">
      {heading(
        // Hidden while the LINE card edits: it would verify the SAVED credentials while the fields
        // hold new ones, and read as a verdict on the new ones.
        !editing && (
          <Btn
            variant="primary"
            className="w-full sm:w-auto"
            onClick={() => void runAll()}
            disabled={allBusy}
            aria-busy={allBusy || undefined}
            aria-label={allBusy ? 'กำลังทดสอบการเชื่อมต่อทั้งหมด' : undefined}
          >
            {allBusy ? <Spinner /> : <Icon d={ICON.refresh} />}
            ทดสอบการเชื่อมต่อทั้งหมด
          </Btn>
        ),
      )}

      {/* Always mounted: a live region created with its text is not announced. */}
      <p role="status" className="sr-only">
        {live}
      </p>

      <div className="grid gap-4 pb-1 xl:grid-cols-2">
        {/* ══ 1. Swagger UI ══ */}
        <section className={CARD} aria-labelledby="ig-docs-title">
          <CardTitle
            id="ig-docs-title"
            icon={ICON.code}
            iconTone="bg-primary/10 text-primary"
            title="เอกสาร API และ Swagger UI"
            sub="หน้าทดลองเรียก API และสเปก OpenAPI ที่ easybook-app ใช้สร้าง type อัตโนมัติ"
          />

          {/* `.sw-toggle` (role="switch", 44×44, measured borders). The knob moves only when the
              server has answered — this is a live write, not a form value. */}
          <div
            className={`flex min-h-11 items-center justify-between gap-4 rounded-control border border-base-300 px-3.5 py-2 ${
              isSuper ? '' : 'bg-base-200'
            }`}
          >
            <span className="min-w-0">
              <span id="ig-sw-label" className="block text-[14px] font-medium leading-[1.5] text-base-content">
                เปิดใช้งาน Swagger UI และ OpenAPI Spec{' '}
                <span className="font-mono text-[13px] text-base-content/70">(/docs, /docs-json)</span>
              </span>
              <span id="ig-sw-state" className="block text-[13px] leading-[1.5] text-base-content/70">
                {swaggerOn
                  ? 'เปิดใช้งานแล้ว — ทุกคนที่เข้าถึงเซิร์ฟเวอร์ได้จะเห็นรายการ API ทั้งหมด'
                  : 'ปิดการเข้าถึงอยู่ (ค่าเริ่มต้นเพื่อความปลอดภัย)'}
                {!isSuper && ' · เปลี่ยนได้เฉพาะ Super Admin'}
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={swaggerOn}
              aria-labelledby="ig-sw-label"
              aria-describedby="ig-sw-state"
              aria-busy={swaggerBusy || undefined}
              disabled={!isSuper || swaggerBusy}
              onClick={() => void toggleSwagger()}
              className="sw-toggle disabled:cursor-not-allowed"
            >
              <span className="sw-track">
                <span className="sw-knob" />
              </span>
            </button>
          </div>

          <div
            role="note"
            className="flex items-start gap-2.5 rounded-control border border-warning/40 bg-warning/10 px-3.5 py-3 text-[14px] leading-[1.6] text-base-content"
          >
            <Icon d={ICON.warn} className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <p className="m-0">
              ควรปิด Swagger UI บนเซิร์ฟเวอร์ที่เปิดให้บุคคลภายนอกเข้าถึง (Production)
              เพราะหน้านี้เปิดเผยโครงสร้าง API ทั้งหมด ให้เปิดเฉพาะช่วงพัฒนาหรือทดสอบระบบเท่านั้น
            </p>
          </div>

          <div className="mt-auto">
            {/* An <a> has no disabled state: no `href` is what actually stops Enter. */}
            <a
              href={swaggerOn ? DOCS_URL : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!swaggerOn || undefined}
              tabIndex={swaggerOn ? undefined : -1}
              className={`btn-ghost2 inline-flex ${SMALL_BTN} ${
                swaggerOn ? '' : 'pointer-events-none opacity-50'
              }`}
            >
              <Icon d={ICON.external} className="h-4 w-4 shrink-0" />
              เปิดหน้า Swagger UI
              <span className="sr-only">(เปิดในแท็บใหม่)</span>
            </a>
          </div>
        </section>

        {/* ══ 2. LINE Developers ══ */}
        <section className={CARD} aria-labelledby="ig-line-title">
          <CardTitle
            id="ig-line-title"
            icon={ICON.chat}
            iconTone="bg-success/10 text-success"
            title="LINE Developers"
            sub="Messaging API, Webhook และ LIFF ของ LINE Official Account"
            aside={
              <>
                <Badge tone={lineBadge.tone}>{lineBadge.label}</Badge>
                {isSuper ? (
                  !editing && (
                    <Btn ref={editBtn} className={SMALL_BTN} onClick={startEdit}>
                      <Icon d={ICON.pencil} className="h-4 w-4 shrink-0" />
                      แก้ไขการตั้งค่า
                    </Btn>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-base-content/10 px-2 py-0.5 text-[12px] font-medium text-base-content/80">
                    <Icon d={ICON.lock} className="h-3.5 w-3.5 shrink-0" />
                    แก้ไขได้เฉพาะ Super Admin
                  </span>
                )}
              </>
            }
          />

          {/* Bot profile, from GET /v2/bot/info. */}
          <div className="flex items-center gap-3 rounded-control bg-base-200 px-3.5 py-3">
            {bot?.pictureUrl ? (
              <img
                src={bot.pictureUrl}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-success text-[18px] font-semibold text-success-content"
              >
                {(bot?.displayName ?? 'L').slice(0, 1)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate text-[15px] font-semibold text-base-content">
                {bot?.displayName ?? 'LINE Official Account'}
              </p>
              <p className="m-0 font-mono text-[13px] text-base-content/70">
                {bot?.basicId ?? (line.configured ? 'อ่านข้อมูลบอทไม่ได้' : 'ยังไม่ได้เชื่อมต่อ')}
              </p>
            </div>
            {bot && (
              <Badge tone="slate" className={`shrink-0 ${PILL}`}>
                โหมดแชต: {chatModeOf(bot.chatMode).label}
              </Badge>
            )}
          </div>

          {editing && draft ? (
            <div className="flex flex-col gap-3">
              <FormField
                ref={firstField}
                label="Channel ID"
                inputMode="numeric"
                autoComplete="off"
                placeholder={line.channelId ? `${line.channelId} — เว้นว่างไว้หากไม่เปลี่ยน` : '10 หลัก'}
                value={draft.channelId}
                onChange={(e) => setField('channelId', e.target.value)}
                error={errors.channelId}
              />
              <FormField
                label="Channel Secret"
                type="password"
                autoComplete="new-password"
                placeholder="เว้นว่างไว้หากไม่เปลี่ยน"
                value={draft.secret}
                onChange={(e) => setField('secret', e.target.value)}
                error={errors.secret}
              />
              <FormField
                label="Access Token"
                type="password"
                autoComplete="new-password"
                placeholder="เว้นว่างไว้หากไม่เปลี่ยน"
                value={draft.token}
                onChange={(e) => setField('token', e.target.value)}
                error={errors.token}
              />
              {/* Card-local actions, directly under the fields they commit. */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-warning/40 bg-warning/10 px-3.5 py-3">
                <p className="m-0 flex min-w-0 items-center gap-2 text-[14px] text-base-content">
                  <span aria-hidden="true" className="status status-warning" />
                  มีผลกับระบบทันทีเมื่อบันทึก — ค่าอื่นในหน้านี้ไม่เปลี่ยน
                </p>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                  <Btn className="w-full sm:w-auto" onClick={cancelEdit} disabled={saving}>
                    ยกเลิก
                  </Btn>
                  <Btn
                    variant="primary"
                    className="w-full sm:w-auto"
                    onClick={() => void saveEdit()}
                    disabled={saving}
                    aria-busy={saving || undefined}
                    aria-label={saving ? 'กำลังบันทึก' : undefined}
                  >
                    {saving && <Spinner />}
                    บันทึก
                  </Btn>
                </div>
              </div>
            </div>
          ) : (
            <dl className="m-0 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5 text-[14px]">
              <dt className="text-base-content/70">Channel ID</dt>
              <dd className="m-0 min-w-0 truncate font-mono text-base-content">
                {line.channelId ?? <span className="font-sans text-base-content/70">ยังไม่ได้บันทึก</span>}
              </dd>
              <dt className="text-base-content/70">Channel Secret</dt>
              <dd className="m-0 font-mono tracking-wider text-base-content">
                <span aria-hidden="true">••••••••</span>
                <span className="sr-only">ซ่อนไว้</span>
              </dd>
              <dt className="text-base-content/70">Access Token</dt>
              <dd className="m-0 flex min-w-0 flex-wrap items-center gap-2">
                <span aria-hidden="true" className="font-mono tracking-wider text-base-content">
                  ••••••••
                </span>
                <span className="sr-only">ซ่อนไว้</span>
                {!line.configured ? (
                  <Badge tone="amber" className={PILL}>
                    ยังไม่ได้ตั้งค่า
                  </Badge>
                ) : tokenPending ? (
                  <Badge tone="amber" className={PILL}>
                    รอตรวจสอบ
                  </Badge>
                ) : bot ? (
                  <Badge tone="emerald" className={PILL}>
                    เชื่อมต่อแล้ว
                  </Badge>
                ) : (
                  <Badge tone="rose" className={PILL}>
                    ตรวจสอบไม่ผ่าน
                  </Badge>
                )}
              </dd>
              <dt className="self-start text-base-content/70">ผลการตรวจสอบ</dt>
              <dd className="m-0 min-w-0">
                <span className="block font-medium text-base-content">{quotaSentence}</span>
                {quota && quota.total !== null && (
                  <span
                    aria-hidden="true"
                    className="mt-1.5 block h-1.5 w-full max-w-60 overflow-hidden rounded-full bg-base-content/10"
                  >
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${quotaPct}%` }} />
                  </span>
                )}
                <span className="mt-1 block text-[12px] text-base-content/70">
                  โควต้าข้อความ Push ประจำเดือน · การตรวจสอบนี้ไม่ใช้โควต้า
                </span>
              </dd>
            </dl>
          )}

          <div className="flex flex-col gap-3">
            <CopyRow id="ig-webhook-url" label="Webhook URL" value={WEBHOOK_URL} onCopy={(i) => void copy(i)} />
            {LIFF_URL && (
              <CopyRow id="ig-liff-url" label="LIFF Endpoint URL" value={LIFF_URL} onCopy={(i) => void copy(i)} />
            )}
          </div>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
            <Checked at={checked.line} />
            {!editing && (
              <ProbeBtn
                primary
                busy={busy.line}
                onClick={() => void runOne('line')}
                icon={ICON.shield}
                label="ตรวจสอบสถานะ Token (Verify Token)"
                busyLabel="กำลังตรวจสอบ Token"
              />
            )}
          </div>
        </section>

        {/* ══ 3. Cloudflare R2 — read-only for every role ══ */}
        <section className={CARD} aria-labelledby="ig-r2-title">
          <CardTitle
            id="ig-r2-title"
            icon={ICON.cloud}
            iconTone="bg-info/10 text-info"
            title="Cloudflare R2"
            sub="ที่เก็บรูปภาพสถานที่ รูปโปรไฟล์ และไฟล์แนบของประกาศ"
            aside={<Badge tone={storageBadge.tone}>{storageBadge.label}</Badge>}
          />
          <dl className="m-0 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5 text-[14px]">
            <dt className="text-base-content/70">Bucket</dt>
            <dd className="m-0 min-w-0 truncate font-mono text-base-content">{storage.bucket ?? '—'}</dd>
            <dt className="text-base-content/70">Public Base URL</dt>
            <dd className="m-0 min-w-0 truncate font-mono text-[13px] text-base-content">
              {storage.publicBaseUrl ?? '—'}
            </dd>
            <dt className="text-base-content/70">อ่าน / เขียน</dt>
            <dd className="m-0 flex flex-wrap items-center gap-1.5">
              <span className="text-[13px] text-base-content/70">อ่าน</span>
              {perm(storageProbe?.read)}
              <span className="ml-1 text-[13px] text-base-content/70">เขียน</span>
              {perm(storageProbe?.write)}
            </dd>
            <dt className="text-base-content/70">เวลาตอบสนอง</dt>
            <dd className="m-0 tabular-nums text-base-content">
              {storageProbe ? `${storageProbe.latencyMs} ms` : '—'}
            </dd>
          </dl>
          <p className="m-0 flex items-start gap-2 text-[13px] leading-[1.55] text-base-content/70">
            <Icon d={ICON.lock} className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              ค่าเหล่านี้แก้ไขจากหน้านี้ไม่ได้ เพราะผูกกับที่อยู่ของรูปภาพทุกไฟล์ในระบบ
              การย้าย Bucket ต้องทำผ่านการ Deploy โดยผู้ดูแลเซิร์ฟเวอร์
            </span>
          </p>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
            <Checked at={checked.r2} />
            <ProbeBtn
              busy={busy.r2}
              onClick={() => void runOne('r2')}
              label="ทดสอบการเชื่อมต่อ"
              busyLabel="กำลังทดสอบ Cloudflare R2"
            />
          </div>
        </section>

        {/* ══ 4. Core infrastructure ══ */}
        <section className={CARD} aria-labelledby="ig-infra-title">
          <CardTitle
            id="ig-infra-title"
            icon={ICON.db}
            iconTone="bg-base-content/10 text-base-content/80"
            title="โครงสร้างพื้นฐานหลัก"
            sub="ฐานข้อมูลและแคชเซสชันที่ระบบต้องใช้ทุกคำขอ"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Service
              name="PostgreSQL"
              meta="Prisma 7.x"
              status={DB_STATUS[infrastructure.database.status]}
              latencyMs={infrastructure.database.latencyMs}
            />
            <Service
              name="Redis"
              meta="Session cache"
              status={REDIS_STATUS[infrastructure.redis.status]}
              latencyMs={infrastructure.redis.latencyMs}
            />
          </div>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
            <Checked at={checked.infra} />
            <ProbeBtn
              busy={busy.infra}
              onClick={() => void runOne('infra')}
              label="ตรวจสอบอีกครั้ง"
              busyLabel="กำลังตรวจสอบ PostgreSQL และ Redis"
            />
          </div>
        </section>
      </div>
    </div>
  )
}
