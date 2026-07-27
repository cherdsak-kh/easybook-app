import type { SystemRole } from '@/lib/api-client'

/**
 * User-facing copy for the **admin-portal self-service Profile page** — the three
 * cards, the edit-mode action bar, and the save / password / avatar modals — in one
 * place so a component and its tests read the SAME string.
 *
 * Part of the **centralized-but-modularized** UI-string architecture: each
 * feature/surface owns a `src/constants/ui-strings-<feature>.ts` module exporting
 * named `as const` objects. This is a **back-office** module: never import it from a
 * client/LIFF component, and never import `ui-strings-client.ts` here — that
 * separation is what keeps an internal re-word off an end user's screen.
 *
 * This is **not** i18n. `{ th, en }` pairs are not a locale system: the design shows
 * a Thai label with a small English gloss beside it *simultaneously*, so both halves
 * are always on screen. There is no locale, no switch, no `t()`. Do not grow this
 * into one without a plan that asks for it.
 */

/** A bilingual field/section label. Both halves render at once — see the note above. */
export interface BilingualLabel {
  readonly th: string
  readonly en: string
}

export const PROFILE_STRINGS = {
  /**
   * Page heading. Renders as exactly `ข้อมูลผู้ใช้งาน (User Profile)` — the role badge
   * that used to sit beside it was removed (PO review): the role is already stated on
   * the header card and in the account card, and a third copy in the `<h1>` made the
   * page's accessible name role-dependent.
   */
  heading: { th: 'ข้อมูลผู้ใช้งาน', en: 'User Profile' },

  /**
   * The label this page is known by in the SHELL — the sidebar's Settings → Profile
   * leaf and the navbar avatar dropdown. Both read this one literal so the two entry
   * points into `/admin-portal/profile` can never drift apart (or from the tests).
   */
  navLabel: 'ข้อมูลผู้ใช้งาน',

  /** Rendered wherever a nullable value is absent (`—`, never "Invalid Date"). */
  emptyValue: '—',
  /** `createdBy === null` — true only for the seeded first SUPER_ADMIN. */
  createdBySystem: 'ระบบ',

  /** Screen-reader text for the initial load skeleton. */
  loading: 'กำลังโหลดข้อมูลโปรไฟล์…',
  loadFailed: 'ไม่สามารถโหลดข้อมูลโปรไฟล์ได้ โปรดลองใหม่อีกครั้ง',
  retry: 'ลองใหม่อีกครั้ง',

  cards: {
    account: { th: 'ข้อมูลบัญชีผู้ใช้', en: 'Account Info' },
    personal: { th: 'ข้อมูลส่วนตัว', en: 'Personal Info' },
    audit: { th: 'ประวัติการใช้งานระบบ', en: 'Audit Trail' },
  },

  fields: {
    email: { th: 'อีเมล', en: 'Email' },
    password: { th: 'รหัสผ่าน', en: 'Password' },
    role: { th: 'ระดับสิทธิ์', en: 'Role' },
    line: { th: 'บัญชีไลน์', en: 'LINE' },
    firstName: { th: 'ชื่อ', en: 'First Name' },
    lastName: { th: 'นามสกุล', en: 'Last Name' },
    phone: { th: 'เบอร์โทรศัพท์', en: 'Phone' },
    department: { th: 'แผนก', en: 'Department' },
    position: { th: 'ตำแหน่ง', en: 'Position' },
    createdBy: { th: 'ผู้สร้างบัญชี', en: 'Created By' },
    createdAt: { th: 'วันที่สร้าง', en: 'Created At' },
    updatedAt: { th: 'อัปเดตล่าสุด', en: 'Updated At' },
    lastLogin: { th: 'ล็อกอินล่าสุด', en: 'Last Login' },
  },

  /**
   * The account id shown under the display name in the header card. Spelled `CUID:`
   * (not `id:`) because that is what the value literally is — a collision-resistant
   * unique id — and support staff are asked for it by that name.
   */
  idPrefix: 'CUID:',

  actions: {
    edit: 'แก้ไขข้อมูล',
    save: 'บันทึกข้อมูล',
    saving: 'กำลังบันทึก…',
    cancel: 'ยกเลิก',
    confirm: 'ยืนยัน',
    close: 'ปิด',
    closeBackdrop: 'ปิดหน้าต่าง',
    dismiss: 'ปิดข้อความแจ้งเตือน',
    changePassword: 'เปลี่ยนรหัสผ่าน',
    changeAvatar: 'เปลี่ยนรูปโปรไฟล์',
    /** Accessible name of the copy-to-clipboard button beside the CUID. */
    copyId: 'คัดลอก CUID',
  },

  /** Copy-to-clipboard feedback. Both outcomes are announced — a failure is never silent. */
  copy: {
    done: 'คัดลอกแล้ว',
    /** `navigator.clipboard` can be absent (insecure context) or denied by the user. */
    failed: 'ไม่สามารถคัดลอกได้',
  },

  /** Alt text for the avatar image; empty-ish names still produce a sane sentence. */
  avatarAlt: (name: string) => `รูปโปรไฟล์ของ ${name}`,

  line: {
    connect: 'เชื่อมต่อบัญชีไลน์',
    /** The row is real (it carries `lineUserId`); the ACTION is not built yet. */
    comingSoon: 'เร็ว ๆ นี้',
    comingSoonHint: 'ฟีเจอร์เชื่อมต่อบัญชีไลน์ยังไม่เปิดให้ใช้งาน',
    linked: 'เชื่อมต่อแล้ว',
    notLinked: 'ยังไม่ได้เชื่อมต่อ',
  },

  save: {
    confirmTitle: 'ยืนยันการบันทึกข้อมูล',
    confirmBody: 'คุณต้องการบันทึกการเปลี่ยนแปลงข้อมูลโปรไฟล์ใช่หรือไม่?',
    /**
     * Shown in the success toast, and ONLY when a PATCH actually committed — the
     * "nothing changed" path sends no request and gets `noChanges` instead.
     */
    success: 'บันทึกข้อมูลเรียบร้อยแล้ว',
    /** Nothing changed — we deliberately send NO request (an empty body is a 400). */
    noChanges: 'ไม่มีการเปลี่ยนแปลงข้อมูล',
    /** 400 — a rejected value, or an unknown / system-reserved department / position id. */
    invalid: 'ข้อมูลไม่ถูกต้อง โปรดตรวจสอบอีกครั้ง',
    /** 403 — NOT session death; the client gate drifted vs. the server authority. */
    forbidden: 'คุณไม่มีสิทธิ์แก้ไขข้อมูลนี้',
    notFound: 'ไม่พบบัญชีผู้ใช้นี้ โปรดรีเฟรชหน้าเว็บ',
    failed: 'ไม่สามารถบันทึกข้อมูลได้ โปรดลองใหม่อีกครั้ง',
  },

  options: {
    loading: 'กำลังโหลดตัวเลือก…',
    /** The department / position lists failed to load, so Save stays disabled. */
    failed: 'ไม่สามารถโหลดตัวเลือกแผนกและตำแหน่งได้ โปรดลองใหม่อีกครั้ง',
  },

  password: {
    title: 'เปลี่ยนรหัสผ่าน',
    current: 'รหัสผ่านเดิม',
    currentPlaceholder: 'พิมพ์รหัสผ่านเดิม',
    next: 'รหัสผ่านใหม่',
    nextPlaceholder: 'พิมพ์รหัสผ่านใหม่',
    confirm: 'ยืนยันรหัสผ่านใหม่',
    confirmPlaceholder: 'พิมพ์รหัสผ่านใหม่อีกครั้ง',
    submit: 'บันทึกรหัสผ่าน',
    submitting: 'กำลังบันทึก…',
    success: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว',
    /** The always-on field hint. Deliberately NOT the same literal as `tooShort` — an
     *  identical string would render twice once the error fires, which is noise for a
     *  screen reader and ambiguous for a test query. */
    hint: (min: number) => `ความยาวอย่างน้อย ${min} ตัวอักษร`,
    required: 'โปรดกรอกข้อมูลให้ครบทุกช่อง',
    mismatch: 'รหัสผ่านใหม่และการยืนยันไม่ตรงกัน',
    tooShort: (min: number) => `รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย ${min} ตัวอักษร`,
    tooLong: (max: number) => `รหัสผ่านใหม่ต้องมีความยาวไม่เกิน ${max} ตัวอักษร`,
    /**
     * A WRONG current password is a **400**, never a 401 — it must render here and
     * must NEVER be treated as session death.
     */
    wrongCurrent: 'รหัสผ่านเดิมไม่ถูกต้อง',
    failed: 'ไม่สามารถเปลี่ยนรหัสผ่านได้ โปรดลองใหม่อีกครั้ง',
    /**
     * Accessible name of a show/hide eye toggle, PARAMETERISED BY FIELD. The login
     * screen has one password box so a bare "แสดงรหัสผ่าน" is unambiguous there; this
     * modal has three, and three identically-named buttons would be useless to a
     * screen-reader user. Interpolating the field label makes each name unique
     * ("แสดงรหัสผ่านเดิม" / "แสดงรหัสผ่านใหม่" / …) and keeps every test query scoped
     * to one control.
     */
    show: (field: string) => `แสดง${field}`,
    hide: (field: string) => `ซ่อน${field}`,
  },

  avatar: {
    title: 'อัปโหลดรูปโปรไฟล์ใหม่',
    pickLabel: 'เลือกไฟล์รูปภาพ',
    pickHint: 'เลือกไฟล์รูปภาพเพื่อครอปเป็นสัดส่วน 1:1',
    cropHint: 'ลากเพื่อเลื่อนรูป และปรับระดับการซูมด้านล่าง',
    zoom: 'ระดับการซูม',
    submit: 'บันทึกรูปภาพ',
    submitting: 'กำลังอัปโหลด…',
    tooLarge: (megabytes: number) => `ไฟล์ใหญ่เกินไป (สูงสุด ${megabytes} MB)`,
    badType: 'ชนิดไฟล์ไม่รองรับ (รองรับเฉพาะ JPEG, PNG และ WebP)',
    cropFailed: 'ไม่สามารถประมวลผลรูปภาพได้ โปรดเลือกไฟล์ใหม่',
    failed: 'ไม่สามารถอัปโหลดรูปภาพได้ โปรดลองใหม่อีกครั้ง',
  },
} as const

