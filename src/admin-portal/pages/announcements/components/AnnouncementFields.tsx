/**
 * The compose dialog's form column (`#an-modal`'s left panel). PROPS ONLY — no request, no toast. The
 * one piece of local state is the counters' polite announcement, which is presentation.
 *
 * ⚠️ NO <form> (design A-2, plan D-13). React 19 does not close daisyUI dialogs through
 * `<form method="dialog">`, and a nested form hides that it is broken. With no form, Enter in the
 * title has nothing to submit, so it can never close the dialog. `FormField` / `Field` render their
 * own messages, so there is no native bubble to suppress either.
 *
 * ⚠️ `view` DISABLES, IT DOES NOT `readOnly` (plan D-11, the prototype's rule). `.form-input` and
 * the textarea set their own text colour, which beats the UA's greyed disabled colour, so a SENT
 * record stays readable.
 *
 * ⚠️ THE COUNTERS ARE NOT IN THE <label> (design A-8). A counter inside the label becomes part of the
 * field's accessible name and changes on every keystroke. It sits below the field, referenced from
 * `aria-describedby`, so it is read on focus; a separate polite region announces only threshold
 * CROSSINGS.
 */

import { useState } from 'react'
import { InlineAlert } from '../../../components/feedback/InlineAlert'
import { Spinner } from '../../../components/feedback/Spinner'
import { Btn } from '../../../components/ui/Btn'
import { Combobox, type ComboboxOption } from '../../../components/ui/Combobox'
import { Field, FormField } from '../../../components/ui/FormField'
import {
  ANNOUNCEMENT_AUDIENCE_CHOICE,
  ANNOUNCEMENT_FORMAT,
  type AnnouncementAudience,
  type AnnouncementFormat,
} from '../../../labels'
import {
  BODY_MAX,
  TITLE_MAX,
  type DialogMode,
  type FieldErrors,
  type FormValues,
} from '../announcement-form'

const AUDIENCE_OPTIONS: readonly ComboboxOption<AnnouncementAudience>[] = [
  { id: 'ALL', name: ANNOUNCEMENT_AUDIENCE_CHOICE.ALL },
  { id: 'DEPARTMENT', name: ANNOUNCEMENT_AUDIENCE_CHOICE.DEPARTMENT },
]

const FORMAT_OPTIONS: readonly ComboboxOption<AnnouncementFormat>[] = [
  { id: 'TEXT', name: ANNOUNCEMENT_FORMAT.TEXT },
  { id: 'FLEX', name: ANNOUNCEMENT_FORMAT.FLEX },
]

const COUNTER = 'm-0 mt-1.5 text-right text-[13px] tabular-nums text-base-content/70'

/** Where the polite region speaks up: `เหลืออีก …` from here, `ครบ …` at the cap. */
const TITLE_WARN_AT = 90
const BODY_WARN_AT = 900

/** A required mark that is decoration only — `aria-required` / the error say it in words. */
const Star = () => (
  <span aria-hidden="true" className="text-error">
    *
  </span>
)

export interface DeptField {
  /** Already mapped by the dialog: tombstones out, the reserved group, the `(ไม่พร้อมใช้งาน)` row. */
  options: readonly ComboboxOption<number>[]
  loading: boolean
  failed: boolean
  retrying: boolean
  /** The chosen department is not in this user's list — the hint shows until an error replaces it. */
  unavailable: boolean
}

