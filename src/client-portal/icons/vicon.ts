/**
 * `VICON` — the heroicons registry shared with the ADMIN portal.
 *
 * 🔴 THIS FILE DEFINES NO PATHS. It re-exports the admin venue module's `ICON`, which is the one
 * copy. `COMPONENT_INVENTORY.md` §2.5 requires exactly that: "in React this becomes a real import
 * from the admin module, not a second copy".
 *
 * Why the rule is this strict — it has already been paid for once. Four card icons were drawn by
 * hand instead of lifted; three were "almost" right (`19.128` → `19.1`) and the fourth was an
 * empty `<rect>` where the admin has a framed mountain. The three near misses passed review
 * BECAUSE they were close. At 14px the eye cannot arbitrate; only a string comparison can, and an
 * import is a string comparison that can never go stale.
 *
 * ⚠️ KEPT SEPARATE FROM `LICON` DELIBERATELY. This set is heroicons; `LICON` is lucide at
 * `stroke-width: 2`. `LICON` carries `mapPin`, `users` and `image`, which are lucide twins of
 * `pin`+`pinOuter`, `people` and `photo` here — and the two sets must NEVER be substituted for
 * one another. Mixing them in one card gives two icon families side by side, visible as unequal
 * stroke weights. Which registry a screen draws from is a decision about which family it is in.
 *
 * ⚠️ The two portals share no CSS classes (`D-C1`), and this does not breach that: what crosses
 * the boundary is six path strings that are required to be identical, not a style vocabulary.
 */

export { ICON as VICON } from '@/admin-portal/pages/venues/components/venue-icons'
export type { VenueIconName as VIconName } from '@/admin-portal/pages/venues/components/venue-icons'
