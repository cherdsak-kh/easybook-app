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
     * ⚠️ NOT RELEASED YET, AND THEREFORE NOT VISIBLE YET. `package.json` is still `0.5.0`, and the
     * page renders `RELEASES.filter(r => compareVersions(r.v, APP.version) <= 0)` — so this entry is
     * inert until the PO calls the release. That is the doctrine at the top of this file working as
     * intended, and it is how `0.4.0` was written too: notes are authored by whoever ships the work,
     * at the moment they finish it, not reconstructed from a diff weeks later.
     *
     * The date is filled in on the day it ships. It is a fact about the release, never computed.
     *
     * `x`, because this release adds a PAGE.
     */
    v: '0.6.0',
    date: '19 ส.ค. 2569',
    groups: [
      {
        t: 'ใหม่',
        items: [
          'หน้าการลงทะเบียน — ผู้ที่เพิ่มเพื่อนและลงทะเบียนผ่าน LINE ทั้งหมด ค้นหาด้วยชื่อ ชื่อไลน์ ตำแหน่ง กลุ่ม/ฝ่าย หรือเบอร์โทรศัพท์ กรองตามสถานะ และเรียงตามวันที่ลงทะเบียนหรือชื่อได้ · ทุกบทบาทเปิดดูได้ แต่การอนุมัติและแก้ไขเป็นสิทธิ์ของผู้ดูแลระบบและเจ้าหน้าที่ดูแลระบบ',
          'ตรวจสอบผู้ลงทะเบียนทีละราย แล้วอนุมัติ ส่งคืนให้แก้ไข ระงับ หรือปลดระงับได้จากหน้าต่างเดียว · ผู้ใช้จะได้รับผลทาง LINE ทันที',
          'แก้ไขชื่อ–สกุล ตำแหน่ง กลุ่ม/ฝ่าย และเบอร์โทรศัพท์ของผู้ลงทะเบียนแทนผู้ใช้ได้ · ผู้ดูแลระบบสูงสุดเปลี่ยนสถานะได้โดยตรงเพิ่มอีกทางหนึ่ง',
          // The live half, described as what the operator SEES rather than as a technology.
          'รายการอัปเดตเองเมื่อมีคนลงทะเบียนเข้ามาหรือมีเจ้าหน้าที่คนอื่นดำเนินการ · แถวจะไม่ขยับเองระหว่างที่คุณกำลังอ่าน — ระบบจะขึ้นแถบบอกว่ามีอะไรใหม่ แล้วให้คุณกดโหลดเมื่อพร้อม',
          'เหตุผลที่เจ้าหน้าที่กรอกตอนส่งคืนหรือระงับ ถูกเก็บไว้กับบัญชีนั้นและอ่านย้อนหลังได้ในหน้าต่างตรวจสอบข้อมูล',
          'ตัวเลขบนเมนู “การลงทะเบียน” บอกจำนวนผู้ที่รออนุมัติจริง และขยับเองทันทีแม้คุณจะอยู่หน้าอื่น',
        ],
      },
      {
        t: 'ปรับปรุง',
        items: [
          // Only the never-chosen see this change, so the line says WHO it is for rather than
          // announcing a switch that has been on the top bar since 0.2.0.
          'ผู้ที่ยังไม่เคยเลือกธีมเอง จะได้ธีมสว่างเป็นค่าเริ่มต้น จากเดิมที่ใช้ตามการตั้งค่าของเครื่อง · เลือกเป็นโหมดมืดหรือให้ตามเครื่องได้เหมือนเดิมจากแถบด้านบน',
          // ⚠️ THIS ONE BELONGS IN THE NOTES WHERE THE AVATAR FIX DID NOT — see the `0.5.0` comment
          // below for the rule. The login screen has been on every install since `0.2.0`, so an
          // operator upgrading from `0.5.0` has met this and will notice it changed. Written as the
          // thing they can now do, not as the routing that makes it possible.
          'เปิดลิงก์ตรงไปหน้าใดก็ได้ทั้งที่ยังไม่ได้เข้าสู่ระบบ จะพาไปหน้าเข้าสู่ระบบก่อน แล้วพากลับมาที่หน้านั้นให้เองเมื่อเข้าสู่ระบบสำเร็จ · ที่อยู่บนแถบเบราว์เซอร์ตรงกับหน้าที่เห็นแล้ว จึงคั่นหน้าและส่งลิงก์ให้กันได้ตามปกติ',
        ],
      },
      {
        t: 'แก้ไข',
        items: [
          // หน้าโปรไฟล์ shipped in `0.4.0`, so this is a repair to something operators have had for
          // two releases — the same test the login line above passes and the avatar-disc border did
          // not. Says what they can now do with their hands, not which library changed underneath.
          'กรอบครอปในหน้าต่างเปลี่ยนรูปโปรไฟล์ ย่อ–ขยายและเลื่อนได้อิสระด้วยการลากมุมหรือขอบอีกครั้ง จากเดิมที่กรอบถูกตรึงขนาดไว้และเลื่อนได้แต่ตัวรูป',
        ],
      },
    ],
  },
  {
    /*
     * `x` because this release adds a PAGE — the rule the PO set on 18 ส.ค. 2569 — and the date is
     * the day it shipped, written down rather than computed.
     *
     * ⚠️ THE TWO SESSION LINES ARE HERE AND THE VIEWER FIX IS NOT, and that is the same rule
     * applied twice. The session dialog shipped in `0.2.0`, so an operator on `0.4.0` could meet
     * both defects and will notice they are gone. เจ้าหน้าที่ระบบ did not exist before this
     * release, so "ผู้ดูข้อมูลเปิดหน้านี้ไม่ได้" is not something anybody experienced — it was
     * fixed inside the version that introduces the page, and announcing it would describe a
     * product nobody used. Who can open the page is stated in the ใหม่ line instead, as a fact
     * about the page rather than as a repair.
     */
    v: '0.5.0',
    date: '19 ส.ค. 2569',
    groups: [
      {
        t: 'ใหม่',
        items: [
          'หน้าเจ้าหน้าที่ระบบ — รายชื่อบัญชีทั้งหมดที่เข้าใช้งานระบบหลังบ้านได้ ค้นหาด้วยชื่อหรืออีเมล และกรองตามบทบาทหรือสถานะได้ · ทุกบทบาทเปิดดูได้ แต่การจัดการเป็นสิทธิ์ของผู้ดูแลระบบสูงสุดเท่านั้น',
          'ผู้ดูแลระบบสูงสุดเพิ่มบัญชีเจ้าหน้าที่ได้เอง โดยระบบจะออกรหัสผ่านชั่วคราวให้และแสดงเพียงครั้งเดียว',
          'แก้ไขข้อมูล เปลี่ยนบทบาท ระงับการใช้งาน รีเซ็ตรหัสผ่าน ลบ และกู้คืนบัญชีเจ้าหน้าที่ได้จากหน้าเดียวกัน',
        ],
      },
      {
        t: 'แก้ไข',
        items: [
          'หน้าต่างแจ้งเซสชันสิ้นสุด แสดงกลางหน้าจอ จากเดิมที่ไปอยู่มุมบนซ้ายและใช้สีของธีมผิด',
          'หน้าต่างแจ้งเซสชันสิ้นสุด บอกสาเหตุตรงกับกรณีที่เกิดขึ้นจริง — หากบัญชีถูกระงับหรือถูกลบ จะบอกให้ติดต่อผู้ดูแลระบบสูงสุด แทนที่จะบอกให้เข้าสู่ระบบใหม่ซึ่งจะไม่สำเร็จ',
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
