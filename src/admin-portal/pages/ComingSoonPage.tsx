/**
 * The body of **24 of the 31 destinations** — one component, driven entirely by the route table.
 *
 * It keeps the full page furniture (breadcrumb → `<h1>` → subtitle → content card) rather than
 * the 404's bare centred card, because this IS the page — just without its body yet. The 404 is
 * a dead end and deliberately has no page identity; this has one.
 *
 * That also means a reviewer walking all 31 menu items reviews the heading block and the
 * breadcrumb depth 31 times instead of once — including the long Thai labels, which is exactly
 * where that layout breaks.
 *
 * ⚠️ ONE component for all 24. Do not fork it per route: every varying part already comes from
 * `ADMIN_PORTAL_ROUTES`, and a forked copy is a page that can disagree with the menu that
 * reaches it.
 */

import { useNavigate } from 'react-router-dom'
import { ComingSoon } from '../components/feedback/ComingSoon'
import { PageHeading } from '../components/shell/PageHeading'
import { HOME_LABEL, HOME_PATH, type AdminRoute } from '../routes'

export function ComingSoonPage({ route }: { route: AdminRoute }) {
  const navigate = useNavigate()

  return (
    <div className="card-shell lg:overflow-y-auto">
      <PageHeading route={route} descAtEveryWidth />
      <ComingSoon
        onBack={() => void navigate(-1)}
        // Never offer "go to ภาพรวมระบบ" while standing on ภาพรวมระบบ — `ComingSoon` drops the
        // link entirely when this is undefined.
        homeTo={route.label === HOME_LABEL ? undefined : HOME_PATH}
      />
    </div>
  )
}
