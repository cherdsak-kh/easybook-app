import type { ReactNode } from 'react'

/**
 * Copy for `/manual`, ported word for word from the prototype's `data-screen="manual"`
 * (client_portal_prototype.html, the `data-mn-topic` articles). Kept apart from the page so the page
 * reads as layout and this file reads as the words, which is what gets compared against the
 * prototype line by line.
 *
 * Colour in the legend is by meaning, never by taste: red `bg-error` = approved (someone is using
 * it), amber `bg-warning` = pending, grey `bg-base-300` = free. There is NO green anywhere — the
 * original spec said green = free, the real calendar says otherwise, and the prototype follows the
 * calendar.
 */

/**
 * FOLLOW-UP (PO decision Q1, 5 ต.ค. 2569): the prototype's own comment says this should come from
 * the organisation's settings when ported. No such setting or endpoint exists and this release
 * changes no contract, so it is ONE constant. When org settings land, replace this and nothing else.
 */
export const OFFICER_CONTACT = {
  hours: 'จันทร์–ศุกร์ 08:30–16:30 น.',
  unit: 'ฝ่ายบริหารงานทั่วไป (งานอาคารสถานที่)',
  phoneDisplay: '086-705-2387',
  phoneHref: 'tel:0867052387',
} as const

export const QUICK_STEPS = [
  { title: 'เลือกสถานที่', desc: 'ค้นหาห้องและตรวจตารางเวลาว่าง' },
  { title: 'ระบุข้อมูลการจอง', desc: 'เลือกวันเวลา และกรอกวัตถุประสงค์' },
  { title: 'รอรับแจ้งเตือน', desc: 'ผลอนุมัติแจ้งผ่าน LINE OA' },
] as const

export type ManualTopic = 'booking' | 'tracking' | 'issues' | 'faq'

export const MANUAL_FILTERS: readonly { id: 'all' | ManualTopic; label: string }[] = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'booking', label: 'ขั้นตอนการจอง' },
  { id: 'tracking', label: 'การติดตามและยกเลิก' },
  { id: 'issues', label: 'การแจ้งปัญหา' },
  { id: 'faq', label: 'คำถามที่พบบ่อย (FAQ)' },
]

export interface ManualArticle {
  id: string
  topic: ManualTopic
  title: string
  body: ReactNode
  /** In-accordion deep link — a react-router path, never a hash. */
  link?: { to: string; label: string }
}

