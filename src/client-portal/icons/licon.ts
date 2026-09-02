/**
 * `LICON` — the lucide registry. Ported from `client_portal_prototype.html` 3014–3121.
 *
 * 🔴 EVERY STRING BELOW IS COPIED CHARACTER-FOR-CHARACTER FROM
 * `https://cdn.jsdelivr.net/npm/lucide-static@1.37.0/icons/<name>.svg`, with only the outer
 * `<svg>` shell removed. Never retype, never round, never abbreviate a path. To change one,
 * pull the file again and paste over the top. This rule exists because it has already failed:
 * the dock's four icons were hand-drawn at `stroke-width="1.8"` and had drifted away from the
 * rest of the app, and the PO noticed before anyone here did. The next mismatch should be a
 * "we have not synced the version" problem, not a "someone redrew it" problem.
 *
 * ⚠️ SEPARATE FROM `VICON` ON PURPOSE. `VICON` is heroicons and carries a promise of being
 * identical to the admin portal's copy; dropping lucide glyphs into that bag would make the
 * promise uncheckable. This set is lucide throughout, `stroke-width: 2` throughout, so it is
 * genuinely one family.
 *
 * ⚠️ THREE GLYPHS HERE HAVE HEROICON TWINS IN `VICON` — `mapPin`/`users`/`image` against
 * `pin`+`pinOuter`/`people`/`photo` — and they must NEVER be substituted for one another. A
 * card drawn with lucide plus three heroicons shows two icon families side by side, which reads
 * as unequal stroke weights.
 *
 * ⚠️ ICONS THAT WERE DELIBERATELY REMOVED AND MUST NOT COME BACK:
 *   · `search` — all three search fields embed their own r=7 magnifier in markup. The lucide
 *     one is r=8 with a longer handle. Keeping a `search` key here means the person who adds a
 *     fourth search field picks the one that exists and looks right, and silently gets the old
 *     mismatch back. (The r=7 path having three copies in markup is a debt still outstanding;
 *     paying it means a third registry, not an entry here — that shape is not lucide.)
 *   · `logIn` / `logOut` — replaced by `RXICON.enter` / `RXICON.leave` on both screens. A path
 *     with no caller in a registry is an invitation to use the wrong family.
 *   · `checkCircle2` — the spec asked for it; lucide renamed that shape `circle-check-big`.
 *     `circleCheck` already means "done / passes" in this app, and two checkmarks meaning the
 *     same thing is a mismatch the PO has caught here before.
 *
 * ⚠️ MEANINGS ARE RESERVED, and that is why some near-duplicates coexist:
 *   · `circleCheck` = "this slot is free" · `calendarCheck` = the "my bookings" tab ·
 *     `calendarCheck2` = "today is free" on the venue-detail card. One glyph meaning two things
 *     in one app is a collision with itself.
 *   · `flag`, not `circleCheck`, heads the "ends at" field — `circleCheck` is taken, and
 *     `circleDot → flag` still reads as the pair "start line → finish line".
 *   · `hammer`, not `clock`, marks "under development" — `clock` means "the time an activity
 *     runs" (the home card and the request form) **and "a decision has not been made yet"**
 *     (`#/pending`, added in P3). Those are one meaning, *time that has not elapsed*, drawn the
 *     same way; "under development" is not, which is why it keeps its own glyph.
 *   · `circleX`, not `ban`, marks an unbookable span — the whole form is a `circle-*` family,
 *     and `ban` reads as "you are forbidden" rather than "this span cannot be requested".
 *     ⚠️ `ban` EXISTS NOW (P3) and means exactly that: `#/blocked`, where "you are forbidden" is
 *     the entire message. The rule above is unchanged — it says which glyph the *slot list* uses,
 *     not that this shape has no home. Do not reach for it anywhere a `circle-*` is meant.
 */

/** The raw inner markup of each glyph, exactly as lucide-static ships it. */
export const LICON = {
  circleDot: '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="12" r="10"/>',
  flag: '<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  calendarPlus: '<path d="M16 18h6"/><path d="M16 2v3"/><path d="M19 15v6"/><path d="M21 11.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8.3"/><path d="M3 9h18"/><path d="M8 2v3"/>',
  circleCheck: '<circle cx="12" cy="12" r="10"/><path d="m16 9-5.5 5.5L8 12"/>',
  triangleAlert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  circleX: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  house: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  calendarCheck: '<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="m9 15 2 2 4-4"/>',
  circleAlert: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  settings: '<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/>',
  building2: '<path d="M10 12h4"/><path d="M10 8h4"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"/><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/>',
  calendar: '<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>',
  calendarRange: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M16 2v3"/><path d="M3 9h18"/><path d="M8 2v3"/><path d="M17 13h-6"/><path d="M13 17H7"/><path d="M7 13h.01"/><path d="M17 17h.01"/>',
  calendarDays: '<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M8 13h.01"/><path d="M12 13h.01"/><path d="M16 13h.01"/><path d="M8 17h.01"/><path d="M12 17h.01"/><path d="M16 17h.01"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  moon: '<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>',
  monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
  bookOpen: '<path d="M12 5v16"/><path d="M20.001 19A2 2 0 0022 17V5a2 2 0 0 0-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z"/>',
  fileText: '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  slidersHorizontal: '<path d="M10 5H3"/><path d="M12 19H3"/><path d="M14 3v4"/><path d="M16 17v4"/><path d="M21 12h-9"/><path d="M21 19h-5"/><path d="M21 5h-7"/><path d="M8 10v4"/><path d="M8 12H3"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  phone: '<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/>',
  hammer: '<path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  arrowUpDown: '<path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="m21 8-4-4-4 4"/><path d="M17 4v16"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  calendarCheck2: '<path d="M 19 3 L 5 3"/><path d="M 21 13 L 21 5"/><path d="M 21 5 A2 2 0 0 0 19 3"/><path d="M 3 19 A2 2 0 0 0 5 21"/><path d="M 3 5 L 3 19"/><path d="M 5 3 A2 2 0 0 0 3 5"/><path d="m16 19 2 2 4-4"/><path d="M16 2v3"/><path d="M3 9h18"/><path d="M5 21 L12.5 21"/><path d="M8 2v3"/>',
  mapPin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="M4.929 4.929 19.07 19.071"/>',
} as const

export type LIconName = keyof typeof LICON
