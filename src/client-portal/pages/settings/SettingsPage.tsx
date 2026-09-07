import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchServerVersion,
  fetchUserSettings,
  messageFor,
  updateUserSettings,
  type NotificationKey,
  type UserSettings,
} from './settings-api'
import { Skeleton } from '@/client-portal/components/feedback/Skeleton'
import { useToast } from '@/client-portal/components/feedback/toast-context'
import { SCREEN_WIDTH, ScreenHeader } from '@/client-portal/components/ui/ScreenHeader'
import { useGate } from '@/client-portal/hooks/gate-context'
import { LIcon } from '@/client-portal/icons/LucideIcon'
import type { LIconName } from '@/client-portal/icons/licon'
import { APP } from '@/client-portal/lib/version'
import { fmtPhone } from '@/client-portal/pages/register/registration-form'
import { useThemeChoice, setThemeChoice, type ThemeChoice } from '@/hooks/useResolvedTheme'
import { getProfile } from '@/lib/liff'

/**
 * `#/settings` — the dock's fourth tab. Prototype 1701–1947.
 *
 * ── ⚠️ FIVE CARDS, ORDERED BY HOW OFTEN PEOPLE COME LOOKING, NOT BY IMPORTANCE ──
 * Identity → appearance → notifications → help → version (1692). The first three are what a user
 * comes to *touch*; the last two are what they come to *read when something is wrong*, which is a
 * different frequency by an order of magnitude. Do not resort them.
 *
 * ── 🟠 CARD 5 IS BUILT, AND `CHECKLIST.md` SAYS FOUR CARDS ──
 * `Q-C9`'s restructure folded the version summary into the help card, and the checklist flags that
 * as *"a real loss — it removes the only place the app states its own version without a tap.
 * Flag it if the PO expected the summary to stay"*. The task brief for this phase asks for five
 * cards with the summary intact, which is also what the prototype draws — so it is built as drawn,
 * and this note is the flag.
 *
 * ── 🔴 CARD 1 IS READ-ONLY, AND THAT IS A DECISION ──
 * `NEEDS_DESIGN.md` §4.6: the brief once described an "edit request link" that the prototype does
 * not draw — no label, no destination, no behaviour — and it implies a rule nobody has stated
 * (does editing an approved registration re-open approval?). Ships read-only until the PO answers.
 *
 * ── ⚠️ EVERY TAPPABLE ROW IS AT LEAST 56px, NOT 44 ──
 * The prototype's reason (1698): *a full-width row is a target the thumb aims at by height alone;
 * width helps it not at all in the direction where it can actually miss.* That is why the
 * notification rows are `<label class="min-h-14">` wrapping a 20px switch, rather than the switch
 * being the target.
 */

/** The three switches, exactly as `Q-C9` ruling 2 words them. */
const NOTIFICATIONS: readonly { key: NotificationKey; label: string; hint: string }[] = [
  {
    key: 'decisions',
    label: 'ผลการพิจารณาคำขอจองสถานที่',
    hint: 'แจ้งผลทันทีเมื่อได้รับอนุมัติ ไม่อนุมัติ หรือถูกปฏิเสธอัตโนมัติเมื่อมีผู้อื่นได้รับอนุมัติก่อน',
  },
  {
    key: 'reminders',
    label: 'เตือนความจำก่อนถึงเวลาเข้าใช้งาน',
    hint: 'แจ้งเตือนล่วงหน้า 24 ชั่วโมง และล่วงหน้า 1 ชั่วโมงก่อนถึงเวลาเริ่มกิจกรรม',
  },
  {
    key: 'announcements',
    label: 'ประกาศและข่าวประชาสัมพันธ์',
    hint: 'ประกาศสำคัญ ข่าวสารกิจกรรม และการอัปเดตระบบจากผู้ดูแล',
  },
]

/** The three theme tiles. Icons are the prototype's, in the prototype's order. */
const THEMES: readonly { value: ThemeChoice; label: string; icon: LIconName }[] = [
  { value: 'light', label: 'สว่าง', icon: 'sun' },
  { value: 'dark', label: 'มืด', icon: 'moon' },
  { value: 'system', label: 'ตามระบบ', icon: 'monitor' },
]

