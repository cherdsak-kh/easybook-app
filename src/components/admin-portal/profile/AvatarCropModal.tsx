import { useCallback, useRef, useState, type DragEvent, type Ref } from 'react'
import Cropper from 'react-easy-crop'
import type { Area, Point } from 'react-easy-crop'
import ArrowUpTrayIcon from '@heroicons/react/24/outline/ArrowUpTrayIcon'
import {
  ApiError,
  AVATAR_ACCEPTED_TYPES,
  AVATAR_MAX_BYTES,
  uploadOwnAvatar,
  type SystemUser,
} from '@/lib/api-client'
import { cropImageToFile, croppedFileName } from '@/lib/crop-image'
import { PROFILE_STRINGS } from '@/constants/ui-strings-profile'

const T = PROFILE_STRINGS

const ZOOM_MIN = 1
const ZOOM_MAX = 3
const ZOOM_STEP = 0.05
/** Only for the "file too large" copy — the byte constant stays the source of truth. */
const MAX_MEGABYTES = Math.round(AVATAR_MAX_BYTES / (1024 * 1024))

/**
 * Avatar upload with a 1:1 crop.
 *
 * Library choice is `react-easy-crop` (already a dependency), NOT the prototypes'
 * CDN Cropper.js: Cropper 1.x is an imperative `new Cropper(node)` / `.destroy()`
 * lifecycle on a raw DOM node that fights React's reconciliation, and a CDN
 * `<script>`/`<link>` is unacceptable here (offline builds, CSP, no version pinning).
 *
 * `react-easy-crop` yields only a rectangle, never an image, so the output path is
 * `croppedAreaPixels → canvas → Blob → File` in `@/lib/crop-image`, and that `File`
 * is what `uploadOwnAvatar` posts as the single multipart `file` part.
 *
 * The client-side size guard is `> AVATAR_MAX_BYTES`, deliberately **not** `>=`: the
 * backend accepts a file of exactly 2 MiB and rejects 2 MiB + 1, so `>=` would reject
 * a file the server would have taken. These checks are fast feedback only — the
 * server sniffs magic bytes and remains the authority.
 */
