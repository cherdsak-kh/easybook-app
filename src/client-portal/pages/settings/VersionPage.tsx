import { useEffect, useState } from 'react'
import { fetchServerVersion, messageFor } from './settings-api'
import { SCREEN_WIDTH, ScreenHeader } from '@/client-portal/components/ui/ScreenHeader'
import { LIcon } from '@/client-portal/icons/LucideIcon'
import type { LIconName } from '@/client-portal/icons/licon'
import { RELEASES, type Release, type ReleaseGroup } from '@/client-portal/lib/releases'
import { APP, compareVersions } from '@/client-portal/lib/version'

/**
 * `#/version` — this bundle's number, whether the server agrees with it, and what changed.
 * Prototype 1949–2078.
 *
 * ── 🔴 THE TWO NUMBERS COME FROM TWO PLACES, WHICH IS THE WHOLE POINT OF THE SCREEN ──
 * The prototype writes `v1.0.0` twice as a literal and says so itself at 1927: *"port it from build
 * info and the API, which is where 'do they match' can actually be answered — not from two
 * constants in one file that always agree"*. So the web half is `APP.version` (compiled in by Vite)
 * and the API half is `GET /line-users/version` (`NEEDS_DESIGN.md` §3, built in 7a's backend half).
 *
 * ── ⚠️ AN UNREACHABLE SERVER IS A STATE, NOT AN ERROR SCREEN ──
 * It is one of the answers this page exists to give, and it is exactly the moment the reader most
 * needs the rest of the page — the release notes ship with the bundle and stay readable offline.
 * The alert therefore has FOUR shapes, not two, and the failing one carries the same `alert-warning`
 * weight as a mismatch: both mean "do not trust that these two halves are in step".
 *
 * ── 🔴 EVERY `alert-soft` CARRIES AN EXPLICIT `text-base-content` ──
 * Measured in Phase 5b: daisyUI's soft alerts in the LIGHT theme are success **3.45**, warning
 * **2.04**, error 4.36 — all under AA, all passing in dark, which is why it hid for two phases. The
 * override goes on the `<span>`, never on the container: on the container it greys the icon too and
 * the levels stop being distinguishable at a glance.
 */

/** Which badge a release-note line carries. The prototype uses the first two; `แก้ไข` completes the
 *  union `releases.ts` declares, so a fix line cannot appear one day with no colour of its own. */
const GROUP_BADGE: Record<ReleaseGroup['t'], string> = {
  ใหม่: 'border-success/40 bg-success/20',
  ปรับปรุง: 'border-warning/40 bg-warning/20',
  แก้ไข: 'border-info/40 bg-info/20',
}

/**
 * The groups flattened to one badge-per-line list — which is how the prototype draws them
 * (2008–2033): a single `<ul>` whose every `<li>` carries its own badge, not one heading per group.
 */
function lines(release: Release): readonly { t: ReleaseGroup['t']; text: string }[] {
  return release.groups.flatMap((g) => g.items.map((text) => ({ t: g.t, text })))
}

function NoteList({ release }: { release: Release }) {
  return (
    <ul className="space-y-2.5 text-sm">
      {lines(release).map((line) => (
        <li key={line.text} className="flex items-start gap-2">
          {/* ⚠️ `/20` FILL + `text-base-content`, NOT `badge-success` at full strength. daisyUI's
              full-colour tokens fail AA in the light theme once there is text inside them — the
              same formula the booking status badges already use, so the same meaning looks the
              same everywhere. */}
          <span
            className={`badge badge-sm mt-0.5 shrink-0 whitespace-nowrap ${GROUP_BADGE[line.t]} text-base-content`}
          >
            {line.t}
          </span>
          <span className="min-w-0 leading-relaxed">{line.text}</span>
        </li>
      ))}
    </ul>
  )
}

