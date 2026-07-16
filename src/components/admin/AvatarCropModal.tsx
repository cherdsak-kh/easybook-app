import { useEffect, useMemo, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { AVATAR_MAX_BYTES } from '@/lib/api-client'
import { CropError, cropImageToFile } from '@/lib/crop-image'
import { Spinner } from '@/components/Spinner'
import { UI_STRINGS } from '@/constants/ui-strings'

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

  const imageSrc = useMemo(() => URL.createObjectURL(file), [file])
  // Revoke on unmount: the blob stays in memory for the document's lifetime
  // otherwise, and a user re-picking repeatedly would leak every attempt.
  useEffect(() => () => URL.revokeObjectURL(imageSrc), [imageSrc])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel, busy])

  async function handleConfirm() {
    if (!area || busy) return
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
        className="absolute inset-0 bg-slate-900/60"
        onClick={onCancel}
        disabled={busy}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl dark:bg-slate-900"
      >
        <h2 id={titleId} className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {UI.title}
        </h2>
        <p id={descId} className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {UI.intro}
        </p>

        {/* Square stage: the preview matches the 1:1 output, so what they frame
            is exactly what gets stored. */}
        <div className="relative mt-3 aspect-square w-full overflow-hidden rounded-xl bg-slate-900">
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
        </div>

        <div className="mt-4">
          <label
            htmlFor="avatar-crop-zoom"
            className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
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
            className="w-full accent-emerald-600 disabled:opacity-60"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400"
          >
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {UI_STRINGS.common.cancel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            // `!area` guards the moment before the cropper reports its first
            // selection — confirming then would crop nothing.
            disabled={busy || !area}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60"
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
