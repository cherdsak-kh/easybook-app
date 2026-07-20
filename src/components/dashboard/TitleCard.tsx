// Adapted from DashWind (daisyui-admin-dashboard-template),
// https://github.com/robbins23/daisyui-admin-dashboard-template — MIT (c) 2022 Dashwind.
// See THIRD_PARTY_NOTICES.md. Ports `components/Cards/TitleCard.js` and folds in
// `components/Typography/Subtitle.js` (one `text-xl font-semibold` div — no
// standalone file needed). daisyUI `card`/`divider` classes are unchanged v4→v5.
import type { ReactNode } from 'react'

interface TitleCardProps {
  /** Card heading (the folded Subtitle). */
  readonly title: ReactNode
  readonly children: ReactNode
  /** Top-margin utility; defaults to `mt-6` like the template. */
  readonly topMargin?: string
  /** Optional right-aligned controls rendered in the heading row. */
  readonly topSideButtons?: ReactNode
}

/**
 * Shared card wrapper for the dashboard's charts and table. Surface is
 * `bg-base-100` (semantic token, no `dark:`) so it follows the active daisyUI
 * theme automatically.
 */
export function TitleCard({ title, children, topMargin, topSideButtons }: TitleCardProps) {
  return (
    <div className={`card w-full bg-base-100 p-6 shadow-xl ${topMargin ?? 'mt-6'}`}>
      <div className={`text-xl font-semibold ${topSideButtons ? 'inline-block' : ''}`}>
        {title}
        {topSideButtons && <div className="float-right inline-block">{topSideButtons}</div>}
      </div>

      <div className="divider mt-2" />

      <div className="h-full w-full bg-base-100 pb-6">{children}</div>
    </div>
  )
}