/** What the agreement check concluded. `checking` is a real state and gets its own row height. */
type Agreement =
  | { kind: 'checking' }
  | { kind: 'match'; api: string }
  | { kind: 'mismatch'; api: string; appIsOlder: boolean }
  | { kind: 'unreachable'; why: string }

export function VersionPage() {
  const [agreement, setAgreement] = useState<Agreement>({ kind: 'checking' })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { version } = await fetchServerVersion()
        if (cancelled) return
        const order = compareVersions(APP.version, version)
        setAgreement(
          order === 0
            ? { kind: 'match', api: version }
            : { kind: 'mismatch', api: version, appIsOlder: order < 0 },
        )
      } catch (error) {
        console.warn('[version] /line-users/version failed:', error)
        if (!cancelled) setAgreement({ kind: 'unreachable', why: messageFor(error) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /* The release date is a FACT WRITTEN DOWN, looked up by the running number — never computed, and
     never assumed to exist: a bundle built between two releases genuinely has no release date, and
     saying so is better than printing the previous one as if it were this build's. */
  const running = RELEASES.find((r) => r.v === APP.version)

  return (
    <section className="min-h-dvh">
      <ScreenHeader
        title="ข้อมูลเวอร์ชันระบบ"
        breadcrumbs={[{ label: 'ตั้งค่า', to: '/settings' }, { label: 'ข้อมูลเวอร์ชันระบบ' }]}
      >
        {/* ⚠️ THE SUBTITLE GOES THROUGH `children`, NOT `subtitle`. `ScreenHeader` renders
            `subtitle` only in its one-tier form, and this is the one two-tier screen the prototype
            draws a subtitle on (1966). `children` puts it in the same place with the same classes,
            which is cheaper than widening a component eleven headers depend on. */}
        <p className="mt-0.5 text-xs text-base-content/60">
          ข้อมูลเวอร์ชันที่คุณกำลังใช้งาน และสิ่งที่อัปเดตใหม่
        </p>
      </ScreenHeader>

      <div className={`${SCREEN_WIDTH} pt-4`}>
        {/* ─── 1 · This bundle, and whether the server agrees ────────────────────────── */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-4">
            <p className="text-3xl font-semibold tracking-tight">v{APP.version}</p>
            <p className="mt-1 text-sm text-base-content/70">
              {running ? `เผยแพร่เมื่อ ${running.date}` : `รุ่นสำหรับทดสอบ · build ${APP.build}`}
            </p>
            <AgreementAlert state={agreement} />
          </div>
        </div>

        {/* ─── 2 · The changelog ─────────────────────────────────────────────────────── */}
        <div className="card mt-4 mb-8 bg-base-100 shadow-sm">
          <div className="card-body p-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <LIcon name="history" className="h-5 w-5 shrink-0" />
              ประวัติการอัปเดต
            </h2>
            <p className="mt-1 text-sm text-base-content/70">สิ่งที่เปลี่ยนไปในแต่ละเวอร์ชัน</p>
            <div className="divider my-3" />

            {/* 🔴 THE NEWEST RELEASE IS ORDINARY CONTENT; ONLY THE OLDER ONES COLLAPSE. Somebody
                opening this page is asking *"what changed"*, not *"what has ever changed"* — a
                newest entry you must tap to read is the answer hidden behind a click (1985). */}
            <LatestRelease release={RELEASES[0]} />

            {RELEASES.slice(1).map((release, index) => (
              /* ⚠️ `<details>` + `<summary class="collapse-title">`, which daisyUI supports as a
                 first-class form of `collapse` — and it brings Enter/Space, the summary's own role,
                 and browser find-in-page (Ctrl+F opens a collapsed section) for free. The React 19
                 `<form method="dialog">` trap does not apply here: nothing about this is a dialog. */
              <details
                key={release.v}
                className={`collapse collapse-arrow ${index === 0 ? 'mt-2' : ''}`.trim()}
              >
                <summary className="collapse-title px-0 text-base font-semibold">
                  <span className="flex flex-wrap items-center gap-2">
                    <span>v{release.v}</span>
                    <span className="text-xs font-normal text-base-content/60">{release.date}</span>
                  </span>
                </summary>
                <div className="collapse-content px-0">
                  <NoteList release={release} />
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * The expanded newest entry.
 *
 * 🔴 ITS BADGE IS DERIVED, NOT WRITTEN DOWN. `Q-C8` makes bumping `package.json` the PO's exclusive
 * authority, so a finished release sits in `releases.ts` describing work the running bundle already
 * contains while still reporting the previous number. Reading the badge off `compareVersions`
 * against `APP.version` means the screen tells the truth in both situations, and needs no edit on
 * the day the PO cuts the release — the badge simply changes from **อยู่ระหว่างพัฒนา** to **ล่าสุด**.
 */
function LatestRelease({ release }: { release: Release }) {
  const unreleased = compareVersions(release.v, APP.version) > 0

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">v{release.v}</h3>
        <span
          className={`badge badge-sm whitespace-nowrap text-base-content ${
            unreleased ? 'border-warning/40 bg-warning/20' : 'border-primary/40 bg-primary/20'
          }`}
        >
          {unreleased ? 'อยู่ระหว่างพัฒนา' : 'ล่าสุด'}
        </span>
        <span className="text-xs text-base-content/60">{release.date}</span>
      </div>
      <div className="mt-3">
        <NoteList release={release} />
      </div>
    </div>
  )
}

/** The four shapes of the agreement check. One `alert`, so the row height never jumps. */
function AgreementAlert({ state }: { state: Agreement }) {
  if (state.kind === 'checking') {
    return (
      <div role="status" className="alert alert-soft mt-4 text-sm">
        <span aria-hidden="true" className="loading loading-spinner loading-sm shrink-0" />
        <span className="text-base-content">กำลังตรวจสอบเวอร์ชันของเซิร์ฟเวอร์…</span>
      </div>
    )
  }

  if (state.kind === 'match') {
    return (
      <Verdict tone="alert-success" icon="circleCheck" heading="ระบบเป็นเวอร์ชันล่าสุด">
        {`หน้าเว็บ (v${APP.version}) และ API (v${state.api}) ตรงกัน`}
      </Verdict>
    )
  }

  if (state.kind === 'mismatch') {
    return (
      <Verdict
        tone="alert-warning"
        icon="triangleAlert"
        heading={state.appIsOlder ? 'แอปของคุณยังไม่ใช่เวอร์ชันล่าสุด' : 'เซิร์ฟเวอร์ยังไม่ได้อัปเดต'}
      >
        {state.appIsOlder
          ? `หน้าเว็บ (v${APP.version}) เก่ากว่า API (v${state.api}) · กรุณาปิดแล้วเปิด EasyBook ใหม่อีกครั้ง`
          : `หน้าเว็บ (v${APP.version}) ใหม่กว่า API (v${state.api}) · บางฟังก์ชันอาจยังใช้งานไม่ได้จนกว่าระบบจะอัปเดตครบ`}
      </Verdict>
    )
  }

  return (
    <Verdict tone="alert-warning" icon="triangleAlert" heading="ตรวจสอบเวอร์ชันของเซิร์ฟเวอร์ไม่ได้">
      {state.why}
    </Verdict>
  )
}

function Verdict({
  tone,
  icon,
  heading,
  children,
}: {
  tone: 'alert-success' | 'alert-warning'
  icon: LIconName
  heading: string
  children: string
}) {
  return (
    <div role="status" className={`alert ${tone} alert-soft mt-4 text-sm`}>
      <LIcon name={icon} className="h-5 w-5 shrink-0" />
      <span className="text-base-content">
        <span className="block font-semibold">{heading}</span>
        <span className="mt-0.5 block">{children}</span>
      </span>
    </div>
  )
}
