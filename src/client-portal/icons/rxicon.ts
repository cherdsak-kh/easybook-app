/**
 * `RXICON` — the RemixIcon registry. Ported from `client_portal_prototype.html` 3146–3149.
 *
 * Two glyphs: `contract-right-line` and `expand-left-line`, the enter/leave pair for a booking
 * slot's start and end.
 *
 * 🔴 A THIRD REGISTRY, ON PURPOSE. `LICON` carries a promise that every path in it came whole
 * out of lucide-static@1.37.0. Dropping an icon from another set into that bag makes the promise
 * false for the WHOLE registry, and the next person has no way to tell which entries can still
 * be traced back to a source.
 *
 * 🔴 THESE TWO ARE A PAIR, AND A PAIR MUST COME FROM ONE PLACE. Before this file existed the
 * paths were written inline in the request form's markup, and the "ends at" glyph drew its wall
 * on the opposite side from the "starts at" one for a full round with nothing to catch it. Both
 * the form and the detail screen now read these same two lines.
 *
 * ⚠️ The wall is on the RIGHT in both (`M19 4v16`); what differs is the arrow's direction —
 * entering runs toward the wall, leaving runs away from it. Direction is what separates them,
 * not colour: colour alone separates nothing for a colour-blind reader.
 */

export const RXICON = {
  enter: '<path d="M19 4v16M4 12h11m-4-4 4 4-4 4"/>',
  leave: '<path d="M19 4v16M15 12H5m4-4-4 4 4 4"/>',
} as const

export type RXIconName = keyof typeof RXICON
