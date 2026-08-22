/**
 * เปลี่ยนรูปโปรไฟล์ — the ONLY write on the whole profile page.
 *
 * `UpdateOwnProfileDto` has exactly one field, `profilePictureUrl`, and everything else in
 * `system_users` was set by the creating admin (project rule, 11 ส.ค. 2569). So this dialog is not
 * "one of the profile's editors"; it is the profile's editor, which is why the avatar is the
 * largest and most obviously interactive object on the page behind it.
 *
 * ── Why a dialog rather than an inline panel ──
 * Cropping is a modal task: there is nothing else on the page you can meaningfully do while a crop
 * is half finished, and the page behind is entirely read-only anyway.
 *
 * ── The cropper ──
 * **Cropper.js 1.6.1 — the SAME library the prototype loads**, with the same four options:
 * `aspectRatio: 1, viewMode: 1, background: true, autoCropArea: 0.8`.
 *
 * ⚠️ IT WAS `react-easy-crop` FIRST, AND THAT WAS THE WRONG HALF OF THE PROTOTYPE'S SENTENCE. Its
 * header offers two equivalents — "`react-cropper` (the same library) or `react-easy-crop`" — and
 * only the first is actually equivalent. The two libraries invert which object the operator moves:
 *
 *   Cropper.js      the IMAGE stays put and the CROP BOX moves and RESIZES — eight handles
 *   react-easy-crop the crop box is welded to the frame and the IMAGE pans and zooms under it
 *
 * Both can reach the same square, so a screenshot of either looks right; what differs is whether
 * you can grab a corner, and the PO grabbed one and nothing happened (22 ส.ค. 2569). Measured on
 * the prototype: 8 `.cropper-point` handles, 4 `.cropper-line` edges, crop box 227.2px = 0.8 × the
 * 284px container, exactly what `autoCropArea: 0.8` produces.
 *
 * ⚠️ THE CROP BOX IS SQUARE, NOT ROUND, and that was the second thing the swap corrected. The port
 * had passed `cropShape="round"` reasoning that the result is shown round everywhere — but the
 * prototype's view box measures `border-radius: 0px`, and the dialog's own hint one screen away
 * already said "เลือกแล้วจะครอปเป็นสี่เหลี่ยมจัตุรัสได้". The copy had been right about the design
 * and the cropper had been arguing with it.
 *
 * ⚠️ NOT A HAND-ROLLED CROPPER — the prototype forbids that and this is not it. Cropper.js has no
 * React wrapper in this repo because it does not need one: it is 20 lines of `useEffect` that
 * construct it on the `<img>` and destroy it on the way out. `react-cropper` is that same wrapper
 * published as a package, last released for React 18, and taking it would add a dependency whose
 * only job is a lifecycle this file already has to own.
 *
 * ⚠️ NO CDN FALLBACK, unlike the prototype. Its `typeof Cropper === 'function'` check — upload the
 * picture uncropped rather than show a dead modal — exists because it loads the library from
 * cdnjs. Here it is bundled: if it were missing the module would not have imported and this dialog
 * would not exist to render. A branch for it would be unreachable code pretending to be a safeguard.
 *
 * ⚠️ THE CLIENT CHECKS ARE A FAST FAIL, NOT THE CONTROL. The server sniffs magic bytes and will
 * reject a `.png` that is really something else, which nothing here can see. Running type and size
 * BEFORE the FileReader is still the point: the reference prototype starts cropping first, so it
 * lets someone spend a minute framing a 12 MB TIFF the API was always going to refuse.
 *
 * ⚠️ TWO ERROR SURFACES, and which one a failure lands on is a decision, not a coincidence. A
 * complaint about THE FILE (wrong type, too big, and the server's magic-byte 400 — the exact case
 * the checks above cannot catch) belongs beside the file, where the fix is "choose another one".
 * Everything else — the object store, a stale CSRF token, a down service, no connection — is about
 * the SYSTEM, so it goes in the banner at the top, where the fix is "try again".
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Cropper from 'cropperjs'
// The library's own stylesheet, unlayered — so it wins over Tailwind's `@layer base` Preflight,
// which would otherwise flatten the handles and the modal backdrop it draws. Same relationship the
// prototype has with the `<link>` it puts after the Tailwind CDN script.
import 'cropperjs/dist/cropper.css'
import {
  ApiError,
  AVATAR_ACCEPTED_TYPES,
  AVATAR_MAX_BYTES,
  updateOwnProfile,
  uploadOwnAvatar,
} from '@/lib/api-client'
import { InlineAlert } from '../../../components/feedback/InlineAlert'
import { Spinner } from '../../../components/feedback/Spinner'
import { Btn } from '../../../components/ui/Btn'
import { Modal } from '../../../components/ui/Modal'
import { useBusy } from '../../../lib/use-busy'
import { useToast } from '../../../lib/toast-context'

const MSG = {
  type: 'รองรับเฉพาะไฟล์ JPEG, PNG และ WEBP',
  size: 'ไฟล์ใหญ่เกิน 2 MB โปรดย่อขนาดรูปแล้วลองใหม่',
  read: 'อ่านไฟล์นี้ไม่ได้ ไฟล์อาจเสียหาย โปรดเลือกรูปอื่น',
  sniff: 'ไฟล์นี้ไม่ใช่รูปภาพที่รองรับ ระบบตรวจจากเนื้อไฟล์จริงไม่ใช่จากนามสกุล',
  crop: 'ครอปรูปไม่สำเร็จ โปรดลองเลือกรูปอื่น',
  store: 'อัปโหลดรูปไม่สำเร็จ ระบบจัดเก็บไฟล์ไม่ตอบสนอง โปรดลองใหม่อีกครั้ง',
  csrf: 'เซสชันหมดอายุหรือไม่ปลอดภัย โปรดรีเฟรชหน้าเว็บแล้วลองใหม่อีกครั้ง',
  down: 'ระบบไม่สามารถใช้งานได้ชั่วคราว โปรดลองใหม่อีกครั้งในภายหลัง',
  net: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ รูปที่เลือกไว้ยังอยู่ กดบันทึกอีกครั้งได้เลย',
  saved: 'เปลี่ยนรูปโปรไฟล์เรียบร้อย',
  removed: 'ลบรูปโปรไฟล์เรียบร้อย',
} as const

/**
 * The longest edge of what gets uploaded.
 *
 * A CAP, not a target: a crop already smaller than this is sent at its own size rather than
 * upscaled to meet the number. Upscaling adds no detail and multiplies the bytes, and the server
 * re-derives everything from what it receives anyway — the whole point of the backend being a
 * multipart proxy rather than a presign.
 */
