/**
 * The eleven SOP articles of `/backend/help/guide`, ported from the prototype's
 * `<div data-route="guide">` (`master_layout_prototype_v2.html`, L5823–6899) — words, markup and
 * class names, not a paraphrase. The markup was converted mechanically from the prototype so that
 * nothing could be re-typed wrong, then became the source of truth: edit it HERE.
 *
 * ── SHAPE ──
 * An article is DATA — id, group, roles, title, gloss, read time, sections — and `GuidePage` draws
 * the frame (header, "ในหน้านี้" strip, deep-link buttons, pager) from it. A section's `body` is
 * JSX because the content needs tables, step lists, callouts and badges; it is read for search
 * by `plainText` in `guide-model.ts`, not by scraping the rendered page.
 *
 * ── CONTENT IS CHECKED AGAINST THE SCREENS ──
 * The booking statuses are the four the คำขอจองสถานที่ screen draws (รอพิจารณา · อนุมัติแล้ว ·
 * ปฏิเสธ · ยกเลิก) with its own badge classes. The export article says Excel (CSV) because that is
 * what the file is. When a screen's wording changes, this is a second place to change it.
 *
 * ── NOTHING HERE LINKS TO A SCREEN THAT DOES NOT EXIST ──
 * `links` are `AdminRouteLabel`s; `GuidePage` renders one only when the signed-in role may reach it
 * (`useAcl`) and the label has a designed screen. ติดต่อทีมผู้พัฒนา (the last one, designed
 * 5 ต.ค. 2569) links like any other label now.
 *
 * ── ICONS ──
 * `Ico` (`GuideIcon.tsx`) is the prototype's inline `<svg><path/></svg>` with the two things that
 * vary — the path and the stroke — as props; `PATH` names the ones that repeat. Callouts keep the prototype's
 * `alert alert-soft` classes plus the shim the prototype's `.ig-scope .alert` applied (radius,
 * padding, body text in `text-base-content`: soft-warning text on its own tint fails contrast).
 */

import { Ico } from './GuideIcon'
import type { GuideArticle, GuideGroup } from './guide-model'
import { PATH } from './guide-icon-paths'

export const GUIDE_GROUPS: readonly GuideGroup[] = [
  { id: 'overview', th: 'ภาพรวมและสิทธิ์การใช้งาน', en: '(Overview & RBAC)' },
  { id: 'booking', th: 'การจัดการคำขอจอง', en: '(Booking Operations)' },
  { id: 'venues', th: 'การบริหารจัดการสถานที่', en: '(Venues & Facilities)' },
  { id: 'users', th: 'การจัดการผู้ใช้และระบบ', en: '(User & System Admin)' },
  { id: 'reports', th: 'รายงานและการส่งออก', en: '(Reports & Export)' },
  { id: 'troubleshooting', th: 'การแก้ไขปัญหาเบื้องต้น', en: '(Troubleshooting)' },
]

