import type { ReactNode } from 'react'
import type { BilingualLabel } from '@/constants/ui-strings-profile'

/**
 * The repeated label/value row shared by all three cards: stacked on mobile,
 * `sm:flex-row` with a fixed-width label column above it. Extracted so the layout
 * lives in ONE place instead of the prototypes' thirteen copies of the same markup.
 *
 * When the row wraps a real form control, pass `htmlFor` — the label renders as a
 * `<label htmlFor>` so clicking it focuses the control and screen readers announce
 * the pair. Without it the label column is a plain `<div>` (a `<label>` pointing at
 * nothing is worse than no label at all).
 */
export function ProfileFieldRow({
  label,
  htmlFor,
  wide,
  children,
}: {
  readonly label: BilingualLabel
  /** Id of the control this row labels. Omit for read-only value rows. */
  readonly htmlFor?: string
  /** Audit-trail proportions (1/4 label) instead of the default 1/3. */
  readonly wide?: boolean
  readonly children: ReactNode
}) {
  const labelClass = `w-full shrink-0 text-xs font-bold text-base-content sm:text-sm ${
    wide ? 'sm:w-1/4 sm:min-w-[200px]' : 'sm:w-1/3 sm:min-w-[150px]'
  }`
  const labelContent = (
    <>
      <span className="whitespace-nowrap">{label.th}</span>{' '}
      <span className="whitespace-nowrap text-[10px] font-normal opacity-75 sm:text-xs">
        ({label.en})
      </span>
    </>
  )

  return (
    <div className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:gap-4 sm:py-3">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={labelClass}>
          {labelContent}
        </label>
      ) : (
        <div className={labelClass}>{labelContent}</div>
      )}
      <div className={`w-full min-w-0 ${wide ? 'sm:w-3/4' : 'sm:w-2/3'}`}>{children}</div>
    </div>
  )
}

/** A read-only value inside a row. Wraps long Thai names/emails instead of overflowing. */
export function ProfileFieldValue({ children }: { readonly children: ReactNode }) {
  return <p className="wrap-break-word text-xs sm:text-sm">{children}</p>
}
