/**
 * The client portal's release notes, rendered by `#/version` (prototype 1985–2074).
 *
 * They SHIP WITH THE BUNDLE — a static list in this repo, not a table an administrator edits — and
 * the same two properties the back-office copy relies on follow from that:
 *
 *  · you can never be shown notes for a version you are not running, because they arrive with the
 *    bundle that implements them;
 *  · when your bundle is stale, the newest release is genuinely missing from it, and the screen's
 *    agreement check says so out loud rather than quietly showing a shorter history.
 *
 * ── 🔴 THIS IS A SECOND, CLIENT-TARGETED CHANGELOG, NOT A COPY OF THE ADMIN ONE ──
 * `Q-C8` ruling 3 asks the *admin* list to summarise client releases from an operator's point of
 * view. The reverse is not true: a teacher opening `#/version` inside LINE has no use for
 * "ICU collation pinned on 7 tables". The two files therefore share a **version train** and a
 * **shape** (`ReleaseGroup` / `Release` / `RELEASES`, deliberately identical to
 * `admin-portal/lib/releases.ts`) and nothing else. Same numbers, different sentences.
 *
 * ⚠️⚠️ EVERY LINE BELOW MUST NAME SOMETHING A USER CAN MEET, AND THAT STILL EXISTS. A changelog is
 * the one place in a product that can announce a feature nobody built, and the reader has no way to
 * check — the row for it says "อยู่ระหว่างการพัฒนา" two taps away. That is why the history starts
 * at **`0.9.0`** and not earlier: Client Portal **v1 was deleted whole on 2 ก.ย. 2569** before v2
 * had a line of code (`01_plan_log.md` §3), so a note for `0.8.0` or below would describe screens
 * that no longer exist.
 *
 * ── 🔴 THE VERSION NUMBERS ARE NOT THIS FILE'S TO INVENT ──
 * `Q-C8`: version calculation follows the sizing rules (a new page or a large feature moves `x`),
 * but **bumping `package.json` and cutting a release are the PO's exclusive authority**. So an
 * entry may sit here describing work that is finished while the bundle still reports the previous
 * number — that is the doctrine working, not a mistake. `VersionPage` reads the running version
 * from `APP.version` and badges anything above it as **อยู่ระหว่างพัฒนา**, so the screen tells the
 * truth either way and needs no edit on the day the PO bumps it.
 */

/**
 * ⚠️ THREE GROUP NAMES, AS A UNION, AND NOT A `string`. Release notes read fine grouped under a
 * word; what they do not survive is a fourth word appearing in the tenth entry because whoever
 * wrote it reached for a synonym. The type is the only thing that stops that — nothing about a
 * typo'd heading looks wrong on screen. The three are the same three the back-office uses.
 */
export interface ReleaseGroup {
  t: 'ใหม่' | 'ปรับปรุง' | 'แก้ไข'
  items: readonly string[]
}

export interface Release {
  /** `x.y.z`, compared with `compareVersions` — never as a string. */
  v: string
  /** Thai Buddhist-era date, written down when the work landed. Never computed. */
  date: string
  groups: readonly ReleaseGroup[]
}

