/**
 * โปรไฟล์ — the second of the 31 destinations to stop being a stand-in, and the first one shaped
 * entirely by a DTO.
 *
 * ── THE ONE FACT THAT SHAPES THE WHOLE PAGE ──
 * `UpdateOwnProfileDto` has EXACTLY ONE field, `profilePictureUrl`. `email`, `role`,
 * `departmentId`, `personnelRoleId`, `phoneNumber`, `firstName`, `lastName`, `isActive`,
 * `password` and `lineUserId` are ABSENT, and that absence IS the enforcement —
 * `forbidNonWhitelisted: true` answers 400 to any of them at the pipe. The project rule behind it
 * (11 ส.ค. 2569): the owner may not change anything in `system_users` that the creating admin set.
 *
 * So this cannot be one form. One field is yours; the rest are a SUPER_ADMIN's, forever, from this
 * screen. Putting both in one card would invite an operator to try editing an email that will
 * never accept an edit. Hence card 1 = who you are (and the avatar, the one thing you may change),
 * card 2 = what only a SUPER_ADMIN may change and who to ask, card 3 = the things that are not
 * fields at all, card 4 = the audit trail.
 *
 * ── role vs personnelRole ──
 * Card 2 is the ONE screen where both appear together, so it is the one screen that can blur them.
 * `role` (SystemRole) is the only thing that grants privilege; `personnelRole` is an
 * admin-curated job title that grants zero, and the schema says in as many words that any code
 * comparing them is a privilege-escalation bug. They are therefore labelled สิทธิ์การใช้งานระบบ
 * and ตำแหน่ง — never both as "บทบาท" — and only `role` is rendered as a badge, because only
 * `role` is a permission.
 *
 * ── What is deliberately NOT here ──
 *  · `isActive` — a suspended user cannot hold a session, so on your own profile it is the
 *    constant `true`. A field that can only ever say one thing is noise.
 *  · `mustChangePassword` — same: the gate 403s this route, so reaching this page proves it false.
 *  · `lineUserId` — read-only and "set by a future endpoint". A row for a link nobody can make
 *    advertises a feature that is not there.
 *  · a password field — `POST /auth/system/password` needs the CURRENT password and is its own
 *    screen. Card 3 links to it.
 *
 * ⚠️ THE ROLE IS SUPER_ADMIN-ONLY (project, 12 ส.ค. 2569), in both places it appears. The RBAC
 * enum is an implementation fact about the SYSTEM, not about the person, and showing it to the
 * person it constrains invites exactly the reading the schema forbids. This is presentation and
 * only presentation — `@Roles` on the server governs every gate regardless.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { thaiDate, thaiDateTime, NO_VALUE } from '../lib/thai-date'
import { ROLE_LABEL } from '../labels'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { Card, CardHead } from '../components/ui/Card'
import { FieldRow, LinkRow } from '../components/ui/FieldRow'
import { NavIcon } from '../components/shell/nav-icons'
import { PageHeading } from '../components/shell/PageHeading'
import { AvatarModal } from './profile/AvatarModal'
import { routeOf, urlOf, type AdminRoute, type AdminRouteLabel } from '../routes'

/**
 * The four rows of การตั้งค่าของฉัน, BY LABEL — the same keys the route table uses, and typed, so
 * renaming a menu row breaks the build rather than silently emptying this card.
 */
const MINE: readonly AdminRouteLabel[] = [
  'เปลี่ยนรหัสผ่าน',
  'ตั้งค่าการแจ้งเตือน',
  'ความเป็นส่วนตัว',
  'ประวัติการเข้าสู่ระบบ',
]

/**
 * Three of the four rows say exactly what the menu says, so they read their subtitle straight off
 * the route table and cannot drift from it. เปลี่ยนรหัสผ่าน is the one override, and the prototype
 * is deliberate about it: the menu answers "what is this page" ("ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ")
 * while this card is a list of what you may change — where the fact worth knowing before you press
 * is the extra step waiting on the other side.
 */
