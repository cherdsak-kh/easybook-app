// Local, self-contained avatar assets for the /admin-portal DashWind replica.
//
// Phase 3.6 follow-up: the replica's Team + Leads tables originally hotlinked
// `reqres.in/img/faces/*.jpg`, but that host is now DEAD — the avatar squircles
// rendered broken. The PO chose LOCAL SELF-CONTAINED avatars (renders 100% of the
// time, even with no internet). These 6 committed SVG tiles are distinct gradient
// backgrounds behind a friendly person glyph; being SVG they ship zero-network and
// offline-safe. Each fills a 96x96 square so the `mask mask-circle` / `mask
// mask-squircle` crops cleanly with no transparent gaps.
//
// Each import resolves (via Vite's default `.svg` handling) to a hashed, bundled URL
// string — no `/src/...` path is hardcoded, so the build fingerprints/serves them.
// Consumers map avatar N -> person N by index (ADMIN_PORTAL_AVATARS[0] = person 1).
import avatar1 from './avatar-1.svg'
import avatar2 from './avatar-2.svg'
import avatar3 from './avatar-3.svg'
import avatar4 from './avatar-4.svg'
import avatar5 from './avatar-5.svg'
import avatar6 from './avatar-6.svg'

/** The 6 local avatar URLs, in order (index 0 -> avatar-1.svg -> person 1). */
export const ADMIN_PORTAL_AVATARS: readonly string[] = [
  avatar1,
  avatar2,
  avatar3,
  avatar4,
  avatar5,
  avatar6,
]
