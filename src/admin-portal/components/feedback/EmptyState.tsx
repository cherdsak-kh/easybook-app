/**
 * "The query ran and matched nothing."
 *
 * ⚠️ THIS IS NOT THE FILTER-MISS PANEL, and the prototype says so twice in its own markup.
 * "ยังไม่มี… ในระบบ" and "ไม่มีรายการที่ตรงกับตัวกรอง" are different facts, and on the
 * registration queue the difference has a cost: an empty queue means no work is waiting,
 * which is a thing an operator will act on. Telling them that when really they have a filter
 * on is a wrong answer to the question they were asking. A filter miss belongs to the page
 * that owns the filters, next to a control that clears them.
 *
 * `icon` has no default. Every empty state in the prototype draws the THING that is missing
 * — people for registrations, a tag for options — and a generic tray glyph would say only
 * "nothing here", which the heading already says in words.
 */

import type { ReactNode } from 'react'

export function EmptyState({
  icon,
  title,
  description,
  actions,
  as: Heading = 'h2',
}: {
  icon: ReactNode
  title: string
  description?: string
  /** Usually one or two buttons. Omit entirely when there is nothing useful to offer. */
  actions?: ReactNode
  as?: 'h2' | 'h3'
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-base-200 text-base-content/60">
        {icon}
      </div>
      <Heading className="text-[18px] font-semibold text-base-content th-tight">{title}</Heading>
      {description && (
        <p className="mt-1.5 max-w-sm text-[14px] text-base-content/70 th-tight">{description}</p>
      )}
      {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  )
}
