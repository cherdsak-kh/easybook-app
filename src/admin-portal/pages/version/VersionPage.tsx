/**
 * ข้อมูลเวอร์ชันระบบ — the first of the 31 destinations to stop being a stand-in.
 *
 * The whole page follows from EasyBook being TWO independently released deployables, and from
 * only one of the two numbers needing a network call. `lib/version.ts` holds that asymmetry and
 * the reasoning behind it; this file is what the reader sees.
 *
 * Three cards, in the prototype's order and for its reasons:
 *  1. เวอร์ชันที่ใช้งานอยู่ — the number, once, large, because the most common reason anyone opens
 *     this page is that somebody asked "ใช้เวอร์ชันอะไร" over the phone.
 *  2. ประวัติการอัปเดต — the notes, shipped with the bundle (see `lib/releases.ts`).
 *  3. ข้อมูลสำหรับแจ้งปัญหา — the page's one action, and the reason it earns a menu row at all.
 *
 * ⚠️ WHAT THIS PAGE DELIBERATELY DOES NOT SHOW, all of it argued in the prototype's markup:
 * uptime (answers "when did you last restart?" to anyone who asks), a dependency inventory (a
 * shopping list for matching known holes to this build), a "ตรวจหาอัปเดต" button (nobody installs
 * this — it is hosted), and "คุณใช้เวอร์ชันล่าสุดแล้ว" (the bundle cannot know that; it knows what
 * IT is and what the server said, and neither is knowledge of the newest release that exists).
 *
 * ⚠️ EVERY ROLE GETS THE IDENTICAL SCREEN — a P3 acceptance criterion, and it holds because
 * nothing here branches on `SystemRole`. บทบาท appears in the diagnostic block as the reader's own
 * role, which is the reason the block carries it: "ทำไมฉันไม่เห็นเมนูนี้" is the most common
 * support question in a product with three roles.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { getSystemVersion, type SystemVersionResult } from '@/lib/api-client'
import { Skeleton } from '../../components/feedback/Skeleton'
import { Spinner } from '../../components/feedback/Spinner'
import { NavIcon } from '../../components/shell/nav-icons'
import { PageHeading } from '../../components/shell/PageHeading'
import { Btn } from '../../components/ui/Btn'
import { Card, CardBody, CardHead } from '../../components/ui/Card'
import { FieldRow, LinkRow } from '../../components/ui/FieldRow'
import { ROLE_LABEL } from '../../labels'
import { useAuth } from '../../lib/auth-context'
import { useCopy } from '../../lib/use-copy'
import { RELEASES, type Release } from '../../lib/releases'
import { APP, compareVersions, thaiStamp } from '../../lib/version'
import {
  ADMIN_PORTAL_ROUTES,
  urlOf,
  type AdminRoute,
  type AdminRouteLabel,
} from '../../routes'

/**
 * ⚠️ Typed as `AdminRouteLabel`, so renaming that menu row breaks the BUILD rather than quietly
 * removing the last row of this card — a `find` that misses returns `undefined`, and a row that
 * silently stops rendering is the kind of loss nobody files a bug for.
 */
const SUPPORT_LABEL: AdminRouteLabel = 'ติดต่อฝ่ายเทคนิค'

const GLYPH = {
  ok: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  warn: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  info: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z',
} as const

const REFRESH_ICON =
  'M16.023 9.348h4.992V4.356m0 4.992l-3.181-3.183a8.25 8.25 0 00-13.803 3.7M4.031 9.865v4.992m0 0h4.99m-4.99 0l3.181 3.183a8.25 8.25 0 0013.803-3.7'

const COPY_ICON =
  'M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184'

/**
 * TWO tones for FOUR outcomes, and the split is the point.
 *
 *  · amber — the versions DISAGREE. Something is wrong with the deployment and there is a remedy
 *    on screen.
 *  · slate — everything else, INCLUDING "ตรวจสอบไม่ได้". Failing to reach one endpoint is not
 *    evidence the product is broken; the reader is using it right now. Painting that amber makes
 *    an ordinary transient look like a defect they must act on, and by the day a real mismatch
 *    appears they will have learned to ignore the colour.
 */
