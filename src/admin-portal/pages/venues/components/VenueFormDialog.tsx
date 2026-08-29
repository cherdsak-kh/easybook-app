/**
 * ONE dialog in THREE modes — `create` · `edit` · `view`.
 *
 * เจ้าหน้าที่ระบบ uses two separate dialogs for the same job, and that divergence is deliberate on
 * both sides: `StaffDetailDialog` shows facts the FORM does not (who created the account, last
 * sign-in, the audit chain), so those really are two documents. A venue has no such split — a
 * ผู้ดูข้อมูล and a ผู้ดูแลระบบ look at exactly the same fields, and the only difference is whether
 * they can type into them. Two dialogs for that would be one document maintained twice.
 *
 * ⚠️ `view` IS NOT "EDIT WITH THE BUTTONS HIDDEN". Every control is genuinely `disabled`, so nothing
 * is focusable, nothing submits, and the browser's own affordances go grey. Hiding บันทึก alone would
 * leave a ผู้ดูข้อมูล typing into fields that can never be sent anywhere. Neither is a permission
 * boundary — the server is, and answers 403 whatever this file renders.
 *
 * ⚠️ THE THUMBNAILS STAY ENABLED IN `view`, and that is not an inconsistency. Disabling them left a
 * ผู้ดูข้อมูล with two focusable controls in the whole dialog and no way to see any photo but the
 * cover. Looking at the gallery is READING, which is the entire thing that role is for; the click
 * only moves a local index and can never be saved.
 *
 * ── เปิดให้จอง is a SWITCH up in the meta block, not a field ──
 * It writes immediately, through the shared confirm dialog, because closing needs a REASON that end
 * users will read. A checkbox between ความจุ and ที่ตั้ง would let somebody close a venue as a side
 * effect of fixing a typo, inside a diff they skimmed. The knob is a rendering of `venue.isOpen` and
 * is never flipped locally — see `VenuesPage`.
 *
 * ── Photos: upload-then-bind (option ข, PO 25 ส.ค. 2569) ──
 * A picked file is resized, uploaded immediately, and its URL goes into `draft`. The venue is not
 * touched until บันทึก. That means an abandoned dialog can leave objects nothing references, so this
 * component tracks what IT uploaded (`sessionUploads`) and discards those on the way out.
 */

import { useEffect, useRef, useState } from 'react'
import {
  ApiError,
  discardVenuePhoto,
  uploadVenuePhoto,
  VENUE_PHOTOS_MAX,
  VENUE_PHOTO_MAX_BYTES,
  type Amenity,
  type Venue,
  type VenueType,
} from '@/lib/api-client'
import { Btn } from '../../../components/ui/Btn'
import { FormField, SelectField } from '../../../components/ui/FormField'
import { InlineAlert } from '../../../components/feedback/InlineAlert'
import { Modal } from '../../../components/ui/Modal'
import { Spinner } from '../../../components/feedback/Spinner'
import { thaiDate } from '../../../lib/thai-date'
import { resizeForUpload } from '../resize-image'

export type VenueFormMode = 'create' | 'edit' | 'view'

export interface VenueFormValues {
  name: string
  venueTypeId: number
  capacity: number
  location: string
  description: string
  amenityIds: number[]
  /** Ordered; index 0 is the cover. Already uploaded — these are URLs, not files. */
  photoUrls: string[]
}

export interface VenueFieldErrors {
  name?: string
  venueTypeId?: string
  capacity?: string
}

const ICON = {
  plus: 'M12 4.5v15m7.5-7.5h-15',
  save: 'M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9',
  upload:
    'M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z',
  trash:
    'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.2v.916m7.5 0a48.667 48.667 0 00-7.5 0',
  photo:
    'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
  check: 'M4.5 12.75l6 6 9-13.5',
} as const

