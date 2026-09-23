/**
 * สร้างประกาศใหม่ / แก้ไขฉบับร่าง / ประกาศที่ส่งแล้ว — the compose dialog (`#an-modal`), its live LINE
 * preview, and the two confirms. Modes `create` · `edit` · `view` (phase 4 D-1…D-13, design §2).
 *
 * ── Delete (ANNOUNCE-UI-6 D-1) ──
 * A writer can delete from `edit` (a DRAFT, `ลบฉบับร่าง`) AND from `view` (a SENT row, `ลบประกาศ`) —
 * the server soft-deletes both. One flow, one `ConfirmModal`; only the WORDING changes, and it is
 * picked from `record.status`, never from `mode` (`DELETE_COPY`, design S-2). A VIEWER never sees it.
 *
 * ── Who owns what ──
 * The PAGE owns only whether a dialog is open and what it was opened with; it re-keys this component
 * on every open. EVERYTHING that happens while open is owned here — the form, the record, the mode,
 * the lock and the confirms — and after opening this never reads the page's rows again, which is why
 * a list re-read behind the dialog cannot make it flicker.
 *
 * ── The React 19 dialog trap (plan D-13) ──
 * No `<form>` at all (design A-2), every button is `Btn` (`type="button"`), and both `ConfirmModal`s
 * are SIBLINGS of the compose `Modal` — never inside it — so no form is ever nested. Closing goes
 * only through `Modal`'s `onClose`; nothing here calls `el.close()`.
 *
 * ── The lock ──
 * `inFlight` is set SYNCHRONOUSLY as the first statement of `save`, `runSend` and `runDelete`, and
 * cleared in `finally`: a second click that lands before React re-renders returns at once. With
 * `ConfirmModal`'s own `useBusy` ref that is two independent guards against a double send (AC-11).
 * While locked every input and button is disabled and both dialogs are non-dismissable (Esc, ✕).
 * There is NO client timeout and NO AbortController: aborting does not stop the server, it would only
 * turn a send that succeeds into a false failure (plan D-3).
 *
 * ⚠️ READ STATE INTO LOCALS AT THE START OF A SEQUENCE. After an `await` the closure's `mode`,
 * `record` and `form` are stale; the sequences carry their own `rec`.
 *
 * ⚠️ `onChanged()` (the page's list + counts re-read) runs ONCE per sequence that issued a request,
 * in `finally` — and BEFORE `onClose`, so the page knows a re-read is in flight when it decides where
 * focus returns to.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { ConfirmModal } from '../../../components/feedback/ConfirmModal'
import { Spinner } from '../../../components/feedback/Spinner'
import { Btn } from '../../../components/ui/Btn'
import type { ComboboxOption } from '../../../components/ui/Combobox'
import { Modal } from '../../../components/ui/Modal'
import { ANNOUNCEMENT_AUDIENCE } from '../../../labels'
import { useToast } from '../../../lib/toast-context'
import {
  FIELD_ID,
  firstInvalid,
  fromRecord,
  isDirty,
  toPayload,
  validate,
  type DialogMode,
  type FieldErrors,
  type FieldKey,
  type FormValues,
} from '../announcement-form'
import { ICON } from '../announcement-icons'
import {
  afterReread,
  deleteOutcome,
  deletedToast,
  saveOutcome,
  savedToast,
  sendOutcome,
  sentToast,
  type AlertSpec,
  type AlertTone,
  type Outcome,
  type ToastSpec,
} from '../announcement-outcomes'
import { audienceLabel, DEPARTMENT_GONE, metaLine } from '../announcement-record'
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncement,
  sendAnnouncement,
  updateAnnouncement,
  type Announcement,
  type LineBotInfo,
} from '../announcements-api'
import { useAnnouncementDepartments } from '../use-announcement-departments'
import { AnnouncementFields, type DeptField } from './AnnouncementFields'
import { Glyph } from './AnnouncementGlyph'
import { LinePreview } from './LinePreview'

type Busy = null | 'save' | 'send' | 'delete'

/** Where focus lands once a write settles and the controls are enabled again (design §2.5). */
type FocusTarget = FieldKey | 'close' | 'save'

/** What a settled attempt leaves behind: close with a toast, or stay and focus something. */
interface Settlement {
  close: ToastSpec | null
  focus: FocusTarget | null
}

