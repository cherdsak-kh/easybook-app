/**
 * The release notes. They SHIP WITH THE BUNDLE — a static list in this repo, not a table an
 * administrator edits — and two visible properties of the version screen follow from that:
 *
 *  · you can never be shown notes for a version you are not running. The page renders this list
 *    filtered to `<= APP.version`, so the top entry IS your version;
 *  · when your bundle is stale, the newest release is genuinely missing from it, and the page
 *    says so out loud rather than quietly showing a shorter history.
 *
 * A CMS for this would be a table, a form, a permission and a screen, so that an administrator
 * could edit a description of work they did not do. Notes are written by whoever ships the
 * release, at the moment they ship it.
 *
 * ⚠️⚠️ EVERY LINE BELOW MUST NAME SOMETHING THAT ACTUALLY EXISTS AND STILL EXISTS. A changelog is
 * the one place in a product that can announce a feature nobody built, and the reader has no way
 * to check — the menu row for it says "อยู่ระหว่างการพัฒนา" three clicks away. Announcing work
 * that was later DELETED is the same failure wearing a different hat, which is why the history
 * starts at `0.2.0`: `0.1.0` was the scaffold's default version, never a release, and everything
 * shipped under it (the first back-office) was removed whole on 16 ส.ค. 2569. A note for it would
 * describe a product that no longer exists.
 *
 * The version train is `Q3`: `0.x.y`, `1.0.0` on the day the school starts using it. What moves
 * which digit is decided by the SIZE OF THE RELEASE, not by whether a phase closed (the PO replaced
 * "one phase = one minor" on 18 ส.ค. 2569):
 *
 *  · a new page or a large feature bumps `x`, and `y` resets to `0` — `npm version minor` does the
 *    reset itself, so it cannot be forgotten;
 *  · adding, removing or changing something that already ships, or anything small, bumps `y`.
 *
 * ⚠️ The decision is made per RELEASE, not per page: one release moves the number once, sized by
 * the largest thing inside it. Five pages that have not shipped yet are one `0.4.0`, not `0.8.0`.
 */

/**
 * ⚠️ THREE GROUP NAMES, AS A UNION, AND NOT A `string`. Release notes read fine grouped under a
 * word; what they do not survive is a fourth word appearing in the tenth entry because whoever
 * wrote it reached for a synonym. The type is the only thing that stops that, since nothing about
 * a typo'd heading looks wrong on screen.
 */
export interface ReleaseGroup {
  t: 'ใหม่' | 'ปรับปรุง' | 'แก้ไข'
  items: readonly string[]
}

export interface Release {
  /** `x.y.z`, compared with `compareVersions` — never as a string. */
  v: string
  /** Thai Buddhist-era date, written down when the release happened. Never computed. */
  date: string
  groups: readonly ReleaseGroup[]
}

