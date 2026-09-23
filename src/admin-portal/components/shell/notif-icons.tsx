/**
 * The glyphs a notification row can carry, ported from the prototype's five rows.
 *
 * ⚠️ THE ICON IS NOT THE TONE. They line up one-to-one in the prototype's sample data and that
 * is a coincidence of the sample: a booking event is `calendar` whether it was approved (emerald)
 * or rejected (rose). Keying them together would collapse a two-axis vocabulary into one and make
 * a rejected booking impossible to draw. `NotifTone` lives in `lib/notifications.ts`; this file
 * knows nothing about it.
 *
 * ⚠️ `NOTIF_GLYPHS` is module-private for the same reason `nav-icons.tsx`'s map is: a module that
 * exports a component AND a plain constant loses Fast Refresh for the whole file (oxlint
 * `only-export-components`).
 */

import type { ReactElement } from 'react'

const NOTIF_GLYPHS = {
  /** Someone registered / a person needs attention. */
  'user-plus':
    'M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z',
  /** Anything about a booking or a date. */
  calendar:
    'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  /** The system itself is unwell. */
  warning:
    'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  /** Something completed. */
  check: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  /** Something was withdrawn or cancelled — by a person, not by a failure. */
  cancel: 'M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
} as const

export type NotifGlyphName = keyof typeof NOTIF_GLYPHS

/** Sized by `.notif-glyph` (18px), inside the row's 36px tinted tile. Always decorative. */
export function NotifGlyph({ name }: { name: NotifGlyphName }): ReactElement {
  return (
    <svg
      aria-hidden="true"
      className="notif-glyph"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={NOTIF_GLYPHS[name]} />
    </svg>
  )
}