export const GUIDE_ARTICLES: readonly GuideArticle[] = [
  {
    id: 'rbac',
    group: 'overview',
    roles: ['viewer', 'admin', 'super'],
    title: 'บทบาทและสิทธิ์ในระบบ',
    en: 'Roles & Permissions Matrix',
    readMin: 4,
    sections: [
      {
        title: 'หนึ่งบัญชี หนึ่งบทบาท',
        body: (
          <>
            <p className="m-0 text-[14px] leading-[1.7] text-base-content/80 th-tight">
              ทุกบัญชีเจ้าหน้าที่มีบทบาทเดียว ซึ่งเป็นตัวกำหนดว่าจะเห็นเมนูใดและทำอะไรได้บ้าง เมนูที่บทบาทของคุณไม่มีสิทธิ์จะ{' '}
              <span className="font-medium text-base-content">ไม่แสดงเลย</span>
              {' '}แทนที่จะแสดงเป็นสีเทา
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-control border border-base-300 p-3.5">
                <p className="m-0 text-[14px] font-semibold text-base-content">ผู้ดูข้อมูล</p>
                <p className="m-0 mt-1.5 text-[13px] leading-[1.6] text-base-content/80">ดูข้อมูลและออกรายงานได้ทั้งหมด แต่แก้ไขอะไรในระบบไม่ได้เลย นอกจากข้อมูลส่วนตัวของบัญชีตัวเอง</p>
              </div>
              <div className="rounded-control border border-base-300 p-3.5">
                <p className="m-0 text-[14px] font-semibold text-base-content">เจ้าหน้าที่ดูแลระบบ</p>
                <p className="m-0 mt-1.5 text-[13px] leading-[1.6] text-base-content/80">ทำงานประจำวันได้ทั้งหมด เช่น อนุมัติคำขอจอง จัดการผู้ลงทะเบียน และตั้งค่าระบบ แต่เพิ่มหรือลบบัญชีเจ้าหน้าที่ไม่ได้</p>
              </div>
              <div className="rounded-control border border-base-300 p-3.5">
                <p className="m-0 text-[14px] font-semibold text-base-content">ผู้ดูแลระบบสูงสุด</p>
                <p className="m-0 mt-1.5 text-[13px] leading-[1.6] text-base-content/80">เห็นและแก้ไขได้ทุกอย่าง รวมถึงเพิ่ม ลบ และเปลี่ยนบทบาทของบัญชีเจ้าหน้าที่ ควรให้เฉพาะผู้ที่ดูแลระบบจริงเท่านั้น</p>
              </div>
            </div>
          </>
        ),
      },
      {
        title: 'ตารางสิทธิ์ตามเมนู',
        body: (
          <>
            <p className="m-0 mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-base-content/80">
              <span className="inline-flex items-center gap-1.5">
                <Ico d={PATH.CHECK} className="h-4 w-4 text-success" sw={2.4} />
                ทำได้
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="font-medium text-base-content">ดูได้</span>
                {' '}= ดูอย่างเดียว แก้ไขไม่ได้
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="font-medium text-base-content">—</span>
                {' '}= ไม่เห็นเมนู
              </span>
            </p>
            {/* `overflow-x-auto` is the one addition to the prototype's wrapper: from `lg` the card is
                only ~340px wide beside the topic menu, the four columns no longer fit, and without it
                the last column ran out of the card instead of scrolling inside it. */}
            <div className="overflow-x-auto rounded-control border border-base-300">
              <table className="table w-full text-[13px]">
                <thead>
                  <tr>
                    <th scope="col" className="px-2.5 py-2.5 text-left text-[12px] sm:px-4">สิ่งที่ทำ</th>
                    <th scope="col" className="w-[3.75rem] px-0.5 py-2.5 text-center text-[11px] leading-[1.35] sm:w-auto sm:px-3 sm:text-[12px]">ผู้ดูข้อมูล</th>
                    <th scope="col" className="w-[3.75rem] px-0.5 py-2.5 text-center text-[11px] leading-[1.35] sm:w-auto sm:px-3 sm:text-[12px]">เจ้าหน้าที่ดูแลระบบ</th>
                    <th scope="col" className="w-[3.75rem] px-0.5 py-2.5 text-center text-[11px] leading-[1.35] sm:w-auto sm:px-3 sm:text-[12px]">ผู้ดูแลระบบสูงสุด</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row" className="px-2.5 py-2.5 text-left font-normal leading-[1.45] text-base-content sm:px-4">ดูภาพรวมระบบ ปฏิทินการจอง และรายงานสถิติบนหน้าจอ</th>
                    <td className="px-1 py-2.5 text-center">
                      <Ico d={PATH.CHECK} className="mx-auto h-4 w-4 text-success" sw={2.4} />
                      <span className="sr-only">ทำได้</span>
                    </td>
                    <td className="px-1 py-2.5 text-center">
                      <Ico d={PATH.CHECK} className="mx-auto h-4 w-4 text-success" sw={2.4} />
                      <span className="sr-only">ทำได้</span>
                    </td>
                    <td className="px-1 py-2.5 text-center">
                      <Ico d={PATH.CHECK} className="mx-auto h-4 w-4 text-success" sw={2.4} />
                      <span className="sr-only">ทำได้</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className="px-2.5 py-2.5 text-left font-normal leading-[1.45] text-base-content sm:px-4">อนุมัติ ปฏิเสธ ยกเลิก และสร้างการจองในหน้าคำขอจองสถานที่</th>
                    <td className="px-1 py-2.5 text-center text-[12px] font-medium text-base-content/80">ดูได้</td>
                    <td className="px-1 py-2.5 text-center">
                      <Ico d={PATH.CHECK} className="mx-auto h-4 w-4 text-success" sw={2.4} />
                      <span className="sr-only">ทำได้</span>
                    </td>
                    <td className="px-1 py-2.5 text-center">
                      <Ico d={PATH.CHECK} className="mx-auto h-4 w-4 text-success" sw={2.4} />
                      <span className="sr-only">ทำได้</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className="px-2.5 py-2.5 text-left font-normal leading-[1.45] text-base-content sm:px-4">อนุมัติ ส่งคืน ระงับผู้ลงทะเบียน LINE</th>
                    <td className="px-1 py-2.5 text-center text-[12px] font-medium text-base-content/80">ดูได้</td>
                    <td className="px-1 py-2.5 text-center">
                      <Ico d={PATH.CHECK} className="mx-auto h-4 w-4 text-success" sw={2.4} />
                      <span className="sr-only">ทำได้</span>
                    </td>
                    <td className="px-1 py-2.5 text-center">
                      <Ico d={PATH.CHECK} className="mx-auto h-4 w-4 text-success" sw={2.4} />
                      <span className="sr-only">ทำได้</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className="px-2.5 py-2.5 text-left font-normal leading-[1.45] text-base-content sm:px-4">เพิ่ม แก้ไข ปิดชั่วคราว และลบสถานที่</th>
                    <td className="px-1 py-2.5 text-center text-[12px] font-medium text-base-content/80">ดูได้</td>
                    <td className="px-1 py-2.5 text-center">
                      <Ico d={PATH.CHECK} className="mx-auto h-4 w-4 text-success" sw={2.4} />
                      <span className="sr-only">ทำได้</span>
                    </td>
                    <td className="px-1 py-2.5 text-center">
                      <Ico d={PATH.CHECK} className="mx-auto h-4 w-4 text-success" sw={2.4} />
                      <span className="sr-only">ทำได้</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className="px-2.5 py-2.5 text-left font-normal leading-[1.45] text-base-content sm:px-4">สร้างและส่งประกาศผ่าน LINE</th>
                    <td className="px-1 py-2.5 text-center text-[12px] font-medium text-base-content/80">ดูได้</td>
                    <td className="px-1 py-2.5 text-center">
                      <Ico d={PATH.CHECK} className="mx-auto h-4 w-4 text-success" sw={2.4} />
                      <span className="sr-only">ทำได้</span>
                    </td>
                    <td className="px-1 py-2.5 text-center">
                      <Ico d={PATH.CHECK} className="mx-auto h-4 w-4 text-success" sw={2.4} />
                      <span className="sr-only">ทำได้</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className="px-2.5 py-2.5 text-left font-normal leading-[1.45] text-base-content sm:px-4">ส่งออกรายงานราชการ และดูประวัติการทำรายการ</th>
                    <td className="px-1 py-2.5 text-center text-base-content/70">
                      —
                      <span className="sr-only">ไม่เห็นเมนู</span>
                    </td>
                    <td className="px-1 py-2.5 text-center">
                      <Ico d={PATH.CHECK} className="mx-auto h-4 w-4 text-success" sw={2.4} />
                      <span className="sr-only">ทำได้</span>
                    </td>
                    <td className="px-1 py-2.5 text-center">
                      <Ico d={PATH.CHECK} className="mx-auto h-4 w-4 text-success" sw={2.4} />
                      <span className="sr-only">ทำได้</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className="px-2.5 py-2.5 text-left font-normal leading-[1.45] text-base-content sm:px-4">การตั้งค่าระบบ (ประเภทสถานที่ สิ่งอำนวยความสะดวก ตำแหน่ง กลุ่ม/ฝ่าย)</th>
                    <td className="px-1 py-2.5 text-center text-base-content/70">
                      —
                      <span className="sr-only">ไม่เห็นเมนู</span>
                    </td>
                    <td className="px-1 py-2.5 text-center">
                      <Ico d={PATH.CHECK} className="mx-auto h-4 w-4 text-success" sw={2.4} />
                      <span className="sr-only">ทำได้</span>
                    </td>
                    <td className="px-1 py-2.5 text-center">
                      <Ico d={PATH.CHECK} className="mx-auto h-4 w-4 text-success" sw={2.4} />
                      <span className="sr-only">ทำได้</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className="px-2.5 py-2.5 text-left font-normal leading-[1.45] text-base-content sm:px-4">การเชื่อมต่อระบบ (ทดสอบได้ แต่เปิดสวิตช์ Swagger ได้เฉพาะผู้ดูแลระบบสูงสุด)</th>
                    <td className="px-1 py-2.5 text-center text-base-content/70">
                      —
                      <span className="sr-only">ไม่เห็นเมนู</span>
                    </td>
                    <td className="px-1 py-2.5 text-center text-[12px] font-medium text-base-content/80">ดูได้</td>
                    <td className="px-1 py-2.5 text-center">
                      <Ico d={PATH.CHECK} className="mx-auto h-4 w-4 text-success" sw={2.4} />
                      <span className="sr-only">ทำได้</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className="px-2.5 py-2.5 text-left font-normal leading-[1.45] text-base-content sm:px-4">เพิ่ม ลบ เปลี่ยนบทบาท และรีเซ็ตรหัสผ่านของเจ้าหน้าที่</th>
                    <td className="px-1 py-2.5 text-center text-[12px] font-medium text-base-content/80">ดูได้</td>
                    <td className="px-1 py-2.5 text-center text-[12px] font-medium text-base-content/80">ดูได้</td>
                    <td className="px-1 py-2.5 text-center">
                      <Ico d={PATH.CHECK} className="mx-auto h-4 w-4 text-success" sw={2.4} />
                      <span className="sr-only">ทำได้</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className="px-2.5 py-2.5 text-left font-normal leading-[1.45] text-base-content sm:px-4">บันทึกข้อผิดพลาดทางเทคนิค</th>
                    <td className="px-1 py-2.5 text-center text-base-content/70">
                      —
                      <span className="sr-only">ไม่เห็นเมนู</span>
                    </td>
                    <td className="px-1 py-2.5 text-center text-base-content/70">
                      —
                      <span className="sr-only">ไม่เห็นเมนู</span>
                    </td>
                    <td className="px-1 py-2.5 text-center">
                      <Ico d={PATH.CHECK} className="mx-auto h-4 w-4 text-success" sw={2.4} />
                      <span className="sr-only">ทำได้</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        ),
      },
      {
        title: 'ข้อควรรู้',
        body: (
          <>
            <div className="flex flex-col gap-3">
              <div role="note" className="alert alert-info alert-soft text-sm rounded-control gap-2.5 px-3.5 py-3 leading-[1.6] text-base-content">
                <Ico d={PATH.INFO} className="mt-0.5 h-5 w-5 shrink-0 text-info" />
                <p className="m-0">
                  ตำแหน่ง (เช่น หัวหน้าฝ่าย) และกลุ่ม/ฝ่าย เป็นข้อมูลบุคคลเท่านั้น{' '}
                  <span className="font-medium">ไม่ได้ให้สิทธิ์เพิ่ม</span>
                  {' '}สิทธิ์มาจากบทบาทอย่างเดียว
                </p>
              </div>
              <div role="note" className="alert alert-warning alert-soft text-sm rounded-control gap-2.5 px-3.5 py-3 leading-[1.6] text-base-content">
                <Ico d={PATH.WARN} className="alert-ico mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <p className="m-0">เปลี่ยนบทบาทของตัวเองไม่ได้ในทุกกรณี และผู้ดูแลระบบสูงสุดก็ลบหรือระงับบัญชีตัวเองไม่ได้ เพื่อไม่ให้ระบบไม่เหลือผู้ดูแลที่แก้ไขได้ ต้องให้ผู้ดูแลระบบสูงสุดรายอื่นเป็นผู้ดำเนินการ</p>
              </div>
              <p className="m-0 text-[14px] leading-[1.7] text-base-content/80 th-tight">ถ้าไม่เห็นเมนูหรือปุ่มที่ควรมี ให้แจ้งผู้ดูแลระบบสูงสุดตรวจบทบาทของบัญชีคุณในหน้าเจ้าหน้าที่ระบบ</p>
            </div>
          </>
        ),
        links: ['เจ้าหน้าที่ระบบ', 'โปรไฟล์'],
      },
    ],
  },
  {
    id: 'lifecycle',
    group: 'overview',
    roles: ['viewer', 'admin', 'super'],
    title: 'วงจรชีวิตของคำขอจอง',
    en: 'Booking Lifecycle',
    readMin: 3,
    sections: [
      {
        title: 'เส้นทางของคำขอ',
        body: (
          <>
            <p className="m-0 text-[14px] leading-[1.7] text-base-content/80 th-tight">ผู้ขอจองส่งคำขอผ่าน LINE แล้วคำขอจะผ่านสถานะต่อไปนี้ แต่ละสถานะใช้สีเดียวกันทั้งในหน้าคำขอจองสถานที่ ปฏิทินการจอง และรายงาน</p>
            <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="ลำดับสถานะ">
              <span className="badge badge-amber">รอพิจารณา</span>
              <Ico d={PATH.CHEVRON} className="h-4 w-4 shrink-0 text-base-content/60" sw={2} join={false} />
              <span className="badge badge-emerald">อนุมัติแล้ว</span>
              <Ico d={PATH.CHEVRON} className="h-4 w-4 shrink-0 text-base-content/60" sw={2} join={false} />
              <span className="badge badge-rose">ยกเลิก</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="badge badge-amber">รอพิจารณา</span>
              <Ico d={PATH.CHEVRON} className="h-4 w-4 shrink-0 text-base-content/60" sw={2} join={false} />
              <span className="badge badge-sky">ปฏิเสธ</span>
            </div>
            <ol className="mt-4 flex list-none flex-col gap-3 p-0">
              <li className="flex items-start gap-3 rounded-control border border-base-300 p-3.5">
                <span className="badge badge-amber shrink-0">รอพิจารณา</span>
                <p className="m-0 min-w-0 text-[14px] leading-[1.65] text-base-content/80">
                  ผู้ขอจองส่งคำขอแล้ว รอเจ้าหน้าที่ตัดสินใจ{' '}
                  <span className="font-medium text-base-content">ยังไม่กันช่วงเวลา</span>
                  {' '}คำขอที่รอพิจารณาหลายรายการชนเวลาเดียวกันได้
                </p>
              </li>
              <li className="flex items-start gap-3 rounded-control border border-base-300 p-3.5">
                <span className="badge badge-emerald shrink-0">อนุมัติแล้ว</span>
                <p className="m-0 min-w-0 text-[14px] leading-[1.65] text-base-content/80">ช่วงเวลานั้นถูกจองเรียบร้อย คำขออื่นชนไม่ได้อีก การจองที่เจ้าหน้าที่สร้างเองจะเข้าสู่สถานะนี้ทันที โดยไม่ต้องรอพิจารณา</p>
              </li>
              <li className="flex items-start gap-3 rounded-control border border-base-300 p-3.5">
                <span className="badge badge-sky shrink-0">ปฏิเสธ</span>
                <p className="m-0 min-w-0 text-[14px] leading-[1.65] text-base-content/80">ปิดคำขอโดยไม่จอง ช่วงเวลากลับมาว่าง และผู้ขอส่งคำขอใหม่ได้ ต้องมีเหตุผลเสมอ รวมถึงคำขอที่ถูกปฏิเสธอัตโนมัติเพราะมีผู้ได้รับอนุมัติช่วงเวลานั้นไปก่อน</p>
              </li>
              <li className="flex items-start gap-3 rounded-control border border-base-300 p-3.5">
                <span className="badge badge-rose shrink-0">ยกเลิก</span>
                <p className="m-0 min-w-0 text-[14px] leading-[1.65] text-base-content/80">เกิดได้กับการจองที่อนุมัติแล้วเท่านั้น ผู้ขอยกเลิกเองจาก LINE หรือเจ้าหน้าที่ยกเลิกแทนก็ได้ ยกเลิกเฉพาะบางช่วงเวลาของการจองหลายวันก็ได้</p>
              </li>
            </ol>
          </>
        ),
      },
      {
        title: 'กฎที่ควรจำ',
        body: (
          <>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[14px] leading-[1.65] text-base-content/80">
              <li className="flex gap-2.5">
                <Ico d={PATH.CHECK} className="mt-1 h-4 w-4 shrink-0 text-success" sw={2.4} />
                <span className="min-w-0">ผู้ขอจองต้องเป็นผู้ใช้ LINE ที่ลงทะเบียนและได้รับอนุมัติแล้วจึงจะส่งคำขอได้</span>
              </li>
              <li className="flex gap-2.5">
                <Ico d={PATH.CHECK} className="mt-1 h-4 w-4 shrink-0 text-success" sw={2.4} />
                <span className="min-w-0">การปฏิเสธและการยกเลิกทุกครั้งต้องมีเหตุผล ระบบส่งข้อความนั้นถึงผู้จองทาง LINE</span>
              </li>
              <li className="flex gap-2.5">
                <Ico d={PATH.CHECK} className="mt-1 h-4 w-4 shrink-0 text-success" sw={2.4} />
                <span className="min-w-0">ช่วงเวลาที่จบเวลาเดียวกับที่อีกรายการเริ่ม (เช่น จบ 12:00 และเริ่ม 12:00) ไม่ถือว่าชนกัน</span>
              </li>
              <li className="flex gap-2.5">
                <Ico d={PATH.CHECK} className="mt-1 h-4 w-4 shrink-0 text-success" sw={2.4} />
                <span className="min-w-0">การจองที่เจ้าหน้าที่สร้างให้ผู้ที่ไม่ได้ใช้ LINE (กรอกข้อมูลเอง) จะไม่มีข้อความแจ้งเตือนใด ๆ เพราะไม่มีบัญชีให้ส่ง</span>
              </li>
            </ul>
            <div role="note" className="alert alert-info alert-soft mt-4 text-sm rounded-control gap-2.5 px-3.5 py-3 leading-[1.6] text-base-content">
              <Ico d={PATH.INFO} className="mt-0.5 h-5 w-5 shrink-0 text-info" />
              <p className="m-0">ดูภาพรวมของแต่ละสถานะได้ที่แท็บบนหน้าคำขอจองสถานที่ โดยตัวเลขข้างแท็บ “รอพิจารณา” คือจำนวนงานที่ค้างอยู่</p>
            </div>
          </>
        ),
        links: ['คำขอจองสถานที่', 'ปฏิทินการจอง'],
      },
    ],
  },
  {
    id: 'approve-flow',
    group: 'booking',
    roles: ['admin', 'super'],
    title: 'ขั้นตอนการพิจารณาอนุมัติ/ปฏิเสธคำขอ',
    en: 'Approving and Rejecting Booking Requests',
    readMin: 5,
    sections: [
      {
        title: 'พิจารณาคำขอทีละรายการ',
        body: (
          <>
            <ul className="steps steps-vertical w-full">
              <li className="step step-primary" data-content="1">
                <div className="min-w-0 pb-5 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">เปิดคิวงานที่รอพิจารณา</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">
                    เข้าเมนู{' '}
                    <span className="font-medium text-base-content">คำขอจองสถานที่</span>
                    {' '}หน้านี้เปิดที่แท็บ{' '}
                    <span className="badge badge-amber">รอพิจารณา</span>
                    {' '}เสมอ พร้อมตัวเลขงานค้าง ค้นหาด้วยรหัสคำขอ ชื่อผู้ขอ สถานที่ หรือวัตถุประสงค์ และกรองตามสถานที่ได้
                  </p>
                </div>
              </li>
              <li className="step step-primary" data-content="2">
                <div className="min-w-0 pb-5 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">ตรวจรายละเอียดให้ครบ</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">
                    เปิดรายการเพื่อดูผู้ขอ กลุ่ม/ฝ่าย เบอร์โทร สถานที่ วัตถุประสงค์ และจำนวนผู้เข้าร่วม โดยเฉพาะ{' '}
                    <span className="font-medium text-base-content">ทุกช่วงเวลาที่ขอใช้</span>
                    {' '}คำขอหลายวันอาจมีเวลาไม่เหมือนกันแต่ละวัน ตารางจะแสดงเป็นช่วงรวมเท่านั้น
                  </p>
                </div>
              </li>
              <li className="step step-primary" data-content="3">
                <div className="min-w-0 pb-5 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">เทียบกับปฏิทิน</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">
                    เปิด{' '}
                    <span className="font-medium text-base-content">ปฏิทินการจอง</span>
                    {' '}ดูว่าสถานที่และวันนั้นมีการจองอื่นหรือไม่ รายละเอียดการตรวจเวลาชนอยู่ในหัวข้อ “การตรวจสอบปฏิทินและเวลาทับซ้อน”
                  </p>
                </div>
              </li>
              <li className="step step-primary" data-content="4">
                <div className="min-w-0 pb-5 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">อนุมัติ</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">
                    กด{' '}
                    <span className="font-medium text-base-content">อนุมัติ</span>
                    {' '}แล้ว{' '}
                    <span className="font-medium text-base-content">ยืนยันการอนุมัติ</span>
                    {' '}คำขอจะเป็น{' '}
                    <span className="badge badge-emerald">อนุมัติแล้ว</span>
                    {' '}และช่วงเวลานั้นถูกจอง
                  </p>
                </div>
              </li>
              <li className="step step-primary" data-content="5">
                <div className="min-w-0 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">หรือปฏิเสธพร้อมเหตุผล</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">
                    กด{' '}
                    <span className="font-medium text-base-content">ปฏิเสธ</span>
                    {' '}เขียนเหตุผล (ไม่เกิน 500 ตัวอักษร) แล้วกด{' '}
                    <span className="font-medium text-base-content">ยืนยันการปฏิเสธ</span>
                    {' '}คำขอจะเป็น{' '}
                    <span className="badge badge-sky">ปฏิเสธ</span>
                    {' '}ช่วงเวลากลับมาว่าง และผู้ขอส่งคำขอใหม่ได้
                  </p>
                </div>
              </li>
            </ul>
            <div className="mt-5 flex flex-col gap-3">
              <div role="note" className="alert alert-warning alert-soft text-sm rounded-control gap-2.5 px-3.5 py-3 leading-[1.6] text-base-content">
                <Ico d={PATH.WARN} className="alert-ico mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <p className="m-0">
                  <span className="font-semibold">การปฏิเสธคำขอต้องระบุเหตุผลเสมอ</span>
                  {' '}เพื่อแจ้งเตือนกลับไปยัง LINE ของผู้จอง เขียนให้ผู้ขอเข้าใจว่าทำไม และควรทำอย่างไรต่อ เช่น “ช่วงเวลานี้มีกิจกรรมของโรงเรียนอยู่แล้ว ขอให้เลือกวันอื่น” ข้อความสั้น ๆ อย่าง “ไม่ผ่าน” ไม่ช่วยให้ผู้ขอแก้ไข
                </p>
              </div>
              <div role="note" className="alert alert-info alert-soft text-sm rounded-control gap-2.5 px-3.5 py-3 leading-[1.6] text-base-content">
                <Ico d={PATH.INFO} className="mt-0.5 h-5 w-5 shrink-0 text-info" />
                <p className="m-0">ผู้ดูข้อมูลเปิดดูรายละเอียดคำขอได้ แต่ไม่เห็นปุ่มอนุมัติ ปฏิเสธ หรือสร้างการจอง</p>
              </div>
            </div>
          </>
        ),
      },
      {
        title: 'เมื่อมีคำขออื่นชนเวลาเดียวกัน',
        body: (
          <>
            <p className="m-0 text-[14px] leading-[1.7] text-base-content/80 th-tight">ระบบตรวจให้ก่อนยืนยันอนุมัติ โดยแบ่งเป็นสองกรณี</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-control border border-base-300 p-3.5">
                <p className="m-0 flex flex-wrap items-center gap-2 text-[14px] font-semibold text-base-content">
                  <span className="badge badge-amber">เตือน</span>
                  ชนกับคำขอที่รอพิจารณา
                </p>
                <p className="m-0 mt-2 text-[13px] leading-[1.65] text-base-content/80">
                  ระบบแสดงรายชื่อคำขอที่จะ{' '}
                  <span className="font-medium text-base-content">ถูกปฏิเสธอัตโนมัติ</span>
                  {' '}พร้อมรหัส ผู้ขอ และเวลา เมื่อยืนยัน ผู้ขอแต่ละรายจะได้รับแจ้งทาง LINE ว่ามีผู้จองช่วงเวลานี้แล้ว
                </p>
              </div>
              <div className="rounded-control border border-base-300 p-3.5">
                <p className="m-0 flex flex-wrap items-center gap-2 text-[14px] font-semibold text-base-content">
                  <span className="badge badge-rose">ปิดกั้น</span>
                  ชนกับการจองที่อนุมัติแล้ว
                </p>
                <p className="m-0 mt-2 text-[13px] leading-[1.65] text-base-content/80">ปุ่มยืนยันจะกดไม่ได้ ต้องยกเลิกการจองเดิมก่อน หรือปฏิเสธคำขอนี้ ระบบจะไม่ปล่อยให้อนุมัติแล้วไปล้มเหลวทีหลัง</p>
              </div>
            </div>
          </>
        ),
      },
      {
        title: 'ยกเลิกการจอง และสร้างการจองแทนผู้ขอ',
        body: (
          <>
            <div className="flex flex-col gap-3">
              <div className="rounded-control border border-base-300 p-3.5">
                <p className="m-0 flex flex-wrap items-center gap-2 text-[14px] font-semibold text-base-content">
                  <span className="badge badge-rose">ยกเลิก</span>
                  ยกเลิกการจองที่อนุมัติแล้ว
                </p>
                <p className="m-0 mt-2 text-[13px] leading-[1.65] text-base-content/80">เลือก “ยกเลิกทั้งการจอง” หรือ “ยกเลิกเฉพาะบางช่วงเวลา” (เหมาะกับกรณีฝนตกวันเดียวจากการจองห้าวัน) แล้วระบุเหตุผล ระบบแจ้งผู้จองทาง LINE ทันที และช่วงเวลาที่ยกเลิกกลับมาว่าง</p>
              </div>
              <div className="rounded-control border border-base-300 p-3.5">
                <p className="m-0 flex flex-wrap items-center gap-2 text-[14px] font-semibold text-base-content">
                  <span className="badge badge-emerald">อนุมัติแล้ว</span>
                  สร้างคำจองสถานที่
                </p>
                <p className="m-0 mt-2 text-[13px] leading-[1.65] text-base-content/80">
                  ใช้เมื่อมีผู้ขอใช้ที่ไม่ได้อยู่ใน LINE เช่น ติดต่อทางโทรศัพท์ เลือก “เลือกผู้ใช้ LINE ในระบบ” หรือ “ระบุข้อมูลเอง” แล้วเลือกสถานที่ วัน และเวลา ระบบตรวจว่าว่างให้ก่อนบันทึก การจองนี้{' '}
                  <span className="font-medium text-base-content">เข้าสู่สถานะอนุมัติแล้วทันที</span>
                  {' '}ไม่ผ่านคิวพิจารณา ใช้เวลาเดียวกันทุกวัน ถ้าต้องการเวลาต่างกันให้สร้างแยกรายการ
                </p>
              </div>
            </div>
          </>
        ),
        links: ['คำขอจองสถานที่', 'ปฏิทินการจอง', 'การลงทะเบียน'],
      },
    ],
  },
  {
    id: 'calendar-check',
    group: 'booking',
    roles: ['viewer', 'admin', 'super'],
    title: 'การตรวจสอบปฏิทินและเวลาทับซ้อน',
    en: 'Calendar & Conflict Checking',
    readMin: 3,
    sections: [
      {
        title: 'อ่านปฏิทินการจอง',
        body: (
          <>
            <ul className="steps steps-vertical w-full">
              <li className="step step-primary" data-content="1">
                <div className="min-w-0 pb-5 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">กรองสถานที่และสถานะ</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">ใช้ตัวกรอง สถานที่ และ สถานะ ที่ส่วนหัวของหน้า ตัวกรองทั้งสองมีผลกับทั้งปฏิทินรายเดือนและรายการของวันที่เลือก</p>
                </div>
              </li>
              <li className="step step-primary" data-content="2">
                <div className="min-w-0 pb-5 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">เลือกวันในปฏิทิน</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">
                    กดวันที่ในปฏิทินรายเดือน (เลื่อนเดือนด้วยลูกศร และกลับมาวันนี้ด้วยปุ่ม{' '}
                    <span className="font-medium text-base-content">วันนี้</span>
                    ) ฝั่งขวาแสดงการจองของวันนั้น สลับระหว่างมุมมอง{' '}
                    <span className="font-medium text-base-content">ไทม์ไลน์</span>
                    {' '}และ{' '}
                    <span className="font-medium text-base-content">รายการ</span>
                    {' '}ได้
                  </p>
                </div>
              </li>
              <li className="step step-primary" data-content="3">
                <div className="min-w-0 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">เปิดรายการเพื่อดูรายละเอียด</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">กดการจองใดก็ได้เพื่อเปิดรายละเอียดฉบับเดียวกับที่หน้าคำขอจองสถานที่ ใช้ตรวจว่าใครจอง เพื่ออะไร และกี่คน</p>
                </div>
              </li>
            </ul>
            <div className="mt-4 rounded-control border border-base-300 p-3.5">
              <p className="m-0 text-[13px] font-semibold text-base-content/80">คำอธิบายสัญลักษณ์</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="badge badge-emerald">อนุมัติแล้ว</span>
                <span className="badge badge-amber">รอพิจารณา</span>
              </div>
              <p className="m-0 mt-2 text-[13px] leading-[1.65] text-base-content/80">
                ปฏิทินวาดเฉพาะสองสถานะนี้ รายการที่{' '}
                <span className="font-medium text-base-content">ปฏิเสธ</span>
                {' '}หรือ{' '}
                <span className="font-medium text-base-content">ยกเลิก</span>
                {' '}ไม่ถูกกันเวลาอยู่แล้วจึงไม่แสดง ดูได้ที่หน้าคำขอจองสถานที่
              </p>
            </div>
          </>
        ),
      },
      {
        title: 'เวลาทับซ้อนคืออะไร',
        body: (
          <>
            <p className="m-0 text-[14px] leading-[1.7] text-base-content/80 th-tight">
              สองรายการชนกันเมื่อเป็น{' '}
              <span className="font-medium text-base-content">สถานที่เดียวกัน วันเดียวกัน และช่วงเวลาคาบเกี่ยวกัน</span>
              {' '}การจองช่วง 08:00–12:00 และ 12:00–16:00 ไม่ชนกัน ระบบจึงจองเช้าแล้วต่อด้วยบ่ายได้ ผลของการชนขึ้นกับสถานะของรายการที่อยู่ก่อน
            </p>
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex items-start gap-3 rounded-control border border-base-300 p-3.5">
                <span className="badge badge-emerald shrink-0">ว่าง</span>
                <p className="m-0 min-w-0 text-[14px] leading-[1.65] text-base-content/80">ไม่มีการจองหรือคำขออื่นชน อนุมัติหรือสร้างการจองได้ตามปกติ</p>
              </div>
              <div className="flex items-start gap-3 rounded-control border border-base-300 p-3.5">
                <span className="badge badge-amber shrink-0">เตือน</span>
                <p className="m-0 min-w-0 text-[14px] leading-[1.65] text-base-content/80">
                  ชนกับคำขอที่{' '}
                  <span className="font-medium text-base-content">รอพิจารณา</span>
                  {' '}ทำต่อได้ แต่คำขอเหล่านั้นจะถูกปฏิเสธอัตโนมัติ และระบบแสดงรายชื่อให้เห็นก่อนยืนยัน
                </p>
              </div>
              <div className="flex items-start gap-3 rounded-control border border-base-300 p-3.5">
                <span className="badge badge-rose shrink-0">ปิดกั้น</span>
                <p className="m-0 min-w-0 text-[14px] leading-[1.65] text-base-content/80">
                  ชนกับการจองที่{' '}
                  <span className="font-medium text-base-content">อนุมัติแล้ว</span>
                  {' '}บันทึกหรืออนุมัติไม่ได้ ต้องเปลี่ยนวัน เวลา หรือสถานที่ หรือยกเลิกการจองเดิมก่อน
                </p>
              </div>
            </div>
            <div role="note" className="alert alert-info alert-soft mt-4 text-sm rounded-control gap-2.5 px-3.5 py-3 leading-[1.6] text-base-content">
              <Ico d={PATH.INFO} className="mt-0.5 h-5 w-5 shrink-0 text-info" />
              <p className="m-0">ตอนสร้างคำจองสถานที่ ระบบตรวจให้แบบทันทีทุกครั้งที่เปลี่ยนสถานที่ วัน หรือเวลา ก่อนกดบันทึก จึงรู้ผลทั้งสามแบบข้างต้นได้โดยไม่ต้องกรอกฟอร์มจนจบ</p>
            </div>
          </>
        ),
        links: ['ปฏิทินการจอง', 'คำขอจองสถานที่'],
      },
    ],
  },
  {
    id: 'venue-mgmt',
    group: 'venues',
    roles: ['admin', 'super'],
    title: 'การเพิ่ม/แก้ไข และปิดปรับปรุงสถานที่',
    en: 'Managing and Closing Venues',
    readMin: 5,
    sections: [
      {
        title: 'เพิ่มสถานที่ใหม่',
        body: (
          <>
            <ul className="steps steps-vertical w-full">
              <li className="step step-primary" data-content="1">
                <div className="min-w-0 pb-5 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">เปิดฟอร์ม</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">
                    เข้าเมนู{' '}
                    <span className="font-medium text-base-content">สถานที่จัดกิจกรรม</span>
                    {' '}แล้วกด{' '}
                    <span className="font-medium text-base-content">เพิ่มสถานที่</span>
                  </p>
                </div>
              </li>
              <li className="step step-primary" data-content="2">
                <div className="min-w-0 pb-5 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">กรอกข้อมูลหลัก</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">
                    <span className="font-medium text-base-content">ชื่อสถานที่</span>
                    {' '}
                    <span className="font-medium text-base-content">ประเภทสถานที่</span>
                    {' '}และ{' '}
                    <span className="font-medium text-base-content">ความจุ (คน)</span>
                    {' '}ต้องกรอกครบ ส่วน{' '}
                    <span className="font-medium text-base-content">ที่ตั้ง</span>
                    {' '}และ{' '}
                    <span className="font-medium text-base-content">รายละเอียด</span>
                    {' '}ไม่บังคับ แต่ผู้ใช้เห็นที่ตั้งตอนเลือกสถานที่ใน LINE จึงควรบอกอาคารและชั้น เช่น “อาคารพลศึกษา ชั้น 1”
                  </p>
                </div>
              </li>
              <li className="step step-primary" data-content="3">
                <div className="min-w-0 pb-5 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">แนบรูปภาพ</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">
                    เพิ่มได้สูงสุด 10 รูป กดรูปย่อรูปใดเพื่อให้เป็นรูปปก (รูปที่การ์ดสถานที่และรายการใน LINE ใช้แสดง) และใช้ปุ่ม{' '}
                    <span className="font-medium text-base-content">ลบรูปนี้</span>
                    {' '}เพื่อลบรูปที่เลือก
                  </p>
                </div>
              </li>
              <li className="step step-primary" data-content="4">
                <div className="min-w-0 pb-5 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">ติ๊กสิ่งอำนวยความสะดวก</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">เลือกอุปกรณ์ที่มีในห้องจากรายการที่ผู้ดูแลกำหนดไว้ ถ้ายังไม่มีรายการ ให้เพิ่มก่อนที่การตั้งค่าระบบ</p>
                </div>
              </li>
              <li className="step step-primary" data-content="5">
                <div className="min-w-0 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">บันทึก</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">กดบันทึก สถานที่จะปรากฏในรายการ และเป็นตัวเลือกให้ผู้ใช้จองใน LINE ทันที</p>
                </div>
              </li>
            </ul>
            <div role="note" className="alert alert-warning alert-soft mt-5 text-sm rounded-control gap-2.5 px-3.5 py-3 leading-[1.6] text-base-content">
              <Ico d={PATH.WARN} className="alert-ico mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <p className="m-0">
                <span className="font-semibold">ไม่ควรมีบุคคลอยู่ในภาพ</span>
                {' '}รูปเหล่านี้ผู้ใช้ทุกคนเห็นใน LINE และเมื่อรูปที่มีใบหน้าถูกอัปโหลดแล้ว จะค้นหาเพื่อลบตามคำขอของเจ้าของใบหน้าไม่ได้ ดูรูปให้แน่ใจก่อนบันทึก
              </p>
            </div>
          </>
        ),
      },
      {
        title: 'ปิดชั่วคราว หรือ ลบ',
        body: (
          <>
            <p className="m-0 text-[14px] leading-[1.7] text-base-content/80 th-tight">
              เปิดสถานที่ที่ต้องการแล้วใช้สวิตช์{' '}
              <span className="font-medium text-base-content">เปิดให้จอง</span>
              {' '}ที่ส่วนบนของฟอร์ม ระบบจะถามยืนยันและให้ระบุเหตุผลเสมอ
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-control border border-base-300 p-3.5">
                <p className="m-0 text-[14px] font-semibold text-base-content">ปิดชั่วคราว (ใช้กับการปิดปรับปรุง)</p>
                <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0 text-[13px] leading-[1.65] text-base-content/80">
                  <li>สถานที่หายจากรายการที่ผู้ใช้เลือกได้ใน LINE และส่งคำขอใหม่ไม่ได้</li>
                  <li>เหตุผลที่ระบุจะแสดงบนการ์ดของสถานที่ ผู้ใช้จึงเห็นด้วย</li>
                  <li>เปิดคืนได้ทุกเมื่อ เหตุผลที่ปิดไว้จะถูกล้าง</li>
                </ul>
              </div>
              <div className="rounded-control border border-base-300 p-3.5">
                <p className="m-0 text-[14px] font-semibold text-base-content">ลบสถานที่</p>
                <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0 text-[13px] leading-[1.65] text-base-content/80">
                  <li>สถานที่หายจากรายการทันทีและจองไม่ได้อีก</li>
                  <li>ประวัติคำขอจองของสถานที่นั้นยังอยู่ครบ</li>
                  <li>ปุ่มอยู่ท้ายฟอร์ม ตั้งใจให้เลื่อนลงไปกดเอง</li>
                </ul>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <div role="note" className="alert alert-info alert-soft text-sm rounded-control gap-2.5 px-3.5 py-3 leading-[1.6] text-base-content">
                <Ico d={PATH.INFO} className="mt-0.5 h-5 w-5 shrink-0 text-info" />
                <p className="m-0">เขียนเหตุผลที่ปิดให้ผู้ใช้อ่านเข้าใจ เช่น “ปิดปรับปรุงพื้นถึง 30 ก.ย.” ถ้าเพียงแต่ยังไม่เปิดให้จองชั่วคราว ให้ใช้ปิดชั่วคราวแทนการลบ</p>
              </div>
              <div role="note" className="alert alert-warning alert-soft text-sm rounded-control gap-2.5 px-3.5 py-3 leading-[1.6] text-base-content">
                <Ico d={PATH.WARN} className="alert-ico mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <p className="m-0">
                  การปิดชั่วคราวหยุดเฉพาะ{' '}
                  <span className="font-semibold">คำขอใหม่</span>
                  {' '}การจองที่อนุมัติไว้แล้วในช่วงปิดปรับปรุงยังอยู่ในระบบ ให้ตรวจที่ปฏิทินการจองและยกเลิกรายการที่ชน พร้อมเหตุผล เพื่อให้ผู้จองได้รับแจ้งทาง LINE
                </p>
              </div>
            </div>
          </>
        ),
        links: ['สถานที่จัดกิจกรรม', 'ประเภทสถานที่', 'ปฏิทินการจอง'],
      },
    ],
  },
  {
    id: 'amenities',
    group: 'venues',
    roles: ['admin', 'super'],
    title: 'การจัดการสิ่งอำนวยความสะดวก',
    en: 'Managing Amenities',
    readMin: 2,
    sections: [
      {
        title: 'รายการอุปกรณ์ที่ให้ติ๊กเลือก',
        body: (
          <>
            <p className="m-0 text-[14px] leading-[1.7] text-base-content/80 th-tight">สิ่งอำนวยความสะดวกคือรายการอุปกรณ์ เช่น เครื่องฉายภาพหรือไมโครโฟนไร้สาย ที่ผู้ดูแลกำหนดเอง ไม่ได้พิมพ์อิสระ เพื่อให้ผู้ใช้ค้นหาสถานที่ตามอุปกรณ์ได้ถูกต้อง คนสองคนที่พิมพ์ต่างคำจะได้ไม่กลายเป็นสองรายการ</p>
            <ul className="steps steps-vertical mt-4 w-full">
              <li className="step step-primary" data-content="1">
                <div className="min-w-0 pb-5 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">เพิ่มอุปกรณ์</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">
                    ไปที่{' '}
                    <span className="font-medium text-base-content">การตั้งค่าระบบ › สิ่งอำนวยความสะดวก</span>
                    {' '}แล้วเพิ่มชื่อใหม่ ชื่อนี้จะปรากฏเป็นตัวเลือกตอนเพิ่มหรือแก้ไขสถานที่ทันที
                  </p>
                </div>
              </li>
              <li className="step step-primary" data-content="2">
                <div className="min-w-0 pb-5 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">แก้ชื่อเมื่อสะกดผิด</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">เปลี่ยนชื่อแล้วทุกสถานที่ที่ติ๊กอุปกรณ์นี้ไว้จะเห็นชื่อใหม่เหมือนกันหมด โดยไม่ต้องไปแก้ทีละสถานที่</p>
                </div>
              </li>
              <li className="step step-primary" data-content="3">
                <div className="min-w-0 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">ลบอุปกรณ์ที่เลิกใช้</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">
                    คอลัมน์{' '}
                    <span className="font-medium text-base-content">สถานที่ที่มีอุปกรณ์นี้</span>
                    {' '}บอกว่าตอนนี้มีกี่แห่งที่ติ๊กไว้ ระบบแสดงจำนวนนี้ในหน้าต่างยืนยันการลบ
                  </p>
                </div>
              </li>
            </ul>
            <div className="mt-5 flex flex-col gap-3">
              <div role="note" className="alert alert-info alert-soft text-sm rounded-control gap-2.5 px-3.5 py-3 leading-[1.6] text-base-content">
                <Ico d={PATH.INFO} className="mt-0.5 h-5 w-5 shrink-0 text-info" />
                <p className="m-0">
                  การลบอุปกรณ์{' '}
                  <span className="font-medium">เอาเครื่องหมายติ๊กออกจากสถานที่เหล่านั้นเท่านั้น</span>
                  {' '}ตัวสถานที่ยังอยู่ครบและยังจองได้ตามปกติ
                </p>
              </div>
              <div role="note" className="alert alert-warning alert-soft text-sm rounded-control gap-2.5 px-3.5 py-3 leading-[1.6] text-base-content">
                <Ico d={PATH.WARN} className="alert-ico mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <p className="m-0">ถ้าไม่มีอุปกรณ์ในรายการ สถานที่ยังเพิ่มและแก้ไขได้ แต่จะไม่มีอุปกรณ์ให้ติ๊ก และผู้ใช้จะค้นหาสถานที่ตามอุปกรณ์ไม่ได้ ควรเพิ่มรายการที่โรงเรียนมีจริงก่อนเพิ่มสถานที่</p>
              </div>
            </div>
          </>
        ),
        links: ['สิ่งอำนวยความสะดวก', 'สถานที่จัดกิจกรรม'],
      },
    ],
  },
  {
    id: 'staff-mgmt',
    group: 'users',
    roles: ['super'],
    title: 'การจัดการบัญชีและกำหนดสิทธิ์เจ้าหน้าที่',
    en: 'Staff Accounts & Role Assignment',
    readMin: 4,
    sections: [
      {
        title: 'เพิ่มบัญชีเจ้าหน้าที่',
        body: (
          <>
            <p className="m-0 text-[14px] leading-[1.7] text-base-content/80 th-tight">เพิ่ม ลบ และเปลี่ยนบทบาทเป็นสิทธิ์ของผู้ดูแลระบบสูงสุดเท่านั้น เจ้าหน้าที่ดูแลระบบและผู้ดูข้อมูลเปิดดูรายชื่อบัญชีได้อย่างเดียว</p>
            <ul className="steps steps-vertical mt-4 w-full">
              <li className="step step-primary" data-content="1">
                <div className="min-w-0 pb-5 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">กรอกข้อมูลบัญชี</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">
                    เข้าเมนู{' '}
                    <span className="font-medium text-base-content">เจ้าหน้าที่ระบบ</span>
                    {' '}กด{' '}
                    <span className="font-medium text-base-content">เพิ่มบัญชี</span>
                    {' '}แล้วกรอกอีเมล (ใช้เป็นชื่อผู้ใช้) ชื่อ นามสกุล ตำแหน่ง กลุ่ม/ฝ่าย และเบอร์โทรศัพท์
                  </p>
                </div>
              </li>
              <li className="step step-primary" data-content="2">
                <div className="min-w-0 pb-5 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">เลือกบทบาท</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">เลือก ผู้ดูข้อมูล เจ้าหน้าที่ดูแลระบบ หรือผู้ดูแลระบบสูงสุด ข้อความใต้ช่องเลือกจะบอกว่าบทบาทที่เลือกทำอะไรได้ ให้ผู้ดูแลระบบสูงสุดเฉพาะผู้ที่ดูแลระบบจริง</p>
                </div>
              </li>
              <li className="step step-primary" data-content="3">
                <div className="min-w-0 pb-5 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">จดรหัสผ่านชั่วคราว</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">
                    เมื่อสร้างบัญชีสำเร็จ ระบบแสดงรหัสผ่านชั่วคราว{' '}
                    <span className="font-medium text-base-content">เพียงครั้งเดียว</span>
                    {' '}คัดลอกหรือจดแล้วส่งให้เจ้าตัวโดยช่องทางที่ปลอดภัย ก่อนกดปุ่มรับทราบ
                  </p>
                </div>
              </li>
              <li className="step step-primary" data-content="4">
                <div className="min-w-0 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">เจ้าตัวตั้งรหัสผ่านใหม่</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">การเข้าสู่ระบบครั้งแรกด้วยรหัสชั่วคราวบังคับให้ตั้งรหัสผ่านใหม่ก่อนใช้งานต่อ</p>
                </div>
              </li>
            </ul>
            <div role="note" className="alert alert-warning alert-soft mt-5 text-sm rounded-control gap-2.5 px-3.5 py-3 leading-[1.6] text-base-content">
              <Ico d={PATH.WARN} className="alert-ico mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <p className="m-0">
                <span className="font-semibold">อีเมลเปลี่ยนไม่ได้หลังสร้างบัญชี</span>
                {' '}และใช้ซ้ำกับบัญชีอื่นไม่ได้อีก แม้บัญชีเดิมจะถูกลบแล้ว ตรวจสะกดให้ถูกก่อนกดสร้าง รหัสชั่วคราวที่ปิดหน้าต่างไปแล้วดูย้อนหลังไม่ได้ ต้องรีเซ็ตรหัสผ่านเพื่อออกรหัสใหม่
              </p>
            </div>
          </>
        ),
      },
      {
        title: 'แก้ไข ระงับ รีเซ็ต และลบ',
        body: (
          <>
            <div className="flex flex-col gap-3">
              <div className="rounded-control border border-base-300 p-3.5">
                <p className="m-0 text-[14px] font-semibold text-base-content">แก้ไขข้อมูลและบทบาท</p>
                <p className="m-0 mt-1.5 text-[13px] leading-[1.65] text-base-content/80">
                  แก้ชื่อ ตำแหน่ง กลุ่ม/ฝ่าย เบอร์โทร และเปลี่ยนบทบาทได้ ส่วนสถานะบัญชีเลือกได้ระหว่าง{' '}
                  <span className="font-medium text-base-content">ใช้งานอยู่</span>
                  {' '}กับ{' '}
                  <span className="font-medium text-base-content">ระงับการใช้งาน</span>
                  {' '}บัญชีที่ถูกระงับเข้าสู่ระบบไม่ได้ แต่ข้อมูลและประวัติยังอยู่ครบ
                </p>
              </div>
              <div className="rounded-control border border-base-300 p-3.5">
                <p className="m-0 text-[14px] font-semibold text-base-content">รีเซ็ตรหัสผ่าน</p>
                <p className="m-0 mt-1.5 text-[13px] leading-[1.65] text-base-content/80">ออกรหัสผ่านชั่วคราวใหม่ รหัสเดิมใช้ไม่ได้ทันที และเจ้าตัวต้องตั้งรหัสใหม่ก่อนใช้งานต่อ ใช้เมื่อลืมรหัสหรือทำรหัสชั่วคราวหาย</p>
              </div>
              <div className="rounded-control border border-base-300 p-3.5">
                <p className="m-0 text-[14px] font-semibold text-base-content">ลบบัญชี</p>
                <p className="m-0 mt-1.5 text-[13px] leading-[1.65] text-base-content/80">ประวัติการทำรายการยังอยู่ครบ แต่อีเมลนั้นสร้างบัญชีใหม่ไม่ได้อีก ถ้าเพียงต้องการให้ใครเข้าไม่ได้ชั่วคราว ให้ใช้ระงับการใช้งานแทน</p>
              </div>
            </div>
            <div role="note" className="alert alert-info alert-soft mt-4 text-sm rounded-control gap-2.5 px-3.5 py-3 leading-[1.6] text-base-content">
              <Ico d={PATH.INFO} className="mt-0.5 h-5 w-5 shrink-0 text-info" />
              <p className="m-0">แถวของตัวเองในตารางจะพาไปหน้าโปรไฟล์ ที่นั่นแก้ชื่อ ตำแหน่ง และเบอร์โทรของตัวเองได้ แต่บทบาท สถานะ การรีเซ็ตรหัสผ่าน และการลบบัญชีของตัวเอง ต้องให้ผู้ดูแลระบบสูงสุดรายอื่นเป็นผู้ทำ เปลี่ยนรหัสผ่านของตัวเองทำได้ที่หน้าเปลี่ยนรหัสผ่าน</p>
            </div>
          </>
        ),
        links: ['เจ้าหน้าที่ระบบ', 'โปรไฟล์', 'เปลี่ยนรหัสผ่าน', 'ประวัติการเข้าสู่ระบบ'],
      },
    ],
  },
  {
    id: 'broadcast',
    group: 'users',
    roles: ['admin', 'super'],
    title: 'การส่งประกาศผ่าน LINE Messaging API',
    en: 'Broadcast Announcements via LINE',
    readMin: 4,
    sections: [
      {
        title: 'สร้างและส่งประกาศ',
        body: (
          <>
            <p className="m-0 text-[14px] leading-[1.7] text-base-content/80 th-tight">ประกาศคือข้อความ Push ที่ระบบส่งถึงผู้ใช้ LINE ผ่าน LINE Official Account ของโรงเรียน ผู้ดูข้อมูลเปิดดูประกาศที่มีอยู่ได้แต่สร้างหรือส่งไม่ได้</p>
            <ul className="steps steps-vertical mt-4 w-full">
              <li className="step step-primary" data-content="1">
                <div className="min-w-0 pb-5 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">เริ่มประกาศใหม่</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">
                    เข้าเมนู{' '}
                    <span className="font-medium text-base-content">ประกาศและข่าวสาร</span>
                    {' '}กด{' '}
                    <span className="font-medium text-base-content">สร้างประกาศใหม่</span>
                    {' '}รายการประกาศแยกแท็บเป็น ทั้งหมด ส่งแล้ว และฉบับร่าง
                  </p>
                </div>
              </li>
              <li className="step step-primary" data-content="2">
                <div className="min-w-0 pb-5 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">เลือกกลุ่มผู้รับ</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">เลือกส่งถึงผู้ใช้ LINE ทั้งหมด บุคลากรทั้งหมด หรือเฉพาะกลุ่ม/ฝ่าย ท้ายตัวอย่างข้อความแสดง “จะส่งถึงประมาณ … คน” ให้ตรวจก่อนส่ง</p>
                </div>
              </li>
              <li className="step step-primary" data-content="3">
                <div className="min-w-0 pb-5 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">เลือกรูปแบบและเขียนเนื้อหา</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">
                    กรอกหัวข้อ (ไม่เกิน 100 ตัวอักษร) และเนื้อหา (ไม่เกิน 1,000 ตัวอักษร) เลือก{' '}
                    <span className="font-medium text-base-content">ข้อความธรรมดา (Text)</span>
                    {' '}หรือ{' '}
                    <span className="font-medium text-base-content">การ์ดประกาศ (Flex Message)</span>
                    {' '}โทรศัพท์จำลองด้านข้างแสดงตัวอย่างตามที่พิมพ์ทันที ข้อความธรรมดาของ LINE ไม่มีตัวหนา หัวข้อจึงเป็นบรรทัดแรกเท่านั้น
                  </p>
                </div>
              </li>
              <li className="step step-primary" data-content="4">
                <div className="min-w-0 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">บันทึกฉบับร่าง หรือส่ง</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">
                    กด{' '}
                    <span className="font-medium text-base-content">บันทึกฉบับร่าง</span>
                    {' '}เพื่อกลับมาแก้ภายหลัง หรือ{' '}
                    <span className="font-medium text-base-content">ส่งประกาศ</span>
                    {' '}เพื่อส่งทันที ประกาศที่ส่งแล้วเปิดดูได้อย่างเดียว
                  </p>
                </div>
              </li>
            </ul>
            <div className="mt-5 flex flex-col gap-3">
              <div role="note" className="alert alert-warning alert-soft text-sm rounded-control gap-2.5 px-3.5 py-3 leading-[1.6] text-base-content">
                <Ico d={PATH.WARN} className="alert-ico mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <p className="m-0">
                  <span className="font-semibold">ประกาศที่ส่งแล้วเรียกคืนไม่ได้</span>
                  {' '}เพราะ LINE ไม่มีการยกเลิกข้อความ Push ตรวจชื่อกลุ่มผู้รับ ตัวสะกด และวันที่ในข้อความให้ครบทุกครั้งก่อนกดส่ง
                </p>
              </div>
              <div role="note" className="alert alert-info alert-soft text-sm rounded-control gap-2.5 px-3.5 py-3 leading-[1.6] text-base-content">
                <Ico d={PATH.INFO} className="mt-0.5 h-5 w-5 shrink-0 text-info" />
                <p className="m-0">การส่งประกาศใช้โควต้าข้อความ Push ประจำเดือนของ LINE Official Account ตรวจโควต้าคงเหลือได้ที่หน้าการเชื่อมต่อระบบ (ตรวจสถานะ Token ไม่เสียโควต้า)</p>
              </div>
            </div>
          </>
        ),
      },
      {
        title: 'แชตกับผู้ใช้และข้อความตอบกลับด่วน',
        body: (
          <>
            <p className="m-0 text-[14px] leading-[1.7] text-base-content/80 th-tight">ระบบไม่มีห้องแชตของตัวเอง การสนทนาแบบตัวต่อตัวทำผ่านคอนโซลแชตของ LINE ที่เปิดในแท็บใหม่ ส่วนขวาของหน้าประกาศจึงเป็นทางลัด ประกอบด้วยสถานะของ LINE Official Account (รวมถึง Webhook และโหมดการตอบกลับ) ข้อความตอบกลับด่วนให้คัดลอก และปุ่มเปิดแชตของ LINE</p>
          </>
        ),
        links: ['ประกาศและข่าวสาร', 'การเชื่อมต่อระบบ'],
      },
    ],
  },
  {
    id: 'integrations',
    group: 'users',
    roles: ['admin', 'super'],
    title: 'การตรวจสอบสถานะการเชื่อมต่อ (Postgres, Redis, R2)',
    en: 'Integration Health Checks',
    readMin: 3,
    sections: [
      {
        title: 'บริการที่ระบบต้องพึ่ง',
        body: (
          <>
            <p className="m-0 text-[14px] leading-[1.7] text-base-content/80 th-tight">หน้าการเชื่อมต่อระบบรวมสถานะของบริการภายนอกไว้ในที่เดียว กดปุ่มทดสอบได้ทุกบทบาทที่เห็นหน้านี้ เพราะการทดสอบอ่านค่าอย่างเดียว ไม่ส่งข้อความและไม่เปลี่ยนข้อมูล</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-control border border-base-300 p-3.5">
                <p className="m-0 flex flex-wrap items-center gap-2 text-[14px] font-semibold text-base-content">
                  LINE Developers{' '}
                  <span className="badge badge-success badge-sm">เชื่อมต่อแล้ว</span>
                </p>
                <p className="m-0 mt-1.5 text-[13px] leading-[1.65] text-base-content/80">Messaging API, Webhook และ LIFF ของ LINE Official Account ปุ่มตรวจสอบสถานะ Token แสดงว่า Token ถูกต้องหรือไม่ และโควต้าข้อความ Push คงเหลือเท่าไร โดยไม่ใช้โควต้า</p>
              </div>
              <div className="rounded-control border border-base-300 p-3.5">
                <p className="m-0 flex flex-wrap items-center gap-2 text-[14px] font-semibold text-base-content">
                  PostgreSQL{' '}
                  <span className="badge badge-success badge-sm">ปกติ</span>
                </p>
                <p className="m-0 mt-1.5 text-[13px] leading-[1.65] text-base-content/80">ฐานข้อมูลหลัก ดู Latency (ตอบสนองเร็วแค่ไหน) และ Active pool (ใช้การเชื่อมต่อไปกี่จากทั้งหมด) ตัวเลขหลังเป็นตัวที่บอกล่วงหน้าว่าระบบใกล้เต็ม</p>
              </div>
              <div className="rounded-control border border-base-300 p-3.5">
                <p className="m-0 flex flex-wrap items-center gap-2 text-[14px] font-semibold text-base-content">
                  Redis{' '}
                  <span className="badge badge-success badge-sm">ปกติ</span>
                </p>
                <p className="m-0 mt-1.5 text-[13px] leading-[1.65] text-base-content/80">แคชเซสชันที่ระบบใช้ทุกคำขอ ดู Ping และสถานะหน่วยความจำ</p>
              </div>
              <div className="rounded-control border border-base-300 p-3.5">
                <p className="m-0 flex flex-wrap items-center gap-2 text-[14px] font-semibold text-base-content">
                  Cloudflare R2{' '}
                  <span className="badge badge-success badge-sm">พร้อมใช้งาน</span>
                </p>
                <p className="m-0 mt-1.5 text-[13px] leading-[1.65] text-base-content/80">ที่เก็บรูปสถานที่ รูปโปรไฟล์ และไฟล์แนบ ดูสิทธิ์อ่าน/เขียนและเวลาตอบสนอง ค่า Bucket แก้จากหน้านี้ไม่ได้ เพราะผูกกับที่อยู่ของรูปทุกไฟล์</p>
              </div>
            </div>
          </>
        ),
      },
      {
        title: 'ตรวจสถานะ',
        body: (
          <>
            <ul className="steps steps-vertical w-full">
              <li className="step step-primary" data-content="1">
                <div className="min-w-0 pb-5 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">ทดสอบทั้งหมดในครั้งเดียว</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">
                    กด{' '}
                    <span className="font-medium text-base-content">ทดสอบการเชื่อมต่อทั้งหมด</span>
                    {' '}ที่ส่วนหัวของหน้า หรือกดทดสอบทีละการ์ดก็ได้ ระหว่างตรวจ ปุ่มจะแสดงตัวหมุนจนกว่าผลจะกลับมา
                  </p>
                </div>
              </li>
              <li className="step step-primary" data-content="2">
                <div className="min-w-0 pb-5 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">อ่านผลที่ป้ายสถานะ</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">ป้ายเขียวหมายถึงปกติ ป้ายแดงหมายถึงการเชื่อมต่อนั้นล้มเหลว ข้างป้ายมีเวลา “ตรวจสอบล่าสุด” ให้ดูว่าผลนี้เก่าแค่ไหน</p>
                </div>
              </li>
              <li className="step step-primary" data-content="3">
                <div className="min-w-0 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">แจ้งผู้ดูแลเมื่อพบความผิดปกติ</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">ถ้าป้ายแดงอยู่หลังตรวจซ้ำ ให้แจ้งผู้ดูแลระบบสูงสุดพร้อมชื่อการ์ดและเวลา รายละเอียดเชิงเทคนิคอยู่ในบันทึกข้อผิดพลาด ซึ่งเปิดได้เฉพาะผู้ดูแลระบบสูงสุด</p>
                </div>
              </li>
            </ul>
            <div className="mt-5 flex flex-col gap-3">
              <div role="note" className="alert alert-warning alert-soft text-sm rounded-control gap-2.5 px-3.5 py-3 leading-[1.6] text-base-content">
                <Ico d={PATH.WARN} className="alert-ico mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <p className="m-0">
                  สวิตช์{' '}
                  <span className="font-semibold">Swagger UI และ OpenAPI Spec</span>
                  {' '}เปิดได้เฉพาะผู้ดูแลระบบสูงสุด และเริ่มที่ปิดทุกครั้ง ควรเปิดเฉพาะช่วงพัฒนาหรือทดสอบ เพราะหน้านั้นเปิดเผยโครงสร้าง API ทั้งหมดให้บุคคลภายนอกบนเซิร์ฟเวอร์จริง
                </p>
              </div>
              <div role="note" className="alert alert-info alert-soft text-sm rounded-control gap-2.5 px-3.5 py-3 leading-[1.6] text-base-content">
                <Ico d={PATH.INFO} className="mt-0.5 h-5 w-5 shrink-0 text-info" />
                <p className="m-0">ไม่มีปุ่มทดลองส่งข้อความ โดยตั้งใจ เพราะการส่งข้อความใช้โควต้าประจำเดือน การตรวจสถานะ Token ให้คำตอบเดียวกันโดยไม่เสียโควต้า</p>
              </div>
            </div>
          </>
        ),
        links: ['การเชื่อมต่อระบบ', 'บันทึกข้อผิดพลาด'],
      },
    ],
  },
  {
    id: 'reports',
    group: 'reports',
    roles: ['viewer', 'admin', 'super'],
    title: 'สถิติการใช้งานสถานที่และการส่งออกข้อมูล (CSV/Excel)',
    en: 'Usage Statistics & Data Export',
    readMin: 4,
    sections: [
      {
        title: 'หน้ารายงานในเมนู รายงานและสถิติ',
        body: (
          <>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              <li className="rounded-control border border-base-300 p-3.5">
                <p className="m-0 text-[14px] font-semibold text-base-content">ภาพรวมสถิติ</p>
                <p className="m-0 mt-1 text-[13px] leading-[1.65] text-base-content/80">ตัวชี้วัดหลักของโรงเรียนในหน้าเดียว คำขอจอง อัตราการใช้สถานที่ วินัยการใช้งาน และจุดคอขวด</p>
              </li>
              <li className="rounded-control border border-base-300 p-3.5">
                <p className="m-0 text-[14px] font-semibold text-base-content">การใช้สถานที่และช่วงเวลา</p>
                <p className="m-0 mt-1 text-[13px] leading-[1.65] text-base-content/80">อัตราการใช้ของแต่ละสถานที่ ช่วงเวลาที่มีความต้องการสูง และคำขอที่ถูกปฏิเสธเพราะเวลาชน</p>
              </li>
              <li className="rounded-control border border-base-300 p-3.5">
                <p className="m-0 text-[14px] font-semibold text-base-content">สถิติตามฝ่ายและการดำเนินงาน</p>
                <p className="m-0 mt-1 text-[13px] leading-[1.65] text-base-content/80">การใช้สถานที่แยกตามกลุ่ม/ฝ่ายและวัตถุประสงค์ ระยะเวลาการพิจารณา และวินัยการใช้งาน</p>
              </li>
            </ul>
            <p className="m-0 mt-3 text-[14px] leading-[1.7] text-base-content/80 th-tight">
              ทั้งสามหน้านี้ทุกบทบาทดูได้ ทุกหน้ามีตัวเลือกช่วงเวลาสามแบบ คือ{' '}
              <span className="font-medium text-base-content">ประจำภาคเรียน</span>
              {' '}
              <span className="font-medium text-base-content">ประจำเดือน</span>
              {' '}และ{' '}
              <span className="font-medium text-base-content">กำหนดเอง</span>
              {' '}ตัวเลขทุกหน้าสำหรับช่วงเวลาเดียวกันตรงกัน เพราะมาจากข้อมูลชุดเดียว
            </p>
          </>
        ),
      },
      {
        title: 'ส่งออกรายงานราชการ',
        body: (
          <>
            <p className="m-0 text-[14px] leading-[1.7] text-base-content/80 th-tight">ศูนย์ส่งออกรายงานราชการเปิดให้เฉพาะเจ้าหน้าที่ดูแลระบบและผู้ดูแลระบบสูงสุด ใช้จัดทำเอกสารเสนอผู้บริหารสถานศึกษาและเทศบาล</p>
            <ul className="steps steps-vertical mt-4 w-full">
              <li className="step step-primary" data-content="1">
                <div className="min-w-0 pb-5 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">เลือกแบบเอกสาร</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">
                    <span className="font-medium text-base-content">แบบ 1</span>
                    {' '}สรุปสถิติภาพรวมประจำงวด ·{' '}
                    <span className="font-medium text-base-content">แบบ 2</span>
                    {' '}บัญชีประวัติการขอใช้สถานที่ ·{' '}
                    <span className="font-medium text-base-content">แบบ 3</span>
                    {' '}รายงานการใช้สถานที่รายห้อง
                  </p>
                </div>
              </li>
              <li className="step step-primary" data-content="2">
                <div className="min-w-0 pb-5 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">กำหนดช่วงเวลาและขอบเขต</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">เลือกภาคเรียน เดือน หรือกำหนดวันเอง และจะจำกัดเฉพาะสถานที่หรือกลุ่ม/ฝ่ายก็ได้ ตัวอย่างเอกสาร A4 ด้านล่างเปลี่ยนตามทันที</p>
                </div>
              </li>
              <li className="step step-primary" data-content="3">
                <div className="min-w-0 pl-1 text-left">
                  <p className="m-0 text-[14px] font-semibold text-base-content th-tight">ส่งออก</p>
                  <p className="m-0 mt-1 text-[14px] leading-[1.65] text-base-content/80">
                    กด{' '}
                    <span className="font-medium text-base-content">ดาวน์โหลดไฟล์ Excel (CSV)</span>
                    {' '}เพื่อนำข้อมูลไปคำนวณต่อ หรือ{' '}
                    <span className="font-medium text-base-content">พิมพ์เอกสาร / บันทึก PDF</span>
                    {' '}เพื่อได้กระดาษ A4 ทั้งสองแบบสร้างจากข้อมูลชุดเดียวกัน ตัวเลขบนกระดาษจึงไม่ขัดกับในไฟล์
                  </p>
                </div>
              </li>
            </ul>
            <div className="mt-5 flex flex-col gap-3">
              <div role="note" className="alert alert-info alert-soft text-sm rounded-control gap-2.5 px-3.5 py-3 leading-[1.6] text-base-content">
                <Ico d={PATH.INFO} className="mt-0.5 h-5 w-5 shrink-0 text-info" />
                <p className="m-0">
                  ไฟล์ที่ดาวน์โหลดคือ{' '}
                  <span className="font-medium">CSV</span>
                  {' '}(นามสกุล .csv) เปิดด้วย Excel ได้และภาษาไทยไม่เพี้ยน ไม่ใช่ไฟล์ .xlsx
                </p>
              </div>
              <div role="note" className="alert alert-warning alert-soft text-sm rounded-control gap-2.5 px-3.5 py-3 leading-[1.6] text-base-content">
                <Ico d={PATH.WARN} className="alert-ico mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <p className="m-0">ผู้ดูข้อมูลไม่เห็นเมนูส่งออกรายงานราชการและประวัติการทำรายการ ถ้าต้องใช้เอกสารเหล่านี้ ให้ขอจากเจ้าหน้าที่ดูแลระบบ ประวัติการทำรายการบอกว่าเจ้าหน้าที่คนใดอนุมัติ ปฏิเสธ หรือแก้ไขรายการใดเมื่อไร</p>
              </div>
            </div>
          </>
        ),
        links: ['ภาพรวมสถิติ', 'การใช้สถานที่และช่วงเวลา', 'สถิติตามฝ่ายและการดำเนินงาน', 'ส่งออกรายงานราชการ', 'ประวัติการทำรายการ'],
      },
    ],
  },
  {
    id: 'faq',
    group: 'troubleshooting',
    roles: ['viewer', 'admin', 'super'],
    title: 'การแก้ปัญหา Webhook และข้อผิดพลาดทั่วไป',
    en: 'Troubleshooting',
    readMin: 4,
    sections: [
      {
        title: 'ปัญหาที่พบบ่อย',
        body: (
          <>
            <div className="flex flex-col gap-2">
              <details className="visible collapse collapse-arrow rounded-control border border-base-300 bg-base-100">
                <summary className="collapse-title flex min-h-11 items-center text-[14px] font-semibold leading-[1.5] text-base-content">ผู้จองไม่ได้รับข้อความแจ้งเตือนใน LINE</summary>
                <div className="collapse-content text-[14px] leading-[1.7] text-base-content/80">
                  <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5">
                    <li>ตรวจว่าการจองนั้นสร้างโดยกรอกข้อมูลเอง (ผู้ที่ไม่ได้ใช้ LINE) ถ้าใช่ ไม่มีบัญชีให้ส่ง จึงไม่มีข้อความเป็นเรื่องปกติ</li>
                    <li>
                      เปิดหน้า{' '}
                      <span className="font-medium text-base-content">การเชื่อมต่อระบบ</span>
                      {' '}แล้วกดตรวจสอบสถานะ Token ของ LINE ถ้าโควต้าข้อความ Push ประจำเดือนหมด ข้อความจะส่งไม่ออก
                    </li>
                    <li>
                      ผู้ดูแลระบบสูงสุดดูที่{' '}
                      <span className="font-medium text-base-content">บันทึกข้อผิดพลาด</span>
                      {' '}ว่ามีรายการ LINE API Timeouts หรือ Token หมดอายุหรือไม่
                    </li>
                  </ol>
                </div>
              </details>
              <details className="visible collapse collapse-arrow rounded-control border border-base-300 bg-base-100">
                <summary className="collapse-title flex min-h-11 items-center text-[14px] font-semibold leading-[1.5] text-base-content">สถานะ Webhook ไม่ปกติ</summary>
                <div className="collapse-content text-[14px] leading-[1.7] text-base-content/80">
                  <p className="m-0">
                    Webhook คือช่องทางที่ LINE ส่งเหตุการณ์ เช่น ผู้ใช้เพิ่มเพื่อน หรือส่งข้อความมาหาระบบ ดูสถานะได้ในการ์ด LINE Official Account ทางขวาของหน้า{' '}
                    <span className="font-medium text-base-content">ประกาศและข่าวสาร</span>
                    {' '}ถ้าไม่แสดงว่าทำงานปกติ ให้แจ้งผู้ดูแลระบบสูงสุดตรวจการตั้งค่า Webhook ใน LINE Developers Console และตรวจสอบว่าเซิร์ฟเวอร์ตอบกลับได้ เจ้าหน้าที่ทั่วไปแก้ค่านี้จากหน้าจอไม่ได้
                  </p>
                </div>
              </details>
              <details className="visible collapse collapse-arrow rounded-control border border-base-300 bg-base-100">
                <summary className="collapse-title flex min-h-11 items-center text-[14px] font-semibold leading-[1.5] text-base-content">ปุ่มยืนยันการอนุมัติกดไม่ได้</summary>
                <div className="collapse-content text-[14px] leading-[1.7] text-base-content/80">
                  <p className="m-0">
                    แปลว่าช่วงเวลานั้นมีการจองที่{' '}
                    <span className="badge badge-emerald">อนุมัติแล้ว</span>
                    {' '}อยู่ก่อน ระบบไม่ยอมให้อนุมัติซ้อน ให้ยกเลิกการจองเดิม (ระบุเหตุผล) หรือปฏิเสธคำขอนี้แทน
                  </p>
                </div>
              </details>
              <details className="visible collapse collapse-arrow rounded-control border border-base-300 bg-base-100">
                <summary className="collapse-title flex min-h-11 items-center text-[14px] font-semibold leading-[1.5] text-base-content">ไม่เห็นเมนูหรือปุ่มที่ควรมี</summary>
                <div className="collapse-content text-[14px] leading-[1.7] text-base-content/80">
                  <p className="m-0">ระบบซ่อนเมนูและปุ่มที่บทบาทของคุณไม่มีสิทธิ์ ไม่ได้แสดงเป็นสีเทา ดูตารางสิทธิ์ในหัวข้อ “บทบาทและสิทธิ์ในระบบ” ถ้าควรได้สิทธิ์เพิ่ม ให้ผู้ดูแลระบบสูงสุดเปลี่ยนบทบาทของบัญชีในหน้าเจ้าหน้าที่ระบบ</p>
                </div>
              </details>
              <details className="visible collapse collapse-arrow rounded-control border border-base-300 bg-base-100">
                <summary className="collapse-title flex min-h-11 items-center text-[14px] font-semibold leading-[1.5] text-base-content">ส่งประกาศผิด เรียกคืนได้หรือไม่</summary>
                <div className="collapse-content text-[14px] leading-[1.7] text-base-content/80">
                  <p className="m-0">เรียกคืนไม่ได้ เพราะ LINE ไม่มีการยกเลิกข้อความ Push วิธีแก้คือส่งประกาศใหม่ที่ชี้แจงความถูกต้อง ครั้งต่อไปให้ใช้ฉบับร่างและตรวจตัวอย่างในโทรศัพท์จำลองก่อนส่งทุกครั้ง</p>
                </div>
              </details>
              <details className="visible collapse collapse-arrow rounded-control border border-base-300 bg-base-100">
                <summary className="collapse-title flex min-h-11 items-center text-[14px] font-semibold leading-[1.5] text-base-content">เจ้าหน้าที่ใหม่ไม่ได้รับรหัสผ่านชั่วคราว</summary>
                <div className="collapse-content text-[14px] leading-[1.7] text-base-content/80">
                  <p className="m-0">
                    รหัสแสดงเพียงครั้งเดียวตอนสร้างบัญชี ถ้าปิดหน้าต่างไปแล้วดูย้อนหลังไม่ได้ ให้ผู้ดูแลระบบสูงสุดเปิดบัญชีนั้นแล้วกด{' '}
                    <span className="font-medium text-base-content">รีเซ็ตรหัสผ่าน</span>
                    {' '}เพื่อออกรหัสใหม่ รหัสเดิมจะใช้ไม่ได้ทันที
                  </p>
                </div>
              </details>
            </div>
          </>
        ),
      },
      {
        title: 'เมื่อต้องแจ้งปัญหาให้ผู้ดูแล',
        body: (
          <>
            <p className="m-0 text-[14px] leading-[1.7] text-base-content/80 th-tight">
              เปิดหน้า{' '}
              <span className="font-medium text-base-content">ข้อมูลเวอร์ชันระบบ</span>
              {' '}แล้วกดคัดลอกข้อมูลสำหรับแจ้งปัญหา ข้อความนั้นมีเวอร์ชันของหน้าเว็บและเซิร์ฟเวอร์ เวลา และบทบาทของคุณ โดยไม่มีชื่อหรืออีเมล ส่งต่อให้ผู้ดูแลได้ทันที ช่วยให้ตรวจสอบได้เร็วกว่าการบอกเพียงว่า “ระบบมีปัญหา”
            </p>
            <div role="note" className="alert alert-info alert-soft mt-4 text-sm rounded-control gap-2.5 px-3.5 py-3 leading-[1.6] text-base-content">
              <Ico d={PATH.INFO} className="mt-0.5 h-5 w-5 shrink-0 text-info" />
              <p className="m-0">ถ้าหน้านั้นแจ้งว่าหน้าเว็บกับเซิร์ฟเวอร์เป็นคนละเวอร์ชัน ให้โหลดหน้าใหม่ก่อน ปัญหาแปลก ๆ หลายอย่างหายได้เอง</p>
            </div>
          </>
        ),
        links: ['ข้อมูลเวอร์ชันระบบ', 'การเชื่อมต่อระบบ', 'บันทึกข้อผิดพลาด'],
      },
    ],
  },
]
