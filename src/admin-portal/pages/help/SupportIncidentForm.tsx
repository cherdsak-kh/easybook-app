/**
 * Zone 3 of ติดต่อทีมผู้พัฒนา — แจ้งปัญหาการใช้งานถึงทีมพัฒนา.
 *
 * The browser POSTs the report to `easybook-service`, which relays it to the dev team's Discord. The
 * relay URL is a secret that never reaches this bundle, and nothing is stored: if Discord refuses, the
 * operator sees the server's sentence and THE FORM KEEPS EVERYTHING (D6), so a retry costs one click.
 *
 * ⚠️ `noValidate` + our own messages. The browser's bubbles are English on most school machines and
 * vanish on scroll. Two fields are required (หน้าจอ, อาการ); the rest have defaults.
 *
 * ⚠️ DIAGNOSTICS ARE ALWAYS ATTACHED, with no box to copy and no checkbox to forget — a report
 * without them is the one the team cannot act on. They are built at SUBMIT time so เวลา and บทบาท are
 * the moment it was sent, and carry บทบาท only: never a name, email or phone. The server ignores the
 * role inside them and takes the real one from the session.
 *
 * ⚠️ NO BUSY `disabled` ON THE SUBMIT BUTTON for the same reason as the recheck button: `disabled`
 * blurs it, and a failed attempt would leave a keyboard user on `<body>`. `useBusy.run` is the
 * double-submit guard; `aria-disabled` + `btn-disabled` is the look.
 */

import { useEffect, useId, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, FormEvent } from 'react'
import {
  ApiError,
  submitSupportIncident,
  supportErrorCode,
  type SupportIncidentCategory,
  type SupportIncidentSeverity,
  type SystemVersionResult,
} from '@/lib/api-client'
import { Spinner } from '../../components/feedback/Spinner'
import { Card, CardHead } from '../../components/ui/Card'
import { ROLE_LABEL } from '../../labels'
import { useAuth } from '../../lib/auth-context'
import { useBusy } from '../../lib/use-busy'
import { useToast } from '../../lib/toast-context'
import { APP, thaiStamp } from '../../lib/version'
import { SupportEmbed, type SupportReceipt } from './SupportEmbed'
import {
  CATEGORY_OPTIONS,
  DESCRIPTION_MAX,
  PATH_MAX,
  SEVERITY_OPTIONS,
  acceptFiles,
  buildDiagnostics,
  categoryLabel,
  failureMessage,
  formatSize,
  phoneLine,
  reporterLine,
  validateReport,
  type ReportErrors,
} from './support-model'

const FILE_ICON =
  'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 19.5h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z'
const DROP_ICON =
  'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z'
const SEND_ICON =
  'M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5'
const OK_ICON = 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
const WARN_ICON =
  'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z'

/** `navigator.userAgentData` is not in the DOM lib yet; fall back to the deprecated `platform`. */
function platformName(): string {
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
  return uaData?.platform || navigator.platform || '—'
}

