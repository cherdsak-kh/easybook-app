/**
 * `ศูนย์ส่งออกรายงานราชการ`: `/backend/reports/export`, Hub 4. Ports prototype
 * `[data-route="reports-export"]` (markup L8513–8708, module L25483–25844) onto `GET /reports/export`
 * (the document model) and `GET /reports/export/xlsx` (`02_design_log.md` §2.3, §3.3).
 *
 * A STUDIO, not a dashboard: pick a form, a period and an optional scope, and the A4 sheet below IS
 * the document. The prototype built the sheet and the CSV from one `build()`; the port moved that
 * builder to the server, so the sheet, the `.xlsx` and any future output come from ONE model and
 * cannot disagree. This page computes no figure.
 *
 * ⚠️ THE URL IS THE STATE (D-9, AC-E3). The page is entered from Hubs 1 to 3 with a range in the query,
 * or from a bookmark. `parseExportParams` validates it ONCE on entry and falls back to defaults with a
 * notice on the echo line; after that every control change is written back with `replace`, so F5
 * reproduces the document and Back leaves the page rather than stepping through settings.
 *
 * ⚠️ AN INVALID RANGE MAKES NO REQUEST, and so does an unverified scope id carried by the link: the page
 * waits for `scope-options` to say whether the venue or department exists for THIS role (the reserved
 * department is absent for an ADMIN) before asking for a document that would be a 400.
 *
 * ⚠️ ONE REQUEST IN FLIGHT. Every state change aborts the previous request and a `seq` guard drops a
 * late answer, so rapid clicking never paints a stale document over a newer one.
 *
 * ⚠️ THE `.xlsx` IS A SERVER URL, never a blob, in LINE's in-app browser (`downloadFile`), and print
 * waits for the Sarabun faces before `window.print()` so the first page is not set in a fallback face.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ApiError,
  downloadFile,
  getReportDocument,
  getReportScopeOptions,
  isLineInAppBrowser,
  reportExportErrorCode,
  reportXlsxUrl,
  type ReportDocument,
  type ReportExportErrorCode,
  type ReportScopeOptions,
} from '@/lib/api-client'
import { LoadError, type LoadErrorKind } from '../../components/feedback/LoadError'
import { Spinner } from '../../components/feedback/Spinner'
import { PageHeading } from '../../components/shell/PageHeading'
import { REPORT_TEMPLATE_LABEL } from '../../labels'
import { useBusy } from '../../lib/use-busy'
import { useToast } from '../../lib/toast-context'
import type { AdminRoute } from '../../routes'
import { ExportRangeFields } from './components/ExportRangeFields'
import { ExportScopeSelects, type ScopeStatus } from './components/ExportScopeSelects'
import { ExportTemplatePicker } from './components/ExportTemplatePicker'
import { ReportSheet, ReportSheetSkeleton } from './components/ReportSheet'
import {
  NOTICE_SCOPE,
  defaultExportParams,
  parseExportParams,
  reconcileScope,
  serializeExportParams,
  toExportApiParams,
  type ExportParams,
  type ExportTemplateKey,
} from './export-params'
import { rangeEcho } from './report-presets'
import { todayIsoLocal, useReportRange } from './use-report-range'

/** A failed document request: a network/server/403 panel, or a coded 400 the user can act on. */
type DocError = { kind: LoadErrorKind } | { kind: 'coded'; code: ReportExportErrorCode }

const docErrorOf = (err: unknown): DocError => {
  const status = err instanceof ApiError ? err.status : 0
  if (status === 0) return { kind: 'network' }
  if (status === 403) return { kind: 'forbidden' }
  const code = reportExportErrorCode(err)
  if (status === 400 && code) return { kind: 'coded', code }
  return { kind: 'server' }
}

const CODED_COPY: Record<ReportExportErrorCode, string> = {
  REPORT_DATE_INVALID: 'วันที่ไม่ถูกต้อง กรุณาตรวจสอบช่วงเวลาที่เลือก',
  REPORT_RANGE_INVERTED: 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น',
  REPORT_RANGE_TOO_WIDE: 'ช่วงวันที่ต้องไม่เกิน 366 วัน',
  REPORT_PERIOD_MISMATCH: 'ช่วงวันที่ไม่ตรงกับภาคเรียนหรือเดือนที่เลือก',
  REPORT_VENUE_INVALID: 'ไม่พบสถานที่ที่เลือก ลองเลือกขอบเขตใหม่',
  REPORT_DEPARTMENT_INVALID: 'ไม่พบกลุ่มสาระ/ฝ่ายที่เลือก ลองเลือกขอบเขตใหม่',
  REPORT_DOCUMENT_TOO_LARGE:
    'เอกสารมีรายการเกิน 20,000 แถว กรุณาเลือกช่วงเวลาหรือขอบเขตให้แคบลง',
}

