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
 * `react-easy-crop`, which the prototype's own header names as one of the two acceptable React
 * equivalents of its CDN Cropper.js — "do NOT hand-roll a cropper" — and which was already a
 * dependency of this repo. Same knobs as the prototype: square aspect, drag to move, wheel/pinch
 * to zoom, and a หมุน 90° button. No zoom slider, because the prototype has none and the gesture
 * is already there.
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
import Cropper, { type Area } from 'react-easy-crop'
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

const rad = (deg: number) => (deg * Math.PI) / 180

/**
 * The crop, as a file.
 *
 * ⚠️ TWO CANVASES, because `rotation` is not a property of the source bitmap. The first paints the
 * image rotated inside a box big enough to hold it at that angle — which is the coordinate space
 * `croppedAreaPixels` is measured in — and the second cuts the selected square out of that. Doing
 * it in one pass means the crop rectangle and the pixels it is indexing disagree the moment
 * anything but 0° is chosen, and the symptom is a picture that is subtly off-centre only after the
 * rotate button is used.
 *
 * PNG, matching the prototype. A 512px square tops out well under the 2 MB limit even at PNG's
 * worst case, and it keeps the one lossless step in the pipeline where the operator can see it.
 */
async function croppedFile(src: string, area: Area, rotation: number): Promise<File> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.addEventListener('load', () => resolve(el))
    el.addEventListener('error', () => reject(new Error('image decode failed')))
    el.src = src
  })

  const r = rad(rotation)
  const boxW = Math.abs(Math.cos(r) * image.width) + Math.abs(Math.sin(r) * image.height)
  const boxH = Math.abs(Math.sin(r) * image.width) + Math.abs(Math.cos(r) * image.height)

  const rotated = document.createElement('canvas')
  rotated.width = boxW
  rotated.height = boxH
  const rctx = rotated.getContext('2d')
  if (!rctx) throw new Error('no 2d context')
  rctx.translate(boxW / 2, boxH / 2)
  rctx.rotate(r)
  rctx.drawImage(image, -image.width / 2, -image.height / 2)

  const out = Math.min(OUT_MAX_PX, Math.round(area.width))
  const square = document.createElement('canvas')
  square.width = out
  square.height = out
  const sctx = square.getContext('2d')
  if (!sctx) throw new Error('no 2d context')
  sctx.imageSmoothingQuality = 'high'
  sctx.drawImage(rotated, area.x, area.y, area.width, area.height, 0, 0, out, out)

  const blob = await new Promise<Blob | null>((resolve) => square.toBlob(resolve, 'image/png'))
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
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [pixels, setPixels] = useState<Area | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [alert, setAlert] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const busy = saving.busy || removing.busy

  /** Back to the empty drop zone. ONE path, so the dialog cannot end up half reset. */
  const clearPick = useCallback(() => {
    setSrc(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotation(0)
    setPixels(null)
    setDragOver(false)
    setErr(null)
    setAlert(null)
    if (fileRef.current) fileRef.current.value = ''
  }, [])

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
      if (!src || !pixels) return
      setAlert(null)
      try {
        await uploadOwnAvatar(await croppedFile(src, pixels, rotation))
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
              disabled={saving.busy || !src || !pixels}
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
          // The cropper positions its own layers absolutely, so it needs a sized, positioned box.
          // `.pf-drop-img` drops the zone's padding to zero so this fills the frame exactly.
          <div className="relative h-full w-full">
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={1}
              // Round, because the thing being produced is round everywhere it is ever shown.
              // A square preview makes people frame for corners that get cut off.
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_area, areaPixels) => setPixels(areaPixels)}
            />
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
            onClick={() => setRotation((r) => (r + 90) % 360)}
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
