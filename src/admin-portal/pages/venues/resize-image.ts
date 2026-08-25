/**
 * Downscale a picked photo before it is uploaded — 1920px on the long edge, JPEG q0.82 (`Q19`, PO
 * 25 ส.ค. 2569).
 *
 * ── Who this is for, and it is NOT the server ──────────────────────────────────────────────────
 * ⚠️ THIS IS NOT A CONTROL. A `POST /venues/photos` sent by hand skips it entirely, which is why the
 * 5 MB cap lives on the server and is asserted by an e2e test. What this buys is the thing a cap
 * cannot: the person who pays for an unresized 12 MB phone photo is not the operator who uploaded it
 * — it is every end user opening the venue list in LINE on mobile data, forever.
 *
 * The alternative was resizing server-side with `sharp`, and it was rejected for a stated reason:
 * `sharp` is a native dependency, the Docker image is still an open item (DOCKER-1), and the browser
 * already has a perfectly good encoder that costs the deployment nothing.
 *
 * ── Failing SOFT is deliberate ─────────────────────────────────────────────────────────────────
 * Every failure path returns the ORIGINAL file rather than throwing. A decode that fails, a canvas
 * the browser refuses to export, an unrecognised type — none of those are reasons to stop somebody
 * uploading a photo, because the server will accept the original if it fits and reject it with a
 * clear message if it does not. Turning a best-effort optimisation into a hard error would make this
 * helper the reason an upload failed.
 */

/** The long edge, in CSS pixels. A 4032×3024 phone photo lands at 1920×1440. */
export const MAX_EDGE = 1920

/**
 * ⚠️ 0.82, and the second decimal is not noise. 0.9 barely shrinks a photo the camera already
 * compressed; 0.7 puts visible blocking on the flat walls that make up most of a room photo. This is
 * the prototype's number and it was chosen against room photographs, not against a test chart.
 */
export const JPEG_QUALITY = 0.82

/**
 * Types worth re-encoding. PNG and WEBP go through too — a PNG screenshot of a floor plan is a
 * common thing to attach and is enormous — and both come out as JPEG, which is what
 * `image/jpeg` in the output name says.
 *
 * ⚠️ THE SERVER SNIFFS MAGIC BYTES AND REQUIRES THEM TO MATCH THE DECLARED TYPE, so the returned
 * File must carry `type: 'image/jpeg'` AND a `.jpg` name. Handing back JPEG bytes under the original
 * `.png` name would be rejected by the very check that makes the upload safe.
 */
const RESIZABLE = new Set(['image/jpeg', 'image/png', 'image/webp'])

const loadBitmap = async (file: File): Promise<ImageBitmap | null> => {
  try {
    return await createImageBitmap(file)
  } catch {
    return null
  }
}

const toBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))

/** Replaces the extension rather than appending one, so `a.png` becomes `a.jpg`, not `a.png.jpg`. */
const asJpegName = (name: string): string => `${name.replace(/\.[^./\\]+$/, '')}.jpg`

export async function resizeForUpload(file: File): Promise<File> {
  if (!RESIZABLE.has(file.type)) return file

  const bitmap = await loadBitmap(file)
  if (!bitmap) return file

  const { width, height } = bitmap
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
  // Already small enough AND already a JPEG: re-encoding would only lose quality for nothing.
  // A small PNG still goes through, because the win there is the format, not the size.
  if (scale === 1 && file.type === 'image/jpeg') {
    bitmap.close()
    return file
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return file
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const blob = await toBlob(canvas)
  if (!blob) return file
  // ⚠️ IF THE RE-ENCODE CAME OUT BIGGER, KEEP THE ORIGINAL. It happens: a small, heavily optimised
  // PNG of a plan drawing can grow when turned into a JPEG. Uploading the larger of the two would
  // make this helper actively harmful on exactly the files it was least needed for.
  if (blob.size >= file.size && file.type === 'image/jpeg') return file

  return new File([blob], asJpegName(file.name), {
    type: 'image/jpeg',
    lastModified: file.lastModified,
  })
}
