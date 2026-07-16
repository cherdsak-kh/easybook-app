import { StrictMode, useEffect, useRef } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AvatarCropModal } from '@/components/admin/AvatarCropModal'
import { UI_STRINGS } from '@/constants/ui-strings'
import * as cropImage from '@/lib/crop-image'

const CROP = UI_STRINGS.profile.avatarCrop

vi.mock('@/lib/api-client', () => ({
  AVATAR_MAX_BYTES: 2 * 1024 * 1024,
}))

/**
 * jsdom has no canvas 2D context and decodes no images, so the real crop→Blob
 * path cannot run here — stubbed at the import boundary per the repo convention.
 */
vi.mock('@/lib/crop-image', () => {
  class CropError extends Error {
    reason: string
    constructor(reason: string, message: string) {
      super(message)
      this.name = 'CropError'
      this.reason = reason
    }
  }
  return { CropError, cropImageToFile: vi.fn() }
})

const CROPPED_AREA = { x: 10, y: 20, width: 300, height: 300 }

/** Every `image` value the cropper has ever been rendered with. */
let cropperRenders: unknown[] = []

/**
 * Stands in for the real cropper, which reports a selection only after the image
 * loads and its container is measured — neither happens in jsdom.
 *
 * Crucially it also PUBLISHES the `image` prop it was handed onto the DOM, which
 * is what lets these tests assert on the URL the cropper is actually using. The
 * attribute always reflects the CURRENT committed value, which is the thing that
 * decides whether the user sees an image or a blank square.
 */
function CropperStub({
  image,
  onCropComplete,
}: {
  image: string
  onCropComplete: (area: unknown, areaPixels: typeof CROPPED_AREA) => void
}) {
  cropperRenders.push(image)
  const cb = useRef(onCropComplete)
  cb.current = onCropComplete
  useEffect(() => {
    cb.current({ x: 0, y: 0, width: 100, height: 100 }, CROPPED_AREA)
  }, [])
  return <div data-testid="cropper" data-image={image} />
}

vi.mock('react-easy-crop', () => ({ default: CropperStub }))

const mockCrop = vi.mocked(cropImage.cropImageToFile)

/**
 * Object-URL ledger. jsdom implements no real blob URLs (nothing ever decodes),
 * so liveness is asserted against the CONTRACT — "was this URL handed to
 * `revokeObjectURL`?" — rather than against pixels.
 */
let created: string[]
let revoked: string[]

function croppedFile(): File {
  return new File(['cropped-jpeg-bytes'], 'avatar.jpg', { type: 'image/jpeg' })
}

function pickedFile(): File {
  return new File(['original-png-bytes'], 'me.png', { type: 'image/png' })
}

function renderModal(props: Partial<Parameters<typeof AvatarCropModal>[0]> = {}, strict = false) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  const view = render(
    <AvatarCropModal file={pickedFile()} onConfirm={onConfirm} onCancel={onCancel} {...props} />,
    strict ? { wrapper: StrictMode } : undefined,
  )
  return { ...view, onConfirm, onCancel }
}

/** The URL the cropper is currently rendering with. */
function cropperSrc(): string | null {
  return screen.getByTestId('cropper').getAttribute('data-image')
}