/**
 * Role → the Thai label shown to the user. The raw enum value (`SUPER_ADMIN`, …) is a
 * wire/DB token, never UI copy, so it is not rendered anywhere on this page any more.
 *
 * Deliberately Thai-ONLY, not "SUPER_ADMIN (ผู้ดูแลระบบสูงสุด)": every other value on
 * this page renders in one language, and the bilingual `{ th, en }` treatment is
 * reserved for field/section LABELS (see {@link BilingualLabel}), not for values.
 * This is not i18n — there is no locale and no `t()`.
 */
export const ROLE_LABEL: Readonly<Record<SystemRole, string>> = {
  SUPER_ADMIN: 'ผู้ดูแลระบบสูงสุด',
  ADMIN: 'ผู้ดูแลระบบ',
  STAFF: 'เจ้าหน้าที่',
}

/**
 * Role → badge colour. daisyUI **semantic** colour classes only: each theme supplies
 * its own `*-content` foreground, so there is no `text-white` here (the prototypes'
 * `text-white` would be unreadable on a light `badge-warning`-style token and is
 * exactly the hard-coded colour this project bans).
 */
export const ROLE_BADGE: Readonly<Record<SystemRole, string>> = {
  SUPER_ADMIN: 'badge-secondary',
  ADMIN: 'badge-error',
  STAFF: 'badge-success',
}

/** Role → avatar ring colour, mirroring {@link ROLE_BADGE}. */
export const ROLE_RING: Readonly<Record<SystemRole, string>> = {
  SUPER_ADMIN: 'ring-secondary',
  ADMIN: 'ring-error',
  STAFF: 'ring-success',
}
