/**
 * The six heroicons paths the venue card draws.
 *
 * ⚠️ ITS OWN MODULE BECAUSE IT HAS TWO CONSUMERS. The admin `VenueCard` is the older one; the
 * client portal re-exports this as `VICON` (`src/client-portal/icons/vicon.ts`), because
 * `COMPONENT_INVENTORY.md` §2.5 requires a real import rather than a second copy.
 *
 * 🔴 THESE PATHS MUST BE CHARACTER-FOR-CHARACTER IDENTICAL ON BOTH SIDES, and that has already
 * failed once: four card icons were redrawn by hand, three came out "almost" right (`19.128`
 * became `19.1`) and the fourth was an empty `<rect>` where the admin has a framed mountain. The
 * three near misses passed review BECAUSE they were close — at 14px the eye cannot arbitrate,
 * only a string comparison can. One module removes the possibility instead of documenting it.
 *
 * A plain `.ts` file rather than living beside the component: a module that exports both a
 * component and a constant loses React Fast Refresh for the whole file.
 */
export const ICON = {
  photo:
    'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z',
  photoDetailed:
    'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
  closed:
    'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
  people:
    'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  pin: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z',
  pinOuter: 'M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
} as const

export type VenueIconName = keyof typeof ICON
