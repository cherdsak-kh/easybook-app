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

/**
 * ⚠️ WHAT IS DERIVED AND WHAT IS WRITTEN OUT, and the line between them is not arbitrary.
 *
 * The MECHANICAL strings are built from `noun` at the call site — `'เพิ่ม' + noun`,
 * `'แก้ไข' + noun`, `'ชื่อ' + noun` — because in Thai those compose into exactly the phrase a
 * person would write, and two hand-typed copies of `เพิ่มตำแหน่ง` / `เพิ่มกลุ่ม/ฝ่าย` are two
 * chances to fix only one of them.
 *
 * Anything that is a real SENTENCE is written out in full here. Composing prose from fragments is
 * how copy ends up stilted, and these lines are read by school staff — `holdersSome` and `delLead`
 * say almost the same thing and are still two separate strings, because the one-string-plus-prefix
 * version produced "มีบุคลากรอยู่ในกลุ่ม/ฝ่ายนี้อยู่ 6 คน" for the department copy. Measured.
 */
export interface OptionCopy {
  noun: string
  /** The page's own subtitle. */
  desc: string
  /** The usage column's heading — a whole phrase, not `'ผู้ถือ' + noun`. */
  colHolders: string
  holdersSome: string
  holdersNone: string
  /** The delete confirmation's lead. See the note above for why it is not `holdersSome`. */
  delLead: string
  /** What the delete does to the holders. Names the destination in full. */
  holdersMove: string
  /**
   * The empty state says the CONSEQUENCE, not just the fact. An empty option table is not a
   * cosmetic gap: the matching dropdown on the LINE registration form has nothing to offer, and
   * nobody can finish registering. Both tables are required on that form, so this is equally true
   * of ตำแหน่ง and of กลุ่ม/ฝ่าย — only the noun changes.
   */
  emptyDesc: string
  namePlaceholder: string
  nameHint: string
}

const NAME_HINT = 'ชื่อนี้จะปรากฏในรายการให้เลือกตอนลงทะเบียนผ่าน LINE และในโปรไฟล์ของเจ้าหน้าที่ระบบ'

export const OPTION_COPY: Record<OptionModel, OptionCopy> = {
  personnelRole: {
    noun: 'ตำแหน่ง',
    desc: 'รายการตำแหน่งที่ผู้ลงทะเบียนเลือกได้ และที่ใช้กับบัญชีเจ้าหน้าที่ระบบ',
    colHolders: 'ผู้ถือตำแหน่งนี้',
    holdersSome: 'มีผู้ถือตำแหน่งนี้',
    holdersNone: 'ยังไม่มีใครถือตำแหน่งนี้',
    delLead: 'ขณะนี้มีผู้ถือตำแหน่งนี้อยู่',
    holdersMove: 'ทั้งหมดจะถูกย้ายไปที่ “ไม่พบตำแหน่ง” ทันที และต้องกำหนดตำแหน่งใหม่ให้ทีละคน',
    emptyDesc:
      'ผู้ใช้ที่ลงทะเบียนผ่าน LINE จะไม่มีตำแหน่งให้เลือก และจะลงทะเบียนไม่สำเร็จ จนกว่าจะเพิ่มอย่างน้อยหนึ่งตำแหน่ง',
    namePlaceholder: 'เช่น ครูผู้ช่วย',
    nameHint: NAME_HINT,
  },
  department: {
    noun: 'กลุ่ม/ฝ่าย',
    desc: 'รายการกลุ่ม/ฝ่ายที่ผู้ลงทะเบียนเลือกได้ และที่ใช้กับบัญชีเจ้าหน้าที่ระบบ',
    colHolders: 'บุคลากรในกลุ่ม/ฝ่ายนี้',
    holdersSome: 'มีบุคลากรอยู่ในกลุ่ม/ฝ่ายนี้',
    holdersNone: 'ยังไม่มีบุคลากรอยู่ในกลุ่ม/ฝ่ายนี้',
    delLead: 'ขณะนี้มีบุคลากรอยู่ในกลุ่ม/ฝ่ายนี้',
    holdersMove: 'ทั้งหมดจะถูกย้ายไปที่ “ไม่พบกลุ่ม/ฝ่าย” ทันที และต้องกำหนดกลุ่ม/ฝ่ายใหม่ให้ทีละคน',
    emptyDesc:
      'ผู้ใช้ที่ลงทะเบียนผ่าน LINE จะไม่มีกลุ่ม/ฝ่ายให้เลือก และจะลงทะเบียนไม่สำเร็จ จนกว่าจะเพิ่มอย่างน้อยหนึ่งรายการ',
    namePlaceholder: 'เช่น ฝ่ายวิชาการ',
    nameHint: NAME_HINT,
  },
}

/** The two destinations, keyed by the SAME label the router routes by and the ACL gates by. */
export const OPTION_OF: Record<string, OptionModel> = {
  ตำแหน่งบุคลากร: 'personnelRole',
  'กลุ่ม/ฝ่ายบุคลากร': 'department',
}
