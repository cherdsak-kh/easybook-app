/**
 * The command palette's PURE half: which destinations are on offer for a query, in what order,
 * and which characters of a label matched. `components/shell/CommandPalette.tsx` renders it and
 * holds all the state; nothing here touches the DOM, the router or a session.
 *
 * ⚠️ IT IS A PAGE NAVIGATOR, NOT A RECORD SEARCH. The only things it ever reads are the route
 * table's `label`, `group` and `desc`. Teaching it to look at bookings, people or venues would
 * make the trigger's wording the same lie the old "ค้นหาทั้งระบบ" field told — there is no
 * cross-entity index to search.
 *
 * Ported from the prototype's "Command palette" controller (`match`, `collect`, `highlight`),
 * which is the design authority; the ranking, the ANDed words and the section order are its
 * measured behaviour and are pinned by `tests/unit/admin-portal/lib/command-palette-model.test.ts`.
 *
 * ⚠️ File name is kebab-case on purpose: `CommandPalette.tsx` is the component, and on a
 * case-insensitive filesystem (Windows, macOS) `commandPalette.ts` beside it would be the same
 * file.
 */

/** The five headings the palette shows, in order. */
export const SECTIONS = [
  'การบริหารจัดการ',
  'รายงานและสถิติ',
  'การตั้งค่าระบบ',
  'ช่วยเหลือ',
  'บัญชีผู้ใช้งาน',
] as const

/**
 * `AdminRoute.group` is a BREADCRUMB parent, not always a menu section, so two values are mapped
 * onto the headings above. The other four groups are headings already and map to themselves.
 *
 *   ''             ภาพรวมระบบ, the only top-level page          → การบริหารจัดการ
 *   'การแจ้งเตือน'  ดูการแจ้งเตือนทั้งหมด, the bell's "view all"  → บัญชีผู้ใช้งาน
 */
export const SECTION_OF: Readonly<Record<string, string>> = {
  '': 'การบริหารจัดการ',
  การแจ้งเตือน: 'บัญชีผู้ใช้งาน',
}

/** The slice of a route the palette reads. `AdminRoute` satisfies it. */
export interface PaletteRoute {
  readonly label: string
  readonly group: string
  readonly desc: string
}

export interface PaletteItem<R extends PaletteRoute> {
  route: R
  /** 0 = every word is in the label · 1 = in label or group · 2 = description only. */
  rank: number
}

export interface PaletteSection<R extends PaletteRoute> {
  name: string
  /** The best rank among its items. */
  rank: number
  items: PaletteItem<R>[]
}

/** The section a route is listed under. An unknown group falls into the LAST section. */
export function sectionOf(group: string): string {
  const name = SECTION_OF[group] ?? group
  return (SECTIONS as readonly string[]).includes(name) ? name : SECTIONS[SECTIONS.length - 1]
}

/** Lower-case, split on whitespace, drop empties. `''` and `'   '` both give `[]`. */
export function tokenize(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean)
}

/**
 * `-1` when any word is missing from `label + group + desc` — so several words are ANDed.
 * Otherwise 0 / 1 / 2, which only ORDERS what already matched; it never admits a row by itself.
 * No words at all matches everything, as rank 0.
 */
export function rankRoute(route: PaletteRoute, tokens: readonly string[]): number {
  const label = route.label.toLowerCase()
  const group = route.group.toLowerCase()
  const hay = `${label}\n${group}\n${route.desc.toLowerCase()}`
  if (!tokens.every((t) => hay.includes(t))) return -1
  if (tokens.every((t) => label.includes(t))) return 0
  if (tokens.every((t) => `${label} ${group}`.includes(t))) return 1
  return 2
}

/**
 * The palette's whole result: routes the role may open, filtered by the words, grouped by section.
 *
 * Items sort by rank and then by TABLE order (a stable sort — ties keep the table's order, which
 * is the sidebar's). With words, sections sort by their best rank and then by `SECTIONS` order;
 * with none they stay in `SECTIONS` order. Empty sections are never returned.
 */
export function collectPalette<R extends PaletteRoute>(
  routes: readonly R[],
  can: (label: R['label']) => boolean,
  tokens: readonly string[],
): PaletteSection<R>[] {
  const bySection = new Map<string, PaletteSection<R>>()
  for (const route of routes) {
    if (!can(route.label)) continue
    const rank = rankRoute(route, tokens)
    if (rank < 0) continue
    const name = sectionOf(route.group)
    let section = bySection.get(name)
    if (!section) {
      section = { name, rank, items: [] }
      bySection.set(name, section)
    }
    section.items.push({ route, rank })
    if (rank < section.rank) section.rank = rank
  }

  const sections = [...bySection.values()]
  for (const s of sections) {
    // `Array.prototype.sort` is stable, so equal ranks keep the table's order.
    s.items.sort((a, b) => a.rank - b.rank)
  }
  const order = (name: string) => (SECTIONS as readonly string[]).indexOf(name)
  sections.sort(
    (a, b) => (tokens.length ? a.rank - b.rank : 0) || order(a.name) - order(b.name),
  )
  return sections
}

export interface HighlightPart {
  text: string
  hit: boolean
}

/**
 * Splits `text` into runs, marking the characters any word matched. Returned as DATA, not HTML:
 * the component renders a `<mark>` per `hit` run from text nodes, so a label can never be parsed
 * as markup.
 *
 * Returned as one plain run when there are no words, or when lower-casing changed the string's
 * length (a few Unicode letters expand), because the indices would then point at the wrong
 * characters.
 */
export function highlightParts(text: string, tokens: readonly string[]): HighlightPart[] {
  const low = text.toLowerCase()
  if (!tokens.length || low.length !== text.length) return [{ text, hit: false }]

  const hit: boolean[] = []
  for (const t of tokens) {
    let at = low.indexOf(t)
    while (at >= 0) {
      for (let k = at; k < at + t.length; k++) hit[k] = true
      at = low.indexOf(t, at + t.length)
    }
  }

  const parts: HighlightPart[] = []
  let i = 0
  while (i < text.length) {
    const on = !!hit[i]
    let j = i
    while (j < text.length && !!hit[j] === on) j++
    parts.push({ text: text.slice(i, j), hit: on })
    i = j
  }
  return parts
}