const TONE = {
  slate: 'border-base-300 bg-base-200 text-base-content/80',
  amber: 'border-warning/35 bg-warning/10 text-warning',
} as const

/**
 * One release's heading line, built ONCE for both shapes.
 *
 * The open release and a folded one must not drift into different headings, which is exactly
 * what happens the moment a "compact" variant is written separately: the date moves, the pill
 * loses its colour, and nobody notices because the two are never on screen in the same state.
 */
function ReleaseHead({ release, folded }: { release: Release; folded: boolean }) {
  return (
    <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
      <h3 className="m-0 text-[16px] font-semibold leading-[1.45] text-base-content tabular-nums">
        เวอร์ชัน {release.v}
      </h3>
      <p className="m-0 text-[13px] text-base-content/70 tabular-nums">{release.date}</p>
      {/* Neutral pill, and the WORDS carry the meaning. `<Badge>`'s five tones are bound
          one-to-one to `AppAccess`; borrowing one here would import a meaning this page does
          not have. */}
      {release.v === APP.version && (
        <span className="inline-flex items-center rounded-full bg-base-content/8 px-2.5 py-1 text-[12px] font-medium text-base-content/70">
          เวอร์ชันที่คุณใช้อยู่
        </span>
      )}
      {/* ⚠️ A CLOSED ROW MUST ANSWER "is what I am looking for in here?" WITHOUT BEING OPENED.
          A version plus a date cannot: they are the identical shape for a release that added
          two whole screens and one that fixed a typo, so a reader hunting for when a feature
          arrived would have to open every row — which is the folding undone. The counts split
          those apart at a glance, and they are DERIVED from the list underneath, so the summary
          can never end up describing something the entry does not contain. */}
      {folded && (
        <p className="m-0 text-[13px] text-base-content/60">
          {release.groups.map((g) => `${g.t} ${g.items.length}`).join(' · ')}
        </p>
      )}
    </span>
  )
}

/**
 * One release's bullets, grouped under a WORD rather than tagged per line with a coloured chip.
 * Release notes read that way anyway, it says "ใหม่" once instead of eight times, and it invents
 * no third chip vocabulary in a portal where both existing ones already mean something specific.
 */
