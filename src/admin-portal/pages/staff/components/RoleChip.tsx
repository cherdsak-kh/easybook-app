/**
 * `SystemRole` as a chip — deferred out of P1 and now due.
 *
 * It was held back because it converts a `SystemRole` into a colour, which `components/ui/` is
 * forbidden to know (CONVENTIONS §4 rule 3), and it is used on เจ้าหน้าที่ระบบ and nowhere else.
 * Its CSS came across in P1 under its own names — `.role-chip` plus `.role-super` / `.role-admin`
 * / `.role-viewer` in the unlayered block — so this file is only the markup that reads them.
 *
 * ⚠️ OUTLINED, where every `.badge` is FILLED, and that difference is the whole point.
 * เจ้าหน้าที่ระบบ is the one table with two closed vocabularies in adjacent columns — บทบาท and
 * สถานะ — and two filled chip columns give the eye two competing scan targets in a table whose
 * actual question is "who is suspended". Shape is what separates them.
 *
 * ⚠️ THE GLYPH IS PART OF THE IDENTITY, not decoration. Colour alone would carry the whole
 * distinction, and `.role-admin` is `--color-primary` while `.role-viewer` is `--color-info` —
 * a green/blue pair is exactly what the most common colour deficiency flattens.
 */

import type { SystemRole } from '../../../labels'
import { ROLE_LABEL } from '../../../labels'

/** Shield · pencil · eye — power, editing, looking. */
const GLYPH: Record<SystemRole, string> = {
  SUPER_ADMIN:
    'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
  ADMIN:
    'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z',
  VIEWER:
    'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
}

const TONE: Record<SystemRole, string> = {
  SUPER_ADMIN: 'role-super',
  ADMIN: 'role-admin',
  VIEWER: 'role-viewer',
}

/**
 * ⚠️ TWO PRESENTATIONS, ONE DECISION — the prototype's `paintRole()` fills both from the same
 * `--role-c`, and the class that sets it (`.role-super` / `.role-admin` / `.role-viewer`) is the
 * same in each. `chip` is the desktop table's outlined pill; `ink` is the phone card's third line,
 * where at 13px a bordered pill costs a line of its own.
 *
 * It is a variant rather than a second component because the alternative is two files that each
 * translate a `SystemRole` into a colour and a glyph — and the day one of them gains a fourth role,
 * the other still renders three.
 *
 * The `ink` layout classes are the prototype's own, from `#st-card-tpl`: `.role-ink` carries only
 * the colour.
 */
export function RoleChip({
  role,
  variant = 'chip',
  className = '',
}: {
  role: SystemRole
  variant?: 'chip' | 'ink'
  className?: string
}) {
  const shape =
    variant === 'ink' ? 'role-ink flex min-w-0 items-center gap-1 text-[13px]' : 'role-chip'
  return (
    <span className={`${shape} ${TONE[role]} ${className}`.trim()}>
      <svg
        aria-hidden="true"
        className="h-3.5 w-3.5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={GLYPH[role]} />
      </svg>
      <span className={variant === 'ink' ? 'truncate' : undefined}>{ROLE_LABEL[role]}</span>
    </span>
  )
}
