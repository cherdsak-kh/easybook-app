/**
 * "The address was right, the data did not come."
 *
 * A different sentence from 404's "there is no such address", and different again from
 * empty's "the query matched nothing".
 *
 * ⚠️ The difference between the three kinds is NOT the wording — it is WHICH BUTTONS EXIST.
 * A retry is only honest when retrying could change the answer:
 *
 *   · `network` — the request never reached a server, so there is no status to quote.
 *     Printing "รหัสข้อผิดพลาด 0" would be inventing one. Retry helps.
 *   · `server`  — 503/5xx. Retry helps, and the code is what they read down the phone.
 *   · `forbidden` — 403. Grey, not rose: nothing malfunctioned, the system worked and the
 *     answer is no. NO retry button — the role will not change while the operator stands
 *     there, and a retry here is a lie that costs a click every time it is believed. The way
 *     out is to go somewhere they are allowed.
 *
 * A 401 never reaches this panel. Session death is not a property of one table and is handled
 * globally, so routing it here would put "ลองใหม่" in front of a dead session.
 *
 * ⚠️ Focus moves to the heading on mount. The table an assistive tech was reading has just
 * been replaced; without moving focus a screen reader keeps reciting rows that are no longer
 * on screen. Same reasoning as the 404 heading.
 */

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

export type LoadErrorKind = 'network' | 'server' | 'forbidden'

const ICONS: Record<LoadErrorKind, ReactNode> = {
  network: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 18.75h.008v.008H12v-.008zM8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M3 3l18 18"
    />
  ),
  server: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
    />
  ),
  forbidden: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
    />
  ),
}

const KIND: Record<
  LoadErrorKind,
  { tone: string; title: string; desc: string; code: string; retry: boolean; leave: boolean }
> = {
  network: {
    tone: 'load-err-fail',
    title: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้',
    desc: 'ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตของคุณ แล้วลองใหม่อีกครั้ง',
    code: '',
    retry: true,
    leave: false,
  },
  server: {
    tone: 'load-err-fail',
    title: 'โหลดข้อมูลไม่สำเร็จ',
    desc: 'ระบบขัดข้องชั่วคราว ข้อมูลของคุณยังอยู่ครบ หากลองใหม่แล้วยังไม่ได้ โปรดแจ้งผู้ดูแลระบบพร้อมรหัสด้านล่าง',
    code: 'รหัสข้อผิดพลาด 503',
    retry: true,
    leave: false,
  },
  forbidden: {
    tone: 'load-err-denied',
    title: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้',
    desc: 'บัญชีของคุณอยู่ในระดับที่เปิดดูรายการนี้ไม่ได้ หากคิดว่าไม่ถูกต้อง โปรดติดต่อผู้ดูแลระบบ',
    code: 'รหัสข้อผิดพลาด 403',
    retry: false,
    leave: true,
  },
}

export function LoadError({
  kind,
  onRetry,
  onLeave,
}: {
  kind: LoadErrorKind
  onRetry?: () => void
  onLeave?: () => void
}) {
  const k = KIND[kind]
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [kind])

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className={`load-err-ico ${k.tone}`}>
        <svg
          aria-hidden="true"
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          {ICONS[kind]}
        </svg>
      </div>
      <h2
        ref={titleRef}
        tabIndex={-1}
        className="text-[18px] font-semibold text-base-content th-tight outline-none"
      >
        {k.title}
      </h2>
      <p className="mt-1.5 max-w-sm text-[14px] leading-[1.6] text-base-content/70 th-tight">
        {k.desc}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {k.retry && (
          <button type="button" className="btn-primary2" onClick={onRetry}>
            <svg
              className="h-4.5 w-4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            ลองใหม่อีกครั้ง
          </button>
        )}
        {k.leave && (
          <button type="button" className="btn-ghost2" onClick={onLeave}>
            ไปหน้าที่เข้าถึงได้
          </button>
        )}
      </div>
      {/* Last and small, like the 404's: useless to a teacher, and exactly what they need
          when they phone it in. */}
      {k.code && (
        <p className="m-0 mt-5 text-[12px] text-base-content/70 tabular-nums">{k.code}</p>
      )}
    </div>
  )
}
