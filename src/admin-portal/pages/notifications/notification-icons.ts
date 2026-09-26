/**
 * The page's own heroicons `d` strings — copied verbatim from the prototype's notification route
 * (markup 6013–6388, row template 6779–6846). The GLYPHS a notification carries are not here; they
 * are the shell's `NotifGlyph`, because the bell draws the same fifteen.
 *
 * `as const` data in a non-component module, so the components importing it keep Fast Refresh.
 */
export const ICON = {
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  checkCircle: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  trash:
    'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0',
  envelopeOpen:
    'M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.98l7.5-4.04a2.25 2.25 0 012.134 0l7.5 4.04a2.25 2.25 0 011.183 1.98V19.5z',
  chevronRight: 'M9 5l7 7-7 7',
  dots: 'M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z',
  bellSlash:
    'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7M9.344 3.071a6.002 6.002 0 018.395 5.492M14.857 17.082a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0M3 3l18 18M4.5 8.25c0-.399.039-.789.113-1.167m-.851 8.689A8.967 8.967 0 006 9.75',
  /** The `.chk-box` tick (stroke 3) — the same one the amenity list draws. */
  tick: 'M4.5 12.75l6 6 9-13.5',
  /** The select-all box's third state: some of the page is ticked. */
  dash: 'M6 12h12',
} as const
