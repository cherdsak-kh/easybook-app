import { LIcon } from '@/client-portal/icons/LucideIcon'

/**
 * The placeholder card for a screen that exists in the navigation but not yet in the product.
 * Prototype 1678–1688 (`#/issues`) and the twin at 2094–2165.
 *
 * Used by `#/issues`, `#/manual` and `#/rules` — three destinations `#/settings` links to and
 * that `Q-C5` keeps out of scope for this build. They are real routes with real headers and real
 * breadcrumbs precisely so that following the link does not look broken; only the body is
 * pending.
 *
 * ⚠️ `hammer`, NOT `clock`. `clock` already means "the time an activity runs" in the home card
 * and in the request form. Two clocks meaning different things in one app is a collision with
 * itself — the same lesson `circleCheck` versus `circle-check-big` taught here already.
 *
 * ⚠️ THE WAY OUT IS PART OF THE SCREEN. All three of these are reached from `#/settings`, and a
 * dead end with no labelled exit leaves the user to find LIFF's back arrow — which `D-C3` says
 * is the platform's job, but only when there is somewhere obvious to go. A named link to a
 * written destination is not the in-page back arrow `D-C3` bans; it does not race history.
 *
 * Copy is written inline, per `Q9`: the PO opens one file and sees the words next to the markup.
 */
export function UnderConstruction({
  /** Where the labelled exit goes. Defaults to Settings, which is where all three are linked from. */
  backTo = '/settings',
  backLabel = 'กลับสู่หน้าตั้งค่า',
}: {
  backTo?: string
  backLabel?: string
} = {}) {
  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body items-center gap-0 p-8 text-center">
        <span
          aria-hidden="true"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-base-200 text-base-content/60"
        >
          <LIcon name="hammer" className="h-7 w-7" />
        </span>
        <p className="mt-4 font-semibold">อยู่ระหว่างการพัฒนา</p>
        <p className="mt-1 text-sm text-base-content/70">
          หน้านี้กำลังอยู่ระหว่างการพัฒนา และจะพร้อมให้ใช้งานเร็ว ๆ นี้
        </p>
        <a href={backTo} className="btn btn-app btn-outline mt-6">
          {backLabel}
        </a>
      </div>
    </div>
  )
}
