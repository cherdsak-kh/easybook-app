/**
 * The glyphs คำขอจองสถานที่ draws, as bare `d` strings. `<BookingGlyph>` renders them.
 *
 * Same `ICON` table การลงทะเบียน and สถานที่จัดกิจกรรม keep, with one difference: theirs are local
 * to a single page file, and this screen is four files, so the table has to be importable.
 *
 * ⚠️ IT IS A `.ts`, AND THE COMPONENT IS A SEPARATE `.tsx`, deliberately. A module that exports both
 * a constant and a component trips `react/only-export-components` — Fast Refresh cannot hot-swap a
 * file whose exports are mixed, so an edit here would reload the whole route instead of the piece.
 *
 * ⚠️ EVERY GLYPH HERE IS DECORATIVE. Each one sits beside text that already says the same thing, so
 * `aria-hidden` is unconditional in the renderer rather than a prop. An icon that must be announced
 * is a button with an `aria-label`, and that label belongs on the button.
 */

export const ICON = {
  refresh:
    'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  /** ตรวจสอบข้อมูล — a READ. Sky, per `.icon-btn-view`; a VIEWER keeps this button. */
  eye: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z',
  eyeInner: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  chevron: 'M9 5l7 7-7 7',
  caret: 'M19 9l-7 7-7-7',
  /** The venue's tile. A MARKER that says "a place" — not a 32px crop of a gymnasium, which is not
   *  recognisable; photographs do their job on สถานที่จัดกิจกรรม's cards. */
  building:
    'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21',
  /** เรียงลำดับ. Bars plus a down arrow: which AXIS at a glance, before the caption is read. */
  sort: 'M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0l-3.75-3.75M17.25 21L21 17.25',
  /** The clipboard on the "nothing in the system yet" panel — the thing that is missing. */
  clipboard:
    'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z',
  /**
   * The circled tick — inbox zero on the empty รอพิจารณา tab, and the อนุมัติ glyph on the detail
   * dialog's footer button, its confirm button and its tile. ONE path for one meaning: an empty
   * queue and an approval are both "this is settled".
   */
  check: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  /** ปฏิเสธ — a circled ✕. NOT the ban glyph below: refusing a request is not revoking a booking. */
  reject: 'M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  /** ยกเลิกการจอง — the slashed circle: "not available any more", on a booking that already existed. */
  ban: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
  /** The circled `!` every field error and every `.inline-alert` in this portal carries. */
  alert: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z',
  /** ADR-001's triangle. Warning, never error — nobody did anything wrong by choosing a winner. */
  warning:
    'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  /** The bare tick drawn inside a `.chk-box`, at `h-3.5` — the same one the venue form uses. */
  tick: 'M4.5 12.75l6 6 9-13.5',
  /** `+` — the header's สร้างคำจองสถานที่ button and the create dialog's เพิ่มวัน. */
  plus: 'M12 4.5v15m7.5-7.5h-15',
  /** `✕` — removing one date from the multi-date chip list. */
  close: 'M6 18L18 6M6 6l12 12',
  /**
   * The bookmark on สร้างการจอง. NOT the tick: อนุมัติ answers somebody else's request, and this
   * one FILES a booking of your own — two different acts should not share a glyph on one screen.
   */
  save: 'M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9',
} as const
