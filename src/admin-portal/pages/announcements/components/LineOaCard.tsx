/**
 * The LINE Official Account card — the OA announcements go out from, and the way into LINE's own
 * chat console. Prototype 6848–6892, minus everything the API cannot back (plan D-4): no Webhook
 * row, no follower count, no "ยืนยันบัญชีแล้ว" badge. What is left is read from
 * `GET /announcements/line-bot-info`, live, on page entry and on retry only — never polled.
 *
 * ── Three states ──
 *   · loading — skeletons in the avatar, the Basic ID line and the status box.
 *   · ok      — avatar with a green dot, the OA name, `Basic ID · @…`, `การเชื่อมต่อ LINE:
 *               เชื่อมต่อได้` (a 200 is exactly that fact), the reply mode, and when it was checked.
 *               Also the `QR Code` pill and its dialog (`LineQrModal`, LINE-OA-QR-1) — ONLY here.
 *   · failed  — the fallback title and initial, NO dot, and one of four messages (plan D-5).
 *
 * ⚠️ THE chat.line.biz LINK IS RENDERED IN EVERY STATE. LINE's console does not depend on our
 * backend, so our failure to describe the OA is no reason to hide the way into it.
 */

import { useEffect, useRef, useState } from 'react'
import { InlineAlert } from '../../../components/feedback/InlineAlert'
import { Skeleton, SkeletonRegion } from '../../../components/feedback/Skeleton'
import { Spinner } from '../../../components/feedback/Spinner'
import { Avatar } from '../../../components/ui/Avatar'
import { Btn } from '../../../components/ui/Btn'
import { chatModeOf } from '../../../labels'
import { useBusy } from '../../../lib/use-busy'
import type { BotInfoFailure, OaState } from '../announcements-api'
import { ICON } from '../announcement-icons'
import { hasQrId } from '../line-qr'
import { Glyph } from './AnnouncementGlyph'
import { LineQrModal } from './LineQrModal'

/** Shown in place of the OA's own name whenever we could not read it. */
const FALLBACK_NAME = 'LINE Official Account'

/**
 * One message per failure (plan D-5).
 *
 * ⚠️ `server` NEVER MENTIONS LINE (AC-11). It is a 503 with no `code` — the session store — or any
 * other status, and wording it as a LINE problem would send an admin to the LINE console to fix a
 * server that LINE has nothing to do with.
 */
const MESSAGE: Record<BotInfoFailure, string> = {
  'not-configured':
    'ยังไม่ได้เชื่อมต่อ LINE Official Account กับระบบ (ไม่มีหรือใช้ token ไม่ได้) · แจ้งผู้ดูแลระบบ',
  unavailable: 'เชื่อมต่อ LINE ไม่ได้ชั่วคราว',
  server: 'ระบบขัดข้องชั่วคราว',
  network: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้',
}

/** The prototype's `badge badge-sm badge-outline`, as utilities — see `AUDIENCE_PILL` for why. */
const BASIC_ID_PILL =
  'inline-block max-w-full rounded-full border border-base-content/20 px-2.5 py-1 align-middle text-[13px] font-medium text-base-content/80'

/**
 * The `QR Code` pill beside it (LINE-OA-QR-1, plan D-1): the same box as `BASIC_ID_PILL`, so the two
 * sit level, plus a foreground wash on hover — a surface step (`bg-base-200`) would go DARKER on a
 * dark base — and the portal's focus ring. Never `outline-none`: a base one blanks the later ring.
 * About 28px tall — above the 24px of WCAG 2.2 SC 2.5.8, below the portal's 44px, by decision: a
 * secondary inline action, where a 44px box would break the identity row's alignment.
 */
const QR_PILL =
  'inline-flex items-center gap-1 rounded-full border border-base-content/20 px-2.5 py-1 align-middle text-[13px] font-medium text-base-content/80 transition-colors hover:bg-base-content/5 hover:text-base-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