const OUT_MAX_PX = 512

/** The four options the prototype constructs Cropper.js with — copied, not re-derived. */
const CROPPER_OPTIONS: Cropper.Options = {
  aspectRatio: 1,
  viewMode: 1,
  background: true,
  autoCropArea: 0.8,
}

/**
 * The crop, as a file.
 *
 * ⚠️ ROTATION IS NOT HANDLED HERE ANY MORE, and deleting that code is the point. The port did the
 * whole transform by hand — one canvas to paint the image rotated into a box big enough to hold it
 * at that angle, a second to cut the square out of it — because `react-easy-crop` reports the crop
 * in the rotated image's coordinate space and leaves the pixels to the caller. `getCroppedCanvas`
 * already knows the rotation, the scale and the crop box, because they are all its own state.
 *
 * ⚠️ `width`/`height` ARE A CAP, NOT THE PROTOTYPE'S FLAT 512. It passes `{width: 512, height: 512}`
 * unconditionally, which UPSCALES a crop smaller than that: no detail is added, the bytes multiply,
 * and the server re-derives everything from what it receives anyway. `getData(true)` reports the
 * selection in the source image's own pixels, so a small crop is sent at its own size.
 *
 * PNG, matching the prototype. A 512px square stays well under the 2 MB limit even at PNG's worst
 * case, and it keeps the one lossless step in the pipeline where the operator can see it.
 */
