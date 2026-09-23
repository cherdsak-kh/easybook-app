import { UnderConstruction } from '@/client-portal/components/feedback/UnderConstruction'
import { SCREEN_WIDTH, ScreenHeader } from '@/client-portal/components/ui/ScreenHeader'

/**
 * `#/manual` · `#/rules` — the two settings sub-screens whose bodies are still pending. Prototype
 * 2094–2118 and 2120–2144, which are **two copies of one screen** differing only in their title.
 * (`#/issues` used to be the third; it is a real form now, in `IssuesPage.tsx`.)
 *
 * ── 🔴 ONE FRAME, TWO TITLES, BECAUSE THE PROTOTYPE IS ONE SHAPE TWICE ──
 * Its own header note (2083) says the shape was *lifted whole from `#/version`* rather than
 * designed again: two-tier header (breadcrumbs, then `<h1>`), `pt-safe-lg`, the same width ladder
 * as every other screen. Writing near-identical files is how one of them drifts.
 *
 * ── ⚠️ THE BODY IS `UnderConstruction`, WHICH ALREADY EXISTS ──
 * Built in Phase 1 from these very lines, down to the 56px `bg-base-200` circle, the `hammer`
 * glyph (never `clock` — `clock` means "time that has not elapsed" elsewhere in this portal) and
 * the `btn btn-app btn-outline` exit reading **กลับสู่หน้าตั้งค่า**. Another copy of that card
 * would be one more thing to keep in step.
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
    /* ⚠️ NO `pad-nav` ON THIS SECTION, AND THAT IS THE POINT. Both keep the dock
       (`NAV_SCREENS` lists them) and highlight the ตั้งค่า tab, so room genuinely does have to be
       reserved under the content for the floating pill — but `LiffShell` is the SINGLE AUTHORITY
       for that clearance (`LiffShell.tsx:21–28`): it applies `.pad-nav` on the very same condition
       it draws the dock on, so every dock screen is covered without asking, and a screen can no
       longer forget it. 🔴 RE-ADD IT HERE AND IT MEASURES 0px TODAY — that is a delayed fuse, not
       a reprieve. These two bodies are `UnderConstruction` placeholders that fit the viewport,
       and `min-h-dvh` + border-box absorbs the section's own `padding-bottom` inside its
       min-height, so a duplicate is invisible while the content is short. The moment either of
       the two carries real content that overflows, the second 7rem + safe-area inset starts costing
       112px where that inset is 0, ~146px on an iPhone — exactly what the five taller dock screens
       were paying (`claude_planning/fix/20260909_1715_client_dock_double_pad_nav/`). `#/venues` and
       `#/bookings` carry none either — the same pairing as before, read the other way round. */
    <section className="min-h-dvh">
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

/** `#/manual` — the user manual, once somebody writes one. */
export function ManualPage() {
  return <SettingsSubScreen title="คู่มือการใช้งานระบบ" />
}

/** `#/rules` — the organisation's venue-use rules, once somebody writes them. */
export function RulesPage() {
  return <SettingsSubScreen title="ระเบียบและข้อกำหนดการใช้สถานที่" />
}