/** The three help destinations. Same shape, same arrow, and since 1 ก.ย. 2569 the same behaviour. */
const HELP_LINKS: readonly { to: string; label: string; icon: LIconName }[] = [
  { to: '/issues', label: 'แจ้งปัญหาการใช้งานสถานที่', icon: 'circleAlert' },
  { to: '/manual', label: 'คู่มือการใช้งานระบบ', icon: 'bookOpen' },
  { to: '/rules', label: 'ระเบียบและข้อกำหนดการใช้สถานที่', icon: 'fileText' },
]

/**
 * The class list every tappable row in this screen shares — three help rows and the version-history
 * row. Copied from the prototype (1905) and kept in one constant so the four cannot drift apart.
 *
 * ⚠️ `<Link>`, WHERE THE PROTOTYPE WRITES `<button data-go>`. A static file has no router, so a
 * button running `location.hash = …` was its only option; here a router `Link` renders a real
 * `<a href>` — keyboard, focus, role, copyable, middle-clickable — without the full page reload a
 * bare `<a>` would cause, which would restart the LIFF gate's four checks. Same correction
 * `UnderConstruction` and `Breadcrumbs` already made.
 */
const ROW =
  '-mx-2 flex min-h-14 w-full items-center gap-3 rounded-field px-2 text-start hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 motion-safe:transition-colors'