function ReleaseBody({ release, className = '' }: { release: Release; className?: string }) {
  return (
    <div className={`flex flex-col gap-3.5 ${className}`.trim()}>
      {release.groups.map((group) => (
        <div key={group.t}>
          <p className="m-0 text-[13px] font-semibold text-base-content/80">{group.t}</p>
          <ul className="m-0 mt-1.5 flex list-none flex-col gap-1.5 p-0">
            {group.items.map((item) => (
              <li
                key={item}
                className="flex gap-2.5 text-[14px] leading-[1.6] text-base-content/80"
              >
                <span
                  aria-hidden="true"
                  className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-base-content/30"
                />
                <span className="min-w-0">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function Glyph({ d, className }: { d: string; className: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

export function VersionPage({ route }: { route: AdminRoute }) {
  const { user } = useAuth()
  const copy = useCopy()

  const [pending, setPending] = useState(true)
  const [outcome, setOutcome] = useState<SystemVersionResult | null>(null)
  /** Hold the retry button through the check it started. See `check`. */
  const [holdRetry, setHoldRetry] = useState(false)

  const retryRef = useRef<HTMLButtonElement>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)
  const refocus = useRef(false)

  /**
   * `hold` is true ONLY when the reader pressed ตรวจสอบอีกครั้ง.
   *
   * ⚠️ A button must not vanish while it is the thing you just pressed — focus lands on `<body>`
   * and a keyboard user is dropped at the top of the document mid-task. So during a check the
   * button stays and goes busy instead. A check that starts because the route was ENTERED has no
   * button to preserve, which is why this is a parameter rather than always-on: inheriting the
   * previous state's buttons is how a disabled ตรวจสอบอีกครั้ง ends up sitting under a state that
   * never offered one.
   */
  const check = useCallback(async (hold: boolean) => {
    refocus.current = hold
    setHoldRetry(hold)
    setPending(true)
    const result = await getSystemVersion()
    setOutcome(result)
    setPending(false)
  }, [])

  useEffect(() => {
    void check(false)
  }, [check])

  /**
   * Put focus back where the reader left it.
   *
   * ⚠️ `disabled` BLURS the element it is set on, so keeping the button on screen is only half
   * the fix. And the retry button may be GONE by the time the check settles — that is the success
   * case, where the failure state it belonged to no longer exists. The prototype dropped focus on
   * `<body>` there; this lands it on the status line instead, which is both the answer to what
   * they just asked and already a live region.
   */
  useEffect(() => {
    if (pending || !refocus.current) return
    refocus.current = false
    ;(retryRef.current ?? statusRef.current)?.focus()
  }, [pending])

  const server = outcome?.ok ? outcome.value : null
  const failure = outcome && !outcome.ok ? outcome.reason : null
  // ⚠️ `releasedAt` from the endpoint is deliberately NOT rendered. The date beside the hero is
  // the APP's release date and comes from `RELEASES`; the server's build time answers a question
  // nobody on this screen asked, and two dates in one card invite reading one as the other.
  const drift = server ? compareVersions(APP.version, server.version) : null

  let tone: keyof typeof TONE = 'slate'
  let glyph: keyof typeof GLYPH = 'info'
  let message: string
  let showReload = false
  let showRetry = false

  if (pending) {
    message = 'กำลังตรวจสอบเวอร์ชันของเซิร์ฟเวอร์…'
    showRetry = holdRetry
  } else if (failure) {
    // 503 and a dead connection collapse to one LAYOUT but not one sentence: one of them is a
    // thing the reader can check for themselves, and telling them to report it would waste both
    // their time and the technician's.
    message =
      failure === 'net'
        ? 'ตรวจสอบเวอร์ชันของเซิร์ฟเวอร์ไม่ได้ เพราะเชื่อมต่ออินเทอร์เน็ตไม่ได้ในขณะนี้ · เวอร์ชันของหน้าเว็บด้านบนยังถูกต้อง เพราะอ่านจากไฟล์ที่โหลดไว้แล้ว'
        : 'ตรวจสอบเวอร์ชันของเซิร์ฟเวอร์ไม่ได้ในขณะนี้ · ส่วนอื่นของระบบยังใช้งานได้ตามปกติ หากใช้งานไม่ได้ด้วย โปรดแจ้งฝ่ายเทคนิคพร้อมข้อมูลด้านล่าง'
    showRetry = true
  } else if (drift === 0) {
    // Never "คุณใช้เวอร์ชันล่าสุดแล้ว". This states what was OBSERVED, and nothing here observed
    // the newest release that exists.
    glyph = 'ok'
    message = 'หน้าเว็บและเซิร์ฟเวอร์ใช้เวอร์ชันเดียวกัน'
  } else if (drift === -1) {
    tone = 'amber'
    glyph = 'warn'
    showReload = true
    message = `เบราว์เซอร์ของคุณยังใช้ไฟล์ของเวอร์ชัน ${APP.version} อยู่ ขณะที่เซิร์ฟเวอร์เป็นเวอร์ชัน ${server?.version ?? ''} · โหลดหน้าใหม่เพื่อรับไฟล์ล่าสุด แล้วลองอีกครั้ง`
  } else {
    tone = 'amber'
    glyph = 'warn'
    message = `เซิร์ฟเวอร์ยังเป็นเวอร์ชัน ${server?.version ?? ''} ขณะที่หน้าเว็บเป็นเวอร์ชัน ${APP.version} · บางอย่างอาจทำงานไม่ตรงกับที่หน้าจอแสดง โปรดแจ้งฝ่ายเทคนิคพร้อมข้อมูลด้านล่าง โดยคุณไม่ต้องแก้ไขอะไรเอง`
  }

  const heroDate = RELEASES.find((r) => r.v === APP.version)?.date
  const history = RELEASES.filter((r) => compareVersions(r.v, APP.version) <= 0)
  const behind = drift === -1

  /**
   * ⚠️ THREE server lines, not two. While a check is in flight this must NOT say "ตรวจสอบไม่ได้":
   * the block is copyable at every moment it is on screen, and someone who copies during the
   * round trip would paste a claim that the server was unreachable when nothing of the sort had
   * been observed. "No answer yet" and "no answer" are different facts.
   *
   * No name, no email, no phone. This string gets pasted into LINE groups and support tickets,
   * and none of the three helps anyone diagnose anything — whoever receives it already knows who
   * wrote to them. Screen size is a render-time snapshot; it changes when a check settles, which
   * is close enough for "does the layout break at their width".
   */
  const diagnostic = [
    'EasyBook · ข้อมูลเวอร์ชัน',
    `หน้าเว็บ: ${APP.version} (${APP.build})`,
    `เซิร์ฟเวอร์: ${
      server
        ? `${server.version} (${server.build})`
        : pending
          ? 'กำลังตรวจสอบ'
          : 'ตรวจสอบไม่ได้'
    }`,
    `บทบาท: ${user ? ROLE_LABEL[user.role] : '—'}`,
    `หน้าจอ: ${window.innerWidth} × ${window.innerHeight}`,
    `เบราว์เซอร์: ${navigator.userAgent}`,
    `เวลา: ${thaiStamp()}`,
  ].join('\n')

  // The block just changed, so a "คัดลอกแล้ว" still on the button would be a receipt for a
  // different string.
  const { reset } = copy
  useEffect(() => reset(), [diagnostic, reset])

  const support = ADMIN_PORTAL_ROUTES.find((r) => r.label === SUPPORT_LABEL)

  return (
    <div className="card-shell lg:overflow-y-auto">
      {/* The page's own sentence, not the menu's tooltip — see `PageHeading`'s `desc`. */}
      <PageHeading
        route={route}
        desc="เวอร์ชันที่คุณกำลังใช้งาน และสิ่งที่เปลี่ยนไปในแต่ละครั้งที่ระบบอัปเดต"
      />

      <div className="flex flex-col gap-4 pb-1">
        {/* ══ เวอร์ชันที่ใช้งานอยู่ ══ */}
        <Card>
          <CardHead
            title="เวอร์ชันที่ใช้งานอยู่"
            subtitle="ตัวเลขนี้คือสิ่งที่ควรแจ้งเมื่อรายงานปัญหา"
          />
          <CardBody>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <p className="m-0 text-[32px] font-semibold leading-[1.15] text-base-content sm:text-[40px]">
                <span className="text-[20px] font-normal text-base-content/60 sm:text-[24px]">
                  v
                </span>
                <span className="tabular-nums">{APP.version}</span>
              </p>
              {/* Omitted entirely when this bundle's version has no release note yet, rather
                  than invented. A date is exactly the kind of thing a reader quotes. */}
              {heroDate && (
                <p className="m-0 text-[14px] text-base-content/70">
                  เผยแพร่เมื่อ <span className="tabular-nums">{heroDate}</span>
                </p>
              )}
            </div>

            {/* The status line. Four shapes, one slot: agreement, each of the two disagreements,
                and "could not check". Its whole job is to turn two numbers into one sentence a
                non-technical reader can act on — so the ACTION lives inside it, not elsewhere on
                the page. */}
            <div
              className={`mt-4 flex items-start gap-2.5 rounded-control border px-3.5 py-3 text-[14px] leading-[1.55] ${TONE[tone]}`}
            >
              <Glyph d={GLYPH[glyph]} className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1">
                {/* `role="status"`, so flipping from "กำลังตรวจสอบ" to a result is announced.
                    Without it the two-phase render is silent for a screen-reader user, who
                    would be left on the first phase forever. */}
                <p ref={statusRef} tabIndex={-1} role="status" className="m-0 outline-none">
                  {message}
                </p>
                {(showReload || showRetry) && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {showReload && (
                      <Btn
                        className="px-3.5"
                        disabled={pending}
                        // A REAL reload. It is the actual remedy for a stale bundle, and a
                        // button labelled โหลดหน้าใหม่ that did anything else would be the one
                        // control on this page telling a lie about the system.
                        onClick={() => window.location.reload()}
                      >
                        <Glyph d={REFRESH_ICON} className="h-4.5 w-4.5 shrink-0" />
                        โหลดหน้าใหม่
                      </Btn>
                    )}
                    {showRetry && (
                      <Btn
                        ref={retryRef}
                        className="px-3.5"
                        disabled={pending}
                        aria-busy={pending || undefined}
                        // The busy wording goes to assistive tech, never to the visible label:
                        // swapping the label is what makes a button change width mid-click.
                        aria-label={pending ? 'กำลังตรวจสอบเวอร์ชันของเซิร์ฟเวอร์' : undefined}
                        onClick={() => void check(true)}
                      >
                        {pending ? (
                          <Spinner />
                        ) : (
                          <Glyph d={REFRESH_ICON} className="h-4.5 w-4.5 shrink-0" />
                        )}
                        ตรวจสอบอีกครั้ง
                      </Btn>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="pf-close mt-4">
              <FieldRow label="หน้าเว็บ">
                <span className="flex flex-wrap items-center gap-x-2">
                  <span className="tabular-nums">{APP.version}</span>
                  <span className="font-mono text-[13px] text-base-content/60">
                    build {APP.build}
                  </span>
                </span>
              </FieldRow>
              <FieldRow label="เซิร์ฟเวอร์">
                <span className="flex flex-wrap items-center gap-x-2">
                  {/* ⚠️ The skeleton is on THIS row only. The bundle's own version never loads —
                      it is compiled in — so a skeleton on the row above would be an animation
                      pretending to wait for something already known. */}
                  {pending ? (
                    <Skeleton variant="box" className="h-4 w-28" />
                  ) : server ? (
                    <>
                      <span className="tabular-nums">{server.version}</span>
                      <span className="font-mono text-[13px] text-base-content/60">
                        build {server.build}
                      </span>
                    </>
                  ) : (
                    <span className="text-base-content/60">ตรวจสอบไม่ได้</span>
                  )}
                </span>
              </FieldRow>
            </div>

            <p className="mt-4 rounded-control bg-base-200 px-3.5 py-3 text-[13px] leading-[1.55] text-base-content/80">
              ระบบแบ่งเป็นสองส่วนที่อัปเดตแยกกัน คือ{' '}
              <span className="font-medium text-base-content">หน้าเว็บ</span>{' '}
              ที่ทำงานอยู่ในเบราว์เซอร์ของคุณ และ{' '}
              <span className="font-medium text-base-content">เซิร์ฟเวอร์</span>{' '}
              ที่เก็บและประมวลผลข้อมูล · ตามปกติทั้งสองส่วนจะเป็นเวอร์ชันเดียวกัน
            </p>
          </CardBody>
        </Card>

        {/* ══ ประวัติการอัปเดต ══ */}
        <Card className="overflow-hidden">
          <CardHead
            title="ประวัติการอัปเดต"
            subtitle="สิ่งที่เปลี่ยนไปในแต่ละเวอร์ชัน ใหม่ล่าสุดอยู่บนสุด"
          />
          {/* The consequence of shipping the notes with the bundle, said out loud. Without this
              the history simply looks shorter than it is. */}
          {behind && (
            <p className="m-0 border-b border-warning/35 bg-warning/10 px-4 py-3 text-[13px] leading-[1.55] text-warning sm:px-5">
              รายการด้านล่างมาจากไฟล์เวอร์ชัน {APP.version} ที่เบราว์เซอร์ของคุณถืออยู่
              จึงยังไม่มีสิ่งที่เปลี่ยนไปในเวอร์ชัน {server?.version} · โหลดหน้าใหม่เพื่อดูรายการล่าสุด
            </p>
          )}
          {/* ⚠️ THE NEWEST RELEASE IS OPEN; EVERY OLDER ONE IS ITS OWN `<details>`.
              (PO instruction, 18 ส.ค. 2569 — designed in the prototype first.)

              This list only grows. Rendering all of it expanded reads well at the handful of
              entries it was built against and becomes a wall once a real product accumulates
              history — and a wall here pushes ข้อมูลสำหรับแจ้งปัญหา, the page's only ACTION, off
              the bottom. Measured in the prototype at a 30-release history: 2250px folded
              against 5511px expanded, roughly six viewports of changelog.

              Rejected: one "ดูเพิ่มเติม" fold over everything older (trades one wall for one
              button and still leaves you scrolling the wall once you press it), and pagination
              (this portal's `Pagination` is for TABLES, where the reader wants row 400 — nobody
              asks for page 3 of a changelog, they ask when X arrived).

              Accepted cost, stated here rather than discovered later: **Ctrl+F does not reach
              closed content.** The derived group counts in each closed head are what keep the
              list scannable in exchange.

              Uncontrolled `<details>`, deliberately — no React state. The open/closed state is
              the browser's, it is keyboard-operable for free, and `details[open] .chev` in
              `admin-portal.css` rotates the chevron without anything re-rendering. */}
          <div>
            {history.map((release, i) =>
              i === 0 ? (
                <section
                  key={release.v}
                  className="border-t border-base-300/60 px-4 py-4 first:border-t-0 sm:px-5 sm:py-5"
                >
                  <div className="flex items-center gap-3">
                    <ReleaseHead release={release} folded={false} />
                  </div>
                  <ReleaseBody release={release} className="mt-3" />
                </section>
              ) : (
                <details key={release.v} className="border-t border-base-300/60">
                  {/* `min-h-11` — 44px, the target every other row in this portal is measured
                      against. A summary is a real control and gets the real size. */}
                  <summary className="flex min-h-11 cursor-pointer items-center gap-3 px-4 py-4 transition-colors hover:bg-base-content/5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary sm:px-5 sm:py-5">
                    <ReleaseHead release={release} folded />
                    <span aria-hidden="true" className="shrink-0">
                      <svg
                        className="chev h-4 w-4 text-base-content/40"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </summary>
                  <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                    <ReleaseBody release={release} />
                  </div>
                </details>
              ),
            )}
          </div>
        </Card>

        {/* ══ ข้อมูลสำหรับแจ้งปัญหา ══
            The page's one action, and the reason a version page earns a menu row at all: it
            turns "ระบบมีปัญหา" into a report somebody can work from. Quietest card, last
            position.

            The block is UGLY ON PURPOSE. It carries the raw user-agent string, which no design
            would show a school administrator except here — a parsed one lies (every browser
            claims to be several others) and the technician reading the report wants the real
            thing. Framing it as technical data in a monospace box is what makes that ugliness
            legible rather than sloppy. */}
        <Card className="overflow-hidden">
          <CardHead
            title="ข้อมูลสำหรับแจ้งปัญหา"
            subtitle="คัดลอกข้อความด้านล่างแนบไปกับการแจ้งปัญหา จะช่วยให้ตรวจสอบได้เร็วขึ้น"
          />
          <CardBody>
            <pre
              ref={copy.ref as React.Ref<HTMLPreElement>}
              className="m-0 max-h-64 select-all overflow-auto whitespace-pre-wrap break-words rounded-control border border-base-300 bg-base-200 px-3.5 py-3 font-mono text-[12px] leading-[1.7] text-base-content/80"
            >
              {diagnostic}
            </pre>
            <div className="mt-3">
              <Btn className="w-full px-3.5 sm:w-auto" onClick={() => void copy.copy()}>
                <Glyph d={COPY_ICON} className="h-5 w-5 shrink-0" />
                {copy.state === 'copied' ? 'คัดลอกแล้ว' : 'คัดลอกข้อมูล'}
              </Btn>
            </div>
            {/* Always in the DOM, never conditionally rendered: a live region created at the same
                moment as its text is not announced. Measured in the prototype — `writeText`
                exists here and still rejects, so a silent copy button would have shipped. */}
            <p
              role="status"
              className="m-0 mt-1.5 min-h-[19px] text-[13px] leading-[1.45] text-base-content/70"
            >
              {copy.announcement}
            </p>
          </CardBody>
          {support && (
            <div className="border-t border-base-300">
              <LinkRow
                to={urlOf(support)}
                icon={<NavIcon label={SUPPORT_LABEL} className="h-4.5 w-4.5" />}
                title={support.label}
                detail={support.desc}
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
