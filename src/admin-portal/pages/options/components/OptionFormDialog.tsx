/**
 * ตัวเลือกบุคลากร — เพิ่ม / แก้ไข. ONE dialog, two modes, TWO destinations.
 *
 * Create and rename both have exactly one editable field — `name` — so two dialogs would be two
 * copies of one form, and the copy that got a fix would not be the one somebody opened. The same
 * argument one level up is why ตำแหน่ง and กลุ่ม/ฝ่าย share it: the record is
 * `{ id, name, isSystemReserved }` in both tables, and every word that differs is a string in
 * `option-model.ts`.
 *
 * ── Why one field earns a dialog at all ──
 * Inline editing in the row was the alternative and it loses on the failure paths, which are the
 * whole point: a 409 needs somewhere to say "ชื่อนี้มีอยู่แล้ว", the delete needs a place to state
 * what a soft delete actually does, and a cell that grows an error message reflows the table under
 * the cursor.
 *
 * ── The delete button lives HERE, not in the table ──
 * So there is exactly one delete path and it is the same at every width, and because the
 * confirmation can then quote the usage count this dialog already has on screen. Deleting a job
 * title or a whole กลุ่ม/ฝ่าย is rare and consequential; putting it one level in is the correct
 * cost.
 *
 * ⚠️ NO CLIENT-SIDE DUPLICATE CHECK, deliberately. The list a page holds is ROLE-FILTERED, so an
 * ADMIN typing the reserved row's exact name would pass a local check and then take a 409 from the
 * server — and that 409 is correct: the reserved NAME is not a secret (it is a constant in the
 * repo), only its assignability is. Uniqueness belongs to the partial index
 * `WHERE deletedAt IS NULL`, which is also the only thing that knows a soft-deleted name has
 * become free again. The caller passes the server's answer back through `nameError`.
 *
 * ⚠️ PROPS ONLY. No API call and no confirm dialog; `onDelete` asks, the page decides.
 */

import { useEffect, useRef, useState } from 'react'
import { Btn } from '../../../components/ui/Btn'
import { FormField } from '../../../components/ui/FormField'
import { InlineAlert } from '../../../components/feedback/InlineAlert'
import { Modal } from '../../../components/ui/Modal'
import { Spinner } from '../../../components/feedback/Spinner'
import {
  holdersOf,
  OPTION_COPY,
  type OptionModel,
  type OptionRecord,
} from '../option-model'

const ICON = {
  plus: 'M12 4.5v15m7.5-7.5h-15',
  save: 'M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9',
  trash:
    'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.2v.916m7.5 0a48.667 48.667 0 00-7.5 0',
} as const

