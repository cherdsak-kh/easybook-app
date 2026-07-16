import { AVATAR_QUALITY_LADDER, CropError, cropImageToFile } from '@/lib/crop-image'

/**
 * The 2 MiB guarantee lives in this module, so it is asserted directly rather
 * than through a component. jsdom has no canvas 2D context and decodes no
 * images, so both are stood in for here — which is precisely why this logic is a
 * plain module and not buried in the modal.
 */

const AREA = { x: 10, y: 20, width: 1000, height: 1000 }

/** Decides what `toBlob` yields for a given quality rung. */
type BlobPlan = (quality: number) => { size: number; type?: string } | null

let plan: BlobPlan
let qualitiesTried: number[]
let fillStyleWhenFilled: string | null
let ctx: {
  fillStyle: string
  fillRect: ReturnType<typeof vi.fn>
  drawImage: ReturnType<typeof vi.fn>
}
let canvas: { width: number; height: number; getContext: () => typeof ctx; toBlob: unknown }

/** An image that decodes successfully (or not, when `fail` is set). */
function stubImage(fail = false) {
  class FakeImage {
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    set src(_value: string) {
      queueMicrotask(() => (fail ? this.onerror?.() : this.onload?.()))
    }
  }
  vi.stubGlobal('Image', FakeImage)
}

beforeEach(() => {
  qualitiesTried = []
  fillStyleWhenFilled = null
  plan = () => ({ size: 10 })

  ctx = {
    fillStyle: '',
    fillRect: vi.fn(() => {
      fillStyleWhenFilled = ctx.fillStyle
    }),
    drawImage: vi.fn(),
  }
  canvas = {
    width: 0,
    height: 0,
    getContext: () => ctx,
    toBlob: (cb: (b: Blob | null) => void, type: string, quality: number) => {
      qualitiesTried.push(quality)
      const spec = plan(quality)
      cb(spec ? new Blob([new Uint8Array(spec.size)], { type: spec.type ?? type }) : null)
    },
  }

  const realCreate = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
    tag === 'canvas' ? (canvas as unknown as HTMLCanvasElement) : realCreate(tag),
  )
  stubImage()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('cropImageToFile', () => {
  it('returns a JPEG File at the first quality that fits', async () => {
    const file = await cropImageToFile('blob:x', AREA, { maxBytes: 100 })

    expect(file).toBeInstanceOf(File)
    // JPEG, never PNG: PNG is the ballooning case this module exists to avoid,
    // and the server derives the stored ContentType from the sniffed bytes.
    expect(file.type).toBe('image/jpeg')
    expect(file.name).toBe('avatar.jpg')
    expect(qualitiesTried).toEqual([AVATAR_QUALITY_LADDER[0]])
  })

  it('steps DOWN the quality ladder until the result fits', async () => {
    // Only the third rung squeezes under the limit.
    plan = (q) => ({ size: q > AVATAR_QUALITY_LADDER[2] ? 500 : 50 })

    const file = await cropImageToFile('blob:x', AREA, { maxBytes: 100 })

    expect(file.size).toBe(50)
    expect(qualitiesTried).toEqual([
      AVATAR_QUALITY_LADDER[0],
      AVATAR_QUALITY_LADDER[1],
      AVATAR_QUALITY_LADDER[2],
    ])
  })

  it('throws `too-large` rather than returning an oversize file when every rung overshoots', async () => {
    plan = () => ({ size: 5000 })

    // The whole point: a cropped file that would be a guaranteed 400 must never
    // reach the upload helper.
    await expect(cropImageToFile('blob:x', AREA, { maxBytes: 100 })).rejects.toMatchObject({
      name: 'CropError',
      reason: 'too-large',
    })
    expect(qualitiesTried).toEqual([...AVATAR_QUALITY_LADDER])
  })

  it('accepts a blob of EXACTLY maxBytes — the backend limit is exclusive', async () => {
    plan = () => ({ size: 100 })

    // `<=`, mirroring the server: exactly the limit is accepted, so rejecting
    // here would refuse a file the backend would have taken.
    const file = await cropImageToFile('blob:x', AREA, { maxBytes: 100 })
    expect(file.size).toBe(100)
    expect(qualitiesTried).toEqual([AVATAR_QUALITY_LADDER[0]])
  })

  it('caps the output at 512x512 for a large crop', async () => {
    await cropImageToFile('blob:x', AREA, { maxBytes: 100 })

    expect(canvas.width).toBe(512)
    expect(canvas.height).toBe(512)
  })

  it('never upscales a crop smaller than the cap', async () => {
    await cropImageToFile('blob:x', { ...AREA, width: 200, height: 200 }, { maxBytes: 100 })

    // Blowing a 200px crop up to 512 would re-encode interpolation noise into
    // extra bytes for no visible gain.
    expect(canvas.width).toBe(200)
    expect(canvas.height).toBe(200)
  })

  it('paints an opaque white base BEFORE drawing', async () => {
    await cropImageToFile('blob:x', AREA, { maxBytes: 100 })

    // JPEG has no alpha: without this, every transparent pixel of a PNG source
    // would encode as black.
    expect(fillStyleWhenFilled).toBe('#ffffff')
    expect(ctx.fillRect.mock.invocationCallOrder[0]).toBeLessThan(
      ctx.drawImage.mock.invocationCallOrder[0],
    )
  })

  it('crops the requested region rather than the whole image', async () => {
    await cropImageToFile('blob:x', AREA, { maxBytes: 100 })

    const [, sx, sy, sw, sh] = ctx.drawImage.mock.calls[0]
    expect([sx, sy, sw, sh]).toEqual([AREA.x, AREA.y, AREA.width, AREA.height])
  })

  it('refuses a silent PNG substitution from toBlob', async () => {
    // `toBlob` falls back to PNG for a type it cannot encode. That would void
    // the size guarantee, so it must fail loudly instead of shipping.
    plan = () => ({ size: 10, type: 'image/png' })

    await expect(cropImageToFile('blob:x', AREA, { maxBytes: 100 })).rejects.toMatchObject({
      name: 'CropError',
      reason: 'encode',
    })
  })

  it('throws `decode` for an image that will not load', async () => {
    stubImage(true)

    await expect(cropImageToFile('blob:x', AREA, { maxBytes: 100 })).rejects.toBeInstanceOf(
      CropError,
    )
  })
})