async function croppedFile(cropper: Cropper): Promise<File> {
  const out = Math.min(OUT_MAX_PX, Math.round(cropper.getData(true).width))
  const canvas = cropper.getCroppedCanvas({
    width: out,
    height: out,
    imageSmoothingQuality: 'high',
  })
  // Documented to return `null` when the crop box has no area — unreachable with `autoCropArea`,
  // but it is the caller's job to not hand `toBlob` an undefined.
  if (!canvas) throw new Error('canvas encode failed')

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('canvas encode failed')
  return new File([blob], 'avatar.png', { type: 'image/png' })
}

export function AvatarModal({
  open,
  onClose,
  hasPicture,
  onDone,
}: {
  open: boolean
  onClose: () => void
  /** Whether there is a picture to remove — the ลบรูปโปรไฟล์ button is absent when there is not. */
  hasPicture: boolean
  /** Re-read the session so the header AND the sidebar card follow the same one answer. */
  onDone: () => void | Promise<void>
}) {
  const toast = useToast()
  const saving = useBusy()
  const removing = useBusy()

  const [src, setSrc] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [alert, setAlert] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  /**
   * The live Cropper.js instance.
   *
   * A ref rather than state, and that is not an optimisation: it holds the crop box, the zoom and
   * the rotation, all of which change on every mouse move. Putting it in state would re-render the
   * dialog on each one, and re-rendering is exactly what must not happen — React would reconcile
   * the `<img>` that Cropper.js has already replaced with its own DOM.
   */
  const cropperRef = useRef<Cropper | null>(null)

  const busy = saving.busy || removing.busy

  /** Back to the empty drop zone. ONE path, so the dialog cannot end up half reset. */
  const clearPick = useCallback(() => {
    // The cropper itself is torn down by the effect below, which runs on `src` going null. Doing it
    // here as well would destroy an instance the effect's cleanup is still holding.
    setSrc(null)
    setDragOver(false)
    setErr(null)
    setAlert(null)
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  /**
   * Construct on a picture arriving, destroy on it leaving. Keyed on `src`, so "เลือกรูปอื่น" gets
   * a fresh cropper rather than a stale one pointed at the previous image.
   *
   * ⚠️ `destroy()` IS NOT OPTIONAL. Cropper.js replaces the `<img>` with a container of its own and
   * binds pointer, wheel and resize listeners to the document; skipping it leaves those bound to a
   * detached tree for the life of the tab, and the dialog is opened as often as someone changes
   * their mind about a photo.
   */
  useEffect(() => {
    const el = imgRef.current
    if (!src || !el) return
    const cropper = new Cropper(el, CROPPER_OPTIONS)
    cropperRef.current = cropper
    return () => {
      cropper.destroy()
      cropperRef.current = null
    }
  }, [src])

  // Every exit lands here — the ✕, ยกเลิก, Escape and the backdrop all close the dialog, and a
  // half-finished crop must never survive into the next open.
  useEffect(() => {
    if (!open) clearPick()
  }, [open, clearPick])

  // The prototype focuses the drop zone on open. Without this the platform focuses the first
  // focusable in the dialog, which is the ✕ — so the keyboard lands on "leave" rather than on the
  // one control the dialog exists for.
  useEffect(() => {
    if (open) dropRef.current?.focus()
  }, [open])

  const accept = useCallback((f: File) => {
    setErr(null)
    if (!(AVATAR_ACCEPTED_TYPES as readonly string[]).includes(f.type)) {
      setErr(MSG.type)
      return
    }
    // `>`, never `>=`. The backend takes a file of exactly 2 MiB and rejects one byte more, so
    // `>=` would refuse a file the server would have accepted.
    if (f.size > AVATAR_MAX_BYTES) {
      setErr(MSG.size)
      return
    }
    const reader = new FileReader()
    reader.onerror = () => setErr(MSG.read)
    reader.onload = () => setSrc(String(reader.result))
    reader.readAsDataURL(f)
  }, [])

  /** Everything the server can answer, sorted into the two surfaces. */
  const report = useCallback((error: unknown) => {
    if (!(error instanceof ApiError)) {
      // Never reached the server at all — including a `croppedFile` failure, which cannot happen
      // after a successful decode but must not be swallowed silently if it does.
      setAlert(error instanceof Error && error.message.includes('canvas') ? MSG.crop : MSG.net)
      return
    }
    switch (error.status) {
      case 400:
        // The magic-byte sniff disagreeing with the declared MIME: a fact about the FILE.
        setErr(MSG.sniff)
        return
      case 401:
        // The session died. `AuthProvider` watches for this globally and raises its own dialog;
        // this one just gets out of the way rather than explaining it a second time.
        onClose()
        return
      case 403:
        setAlert(MSG.csrf)
        return
      case 502:
        setAlert(MSG.store)
        return
      default:
        setAlert(MSG.down)
    }
  }, [onClose])

  const save = () =>
    void saving.run(async () => {
      const cropper = cropperRef.current
      if (!cropper) return
      setAlert(null)
      try {
        await uploadOwnAvatar(await croppedFile(cropper))
        await onDone()
        toast('success', MSG.saved)
        onClose()
      } catch (error) {
        report(error)
      }
    })

  // Removing is `PATCH /auth/system/me` with `profilePictureUrl: null`, NOT a DELETE — there is no
  // delete route, and the nullable column is what makes "no picture" expressible at all.
  const remove = () =>
    void removing.run(async () => {
      setAlert(null)
      try {
        await updateOwnProfile({ profilePictureUrl: null })
        await onDone()
        toast('success', MSG.removed)
        onClose()
      } catch (error) {
        report(error)
      }
    })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="เปลี่ยนรูปโปรไฟล์"
      width={520}
      // Closing mid-write leaves the operator unsure whether the upload happened.
      dismissable={!busy}
      // ลบรูปโปรไฟล์ is a real, separate outcome of "change my picture", not a destructive twin of
      // it — so it sits away from the commit pair rather than beside it.
      footerClassName="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      footer={
        <>
          {hasPicture && (
            <Btn
              variant="danger"
              className="sm:order-first"
              onClick={remove}
              {...removing.buttonProps('กำลังลบรูปโปรไฟล์')}
            >
              {removing.busy && <Spinner />}
              ลบรูปโปรไฟล์
            </Btn>
          )}
          {/* `flex-row-reverse` puts บันทึกรูปภาพ on the right at `sm` while keeping it FIRST in
              the DOM, so on a phone — where the column is not reversed — the commit is the button
              under the thumb. */}
          <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row-reverse">
            <Btn
              variant="primary"
              className="disabled:cursor-not-allowed disabled:bg-base-300 disabled:text-base-content/70 disabled:hover:brightness-100"
              onClick={save}
              {...saving.buttonProps('กำลังอัปโหลดรูปโปรไฟล์')}
              // Nothing picked yet, so there is nothing to save. `buttonProps` also returns
              // `disabled`, so this is merged by hand rather than spread over.
              //
              // ⚠️ `src` AND NOT THE CROPPER REF. The ref is set by an effect, which runs after the
              // render that mounts the `<img>` — reading it here would leave the button disabled
              // for one frame after a picture appears, and the ref changing does not re-render
              // anything to undo it. `src` is the state that says a picture is in the frame; the
              // cropper always exists by the time a click can arrive, and `save` re-checks anyway.
              disabled={saving.busy || !src}
            >
              {saving.busy && <Spinner />}
              บันทึกรูปภาพ
            </Btn>
            <Btn variant="ghost" disabled={busy} onClick={onClose}>
              ยกเลิก
            </Btn>
          </div>
        </>
      }
    >
      <InlineAlert message={alert} />

      {/* One control, three jobs: click to browse, drop to load, and — once a picture is in it —
          the crop surface itself. A separate file-input sitting under the zone would be two
          controls doing the same thing and a second thing to keep in sync. */}
      <div
        ref={dropRef}
        className={`pf-drop ${src ? 'pf-drop-img' : ''} ${dragOver ? 'pf-drop-on' : ''}`.trim()}
        // Once an image is in it, it stops being a button: no role, no tab stop, no label. Leaving
        // it activatable invites a click that would silently replace the crop in progress.
        role={src ? undefined : 'button'}
        tabIndex={src ? undefined : 0}
        aria-label={src ? undefined : 'เลือกรูปโปรไฟล์ กดเพื่อเลือกไฟล์ หรือลากไฟล์มาวาง'}
        onClick={() => {
          if (!src) fileRef.current?.click()
        }}
        onKeyDown={(e) => {
          if (src) return
          if (e.key !== 'Enter' && e.key !== ' ') return
          e.preventDefault() // Space would scroll the dialog
          fileRef.current?.click()
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          if (!src) setDragOver(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!src) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (src) return // a crop is in progress
          const f = e.dataTransfer.files?.[0]
          if (f) accept(f)
        }}
      >
        {src ? (
          // ⚠️ THE `<img>` MUST BE THE ONLY CHILD AND CARRY NO LAYOUT CLASSES — the prototype says
          // so at this exact spot, because Cropper.js REPLACES it with its own container and reads
          // the wrapper for size. `.pf-drop-img` drops the zone's padding to zero so the container
          // fills the frame exactly.
          <div className="h-full w-full">
            <img ref={imgRef} src={src} alt="" className="block max-w-full" />
          </div>
        ) : (
          <div className="pointer-events-none">
            <svg
              aria-hidden="true"
              className="mx-auto mb-2 h-9 w-9 text-base-content/60"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 7.5L12 3m0 0L7.5 7.5M12 3v13.5"
              />
            </svg>
            <p className="m-0 text-[14px] font-medium text-base-content/90">
              ลากไฟล์มาวาง หรือกดเพื่อเลือกรูป
            </p>
            <p className="m-0 mt-1 text-[13px] leading-[1.45] text-base-content/70">
              JPEG, PNG หรือ WEBP · ไม่เกิน 2 MB
            </p>
            <p className="m-0 mt-1 text-[13px] leading-[1.45] text-base-content/70">
              เลือกแล้วจะครอปเป็นสี่เหลี่ยมจัตุรัสได้
            </p>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={AVATAR_ACCEPTED_TYPES.join(',')}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) accept(f)
        }}
      />

      {/* Always in the DOM, hidden when empty — a live region created at the same moment as its
          text is never announced. Same rule as `InlineAlert` and `FormField`'s error line. */}
      <p role="alert" className={`form-err ${err ? '' : 'hidden'}`.trim()}>
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
        <span>{err}</span>
      </p>

      {/* Only meaningful once something is loaded, so it is absent until then rather than sitting
          there greyed out. */}
      {src && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Btn
            variant="ghost"
            className="h-10 min-h-10 px-3 text-[13px]"
            onClick={() => cropperRef.current?.rotate(90)}
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            หมุน 90°
          </Btn>
          <Btn
            variant="ghost"
            className="h-10 min-h-10 px-3 text-[13px]"
            onClick={() => {
              clearPick()
              fileRef.current?.click()
            }}
          >
            เลือกรูปอื่น
          </Btn>
        </div>
      )}
    </Modal>
  )
}
