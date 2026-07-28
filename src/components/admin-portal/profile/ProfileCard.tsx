import type { ReactNode } from 'react'
import type { BilingualLabel } from '@/constants/ui-strings-profile'

/**
 * One titled card on the Profile page. daisyUI 5 `card` + `card-body` + `card-title`
 * (skill: components/card.md) on a `<section>` so the page is a real landmark tree
 * rather than a pile of divs; `aria-labelledby` binds the section to its own heading.
 *
 * The prototypes' bare `border-b` (which resolves to a hard-coded default border)
 * becomes the semantic `border-base-300` so the rule holds in every daisyUI theme.
 */
export function ProfileCard({
  id,
  title,
  className,
  children,
}: {
  /** Heading id — also the `aria-labelledby` target and the card's test hook. */
  readonly id: string
  readonly title: BilingualLabel
  /** Grid placement (e.g. `md:col-span-2`), never colours. */
  readonly className?: string
  readonly children: ReactNode
}) {
  return (
    <section
      aria-labelledby={id}
      className={`card h-full w-full overflow-hidden bg-base-100 shadow-sm ${className ?? ''}`}
    >
      <div className="card-body w-full p-4 sm:p-6">
        <h2
          id={id}
          className="card-title mb-2 border-b border-base-300 pb-2 text-base sm:text-lg"
        >
          {title.th}{' '}
          <span className="text-xs font-normal opacity-70 sm:text-sm">({title.en})</span>
        </h2>
        <div className="flex w-full flex-col divide-y divide-base-200">{children}</div>
      </div>
    </section>
  )
}
