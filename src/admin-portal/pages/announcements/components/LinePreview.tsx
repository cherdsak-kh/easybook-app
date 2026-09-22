/**
 * The phone beside the compose form — what the recipient will see in LINE. PROPS ONLY.
 *
 * ⚠️ IT FOLLOWS WHAT PHASE 2 ACTUALLY SENDS (`easybook-service/src/line/announcement-card.ts`), not
 * the prototype's mock (plan D-8):
 *   · TEXT — one plain bubble whose text is exactly `${title}\n\n${body}` of the TRIMMED values, in
 *     `whitespace-pre-wrap` so every newline and repeated space shows as LINE shows it. No bold: LINE
 *     text messages carry no formatting. (The prototype's `pre-line` collapses spaces.)
 *   · FLEX — a header band `ประกาศจาก EasyBook`, the bold title, the body with NO line clamp (the real
 *     bubble sets no `maxLines`, the display scrolls instead), and a text-only footer: the send time
 *     and `EasyBook`. There is NO button — the prototype's `ดูรายละเอียด` is dropped (phase 2 D-K).
 *
 * ⚠️ NO RECIPIENT COUNT (plan D-7). The API has no count endpoint and none is invented; the
 * prototype's `จะส่งถึงประมาณ N คน` becomes the audience pill. The only count anywhere is the
 * server's `sentCount`, in the toast and the view metadata.
 *
 * ⚠️ NOT daisyUI's `mockup-phone` (design A-5): 5.6.18 hard-codes a literal black and a literal grey,
 * which ignore the theme and which the portal's no-hex rule bans, and it is ~978px tall. The frame is utilities on
 * tokens. The chat itself IS real daisyUI `chat` — its rules sit in a sub-layer of `utilities`, so the
 * utilities here win over them (`rounded-2xl` over `chat-start`'s square corner, `before:hidden` over
 * the tail).
 *
 * The phone is `aria-hidden` decoration; the section's name, the audience pill and the altText
 * caption stay exposed.
 */

import { Avatar } from '../../../components/ui/Avatar'
import { thaiDate, thaiTime } from '../../../lib/thai-date'
import { AUDIENCE_PILL } from '../announcement-classes'
import { altTextOf, cardTime, TEXT_GAP, type FormValues } from '../announcement-form'
import { ICON } from '../announcement-icons'
import type { LineBotInfo } from '../announcements-api'
import { Glyph } from './AnnouncementGlyph'

/** The chat header's name when the bot info did not load (phase 3 D-5). */
const OA_FALLBACK = 'LINE Official Account'

/** An empty field — visibly a placeholder, never text that would be sent. */
function Placeholder({ children }: { children: string }) {
  return (
    <span data-placeholder className="italic text-base-content/60">
      {children}
    </span>
  )
}

