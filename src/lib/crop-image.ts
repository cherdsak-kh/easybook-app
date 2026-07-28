import type { Area } from 'react-easy-crop'

/**
 * The output half of the avatar crop flow.
 *
 * `react-easy-crop` is a *controlled* component: `onCropComplete` hands back
 * `croppedAreaPixels` (a rectangle in the SOURCE image's natural pixel space) and
 * nothing else — it never produces an image. This module is that missing step:
 *
 *   croppedAreaPixels → offscreen `<canvas>` → `Blob` → `File`
 *
 * The `File` is what `uploadOwnAvatar(file)` posts as the single multipart `file`
 * part. Deliberately NOT a `Blob` (the backend reads the filename) and NOT a data
 * URL (the endpoint is multipart, not JSON).
 */

/** Output encoding. JPEG keeps a 1:1 avatar comfortably under the 2 MiB server cap. */
export const CROP_OUTPUT_TYPE = 'image/jpeg'
const CROP_OUTPUT_QUALITY = 0.92
/** Avatars are displayed at ≤96px; 512 is a generous 2x-retina ceiling. */
const CROP_OUTPUT_MAX_PX = 512

/** Decode an object-URL / data-URL into an `HTMLImageElement`. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', () => reject(new Error('The selected image could not be decoded.')))
    image.src = src
  })
}

/**
 * Draw `area` of `imageSrc` onto a square canvas and return it as a `File`.
 *
 * The crop is square by construction (the cropper runs with `aspect={1}`), so the
 * canvas is sized from `area.width` alone, clamped to {@link CROP_OUTPUT_MAX_PX}.
 * Throws on a decode failure or a `toBlob` that yields nothing — the caller renders
 * that inline and keeps the modal open rather than failing silently.
 */
export async function cropImageToFile(
  imageSrc: string,
  area: Area,
  fileName: string,
): Promise<File> {
  const image = await loadImage(imageSrc)

  const size = Math.max(1, Math.min(Math.round(area.width), CROP_OUTPUT_MAX_PX))
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser could not provide a 2D canvas context.')
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, size, size)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, CROP_OUTPUT_TYPE, CROP_OUTPUT_QUALITY)
  })
  if (!blob) throw new Error('The cropped image could not be encoded.')

  return new File([blob], fileName, { type: CROP_OUTPUT_TYPE })
}

/** `photo.PNG` → `photo.jpg`; anything unnamed → `avatar.jpg`. */
export function croppedFileName(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, '').trim()
  return `${base.length > 0 ? base : 'avatar'}.jpg`
}