const STAY: Settlement = { close: null, focus: null }

/** Appended to a department this user can no longer pick (D-9) — shown, never silently swapped. */
const UNAVAILABLE = ' (ไม่พร้อมใช้งาน)'

/**
 * The delete wording, by the RECORD's status (ANNOUNCE-UI-6 D-1). The consequences differ: a draft
 * never reached anyone, a sent one did — and the LINE message cannot be recalled.
 */
const DELETE_COPY = {
  DRAFT: {
    button: 'ลบฉบับร่าง',
    title: 'ลบฉบับร่างนี้?',
    description: 'ลบแล้วกู้คืนไม่ได้',
    confirm: 'ลบฉบับร่าง',
  },
  SENT: {
    button: 'ลบประกาศ',
    title: 'ยืนยันการลบประกาศ?',
    description:
      'ประกาศจะถูกนำออกจากรายการ (ข้อความที่ส่งเข้า LINE ไปแล้วจะไม่สามารถเรียกคืนได้)',
    confirm: 'ลบประกาศ',
  },
} as const

const ALERT_LOOK: Record<AlertTone, { box: string; ico: string; d: string }> = {
  error: { box: 'inline-alert !mb-0', ico: 'inline-alert-ico', d: ICON.alert },
  warn: { box: 'inline-warn !mb-0', ico: 'inline-warn-ico', d: ICON.warning },
  info: { box: 'inline-note', ico: 'inline-note-ico', d: ICON.info },
}

/**
 * The result region — the first row of the FOOTER (design A-7), because the footer never scrolls: at
 * 390 × 700 an alert at the end of the body would sit below the fold.
 *
 * ⚠️ ALWAYS MOUNTED, hidden when empty (the `InlineAlert` rule): a `role="alert"` created at the same
 * moment as its text is silent. The shared `InlineAlert` is error-only, hence this local one.
 */
function DialogAlert({ alert }: { alert: AlertSpec | null }) {
  const look = ALERT_LOOK[alert?.tone ?? 'error']
  return (
    <div role="alert" className={`${look.box} ${alert ? '' : 'hidden'}`.trim()}>
      <Glyph d={look.d} className={look.ico} />
      <p className="m-0 wrap-anywhere">{alert?.text}</p>
    </div>
  )
}

