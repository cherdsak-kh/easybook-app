/**
 * Class strings ประกาศและข่าวสาร shares between its list row and its compose dialog.
 *
 * A `.ts` of its own because a `.tsx` exporting a string constant next to its components trips
 * oxlint's `only-export-components` (the `announcement-icons.ts` reason).
 */

/**
 * The audience pill — the prototype's `badge badge-sm badge-outline`, written as utilities. The list
 * row and the preview's `ส่งถึง: …` line use it.
 *
 * ⚠️ NOT `.badge` (phase 3 design S-3): the portal's unlayered `[data-theme^="easybook-admin"] .badge`
 * sets `border-0`, which would erase the outline, and utilities cannot beat an unlayered rule. The
 * geometry matches the portal `.badge`; the border token is the one FeedbackPage's type chip uses.
 * `truncate` keeps a long department name inside the row at 390px.
 */
export const AUDIENCE_PILL =
  'inline-block max-w-full truncate rounded-full border border-base-content/20 px-2.5 py-1 align-middle text-[13px] font-medium text-base-content/80'
