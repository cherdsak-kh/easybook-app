/**
 * ONE screen serving FOUR destinations — ตำแหน่งบุคลากร, กลุ่ม/ฝ่ายบุคลากร, ประเภทสถานที่ and
 * อุปกรณ์ที่ให้บริการ.
 *
 * The record is `{ id, name, holderCount, … }` in all four tables and every endpoint is the same
 * shape, so the screen and its dialog are shared and every word that differs is a string in here.
 *
 * ⚠️ THE TWO VENUE TABLES ARRIVED ON 25 ส.ค. 2569 AND THEY ARE NOT COPIES. Two fields in this file
 * exist only because they differ, and both would otherwise have become `if (model === …)` in the
 * page — which its header forbids for good reason:
 *
 *   · `parts` — the personnel tables hold TWO populations (LINE registrants and staff) and the
 *     delete confirmation must say which is moving. Venue tables hold one. `null` where there is
 *     nothing to split.
 *   · `unit` — `คน` for people, `แห่ง` for places. The page used to write `คน` into the sentence
 *     itself, which was correct while every table held people.
 *
 * The third difference is not here at all, because it is not copy: `amenity` has no reserved rows
 * and no tombstone, so `holdersMove` promises no destination — it says what survives instead.
 *
 * ⚠️ WHOLE CLAUSES, NEVER FRAGMENTS ASSEMBLED WITH A PREFIX. `holdersSome` and the confirm
 * dialog's `delLead` say almost the same thing and are still two separate strings, because the
 * one-string-plus-prefix version produced "มีบุคลากรอยู่ในกลุ่ม/ฝ่ายนี้อยู่ 6 คน" for the
 * department copy — measured. Thai does not survive being built out of pieces.
 */

export type OptionModel = 'personnelRole' | 'department' | 'venueType' | 'amenity'

export interface OptionRecord {
  id: number
  name: string
  /**
   * `isSystemReserved` — a row the system owns. Not CRUD-managed: the server answers 404 to a
   * rename or delete for EVERY role, SUPER_ADMIN included, because a rename would break a
   * resolve-by-name. Nothing renders a pencil on one.
   *
   * ⚠️ On `amenity` this is ALWAYS absent, and not because none happen to be flagged — that table
   * has no such column. It has no System Developer row (that account needs no equipment) and no
   * tombstone (deleting an amenity removes ticks and orphans nothing), so it is the one table where
   * a SUPER_ADMIN and an ADMIN see identical rows.
   */
  reserved?: boolean
  /** How many things hold this option, in whatever unit the copy names. */
  holders: number
  /**
   * The same total SPLIT into the populations it was summed from — or `null` where there is only
   * one population to begin with.
   *
   * ⚠️ THIS IS WHY THE PAGE STILL HAS NO `if (model === …)`. The personnel tables are shared between
   * LINE registrations and back-office accounts, and the delete confirmation must say which of the
   * two is about to move, because re-pointing 8 registrants is a different cleanup from re-pointing
   * 5 staff accounts. A venue type holds only venues and an amenity only venues, so there is nothing
   * to split and a second number could only repeat the first. The confirmation renders the breakdown
   * when this is present and omits it when it is not — a data shape, not a branch on which screen.
   */
  parts: { label: string; n: number }[] | null
  createdAt: string
  updatedAt: string
}

