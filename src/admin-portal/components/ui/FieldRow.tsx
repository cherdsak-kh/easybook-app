/**
 * A label/value pair — `field-row` in the prototype, used in every modal, on โปรไฟล์ and on
 * ข้อมูลเวอร์ชันระบบ.
 *
 * It is a <div>, not a <dl>. A description list would be the semantically tidy answer for
 * one card, but these rows are also emitted one at a time inside modals that already sit in
 * other structures, and a <dt> outside a <dl> is worse than a neutral <div>. The label is
 * plain text with no `for`: there is no control to point at, only a value.
 *
 * Stacks under `sm`, sits on one line above it — the label column is a fixed 9rem there, so
 * values line up down the card instead of ragging against labels of different Thai lengths.
 */

import type { ReactNode } from 'react'

export function FieldRow({
  label,
  children,
  className = '',
}: {
  label: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`field-row ${className}`.trim()}>
      <span className="field-label">{label}</span>
      <span className="field-value">{children}</span>
    </div>
  )
}

/**
 * A whole tappable row inside a card — `pf-row`, the "เปลี่ยนรหัสผ่าน ›" shape.
 *
 * Renders a <button> by default and an <a>-like element only when the caller passes `href`,
 * because most of these open a modal rather than navigate. `min-h-[60px]` is in the class:
 * comfortably past the 44px minimum, which these get because they are the primary way
 * through those two pages.
 *
 * The chevron is decorative and marked so. The row's accessible name is its label; a
 * screen reader announcing "ไปต่อ" after every row would add nothing and repeat six times.
 */
export function LinkRow({
  icon,
  title,
  detail,
  trailing,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode
  title: ReactNode
  detail?: ReactNode
  trailing?: ReactNode
}) {
  return (
    <button type="button" className="pf-row" {...rest}>
      {icon && <span className="pf-row-ico">{icon}</span>}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-3">
        <span className="text-[15px] font-medium text-base-content th-tight">{title}</span>
        {detail && (
          <span className="text-[13px] text-base-content/70 th-tight">{detail}</span>
        )}
      </span>
      {trailing}
      <svg
        aria-hidden="true"
        className="h-5 w-5 shrink-0 text-base-content/40"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </button>
  )
}
