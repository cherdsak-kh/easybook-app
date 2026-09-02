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
    v: '0.11.0',
    date: '2 ก.ย. 2569',
    groups: [
      {
        t: 'ใหม่',
        items: [
          'ระบบค้นหาสถานที่สำหรับผู้ใช้งาน LINE (#/venues) — หน้ารายการสถานที่จัดกิจกรรม รองรับการค้นหา กรองหมวดหมู่แบบขึ้นบรรทัดใหม่ และสลับมุมมองการ์ด',
          'หน้ารายละเอียดสถานที่ (#/venue/:id) — แสดงรูปภาพ Carousel พร้อมป้ายสิ่งอำนวยความสะดวก ปฏิทินเลือกวัน และแถบไทม์ไลน์ 24 ชั่วโมงคำนวณสัดส่วนเวลาจริง (BAR_MIN_PCT = 8%)',
        ],
      },
    ],
  },
  {
    v: '0.10.0',
    date: '2 ก.ย. 2569',
    groups: [
      {
        t: 'ใหม่',
        items: [
          'กระบวนการลงทะเบียนบุคลากรผ่าน LINE OA (#/register) — ฟอร์มลงทะเบียน 5 ช่อง พร้อม Combobox เชื่อมต่อกลุ่มสาระและตำแหน่งจากระบบกลาง',
          'หน้าจอแสดงสถานะคำขอลงทะเบียน (#/pending, #/rejected, #/blocked) — ติดตามสถานะคำขอ แสดงเหตุผลการปฏิเสธของเจ้าหน้าที่ และรองรับการแก้ไขข้อมูลเดิม',
          'หน้าจอเข้าสู่ระบบ (#/login) และหน้าจอเพิ่มเพื่อน Official Account (#/add-friend) พร้อม QR Code มาตรฐาน',
        ],
      },
    ],
  },
  {
    v: '0.9.0',
    date: '2 ก.ย. 2569',
    groups: [
      {
        t: 'ใหม่',
        items: [
          'ระบบ LIFF Shell และ Gatekeeper Engine — คัดกรองสิทธิ์ผู้ใช้งาน 12 สถานะอัตโนมัติ พร้อมระบบป้องกัน Deep Link ผิดสถานะ',
          'หน้าจอต้อนรับ Splash Screen การันตีเวลาแสดงผล 1500ms พร้อมแอนิเมชัน Smooth Scale/Fade',
          'หน้าจอแจ้งข้อผิดพลาด Gate Error (#/gate-error) และระบบ Visual Viewport (--vvh) รองรับคีย์บอร์ดมือถือ',
        ],
      },
    ],
  },
  {
    v: '0.8.0',
    date: '2 ก.ย. 2569',
    groups: [
      {
        t: 'ใหม่',
        items: [
          'ชุด Shared UI Components กลางสำหรับ Client Portal (ScreenHeader, Breadcrumbs, Dock, StatusCard, Combobox, Skeleton, Toast, Dropdown, EmptyState)',
          'ระบบทะเบียนไอคอนมาตรฐาน (vicon, licon, rxicon) และฟังก์ชันจัดรูปแบบวันที่และเวลาไทย พ.ศ.',
        ],
      },
      {
        t: 'ปรับปรุง',
        items: [
          'ปรับปรุงสีประจำระบบ Primary เป็นสี Emerald (#047857 ในธีมสว่าง / #34d399 ในธีมมืด) ตามมาตรฐาน WCAG AA',
        ],
      },
    ],
  },
  {
    /*
     * RELEASED 26 ส.ค. 2569, on the PO's word — `npm version minor` in the same breath as this
     * edit. It sat here inert while `package.json` read `0.6.0`, because the page renders
     * `RELEASES.filter(r => compareVersions(r.v, APP.version) <= 0)` and an unreleased entry shows
     * to nobody. That is the doctrine at the top of this file working as intended: notes are
     * written by whoever ships the work at the moment they finish it, not reconstructed from a diff
     * weeks later. The bump is the PO's call.
     *
     * ⚠️ THE DATE WAS CORRECTED WHEN THE RELEASE SLIPPED — it read `25 ส.ค.`, the day its last line
     * was written, and the bump happened on the 26th. `0.6.0` had to be moved the same way, by
     * three days. A release date is a fact about the release, written down when it happens and
     * never computed.
     *
     * `x`, because this release adds two PAGES.
     *
     * ⚠️ IT COVERS EVERY COMMIT SINCE THE `v0.6.0` TAG, NOT JUST THE ONE BEING WRITTEN. The first
     * draft of this entry covered only the two new pages, and two earlier commits were already
     * sitting past the tag — the menu change and the forms/keyboard work. A release note is written
     * per RELEASE, so `git log v0.6.0..HEAD` is the input, not the branch you happen to be on. The
     * PO caught this; the check costs one command and is worth running before every bump. It was
     * run again at the bump and caught the menu resequence below.
     *
     * ⚠️ WHAT IS DELIBERATELY ABSENT, all three by the same test — can the reader MEET a difference:
     *
     *  · the options screen now serving four tables instead of two. Largest change in the diff and
     *    completely invisible: the two personnel pages render byte-identically before and after
     *    (measured), so a note would describe work rather than a difference. Same test that kept
     *    the VIEWER fix out of `0.5.0`;
     *  · two repairs to สถานที่จัดกิจกรรม — a scroll box that was scrolling twice, and ปิดชั่วคราว
     *    rendered in the wrong theme colour. The page SHIPS IN THIS RELEASE, so nobody ever met
     *    either defect. Announcing a fix to something the reader has never seen is the same failure
     *    as announcing a feature nobody built;
     *  · the swapped glyphs on ตำแหน่งบุคลากร and การลงทะเบียน. A menu row is found by its Thai
     *    label, which did not change, and no action depends on the picture. The row's POSITION is
     *    different — that is how a returning operator finds it, which is why the resequence one
     *    line below DOES earn a note and the icons do not.
     */
    v: '0.7.0',
    date: '26 ส.ค. 2569',
    groups: [
      {
        t: 'ใหม่',
        items: [
          'หน้าประเภทสถานที่ — หมวดหมู่ที่ใช้จัดกลุ่มสถานที่จัดกิจกรรม เพิ่ม แก้ไข ลบ และค้นหาได้เอง · ติดตั้งมาพร้อมห้าประเภทตั้งต้น (หอประชุม ห้องประชุม โรงยิม ลานกิจกรรม สนามกีฬา) ซึ่งแก้ไขหรือลบได้ทั้งหมด',
          // ⚠️ THE EMPTY START IS STATED AS A DECISION, not left to be discovered. An operator who
          // opens a brand-new screen and finds nothing in it reports a bug; one who was told the
          // list is theirs to build starts typing. The reason is the true one (`Q18`).
          'หน้าสิ่งอำนวยความสะดวก — รายการสิ่งอำนวยความสะดวก เพิ่ม แก้ไข ลบ และค้นหาได้เอง · เริ่มจากรายการว่างโดยตั้งใจ เพราะของที่โรงเรียนมีจริงเป็นสิ่งที่เจ้าหน้าที่กรอกเอง ไม่ใช่สิ่งที่ระบบเดาให้',
          // ⚠️ THIS LINE USED TO END "…หน้านั้นยังอยู่ระหว่างการพัฒนา คอลัมน์จำนวนสถานที่จึงยังขึ้น 0
          // ทุกแถว", written when the count really was a hard-coded zero. The venues screen landed
          // in this same release and the count is real now, so the sentence had to change or the
          // changelog would be describing a version that never shipped. Both halves of an entry are
          // editable until the release goes out; what is not editable is shipping one that lies.
          'ทั้งสองหน้าเป็นรายการที่หน้าสถานที่จัดกิจกรรมเลือกใช้ · คอลัมน์จำนวนสถานที่นับจากของจริงแล้ว และขยับทันทีเมื่อเพิ่ม แก้ไข หรือลบสถานที่',
          'ทั้งสองหน้าเปิดได้เฉพาะผู้ดูแลระบบสูงสุดและเจ้าหน้าที่ดูแลระบบ · หัวหน้าฝ่ายจะไม่เห็นเมนูนี้',

          // ── สถานที่จัดกิจกรรม ──
          // The product's subject, so it gets more than one line — but each line still has to name
          // something an operator can MEET, not work that was done. "สร้างตาราง Venue" would be the
          // second kind and does not appear.
          'หน้าสถานที่จัดกิจกรรม — รายการสถานที่ทั้งหมดในรูปแบบการ์ดพร้อมรูปภาพ เพิ่ม แก้ไข ลบ ค้นหา และกรองตามประเภทหรือสถานะได้ · ปรับขนาดการ์ดได้สามระดับ และระบบจำค่าที่เลือกไว้',
          'ใส่รูปสถานที่ได้สูงสุด 10 รูปต่อแห่ง · กดที่รูปย่อยเพื่อเลือกว่ารูปไหนเป็นรูปปก ซึ่งเป็นรูปที่ผู้ใช้เห็นก่อนใน LINE · ระบบย่อรูปให้อัตโนมัติก่อนอัปโหลด',
          // ⚠️ NAMES THE ALTERNATIVE, because almost everybody reaching for ลบ means this instead.
          'ปิดสถานที่ชั่วคราวได้โดยไม่ต้องลบ · ต้องระบุเหตุผล และเหตุผลนั้นจะแสดงบนการ์ดและให้ผู้ใช้เห็นตอนเลือกสถานที่ · เปิดคืนเมื่อไรก็ได้ แล้วเหตุผลจะถูกล้างทิ้ง',
          // ⚠️ A RULE THE OPERATOR HAS TO FOLLOW, not a feature — and it is here rather than only in
          // the form because the form is read once and this page is read when somebody asks why.
          'หัวหน้าฝ่ายเปิดหน้านี้และดูข้อมูลได้ครบทุกช่อง แต่แก้ไขไม่ได้ · ⚠️ รูปที่อัปโหลดผู้ใช้ทุกคนเห็นใน LINE จึงควรเป็นภาพของตัวสถานที่ ไม่ควรมีบุคคลอยู่ในภาพ',
        ],
      },
      {
        t: 'ปรับปรุง',
        items: [
          // ⚠️ A REMOVAL, and the file's own test for one is "does it carry an action". This one
          // does not — the page never worked, so nobody loses a capability. It earns a line anyway
          // for a different reason: a menu row that vanishes with no explanation is a support
          // question, and this is the only place that answers it.
          //
          // ⚠️ THE SECOND HALF IS PHRASED AS A PLAN, NOT AS A FEATURE, on purpose. คำขอจองสถานที่
          // does NOT do this today — it is still a coming-soon card. Writing "ย้ายไปอยู่ในหน้าคำขอ
          // จองสถานที่แล้ว" would be the changelog announcing work nobody built, which is the one
          // failure this file exists to prevent.
          'เมนู “วันหยุด/วันปิดปรับปรุง” ถูกยกเลิก · งานที่ตั้งใจให้หน้านั้นทำ — เจ้าหน้าที่จองเองหรือล็อกวันเวลาของสถานที่ไว้ล่วงหน้า — จะไปอยู่ในหน้าคำขอจองสถานที่ ซึ่งยังอยู่ระหว่างการพัฒนา',
          // ⚠️ A LINE FOR A ROW THAT ONLY MOVED, and it earns one because an operator who has used
          // `0.6.0` finds this menu by position — the row is not gone, it is somewhere else, and
          // that is precisely the change most likely to be reported as "หาไม่เจอ". Says which row
          // moved and where to, then the reason, because the reason is the answer to "ทำไมย้าย".
          'เมนูหมวดการบริหารจัดการเรียงใหม่ — “การลงทะเบียน” ย้ายขึ้นมาเป็นลำดับที่สอง ถัดจาก “ประกาศและข่าวสาร” · เมนูอื่นเรียงเหมือนเดิมทุกอัน · คิวผู้รออนุมัติจึงอยู่เหนือหน้าการจอง เพราะผู้ใช้ที่ยังไม่ได้รับอนุมัติยื่นคำขอจองไม่ได้',
          // ⚠️ SAYS WHAT THE APP STOPPED DOING, not what the keyboard will now do — and the
          // difference is the whole reason this line is allowed to exist. Attribute presence was
          // measured in the DOM; real iOS/Android keyboard behaviour was NOT verified, because that
          // needs a device. "ไม่ปิดกั้นอีกต่อไป" is a claim about this app and is proven; "แนะนำคำ
          // ได้แล้ว" would be a claim about the phone, and it also depends on settings the operator
          // owns (prediction switched on, shortcuts actually configured).
          'ช่องกรอกข้อความบนมือถือ ไม่ปิดกั้นคำแนะนำคำและการแทนที่ข้อความของแป้นพิมพ์อีกต่อไป · ช่องอีเมล เบอร์โทรศัพท์ และรหัสผ่านยังปิดการแก้คำอัตโนมัติไว้เหมือนเดิม เพราะค่าในช่องเหล่านั้นไม่ใช่คำ',
        ],
      },
      {
        t: 'แก้ไข',
        items: [
          // The LIFF registration form is not the back-office, and it belongs here for the same
          // reason 0.6.0's LINE-card line did: the operator is who gets asked "ทำไมกรอกไม่ผ่าน".
          'หน้าลงทะเบียนผ่าน LINE เมื่อกดส่งโดยกรอกไม่ครบ จะพาเคอร์เซอร์ไปที่ช่องแรกที่ยังไม่ผ่านให้เลย จากเดิมที่ขึ้นข้อความเตือนไว้เฉย ๆ และผู้ใช้ต้องไล่หาเองว่าติดตรงไหน',
          // Nothing changed on screen — the message was always visible — so this is a line ONLY
          // because the people it affects genuinely meet it. Says the mechanism plainly rather than
          // claiming an improvement a sighted operator could look for and fail to find.
          'ข้อความเตือนใต้ช่อง “รหัสผ่านใหม่” ผูกกับช่องนั้นแล้ว โปรแกรมอ่านหน้าจอจึงอ่านให้ฟังเมื่อเลื่อนไปที่ช่อง จากเดิมที่ข้อความแสดงบนจอแต่ไม่ถูกอ่าน',
        ],
      },
    ],
  },
  {
    /*
     * RELEASED 22 ส.ค. 2569, on the PO's word. It sat here inert for three days with
     * `package.json` on `0.5.0` — the page renders
     * `RELEASES.filter(r => compareVersions(r.v, APP.version) <= 0)`, so an unreleased entry
     * shows to nobody. That is the doctrine at the top of this file working as intended, and it
     * is how `0.4.0` was written too: notes are authored by whoever ships the work, at the moment
     * they finish it, not reconstructed from a diff weeks later.
     *
     * ⚠️ THE DATE IS THE DAY IT SHIPPED, NOT THE DAY THE FIRST LINE WAS WRITTEN. It read
     * `19 ส.ค.` while the entry waited — the date the registration page landed — and three days of
     * work went in after that. A release date is a fact about the release; it is written down when
     * the release happens and never computed.
     *
     * `x`, because this release adds a PAGE.
     */
    v: '0.6.0',
    date: '22 ส.ค. 2569',
    groups: [
      {
        t: 'ใหม่',
        items: [
          'หน้าการลงทะเบียน — ผู้ที่เพิ่มเพื่อนและลงทะเบียนผ่าน LINE ทั้งหมด ค้นหาด้วยชื่อ ชื่อไลน์ ตำแหน่ง กลุ่ม/ฝ่าย หรือเบอร์โทรศัพท์ กรองตามสถานะ และเรียงตามวันที่ลงทะเบียนหรือชื่อได้ · ทุกบทบาทเปิดดูได้ แต่การอนุมัติและแก้ไขเป็นสิทธิ์ของผู้ดูแลระบบสูงสุดและเจ้าหน้าที่ดูแลระบบ',
          'ตรวจสอบผู้ลงทะเบียนทีละราย แล้วอนุมัติ ส่งคืนให้แก้ไข ระงับ หรือปลดระงับได้จากหน้าต่างเดียว · ผู้ใช้จะได้รับผลทาง LINE ทันที',
          'แก้ไขชื่อ–สกุล ตำแหน่ง กลุ่ม/ฝ่าย และเบอร์โทรศัพท์ของผู้ลงทะเบียนแทนผู้ใช้ได้ · ผู้ดูแลระบบสูงสุดเปลี่ยนสถานะได้โดยตรงเพิ่มอีกทางหนึ่ง',
          // The live half, described as what the operator SEES rather than as a technology.
          'รายการอัปเดตเองเมื่อมีคนลงทะเบียนเข้ามาหรือมีเจ้าหน้าที่คนอื่นดำเนินการ · แถวจะไม่ขยับเองระหว่างที่คุณกำลังอ่าน — ระบบจะขึ้นแถบบอกว่ามีอะไรใหม่ แล้วให้คุณกดโหลดเมื่อพร้อม',
          'เหตุผลที่เจ้าหน้าที่กรอกตอนส่งคืนหรือระงับ ถูกเก็บไว้กับบัญชีนั้นและอ่านย้อนหลังได้ในหน้าต่างตรวจสอบข้อมูล',
          'ตัวเลขบนเมนู “การลงทะเบียน” บอกจำนวนผู้ที่รออนุมัติจริง และขยับเองทันทีแม้คุณจะอยู่หน้าอื่น',
          // ⚠️ A ใหม่ line, not a แก้ไข one, and that is the same rule as the VIEWER fix in `0.5.0`:
          // this page has never shipped, so nobody has met the stale-name behaviour it repairs.
          // Stated with its timing rather than as "always current", because it is not — the name
          // catches up the next time that user opens the app or writes to the chat.
          'ชื่อและรูปโปรไฟล์ LINE ในรายการ ตามบัญชีจริงของผู้ใช้ · เปลี่ยนชื่อหรือรูปใน LINE แล้ว ระบบจะอัปเดตให้เองเมื่อผู้ใช้เปิดแอปหรือทักแชทเข้ามาครั้งถัดไป',
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
          // ⚠️ A LINE-side change in a back-office changelog, and it belongs here: the operator
          // presses อนุมัติ and this is what the person on the other end receives. Same test as
          // the "ผู้ใช้จะได้รับผลทาง LINE ทันที" line above.
          'ข้อความแจ้งผลที่ผู้ใช้ได้รับทาง LINE ทั้งสี่แบบ เปลี่ยนเป็นการ์ดที่มีแถบสีตามสถานะเดียวกับป้ายในหน้าการลงทะเบียน · เหตุผลการส่งคืนแยกเป็นกล่องของตัวเอง และการ์ดอนุมัติกับส่งคืนมีปุ่มเปิดแอปให้เลย',
          // ⚠️ CARRIES AN ACTION, which is the only reason a removal earns a line at all. Left
          // unsaid, the first person to notice would be a new follower getting silence.
          'ข้อความต้อนรับตอนผู้ใช้เพิ่มเพื่อน ย้ายไปใช้ “ข้อความทักทาย” ของ LINE Official Account โดยตรง แก้ข้อความได้เองจาก LINE OA Manager ไม่ต้องรอรอบอัปเดตระบบ · ⚠️ หากยังไม่เคยตั้งไว้ ผู้ที่เพิ่มเพื่อนใหม่จะไม่ได้รับข้อความต้อนรับ',
        ],
      },
      {
        t: 'แก้ไข',
        items: [
          // หน้าโปรไฟล์ shipped in `0.4.0`, so this is a repair to something operators have had for
          // two releases — the same test the login line above passes and the avatar-disc border did
          // not. Says what they can now do with their hands, not which library changed underneath.
          'กรอบครอปในหน้าต่างเปลี่ยนรูปโปรไฟล์ ย่อ–ขยายและเลื่อนได้อิสระด้วยการลากมุมหรือขอบอีกครั้ง จากเดิมที่กรอบถูกตรึงขนาดไว้และเลื่อนได้แต่ตัวรูป',
          // The confirm dialog shipped in `0.5.0` with เจ้าหน้าที่ระบบ, so an operator has already
          // met the dead button. Describes what pressing it does now, not the `disabled` prop that
          // came off.
          'หน้าต่างยืนยันที่ต้องกรอกเหตุผล (ส่งคืนเพื่อแก้ไข และระงับการใช้งาน) จะบอกให้กรอกเหตุผลและพาเคอร์เซอร์ไปที่ช่องให้ เมื่อกดยืนยันโดยยังไม่ได้กรอก จากเดิมที่ปุ่มถูกปิดไว้เงียบ ๆ โดยไม่บอกว่าติดตรงไหน',
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