/** Newest first. The page relies on that order and does not sort. */
export const RELEASES: readonly Release[] = [
  {
    /*
     * ⚠️ NOT RELEASED YET, so not visible yet — `package.json` is `0.4.0` and the page filters to
     * `<= APP.version`. `x` because this is a NEW PAGE, which is the rule the PO set on
     * 18 ส.ค. 2569; the date is a placeholder until the day it actually ships.
     */
    v: '0.5.0',
    date: '19 ส.ค. 2569',
    groups: [
      {
        t: 'ใหม่',
        items: [
          'หน้าเจ้าหน้าที่ระบบ — รายชื่อบัญชีทั้งหมดที่เข้าใช้งานระบบหลังบ้านได้ ค้นหาด้วยชื่อหรืออีเมล และกรองตามบทบาทหรือสถานะได้',
          'ผู้ดูแลระบบสูงสุดเพิ่มบัญชีเจ้าหน้าที่ได้เอง โดยระบบจะออกรหัสผ่านชั่วคราวให้และแสดงเพียงครั้งเดียว',
          'แก้ไขข้อมูล เปลี่ยนบทบาท ระงับการใช้งาน รีเซ็ตรหัสผ่าน ลบ และกู้คืนบัญชีเจ้าหน้าที่ได้จากหน้าเดียวกัน',
        ],
      },
    ],
  },
  {
    /*
     * ⚠️ NOT RELEASED YET, AND THEREFORE NOT VISIBLE YET. `package.json` is still `0.3.0`, and the
     * page renders `RELEASES.filter(r => compareVersions(r.v, APP.version) <= 0)` — so this entry
     * is inert until the version is bumped at the close of P4. That is deliberate and is the
     * doctrine at the top of this file: notes are written by whoever ships the work, at the moment
     * they ship it, not reconstructed from a diff weeks later by someone guessing what changed.
     * Lines get appended here as P4 lands each page; the bump is a separate, PO-owned decision
     * (`Q3`: one phase = one minor).
     *
     * The date is a placeholder for the same reason — it is filled in on the day, never computed.
     */
    v: '0.4.0',
    date: '18 ส.ค. 2569',
    groups: [
      {
        t: 'ใหม่',
        items: [
          'หน้าโปรไฟล์ — ดูข้อมูลบัญชีของคุณได้ครบ และเปลี่ยนรูปโปรไฟล์ได้เอง',
          'หน้าเปลี่ยนรหัสผ่าน ตั้งรหัสผ่านใหม่ได้เองโดยไม่ต้องขอรหัสผ่านชั่วคราวจากผู้ดูแลระบบ',
          'ผู้ดูแลระบบสูงสุดแก้ไขชื่อ–สกุล ตำแหน่ง กลุ่ม/ฝ่าย และเบอร์โทรศัพท์ของตัวเองได้จากหน้าโปรไฟล์',
          'หน้าตำแหน่งบุคลากร และหน้ากลุ่ม/ฝ่ายบุคลากร — เพิ่ม แก้ไข และลบรายการได้เอง ค้นหาได้ และเห็นจำนวนผู้ถือครองของแต่ละรายการ',
          'ลบตำแหน่งหรือกลุ่ม/ฝ่ายที่ยังมีผู้ถือครองอยู่ได้ โดยทุกคนจะถูกย้ายไปที่ “ไม่พบตำแหน่ง” หรือ “ไม่พบกลุ่ม/ฝ่าย” ทันที',
        ],
      },
      {
        t: 'แก้ไข',
        items: [
          'การ์ดบัญชีที่มุมล่างซ้าย แสดงชื่อตำแหน่งของคุณ จากเดิมที่แสดงบทบาทในระบบ',
          'ข้อความเตือนตอนตั้งรหัสผ่านใหม่ ระบุว่ายังขาดเงื่อนไขข้อใด จากเดิมที่บอกรวม ๆ ว่ายังไม่ผ่าน',
        ],
      },
    ],
  },
  {
    v: '0.3.0',
    // Same day as 0.2.0, and that is simply what happened. A date is a fact about the release,
    // not a slot that has to be unique.
    date: '17 ส.ค. 2569',
    groups: [
      {
        t: 'ใหม่',
        items: [
          'หน้าข้อมูลเวอร์ชันระบบ — บอกเวอร์ชันของหน้าเว็บและของเซิร์ฟเวอร์ และเตือนเมื่อสองส่วนนี้ไม่ตรงกัน',
          'ประวัติการอัปเดต แสดงสิ่งที่เปลี่ยนไปในแต่ละเวอร์ชัน',
          'บล็อกข้อมูลสำหรับแจ้งปัญหา คัดลอกแนบไปกับการรายงานได้ในปุ่มเดียว',
        ],
      },
    ],
  },
  {
    v: '0.2.0',
    date: '17 ส.ค. 2569',
    groups: [
      {
        t: 'ใหม่',
        items: [
          'เข้าสู่ระบบสำหรับเจ้าหน้าที่ พร้อมบังคับตั้งรหัสผ่านใหม่เมื่อเข้าใช้ครั้งแรก',
          // Says the quiet part out loud on purpose. Someone reading "เมนูและโครงหน้าจอ" will
          // click a menu row within the minute and find a coming-soon card; a note that let them
          // discover that themselves would be the changelog's first small lie.
          'เมนูและโครงหน้าจอของระบบหลังบ้าน ครบทั้ง 31 ปลายทาง (เนื้อหาของแต่ละหน้าอยู่ระหว่างการพัฒนา)',
          'เลือกโหมดสว่าง โหมดมืด หรือให้ตามการตั้งค่าของเครื่อง ได้จากแถบด้านบน',
          'เมนูแสดงเฉพาะหน้าที่บทบาทของคุณเข้าถึงได้ และเปิดหน้าที่ไม่มีสิทธิ์ผ่านลิงก์ตรงไม่ได้',
        ],
      },
      {
        t: 'ปรับปรุง',
        items: [
          'เมื่อเซสชันหมดอายุ ระบบจะแจ้งให้ทราบและให้เข้าสู่ระบบใหม่ได้จากหน้าเดิมที่ค้างไว้',
        ],
      },
    ],
  },
]
