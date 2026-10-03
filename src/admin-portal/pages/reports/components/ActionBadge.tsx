/**
 * Hub 5's action pill: the four booking DECISIONS are filled-tint badges (emerald, rose, amber, sky: the
 * hues คำขอจองสถานที่ already gives those outcomes), the three administrative changes are the OUTLINED
 * neutral `.act-chip`. Shape, not an invented purple, separates "a decision about a booking" from "a
 * change to the system"; the glyph and the label separate the three changes from each other.
 *
 * The tone → class mapping is `Badge`'s (`AUDIT_ACTION` in `labels.ts` is the page's translation of an
 * enum into a tone, which `Badge` must not know).
 */

import type { AuditAction } from '@/lib/api-client'
import { AUDIT_ACTION } from '../../../labels'
import { Badge } from '../../../components/ui/Badge'

export function ActionBadge({ action, className = '' }: { action: AuditAction; className?: string }) {
  const a = AUDIT_ACTION[action]
  const body = (
    <>
      <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d={a.d} />
      </svg>
      <span>{a.label}</span>
    </>
  )
  if (a.tone === 'chip') return <span className={`act-chip gap-1 ${className}`.trim()}>{body}</span>
  return (
    <Badge tone={a.tone} className={`gap-1 ${className}`.trim()}>
      {body}
    </Badge>
  )
}