export function SupportIncidentForm({ version }: { version: SystemVersionResult | null }) {
  const { user } = useAuth()
  const toast = useToast()
  const { busy, run } = useBusy()

  const ids = useId()
  const catId = `${ids}-cat`
  const sevId = `${ids}-sev`
  const pathId = `${ids}-path`
  const pathErrId = `${ids}-path-err`
  const descId = `${ids}-desc`
  const descErrId = `${ids}-desc-err`
  const countId = `${ids}-count`
  const fileId = `${ids}-file`
  const fileErrId = `${ids}-file-err`

  const [category, setCategory] = useState<SupportIncidentCategory>('web')
  const [severity, setSeverity] = useState<SupportIncidentSeverity>('normal')
  const [path, setPath] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [errors, setErrors] = useState<ReportErrors>({})
  const [fileError, setFileError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [receipt, setReceipt] = useState<SupportReceipt | null>(null)

  const pathRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  // Focus the receipt once it is on screen: the button the operator pressed now belongs to an empty
  // form, so leaving focus there would announce nothing.
  useEffect(() => {
    if (receipt) resultRef.current?.focus()
  }, [receipt])

  const clearForm = () => {
    setCategory('web')
    setSeverity('normal')
    setPath('')
    setDescription('')
    setFiles([])
    setErrors({})
    setFileError('')
    setSubmitError('')
  }

  const addFiles = (incoming: File[]) => {
    const next = acceptFiles(files, incoming)
    setFiles(next.files)
    setFileError(next.error)
  }

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []))
    // Clear it, or picking the same file again after removing it fires no `change`.
    e.target.value = ''
  }

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setDragOver(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  const removeFile = (index: number) => {
    setFiles((cur) => cur.filter((_, i) => i !== index))
    setFileError('')
    // The button just pressed is gone; land on the picker, not <body>.
    fileRef.current?.focus()
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (busy) return

    const p = path.trim()
    const d = description.trim()
    const found = validateReport(p, d)
    setErrors(found)
    if (found.path || found.description) {
      ;(found.path ? pathRef : descRef).current?.focus()
      return
    }

    setSubmitError('')
    void run(async () => {
      const diagnostics = buildDiagnostics({
        appVersion: APP.version,
        appBuild: APP.build,
        server: version?.ok ? { version: version.value.version, build: version.value.build } : null,
        roleLabel: user ? ROLE_LABEL[user.role] : '—',
        userAgent: navigator.userAgent,
        platform: platformName(),
        width: window.innerWidth,
        height: window.innerHeight,
        stamp: thaiStamp(),
      })
      try {
        const res = await submitSupportIncident({
          category,
          severity,
          path: p,
          description: d,
          diagnostics,
          files,
        })
        setReceipt({
          code: res.code,
          severity,
          category: categoryLabel(category),
          path: p,
          description: d,
          reporter: user
            ? reporterLine(user.firstName, user.lastName, ROLE_LABEL[user.role])
            : '—',
          phone: phoneLine(user?.phoneNumber),
          files,
          diagnostics,
          timestamp: res.timestamp,
        })
        toast('success', `ส่งแจ้งเตือน ${res.code} แล้ว`)
        clearForm()
      } catch (err) {
        // The form keeps every field and file (D6). 401 is `AuthProvider`'s to handle.
        setSubmitError(
          err instanceof ApiError
            ? failureMessage(err.status, supportErrorCode(err), err.message)
            : failureMessage(null, undefined, ''),
        )
      }
    })
  }

  return (
    <Card className="overflow-hidden" aria-labelledby="sp-form-title">
      <CardHead
        id="sp-form-title"
        title="แจ้งปัญหาการใช้งานถึงทีมพัฒนา"
        subtitle="ส่งตรงถึงทีมพัฒนาทันที พร้อมแนบข้อมูลเวอร์ชันและเบราว์เซอร์ของคุณให้โดยอัตโนมัติ"
      />
      <form
        aria-labelledby="sp-form-title"
        className="pf-body flex flex-col gap-4"
        noValidate
        onSubmit={onSubmit}
        onReset={(e) => {
          e.preventDefault()
          clearForm()
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor={catId} className="label mb-1">
              ประเภทปัญหา
            </label>
            <select
              id={catId}
              className="select select-bordered w-full"
              value={category}
              onChange={(e) => setCategory(e.target.value as SupportIncidentCategory)}
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label htmlFor={sevId} className="label mb-1">
              ความรุนแรง
            </label>
            <select
              id={sevId}
              className="select select-bordered w-full"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as SupportIncidentSeverity)}
            >
              {SEVERITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="min-w-0">
          <label htmlFor={pathId} className="label mb-1">
            หน้าจอที่พบปัญหา
          </label>
          <input
            ref={pathRef}
            id={pathId}
            type="text"
            className={`input input-bordered w-full font-mono text-[14px] placeholder:text-base-content/70 ${errors.path ? 'input-error' : ''}`.trim()}
            placeholder="เช่น /backend/bookings/requests"
            // The server's cap; typing past it would only earn an uncoded 400.
            maxLength={PATH_MAX}
            autoComplete="off"
            spellCheck={false}
            value={path}
            aria-invalid={errors.path ? true : undefined}
            aria-describedby={pathErrId}
            onChange={(e) => {
              setPath(e.target.value)
              if (e.target.value.trim()) setErrors((cur) => ({ ...cur, path: undefined }))
            }}
          />
          <p id={pathErrId} className="m-0 mt-1 min-h-[19px] text-[13px] leading-[1.45] text-error">
            {errors.path}
          </p>
        </div>

        <div className="min-w-0">
          <label htmlFor={descId} className="label mb-1">
            อาการที่พบ
          </label>
          <textarea
            ref={descRef}
            id={descId}
            className={`textarea textarea-bordered min-h-24 w-full placeholder:text-base-content/70 ${errors.description ? 'textarea-error' : ''}`.trim()}
            maxLength={DESCRIPTION_MAX}
            rows={4}
            placeholder="ข้อความระบุอาการและขั้นตอนที่เกิดปัญหา เช่น กดปุ่มอนุมัติแล้วหน้าจอค้าง ไม่มีข้อความแจ้ง"
            value={description}
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={`${descErrId} ${countId}`}
            onChange={(e) => {
              setDescription(e.target.value)
              if (e.target.value.trim()) setErrors((cur) => ({ ...cur, description: undefined }))
            }}
          />
          <div className="mt-1 flex items-start justify-between gap-3">
            <p id={descErrId} className="m-0 min-h-[19px] text-[13px] leading-[1.45] text-error">
              {errors.description}
            </p>
            <span id={countId} className="shrink-0 text-[12px] tabular-nums text-base-content/60">
              {description.length}/{DESCRIPTION_MAX}
            </span>
          </div>
        </div>

        {/* The dropzone is a <label> for the file input, so a click, Enter on the focused input and
            a drop all reach the same handler. Images only, three at most, 5 MB each. */}
        <div className="min-w-0">
          <span className="label mb-1">ภาพหน้าจอ (ไม่บังคับ)</span>
          <label
            htmlFor={fileId}
            className={`sp-drop ${dragOver ? 'is-over' : ''}`.trim()}
            onDragEnter={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              setDragOver(false)
            }}
            onDrop={onDrop}
          >
            <input
              ref={fileRef}
              id={fileId}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="sr-only"
              aria-describedby={fileErrId}
              onChange={onPick}
            />
            <svg
              aria-hidden="true"
              className="h-7 w-7 text-base-content/60"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={DROP_ICON} />
            </svg>
            <span className="text-[14px] font-medium text-base-content/90">
              ลากไฟล์มาวาง หรือ
              <span className="text-primary underline underline-offset-2">เลือกไฟล์</span>
            </span>
            <span className="text-[12px] text-base-content/70">
              PNG, JPG หรือ WEBP · สูงสุด 3 ภาพ ภาพละไม่เกิน 5 MB
            </span>
          </label>
          <ul
            hidden={files.length === 0}
            aria-label="ภาพหน้าจอที่แนบ"
            className="m-0 mt-2 flex list-none flex-col gap-2 p-0"
          >
            {files.map((f, i) => (
              <li
                key={`${f.name}-${f.size}-${f.lastModified}-${i}`}
                className="flex min-h-11 items-center gap-3 rounded-control border border-base-300 bg-base-100 py-1 pl-3 pr-1"
              >
                <svg
                  aria-hidden="true"
                  className="h-4.5 w-4.5 shrink-0 text-base-content/60"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={FILE_ICON} />
                </svg>
                <span className="min-w-0 flex-1 truncate text-[14px] text-base-content/90">
                  {f.name}
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-base-content/70">
                  {formatSize(f.size)}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm w-11 px-0"
                  aria-label={`ลบไฟล์ ${f.name}`}
                  onClick={() => removeFile(i)}
                >
                  <svg
                    aria-hidden="true"
                    className="h-4.5 w-4.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
          <p
            id={fileErrId}
            role="status"
            className="m-0 mt-1 min-h-[19px] text-[13px] leading-[1.45] text-error"
          >
            {fileError}
          </p>
        </div>

        {/* Always rendered, hidden when empty: a live region is only announced if it existed
            before its text arrived. */}
        <div role="alert" hidden={!submitError} className="alert alert-error alert-soft">
          <svg
            aria-hidden="true"
            className="h-5 w-5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={WARN_ICON} />
          </svg>
          <span className="min-w-0 text-[14px]">{submitError}</span>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-base-300 pt-4 sm:flex-row sm:justify-end">
          <button type="reset" className="btn btn-ghost w-full sm:w-auto">
            ล้างแบบฟอร์ม
          </button>
          <button
            type="submit"
            className={`btn btn-primary w-full sm:w-auto ${busy ? 'btn-disabled' : ''}`.trim()}
            aria-disabled={busy}
            aria-busy={busy || undefined}
            aria-label={busy ? 'กำลังส่งข้อมูลถึงทีมพัฒนา' : undefined}
          >
            {busy ? (
              <Spinner />
            ) : (
              <svg
                aria-hidden="true"
                className="h-4.5 w-4.5 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={SEND_ICON} />
              </svg>
            )}
            <span>ส่งแจ้งปัญหาถึงทีมพัฒนา</span>
          </button>
        </div>
      </form>

      {/* The receipt: what the team's channel received. */}
      {receipt && (
        <div
          ref={resultRef}
          tabIndex={-1}
          className="border-t border-base-300 px-4 py-4 sm:px-5"
        >
          <div className="alert alert-success alert-soft">
            <svg
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-success"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={OK_ICON} />
            </svg>
            <div className="min-w-0 text-[14px]">
              <p className="m-0 font-medium">ส่งแจ้งปัญหา {receipt.code} ถึงทีมพัฒนาแล้ว</p>
              <p className="m-0 mt-0.5 text-[13px] text-base-content/70">
                ตัวอย่างข้อความแจ้งเตือนที่ส่งถึงทีมพัฒนา
              </p>
            </div>
          </div>
          <div className="mt-3">
            <SupportEmbed receipt={receipt} />
          </div>
        </div>
      )}
    </Card>
  )
}