export function SettingsPage() {
  const { status } = useGate()
  const toast = useToast()
  const choice = useThemeChoice()

  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [saving, setSaving] = useState<NotificationKey | null>(null)
  const [reload, setReload] = useState(0)
  const [picture, setPicture] = useState<string | null>(null)
  const [api, setApi] = useState<{ version: string } | 'down' | null>(null)

  /* ── The notification preferences ──────────────────────────────────────────────────────────
     🔴 BOUND TO THE REAL API FROM THE FIRST COMMIT (`Q-C9`). A switch that flips and persists
     nothing is a control that lies about having been set, which is worse than an absent one — the
     user believes they have opted out. There is no `useState` fallback path here on purpose. */
  useEffect(() => {
    let cancelled = false
    setSettingsError(null)
    void (async () => {
      try {
        const data = await fetchUserSettings()
        if (!cancelled) setSettings(data)
      } catch (error) {
        console.warn('[settings] read failed:', error)
        if (!cancelled) setSettingsError(messageFor(error))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reload])

  /* ── The server's version, for card 5's middle line ────────────────────────────────────────
     ⚠️ A FAILURE IS A STATE, NOT AN ERROR. "Cannot reach the server" is one of the two things this
     line exists to say, and the rest of the screen keeps working without it. */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await fetchServerVersion()
        if (!cancelled) setApi({ version: data.version })
      } catch (error) {
        console.warn('[settings] version read failed:', error)
        if (!cancelled) setApi('down')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /* ── The LINE profile picture ──────────────────────────────────────────────────────────────
     The prototype draws initials and says why (1717): a static file has no right to call for the
     real picture. The port *does*, so the inner `<div>` becomes an `<img>` and the structure stays
     exactly as drawn. `getProfile()` never throws and answers `null` in a plain dev browser, so the
     initials remain the honest fallback rather than a placeholder for a failure. */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const profile = await getProfile()
      if (!cancelled && profile?.pictureUrl) setPicture(profile.pictureUrl)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const registration = status?.registration ?? null

  /**
   * Flip one switch.
   *
   * 🔴 OPTIMISTIC, AND THE REVERT IS THE CONTRACT. The row moves immediately because a 400 ms wait
   * on a switch reads as a switch that does not work; if the write is refused it moves back to the
   * value it had — never to `!next`, which would be a guess about what it had been.
   *
   * ⚠️ ONE SAVE AT A TIME. The endpoint merges per key, so two concurrent writes are safe on the
   * server — but the second response would carry the first key's *pre-flip* value and overwrite the
   * optimistic row on screen. Serialising is one line; reconciling two responses is not.
   *
   * ⚠️ ONLY THE CHANGED KEY IS SENT (`{ notifications: { decisions: false } }`). Posting all three
   * back would work today and would start losing writes the moment two devices touch different keys.
   */
  async function toggle(key: NotificationKey) {
    if (!settings || saving) return
    const before = settings.notifications[key]
    const next = !before

    setSettings({ ...settings, notifications: { ...settings.notifications, [key]: next } })
    setSaving(key)
    try {
      const saved = await updateUserSettings({ notifications: { [key]: next } })
      setSettings(saved)
    } catch (error) {
      console.warn('[settings] save failed:', error)
      setSettings((prev) =>
        prev ? { ...prev, notifications: { ...prev.notifications, [key]: before } } : prev,
      )
      toast(messageFor(error), 'error')
    } finally {
      setSaving(null)
    }
  }

  /**
   * Pick a theme.
   *
   * 🔴 THE LOCAL VALUE IS APPLIED FIRST AND IS AUTHORITATIVE (`Q-C9`). The server copy is the
   * cross-device sync, not the source of truth: adopting it on load would repaint the app under
   * someone who had just chosen otherwise, and blocking first paint on a settings fetch would trade
   * a flash for a delay on every single launch.
   *
   * ⚠️ A FAILED SYNC DOES NOT UNDO THE CHOICE, and it is not silent either. The colour the user
   * asked for is already on screen and is remembered locally; what failed is only carrying it to
   * their next device, so the toast says exactly that instead of yanking the theme back.
   */
  async function pickTheme(next: ThemeChoice) {
    if (next === choice) return
    setThemeChoice(next)
    try {
      const saved = await updateUserSettings({ theme: next })
      setSettings(saved)
    } catch (error) {
      console.warn('[settings] theme sync failed:', error)
      toast('บันทึกโหมดสีขึ้นระบบไม่สำเร็จ แอปจะจำค่านี้ไว้ในเครื่องนี้เท่านั้น', 'warning')
    }
  }

  return (
    <section className="pad-nav min-h-dvh">
      {/* ⚠️ ONE TIER AND A SUBTITLE. This is a dock tab, so there is no way back to name — and the
          subtitle is not decoration: `#/venues` and `#/bookings` both have two-line headers, so
          without one here the content jumps every time the user switches tabs (1705). It names
          three of the five cards rather than restating the word "ตั้งค่า", which says nothing. */}
      <ScreenHeader
        title="ตั้งค่า"
        subtitle="ปรับแต่งการแสดงผล การแจ้งเตือนผ่าน LINE และคู่มือช่วยเหลือ"
      />

      <div className={`${SCREEN_WIDTH} space-y-4 pt-4 pb-8`}>
        {/* ─── 1 · Profile, read-only ─────────────────────────────────────────────────── */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-4">
            {registration ? (
              <div className="flex items-start gap-4">
                {/* ⚠️ THE STRUCTURE IS THE PROTOTYPE'S EITHER WAY — `avatar` wrapping one sized
                    `<div>`. Only the contents of that div change (1719), so the row's height and
                    alignment cannot depend on whether the picture loaded. */}
                <div className={`avatar shrink-0 ${picture ? '' : 'avatar-placeholder'}`.trim()}>
                  {picture ? (
                    <div className="w-14 rounded-full">
                      {/* Decorative: the name is right beside it in text, so an alt would be read
                          twice. `referrerPolicy` because LINE's CDN serves the avatar. */}
                      <img src={picture} alt="" referrerPolicy="no-referrer" />
                    </div>
                  ) : (
                    <div className="w-14 rounded-full bg-neutral text-neutral-content">
                      <span className="text-xl font-medium">
                        {registration.firstName.slice(0, 2)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Four lines at 16/14/12/12: priority is a matter of type size, not of labels —
                    which is why the wide label/value `<dl>` was deleted on 1 ก.ย. 2569. */}
                <div className="min-w-0 grow space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    {/* `items-start`, not `items-center`: a name that wraps to two lines would drag
                        the badge down to its middle. */}
                    <p className="min-w-0 truncate text-base font-semibold leading-tight">
                      {registration.firstName} {registration.lastName}
                    </p>
                    {/* 🔴 A BADGE, NEVER GREEN TEXT. `text-success` measures ~3.5:1 in the light
                        theme and fails AA; `bg-success/20` + `text-base-content` gives the full
                        contrast of the foreground token — the identical formula the booking status
                        badges use, so the same meaning looks the same in both places.
                        ⚠️ Only an `ALLOWED` user can reach this screen (`ALLOWED_SCREENS`), so this
                        is a statement of fact rather than a state machine with one branch. */}
                    <span className="badge badge-sm shrink-0 gap-1 whitespace-nowrap border-success/40 bg-success/20 text-base-content">
                      <LIcon name="circleCheck" className="h-3.5 w-3.5 shrink-0" />
                      อนุมัติแล้ว
                    </span>
                  </div>
                  <p className="truncate text-sm text-base-content/70">
                    {/* ⚠️ `/80`, NOT `/85`. Token alphas exist only in steps of ten (`D-C11`) and a
                        class with no rule behind it fails SILENTLY at full opacity — this line
                        would then be as loud as the name above it. */}
                    <span className="font-medium text-base-content/80">
                      {registration.personnelRole}
                    </span>{' '}
                    · {registration.department}
                  </p>
                  <p className="flex items-center gap-1.5 pt-0.5 text-xs text-base-content/70">
                    <LIcon name="phone" className="h-3.5 w-3.5 shrink-0" />
                    {/* `font-mono` on the number alone: equal-width digits make `081-234-5678` read
                        as a *value* rather than as a sentence. Thai stays in the body font. */}
                    <span className="min-w-0 truncate font-mono">
                      {fmtPhone(registration.phone)}
                    </span>
                  </p>
                </div>
              </div>
            ) : (
              /* The gate settles before this screen mounts, so this is a guard rather than a real
                 loading state — but it has the card's proportions anyway, because a shorter
                 placeholder is a page that jumps. */
              <div className="flex items-start gap-4">
                <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
                <div className="min-w-0 grow space-y-2 py-1">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── 2 · Appearance ─────────────────────────────────────────────────────────── */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-4">
            <h2 className="font-semibold">การแสดงผล</h2>
            <p className="mt-1 text-sm text-base-content/70">เลือกโหมดสีของแอป</p>
            <div className="join mt-3 w-full" role="group" aria-label="โหมดสี">
              {THEMES.map((option) => (
                /* 🔴 THE SELECTED STATE IS COLOURED BY CSS BOUND TO
                   `[data-theme-set][aria-pressed="true"]` (`index.css`, ported in Phase 1) — NOT by
                   classes added here. The checklist says the React port *may* use conditional
                   classes since Vite compiles at build time; the rules already exist in the
                   stylesheet, and re-expressing amber/indigo as utilities would be a second source
                   of truth for the same three colours. So one attribute drives the colour AND what
                   a screen reader announces, and they cannot end up in different states.
                   ⚠️ `h-auto min-h-14`: `.btn` sets `height` *and* `min-height`, so both need
                   overriding. Both are single classes and win on specificity.
                   ⚠️ Vertical, not horizontal: measured at 375px each tile gets 103.7px, and
                   "ตามระบบ" plus a 20px icon plus `.btn`'s 32px padding does not fit on one line. */
                <button
                  key={option.value}
                  type="button"
                  data-theme-set={option.value}
                  aria-pressed={choice === option.value}
                  onClick={() => void pickTheme(option.value)}
                  className="btn join-item h-auto min-h-14 grow flex-col gap-1 py-2 text-sm font-medium"
                >
                  <LIcon name={option.icon} className="h-5 w-5 shrink-0" />
                  <span className="whitespace-nowrap">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ─── 3 · LINE notifications ─────────────────────────────────────────────────── */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-4">
            <h2 className="font-semibold">การแจ้งเตือนผ่าน LINE</h2>
            <p className="mt-1 text-sm text-base-content/70">
              เลือกเรื่องที่ต้องการให้ EasyBook ส่งข้อความหาคุณ
            </p>

            {settingsError ? (
              <div role="alert" className="mt-3 rounded-box border border-error/40 p-4">
                <p className="text-sm font-medium text-base-content">{settingsError}</p>
                <button
                  type="button"
                  onClick={() => setReload((n) => n + 1)}
                  className="btn btn-app-sm btn-outline mt-3"
                >
                  ลองใหม่อีกครั้ง
                </button>
              </div>
            ) : (
              <div className="mt-2">
                {NOTIFICATIONS.map((row, index) => (
                  /* ⚠️ THE WHOLE ROW IS THE `<label>`, so the 56px row is the tap target rather
                     than the 20px switch inside it — a mistake already made once on the "เฉพาะที่
                     เปิดให้จอง" switch.
                     ⚠️ SEPARATORS ARE WRITTEN PER ROW, never `divide-y`: there is no
                     `divide-base-300` utility, and a class with no rule behind it fails silently. */
                  <label
                    key={row.key}
                    className={`flex min-h-14 cursor-pointer items-center justify-between gap-4 py-2 ${
                      index > 0 ? 'border-t border-base-300' : ''
                    }`.trim()}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{row.label}</span>
                      {/* Not decoration: the three labels differ by a word or two when scanned, and
                          somebody here to switch something off is hunting the one that buzzed last
                          night — which no title alone can answer. */}
                      <span className="mt-0.5 block text-xs text-base-content/60">{row.hint}</span>
                    </span>

                    {settings ? (
                      /* `toggle-success` — a plain toggle is neutral in BOTH states, so "is it on?"
                         would have to be read from the knob's position alone. daisyUI applies the
                         colour under `:checked` only, so the off state stays neutral by itself. */
                      <input
                        type="checkbox"
                        className="toggle toggle-sm toggle-success shrink-0"
                        checked={settings.notifications[row.key]}
                        disabled={saving !== null}
                        aria-busy={saving === row.key}
                        onChange={() => void toggle(row.key)}
                      />
                    ) : (
                      /* Same footprint as the switch it replaces, so the row does not resize when
                         the read lands. */
                      <Skeleton className="h-5 w-10 shrink-0 rounded-full" />
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── 4 · Help and services ──────────────────────────────────────────────────── */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body gap-0 p-4">
            <h2 className="font-semibold">บริการและความช่วยเหลือ</h2>
            <div className="mt-2">
              {HELP_LINKS.map((link, index) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`${ROW} ${index > 0 ? 'border-t border-base-300' : ''}`.trim()}
                >
                  <LIcon name={link.icon} className="h-5 w-5 shrink-0 text-base-content/70" />
                  <span className="min-w-0 grow text-sm">{link.label}</span>
                  {/* The arrow speaks to the eye only — the link already tells a screen reader it
                      is followable. `/60`, not `/40`: it is a UI element, so WCAG 1.4.11 asks 3:1,
                      and `/40` on white measures under that. */}
                  <LIcon name="chevronRight" className="h-4 w-4 shrink-0 text-base-content/60" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ─── 5 · Version summary ────────────────────────────────────────────────────── */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body gap-0 p-4">
            {/* ⚠️ TWO READ-ONLY LINES AND ONE TAPPABLE ROW — so `<p>`, `<p>`, `<Link>`, not three
                identical-looking rows one of which is quietly clickable (1925). */}
            <p className="flex min-h-11 items-center gap-3 text-sm">
              <LIcon name="info" className="h-5 w-5 shrink-0 text-base-content/70" />
              <span className="min-w-0">EasyBook Client Portal v{APP.version}</span>
            </p>
            <p className="flex min-h-11 items-center gap-3 border-t border-base-300 text-sm">
              {/* The glyph changes with the state and the sentence says the same thing in words —
                  no meaning is carried by colour alone. */}
              <LIcon
                name={API_ICON[apiState(api)]}
                className="h-5 w-5 shrink-0 text-base-content/70"
              />
              <span className="min-w-0">สถานะเซิร์ฟเวอร์: {apiLine(api)}</span>
            </p>
            <Link to="/version" className={`${ROW} border-t border-base-300`}>
              <LIcon name="history" className="h-5 w-5 shrink-0 text-base-content/70" />
              <span className="min-w-0 grow text-sm">ดูประวัติการอัปเดตระบบ</span>
              <LIcon name="chevronRight" className="h-4 w-4 shrink-0 text-base-content/60" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

type ApiState = 'checking' | 'ok' | 'down'

const API_ICON: Record<ApiState, LIconName> = {
  checking: 'info',
  ok: 'circleCheck',
  down: 'triangleAlert',
}

function apiState(api: { version: string } | 'down' | null): ApiState {
  if (api === null) return 'checking'
  return api === 'down' ? 'down' : 'ok'
}

function apiLine(api: { version: string } | 'down' | null): string {
  if (api === null) return 'กำลังตรวจสอบ…'
  return api === 'down' ? 'เชื่อมต่อไม่ได้' : `เชื่อมต่อปกติ (API v${api.version})`
}