export function LineOaCard({
  state,
  onRetry,
}: {
  state: OaState
  /**
   * Re-reads bot info WITHOUT going back to `loading`, so the failure panel — and the retry button
   * holding focus — stays on screen while the request is in flight.
   */
  onRetry: () => Promise<void>
}) {
  const { busy, run } = useBusy()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const previous = useRef(state.status)
  const [qrOpen, setQrOpen] = useState(false)

  /**
   * A successful retry unmounts the button that had focus, which would drop a keyboard user on
   * <body>. Focus moves to the card's heading instead — ONLY on failed → ok, never on the first
   * load, which must not steal focus from wherever the operator is.
   */
  useEffect(() => {
    if (previous.current === 'failed' && state.status === 'ok') titleRef.current?.focus()
    previous.current = state.status
  }, [state.status])

  const loading = state.status === 'loading'
  const ok = state.status === 'ok' ? state : null
  const failed = state.status === 'failed' ? state : null
  const mode = ok ? chatModeOf(ok.info.chatMode) : null
  /** Only in `ok`, and only with an id to encode — an empty or `@`-only one gets no pill (D-5). */
  const qr = ok !== null && hasQrId(ok.info.basicId)

  return (
    <section aria-labelledby="an-oa-name" className="pf-card flex min-w-0 flex-col">
      <div className="pf-body flex flex-col gap-4">
        {/* ── identity ── */}
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            {loading ? (
              <Skeleton variant="box" className="h-12 w-12 rounded-full" />
            ) : (
              <Avatar
                src={ok?.info.pictureUrl ?? null}
                name={ok?.info.displayName ?? FALLBACK_NAME}
                className="h-12 w-12 rounded-full text-[18px]"
              />
            )}
            {/* The dot is a reading, so it exists only when there is one to show. */}
            {ok && (
              <span
                aria-hidden="true"
                className="status status-success absolute right-0 bottom-0 h-3 w-3 ring-2 ring-base-100"
              />
            )}
          </div>
          <div className="min-w-0">
            <h2
              id="an-oa-name"
              ref={titleRef}
              tabIndex={-1}
              className="pf-title truncate outline-none"
            >
              {ok?.info.displayName ?? FALLBACK_NAME}
            </h2>
            {ok && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {/* `basicId` already carries its `@`. */}
                <span className={BASIC_ID_PILL}>Basic ID · {ok.info.basicId}</span>
                {qr && (
                  <button
                    type="button"
                    onClick={() => setQrOpen(true)}
                    title="ดู QR Code สำหรับเพิ่มเพื่อน LINE Official Account"
                    aria-label="ดู QR Code บัญชีทางการ LINE"
                    className={QR_PILL}
                  >
                    <Glyph d={ICON.qrCode} className="h-3.5 w-3.5 shrink-0" />
                    QR Code
                  </button>
                )}
              </div>
            )}
            {/* Holds the Basic ID line's height, so the card does not grow when it lands. */}
            {loading && <Skeleton variant="box" className="mt-1 h-6 w-36 rounded-full" />}
          </div>
        </div>

        {/* ALWAYS MOUNTED, empty when there is nothing wrong: a live region created at the same
            moment as its text is not announced (see `InlineAlert`). */}
        <InlineAlert message={failed ? MESSAGE[failed.reason] : null} className="mb-0" />
        {failed && (
          <Btn
            variant="ghost"
            className="self-start"
            onClick={() => void run(onRetry)}
            aria-busy={busy || undefined}
          >
            {busy ? <Spinner /> : <Glyph d={ICON.refresh} />}
            ลองอีกครั้ง
          </Btn>
        )}

        {loading && (
          <SkeletonRegion
            label="กำลังตรวจสอบสถานะ LINE Official Account"
            className="flex flex-col gap-3 rounded-control bg-base-200 p-3.5"
          >
            {['w-24', 'w-28'].map((w) => (
              <span key={w} className="flex items-start gap-2.5" aria-hidden="true">
                <Skeleton variant="box" className="mt-2 h-2 w-2 rounded-full" />
                <span className="flex min-w-0 flex-1 flex-col gap-2 py-0.5">
                  <Skeleton variant="soft" className={`h-3 ${w}`} />
                  <Skeleton className="h-3.5 w-32" />
                </span>
              </span>
            ))}
          </SkeletonRegion>
        )}

        {ok && mode && (
          // Label ABOVE value, not beside it: at xl this column is ~290px wide and
          // "โหมดการตอบกลับ: แชท (Chat Mode)" on one line broke mid-value (prototype note).
          <ul className="m-0 flex list-none flex-col gap-3 rounded-control bg-base-200 p-3.5 text-[14px]">
            <li className="flex items-start gap-2.5">
              <span aria-hidden="true" className="status status-success mt-2" />
              <span className="flex min-w-0 flex-col">
                <span className="text-[13px] text-base-content/70">การเชื่อมต่อ LINE</span>
                <span className="font-medium text-base-content">เชื่อมต่อได้</span>
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span aria-hidden="true" className={`status mt-2 ${mode.dot}`.trim()} />
              <span className="flex min-w-0 flex-col">
                <span className="text-[13px] text-base-content/70">โหมดการตอบกลับ</span>
                <span className="font-medium text-base-content">{mode.label}</span>
                {/* In bot mode chat.line.biz cannot be used to answer by hand — the one thing the
                    link below is for — so the card says what has to change, and where. */}
                {ok.info.chatMode === 'bot' && (
                  <span className="mt-0.5 text-[13px] leading-[1.55] text-base-content/70">
                    ต้องเปิดโหมดแชทใน LINE Official Account Manager ก่อน จึงจะตอบแชทเองได้
                  </span>
                )}
              </span>
            </li>
          </ul>
        )}

        {/* A link, not a button: it GOES somewhere, and middle-click or "copy link" should work on
            it like any other link. */}
        <a
          href="https://chat.line.biz"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary2 w-full text-center"
        >
          เปิดห้องแชท LINE OA (chat.line.biz)
          <Glyph d={ICON.external} className="h-4.5 w-4.5 shrink-0" strokeWidth={2} />
          <span className="sr-only">(เปิดในแท็บใหม่)</span>
        </a>
        <p className="m-0 text-[13px] leading-[1.55] text-base-content/70">
          LINE ไม่อนุญาตให้ฝังหน้าแชทไว้ในระบบอื่น ห้องแชทจึงเปิดในแท็บใหม่
          {ok && <> ตรวจสอบสถานะล่าสุดเมื่อ {ok.checkedAt} น.</>}
        </p>

        {/* Mounted for as long as `ok` holds — which it does while the dialog is open (no polling,
            retry only in `failed`) — so closing is `open` going false, never an unmount (the
            `Modal` rule), and focus returns to the pill. `setQrOpen(false)` is idempotent, as
            `Modal` calls `onClose` twice (the ✕ or ปิด, then its `close` event). */}
        {ok && qr && (
          <LineQrModal open={qrOpen} onClose={() => setQrOpen(false)} botInfo={ok.info} />
        )}
      </div>
    </section>
  )
}
