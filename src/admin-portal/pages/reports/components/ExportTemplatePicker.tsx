/**
 * Hub 4, step 1: `1. รูปแบบเอกสาร`. Prototype `[data-route="reports-export"]` ~L8582–8590.
 *
 * Three daisyUI `btn` radios in a labelled `radiogroup`, one column on a phone and three from `md`.
 * The labels are the PO's Phase 3 names (`REPORT_TEMPLATE_LABEL`), not the prototype's, and the line
 * under the group describes the CHOSEN form (the prototype's `TEMPLATES[...].desc`), wired to the
 * group by `aria-describedby` so a screen reader hears what it is picking.
 *
 * ⚠️ PURELY CONTROLLED, like `ReportFilterBar`: the page owns the state and the URL write-back.
 */

import type { ExportTemplateKey } from '../export-params'
import { EXPORT_TEMPLATE_KEYS } from '../export-params'
import { REPORT_TEMPLATE_LABEL, type ReportTemplate } from '../../../labels'

const API_OF: Record<ExportTemplateKey, ReportTemplate> = {
  summary: 'SUMMARY',
  ledger: 'LEDGER',
  venues: 'VENUES',
}

/** What each form is FOR: the prototype's own sentences, adjusted for the PO's template names. */
const TEMPLATE_DESC: Record<ExportTemplateKey, string> = {
  summary:
    'ตัวชี้วัดหลัก อัตราการใช้สถานที่รายห้อง การจัดสรรตามกลุ่มสาระ/ฝ่าย และวินัยการใช้งาน สำหรับเสนอผู้อำนวยการและเทศบาล',
  ledger: 'ทุกคำขอในช่วงเวลาที่เลือก เรียงตามวันที่ใช้ พร้อมสถานะ สำหรับการตรวจสอบย้อนหลัง',
  venues:
    'ชั่วโมงที่ใช้ อัตราการใช้ คำขอที่ชนเวลา ช่วงเวลาที่ใช้มากที่สุด และผู้ใช้หลักของแต่ละสถานที่',
}

export function ExportTemplatePicker({
  value,
  onChange,
}: {
  value: ExportTemplateKey
  onChange: (template: ExportTemplateKey) => void
}) {
  return (
    <div className="min-w-0">
      <p id="rpe-tpl-l" className="label">
        1. รูปแบบเอกสาร
      </p>
      <div
        className="grid gap-2 md:grid-cols-3"
        role="radiogroup"
        aria-labelledby="rpe-tpl-l"
        aria-describedby="rpe-tpl-desc"
      >
        {EXPORT_TEMPLATE_KEYS.map((key) => (
          <input
            key={key}
            type="radio"
            name="rpe-tpl"
            value={key}
            checked={value === key}
            onChange={() => onChange(key)}
            className="btn min-h-11 w-full whitespace-nowrap px-3"
            aria-label={REPORT_TEMPLATE_LABEL[API_OF[key]]}
          />
        ))}
      </div>
      <p id="rpe-tpl-desc" className="m-0 mt-2 text-[13px] leading-[1.6] text-base-content/70">
        {TEMPLATE_DESC[value]}
      </p>
    </div>
  )
}