export const holdersOf = (r: OptionRecord) => r.holders

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
   * The empty state says the CONSEQUENCE, not just the fact.
   *
   * ⚠️ AND THE CONSEQUENCE IS NOT THE SAME ON ALL FOUR TABLES. Three of them are pointed at by a
   * REQUIRED foreign key, so empty means an OUTAGE — nobody can finish a LINE registration, or
   * nobody can add a venue. `amenity` is many-to-many and optional on the venue form, so empty is a
   * LOSS: everything still works, you just cannot tick anything or search by equipment. Writing the
   * outage sentence there would warn about a failure that cannot happen, which is how operators
   * learn to skim the warnings that do mean something.
   */
  emptyDesc: string
  namePlaceholder: string
  nameHint: string
  /**
   * The unit the holder count is counted in — `คน` for people, `แห่ง` for places.
   *
   * It exists because `holdersSome` and `delLead` end where a number begins, and the number is
   * followed by a unit that is NOT the same word on every table. Hard-coding `คน` in the page was
   * correct while both tables held people and becomes a lie the moment one holds rooms.
   */
  unit: string
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
    unit: 'คน',
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
    unit: 'คน',
  },
  venueType: {
    noun: 'ประเภทสถานที่',
    desc: 'หมวดหมู่ที่ใช้จัดกลุ่มสถานที่จัดกิจกรรม และใช้กรองรายการให้ผู้ใช้หาสถานที่ได้เร็วขึ้น',
    colHolders: 'สถานที่ในประเภทนี้',
    holdersSome: 'มีสถานที่อยู่ในประเภทนี้',
    holdersNone: 'ยังไม่มีสถานที่ใดอยู่ในประเภทนี้',
    delLead: 'ขณะนี้มีสถานที่อยู่ในประเภทนี้',
    holdersMove: 'ทั้งหมดจะถูกย้ายไปที่ “ไม่พบประเภทสถานที่” ทันที และต้องกำหนดประเภทใหม่ให้ทีละแห่ง',
    // ⚠️ AN OUTAGE, exactly like the two personnel tables — `Venue.venueTypeId` is a REQUIRED FK, so
    // an empty table means no venue can be created at all. Contrast `amenity` below, whose empty
    // state describes a LOSS.
    emptyDesc: 'จะเพิ่มสถานที่จัดกิจกรรมไม่ได้เลย จนกว่าจะเพิ่มอย่างน้อยหนึ่งประเภท',
    namePlaceholder: 'เช่น ห้องปฏิบัติการ',
    nameHint: 'ชื่อนี้จะปรากฏเป็นตัวเลือกตอนเพิ่มหรือแก้ไขสถานที่ และใช้เป็นตัวกรองในรายการสถานที่',
    unit: 'แห่ง',
  },
  amenity: {
    noun: 'อุปกรณ์',
    desc: 'รายการอุปกรณ์และสิ่งอำนวยความสะดวกที่ติ๊กเลือกได้ตอนเพิ่มหรือแก้ไขสถานที่',
    colHolders: 'สถานที่ที่มีอุปกรณ์นี้',
    holdersSome: 'มีสถานที่ที่ให้บริการอุปกรณ์นี้',
    holdersNone: 'ยังไม่มีสถานที่ใดให้บริการอุปกรณ์นี้',
    delLead: 'ขณะนี้มีสถานที่ที่ให้บริการอุปกรณ์นี้',
    // ⚠️ NOT "ย้ายไปที่…" — there is nowhere to move to, and that is the good news rather than a
    // gap. The clause says what SURVIVES, because the number in front of it (5 แห่ง) otherwise
    // reads like five venues are about to be damaged.
    holdersMove: 'อุปกรณ์นี้จะถูกเอาออกจากสถานที่เหล่านั้น ตัวสถานที่ยังอยู่ครบและยังจองได้ตามปกติ',
    // ⚠️ A LOSS, NOT AN OUTAGE — and the difference is the whole reason this table is not a copy of
    // the three above. Amenities are OPTIONAL on the venue form, so an empty table blocks no create
    // anywhere. Warning about a failure that cannot happen would teach an operator to distrust the
    // warnings that mean something.
    emptyDesc:
      'ยังเพิ่มและแก้ไขสถานที่ได้ตามปกติ แต่จะไม่มีอุปกรณ์ให้ติ๊กเลือก และผู้ใช้จะค้นหาสถานที่ตามอุปกรณ์ไม่ได้',
    namePlaceholder: 'เช่น ไมโครโฟนไร้สาย',
    nameHint: 'ชื่อนี้จะปรากฏเป็นตัวเลือกตอนเพิ่มหรือแก้ไขสถานที่ และใช้ค้นหาสถานที่ตามอุปกรณ์',
    unit: 'แห่ง',
  },
}

/** The four destinations, keyed by the SAME label the router routes by and the ACL gates by. */
export const OPTION_OF: Record<string, OptionModel> = {
  ตำแหน่งบุคลากร: 'personnelRole',
  'กลุ่ม/ฝ่ายบุคลากร': 'department',
  ประเภทสถานที่: 'venueType',
  อุปกรณ์ที่ให้บริการ: 'amenity',
}