export function AnnouncementDialog({
  open,
  initialMode,
  initialRecord,
  canWrite,
  oa,
  onClose,
  onChanged,
}: {
  open: boolean
  initialMode: DialogMode
  /** `null` only for `create`. Opened FROM THE ROW DATA — no spinner, no GET (D-10). */
  initialRecord: Announcement | null
  canWrite: boolean
  /** The phase-3 OA info when it loaded; the preview falls back to `LINE Official Account`. */
  oa: LineBotInfo | null
  /** `changed` — a request was issued while this dialog was open. Idempotent on the page side. */
  onClose: (r: { changed: boolean }) => void
  /** Re-read the list AND the tab counts. */
  onChanged: () => void
}) {
  const toast = useToast()

  const [mode, setMode] = useState<DialogMode>(initialMode)
  /** `null` only in `create` before the first successful POST. */
  const [record, setRecord] = useState<Announcement | null>(initialRecord)
  const [form, setForm] = useState<FormValues>(() => fromRecord(initialRecord))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [alert, setAlert] = useState<AlertSpec | null>(null)
  const [busy, setBusy] = useState<Busy>(null)
  const [confirm, setConfirm] = useState<null | 'send' | 'delete'>(null)

  const inFlight = useRef(false)
  /** Any request issued this session — reported through `onClose`. */
  const changed = useRef(false)
  /** The plain save path: spent when `busy` clears (the FeedbackDetailModal `refocusSave` pattern). */
  const afterSave = useRef<FocusTarget | null>(null)
  /** The confirm paths: spent after the confirm's own `Modal` restore (design §2.5). */
  const focusAfter = useRef<FocusTarget | null>(null)
  const saveRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  // A VIEWER and every `view` open never call `GET /departments` — it is `@Roles(SUPER_ADMIN, ADMIN)`.
  const depts = useAnnouncementDepartments(canWrite && initialMode !== 'view')

  const locked = busy !== null

  const focusTarget = (t: FocusTarget) => {
    if (t === 'save') saveRef.current?.focus()
    else if (t === 'close') closeRef.current?.focus()
    else document.getElementById(FIELD_ID[t])?.focus()
  }

  // `create`/`edit`: focus the title. The child `Modal`'s effect has already run `showModal()`.
  // `view`: the platform default (the ✕), since every field is disabled.
  useEffect(() => {
    if (open && initialMode !== 'view') document.getElementById(FIELD_ID.title)?.focus()
  }, [open, initialMode])

  // `disabled` blurred whatever had focus; put it back once the controls are enabled again.
  useEffect(() => {
    if (busy !== null || !afterSave.current) return
    const t = afterSave.current
    afterSave.current = null
    focusTarget(t)
  }, [busy])

  /**
   * A successful ลองอีกครั้ง unmounts the button the keyboard is on; the department picker it was
   * retrying takes focus instead of `<body>`. A failed retry keeps the button, and its focus.
   */
  const retryFocus = useRef(false)
  const retryDepts = () => {
    retryFocus.current = true
    depts.refresh()
  }
  useEffect(() => {
    if (!retryFocus.current) return
    if (depts.state.status === 'ok') {
      retryFocus.current = false
      focusTarget('departmentId')
    } else if (depts.state.status === 'failed' && !depts.state.retrying) {
      retryFocus.current = false
    }
  }, [depts.state])

  /* ── departments → options (design §1.4) ── */

  const deptField = useMemo<DeptField>(() => {
    if (mode === 'view') {
      const d = record?.department
      return {
        options: [{ id: d?.id ?? 0, name: d?.name ?? DEPARTMENT_GONE }],
        loading: false,
        failed: false,
        retrying: false,
        unavailable: false,
      }
    }
    const id = form.departmentId
    const known =
      id === null
        ? undefined
        : record?.department?.id === id
          ? record.department.name
          : depts.seen[id]
    const s = depts.state
    // Loading or failed: availability is NOT judged — the record's own department shows by name
    // and the server decides (D-9).
    if (s.status !== 'ok') {
      return {
        options: id !== null && known ? [{ id, name: known }] : [],
        loading: s.status === 'loading',
        failed: s.status === 'failed',
        retrying: s.status === 'failed' && s.retrying,
        unavailable: false,
      }
    }
    const options: ComboboxOption<number>[] = s.rows
      .filter((r) => !r.isFallback)
      .map((r) => ({ id: r.id, name: r.name, reserved: r.isSystemReserved || undefined }))
    const unavailable = id !== null && !options.some((o) => o.id === id)
    // `fallback` WITHOUT `reserved`: `Combobox` renders it only while it is the value, so it shows as
    // the current value and is never offered as a choice.
    if (unavailable && known) options.push({ id, name: `${known}${UNAVAILABLE}`, fallback: true })
    return { options, loading: false, failed: false, retrying: false, unavailable }
  }, [mode, record, form.departmentId, depts.state, depts.seen])

  const deptUnavailable = form.audience === 'DEPARTMENT' && deptField.unavailable

  const audienceText =
    mode === 'view' && record
      ? audienceLabel(record)
      : form.audience === 'ALL'
        ? ANNOUNCEMENT_AUDIENCE.ALL
        : `${ANNOUNCEMENT_AUDIENCE.DEPARTMENT} · ${
            deptField.options.find((o) => o.id === form.departmentId)?.name ?? 'ยังไม่ได้เลือก'
          }`

  /* ── form edits ── */

  /** Each error clears when ITS field changes; the department's also when the audience does. */
  const change = (patch: Partial<FormValues>) => {
    setForm((f) => ({ ...f, ...patch }))
    const cleared: FieldKey[] = []
    if ('title' in patch) cleared.push('title')
    if ('body' in patch) cleared.push('body')
    if ('departmentId' in patch || 'audience' in patch) cleared.push('departmentId')
    setErrors((e) => {
      if (!cleared.some((k) => e[k] !== undefined)) return e
      const next = { ...e }
      for (const k of cleared) delete next[k]
      return next
    })
  }

  /** Client validation. `true` = go on; otherwise the errors show and the first field has focus. */
  const passes = (intent: 'save' | 'send') => {
    const errs = validate(form, intent, deptUnavailable)
    const first = firstInvalid(errs)
    if (!first) return true
    setErrors(errs)
    focusTarget(first)
    return false
  }

  /* ── record transitions (design §2.1) ── */

  /** A POST or PATCH landed: the dialog takes the record over, so a retry never POSTs again. */
  const adopt = (rec: Announcement) => {
    setRecord(rec)
    setMode('edit')
  }

  /** There is no transition out of `view`. Typed edits are discarded — the record can no longer take them. */
  const toView = (rec: Announcement) => {
    setRecord(rec)
    setForm(fromRecord(rec))
    setErrors({})
    setMode('view')
  }

  /**
   * Applies a failure's outcome (`announcement-outcomes.ts`). May `GET :id` for the reconciling rows.
   * Never throws: every API call it makes returns its failure as a value.
   */
  const settle = async (o: Outcome, rec: Announcement | null): Promise<Settlement> => {
    switch (o.kind) {
      case 'none':
        return STAY
      case 'close':
        return { close: o.toast, focus: null }
      case 'alert':
        setAlert(o.alert)
        return STAY
      case 'field':
        setErrors((e) => ({ ...e, [o.field]: o.text }))
        if (o.alert) setAlert(o.alert)
        if (o.refetchDepts) depts.refresh()
        // The server's `ANNOUNCEMENT_BODY_REQUIRED` means the STORED body is blank (it trims on
        // write), whatever this form shows. Say so in the snapshot, so the next send PATCHes the
        // body first instead of repeating the same refused send.
        if (o.field === 'body') setRecord((r) => (r ? { ...r, body: '' } : r))
        return { close: null, focus: o.field }
      case 'reread': {
        // Shown FIRST: for an unknown outcome the message stands whatever the re-read says.
        setAlert(o.alert)
        if (!rec) return STAY
        const got = await getAnnouncement(rec.id)
        const s = afterReread(o.reason, got, rec, o.acceptedCount)
        if (s.kind === 'close') return { close: s.toast, focus: null }
        if (s.kind === 'view') {
          toView(s.record)
          return { close: null, focus: 'close' }
        }
        if (s.record) setRecord(s.record)
        return STAY
      }
    }
  }

  /** Every exit a user can take: the ✕, Esc, ยกเลิก, ปิด. */
  const requestClose = () => onClose({ changed: changed.current })

  /** Runs at the end of every sequence, after the lock is released. */
  const finish = (s: Settlement, issued: boolean) => {
    if (issued) onChanged()
    if (s.close) {
      toast(s.close.kind, s.close.text)
      onClose({ changed: true })
    }
  }

  /* ── บันทึกฉบับร่าง — no confirm ── */

  const save = async () => {
    if (inFlight.current) return
    if (!passes('save')) return // no request
    const rec = record
    const patchId = mode !== 'create' && rec ? rec.id : null
    // A-9: an unchanged draft is not re-saved. A pointless PATCH moves `updatedAt`, which throws
    // away the retry-key protection after a `LINE_SEND_FAILED` (plan D-2).
    if (patchId && rec && !isDirty(form, rec)) {
      toast('success', savedToast(rec.title))
      requestClose()
      return
    }

    inFlight.current = true
    setBusy('save')
    setAlert(null)
    const payload = toPayload(form)
    let s: Settlement = STAY
    try {
      const r = patchId ? await updateAnnouncement(patchId, payload) : await createAnnouncement(payload)
      changed.current = true
      if (r.ok) s = { close: { kind: 'success', text: savedToast(r.value.title) }, focus: null }
      else s = await settle(saveOutcome(r, patchId ? 'patch' : 'create'), rec)
    } finally {
      inFlight.current = false
      // Stays open: a field that took the error, the ปิด button of a `view`, else บันทึกฉบับร่าง.
      afterSave.current = s.close ? null : (s.focus ?? 'save')
      setBusy(null)
      finish(s, true)
    }
  }

  /* ── ส่งประกาศ — validate, confirm, then save if needed, then send (plan D-2) ── */

  const requestSend = () => {
    if (inFlight.current) return
    if (!passes('send')) return // no confirm, no request
    setConfirm('send')
  }

  const runSend = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy('send')
    setAlert(null)
    const f = form
    let rec = record
    const patchNeeded = mode !== 'create' && rec !== null && isDirty(f, rec)
    /** This attempt created or changed the draft — the send error then says it is saved. */
    let savedNow = false
    let issued = false
    let s: Settlement = STAY
    try {
      if (mode === 'create' || rec === null) {
        const r = await createAnnouncement(toPayload(f))
        issued = true
        changed.current = true
        if (!r.ok) {
          // Stop: nothing was created and nothing was sent.
          s = await settle(saveOutcome(r, 'create'), null)
          return
        }
        rec = r.value
        adopt(rec)
        savedNow = true
      } else if (patchNeeded) {
        const r = await updateAnnouncement(rec.id, toPayload(f))
        issued = true
        changed.current = true
        if (!r.ok) {
          s = await settle(saveOutcome(r, 'patch'), rec)
          return
        }
        rec = r.value
        adopt(rec)
        savedNow = true
      }
      const r = await sendAnnouncement(rec.id)
      issued = true
      changed.current = true
      s = r.ok
        ? { close: { kind: 'success', text: sentToast(r.value.title, r.value.sentCount) }, focus: null }
        : await settle(sendOutcome(r, savedNow), rec)
    } finally {
      inFlight.current = false
      focusAfter.current = s.close ? null : s.focus
      setBusy(null)
      setConfirm(null)
      finish(s, issued)
    }
  }

  /* ── ลบฉบับร่าง (edit) / ลบประกาศ (view) — behind a danger confirm (plan D-5, ANNOUNCE-UI-6 D-1) ── */

  const requestDelete = () => {
    if (inFlight.current || !record) return
    setConfirm('delete')
  }

  const runDelete = async () => {
    if (inFlight.current || !record) return
    const rec = record
    inFlight.current = true
    setBusy('delete')
    setAlert(null)
    let s: Settlement = STAY
    try {
      const r = await deleteAnnouncement(rec.id)
      changed.current = true
      // A 409 is an inline alert with NO re-read: the dialog stays in its mode, and the confirm's
      // `Modal` gives focus back to the delete button, enabled again in the same commit.
      s = r.ok
        ? { close: { kind: 'success', text: deletedToast(rec.title, rec.status) }, focus: null }
        : await settle(deleteOutcome(r, rec.status), rec)
    } finally {
      inFlight.current = false
      focusAfter.current = s.close ? null : s.focus
      setBusy(null)
      setConfirm(null)
      finish(s, true)
    }
  }

  /**
   * A confirm closed (cancelled, or settled by us). `Modal` restores focus to its opener INSIDE the
   * `close` handler, which runs after any effect — so the target is focused in a timeout, after it.
   */
  const closeConfirm = () => {
    if (inFlight.current) return
    setConfirm(null)
    const t = focusAfter.current
    focusAfter.current = null
    if (t) setTimeout(() => focusTarget(t), 0)
  }

  /* ── render ── */

  const title =
    mode === 'create'
      ? 'สร้างประกาศใหม่'
      : mode === 'edit'
        ? 'แก้ไขฉบับร่าง'
        : record?.status === 'SENT'
          ? 'ประกาศที่ส่งแล้ว'
          : 'ฉบับร่าง'

  const meta = mode === 'create' || !record ? null : metaLine(record, mode === 'edit' ? 'edit' : 'view')

  /** By the RECORD's status, never the mode (design S-2). `create` never renders a delete button. */
  const delCopy = DELETE_COPY[record?.status ?? 'DRAFT']

  const footer =
    mode === 'view' ? (
      canWrite && record ? (
        <>
          <DialogAlert alert={alert} />
          {/* The edit footer's split: from `sm` the delete sits left and ปิด right; on a phone ปิด
              is on top and the destructive button furthest from the thumb. A writer only reaches
              `view` on a SENT row, so this is always `ลบประกาศ`. */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            <Btn
              variant="danger"
              className="w-full sm:mr-auto sm:w-auto"
              disabled={locked}
              onClick={requestDelete}
            >
              {delCopy.button}
            </Btn>
            <Btn
              ref={closeRef}
              variant="ghost"
              className="w-full sm:w-auto"
              disabled={locked}
              onClick={requestClose}
            >
              ปิด
            </Btn>
          </div>
        </>
      ) : (
        <>
          <DialogAlert alert={alert} />
          <div className="flex flex-col sm:flex-row sm:justify-end">
            <Btn ref={closeRef} variant="ghost" className="w-full sm:w-auto" onClick={requestClose}>
              ปิด
            </Btn>
          </div>
        </>
      )
    ) : (
      <>
        <DialogAlert alert={alert} />
        {/* DOM order → phone, top to bottom: ส่งประกาศ, บันทึกฉบับร่าง, ยกเลิก, the warning,
            ลบฉบับร่าง. The commit sits under the thumb and the destructive button furthest from it
            (the split-footer precedent); from `sm` the delete is split away to the left. */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {mode === 'edit' && (
            <Btn variant="danger" className="w-full sm:w-auto" disabled={locked} onClick={requestDelete}>
              {delCopy.button}
            </Btn>
          )}
          <p className="m-0 text-center text-[13px] text-base-content/70 sm:mr-auto sm:text-left">
            ประกาศที่ส่งแล้วไม่สามารถเรียกคืนได้
          </p>
          <Btn variant="ghost" className="w-full sm:w-auto" disabled={locked} onClick={requestClose}>
            ยกเลิก
          </Btn>
          {/* The visible label never changes (`useBusy` rule); the busy words go to `aria-label`. */}
          <Btn
            ref={saveRef}
            variant="ghost"
            className="w-full sm:w-auto"
            disabled={locked}
            aria-busy={busy === 'save' || undefined}
            aria-label={busy === 'save' ? 'กำลังบันทึก' : undefined}
            onClick={() => void save()}
          >
            {busy === 'save' && <Spinner />}
            บันทึกฉบับร่าง
          </Btn>
          <Btn variant="primary" className="w-full sm:w-auto" disabled={locked} onClick={requestSend}>
            <Glyph d={ICON.send} />
            ส่งประกาศ
          </Btn>
        </div>
      </>
    )

  const trimmedTitle = form.title.trim()

  return (
    <>
      <Modal
        open={open}
        onClose={requestClose}
        title={title}
        width={960}
        tall
        // Mid-write, closing would leave the operator unsure whether the send happened (A-3 makes
        // this hold for a second Esc too).
        dismissable={!locked}
        footerClassName="flex flex-col gap-3"
        footer={footer}
      >
        {/* DOM order is the stacking order below `lg`: the form first, then the phone (AC-2). */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <AnnouncementFields
            mode={mode}
            values={form}
            errors={errors}
            disabled={mode === 'view' || locked}
            meta={meta}
            dept={deptField}
            onChange={change}
            onRetryDepts={retryDepts}
          />
          <LinePreview
            values={form}
            recordSentAt={record?.status === 'SENT' ? record.sentAt : null}
            oa={oa}
            audienceText={audienceText}
          />
        </div>
      </Modal>

      {/* ── Siblings of the compose `Modal`, never inside it (plan D-13) ── */}
      <ConfirmModal
        open={open && confirm === 'send'}
        onClose={closeConfirm}
        onConfirm={runSend}
        tone="primary"
        title="ยืนยันการส่งประกาศ?"
        who={
          <>
            <span className="block wrap-anywhere">{trimmedTitle}</span>
            <span className="mt-0.5 block text-[14px] font-normal text-base-content/70">
              ส่งถึง: {audienceText}
            </span>
          </>
        }
        description={
          <>
            ข้อความจะถูกส่งไปยัง LINE ของผู้ใช้งานทันทีและไม่สามารถยกเลิกได้
            {busy === 'send' && (
              <span className="mt-2 block text-[13px] text-base-content/70">
                อาจใช้เวลาสักครู่ โปรดอย่าปิดหน้านี้
              </span>
            )}
          </>
        }
        confirmLabel="ส่งประกาศ"
        busyLabel="กำลังส่ง…"
      />
      {/* ONE instance for both statuses; only the props change (ANNOUNCE-UI-6 D-1). */}
      <ConfirmModal
        open={open && confirm === 'delete'}
        onClose={closeConfirm}
        onConfirm={runDelete}
        tone="danger"
        title={delCopy.title}
        who={<span className="wrap-anywhere">{record?.title}</span>}
        description={delCopy.description}
        confirmLabel={delCopy.confirm}
        busyLabel="กำลังลบ…"
      />
    </>
  )
}
