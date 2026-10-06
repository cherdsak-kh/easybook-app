/**
 * The receipt under the form: the message the dev team's channel received.
 *
 * ⚠️ THE RELAY SENDS MARKDOWN, NOT AN EMBED. Discord's `content` is rendered as a chat message and the
 * screenshots as a native gallery under it, so this is drawn as a message — bot line, `#` heading,
 * `>` blockquote, `||spoiler||` fields, fenced code blocks — and not as a card with a colour bar.
 * Severity survives as the emoji at the end of the heading and the mention line above it.
 *
 * ⚠️ IT SHOWS WHAT WAS SENT, NOT WHAT THE SERVER MINTED OUT OF THIN AIR. `code` and `timestamp` come
 * from the relay's own response, so the preview and the Discord message carry the same incident number
 * and instant. Everything else is the submitted form, snapshotted at submit time — the form itself has
 * been reset by the time this is on screen. Reporter name, role and phone come from the signed-in
 * session (`/auth/system/me`), which is what the server reads them from too.
 *
 * Every string goes in as a React text child, so a description containing markup renders as text.
 */

import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import type { SupportIncidentSeverity } from '@/lib/api-client'
import {
  SEVERITY_STYLE,
  bangkokParts,
  incidentDateLine,
  incidentHeading,
} from './support-model'

export interface SupportReceipt {
  code: string
  severity: SupportIncidentSeverity
  category: string
  path: string
  description: string
  /** Already formatted: `ชื่อ นามสกุล  (บทบาท)`. */
  reporter: string
  /** Already formatted: the number, or `ไม่ได้ระบุ`. */
  phone: string
  /** The files that were sent; the preview makes (and revokes) its own object URLs for them. */
  files: readonly File[]
  diagnostics: string
  /** The server's `timestamp`, ISO. Formatted in Bangkok time at paint. */
  timestamp: string
}

const CODE_BOX =
  'rounded-control border border-base-300 bg-base-200 px-2.5 py-1.5 font-mono text-[13px] leading-[1.6] text-base-content'

/** `**label:**` — Discord's bold. */
function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="m-0 text-[14px] font-bold text-base-content">{children}</p>
}

/**
 * `||```…```||` — masked until pressed, like Discord's spoiler. A real button, so Enter and Space
 * work and a screen reader hears the state: while masked its name is `maskedLabel` (the blurred text
 * itself is `aria-hidden`), once revealed its name is the text. Pressing again hides it.
 */
function Spoiler({ maskedLabel, children }: { maskedLabel: string; children: string }) {
  const [shown, setShown] = useState(false)
  return (
    <button
      type="button"
      aria-expanded={shown}
      aria-label={shown ? undefined : maskedLabel}
      onClick={() => setShown((v) => !v)}
      className={`${CODE_BOX} block min-h-11 w-full cursor-pointer whitespace-pre-wrap break-words text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-base-content ${shown ? '' : 'select-none'}`}
    >
      <span
        aria-hidden={shown ? undefined : true}
        className={
          shown
            ? ''
            : 'rounded-sm bg-base-300 text-transparent [text-shadow:0_0_8px_var(--color-base-content)] motion-safe:transition-all'
        }
      >
        {children}
      </span>
    </button>
  )
}

/** The attached files as a thumbnail grid; object URLs are made on mount and revoked on unmount. */
function Gallery({ files }: { files: readonly File[] }) {
  const [urls, setUrls] = useState<string[]>([])
  useEffect(() => {
    const made = files.map((f) => URL.createObjectURL(f))
    setUrls(made)
    return () => {
      made.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [files])

  if (files.length === 0) return null
  return (
    <ul
      aria-label="ภาพหน้าจอที่แนบ"
      className="m-0 mt-3 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3"
    >
      {files.map((f, i) => (
        <li
          key={`${f.name}-${f.size}-${f.lastModified}-${i}`}
          className="aspect-4/3 min-w-0 overflow-hidden rounded-control border border-base-300 bg-base-200"
        >
          {urls[i] && (
            <img
              src={urls[i]}
              alt={`ภาพหน้าจอที่ ${i + 1}: ${f.name}`}
              className="h-full w-full object-cover"
            />
          )}
        </li>
      ))}
    </ul>
  )
}

export function SupportEmbed({ receipt: r }: { receipt: SupportReceipt }) {
  const s = SEVERITY_STYLE[r.severity]
  const at = bangkokParts(r.timestamp)
  const headId = useId()

  return (
    <article
      aria-labelledby={headId}
      className="rounded-control border border-base-300 bg-base-100 p-3.5"
    >
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-base-content/70">
        <span className="font-semibold text-base-content">EasyBook Incident Bot</span>
        <span className="badge badge-neutral badge-sm">BOT</span>
        <span className="tabular-nums">{at ? `${at.hh}.${at.mm} น.` : '—'}</span>
      </div>

      {s.ping && (
        <p className="m-0 mt-2 text-[14px]">
          <span className="rounded-sm bg-primary/20 px-1 font-medium text-primary">{s.ping}</span>
        </p>
      )}

      <h3
        id={headId}
        className="m-0 mt-2 break-words text-[20px] font-extrabold leading-[1.35] text-base-content"
      >
        {incidentHeading(r.code, r.timestamp, r.severity)}
      </h3>
      <blockquote className="m-0 mt-1 break-words whitespace-pre-wrap border-l-4 border-base-content/30 pl-3 text-[14px] text-base-content/80">
        {incidentDateLine(r.timestamp)}
      </blockquote>

      <div aria-hidden="true" className="h-3" />

      <div className="flex flex-col gap-1.5">
        <FieldLabel>ผู้แจ้ง:</FieldLabel>
        <Spoiler maskedLabel="แสดงข้อมูลผู้แจ้ง">{r.reporter}</Spoiler>
        <FieldLabel>เบอร์โทรศัพท์:</FieldLabel>
        <Spoiler maskedLabel="แสดงเบอร์โทรศัพท์">{r.phone}</Spoiler>
      </div>

      <div aria-hidden="true" className="h-3" />

      <div className="flex flex-col gap-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <FieldLabel>ประเภท:</FieldLabel>
          <code className={`${CODE_BOX} min-w-0 break-words`}>{r.category}</code>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <FieldLabel>ระดับ:</FieldLabel>
          <code className={`${CODE_BOX} min-w-0 break-words`}>{s.label}</code>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <FieldLabel>หน้าที่พบปัญหา:</FieldLabel>
          <code className={`${CODE_BOX} min-w-0 break-all`}>{r.path}</code>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <FieldLabel>รายละเอียด:</FieldLabel>
          <pre className={`${CODE_BOX} m-0 max-h-40 overflow-auto whitespace-pre-wrap break-words`}>
            {r.description}
          </pre>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <FieldLabel>ข้อมูลเวอร์ชันระบบ:</FieldLabel>
          <pre
            className={`${CODE_BOX} m-0 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[12px]`}
          >
            {r.diagnostics}
          </pre>
        </div>
      </div>

      <Gallery files={r.files} />
    </article>
  )
}