beforeEach(() => {
  vi.clearAllMocks()
  created = []
  revoked = []
  cropperRenders = []
  let seq = 0
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
    const url = `blob:mock/${++seq}`
    created.push(url)
    return url
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string) => {
    revoked.push(url)
  })
  mockCrop.mockResolvedValue(croppedFile())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AvatarCropModal object URL lifecycle', () => {
  /**
   * The regression this file exists for.
   *
   * The modal previously minted the URL in render (`useMemo`) but revoked it in
   * an effect cleanup. StrictMode runs mount → cleanup → remount: the cleanup
   * revoked the URL, the remount re-ran the effect, but the memo did not
   * recompute (`[file]` unchanged) — so the cropper kept a DEAD blob URL and
   * rendered a blank square. `main.tsx` wraps the app in StrictMode, so this was
   * every dev's experience while the suite stayed green (no test rendered under
   * StrictMode, and jsdom never loads a blob URL anyway).
   */
  it('hands the cropper a LIVE object URL under StrictMode (mount→cleanup→remount)', async () => {
    renderModal({}, true)

    await screen.findByTestId('cropper')
    const src = cropperSrc()

    expect(src).toBeTruthy()
    // It must be a URL this component actually minted...
    expect(created).toContain(src)
    // ...and one that has NOT been revoked out from under the cropper. This is
    // the assertion the old `useMemo` shape fails.
    expect(revoked).not.toContain(src)
  })

  it('re-mints a fresh URL rather than reusing the revoked one under StrictMode', async () => {
    renderModal({}, true)
    await screen.findByTestId('cropper')

    // StrictMode's simulated remount must produce a SECOND url: one created and
    // revoked by the discarded run, one live. Reusing a single memoized url is
    // precisely the bug.
    expect(created.length).toBeGreaterThan(1)
    expect(revoked).toEqual([created[0]])
    expect(cropperSrc()).toBe(created[created.length - 1])
  })

  it('crops against the live URL and returns the cropped file (StrictMode)', async () => {
    const cropped = croppedFile()
    mockCrop.mockResolvedValue(cropped)
    const { onConfirm } = renderModal({}, true)

    const confirm = await screen.findByRole('button', { name: CROP.confirm })
    await waitFor(() => expect(confirm).toBeEnabled())
    fireEvent.click(confirm)

    await waitFor(() => expect(mockCrop).toHaveBeenCalledTimes(1))
    const [src, area] = mockCrop.mock.calls[0]
    // Confirm must not crop against a dead URL either — `loadImage` would reject
    // with a `decode` error the user can do nothing about.
    expect(created).toContain(src)
    expect(revoked).not.toContain(src)
    expect(area).toEqual(CROPPED_AREA)

    // Identity, NOT `toHaveBeenCalledWith`: a File has no enumerable own
    // properties, so deep equality matches every File against every other one.
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    expect(onConfirm.mock.calls[0][0]).toBe(cropped)
  })

  // ------------------------------------------------------------- leak guard

  it('revokes the object URL on unmount', () => {
    const { unmount } = renderModal()

    expect(created).toHaveLength(1)
    expect(revoked).toHaveLength(0)

    unmount()

    // The blob would otherwise sit in memory for the document's lifetime.
    expect(revoked).toEqual(created)
  })

  it('leaves NO unrevoked URL behind after a StrictMode mount + unmount', async () => {
    const { unmount } = renderModal({}, true)
    await screen.findByTestId('cropper')

    unmount()

    // Every URL this component minted is accounted for — including the one the
    // discarded StrictMode run created. Re-picking repeatedly must not leak an
    // attempt each time.
    expect([...revoked].sort()).toEqual([...created].sort())
    expect(revoked).toHaveLength(created.length)
  })

  it('revokes the old URL and mints a new one when the file changes', async () => {
    const { rerender } = renderModal()
    await screen.findByTestId('cropper')
    const first = created[0]

    rerender(
      <AvatarCropModal
        file={new File(['second'], 'other.png', { type: 'image/png' })}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    await waitFor(() => expect(created.length).toBe(2))
    expect(revoked).toContain(first)
    // The cropper follows the new file, and its URL is live.
    const src = cropperSrc()
    expect(src).toBe(created[1])
    expect(revoked).not.toContain(src)
  })

  it('never hands the cropper a null/empty src', async () => {
    // The URL is minted in an effect, so the FIRST render has none. The cropper
    // must be held back until it exists rather than mounted against `null` (the
    // square stage reserves its space either way, so nothing shifts). Every
    // value the cropper was ever rendered with is checked, not just the last.
    renderModal({}, true)
    await screen.findByTestId('cropper')

    expect(cropperRenders.length).toBeGreaterThan(0)
    for (const src of cropperRenders) {
      expect(typeof src).toBe('string')
      expect(src).not.toBe('')
    }
  })
})