const NO_DATA_TITLE = 'ไม่มีข้อมูลสำหรับจัดทำเอกสาร'

const EXCEL_D =
  'M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5'
const PRINT_D =
  'M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z'
const EYE_D =
  'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z'
const DOC_D =
  'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z'

export function ExportPage({ route }: { route: AdminRoute }) {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  // Parsed ONCE, on entry (D-9). Everything after this is state written back to the URL.
  const [entry] = useState(() => parseExportParams(searchParams.toString(), todayIsoLocal()))
  const defaults = useMemo(() => defaultExportParams(todayIsoLocal()), [])

  const range = useReportRange({
    mode: entry.params.period,
    presetId: entry.params.preset ?? defaults.preset!,
    from: entry.params.startDate,
    to: entry.params.endDate,
  })
  const { mode, presetId, from, to, validationError } = range

  const [template, setTemplate] = useState<ExportTemplateKey>(entry.params.template)
  const [venueId, setVenueId] = useState<string | null>(entry.params.venueId)
  const [departmentId, setDepartmentId] = useState<number | null>(entry.params.departmentId)
  const [notice, setNotice] = useState<string | null>(entry.notice)

  // ── Scope choices ──────────────────────────────────────────────────────────────────────────
  const [scope, setScope] = useState<ReportScopeOptions | null>(null)
  const [scopeStatus, setScopeStatus] = useState<ScopeStatus>('loading')
  const [scopeTick, setScopeTick] = useState(0)
  // A link that carries a scope id must wait for the server's say-so; a link that does not has
  // nothing to verify and must not wait for an unrelated request.
  const [scopeChecked, setScopeChecked] = useState(
    entry.params.venueId === null && entry.params.departmentId === null,
  )
  const scopeIds = useRef({ venueId, departmentId })
  useEffect(() => {
    scopeIds.current = { venueId, departmentId }
  }, [venueId, departmentId])

  useEffect(() => {
    const ac = new AbortController()
    setScopeStatus('loading')
    getReportScopeOptions(ac.signal)
      .then((res) => {
        if (ac.signal.aborted) return
        setScope(res)
        setScopeStatus('ready')
        const kept = reconcileScope({ ...defaults, ...scopeIds.current }, res)
        if (kept.notice) {
          setVenueId(kept.params.venueId)
          setDepartmentId(kept.params.departmentId)
          setNotice((n) => (n ? `${n} · ${kept.notice}` : kept.notice))
        }
        setScopeChecked(true)
      })
      .catch(() => {
        if (ac.signal.aborted) return
        setScopeStatus('error')
        // An id that cannot be verified is not sent.
        if (scopeIds.current.venueId !== null || scopeIds.current.departmentId !== null) {
          setVenueId(null)
          setDepartmentId(null)
          setNotice((n) => (n ? `${n} · ${NOTICE_SCOPE}` : NOTICE_SCOPE))
        }
        setScopeChecked(true)
      })
    return () => ac.abort()
  }, [scopeTick, defaults])

  // ── The document ───────────────────────────────────────────────────────────────────────────
  const params: ExportParams = useMemo(
    () => ({
      template,
      period: mode,
      preset: mode === 'custom' ? null : presetId,
      startDate: from,
      endDate: to,
      venueId,
      departmentId,
    }),
    [template, mode, presetId, from, to, venueId, departmentId],
  )

  const [doc, setDoc] = useState<ReportDocument | null>(null)
  const [docError, setDocError] = useState<DocError | null>(null)
  const [live, setLive] = useState('')
  const [reloadTick, setReloadTick] = useState(0)
  const seq = useRef(0)

  useEffect(() => {
    if (validationError || !scopeChecked) return
    const mine = ++seq.current
    const ac = new AbortController()
    setDoc(null)
    setDocError(null)
    getReportDocument(toExportApiParams(params), ac.signal)
      .then((res) => {
        if (mine !== seq.current) return
        setDoc(res)
        setLive(`ปรับตัวอย่างเอกสารแล้ว: ${REPORT_TEMPLATE_LABEL[res.template]} ${res.header.period}`)
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted || mine !== seq.current) return
        setDocError(docErrorOf(err))
      })
    return () => ac.abort()
  }, [params, validationError, scopeChecked, reloadTick])

  // ── URL write-back (replace): F5 reproduces the document, Back leaves the page ────────────────
  useEffect(() => {
    if (validationError) return
    const next = serializeExportParams(params)
    if (searchParams.toString() !== next) setSearchParams(next, { replace: true })
  }, [params, validationError, searchParams, setSearchParams])

  // A notice describes the LINK; the moment the user changes something it is no longer about what is on
  // screen, and a stale "แสดงภาคเรียนปัจจุบันแทน" over a month they just picked would be a lie.
  const touch =
    <A extends unknown[]>(fn: (...a: A) => void) =>
    (...a: A) => {
      setNotice(null)
      fn(...a)
    }

  const resetAll = () => {
    setTemplate(defaults.template)
    range.resetToCurrentTerm()
    setVenueId(null)
    setDepartmentId(null)
    setNotice(null)
  }

  // ── Outputs ────────────────────────────────────────────────────────────────────────────────
  const printing = useBusy()
  const downloading = useBusy()
  const ready = doc !== null && !validationError
  const empty = ready && doc.isEmpty
  const canOutput = ready && !doc.isEmpty

  const print = () =>
    printing.run(async () => {
      if (isLineInAppBrowser()) {
        toast('info', 'หากพิมพ์ไม่ได้ ให้เปิดหน้านี้ในเบราว์เซอร์ภายนอก')
      }
      // The sheet is TH Sarabun PSK at 15pt: print before the faces are in and page one is set in
      // the fallback and reflows. `load()` asks for both weights the sheet uses; `ready` waits for
      // whatever else is pending. A browser without the API prints at once.
      try {
        await document.fonts.load('15pt "TH Sarabun PSK"')
        await document.fonts.load('bold 15pt "TH Sarabun PSK"')
        await document.fonts.ready
      } catch {
        // Printing must not depend on font loading succeeding.
      }
      window.print()
    })

  const downloadExcel = () =>
    downloading.run(async () => {
      if (!doc) return
      try {
        await downloadFile(reportXlsxUrl(toExportApiParams(params)), doc.fileName)
        toast('success', 'ดาวน์โหลดไฟล์รายงานสำเร็จ')
      } catch (err) {
        const status = err instanceof ApiError ? err.status : 0
        toast(
          'error',
          status === 403
            ? 'คุณไม่มีสิทธิ์ส่งออกรายงานราชการ'
            : status === 0
              ? 'ดาวน์โหลดไฟล์ไม่สำเร็จ เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง'
              : 'ดาวน์โหลดไฟล์ไม่สำเร็จ ลองใหม่อีกครั้ง',
        )
      }
    })

  // ── Echo line ──────────────────────────────────────────────────────────────────────────────
  const echoBase = validationError
    ? validationError
    : doc
      ? rangeEcho({
          from,
          to,
          dataUntilDate: doc.range.dataUntilDate,
          schoolDays: doc.range.schoolDays,
        })
      : rangeEcho({ from, to, dataUntilDate: to, schoolDays: 0 })
  const echo = !validationError && notice ? `${echoBase} · ${notice}` : echoBase

  const retry = useCallback(() => setReloadTick((n) => n + 1), [])

  return (
    <div className="card-shell rp-page relative lg:overflow-y-auto">
      <PageHeading
        route={route}
        title="ศูนย์ส่งออกรายงานราชการ"
        desc="จัดทำและพิมพ์เอกสารสรุปสถิติเสนอผู้บริหารสถานศึกษาและเทศบาลเมืองท่าโขลง หรือส่งออกไฟล์ Excel"
        descAtEveryWidth
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={() => void downloadExcel()}
              disabled={!canOutput || downloading.busy}
              title={empty ? NO_DATA_TITLE : undefined}
              aria-busy={downloading.busy || undefined}
              className="btn btn-outline min-h-11"
            >
              {downloading.busy ? (
                <Spinner />
              ) : (
                <svg aria-hidden="true" className="h-4.5 w-4.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={EXCEL_D} />
                </svg>
              )}
              ดาวน์โหลดไฟล์ Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={() => void print()}
              disabled={!canOutput || printing.busy}
              title={empty ? NO_DATA_TITLE : undefined}
              aria-busy={printing.busy || undefined}
              className="btn btn-primary min-h-11"
            >
              {printing.busy ? (
                <Spinner />
              ) : (
                <svg aria-hidden="true" className="h-4.5 w-4.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={PRINT_D} />
                </svg>
              )}
              พิมพ์เอกสาร / บันทึก PDF
            </button>
          </div>
        }
      />

      {/* ── Configuration ── */}
      <section className="card mb-4 border border-base-300 bg-base-100 shadow-sm" aria-labelledby="rpe-cfg-h">
        <div className="card-body gap-4">
          <h2 id="rpe-cfg-h" className="sr-only">
            ตั้งค่าเอกสาร
          </h2>
          <ExportTemplatePicker value={template} onChange={touch(setTemplate)} />
          <ExportRangeFields
            mode={mode}
            onModeChange={touch(range.selectMode)}
            presets={range.presets}
            presetId={presetId}
            onPresetChange={touch(range.selectPreset)}
            from={from}
            to={to}
            onFromChange={touch(range.editFrom)}
            onToChange={touch(range.editTo)}
            echo={echo}
            echoError={validationError !== null}
          />
          <ExportScopeSelects
            options={scope}
            status={scopeStatus}
            venueId={venueId}
            departmentId={departmentId}
            onVenueChange={touch(setVenueId)}
            onDepartmentChange={touch(setDepartmentId)}
            onRetry={() => setScopeTick((n) => n + 1)}
          />
        </div>
      </section>

      <p role="status" aria-live="polite" className="sr-only">
        {live}
      </p>

      {/* ── The sheet and its states ── */}
      {validationError ? (
        <div className="card border border-base-300 bg-base-100 shadow-sm">
          <p className="m-0 px-6 py-10 text-center text-[14px] text-base-content/70">
            ตรวจสอบช่วงวันที่ด้านบนให้ถูกต้อง แล้วตัวอย่างเอกสารจะแสดงอีกครั้ง
          </p>
        </div>
      ) : docError ? (
        docError.kind === 'coded' ? (
          <div className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <h2 className="text-[18px] font-semibold text-base-content th-tight">
                จัดทำเอกสารไม่ได้
              </h2>
              <p role="alert" className="mt-1.5 max-w-md text-[14px] leading-[1.6] text-base-content/70 th-tight">
                {CODED_COPY[docError.code]}
              </p>
              <button type="button" className="btn btn-primary mt-5 min-h-11" onClick={resetAll}>
                ใช้ภาคเรียนปัจจุบัน
              </button>
            </div>
          </div>
        ) : (
          <div className="card border border-base-300 bg-base-100 shadow-sm">
            <LoadError kind={docError.kind} onRetry={retry} />
          </div>
        )
      ) : !doc ? (
        <ReportSheetSkeleton />
      ) : doc.isEmpty ? (
        <div className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-base-200">
              <svg aria-hidden="true" className="h-8 w-8 text-base-content/60" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={DOC_D} />
              </svg>
            </div>
            <h2 className="text-[18px] font-semibold text-base-content th-tight">{NO_DATA_TITLE}</h2>
            <p className="mt-1.5 max-w-md text-[14px] leading-[1.6] text-base-content/70 th-tight">
              ช่วงเวลาหรือขอบเขตที่เลือกไม่มีคำขอจองสถานที่ ลองเลือกภาคเรียนปัจจุบันหรือขยายขอบเขต
            </p>
            <button type="button" className="btn btn-primary mt-5 min-h-11" onClick={resetAll}>
              ใช้ภาคเรียนปัจจุบัน
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="mb-2 flex items-center gap-2 px-1 text-[13px] text-base-content/70">
            <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={EYE_D} />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            ตัวอย่างเอกสาร (กระดาษ A4) (สิ่งที่เห็นคือสิ่งที่จะพิมพ์)
          </p>
          <ReportSheet doc={doc} />
        </div>
      )}
    </div>
  )
}
