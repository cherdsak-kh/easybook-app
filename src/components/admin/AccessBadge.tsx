import type { AppAccess } from '@/lib/api-client'

const STYLES: Record<AppAccess, string> = {
  ALLOWED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  BLOCKED: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  UNREGISTERED: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300',
}

const LABELS: Record<AppAccess, string> = {
  ALLOWED: 'Allowed',
  BLOCKED: 'Blocked',
  PENDING: 'Pending',
  UNREGISTERED: 'Unregistered',
}

/** A coloured pill for a LINE user's access state. */
export function AccessBadge({ access }: { access: AppAccess }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[access]}`}
    >
      {LABELS[access]}
    </span>
  )
}
