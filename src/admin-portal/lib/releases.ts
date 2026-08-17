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
 * The version train is `Q3`: `0.x.y`, one phase = one minor, `1.0.0` on the day the school starts
 * using it.
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