function Glyph({ d }: { d: string }) {
  return (
    <svg
      aria-hidden="true"
      className="h-4.5 w-4.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

export function OptionFormDialog({
  open,
  onClose,
  model,
  target,
  prefill = '',
  alert = null,
  nameError = null,
  busy = false,
  onSubmit,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  /** Which of the two destinations this dialog is currently serving. */
  model: OptionModel
  /** `null` is create; a record is rename. */
  target: OptionRecord | null
  /** Create only — carries a search term over, so "ไม่พบ X" can offer to add X. */
  prefill?: string
  alert?: string | null
  /** The server's 409, on the field, because the fix is to type a different name. */
  nameError?: string | null
  busy?: boolean
  onSubmit: (name: string) => void
  onDelete?: () => void
}) {
  const copy = OPTION_COPY[model]
  const isEdit = target !== null
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  /** Armed when the dialog opens, consumed once the value below has actually landed. */
  const armSelect = useRef(false)

  useEffect(() => {
    if (!open) {
      armSelect.current = false
      return
    }
    armSelect.current = true
    setName(isEdit ? target.name : prefill)
    setError(null)
  }, [open, isEdit, target, prefill])

  /**
   * Focus, and select-all on a RENAME so the first keystroke replaces the old title. Not on create
   * — there is nothing to select, and calling it there would be a no-op that reads as intent.
   *
   * ⚠️ THE `el.value !== want` GUARD IS THE WHOLE MECHANISM. This is a CONTROLLED input, so when
   * the effects of the OPENING render run, its DOM value is still the previous one and the
   * assignment that lands the new value CLEARS any selection. Measured: focused, caret at the end,
   * nothing highlighted — the first keystroke appended to the old name instead of replacing it. A
   * plain second effect does not help; it runs in the same commit as the first.
   *
   * So this waits for the commit where the value matches, which is exactly one render later, and
   * `armSelect` makes it fire once — without it, typing the original name back character by
   * character would re-select the field mid-edit.
   *
   * ⚠️ NOT `requestAnimationFrame`, which was the first fix and was wrong: a frame callback does
   * not run in a hidden tab, so the field opened unfocused whenever the browser felt like it.
   * Measured too, by accident, which is the only reason it was caught.
   */
  useEffect(() => {
    if (!open || !armSelect.current) return
    const el = inputRef.current
    if (!el) return
    if (el.value !== (isEdit ? target.name : prefill)) return
    armSelect.current = false
    el.focus()
    if (isEdit) el.select()
  }, [open, isEdit, target, prefill, name])

  function submit() {
    /*
     * ⚠️ TRIM FIRST, and compare on the trimmed value. `@Transform(trim)` runs on the DTO, so
     * " ครู " and "ครู" are the same record to the server — without trimming here, retyping a name
     * with a stray space would look like an edit, be sent, and come back 409 against the row it is
     * identical to. The input keeps what was typed; only the comparison is trimmed.
     */
    const value = name.trim()
    if (!value) {
      setError(`กรอกชื่อ${copy.noun}`)
      inputRef.current?.focus()
      return
    }
    // "No change" is the caller's to report — it closes and says so with a toast, which is page
    // behaviour. What belongs here is not sending a PATCH that changes nothing.
    if (isEdit && value === target.name) {
      onSubmit(value)
      return
    }
    onSubmit(value)
  }

  const holders = target ? holdersOf(target) : 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `แก้ไข${copy.noun}` : `เพิ่ม${copy.noun}`}
      width={520}
      dismissable={!busy}
      // ⚠️ `sm:mr-auto` on the delete pushes it away from the commit pair — it is not an
      // alternative to บันทึก, it is a different write to a different endpoint.
      footerClassName="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
      footer={
        <>
          {isEdit && (
            <Btn
              variant="danger"
              className="w-full sm:mr-auto sm:w-auto"
              disabled={busy}
              onClick={onDelete}
            >
              <Glyph d={ICON.trash} />
              ลบ{copy.noun}
            </Btn>
          )}
          <Btn variant="ghost" className="w-full sm:w-auto" disabled={busy} onClick={onClose}>
            ยกเลิก
          </Btn>
          <Btn
            variant="primary"
            className="w-full sm:w-auto"
            disabled={busy}
            aria-busy={busy || undefined}
            aria-label={busy ? 'กำลังบันทึก' : undefined}
            onClick={submit}
          >
            {busy ? <Spinner /> : <Glyph d={isEdit ? ICON.save : ICON.plus} />}
            {isEdit ? 'บันทึก' : `เพิ่ม${copy.noun}`}
          </Btn>
        </>
      }
    >
      <InlineAlert message={alert} />

      {/* EDIT ONLY. The usage count is the fact that changes what renaming and deleting MEAN, so it
          is on screen before either button is pressed — renaming a title 24 people hold rewrites
          what their record says about them, and it does so silently everywhere at once. */}
      {isEdit && (
        <div className="mb-4 rounded-control border border-base-300 bg-base-100 px-3.5 py-3">
          <p className="m-0 text-[14px] text-base-content">
            <span className="font-medium">
              {holders
                ? `${copy.holdersSome} ${holders} ${copy.unit}${
                    // The breakdown exists only on tables shared between two populations. A venue
                    // type holds venues and nothing else, so the em-dash clause would be the same
                    // number said twice.
                    target.parts
                      ? ` — ${target.parts.map((p) => `${p.label} ${p.n} ${copy.unit}`).join(' · ')}`
                      : ''
                  }`
                : copy.holdersNone}
            </span>
          </p>
          <p className="m-0 mt-1 text-[13px] leading-[1.55] text-base-content/70">
            เพิ่มเมื่อ {target.createdAt} · แก้ไขล่าสุด {target.updatedAt}
          </p>
        </div>
      )}

      {/* `maxLength` mirrors the DTO's `@MaxLength(120)` — the same number on both tables. No
          counter: neither a job title nor a department name approaches 120 characters, and a
          counter that never changes colour is furniture. */}
      <FormField
        ref={inputRef}
        label={`ชื่อ${copy.noun}`}
        maxLength={120}
        autoComplete="off"
        enterKeyHint="done"
        placeholder={copy.namePlaceholder}
        value={name}
        error={error ?? nameError ?? undefined}
        onChange={(e) => {
          setName(e.target.value)
          setError(null)
        }}
        hint={<span className="leading-[1.55]">{copy.nameHint}</span>}
      />
    </Modal>
  )
}
