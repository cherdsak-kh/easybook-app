import { useEffect, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { AVATAR_MAX_BYTES } from '@/lib/api-client'
import { CropError, cropImageToFile } from '@/lib/crop-image'
import { Spinner } from '@/components/Spinner'
import { UI_STRINGS } from '@/constants/ui-strings-backend'

const UI = UI_STRINGS.profile.avatarCrop

export interface AvatarCropModalProps {
  /** The picked file. This modal owns the object URL derived from it. */
  file: File
  /**
   * Receives the cropped, JPEG-encoded, size-VALIDATED square file. It is
   * already known to fit the backend's limit, so the caller can upload it as-is.
   */
  onConfirm: (cropped: File) => void
  onCancel: () => void
}

/**
 * Square-crop dialog (Task 3). Every avatar upload passes through here, so a 1:1
 * result is guaranteed by construction rather than by asking the user nicely —
 * `aspect={1}` is fixed and there is no way to confirm a non-square selection.
 *
 * ## Division of labour
 * This component owns the crop: gesture state, encoding, and the SIZE VERDICT.
 * The actual `cropImageToFile` work lives in `@/lib/crop-image` because jsdom has
 * no canvas 2D context, so it must be stubbable at the import boundary for this
 * component to be testable at all. The caller owns the upload and its errors.
 *
 * A too-large result is reported HERE rather than thrown back to the page: the
 * fix (zoom into a smaller area) is a control in this dialog, so closing it to
 * show the error elsewhere would take the remedy away.
 */
export function AvatarCropModal({ file, onConfirm, onCancel }: AvatarCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [imageSrc, setImageSrc] = useState<string | null>(null)

  /**
   * Creation and revocation MUST share one effect lifecycle.
   *
   * Deriving the URL in render (`useMemo`) while revoking it in an effect
   * cleanup mismatches the two: StrictMode runs mount → cleanup → remount, so
   * the cleanup revoked the URL and the remount re-ran the effect, but the memo
   * did NOT recompute (`[file]` never changed). The cropper was left holding an
   * already-revoked `blob:` URL — a blank crop window, dev-only.
   *
   * Here the cleanup closes over the URL *its own run* created, so a remount
   * always mints a fresh, live URL. Revoking still happens on real unmount and
   * on a `file` change: the blob would otherwise live for the document's
   * lifetime, and re-picking repeatedly would leak every attempt.
   */
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setImageSrc(url)
    return () => {
      URL.revokeObjectURL(url)
      // Keeps the invariant "imageSrc is live or null" — state can never
      // outlive the effect run that created it, so nothing (least of all
      // `handleConfirm`) can reach for a revoked URL.
      setImageSrc(null)
    }
  }, [file])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel, busy])

  async function handleConfirm() {
    // `!imageSrc` covers the frame before the effect mints the URL (and any
    // moment it has been revoked): cropping against a dead URL would fail the
    // decode for reasons the user cannot act on.
    if (!area || busy || !imageSrc) return
    setBusy(true)
    setError(null)
    try {
      const cropped = await cropImageToFile(imageSrc, area, { maxBytes: AVATAR_MAX_BYTES })
      onConfirm(cropped)
    } catch (err: unknown) {
      // `too-large` means the quality ladder bottomed out and still overshot —
      // a different message, because a different action fixes it.
      setError(err instanceof CropError && err.reason === 'too-large' ? UI.stillTooLarge : UI.failed)
      setBusy(false)
    }
  }

  const titleId = 'avatar-crop-title'
  const descId = 'avatar-crop-desc'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label={UI_STRINGS.common.closeDialog}
        className="absolute inset-0 bg-neutral/60"
        onClick={onCancel}
        disabled={busy}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative z-10 w-full max-w-md rounded-t-2xl bg-base-100 p-5 shadow-xl sm:rounded-2xl"
      >
        <h2 id={titleId} className="text-lg font-bold text-base-content">
          {UI.title}
        </h2>
        <p id={descId} className="mt-1 text-sm text-base-content/70">
          {UI.intro}
        </p>

        {/* Square stage: the preview matches the 1:1 output, so what they frame
            is exactly what gets stored. A deliberately dark media backdrop (not a
            theme surface) so the image reads in both light and dark. */}
        <div className="relative mt-3 aspect-square w-full overflow-hidden rounded-xl bg-neutral">
          {/* Held back until the URL exists, rather than handing the cropper a
              null/dead src and flashing a broken image. `aspect-square` sits on
              the container, so the stage reserves its space either way and this
              frame costs no layout shift. */}
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_area, areaPixels) => setArea(areaPixels)}
            />
          )}
        </div>

        <div className="mt-4">
          <label htmlFor="avatar-crop-zoom" className="mb-1 block text-sm font-medium">
            {UI.zoom}
          </label>
          <input
            id="avatar-crop-zoom"
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            disabled={busy}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="range range-primary w-full disabled:opacity-60"
          />
        </div>

        {error && (
          <div role="alert" className="alert alert-error alert-soft mt-3 text-sm">
            {error}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="btn btn-outline btn-sm focus-visible:ring-2 focus-visible:ring-primary"
          >
            {UI_STRINGS.common.cancel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            // `!area` guards the moment before the cropper reports its first
            // selection — confirming then would crop nothing; `!imageSrc` the
            // frame before its URL exists.
            disabled={busy || !area || !imageSrc}
            className="btn btn-primary btn-sm focus-visible:ring-2 focus-visible:ring-primary"
          >
            {busy ? (
              <>
                <Spinner label={UI.croppingSr} />
                <span>{UI.cropping}</span>
              </>
            ) : (
              UI.confirm
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