/** Newest first. `VersionPage` relies on that order and does not sort. */
export const RELEASES: readonly Release[] = [
  {
    v: '0.16.0',
    date: 'อยู่ระหว่างพัฒนา',
    groups: [
      {
        t: 'ใหม่',
        items: [
          'รับการแจ้งเตือนอัตโนมัติผ่าน LINE เมื่อคำขอจองได้รับการอนุมัติ ปฏิเสธ ยกเลิก หรือหมดเวลาพิจารณา',
          'รับการแจ้งเตือนเตือนความจำล่วงหน้า 1 ชั่วโมงหรือ 30 นาที ก่อนถึงเวลาเริ่มใช้งานสถานที่ที่ได้รับการอนุมัติ',
        ],
      },
      {
        t: 'ปรับปรุง',
        items: [
          'ระบบเคารพการตั้งค่าอย่างเคร่งครัด หากคุณปิดรับการแจ้งเตือนผลการพิจารณาหรือเตือนความจำในหน้าตั้งค่า ระบบจะไม่ส่งข้อความเหล่านั้นไปรบกวนทาง LINE',
        ],
      },
      {
        t: 'แก้ไข',
        items: [
          'ปุ่มเปิดแอปในการ์ดแจ้งเตือน LINE — แก้ไขปัญหาปุ่ม "ดูรายละเอียดคำขอจอง" พาไปหน้าแรก โดยเปลี่ยนลิงก์เป็นเส้นทางตรง (/booking/:id) พร้อมระบบส่งต่อลิงก์รุ่นเก่าให้อัตโนมัติและปลอดภัย',
          'การแสดงผลคำขอที่ใช้ซ้ำหลายวัน — ปรับการแสดงผลวันที่ในการ์ดแจ้งเตือน LINE ให้แจกแจงเป็นรายการวันที่อย่างชัดเจน พร้อมจำกัดความยาวข้อความพรีวิวไม่ให้เกินโควต้า 400 ตัวอักษรของ LINE',
          'หน้ารายละเอียดคำขอจองที่อนุมัติแล้ว (#/booking/:id) — ยกเลิกการแสดงกล่องข้อความเตือนให้แสดงหน้านี้ต่อเจ้าหน้าที่ดูแลอาคารก่อนเข้าใช้สถานที่',
        ],
      },
    ],
  },
  {
    /*
     * Phase 7a — the settings branch. `x`, because it adds PAGES (`Q-C8`'s sizing rule).
     *
     * ⚠️ THE NOTIFICATION LINE SAYS THE QUIET PART OUT LOUD, on purpose. Three switches now store
     * a real answer in a real table, and `LineService.push()` is still called from nowhere — so
     * nothing is sent yet, by anyone, for any reason (`CLIENT-NOTIFY-1`, `DECISIONS.md` `Q-C9`
     * "what this ruling does not fix"). A note that stopped at "choose which messages you get"
     * would be the changelog's first small lie, and the person who found out would find out by
     * waiting for a message that never came.
     */
    v: '0.15.0',
    date: '15 ก.ย. 2569',
    groups: [
      {
        t: 'ใหม่',
        items: [
          'หน้าตั้งค่า — ดูโปรไฟล์และสังกัดของตัวเอง เลือกโหมดสีของแอป ตั้งค่าการแจ้งเตือนผ่าน LINE และเข้าถึงคู่มือกับระเบียบการใช้สถานที่ได้จากที่เดียว',
          'เลือกโหมดสีได้สามแบบ — สว่าง มืด หรือให้ตามการตั้งค่าของเครื่อง · ระบบจำค่าที่เลือกไว้ให้ในเครื่องนี้',
          'เลือกเรื่องที่ต้องการให้ EasyBook ส่งข้อความหาทาง LINE ได้สามเรื่อง — ผลการพิจารณาคำขอ เตือนความจำก่อนถึงเวลาใช้งาน และประกาศข่าวสาร · ⚠️ ระบบยังไม่ได้เริ่มส่งข้อความแจ้งเตือนใด ๆ การตั้งค่านี้จึงเป็นการบันทึกความต้องการของคุณไว้ล่วงหน้า',
          'หน้าข้อมูลเวอร์ชันระบบ — บอกเวอร์ชันของแอปกับของเซิร์ฟเวอร์ เตือนเมื่อสองส่วนนี้ไม่ตรงกัน และแสดงประวัติการอัปเดตย้อนหลัง',
          'เพิ่มหน้าคู่มือการใช้งาน ระเบียบและข้อกำหนดการใช้สถานที่ และแจ้งปัญหาการใช้งาน เข้าถึงได้จากหน้าตั้งค่า · เนื้อหาของทั้งสามหน้ายังอยู่ระหว่างการพัฒนา',
          'หน้าแรก (#/home) — ปฏิทินภาพรวมการใช้งานสถานที่ของโรงเรียนในมุมมองสัปดาห์และเดือน พร้อมจุดแจ้งเตือนวันที่มีกิจกรรม, ตัวกรองค้นหาสถานที่และประเภท, และรายการกิจกรรมที่ได้รับอนุมัติแล้ว',
          'ระบบอัปเดตข้อมูลแบบเรียลไทม์ — ปฏิทินความพร้อมของสถานที่ ตารางกิจกรรมหน้าแรก และสถานะคำขอจอง อัปเดตทันทีเมื่อมีการเปลี่ยนแปลงโดยไม่ต้องกดรีเฟรชหน้าจอ',
          'หน้ารายการสถานที่และการจองของฉัน — เพิ่มระบบโหลดข้อมูลเพิ่มเติม (Load More) แบบแบ่งหน้า เพื่อให้แอปทำงานได้ลื่นไหล ประหยัดอินเทอร์เน็ต และรองรับข้อมูลปริมาณมากได้โดยไม่เสียตำแหน่งเดิมเมื่อเกิดการอัปเดตแบบเรียลไทม์',
        ],
      },
      {
        t: 'ปรับปรุง',
        items: [
          'หน้ารอการอนุมัติ (#/pending) — เพิ่มปุ่ม "ตรวจสอบสถานะล่าสุด" เพื่อให้ผู้ใช้สามารถกดตรวจสอบผลการอนุมัติสิทธิ์ได้ด้วยตนเองทันที โดยไม่ต้องปิดแล้วเปิดแอปใหม่',
          'แถบนำทางหลัก (Dock) — ปรับปรุงโครงสร้างเมนูแบบลอยให้รองรับ Responsive ทุกขนาดหน้าจอ แบ่งพื้นที่ 4 แท็บอย่างสมดุล (Fluid Responsive Grid) ใช้งานได้ราบรื่นทั้งบนมือถือจอเล็กและแท็บเล็ต โดยปุ่มไม่ล้นจอและข้อความไม่ตกบรรทัด',
          'หน้าแรก (#/home) — ปลดล็อกปุ่มเลื่อนสัปดาห์ (< และ >) ให้เลื่อนดูตารางกิจกรรมล่วงหน้าและย้อนหลังได้อิสระทั้งในมุมมองสัปดาห์และเดือน',
          'หน้ารายละเอียดสถานที่ (#/venue/:id) — ปรับปรุงตารางช่วงเวลาใช้งาน (Venue Slot Card) แสดงผลกระชับบนมือถือ พร้อมระบุระยะเวลาใช้งานในวงเล็บ และไอคอนนาฬิกาสีตามสถานะ',
          'การจัดวางปุ่มและหมายเหตุ — ย้ายหมายเหตุไปไว้ใต้ตารางช่วงเวลา และจัดกลุ่มปุ่มดำเนินการไว้ที่ด้านล่างของหน้าจอ ทั้งในหน้ารายละเอียดสถานที่, หน้ายื่นคำขอจอง, และหน้ารายละเอียดคำขอ',
          'การแสดงข้อมูลคำขอที่รอพิจารณา — แสดงชื่อกิจกรรมและชื่อผู้ขอใช้งานจริงในรายการที่รอพิจารณา พร้อมระบุ (ขอใช้ซ้อนได้)',
          'การแจ้งเตือนคำขอหมดเวลาพิจารณา — แสดงป้ายสถานะ "หมดเวลาพิจารณา" บนการ์ดคำขอและหน้ารายละเอียดคำขอ พร้อมระบุเหตุผลการหมดเวลาอัตโนมัติ และแสดงการแจ้งเตือนแบบเรียลไทม์ทันทีเมื่อคำขอเลยกำหนดเวลาเริ่มใช้งาน',
          'กล่องข้อมูลเวลาที่ขอใช้ (#/bookings) — ปรับปรุงหัวข้อแสดงจำนวนวันใช้ซ้ำให้เป็นแถวข้อมูลปกติพร้อมไอคอนลูกศรหมุนวน (Refresh) ขนาดและระยะตรงแนวเดียวกับแถวเวลาอย่างสมดุล',
          'แบบฟอร์มยื่นคำขอใช้สถานที่ (#/request/:id) — ปลดล็อกปุ่มยื่นคำขอให้สามารถกดได้ตลอดเวลา โดยหากข้อมูลไม่ครบถ้วนจะแสดงกรอบสีแดงพร้อมข้อความแจ้งเตือน และเลื่อนหน้าจอไปยังช่องที่ต้องกรอกให้อัตโนมัติ',
        ],
      },
      {
        t: 'แก้ไข',
        items: [
          'ช่องเลือกรายการตำแหน่งและกลุ่ม/ฝ่าย (#/register) — ปรับปรุงหน้าต่างตัวเลือกแบบ Bottom Sheet ให้กว้างเต็มหน้าจอและแนบชิดขอบล่างตามมาตรฐานมือถือสากล พร้อมเพิ่มแถบมือจับดึง (Grab Handle), แสดงแถบเลื่อน (Scrollbar), ตัดความสูงแถวที่ 6 เพื่อให้ผู้ใช้เห็นว่าเลื่อนดูต่อได้ชัดเจน และไม่เด้งแป้นพิมพ์ขึ้นมาบังหน้าจออัตโนมัติ',
          'ระยะห่างด้านล่างของหน้าจอหลัก — แก้ไขปัญหาระยะห่างซ้ำซ้อน (Double Padding) ที่ทำให้เกิดพื้นที่ว่างเปล่าขนาดใหญ่ด้านล่างหน้าจอ ให้ระยะขอบล่างพอดีกับแถบเมนูนำทาง (Dock) ทุกหน้าจออย่างเหมาะสม',
          'การแสดงผลบนหน้าจอมือถือ iOS — รองรับการแสดงผลเต็มหน้าจอจรดขอบ (Edge-to-Edge) แก้ไขปัญหาแถบเมนูนำทาง (Dock) และเงาฉากหลังลอยขึ้นมาค้างเหนือขอบจอด้านล่างเมื่อเปิดใช้งานผ่าน LINE บน iPhone',
          'การจัดการเซสชันหมดอายุ (LIFF Gate) — เพิ่มการตรวจจับข้อผิดพลาดเซสชันหมดอายุ (HTTP 401) ในระบบ LINE พร้อมหน้าจอแจ้งเตือนและปุ่ม "ปิดหน้าต่าง" ผ่าน LIFF SDK',
          'การเข้าสู่ระบบใหม่เมื่อเซสชันหมดอายุ — ปรับปรุงปุ่ม "ลองใหม่อีกครั้ง" ในหน้าเซสชันหมดอายุให้ล้างแคชเดิมก่อนเริ่มยืนยันตัวตนใหม่ ป้องกันการวนกลับมาหน้าเดิมในแอป LINE',
          'การแสดงผลป้ายสถานะ (Badge) — ปรับปรุงขนาดและระยะห่างของป้ายสถานะทั้งหมดในระบบให้กะทัดรัด มีเส้นขอบคมชัด และเว้นระยะห่างไอคอนถูกต้องตามต้นแบบ',
        ],
      },
    ],
  },
  {
    /*
     * ⚠️ ONE LINE ONLY, AND IT IS NOT THE BIGGEST THING IN THE RELEASE. `0.14.0` was mostly the
     * back-office's booking-request screens, which a teacher never opens and therefore cannot
     * meet. The font swap is the part that reached this app's screens, and it is the only part
     * that earns a sentence here.
     */
    v: '0.14.0',
    date: '7 ก.ย. 2569',
    groups: [
      {
        t: 'ปรับปรุง',
        items: [
          'เปลี่ยนฟอนต์ทั้งแอปเป็น Noto Sans Thai ซึ่งอ่านข้อความราชการและตัวเลขได้ชัดเจนกว่าเดิม',
        ],
      },
    ],
  },
  {
    v: '0.13.0',
    date: '3 ก.ย. 2569',
    groups: [
      {
        t: 'ใหม่',
        items: [
          'หน้าการจองของฉัน — ติดตามคำขอทั้งหมดของตัวเอง ค้นหาด้วยชื่อสถานที่ วัตถุประสงค์ หรือรหัสคำขอ และกรองตามสถานะได้',
          'ยกเลิกคำขอที่ยังรอพิจารณาได้ทั้งใบ และยกเลิกการจองที่อนุมัติแล้วเป็นรายวันได้ โดยไม่ต้องยกเลิกทั้งคำขอ',
        ],
      },
    ],
  },
  {
    v: '0.12.0',
    date: '3 ก.ย. 2569',
    groups: [
      {
        t: 'ใหม่',
        items: [
          'ยื่นคำขอจองสถานที่ได้เองตลอด 24 ชั่วโมง รองรับทั้งการใช้ต่อเนื่องครั้งเดียว และการใช้ซ้ำหลายวัน',
          'ตรวจความว่างของสถานที่ให้แบบสดขณะกรอกคำขอ และปิดปุ่มยื่นทันทีเมื่อช่วงเวลาที่เลือกถูกจองไปก่อน',
          'หน้าจอยืนยันการยื่นคำขอ แสดงรหัสคำขอสำหรับใช้อ้างอิงกับเจ้าหน้าที่',
        ],
      },
    ],
  },
  {
    v: '0.11.0',
    date: '2 ก.ย. 2569',
    groups: [
      {
        t: 'ใหม่',
        items: [
          'หน้ารายการสถานที่ — ค้นหา กรองตามประเภท เรียงลำดับ และสลับขนาดการ์ดได้',
          'หน้ารายละเอียดสถานที่ — รูปภาพ ความจุ สิ่งอำนวยความสะดวก ปฏิทินเลือกวัน และแถบเวลา 24 ชั่วโมงที่บอกว่าช่วงไหนว่างช่วงไหนไม่ว่าง',
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
          'ลงทะเบียนขอสิทธิ์ใช้งานผ่าน LINE ได้เอง โดยเลือกตำแหน่งและกลุ่ม/ฝ่ายจากรายการของโรงเรียน',
          'ติดตามสถานะคำขอลงทะเบียนของตัวเอง และแก้ไขข้อมูลส่งกลับได้เมื่อเจ้าหน้าที่ส่งคืนให้แก้',
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
          'เข้าสู่ระบบด้วยบัญชี LINE และเพิ่ม EasyBook เป็นเพื่อนเพื่อเริ่มใช้งาน',
          'ระบบพาไปยังหน้าที่ตรงกับสถานะของคุณให้เองตั้งแต่เปิดแอป และแจ้งให้ทราบเมื่อเชื่อมต่อ LINE หรือเซิร์ฟเวอร์ไม่ได้',
        ],
      },
    ],
  },
]
