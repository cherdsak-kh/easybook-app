/**
 * ตัวเลือกบุคลากร is ONE screen serving TWO destinations — ตำแหน่งบุคลากร and กลุ่ม/ฝ่ายบุคลากร.
 *
 * The record is `{ id, name, isSystemReserved }` in both tables and every endpoint is the same
 * shape, so the screen and its dialog are shared and every word that differs is a string in here.
 *
 * ⚠️ WHOLE CLAUSES, NEVER FRAGMENTS ASSEMBLED WITH A PREFIX. `holdersSome` and the confirm
 * dialog's `delLead` say almost the same thing and are still two separate strings, because the
 * one-string-plus-prefix version produced "มีบุคลากรอยู่ในกลุ่ม/ฝ่ายนี้อยู่ 6 คน" for the
 * department copy — measured. Thai does not survive being built out of pieces.
 */

export type OptionModel = 'personnelRole' | 'department'

export interface OptionRecord {
  id: number
  name: string
  /**
   * `isSystemReserved` — the System Developer's row. Not CRUD-managed: the server answers 404 to a
   * rename or delete for EVERY role, SUPER_ADMIN included, because a rename would break the CLI's
   * resolve-by-name. Nothing renders a pencil on one.
   */
  reserved?: boolean
  /** Holders that came through LINE registration. */
  lineUsers: number
  /** Holders that are back-office accounts. Soft-deleted ones are excluded — they are not staff. */
  staff: number
  createdAt: string
  updatedAt: string
}

export const holdersOf = (r: OptionRecord) => r.lineUsers + r.staff

export interface OptionCopy {
  noun: string
  holdersSome: string
  holdersNone: string
  namePlaceholder: string
  nameHint: string
}

export const OPTION_COPY: Record<OptionModel, OptionCopy> = {
  personnelRole: {
    noun: 'ตำแหน่ง',
    holdersSome: 'มีผู้ถือตำแหน่งนี้',
    holdersNone: 'ยังไม่มีใครถือตำแหน่งนี้',
    namePlaceholder: 'เช่น ครูผู้ช่วย',
    nameHint: 'ชื่อนี้จะปรากฏในรายการให้เลือกตอนลงทะเบียนผ่าน LINE และในโปรไฟล์ของเจ้าหน้าที่ระบบ',
  },
  department: {
    noun: 'กลุ่ม/ฝ่าย',
    holdersSome: 'มีบุคลากรอยู่ในกลุ่ม/ฝ่ายนี้',
    holdersNone: 'ยังไม่มีบุคลากรอยู่ในกลุ่ม/ฝ่ายนี้',
    namePlaceholder: 'เช่น ฝ่ายวิชาการ',
    nameHint: 'ชื่อนี้จะปรากฏในรายการให้เลือกตอนลงทะเบียนผ่าน LINE และในโปรไฟล์ของเจ้าหน้าที่ระบบ',
  },
}
