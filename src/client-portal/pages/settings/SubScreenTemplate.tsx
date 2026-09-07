import { UnderConstruction } from '@/client-portal/components/feedback/UnderConstruction'
import { SCREEN_WIDTH, ScreenHeader } from '@/client-portal/components/ui/ScreenHeader'

/**
 * `#/issues` · `#/manual` · `#/rules` — the three settings sub-screens whose bodies are still
 * pending. Prototype 1665–1689, 2094–2118 and 2120–2144, which are **three copies of one screen**
 * differing only in their title.
 *
 * ── 🔴 ONE FRAME, THREE TITLES, BECAUSE THE PROTOTYPE IS ONE SHAPE THREE TIMES ──
 * Its own header note (2083) says the shape was *lifted whole from `#/version`* rather than
 * designed a third time: two-tier header (breadcrumbs, then `<h1>`), `pt-safe-lg`, the same width
 * ladder as every other screen. Writing three near-identical files is how the third one drifts.
 *
 * ── ⚠️ THE BODY IS `UnderConstruction`, WHICH ALREADY EXISTS ──
 * Built in Phase 1 from these very lines, down to the 56px `bg-base-200` circle, the `hammer`
 * glyph (never `clock` — `clock` means "time that has not elapsed" elsewhere in this portal) and
 * the `btn btn-app btn-outline` exit reading **กลับสู่หน้าตั้งค่า**. A fourth copy of that card
 * would be a fourth thing to keep in step.
 *
 * ── 🟠 THE TRAIL IS TWO CRUMBS, NOT THREE, AND THAT IS THE PROTOTYPE'S ──
 * `crumbs()` is called for all four sub-screens at prototype **5758–5773** and every trail is
 * `ตั้งค่า` → *this screen*. The task brief describes `หน้าแรก` → `ตั้งค่า` → *title*; no `หน้าแรก`
 * crumb exists anywhere in the prototype (grepped), and `/home` is still an under-construction
 * stand-in until 7b — so the extra crumb would be a link to a placeholder. Flagged rather than
 * invented (plan rule 6). One line to add here if the PO wants it.
 *
 * ⚠️ NO BACK ARROW IN THE HEADER (`D-C3`) — LIFF draws its own and a second one races real history.
 * The breadcrumb names the way back (`D-C14`), and the button at the end of the content is a link
 * to a written destination, which is what keeps a screen with no content from being a dead end.
 */
export function SettingsSubScreen({ title }: { title: string }) {
  return (
    /* `pad-nav`: all three keep the dock (`NAV_SCREENS` lists them) and highlight the ตั้งค่า tab,
       so the floating pill needs room reserved under the content — the same pairing `#/venues` and
       `#/bookings` use. */
    <section className="pad-nav min-h-dvh">
      <ScreenHeader
        title={title}
        breadcrumbs={[{ label: 'ตั้งค่า', to: '/settings' }, { label: title }]}
      />
      <div className={`${SCREEN_WIDTH} pt-4`}>
        <UnderConstruction />
      </div>
    </section>
  )
}

/** `#/issues` — kept a placeholder by `Q-C5`: no table, no endpoint, no admin counterpart. */
export function IssuesPage() {
  return <SettingsSubScreen title="แจ้งปัญหาการใช้งานสถานที่" />
}

/** `#/manual` — the user manual, once somebody writes one. */
export function ManualPage() {
  return <SettingsSubScreen title="คู่มือการใช้งานระบบ" />
}

/** `#/rules` — the organisation's venue-use rules, once somebody writes them. */
export function RulesPage() {
  return <SettingsSubScreen title="ระเบียบและข้อกำหนดการใช้สถานที่" />
}