export function AvatarCropModal({
  ref,
  onUploaded,
  onClose,
  onRequestClose,
  onExpireSession,
}: {
  readonly ref: Ref<HTMLDialogElement>
  /** Hand the UPDATED user straight up — the new URL comes from the response body. */
  readonly onUploaded: (user: SystemUser) => void
  readonly onClose: () => void
  readonly onRequestClose: () => void
  readonly onExpireSession: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const objectUrlRef = useRef<string | null>(null)

  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [fileName, setFileName] = useState('avatar.jpg')
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(ZOOM_MIN)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const releaseObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    releaseObjectUrl()
    setImageSrc(null)
    setFileName('avatar.jpg')
    setCrop({ x: 0, y: 0 })
    setZoom(ZOOM_MIN)
    setCroppedArea(null)
    setDragging(false)
    setUploading(false)
    setError(null)
    // Without this the SAME file picked twice in a row fires no `change` event.
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [releaseObjectUrl])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  const acceptFile = useCallback(
    (file: File) => {
      setError(null)
      if (!(AVATAR_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
        setError(T.avatar.badType)
        return
      }
      // EXCLUSIVE bound — exactly AVATAR_MAX_BYTES is accepted.
      if (file.size > AVATAR_MAX_BYTES) {
        setError(T.avatar.tooLarge(MAX_MEGABYTES))
        return
      }
      releaseObjectUrl()
      const url = URL.createObjectURL(file)
      objectUrlRef.current = url
      setImageSrc(url)
      setFileName(croppedFileName(file.name))
      setCrop({ x: 0, y: 0 })
      setZoom(ZOOM_MIN)
      setCroppedArea(null)
    },
    [releaseObjectUrl],
  )

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer?.files?.[0]
      if (file) acceptFile(file)
    },
    [acceptFile],
  )

  const submit = useCallback(async () => {
    if (!imageSrc || !croppedArea) return
    setUploading(true)
    setError(null)

    let file: File
    try {
      file = await cropImageToFile(imageSrc, croppedArea, fileName)
    } catch {
      setUploading(false)
      setError(T.avatar.cropFailed)
      return
    }

    try {
      const updated = await uploadOwnAvatar(file)
      setUploading(false)
      onUploaded(updated)
    } catch (err: unknown) {
      setUploading(false)
      if (err instanceof ApiError && err.status === 401) {
        onExpireSession()
        return
      }
      if (err instanceof ApiError && (err.status === 400 || err.status === 415)) {
        setError(T.avatar.badType)
        return
      }
      if (err instanceof ApiError && err.status === 413) {
        setError(T.avatar.tooLarge(MAX_MEGABYTES))
        return
      }
      setError(T.avatar.failed)
    }
  }, [imageSrc, croppedArea, fileName, onUploaded, onExpireSession])

  return (
    <dialog
      ref={ref}
      className="modal modal-bottom sm:modal-middle"
      aria-labelledby="profile-avatar-title"
      onClose={handleClose}
      onCancel={(e) => {
        if (uploading) e.preventDefault()
      }}
    >
      <div className="modal-box w-full max-w-md p-4 sm:p-6">
        <button
          type="button"
          onClick={onRequestClose}
          disabled={uploading}
          aria-label={T.actions.close}
          className="btn btn-circle btn-ghost btn-sm absolute top-2 right-2 focus-visible:ring-2 focus-visible:ring-primary"
        >
          ✕
        </button>
        <h3 id="profile-avatar-title" className="mb-4 text-center text-lg font-bold">
          {T.avatar.title}
        </h3>

        <div className="flex flex-col items-center gap-4 sm:gap-6">
          {/* Fixed height in BOTH states so swapping picker → cropper never shifts layout. */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`relative h-64 w-full overflow-hidden rounded-lg bg-base-200 transition-colors sm:h-72 ${
              imageSrc
                ? ''
                : `border-2 border-dashed ${dragging ? 'border-primary bg-base-300' : 'border-base-300'}`
            }`}
          >
            {imageSrc ? (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                minZoom={ZOOM_MIN}
                maxZoom={ZOOM_MAX}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_area, areaPixels) => setCroppedArea(areaPixels)}
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-base-content/50">
                <ArrowUpTrayIcon className="size-10 opacity-50" aria-hidden />
                <span className="text-sm font-medium">{T.avatar.pickHint}</span>
              </div>
            )}
          </div>

          <div className="w-full">
            <label
              htmlFor="profile-avatar-file"
              className="mb-1 block text-sm font-medium"
            >
              {T.avatar.pickLabel}
            </label>
            <input
              ref={fileInputRef}
              id="profile-avatar-file"
              type="file"
              accept={AVATAR_ACCEPTED_TYPES.join(',')}
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) acceptFile(file)
              }}
              className="file-input file-input-sm w-full focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          {imageSrc && (
            <div className="w-full">
              <label htmlFor="profile-avatar-zoom" className="mb-1 block text-sm font-medium">
                {T.avatar.zoom}
              </label>
              <input
                id="profile-avatar-zoom"
                type="range"
                min={ZOOM_MIN}
                max={ZOOM_MAX}
                step={ZOOM_STEP}
                value={zoom}
                disabled={uploading}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="range range-primary range-sm w-full"
              />
              <p className="mt-1 text-xs text-base-content/60">{T.avatar.cropHint}</p>
            </div>
          )}

          {error && (
            <div role="alert" className="alert alert-error alert-soft w-full text-sm">
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="modal-action flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onRequestClose}
            disabled={uploading}
            className="btn btn-ghost order-last w-full sm:order-first sm:w-auto"
          >
            {T.actions.cancel}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={uploading || !imageSrc || !croppedArea}
            aria-busy={uploading}
            className="btn btn-primary w-full sm:w-auto focus-visible:ring-2 focus-visible:ring-primary"
          >
            {uploading && <span className="loading loading-spinner loading-xs" aria-hidden />}
            {uploading ? T.avatar.submitting : T.avatar.submit}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button aria-label={T.actions.closeBackdrop} disabled={uploading}>
          {T.actions.close}
        </button>
      </form>
    </dialog>
  )
}