const MINE_DESC: Partial<Record<AdminRouteLabel, string>> = {
  เปลี่ยนรหัสผ่าน: 'ต้องกรอกรหัสผ่านปัจจุบันเพื่อยืนยันตัวตน',
}

/** เจ้าหน้าที่ระบบ — where a SUPER_ADMIN's own row actually lives. See `ManageAccount` below. */
const STAFF_LABEL: AdminRouteLabel = 'เจ้าหน้าที่ระบบ'

function MetaIcon({ d }: { d: string }) {
  return (
    <svg
      aria-hidden="true"
      className="pf-meta-ico"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

const META = {
  mail: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75',
  phone:
    'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z',
  calendar:
    'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  camera:
    'M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316zM16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z',
  lock: 'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z',
  pencil:
    'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z',
} as const

export function ProfilePage({ route }: { route: AdminRoute }) {
  // Non-null by construction: the shell renders only while authenticated.
  const { user, refresh } = useAuth()
  const me = user!
  const [avatarOpen, setAvatarOpen] = useState(false)

  const isSuper = me.role === 'SUPER_ADMIN'
  const fullName = [me.firstName, me.lastName].filter(Boolean).join(' ').trim() || me.email
  const creator = me.createdBy
    ? [me.createdBy.firstName, me.createdBy.lastName].filter(Boolean).join(' ').trim()
    : null

  const staff = routeOf(STAFF_LABEL)

  return (
    <div className="card-shell lg:overflow-y-auto">
      {/* The page's own sentence, not the menu's tooltip — see `PageHeading`'s `desc`. */}
      <PageHeading route={route} desc="ข้อมูลบัญชีของคุณ และการตั้งค่าที่คุณปรับเองได้" />

      <div className="flex flex-col gap-4 pb-1">
        {/* ══ IDENTITY HEADER ══
            The social-profile shape — cover band, circular avatar breaking out of it, name, role,
            meta row. Not styling for its own sake: on a page where every field is locked, the
            avatar is the ONE thing the owner may change, and this layout makes it the single
            largest, most obviously interactive object on screen. A form-shaped page would have
            promised the opposite.

            The cover's colour comes from `data-acl` on the shell wrapper (super ชมพู · admin เขียว
            · viewer ฟ้า), so it is a consequence of the session rather than a fourth place that
            has to be told who is signed in. */}
        <section className="pf-card overflow-hidden">
          <div className="pf-cover h-24 w-full sm:h-32" aria-hidden="true" />

          <div className="px-4 pb-5 sm:px-6">
            {/* `-mt-12`/`-mt-14` is half the avatar height, so the circle sits exactly on the
                cover's lower edge at both sizes rather than drifting as the avatar grows at `sm`. */}
            <div className="-mt-12 sm:-mt-14">
              {/* ⚠️ THE WHOLE AVATAR IS THE BUTTON, not the badge — the target is 112px rather
                  than 40px, which is what let the badge shrink to an indicator that says "this
                  picture is editable" instead of having to be a tap target itself.

                  ⚠️ NO `data-tip` ANYWHERE IN HERE, and that is not a style preference:
                  `[data-tip] { position: relative }` is an UNLAYERED rule, so it beats `.pf-cam`'s
                  `absolute` from `@layer components` whatever the specificity. With a tooltip
                  attached the badge drops out of the corner and stacks BELOW the avatar — measured
                  in the prototype at 152px instead of 112. A tooltip and absolute positioning
                  cannot both apply to one element under this stylesheet. */}
              <button
                type="button"
                className="pf-ava-btn"
                aria-label="เปลี่ยนรูปโปรไฟล์"
                aria-haspopup="dialog"
                onClick={() => setAvatarOpen(true)}
              >
                {/* `chrome=""` — `.pf-ava` brings its own `border-4 border-base-100`, the ring that
                    lifts the circle off the cover. `Avatar`'s default hairline would win the
                    cascade and quietly flatten it. */}
                <Avatar
                  src={me.profilePictureUrl}
                  name={fullName}
                  chrome=""
                  backdrop=""
                  className="pf-ava text-[32px]"
                />
                <span className="pf-cam" aria-hidden="true">
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={META.camera} />
                  </svg>
                </span>
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
              <div className="min-w-0">
                <h2 className="m-0 text-[20px] font-semibold leading-[1.35] text-base-content sm:text-[24px]">
                  {fullName}
                </h2>
                {/* The "bio" line: job title and department. Both are locked fields, shown here
                    because a profile that does not say who you are in the organisation is not a
                    profile. */}
                <p className="m-0 mt-1 text-[14px] leading-[1.45] text-base-content/70">
                  {me.personnelRole.name} · {me.department.name}
                </p>
              </div>
              {/* ⚠️ SUPER_ADMIN ONLY. For everyone else the badge is gone and the line above it —
                  ตำแหน่ง · กลุ่ม/ฝ่าย — is the whole answer to "who am I here". It is deliberately
                  NOT swapped to show the position instead: that string already sits 20px to its
                  left, so the header would print the same words twice.

                  `slate`, because green already means ALLOWED in this product. */}
              {isSuper && (
                <Badge tone="slate" className="mt-1 shrink-0">
                  {ROLE_LABEL[me.role]}
                </Badge>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-base-300 pt-4">
              <span className="pf-meta">
                <MetaIcon d={META.mail} />
                <span className="truncate">{me.email}</span>
              </span>
              {/* ⚠️ OMITTED rather than dashed when there is none. `phoneNumber` is nullable, and
                  the account card below already states the absence in a labelled row where "—" is
                  readable as an answer. A lone "—" beside a telephone glyph in a row of facts is
                  not an answer; it is a fact that failed to render. */}
              {me.phoneNumber && (
                <span className="pf-meta">
                  <MetaIcon d={META.phone} />
                  <span className="tabular-nums">{me.phoneNumber}</span>
                </span>
              )}
              <span className="pf-meta">
                <MetaIcon d={META.calendar} />
                <span>เข้าร่วมเมื่อ {thaiDate(me.createdAt)}</span>
              </span>
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* ══ ข้อมูลบัญชี — ล็อกทั้งใบ ══
              `CreateSystemUserDto` sets email, firstName, lastName, role, departmentId,
              personnelRoleId and phoneNumber — so all seven are read-only here, permanently, for
              everyone including a SUPER_ADMIN looking at their own profile. The backend agrees:
              `UpdateOwnProfileDto` was cut to `profilePictureUrl` alone on 16 ส.ค. 2569, so the
              padlock is not decorative — there is no route that would accept the edit. */}
          <Card>
            <CardHead
              title="ข้อมูลบัญชี"
              subtitle="ผู้ดูแลระบบสูงสุดเป็นผู้กำหนดตอนสร้างบัญชี"
              action={isSuper ? <ManageAccount to={staff ? urlOf(staff) : undefined} /> : <Lock />}
            />
            <div className="pf-body">
              <div className="pf-close">
                <FieldRow label="ชื่อ–สกุล">{fullName}</FieldRow>
                <FieldRow label="อีเมล">
                  <span className="break-all">{me.email}</span>
                </FieldRow>
                {/* `—` for an empty phone rather than a blank cell: `phoneNumber` is nullable and
                    "nobody recorded one" is a fact, while an empty row reads as a rendering
                    failure. */}
                <FieldRow label="เบอร์โทรศัพท์">
                  <span className="tabular-nums">{me.phoneNumber || NO_VALUE}</span>
                </FieldRow>
                {/* ⚠️ THE ROLE ROW IS REMOVED FOR EVERYONE ELSE, not blanked. A
                    "สิทธิ์การใช้งานระบบ" label with an empty value is a stronger hint that
                    something is being withheld than the value itself would have been. */}
                {isSuper && (
                  <FieldRow label="สิทธิ์การใช้งานระบบ">
                    <Badge tone="slate">{ROLE_LABEL[me.role]}</Badge>
                  </FieldRow>
                )}
                <FieldRow label="ตำแหน่ง">{me.personnelRole.name}</FieldRow>
                <FieldRow label="กลุ่ม/ฝ่าย">{me.department.name}</FieldRow>
              </div>

              {/* A lock without a key is a dead end. `createdBy` is the whole reason this line can
                  name someone instead of the useless "ติดต่อผู้ดูแลระบบ".

                  A SUPER_ADMIN gets the other sentence: they hold the button above, so telling
                  them to contact somebody about their own surname would be the card sending them
                  on an errand it just offered to run. What it says instead is where the line
                  actually falls. */}
              <p className="mt-4 rounded-control bg-base-200 px-3.5 py-3 text-[13px] leading-[1.55] text-base-content/80">
                {isSuper ? (
                  <>
                    แก้ไขชื่อ–สกุล ตำแหน่ง กลุ่ม/ฝ่าย และเบอร์โทรศัพท์ของตัวเองได้ที่ปุ่ม{' '}
                    <span className="font-medium text-base-content">จัดการบัญชี</span> ด้านบน ·
                    ส่วนอีเมล บทบาท และสถานะ แก้เองไม่ได้ทุกกรณี ต้องให้ผู้ดูแลระบบสูงสุดรายอื่นเป็นผู้ทำ
                  </>
                ) : creator ? (
                  <>
                    หากข้อมูลไม่ถูกต้อง โปรดติดต่อ{' '}
                    <span className="font-medium text-base-content">{creator}</span> ผู้สร้างบัญชีนี้
                  </>
                ) : (
                  // `createdBy` is null only for the seeded first SUPER_ADMIN — who never reaches
                  // this branch — but the field is nullable in the contract, so the sentence has to
                  // survive it. Naming nobody beats naming a blank.
                  <>หากข้อมูลไม่ถูกต้อง โปรดติดต่อผู้ดูแลระบบสูงสุด</>
                )}
              </p>
            </div>
          </Card>

          {/* ══ การตั้งค่าของฉัน ══
              The other half of the rule: what the creating admin did NOT set is yours. The temp
              password is replaced by you, and the notification and privacy preferences do not live
              in `system_users` at all. Every one of them is its own screen with its own endpoint,
              so this card links rather than inlines. */}
          <Card className="overflow-hidden">
            <CardHead title="การตั้งค่าของฉัน" subtitle="ส่วนที่คุณปรับเองได้อย่างอิสระ" />
            {/* `pf-close` matters more here than on the two lists of fields: at `lg` these two
                cards sit side by side and the grid stretches this one to match ข้อมูลบัญชี, so its
                last row was measured ending 126px above the card's own bottom edge — a list that
                simply stops in the middle of a tall box. The stretch stays; ragged card bottoms in
                a two-column layout look worse than empty space under a closed list. */}
            <div className="pf-close divide-y divide-base-300/60">
              {MINE.map((label) => {
                const target = routeOf(label)
                if (!target) return null
                return (
                  <LinkRow
                    key={label}
                    to={urlOf(target)}
                    icon={<NavIcon label={label} className="h-4.5 w-4.5" />}
                    title={label}
                    detail={MINE_DESC[label] ?? target.desc}
                  />
                )
              })}
            </div>
          </Card>
        </div>

        {/* ══ ประวัติการใช้งานระบบ ══
            Last and quietest: this is what you quote when something looks wrong, not what you read
            daily.

            ⚠️ Two columns, so `:last-child` is the bottom-RIGHT cell — which is why the closing
            rule is `.pf-card .pf-close > :last-child` and not `last:border-0` on the row. The
            bottom-LEFT cell is the third child and keeps its own rule the whole time; without the
            override the card closes with half a line across its bottom. */}
        <Card>
          <CardHead title="ประวัติการใช้งานระบบ" />
          <div className="pf-body">
            <div className="pf-close grid gap-x-8 sm:grid-cols-2">
              <FieldRow label="ผู้สร้างบัญชี">{creator ?? NO_VALUE}</FieldRow>
              <FieldRow label="วันที่สร้าง">
                <span className="tabular-nums">{thaiDateTime(me.createdAt)}</span>
              </FieldRow>
              <FieldRow label="อัปเดตล่าสุด">
                <span className="tabular-nums">{thaiDateTime(me.updatedAt)}</span>
              </FieldRow>
              <FieldRow label="เข้าสู่ระบบล่าสุด">
                <span className="tabular-nums">{thaiDateTime(me.lastLoginAt)}</span>
              </FieldRow>
            </div>
          </div>
        </Card>
      </div>

      <AvatarModal
        open={avatarOpen}
        onClose={() => setAvatarOpen(false)}
        hasPicture={Boolean(me.profilePictureUrl)}
        // Re-read `/me` rather than trusting the response body: the session is the ONE record the
        // header, the account card and the sidebar identity card all render from, so there is
        // never a moment where two of them disagree about the picture.
        onDone={refresh}
      />
    </div>
  )
}

/**
 * The padlock chip — once, on the card head, not an icon repeated on all six rows. Six locks say
 * the same thing six times and turn into wallpaper; one says it where the eye lands before it
 * reads any value.
 */
function Lock() {
  return (
    <span className="pf-lock">
      <svg
        aria-hidden="true"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={META.lock} />
      </svg>
      แก้ไขไม่ได้
    </span>
  )
}

/**
 * What a SUPER_ADMIN gets instead of the padlock (PO, 15 ส.ค. 2569).
 *
 * "แก้ไขไม่ได้" was a fact about the whole product until a SUPER_ADMIN could manage their own row
 * on เจ้าหน้าที่ระบบ. For them the padlock is now simply wrong: these fields ARE editable, just not
 * from this card. A lock that lies is worse than no lock, because the next thing the reader learns
 * is that the screen does not know what it is talking about. A pill reading "จัดการบัญชี" that did
 * nothing would be the same lie wearing a different word.
 *
 * ⚠️ HIDING THIS BUTTON HAS NEVER BEEN THE BOUNDARY. The four self-mutation rules are enforced in
 * `system-users.policy.ts`, inside the write transaction, and again by `@Roles`. This is UX.
 *
 * ⚠️ IT NAVIGATES, AND THE PROTOTYPE'S DESIGN IS THAT IT DOES NOT. There it opens เจ้าหน้าที่ระบบ's
 * manage dialog in place — a `<dialog>` is top-level, so it sits over whatever route is showing,
 * and coming back to the profile is the reason somebody started here. That dialog is owned by a
 * page P4 has not ported yet, and the alternatives were both worse: a dead button, or leaving the
 * padlock up and telling a SUPER_ADMIN to contact themselves. Sending them to the page where the
 * capability actually lives is the portal's existing convention for a destination that is designed
 * but not built.
 *
 * WHEN เจ้าหน้าที่ระบบ LANDS: drop `to`, take an `onClick` that opens the dialog on this operator's
 * own row through the SAME `openEdit` the pencil calls — never a second path into it, or two doors
 * end up enforcing two different rules.
 */
function ManageAccount({ to }: { to: string | undefined }) {
  const className =
    'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-control border border-base-content/20 bg-base-100 px-3 text-[13px] font-medium text-base-content/80 transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
  const inside = (
    <>
      <svg
        aria-hidden="true"
        className="h-4 w-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={META.pencil} />
      </svg>
      จัดการบัญชี
    </>
  )
  // No route means no destination, and a `<button>` that goes nowhere is the dead control this
  // whole card exists to avoid — so fall back to the padlock's honesty and render nothing.
  if (!to) return null
  // The router's `<Link>`, not a bare `<a href>`: a plain anchor to an in-app URL is a full page
  // reload — it throws away the session probe, the theme decision and the scroll position, and
  // takes about a second to arrive somewhere the router reaches instantly.
  return (
    <Link to={to} className={className}>
      {inside}
    </Link>
  )
}