export function AnnouncementFields({
  mode,
  values,
  errors,
  disabled,
  meta,
  dept,
  onChange,
  onRetryDepts,
}: {
  mode: DialogMode
  values: FormValues
  errors: FieldErrors
  /** `view`, or a write in flight. */
  disabled: boolean
  /** The D-11 line; `null` in `create`. */
  meta: string | null
  dept: DeptField
  onChange: (patch: Partial<FormValues>) => void
  onRetryDepts: () => void
}) {
  const [live, setLive] = useState('')

  /** Threshold CROSSINGS only, computed from the previous and next length — never an effect. */
  const announce = (label: string, max: number, warnAt: number, prev: number, next: number) => {
    if (next >= max && prev < max) setLive(`${label}: ครบ ${max} ตัวอักษรแล้ว`)
    else if (next >= warnAt && prev < warnAt && next < max) {
      setLive(`${label}: เหลืออีก ${max - next} ตัวอักษร`)
    }
  }

  const editable = mode !== 'view'

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Always mounted: a live region is announced only if it existed before the text arrived. */}
      <p role="status" aria-live="polite" className="sr-only">
        {live}
      </p>

      {meta && (
        <p className="m-0 rounded-control border border-base-300 px-3.5 py-3 text-[14px] leading-[1.55] wrap-anywhere text-base-content/80">
          {meta}
        </p>
      )}

      <div>
        <FormField
          id="an-title"
          label={
            <>
              หัวข้อประกาศ <Star />
            </>
          }
          maxLength={TITLE_MAX}
          autoComplete="off"
          enterKeyHint="next"
          placeholder="เช่น ปิดปรับปรุงหอประชุมใหญ่"
          aria-required={editable || undefined}
          aria-describedby="an-title-count"
          value={values.title}
          disabled={disabled}
          error={errors.title}
          onChange={(e) => {
            const next = e.target.value
            announce('หัวข้อประกาศ', TITLE_MAX, TITLE_WARN_AT, values.title.length, next.length)
            onChange({ title: next })
          }}
        />
        <p id="an-title-count" className={COUNTER}>
          {values.title.length}/{TITLE_MAX}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Combobox
          id="an-aud"
          label="กลุ่มผู้รับ"
          searchable={false}
          options={AUDIENCE_OPTIONS}
          value={values.audience}
          disabled={disabled}
          onChange={(id) => onChange({ audience: id })}
        />
        <Combobox
          id="an-format"
          label="รูปแบบข้อความ"
          searchable={false}
          options={FORMAT_OPTIONS}
          value={values.format}
          disabled={disabled}
          onChange={(id) => onChange({ format: id })}
        />
      </div>

      {values.audience === 'DEPARTMENT' && (
        <div>
          {/* No row has id 0, so an unset department shows the placeholder. */}
          <Combobox
            id="an-dept"
            label="กลุ่ม/ฝ่าย"
            options={dept.options}
            value={values.departmentId ?? 0}
            placeholder={dept.loading ? 'กำลังโหลดรายการ…' : 'เลือกกลุ่ม/ฝ่าย'}
            error={errors.departmentId}
            hint={
              dept.unavailable && !errors.departmentId
                ? 'กลุ่ม/ฝ่ายเดิมของฉบับร่างนี้ไม่พร้อมใช้งานแล้ว เลือกกลุ่ม/ฝ่ายอื่นก่อนบันทึกหรือส่ง'
                : undefined
            }
            disabled={disabled || dept.loading}
            required={editable}
            onChange={(id) => onChange({ departmentId: id })}
          />
          {editable && (
            <>
              {/* Always mounted inside the field, hidden when empty (the `InlineAlert` rule). An
                  `ALL` announcement can still be saved or sent while this list is down (D-9). */}
              <InlineAlert
                className="!mb-0 mt-2"
                message={dept.failed ? 'โหลดรายการกลุ่ม/ฝ่ายไม่สำเร็จ' : null}
              />
              {dept.failed && (
                // Not `disabled` while retrying: that would blur the button the keyboard is on.
                // The hook keeps only the newest read, so a second press is harmless.
                <Btn
                  variant="ghost"
                  className="mt-2 min-h-9 px-3 text-[13px]"
                  aria-busy={dept.retrying || undefined}
                  aria-label={dept.retrying ? 'กำลังโหลดรายการกลุ่ม/ฝ่าย' : undefined}
                  onClick={onRetryDepts}
                >
                  {dept.retrying && <Spinner />}
                  ลองอีกครั้ง
                </Btn>
              )}
            </>
          )}
        </div>
      )}

      <div>
        {/* The prototype marks it `*` although a draft may be empty — it is required to SEND. So no
            `aria-required`: that would claim a save needs it too. */}
        <Field
          label={
            <>
              เนื้อหาประกาศ <Star />
            </>
          }
          htmlFor="an-body"
          errorId="an-body-err"
          error={errors.body}
        >
          {/* The shell recipe `ConfirmModal`'s reason field uses: `.form-shell` draws the surface
              and the focus ring, so the textarea itself is borderless and `outline-none`. */}
          <textarea
            id="an-body"
            rows={7}
            maxLength={BODY_MAX}
            placeholder="พิมพ์ข้อความที่ต้องการแจ้งผู้ใช้"
            value={values.body}
            disabled={disabled}
            aria-invalid={errors.body ? true : undefined}
            aria-describedby="an-body-err an-body-count"
            className="min-h-36 w-full resize-y border-none bg-transparent py-2.5 text-[15px] leading-[1.6] text-base-content/90 outline-none placeholder:text-base-content/60"
            onChange={(e) => {
              const next = e.target.value
              announce('เนื้อหาประกาศ', BODY_MAX, BODY_WARN_AT, values.body.length, next.length)
              onChange({ body: next })
            }}
          />
        </Field>
        <p id="an-body-count" className={COUNTER}>
          {values.body.length}/{BODY_MAX}
        </p>
      </div>
    </div>
  )
}
