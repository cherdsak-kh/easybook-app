/**
 * QR Code บัญชีทางการ LINE — the OA's add-friend QR, to show, share and print (LINE-OA-QR-1).
 *
 * ⚠️ NOT A STATIC ASSET. Deployments switch LINE OAs (dev → production), so the QR is drawn on the
 * client from the live `basicId` that `GET /announcements/line-bot-info` returned. The URL it
 * encodes, the PNG's name and the "is there an id" guard are pure and live in `../line-qr.ts`.
 *
 * ── `qrcode` is a dynamic import ──
 * It is needed only after someone clicks a secondary pill, so it is loaded inside the draw effect
 * and lands in its own lazy chunk; the admin chunk does not grow. A failed chunk fetch (offline, a
 * deploy that replaced the chunk) rejects like any other draw failure: that is the `failed` state.
 *
 * ── Draw policy (plan D-5, AC-12) ──
 * The effect depends on `[open, url]` only: one draw per open, or when the URL changes while open.
 * The toast re-renders the parent; it does not redraw. A `cancelled` flag drops a draw that resolves
 * after the dialog closed.
 *
 * ── Colours (plan D-2, AC-7) ──
 * `color` is left unset: qrcode paints its own white light modules and 4-module quiet zone into the
 * bitmap, so the code scans the same in both themes and no Tailwind colour is involved.
 *
 * ── Mounting ──
 * The caller keeps this mounted and drives `open` (the `Modal` rule). `LineOaCard` renders it only in
 * `ok`, which cannot change while the dialog is open — there is no polling, and retry exists only in
 * `failed`.
 */

import { useEffect, useRef, useState } from 'react'
import { InlineAlert } from '../../../components/feedback/InlineAlert'
import { Btn } from '../../../components/ui/Btn'
import { Modal } from '../../../components/ui/Modal'
import { COPY_SELECT_MESSAGE, useCopy } from '../../../lib/use-copy'
import { useToast } from '../../../lib/toast-context'
import { ICON } from '../announcement-icons'
import { addFriendUrl, QR_SIZE, qrFileName } from '../line-qr'
import { Glyph } from './AnnouncementGlyph'

type DrawState = 'drawing' | 'ready' | 'failed'

/**
 * The disabled look for ดาวน์โหลด, copied from `AvatarModal`. `Btn` deliberately ships none (see its
 * note), but a failed draw can leave this one disabled indefinitely, so it has to read as off.
 */
const DOWNLOAD_BTN =
  'sm:flex-1 disabled:cursor-not-allowed disabled:bg-base-300 disabled:text-base-content/70 disabled:hover:brightness-100'