export function LinePreview({
  values,
  recordSentAt,
  oa,
  audienceText,
}: {
  values: Pick<FormValues, 'title' | 'body' | 'format'>
  /** A SENT record's `sentAt`; `null` for a draft, which LINE would stamp at send time. */
  recordSentAt: string | null
  oa: LineBotInfo | null
  audienceText: string
}) {
  const t = values.title.trim()
  const b = values.body.trim()
  const name = oa?.displayName ?? OA_FALLBACK
  // Read at render; no ticking timer (design §4.2).
  const now = new Date()

  return (
    <section aria-label="ตัวอย่างข้อความใน LINE" className="flex flex-col items-center gap-2">
      <p className="m-0 text-[13px] font-medium text-base-content/70">ตัวอย่างที่ผู้รับจะเห็นใน LINE</p>

      <div
        aria-hidden="true"
        className="relative inline-grid justify-items-center rounded-[2.75rem] border-[5px] border-neutral bg-neutral p-1.5"
      >
        {/* The camera notch, stacked over the display in the same grid cell. */}
        <div className="z-10 col-start-1 row-start-1 mt-2 h-5 w-24 self-start rounded-full bg-neutral" />
        <div className="col-start-1 row-start-1 flex h-[480px] w-[260px] flex-col overflow-hidden rounded-[2.25rem] bg-base-100">
          {/* ── the OA's chat header (prototype classes) ── */}
          <div className="flex shrink-0 items-center gap-2 border-b border-base-300 bg-base-100 px-4 pt-9 pb-2.5">
            <Glyph d={ICON.chevronLeft} className="h-4 w-4 shrink-0 text-base-content/70" strokeWidth={2} />
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-base-content">
              {name}
            </span>
            <Glyph d={ICON.menu} className="h-4 w-4 shrink-0 text-base-content/70" strokeWidth={2} />
          </div>

          {/* ⚠️ `mt-auto` ON THE GROUP, NOT `justify-end` ON THE SCROLLER (design A-4). A flex-end
              scroller cannot scroll to overflow at its START, so a 1000-character body would clip
              the Flex header and title with no way to reach them. */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-base-200 px-3 py-3">
            <div className="mt-auto flex flex-col">
              <p className="m-0 mb-2 self-center rounded-full bg-base-content/10 px-2.5 py-0.5 text-[11px] text-base-content/70">
                {recordSentAt ? thaiDate(recordSentAt) : 'วันนี้'}
              </p>
              <div className="chat chat-start">
                <div className="chat-image">
                  <Avatar
                    src={oa?.pictureUrl}
                    name={oa?.displayName ?? 'L'}
                    className="h-8 w-8 rounded-full text-[12px]"
                  />
                </div>
                <div className="chat-header text-[11px] text-base-content/70">{name}</div>

                {values.format === 'TEXT' ? (
                  // THREE children, in order — title, the literal gap, body — so with both filled the
                  // bubble's `textContent` is exactly `${t}\n\n${b}` (AC-4). Keep them on one line:
                  // JSX whitespace between them would become part of the text.
                  <div className="chat-bubble bg-base-100 text-[13px] leading-[1.55] whitespace-pre-wrap wrap-anywhere text-base-content">
                    {t || <Placeholder>หัวข้อประกาศ</Placeholder>}{TEXT_GAP}{b || <Placeholder>เนื้อหาประกาศ</Placeholder>}
                  </div>
                ) : (
                  <div className="chat-bubble w-[200px] max-w-full overflow-hidden rounded-2xl bg-base-100 p-0 text-base-content before:hidden">
                    {/* The real card's TONE.SUCCESS header (white on emerald-700); the light admin
                        `primary` is that emerald. Tokens only. */}
                    <div className="bg-primary px-3 py-2 text-[11px] font-bold text-primary-content">
                      ประกาศจาก EasyBook
                    </div>
                    <div className="flex flex-col gap-2 px-3 py-3">
                      <p className="m-0 text-[14px] leading-[1.45] font-bold whitespace-pre-wrap wrap-anywhere">
                        {t || <Placeholder>หัวข้อประกาศ</Placeholder>}
                      </p>
                      {/* No `line-clamp`: the real card sets no `maxLines`. */}
                      <p className="m-0 text-[12px] leading-[1.6] whitespace-pre-wrap wrap-anywhere">
                        {b || <Placeholder>เนื้อหาประกาศ</Placeholder>}
                      </p>
                    </div>
                    <div className="flex items-start gap-2 border-t border-base-300 px-3 py-2 text-[10px]">
                      <span className="min-w-0 flex-1 wrap-anywhere text-base-content/70">
                        {cardTime(recordSentAt, now)}
                      </span>
                      <span className="shrink-0 font-bold text-primary">EasyBook</span>
                    </div>
                  </div>
                )}

                <div className="chat-footer text-[11px] text-base-content/70">
                  {thaiTime(recordSentAt ?? now)}
                </div>
              </div>
            </div>
          </div>

          {/* ── the composer bar (prototype classes; the "Aa" at the /70 text floor) ── */}
          <div className="flex shrink-0 items-center gap-2 border-t border-base-300 bg-base-100 px-3 py-2.5">
            <span className="min-w-0 flex-1 rounded-full bg-base-200 px-3 py-1.5 text-[12px] text-base-content/70">
              Aa
            </span>
          </div>
        </div>
      </div>

      <p className={`m-0 ${AUDIENCE_PILL}`}>ส่งถึง: {audienceText}</p>
      {values.format === 'FLEX' && (
        // The real `altText` — what the phone's notification shows. `/70`, the secondary-text floor.
        <p className="m-0 max-w-[282px] text-center text-[13px] wrap-anywhere text-base-content/70">
          ข้อความแจ้งเตือนบนมือถือ:{' '}
          {t ? (
            altTextOf(t)
          ) : (
            <>
              ประกาศ: <Placeholder>หัวข้อประกาศ</Placeholder>
            </>
          )}
        </p>
      )}
    </section>
  )
}
