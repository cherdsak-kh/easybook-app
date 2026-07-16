/**
 * Crop → canvas → encoded image file.
 *
 * ## Why this is a plain module and not part of the modal
 * jsdom implements neither `HTMLCanvasElement.prototype.toBlob` nor real image
 * decoding. Inlining this in the component would make the component's OWN
 * behaviour (modal opens, confirm uploads, errors render) untestable. Here it is
 * a single import boundary the component tests stub with `vi.mock('@/lib/...')`,
 * matching the convention in `HomePage.test.tsx` / `HealthStatus.test.tsx`.
 *
 * ## The size contract this exists to keep
 * The upload proxy rejects anything OVER 2 MiB. Cropping can *increase* size — a
 * 300 KB JPEG re-encoded as PNG easily clears 2 MiB — so a file that passed the
 * pre-check at selection can fail after cropping. Three things prevent that:
 *  1. the output is bounded to 512×512 (never upscaled past the source crop),
 *  2. it is encoded as JPEG (lossy, bounded) — never PNG,
 *  3. quality steps down a ladder until the blob fits, and if even the floor
 *     misses we throw `too-large` rather than letting the server 400.
 */

/** A pixel rectangle in the SOURCE image's natural coordinates. */
export interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Avatars are never displayed above 80 CSS px (the profile card); 512 leaves
 * generous headroom for a 3x DPR screen and for any future larger surface, while
 * capping worst-case bytes. Larger buys nothing an avatar can show.
 */
export const AVATAR_OUTPUT_SIZE = 512

/**
 * JPEG, deliberately — and NOT WEBP. `canvas.toBlob()` silently falls back to
 * PNG when asked for a type it cannot encode, and PNG is exactly the ballooning
 * case we are defending against. JPEG encoding is universally supported, is on
 * the backend's allow-list, and its magic bytes sniff as `image/jpeg`.
 */
export const AVATAR_OUTPUT_TYPE = 'image/jpeg'

/**
 * Tried in order, first fit wins. 0.82 is visually indistinguishable at avatar
 * scale; the lower rungs only ever engage for pathologically noisy sources.
 * A 512×512 JPEG at 0.82 is typically 25–60 KB — two orders of magnitude inside
 * the 2 MiB ceiling — so the ladder is a belt-and-braces guarantee, not the
 * primary defence.
 */
export const AVATAR_QUALITY_LADDER = [0.82, 0.7, 0.6, 0.45] as const

export type CropFailure = 'decode' | 'encode' | 'too-large'

/** A crop that could not produce an uploadable file, with the reason why. */
export class CropError extends Error {
  readonly reason: CropFailure

  constructor(reason: CropFailure, message: string) {
    super(message)
    this.name = 'CropError'
    this.reason = reason
  }
}

export interface CropOptions {
  /** Longest edge of the square output. Defaults to `AVATAR_OUTPUT_SIZE`. */
  outputSize?: number
  /**
   * Hard ceiling for the produced file. The caller passes the backend's
   * `AVATAR_MAX_BYTES`; the limit is EXCLUSIVE server-side, so a blob of exactly
   * `maxBytes` is a PASS here — reject only `>`.
   */
  maxBytes: number
  /** Output filename. Extension should match `AVATAR_OUTPUT_TYPE`. */
  fileName?: string
}

/** Decode an object URL into an `<img>`. Rejects rather than hanging on a bad file. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () =>
      reject(new CropError('decode', 'The selected image could not be decoded.'))
    img.src = src
  })
}

/** Promisified `toBlob` — the callback yields `null` when encoding fails. */
function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality)
  })
}

/**
 * Render `area` of `imageSrc` into a square, size-bounded JPEG `File`.
 *
 * Returns a `File` (a `Blob` subclass) so it goes straight to `uploadOwnAvatar`
 * with no re-wrapping. Throws `CropError` — never returns an oversize file.
 */
export async function cropImageToFile(
  imageSrc: string,
  area: CropArea,
  { outputSize = AVATAR_OUTPUT_SIZE, maxBytes, fileName = 'avatar.jpg' }: CropOptions,
): Promise<File> {
  const image = await loadImage(imageSrc)

  // Never upscale: a 200px crop stays 200px rather than being blown up to 512
  // and re-encoding interpolation noise into extra bytes.
  const size = Math.max(1, Math.min(Math.round(outputSize), Math.round(area.width)))

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new CropError('encode', 'Canvas is unavailable in this browser.')

  // JPEG has NO alpha channel: without an opaque base, every transparent pixel
  // of a PNG source encodes as BLACK. Paint white first.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, size, size)

  let smallest: Blob | null = null
  for (const quality of AVATAR_QUALITY_LADDER) {
    const blob = await toBlob(canvas, AVATAR_OUTPUT_TYPE, quality)
    if (!blob) continue
    // `toBlob` silently substitutes PNG for a type it cannot encode. If that
    // ever happened the size guarantee would be void, so refuse it outright
    // rather than shipping bytes the server would sniff as something else.
    if (blob.type !== AVATAR_OUTPUT_TYPE) {
      throw new CropError('encode', `Expected ${AVATAR_OUTPUT_TYPE}, got ${blob.type || 'unknown'}.`)
    }
    if (!smallest || blob.size < smallest.size) smallest = blob
    // `<=`, mirroring the backend's exclusive limit: exactly maxBytes is fine.
    if (blob.size <= maxBytes) {
      return new File([blob], fileName, { type: AVATAR_OUTPUT_TYPE })
    }
  }

  if (!smallest) throw new CropError('encode', 'The image could not be encoded.')
  // Every rung overshot. Fail here with a reason the UI can explain, rather than
  // uploading into a guaranteed 400.
  throw new CropError('too-large', 'The cropped image is still over the size limit.')
}
