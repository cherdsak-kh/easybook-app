/**
 * `ส่งออกรายงาน`: the button in the header toolbar of Hubs 1 to 3 that opens Hub 4 on the range the
 * hub is showing. Prototype L7423 / L7838 / L8176, handlers L24666 / L25145 / L25464.
 *
 * ⚠️ ABSENT FROM THE DOM FOR A VIEWER, not hidden and not disabled (D-1, AC-E4): the prototype says
 * "hidden, not disabled" and means the same thing the menu row does, because a primary button that
 * answers with a redirect is a capability promised and refused. The export is an ACTION surface
 * (`ส่งออกรายงานราชการ` is in `VIEWER_DENY`); `acl.can` decides it here, and `@Roles` on the three
 * export routes is the control. This is UX, not security.
 *
 * It carries the hub's CURRENT range and mode/preset and the template that hub defaults to (D-10, via
 * `HUB_EXPORT_TEMPLATE`: Hub 1 แบบ 1, Hub 2 แบบ 3, Hub 3 แบบ 1). `disabled` while the hub's own range is
 * invalid: there is no range to carry. Leaving a hub resets its state (P2 AC-V2), so Back from Hub 4
 * shows the hub's default range; that is accepted, not a bug.
 *
 * It is the ONLY change Phase 3 makes to Hubs 1 to 3.
 */

import { useNavigate } from 'react-router-dom'
import { useAcl } from '../../../lib/use-acl'
import { useAuth } from '../../../lib/auth-context'
import { exportLinkOf, type ExportTemplateKey } from '../export-params'
import type { ReportMode } from '../report-presets'

const EXPORT_D =
  'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z'

export function ExportReportButton({
  template,
  mode,
  presetId,
  from,
  to,
  disabled,
}: {
  template: ExportTemplateKey
  mode: ReportMode
  presetId: string
  from: string
  to: string
  /** The hub's `validationError !== null`. */
  disabled: boolean
}) {
  const { user } = useAuth()
  const acl = useAcl(user!.role)
  const navigate = useNavigate()
  if (!acl.can('ส่งออกรายงานราชการ')) return null
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => void navigate(exportLinkOf({ template, mode, presetId, from, to }))}
      className="btn btn-primary min-h-11 flex-1 sm:flex-none"
    >
      <svg aria-hidden="true" className="h-4.5 w-4.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d={EXPORT_D} />
      </svg>
      ส่งออกรายงาน
    </button>
  )
}
