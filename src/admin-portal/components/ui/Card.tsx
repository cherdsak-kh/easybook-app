/**
 * The portal's card, in three parts — `pf-card` / `pf-head` / `pf-body` in the prototype,
 * where it backs three cards on โปรไฟล์ and three on ข้อมูลเวอร์ชันระบบ.
 *
 * `CardHead` takes an `action` rather than arbitrary children on the right, because every
 * head in the prototype is exactly "title (+ optional subtitle) on the left, at most one
 * control on the right". Leaving it open invited a second control that would then have had
 * no defined spacing.
 *
 * The heading LEVEL is a prop with no default beyond `h2`: a card inside a page that already
 * has an `h1` is an `h2`, but a card inside a modal whose title is the `h2` needs an `h3`,
 * and getting that wrong silently breaks the document outline a screen-reader user navigates
 * by. It is one prop; guessing it centrally would be wrong on one of the two.
 */

import type { ReactNode } from 'react'

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <section className={`pf-card ${className}`.trim()}>{children}</section>
}

export function CardHead({
  title,
  subtitle,
  action,
  as: Heading = 'h2',
  id,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  as?: 'h2' | 'h3'
  id?: string
}) {
  return (
    <div className="pf-head">
      <div className="min-w-0">
        {/* ⚠️ `.pf-title` / `.pf-note`, NOT the same utilities written out again. The first port
            spelled them by hand and substituted `th-tight` (1.45) for `.pf-note`'s `leading-[1.5]`
            — measured against the prototype at 18.85px against 19.5px on every card subtitle in
            the portal. Two copies of a measured value is one copy too many. */}
        <Heading id={id} className="pf-title">
          {title}
        </Heading>
        {subtitle && <p className="pf-note">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function CardBody({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`pf-body ${className}`.trim()}>{children}</div>
}

/**
 * A card body made of tappable rows instead of padded content — the "ตั้งค่า" list shape on
 * โปรไฟล์ and ข้อมูลเวอร์ชันระบบ. It has no padding of its own: `LinkRow` carries the
 * horizontal inset so a row's hover and focus ring reach the card's full width, which is
 * what makes the whole row read as one target rather than a link with a margin.
 */
export function CardRows({ children }: { children: ReactNode }) {
  return <div className="flex flex-col">{children}</div>
}
