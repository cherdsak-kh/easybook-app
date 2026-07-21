import type { AppAccess } from '@/lib/api-client'

/**
 * Maps a LINE user's `access` state to a daisyUI badge for the admin-portal Leads table.
 * LOCAL to `/admin-portal` — the legacy `components/admin/AccessBadge` was deleted in the
 * Phase 5 cutover, and this deliberately does NOT resurrect or import it.
 *
 * Uses daisyUI semantic badge tokens only (`badge-success` / `badge-warning` /
 * `badge-error` / `badge-ghost`), so it follows the active `dashwind-*` theme without any
 * `dark:` variant (design §3.4).
 */
const ACCESS_BADGE: Record<AppAccess, { readonly className: string; readonly label: string }> = {
  ALLOWED: { className: 'badge-success', label: 'Allowed' },
  PENDING: { className: 'badge-warning', label: 'Pending' },
  BLOCKED: { className: 'badge-error', label: 'Blocked' },
  UNREGISTERED: { className: 'badge-ghost', label: 'Unregistered' },
}

export function AccessBadge({ access }: { access: AppAccess }) {
  const { className, label } = ACCESS_BADGE[access]
  return <span className={`badge ${className}`}>{label}</span>
}
