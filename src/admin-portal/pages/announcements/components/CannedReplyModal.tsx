/**
 * เพิ่ม / แก้ไขข้อความตอบกลับด่วน — the create/edit dialog (ANNOUNCE-UI-6 D-4, design §2.5).
 *
 * ── Who owns what ──
 * The CARD owns only whether this is open and what it was opened with, re-keys it on every open and
 * renders it ONCE at card level — never inside an item, which could unmount with the `<dialog>` open
 * (design S-4). Everything while open — the form, the errors, the alert, the lock — is owned here,
 * and this calls `useToast` itself (the `AnnouncementDialog` split).
 *
 * ── The React 19 dialog trap (phase 4 D-13) ──
 * NO `<form>` at all and every button is `Btn` (`type="button"`), so Enter in หัวข้อ has nothing to
 * submit and can never close the dialog. `FormField` / `Field` render their own messages. The
 * backdrop never closes it (`Modal`'s default); Esc, ✕ and ยกเลิก close it at once (D-6) — except
 * while a write is in flight (`dismissable={false}`).
 *
 * ── The lock ──
 * `inFlight` is set SYNCHRONOUSLY before the request and cleared in `finally`, so a second click that
 * lands before React re-renders returns at once: exactly one POST/PATCH (AC-17).
 */

import { useEffect, useRef, useState } from 'react'
import { InlineAlert } from '../../../components/feedback/InlineAlert'
import { Spinner } from '../../../components/feedback/Spinner'
import { Btn } from '../../../components/ui/Btn'
import { Field, FormField } from '../../../components/ui/FormField'
import { Modal } from '../../../components/ui/Modal'
import { useToast } from '../../../lib/toast-context'
import { createCannedReply, updateCannedReply, type CannedReply } from '../canned-replies-api'
import {
  CANNED_TEXT_MAX,
  CANNED_TITLE_MAX,
  cannedSaveOutcome,
  createdToast,
  firstInvalidCanned,
  isUnchanged,
  toInput,
  updatedToast,
  validateCanned,
  valuesOf,
  type CannedChange,
  type CannedErrors,
  type CannedField,
  type CannedValues,
} from '../canned-reply-outcomes'

/** The `AnnouncementFields` counter recipe: below the field, referenced from `aria-describedby`. */
const COUNTER = 'm-0 mt-1.5 text-right text-[13px] tabular-nums text-base-content/70'

/** A required mark that is decoration only — `aria-required` and the error say it in words. */
const Star = () => (
  <span aria-hidden="true" className="text-error">
    *
  </span>
)