export function LineQrModal({
  open,
  onClose,
  botInfo,
}: {
  open: boolean
  onClose: () => void
  botInfo: { displayName: string; basicId: string }
}) {
  const { displayName, basicId } = botInfo
  const url = addFriendUrl(basicId)
  const fileName = qrFileName(basicId)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [draw, setDraw] = useState<DrawState>('drawing')
  const copy = useCopy()
  const { reset } = copy
  const toast = useToast()

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setDraw('drawing')
    reset()
    void (async () => {
      try {
        const m = await import('qrcode')
        // qrcode is CommonJS, and the interop differs between Vite dev (esbuild pre-bundle) and the
        // build: the functions arrive on `default` (module.exports) or on the namespace itself.
        // `moduleResolution: bundler` already types the synthetic `default`, so no cast — `?? m` is
        // the runtime half of the tolerance.
        const QR = m.default ?? m
        if (cancelled) return
        const canvas = canvasRef.current
        // `Modal` always renders its children, so this is unreachable — but a missing canvas must
        // end in the error state, never in a download button that stays disabled with no reason.
        if (!canvas) throw new Error('QR canvas is not mounted')
        await QR.toCanvas(canvas, url, { width: QR_SIZE, margin: 4, errorCorrectionLevel: 'M' })
        if (!cancelled) setDraw('ready')
      } catch {
        if (!cancelled) setDraw('failed')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, url, reset])

  /**
   * The toast is decided from `copy()`'s RETURN VALUE (the `CannedRepliesCard` rule): a second click
   * landing in the same state would not re-run a state effect. The face stays the static
   * `คัดลอกลิงก์`, so it is reset straight away and the next click is a fresh outcome.
   */
  const onCopy = async () => {
    const outcome = await copy.copy()
    if (outcome === 'copied') toast('success', 'คัดลอกลิงก์เพิ่มเพื่อนแล้ว')
    else toast('info', COPY_SELECT_MESSAGE)
    reset()
  }

  /**
   * `toDataURL`, not `toBlob`: a 220px PNG is a few kB, it is synchronous — so the click stays inside
   * the user activation — and there is no object URL to revoke. The anchor is appended, clicked and
   * removed, which older Firefox/Safari need for a download to start. No toast: the browser's own
   * download UI is the receipt.
   */
  const onDownload = () => {
    const canvas = canvasRef.current
    if (!canvas || draw !== 'ready') return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = fileName
    document.body.append(a)
    a.click()
    a.remove()
  }

  const failed = draw === 'failed'

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={400}
      title="QR Code บัญชีทางการ LINE"
      subtitle={
        <>
          {displayName} · {basicId}
        </>
      }
      footer={
        <Btn variant="ghost" onClick={onClose} className="w-full sm:w-auto">
          ปิด
        </Btn>
      }
    >
      <div className="flex flex-col items-center gap-4">
        {/* Token-only frame; the QR's white is the canvas's own pixels (plan D-2). */}
        <div className="rounded-control border border-base-300 bg-base-100 p-3">
          {/* `width`/`height` give the box its final size before the first draw, so nothing jumps.
              qrcode writes the same 220 to the bitmap and `style`, and ignores devicePixelRatio —
              `pixelated` keeps the upscale hard-edged on a 2× screen. `invisible` while failed keeps
              the box but hides a blank square that would look like a broken code. */}
          <canvas
            ref={canvasRef}
            width={QR_SIZE}
            height={QR_SIZE}
            role="img"
            aria-label={`QR Code สำหรับเพิ่มเพื่อนบัญชีทางการ LINE ${displayName} (${basicId})`}
            aria-hidden={failed || undefined}
            className={`block [image-rendering:pixelated] ${failed ? 'invisible' : ''}`.trim()}
          />
        </div>

        {/* ALWAYS MOUNTED, empty unless the draw failed (the `InlineAlert` rule). */}
        <InlineAlert
          message={failed ? 'สร้าง QR Code ไม่สำเร็จ · ปิดแล้วเปิดใหม่อีกครั้ง' : null}
          className="mb-0 w-full"
        />

        {/* Scanning opens the OA's profile to add it as a friend — a precondition of registering,
            not a login (plan D-4). */}
        <p className="m-0 text-center text-[14px] leading-[1.55] text-base-content/70">
          สแกนผ่านแอปพลิเคชัน LINE เพื่อเพิ่มเพื่อนบัญชีทางการ ซึ่งจำเป็นก่อนลงทะเบียนและใช้งาน EasyBook
        </p>

        {/* `useCopy` copies this element's `textContent` and its fallback SELECTS it, so it holds
            the URL and nothing else — no label, no icon, no sr-only text. */}
        <p
          ref={copy.ref as React.Ref<HTMLParagraphElement>}
          className="m-0 w-full break-all rounded-control border border-base-300 bg-base-200 px-3 py-2 font-mono text-[13px] text-base-content"
        >
          {url}
        </p>

        <div className="flex w-full flex-col gap-2 sm:flex-row">
          {/* Never disabled: the link does not depend on the canvas, and it is the useful fallback
              when the QR fails (plan D-5). The toast is the live region, so `copy.announcement` is
              not rendered as well. */}
          <Btn variant="ghost" className="sm:flex-1" onClick={() => void onCopy()}>
            <Glyph d={ICON.copy} />
            คัดลอกลิงก์
          </Btn>
          <Btn
            variant="primary"
            className={DOWNLOAD_BTN}
            onClick={onDownload}
            disabled={draw !== 'ready'}
            aria-label={`ดาวน์โหลด QR Code (${fileName})`}
          >
            ดาวน์โหลด QR Code
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