function Glyph({ d, className = 'h-4.5 w-4.5 shrink-0' }: { d: string; className?: string }) {
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

const MB = (bytes: number) => Math.round(bytes / (1024 * 1024))

/**
 * The formats the upload endpoint accepts — the same set the `accept` attribute names on the input
 * below, and the same one the server's magic-byte sniff enforces (`isAvatarImageType`).
 *
 * ⚠️ `accept` IS A FILE-PICKER HINT, NOT A CHECK. Every desktop file dialog offers "All Files" one
 * dropdown away, and a drag-and-drop ignores `accept` entirely — so this list has to exist in code
 * as well as in the attribute, or a .pdf reaches `uploadVenuePhoto` and comes back as a 400 the
 * operator is told to "retry".
 */
const ACCEPTED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function VenueFormDialog({
  open,
  mode,
  target,
  types,
  amenities,
  alert,
  fieldErrors,
  busy,
  onSubmit,
  onClose,
  onDelete,
  onToggleOpen,
}: {
  open: boolean
  mode: VenueFormMode
  /** `null` on create. */
  target: Venue | null
  /** Assignable categories — the tombstone already removed by the caller. */
  types: VenueType[]
  amenities: Amenity[]
  /** A whole-form failure that leaves everything typed intact. */
  alert: string | null
  fieldErrors: VenueFieldErrors
  busy: boolean
  onSubmit: (values: VenueFormValues) => void
  onClose: () => void
  onDelete: () => void
  onToggleOpen: () => void
}) {
  const [name, setName] = useState('')
  const [venueTypeId, setVenueTypeId] = useState('')
  const [capacity, setCapacity] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [picked, setPicked] = useState<number[]>([])

  /**
   * ⚠️ THE COVER IS TRACKED AS AN INDEX, NOT BY MOVING THE PHOTO TO THE FRONT. The prototype did the
   * move first and it made the strip slide under the cursor: clicking the third thumbnail sent it to
   * position 1 and shifted every other one right, so the picture just chosen was no longer where it
   * was clicked. Selection must not reorder the thing being selected from. The array keeps its order
   * for the whole life of the dialog; the rotation happens ONCE, on submit.
   */
  const [draft, setDraft] = useState<string[]>([])
  const [coverIdx, setCoverIdx] = useState(0)
  const [photoErr, setPhotoErr] = useState('')
  const [uploading, setUploading] = useState(false)

  /**
   * URLs THIS dialog session uploaded and has not committed.
   *
   * ⚠️ IT IS A REF, NOT STATE. Nothing renders from it, and it has to be readable from the close
   * handler without that handler depending on a value that changes on every upload — a stale closure
   * there would leak exactly the objects this exists to clean up.
   */
  const sessionUploads = useRef<Set<string>>(new Set())
  const nameRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const readOnly = mode === 'view'
  const editing = mode !== 'create'

  // Repopulate on every open. Keyed on the dialog opening AND on which record it opened for, so
  // closing โรงยิม 1 and opening หอประชุมวารณ does not show the first one's fields.
  useEffect(() => {
    if (!open) return
    setName(target?.name ?? '')
    /*
     * ⚠️ CREATE MODE STARTS WITH NOTHING SELECTED. This used to pre-select `types[0]`, on the
     * reasoning that `venueTypeId` is a non-null FK so a blank is not a value the server can
     * store — and that reasoning had the failure backwards. A pre-selected first option is not
     * "a safe default", it is a CHOICE THE OPERATOR NEVER MADE, rendered identically to one they
     * did: nothing on screen distinguishes "โรงยิม because I picked it" from "โรงยิม because it
     * sorts first". The venue is then filed under the wrong category, silently, and the mistake
     * is only ever found by someone looking for a venue that is not where they expect.
     *
     * It also made `VenuesPage`'s `if (!values.venueTypeId)` guard DEAD CODE — the value was
     * never empty, so the one check written to catch this could never fire. `Number('')` is
     * `NaN`, which is falsy, so an untouched select now reaches that guard and stops there.
     * A blank is still never SENT: it is refused before the request, exactly as the name and
     * capacity checks are.
     *
     * Edit/view keep preselecting the record's real category — there the venue HAS one, and
     * offering "not chosen" would invent a state the FK cannot hold.
     */
    setVenueTypeId(target ? String(target.venueType.id) : '')
    setCapacity(target ? String(target.capacity) : '')
    setLocation(target?.location ?? '')
    setDescription(target?.description ?? '')
    setPicked(target ? target.amenities.map((a) => a.id) : [])
    setDraft(target ? target.photos.map((p) => p.url) : [])
    setCoverIdx(0)
    setPhotoErr('')
    sessionUploads.current = new Set()
    // ⚠️ `target?.id`, NOT `target`. The deps are deliberately narrower than the values read, and
    // widening them would be the bug rather than the fix: `target` is a FRESH OBJECT after every
    // close/reopen write — the page re-points the open dialog at the row the server returned — so
    // depending on it would re-run this reset and wipe a half-typed rename the moment somebody
    // flipped the เปิดให้จอง switch. Identity of the RECORD is what should reset the form, and that
    // is its id.
    //
    // `types` USED to be read here, to pre-select `types[0]` on create. It no longer is — create
    // now opens with the placeholder selected — which removes the one thing that ever tied this
    // reset to the vocabulary list. One fewer reason for a refetch of ประเภทสถานที่ to be able to
    // touch a form somebody is typing into.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target?.id])

  /**
   * ⚠️ SCROLL RESET AFTER THE DIALOG IS OPEN, in its own effect. A closed <dialog> is
   * `display: none`, so the assignment is silently dropped and the browser restores the old offset
   * on reopen — which is how reading โรงยิม 1's amenities, closing, and opening หอประชุมวารณ landed
   * mid-form on a different venue with its name and photo scrolled off the top.
   */
  useEffect(() => {
    if (!open) return
    const body = bodyRef.current
    if (body) body.scrollTop = 0
    if (!readOnly) nameRef.current?.focus()
  }, [open, target?.id, readOnly])

  /**
   * Whole-form failures scroll the alert into view.
   *
   * ⚠️ OR IT IS NOT AN ERROR MESSAGE, IT IS A HIDDEN ONE. The alert sits at the TOP of a body taller
   * than the dialog, so somebody who scrolled down to tick อุปกรณ์ and pressed บันทึก got a spinner
   * and then nothing — measured in the prototype at 709px above the visible box. Field errors need no
   * equivalent: focusing a field scrolls it into view by itself.
   */
  useEffect(() => {
    if (alert && bodyRef.current) bodyRef.current.scrollTop = 0
  }, [alert])

  /** Best-effort, fire-and-forget. A failed discard leaves an object nothing points at. */
  const discardAll = () => {
    for (const url of sessionUploads.current) void discardVenuePhoto(url).catch(() => {})
    sessionUploads.current = new Set()
  }

  const close = () => {
    // ⚠️ EVERYTHING THIS SESSION UPLOADED GOES, because ยกเลิก means the venue was never touched.
    // Photos that came from the RECORD are not in the set and are left alone — removing one of those
    // is a save, and the PATCH deletes its object server-side.
    discardAll()
    onClose()
  }

  /**
   * ⚠️ A REFUSED FILE AND A FAILED REQUEST ARE DIFFERENT EVENTS AND MUST NOT SHARE A SENTENCE.
   *
   * They used to. `resizeForUpload` fails SOFT by design — it hands back the original file for
   * anything it cannot decode — so a .pdf sailed past it, was POSTed, came back 400, and landed in
   * the one `catch` alongside a dropped Wi-Fi connection. Both then printed
   * "อัปโหลดไม่สำเร็จ · ลองใหม่อีกครั้ง", which for the .pdf is advice that cannot work: retrying
   * uploads the same bytes to the same check. The operator retries twice, concludes the system is
   * broken, and the actual fix — pick a different file — is never suggested.
   *
   * So the outcomes are separated by what the operator has to DO about them:
   *   · not an image / unsupported format  → choose a DIFFERENT file
   *   · larger than the cap                → the SAME file, made smaller
   *   · more files than slots              → delete something first
   *   · 4xx from the upload itself         → the bytes are wrong (corrupt, or the magic bytes do
   *                                          not match the declared type) → a different file
   *   · anything else (0 / 5xx / session)  → genuinely transient → RETRY, and only here
   */
  const pickFiles = async (files: File[]) => {
    // ⚠️ CONTENT IS CHECKED BEFORE THE CEILING, so a file that could never be uploaded does not
    // spend one of the ten slots. The other order lets three PDFs eat three places and then reports
    // "ไม่ได้เพิ่มอีก 3 รูป" about photos that were perfectly fine.
    const notImage: File[] = []
    const unsupported: File[] = []
    const usable = files.filter((f) => {
      // An empty `type` means the browser could not identify the file at all; "not an image" is the
      // honest reading of that, and it points at the same fix.
      if (!f.type || !f.type.startsWith('image/')) {
        notImage.push(f)
        return false
      }
      if (!ACCEPTED_PHOTO_TYPES.has(f.type)) {
        unsupported.push(f)
        return false
      }
      return true
    })

    // ⚠️ TAKE WHAT FITS AND SAY WHAT WAS REFUSED. It does not truncate silently, and it does not
    // reject the whole selection either: somebody who multi-selects twelve photos into an empty
    // gallery meant to add photos, and rejecting all twelve to punish the last two is a worse answer
    // than the silent truncation this exists to prevent.
    const room = Math.max(0, VENUE_PHOTOS_MAX - draft.length)
    const taken = usable.slice(0, room)
    const refusedForRoom = usable.length - taken.length

    setUploading(true)
    const added: string[] = []
    const tooBig: string[] = []
    const badBytes: string[] = []
    let failed = 0
    for (const file of taken) {
      try {
        const small = await resizeForUpload(file)
        // The client-side size check is for FAST FEEDBACK only; the server enforces it. `>` and not
        // `>=` — the backend accepts a file of exactly 5 MiB, so `>=` would refuse one it would have
        // taken.
        if (small.size > VENUE_PHOTO_MAX_BYTES) {
          tooBig.push(file.name)
          continue
        }
        const url = await uploadVenuePhoto(small)
        sessionUploads.current.add(url)
        added.push(url)
      } catch (err) {
        const status = err instanceof ApiError ? err.status : 0
        // 413 is the multer cap — the same fact as the local size check, so it joins that bucket
        // rather than inventing a second way to say "too big".
        if (status === 413) tooBig.push(file.name)
        // 400/415 from THIS endpoint mean the bytes were refused: `VENUE_PHOTO_TYPE_UNSUPPORTED` is
        // raised both for a declared type outside the allowlist and for a magic-byte sniff that
        // disagrees with it — i.e. a renamed or truncated file. Neither improves on a second try.
        else if (status === 400 || status === 415 || status === 422) badBytes.push(file.name)
        // 0 (offline), 403 (CSRF/session), 5xx — the request never got a verdict on the file.
        else failed += 1
      }
    }
    setUploading(false)
    if (added.length) setDraft((d) => [...d, ...added])

    // Every refusal that happened gets its own sentence, joined by the ` · ` this portal uses
    // everywhere else. One selection can hit several at once, and reporting only the first would
    // leave the operator fixing one problem per attempt.
    const problems: string[] = []
    if (refusedForRoom > 0) {
      problems.push(
        added.length
          ? `ใส่ได้สูงสุด ${VENUE_PHOTOS_MAX} รูป · เพิ่มให้ ${added.length} รูป และไม่ได้เพิ่มอีก ${refusedForRoom} รูป`
          : `ครบ ${VENUE_PHOTOS_MAX} รูปแล้ว — ลบรูปที่ไม่ใช้ออกก่อนจึงจะเพิ่มรูปใหม่ได้`,
      )
    }
    // Each of the next three names the FIX, not just the rule — that is the whole point of the split.
    if (notImage.length) {
      problems.push(
        `ไม่ใช่ไฟล์รูปภาพ ${notImage.length} ไฟล์ จึงไม่ได้เพิ่ม — เลือกไฟล์ .jpg .png หรือ .webp`,
      )
    }
    if (unsupported.length) {
      problems.push(
        `รูปแบบไฟล์ที่ระบบไม่รองรับ ${unsupported.length} ไฟล์ จึงไม่ได้เพิ่ม — ใช้ได้เฉพาะ .jpg .png และ .webp`,
      )
    }
    if (tooBig.length) {
      problems.push(
        `ไฟล์ใหญ่เกิน ${MB(VENUE_PHOTO_MAX_BYTES)} MB ${tooBig.length} ไฟล์ จึงไม่ได้เพิ่ม — ย่อขนาดรูปก่อนแล้วลองใหม่`,
      )
    }
    if (badBytes.length) {
      problems.push(
        `ไฟล์เสียหรือไม่ใช่รูปภาพจริง ${badBytes.length} ไฟล์ จึงไม่ได้เพิ่ม — เลือกไฟล์อื่น`,
      )
    }
    // ⚠️ THE ONLY LINE THAT SAYS "ลองใหม่", and it now says it only where a retry can help.
    if (failed) problems.push(`อัปโหลดไม่สำเร็จ ${failed} รูป — ลองใหม่อีกครั้ง`)
    setPhotoErr(problems.join(' · '))
  }

  const removePhoto = () => {
    const url = draft[coverIdx]
    if (!url) return
    // Only an object THIS session uploaded is discarded here. One that belongs to the record is left
    // in the bucket until บันทึก actually replaces the set — otherwise ยกเลิก after a delete would
    // have destroyed a photo the venue still shows.
    if (sessionUploads.current.has(url)) {
      sessionUploads.current.delete(url)
      void discardVenuePhoto(url).catch(() => {})
    }
    const next = draft.filter((_, i) => i !== coverIdx)
    setDraft(next)
    setCoverIdx((i) => Math.max(0, Math.min(i, next.length - 1)))
    // A delete FREES ROOM, so a standing "ครบ 10 รูปแล้ว" has just stopped being true. Clearing it
    // here is what keeps the message a fact about now rather than a receipt of something earlier.
    setPhotoErr('')
  }

  const submit = () => {
    // The ONE place the cover is rotated to the front. The dialog tracks it as an index so the strip
    // never moves under the cursor; the CONTRACT stores `photoUrls[0]` as the cover. One
    // representation for editing, one for storage, and exactly one line converting between them.
    const photoUrls = draft.length
      ? [draft[coverIdx], ...draft.filter((_, i) => i !== coverIdx)]
      : []
    onSubmit({
      name: name.trim(),
      venueTypeId: Number(venueTypeId),
      capacity: Number(capacity),
      location: location.trim(),
      description: description.trim(),
      amenityIds: picked,
      photoUrls,
    })
    // Saved photos are the venue's now — clearing the set without discarding is what stops the next
    // close handler deleting objects the record points at.
    sessionUploads.current = new Set()
  }

  /**
   * ⚠️ THE RECORD'S CURRENT CATEGORY IS KEPT AS AN OPTION EVEN WHEN IT IS NOT ASSIGNABLE.
   * `<select>` has no concept of "a value not in the list": omit it and the browser silently selects
   * option 0, so opening the dialog to fix a typo would re-file the venue under whichever category
   * happens to sort first. This covers both the tombstone and a category soft-deleted elsewhere.
   */
  const currentTypeMissing =
    target !== null && !types.some((t) => t.id === target.venueType.id)

  const cover = draft[coverIdx]

  return (
    <Modal
      open={open}
      onClose={close}
      // 640 and `tall` — this is the one dialog in the portal whose body is taller than the
      // viewport. See `Modal`'s `tall` prop for the 66px clipping that made it necessary.
      width={640}
      tall
      bodyRef={bodyRef}
      dismissable={!busy}
      title={
        mode === 'create' ? 'เพิ่มสถานที่' : mode === 'edit' ? 'แก้ไขสถานที่' : 'ข้อมูลสถานที่'
      }
      footer={
        <>
          <Btn variant="ghost" className="w-full sm:w-auto" disabled={busy} onClick={close}>
            {readOnly ? 'ปิด' : 'ยกเลิก'}
          </Btn>
          {!readOnly && (
            <Btn
              variant="primary"
              className="w-full sm:w-auto"
              disabled={busy || uploading}
              aria-busy={busy || undefined}
              aria-label={busy ? (mode === 'create' ? 'กำลังเพิ่ม' : 'กำลังบันทึก') : undefined}
              onClick={submit}
            >
              {busy ? <Spinner /> : <Glyph d={mode === 'create' ? ICON.plus : ICON.save} />}
              {mode === 'create' ? 'เพิ่มสถานที่' : 'บันทึกการแก้ไข'}
            </Btn>
          )}
        </>
      }
    >
      <InlineAlert message={alert} />

      {/* Edit/view only. The status line is FIRST because it changes what every other field on this
          form MEANS: editing the capacity of a venue nobody can book is a different act from editing
          one that is taking requests today. */}
      {editing && target && (
        <div className="mb-4 rounded-control border border-base-300 bg-base-100 px-3.5 py-3">
          <p className="m-0 flex flex-wrap items-center gap-2 text-[14px] text-base-content">
            <span className={`badge ${target.isOpen ? 'badge-emerald' : 'badge-amber'}`}>
              {target.isOpen ? 'เปิดให้จอง' : 'ปิดชั่วคราว'}
            </span>
            {!target.isOpen && target.closedReason && (
              <span className="text-[13px] leading-[1.5] text-base-content/80">
                {target.closedReason}
              </span>
            )}
          </p>
          <p className="m-0 mt-1.5 text-[13px] leading-[1.55] text-base-content/70">
            เพิ่มเมื่อ {thaiDate(target.createdAt)} · แก้ไขล่าสุด {thaiDate(target.updatedAt)}
          </p>

          {mode === 'edit' && (
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-base-300 pt-2.5">
              <span className="min-w-0">
                {/* The label is FIXED ('เปิดให้จอง' — what the switch CONTROLS); only the hint
                    moves. A switch whose own label flips between "เปิด" and "ปิด" is unreadable:
                    you can no longer tell whether the words describe the current state or the thing
                    a click would do. */}
                <span
                  id="vf-toggle-label"
                  className="block text-[14px] font-medium leading-[1.4] text-base-content"
                >
                  เปิดให้จอง
                </span>
                <span
                  id="vf-toggle-hint"
                  className="mt-0.5 block text-[13px] leading-[1.5] text-base-content/70"
                >
                  {target.isOpen
                    ? 'ผู้ใช้เห็นสถานที่นี้และส่งคำขอจองได้'
                    : 'ผู้ใช้ยังเห็นสถานที่นี้ แต่ส่งคำขอจองไม่ได้'}
                </span>
              </span>
              {/* ⚠️ THE KNOB IS NOT FLIPPED HERE, and nothing below flips it either — it is a
                  rendering of `target.isOpen`, and only a successful write moves it. A switch that
                  moves on click and is put back when the confirm is dismissed shows a state the
                  server never held, and on the failure path it shows it for a second and a half. */}
              <button
                type="button"
                role="switch"
                aria-checked={target.isOpen}
                aria-labelledby="vf-toggle-label"
                aria-describedby="vf-toggle-hint"
                className="sw-toggle"
                disabled={busy}
                onClick={onToggleOpen}
              >
                <span className="sw-track">
                  <span className="sw-knob" />
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
        <FormField
          ref={nameRef}
          className="sm:col-span-2"
          label="ชื่อสถานที่"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          placeholder="เช่น หอประชุมวารณ"
          autoComplete="off"
          disabled={readOnly}
          error={fieldErrors.name}
        />

        {/* ⚠️ REQUIRED. The reserved `ไม่พบประเภทสถานที่` row is not in this list: it exists to
            catch venues whose category was deleted, and letting an operator file one there
            deliberately would make the tombstone mean two different things. */}
        <SelectField
          label="ประเภทสถานที่"
          value={venueTypeId}
          onChange={(e) => setVenueTypeId(e.target.value)}
          disabled={readOnly}
          error={fieldErrors.venueTypeId}
        >
          {/* ⚠️ THE EMPTY PLACEHOLDER IS CREATE-ONLY, and it is what makes "not chosen" a state
              this form can be in at all. Without it the browser selects option 0 and the operator
              cannot tell a default apart from a decision — see the reset effect for the whole
              argument. It is NOT `disabled`/`hidden`: somebody who opened the list has to be able
              to back out of a wrong pick and land on the same error as if they had never touched
              it. In edit/view the record has a real category, so there is nothing to place-hold. */}
          {!editing && <option value="">เลือกประเภทสถานที่</option>}
          {/* The other extra entry: the record's CURRENT category when it is no longer assignable. */}
          {currentTypeMissing && target && (
            <option value={String(target.venueType.id)}>{target.venueType.name}</option>
          )}
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </SelectField>

        {/* `min={1}`, not 0. A venue that holds nobody is not a venue, and 0 is the value a
            half-filled form submits by accident. */}
        <FormField
          label="ความจุ (คน)"
          type="number"
          inputMode="numeric"
          min={1}
          max={100000}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          placeholder="เช่น 500"
          autoComplete="off"
          disabled={readOnly}
          error={fieldErrors.capacity}
        />

        <FormField
          className="sm:col-span-2"
          label={
            <>
              ที่ตั้ง <span className="font-normal text-base-content/70">(ไม่บังคับ)</span>
            </>
          }
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={200}
          placeholder="เช่น อาคารพลศึกษา ชั้น 1"
          autoComplete="off"
          disabled={readOnly}
          hint="บอกว่าไปที่ไหน — อาคาร ชั้น หรือจุดสังเกตใกล้เคียง · ผู้ใช้เห็นบรรทัดนี้ตอนเลือกสถานที่ใน LINE"
        />

        <div className="sm:col-span-2">
          <label className="form-label" htmlFor="vf-desc">
            รายละเอียด <span className="font-normal text-base-content/70">(ไม่บังคับ)</span>
          </label>
          <div className="form-shell py-2">
            <textarea
              id="vf-desc"
              rows={3}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={readOnly}
              className="form-input resize-y"
              placeholder="เงื่อนไขการใช้งาน สิ่งที่ต้องเตรียมมาเอง หรือข้อควรระวัง"
              autoCapitalize="sentences"
              spellCheck
            />
          </div>
        </div>
      </div>

      {/* ── รูปภาพ ──
          ⚠️ BELOW THE TEXT FIELDS, and that placement is a bug fix rather than a preference. With
          the 16:9 cover box and a thumbnail strip above them, focusing ชื่อสถานที่ on open made the
          browser scroll ~437px to bring it into view — so the dialog opened mid-form with the
          venue's name and photo already off the top. Identity before media is also the order every
          admin form uses: you say what the thing IS, then attach pictures of it. */}
      <fieldset className="mt-4 rounded-control border border-base-300 px-4 pb-4 pt-3">
        <legend className="px-1.5 text-[13px] font-semibold text-base-content/80">รูปภาพ</legend>

        <div className="mb-2.5 aspect-[16/9] w-full overflow-hidden rounded-control bg-base-200">
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="venue-ph flex-col gap-2">
              <Glyph d={ICON.photo} className="h-10 w-10" />
              <span className="text-[13px] text-base-content/60">ยังไม่มีรูปภาพ</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {draft.map((src, i) => (
            <button
              key={src}
              type="button"
              // ⚠️ ENABLED IN `view` TOO — see the header note. The click only moves a local index.
              onClick={() => setCoverIdx(i)}
              aria-label={
                readOnly
                  ? `ดูรูปที่ ${i + 1}${i === coverIdx ? ' (กำลังแสดงอยู่)' : ''}`
                  : i === coverIdx
                    ? `รูปที่ ${i + 1} — เป็นรูปปกอยู่แล้ว`
                    : `ใช้รูปที่ ${i + 1} เป็นรูปปก`
              }
              className={`block h-16 w-24 overflow-hidden rounded-control border-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                i === coverIdx ? 'border-primary' : 'border-transparent hover:border-primary/40'
              }`}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>

        {/* ── Deleting a photo is a BUTTON DOWN HERE, not a ✕ on the thumbnail ──
            The ✕ measured 24px, where every other target in this portal has a 44px floor — and this
            one deletes something. It could not simply grow: a 44px hit box on a 96×64 thumbnail
            either swallows that thumbnail's own "make this the cover" target or spills 16px into its
            neighbour through the `gap-2`. So the model changed instead: a thumbnail SELECTS, and the
            action applies to what is selected — which is what the big image above already shows. */}
        {!readOnly && (
          <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
            {/* A real <input type="file"> behind its own <label>. The label IS the button — `for`
                gives it the click and the keyboard activation a div would have had to fake. */}
            <label className="btn-ghost2 w-full cursor-pointer sm:w-auto">
              {uploading ? <Spinner /> : <Glyph d={ICON.upload} />}
              {uploading ? 'กำลังอัปโหลด…' : 'เพิ่มรูปภาพ'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                disabled={uploading || busy}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  e.target.value = ''
                  if (files.length) void pickFiles(files)
                }}
              />
            </label>
            {draft.length > 0 && (
              <Btn
                variant="danger"
                className="w-full sm:w-auto"
                disabled={uploading || busy}
                onClick={removePhoto}
              >
                <Glyph d={ICON.trash} />
                ลบรูปนี้
              </Btn>
            )}
          </div>
        )}

        <p className="m-0 mt-2 text-[13px] leading-[1.55] text-base-content/70">
          {readOnly
            ? draft.length > 1
              ? 'กดที่รูปย่อยเพื่อดูรูปอื่น'
              : ''
            : 'รูปที่แสดงด้านบนคือรูปปก · กดที่รูปย่อยเพื่อเลือกเป็นรูปปกแทน · ปุ่ม “ลบรูปนี้” จะลบรูปที่แสดงอยู่'}
        </p>

        {/* ── The upload RULE, separate from the control instructions above ──
            Two different kinds of sentence, so two elements: the hint says how the buttons work and
            goes away in `view`; this says what belongs in a venue photo at all, and it has to be
            readable BEFORE the first upload — which is why it is not folded into an error that
            appears after one.

            🔴 THE "NO PEOPLE" LINE IS A REAL CONTROL, NOT POLITENESS, and the reason is a PATH. An
            avatar is stored at `avatars/<userId>/…`, so an erasure request for one person is a
            prefix delete. A venue photo is `venues/<random>.<ext>` — the person in it appears
            NOWHERE in the path, so once a face is in this bucket no erasure request can locate it.
            Nothing downstream can fix that, which makes this sentence the last point at which it is
            still preventable. It states the CONSEQUENCE rather than the rule alone, because
            "ผู้ใช้ทุกคนเห็นใน LINE" is what makes somebody look at the photo again before picking
            it. */}
        {!readOnly && (
          <p className="m-0 mt-2 text-[13px] leading-[1.55] text-base-content/70">
            ใส่ได้สูงสุด {VENUE_PHOTOS_MAX} รูป ·{' '}
            <span className="font-medium text-base-content">
              ควรเป็นภาพของตัวสถานที่ ไม่ควรมีบุคคลอยู่ในภาพ
            </span>{' '}
            — รูปเหล่านี้ผู้ใช้ทุกคนเห็นใน LINE
          </p>
        )}

        <p className={`form-err ${photoErr ? '' : 'hidden'}`.trim()} role="alert">
          <svg
            aria-hidden="true"
            className="form-err-ico"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
          <span>{photoErr}</span>
        </p>
      </fieldset>

      {/* ── สิ่งอำนวยความสะดวก ──
          Ticks over a CLOSED VOCABULARY, not a text box, and the vocabulary lives in its own
          admin-maintained table. The reason is one thing free text can never do: "หาที่ที่มี
          โปรเจกเตอร์" is a filter, and a filter needs the two people who typed "โปรเจกเตอร์" and
          "เครื่องฉาย" to have picked the same row.

          A relationship, not a column: deleting an amenity removes a TICK from some venues and
          orphans nothing, so — unlike the three option tables before it — this one needs no
          `ไม่พบ…` tombstone. */}
      <fieldset className="mt-4 rounded-control border border-base-300 px-4 pb-4 pt-3">
        <legend className="px-1.5 text-[13px] font-semibold text-base-content/80">
          สิ่งอำนวยความสะดวก{' '}
          <span className="font-normal text-base-content/70">(ไม่บังคับ)</span>
        </legend>
        {amenities.length === 0 ? (
          /* An empty vocabulary is a LEGITIMATE state — this is the one curated table with no
             required FK pointing at it — and an empty fieldset with a legend and nothing under it
             reads as a broken screen. Unlike ประเภทสถานที่ it blocks nothing, so this is a pointer,
             not a warning. */
          <p className="m-0 text-[13px] leading-[1.55] text-base-content/70">
            ยังไม่มีอุปกรณ์ในระบบ — เพิ่มได้ที่หน้า{' '}
            <span className="font-medium text-base-content">
              การตั้งค่าระบบ › สิ่งอำนวยความสะดวก
            </span>
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {amenities.map((a) => (
              <label key={a.id} className="chk">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={picked.includes(a.id)}
                  disabled={readOnly}
                  onChange={(e) =>
                    setPicked((p) =>
                      e.target.checked ? [...p, a.id] : p.filter((id) => id !== a.id),
                    )
                  }
                />
                <span className="chk-box" aria-hidden="true">
                  <Glyph d={ICON.check} className="h-3.5 w-3.5" />
                </span>
                <span>{a.name}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      {/* ── ลบสถานที่ — LAST, and out of the footer ──
          The one destructive action on this form sits at the bottom of what you scroll through, not
          8px from บันทึกการแก้ไข in a stack of look-alike buttons. Two things follow and both are
          the point: reaching it takes a deliberate scroll, and the button that ENDS the form is
          unambiguous because there is exactly one. */}
      {mode === 'edit' && (
        <div className="mt-5 border-t border-base-300 pt-4">
          <Btn variant="danger" className="w-full sm:w-auto" disabled={busy} onClick={onDelete}>
            <Glyph d={ICON.trash} />
            ลบสถานที่
          </Btn>
          {/* Says what a DELETE is, next to the button that does it. "ปิดชั่วคราว แทน" is named
              because the switch above is the answer most people opening this actually want, and it
              is now far enough away that the sentence has to do the pointing. */}
          <p className="m-0 mt-2 text-[13px] leading-[1.55] text-base-content/70">
            สถานที่จะหายไปจากรายการทันทีและจองไม่ได้อีก · ถ้าแค่ยังไม่เปิดให้จองชั่วคราว
            ให้ปิดสวิตช์ “เปิดให้จอง” ด้านบนแทน
          </p>
        </div>
      )}
    </Modal>
  )
}