export const MANUAL_ARTICLES: readonly ManualArticle[] = [
  {
    id: 'availability',
    topic: 'booking',
    title: 'วิธีตรวจสอบเวลาว่างของสถานที่ และความหมายของแถบสี 24 ชั่วโมง',
    body: (
      <div className="space-y-3">
        <p>
          เปิดหน้ารายละเอียดสถานที่ แล้วดู "ปฏิทินความพร้อมและการใช้สถานที่"
          ใต้เลขวันแต่ละวันจะมีแถบเวลา 24 ชั่วโมง (00:00–24:00) แสดงช่วงที่มีการใช้งาน
          กดที่วันเพื่อดูรายการช่วงเวลาของวันนั้น
        </p>
        <span
          aria-hidden="true"
          className="relative block h-1.5 w-full overflow-hidden rounded-full bg-base-300"
        >
          <span
            className="absolute inset-y-0 rounded-full bg-warning"
            style={{ left: '33.33%', width: '16.67%' }}
          />
          <span
            className="absolute inset-y-0 rounded-full bg-error"
            style={{ left: '37.5%', width: '12.5%' }}
          />
        </span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-base-content/70">
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2 w-3.5 rounded-full bg-error" />
            อนุมัติแล้ว (มีผู้ใช้งาน)
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2 w-3.5 rounded-full bg-warning" />
            รอพิจารณา
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2 w-3.5 rounded-full bg-base-300" />
            ว่าง
          </span>
        </div>
        <p className="text-xs">
          ช่วงที่รอพิจารณายังไม่ถูกจองไว้ — ผู้อื่นยื่นคำขอซ้อนช่วงเดียวกันได้
          จนกว่าจะมีคำขอใดได้รับอนุมัติ
        </p>
      </div>
    ),
  },
  {
    id: 'multi-day',
    topic: 'booking',
    title: 'การจองสถานที่ต่อเนื่องหลายวันทำอย่างไร?',
    body: (
      <div className="space-y-2">
        <p>ในหน้ายื่นคำขอ เลือก "รูปแบบการขอใช้" ได้ 2 แบบ</p>
        <ul className="list-disc space-y-1.5 ps-5">
          <li>
            <span className="font-medium text-base-content">ใช้ต่อเนื่องครั้งเดียว</span> —
            ระบุวันและเวลาเริ่ม ถึงวันและเวลาสิ้นสุด ใช้ข้ามวันได้
          </li>
          <li>
            <span className="font-medium text-base-content">ใช้ซ้ำหลายวัน</span> —
            กำหนดเวลาเริ่ม–สิ้นสุดชุดเดียว แล้วเพิ่มวันที่ต้องการใช้ได้หลายวัน (ใช้เวลาเดิมทุกวัน)
            ระบบตรวจความว่างของแต่ละวันให้ทันที
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: 'approval-result',
    topic: 'tracking',
    title: 'จะทราบผลการอนุมัติการจองได้อย่างไร?',
    body: (
      <p>
        เมื่อเจ้าหน้าที่พิจารณาแล้ว ระบบจะส่งผลให้ทาง LINE Official Account เป็นข้อความ Flex Message
        นอกจากนี้ยังตรวจสถานะของทุกคำขอได้เองที่หน้า "การจองของฉัน" (รอพิจารณา · อนุมัติแล้ว ·
        ไม่ได้รับอนุมัติ)
      </p>
    ),
    link: { to: '/bookings', label: 'ไปยังหน้าการจองของฉัน' },
  },
  {
    id: 'cancellation',
    topic: 'tracking',
    title: 'เงื่อนไขและวิธียกเลิกคำขอจองสถานที่',
    body: (
      <p>
        เปิดรายละเอียดคำขอจากหน้า "การจองของฉัน" แล้วกด "ยกเลิกคำขอนี้" หรือ "ยกเลิกการจองนี้"
        ได้ก่อนเวลาเริ่มใช้งานอย่างน้อย 30 นาที หากเป็นคำขอหลายวัน
        เลือกยกเลิกเฉพาะวันที่ไม่สะดวกได้ ช่วงที่ยกเลิกจะกลับมาว่างให้ผู้อื่นทันที
      </p>
    ),
    link: { to: '/bookings', label: 'ตรวจสอบคำขอในหน้าการจองของฉัน' },
  },
  {
    id: 'rejected',
    topic: 'tracking',
    title: 'กรณีคำขอถูก "ปฏิเสธ" ต้องทำอย่างไร?',
    body: (
      <p>
        คำขอที่ไม่ผ่านจะขึ้นสถานะ "ไม่ได้รับอนุมัติ"
        อ่านเหตุผลจากเจ้าหน้าที่ได้ในข้อความแจ้งเตือนทาง LINE และในหน้ารายละเอียดคำขอ จากนั้นกด
        "ยื่นคำขอจองใหม่" แล้วเลือกช่วงเวลาอื่นที่ว่าง
      </p>
    ),
  },
  {
    id: 'report-issue',
    topic: 'issues',
    title: 'พบอุปกรณ์ในห้องชำรุด หรือห้องไม่พร้อมใช้งาน แจ้งใคร?',
    body: (
      <p>
        แจ้งได้ที่หน้า "แจ้งปัญหา / ข้อเสนอแนะ" ระบุสถานที่และรายละเอียด แนบรูปได้
        เจ้าหน้าที่จะตรวจสอบและแจ้งผลกลับทาง LINE
      </p>
    ),
    link: { to: '/issues', label: 'ไปยังหน้าแจ้งปัญหา/ข้อเสนอแนะ' },
  },
  {
    id: 'on-behalf',
    topic: 'faq',
    title: 'สามารถจองสถานที่แทนบุคคลอื่นได้หรือไม่?',
    body: (
      <p>
        การจองผูกกับบัญชี LINE ที่เข้าสู่ระบบ ผู้ยื่นคำขอจึงเป็นผู้รับผิดชอบการใช้สถานที่
        หากต้องจองให้ผู้อื่น ควรให้เจ้าของกิจกรรมยื่นคำขอด้วยบัญชีของตนเอง
      </p>
    ),
  },
]