export function CannedReplyModal({
  open,
  target,
  onClose,
  onCommitted,
}: {
  open: boolean
  /** `null` = create. The row as it was when the pencil was pressed. */
  target: CannedReply | null
  /** Idempotent on the card side — `Modal` calls it twice (the ✕, then its `close` event). */
  onClose: () => void
  /** Apply a change to the card's list now, then let it reconcile with a GET. */
  onCommitted: (change: CannedChange) => void
}) {
  const toast = useToast()
  const [values, setValues] = useState<CannedValues>(() => valuesOf(target))
  const [errors, setErrors] = useState<CannedErrors>({})
  const [alert, setAlert] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const inFlight = useRef(false)
  /** Set when a write settled and the dialog stayed open: spent once `busy` clears (S-14). */
  const refocusSave = useRef(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const saveRef = useRef<HTMLButtonElement>(null)

  // Focus หัวข้อ on open. The child `Modal`'s effect has already run `showModal()`.
  useEffect(() => {
    if (open) titleRef.current?.focus()
  }, [open])

  // `disabled` blurred บันทึก; put focus back on it once the controls are enabled again.
  useEffect(() => {
    if (busy || !refocusSave.current) return
    refocusSave.current = false
    saveRef.current?.focus()
  }, [busy])

  const focusField = (f: CannedField) => (f === 'title' ? titleRef : textRef).current?.focus()

  /** Editing a field clears THAT field's error. The alert stays until the next attempt. */
  const change = (field: CannedField, value: string) => {
    setValues((v) => ({ ...v, [field]: value }))
    setErrors((e) => {
      if (e[field] === undefined) return e
      const next = { ...e }
      delete next[field]
      return next
    })
  }

  const save = async () => {
    if (inFlight.current) return
    const errs = validateCanned(values)
    const first = firstInvalidCanned(errs)
    if (first) {
      // No request.
      setErrors(errs)
      focusField(first)
      return
    }
    // AC-12: an unchanged edit closes with no PATCH and no toast.
    if (target && isUnchanged(values, target)) {
      onClose()
      return
    }

    inFlight.current = true
    setBusy(true)
    // Cleared at the START of each attempt, so a repeated failure is announced again.
    setAlert(null)
    let stayed = true
    try {
      const input = toInput(values)
      const r = target ? await updateCannedReply(target.id, input) : await createCannedReply(input)
      if (r.ok) {
        stayed = false
        onCommitted(target ? { kind: 'updated', row: r.value } : { kind: 'created', row: r.value })
        onClose()
        toast('success', target ? updatedToast(r.value.title) : createdToast(r.value.title))
        return
      }
      const o = cannedSaveOutcome(r)
      if (o.kind === 'stay') {
        // The typed input is KEPT — the user can copy it before cancelling.
        setAlert(o.alert)
        if (o.reconcile) onCommitted({ kind: 'none' })
      } else if (o.kind === 'gone') {
        stayed = false
        if (target) onCommitted({ kind: 'removed', id: target.id })
        onClose()
        toast(o.toast.kind, o.toast.text)
      }
      // `none` (401): the session-expired dialog owns it.
    } finally {
      inFlight.current = false
      refocusSave.current = stayed
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={target ? 'แก้ไขข้อความตอบกลับด่วน' : 'เพิ่มข้อความตอบกลับด่วน'}
      // Mid-write, closing would leave the user unsure whether the save happened.
      dismissable={!busy}
      footerClassName="flex flex-col gap-3"
      footer={
        <>
          {/* In the FOOTER because the footer never scrolls (phase 4 A-7). ALWAYS MOUNTED, hidden
              when empty — a `role="alert"` created with its text is silent. */}
          <InlineAlert message={alert} className="!mb-0" />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Btn variant="ghost" className="w-full sm:w-auto" disabled={busy} onClick={onClose}>
              ยกเลิก
            </Btn>
            {/* The visible label never changes (`useBusy` rule); the busy words go to `aria-label`. */}
            <Btn
              ref={saveRef}
              variant="primary"
              className="w-full sm:w-auto"
              disabled={busy}
              aria-busy={busy || undefined}
              aria-label={busy ? 'กำลังบันทึก…' : undefined}
              onClick={() => void save()}
            >
              {busy && <Spinner />}
              บันทึก
            </Btn>
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <FormField
            id="cr-title"
            ref={titleRef}
            label={
              <>
                หัวข้อ <Star />
              </>
            }
            maxLength={CANNED_TITLE_MAX}
            autoComplete="off"
            enterKeyHint="next"
            placeholder="เช่น แจ้งวิธีจองสถานที่"
            aria-required
            aria-describedby="cr-title-count"
            value={values.title}
            disabled={busy}
            error={errors.title}
            onChange={(e) => change('title', e.target.value)}
          />
          {/* The RAW length; validation uses the trimmed value (D-4). */}
          <p id="cr-title-count" className={COUNTER}>
            {values.title.length}/{CANNED_TITLE_MAX}
          </p>
        </div>

        <div>
          <Field
            label={
              <>
                ข้อความ <Star />
              </>
            }
            htmlFor="cr-text"
            errorId="cr-text-err"
            error={errors.text}
          >
            {/* The shell recipe: `.form-shell` draws the surface and the focus ring, so the textarea
                itself is borderless and `outline-none` (`AnnouncementFields`' body field). */}
            <textarea
              id="cr-text"
              ref={textRef}
              rows={6}
              maxLength={CANNED_TEXT_MAX}
              placeholder="พิมพ์ข้อความที่จะคัดลอกไปวางในห้องแชท"
              value={values.text}
              disabled={busy}
              aria-required
              aria-invalid={errors.text ? true : undefined}
              aria-describedby="cr-text-err cr-text-count"
              className="min-h-36 w-full resize-y border-none bg-transparent py-2.5 text-[15px] leading-[1.6] text-base-content/90 outline-none placeholder:text-base-content/60"
              onChange={(e) => change('text', e.target.value)}
            />
          </Field>
          <p id="cr-text-count" className={COUNTER}>
            {values.text.length}/{CANNED_TEXT_MAX}
          </p>
        </div>
      </div>
    </Modal>
  )
}
