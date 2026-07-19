import { UI_STRINGS } from '@/constants/ui-strings-backend'
import type { AppAccess } from '@/lib/api-client'

const STYLES: Record<AppAccess, string> = {
  ALLOWED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  BLOCKED: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  UNREGISTERED: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300',
}

/**
 * A coloured pill for a LINE user's access state. Uses daisyUI's `badge` for the
 * shape/typography, with hand-tuned pastel colours (the `*-100`/`*-800` intent —
 * daisyUI's solid `badge-success`/`badge-warning` fail AA for small text: see the
 * governing color rule in 03_implement_log.md). The words come from
 * `UI_STRINGS.access`, shared with the access filter on `LineUsersPage`.
 */
export function AccessBadge({ access }: { access: AppAccess }) {
  return (
    <span className={`badge badge-sm border-none font-medium ${STYLES[access]}`}>
      {UI_STRINGS.access[access]}
    </span>
  )
}
