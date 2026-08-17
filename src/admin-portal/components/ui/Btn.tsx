/**
 * The portal's button, in the prototype's five variants.
 *
 * All five are `min-h-11` — 44px, the hit target the whole prototype was measured against.
 * That lives in the CSS class, not here, so a variant cannot quietly opt out of it.
 *
 * ⚠️ `type` defaults to `"button"`, NOT to the platform's `"submit"`. A bare <button> inside
 * a <form> submits it, which is how a password-reveal toggle once submitted a login form.
 * Every caller that DOES want submit says so.
 *
 * The disabled treatment is deliberately not in the shared classes. `.btn-primary2` is also
 * what every modal's confirm button uses while `useBusy` disables it for about a second, and
 * greying those for that long flickers. A caller that disables for MINUTES — the login form's
 * 429 cooldown — brings its own `disabled:` utilities, as the prototype does.
 */

import type { ButtonHTMLAttributes, Ref } from 'react'

export type BtnVariant = 'primary' | 'ghost' | 'danger' | 'warn' | 'danger-solid' | 'warn-solid'

const VARIANT_CLASS: Record<BtnVariant, string> = {
  primary: 'btn-primary2',
  ghost: 'btn-ghost2',
  danger: 'btn-danger2',
  warn: 'btn-warn2',
  'danger-solid': 'btn-danger-solid',
  'warn-solid': 'btn-warn-solid',
}

export function Btn({
  variant = 'ghost',
  type = 'button',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant
  /**
   * React 19 passes `ref` to a function component as an ordinary prop, so no `forwardRef` — but
   * `ButtonHTMLAttributes` does not include it, so without this line a caller holding a ref gets
   * a type error rather than a working ref.
   *
   * A caller needs one when the button must survive its own click: `disabled` BLURS the element
   * it is set on, and a busy button that is not re-focused afterwards drops a keyboard user on
   * `<body>` at the top of the document.
   */
  ref?: Ref<HTMLButtonElement>
}) {
  return (
    <button type={type} className={`${VARIANT_CLASS[variant]} ${className}`.trim()} {...rest}>
      {children}
    </button>
  )
}

/**
 * The square icon-only button used in table rows — 44×44, measured.
 *
 * `label` is REQUIRED and is not optional politeness: the button has no text, so without it
 * a screen reader announces "button" and nothing else. It doubles as the tooltip, because a
 * sighted operator facing an unlabelled icon has the same problem in a different form.
 */
export function IconBtn({
  label,
  tone,
  tipPos,
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  tone?: 'view' | 'edit'
  tipPos?: 'bottom' | 'left'
}) {
  const toneClass = tone === 'view' ? 'icon-btn-view' : tone === 'edit' ? 'icon-btn-edit' : ''
  return (
    <button
      type={type}
      aria-label={label}
      data-tip={label}
      data-tip-pos={tipPos}
      className={`icon-btn ${toneClass} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  )
}
