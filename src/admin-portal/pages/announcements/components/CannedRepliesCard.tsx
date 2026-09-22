/**
 * ข้อความตอบกลับด่วน — four canned replies to paste into LINE's own chat console. Static: no API,
 * so it works whatever state the OA card or the list is in. Prototype 6893–6922.
 *
 * ⚠️ THE FOUR SNIPPETS ARE THE PROTOTYPE'S, BYTE FOR BYTE (AC-13) — copied from the HTML, never
 * retyped: they contain ASCII `"`, en dashes (`–`) and `08:30–16:30 น.`, all of which a retype
 * quietly "fixes".
 */

import { useEffect, useRef } from 'react'
import { COPY_SELECT_MESSAGE, useCopy } from '../../../lib/use-copy'
import { useToast } from '../../../lib/toast-context'
import { ICON } from '../announcement-icons'
import { Glyph } from './AnnouncementGlyph'

const REPLIES = [
  {
    title: 'แจ้งวิธีจองสถานที่',
    text: 'สวัสดีค่ะ จองสถานที่ได้ที่เมนู "จองสถานที่" ด้านล่างห้องแชทนี้ เลือกสถานที่ วันและเวลา แล้วกดยืนยัน ระบบจะแจ้งผลการอนุมัติทาง LINE ภายใน 1 วันทำการค่ะ',
  },
  {
    title: 'แจ้งเงื่อนไขการยกเลิก',
    text: 'ยกเลิกการจองได้เองที่เมนู "การจองของฉัน" ก่อนเวลาใช้งานอย่างน้อย 24 ชั่วโมง หากน้อยกว่านั้นกรุณาติดต่อเจ้าหน้าที่ผ่านแชทนี้ค่ะ',
  },
  {
    title: 'แจ้งสถานะคำขอรออนุมัติ',
    text: 'ได้รับคำขอจองของท่านแล้วค่ะ ขณะนี้อยู่ระหว่างรอเจ้าหน้าที่อนุมัติ เมื่อพิจารณาแล้วระบบจะแจ้งผลให้ทราบทาง LINE โดยอัตโนมัติค่ะ',
  },
  {
    title: 'ติดต่อนอกเวลาทำการ',
    text: 'ขอบคุณที่ติดต่อมาค่ะ ขณะนี้อยู่นอกเวลาทำการ (จันทร์–ศุกร์ 08:30–16:30 น.) เจ้าหน้าที่จะตอบกลับโดยเร็วที่สุดในวันทำการถัดไปค่ะ',
  },
] as const

/** How long the button reads `คัดลอกแล้ว` after a real copy. */
const COPIED_MS = 1500

export function CannedRepliesCard() {
  return (
    <section aria-labelledby="an-canned-h" className="pf-card flex min-w-0 flex-col">
      <div className="pf-body flex flex-col gap-4">
        <div>
          <h2 id="an-canned-h" className="pf-title flex items-center gap-2">
            <Glyph d={ICON.chat} className="h-5 w-5 shrink-0 text-base-content/60" />
            ข้อความตอบกลับด่วน
          </h2>
          <p className="m-0 mt-1 text-[13px] leading-[1.55] text-base-content/70">
            คัดลอกแล้วนำไปวางในห้องแชท LINE OA
          </p>
        </div>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {REPLIES.map((r) => (
            <CannedReply key={r.title} title={r.title} text={r.text} />
          ))}
        </ul>
      </div>
    </section>
  )
}

/**
 * One snippet with its own `useCopy`, so each button carries its own `คัดลอกแล้ว`.
 *
 * ⚠️ THE TOAST IS DECIDED FROM `copy()`'s RETURN VALUE, never from the hook's state. A second click
 * that lands in the same state would not re-run a state effect, and a refused copy must never
 * produce a success toast (AC-13) — so each click reads its own outcome.
 */
function CannedReply({ title, text }: { title: string; text: string }) {
  const copy = useCopy()
  const toast = useToast()
  const timer = useRef<number | undefined>(undefined)

  // The pending reset dies with the row, rather than firing into an unmounted hook.
  useEffect(() => {
    const pending = timer
    return () => window.clearTimeout(pending.current)
  }, [])

  const onCopy = async () => {
    const outcome = await copy.copy()
    window.clearTimeout(timer.current)
    if (outcome === 'copied') {
      toast('success', `คัดลอกข้อความ "${title}" แล้ว`)
      timer.current = window.setTimeout(copy.reset, COPIED_MS)
    } else {
      // The text is left SELECTED by `useCopy`'s third tier; say so, never claim success. The reset
      // puts the face back to `คัดลอก`, so a second refused click toasts again.
      toast('info', COPY_SELECT_MESSAGE)
      copy.reset()
    }
  }

  return (
    <li className="rounded-control border border-base-300 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="m-0 text-[14px] font-medium text-base-content">{title}</h3>
        {/* The live region is the toast (`role="status"`); `copy.announcement` is deliberately NOT
            rendered as well, or every copy would be read out twice. */}
        <button
          type="button"
          onClick={() => void onCopy()}
          aria-label={`คัดลอกข้อความ ${title}`}
          className="btn-ghost2 min-h-9 shrink-0 gap-1.5 border-transparent bg-transparent px-3 text-[13px] hover:bg-base-content/5"
        >
          <Glyph d={ICON.copy} className="h-4 w-4 shrink-0" />
          {copy.label}
        </button>
      </div>
      {/* `useCopy` copies this element's `textContent` — the FULL snippet, even though only two
          lines show — and its fallback selects this element, which is the one the reader sees. */}
      <p
        ref={copy.ref as React.Ref<HTMLParagraphElement>}
        className="m-0 mt-1 line-clamp-2 text-[13px] leading-[1.55] text-base-content/70"
      >
        {text}
      </p>
    </li>
  )
}
