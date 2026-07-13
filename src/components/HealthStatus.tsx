import { useEffect, useState } from 'react'
import { getHealth, type HealthResponse } from '@/lib/api-client'

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; data: HealthResponse }
  | { kind: 'error'; message: string }

/** The dependencies the readiness probe reported as down, in human-readable form. */
function downDependencies(data: HealthResponse): string[] {
  const down: string[] = []
  if (data.db === 'down') down.push('Database')
  if (data.redis === 'down') down.push('Redis')
  return down
}

/**
 * Probes GET /api/v1/health and renders the result — the live proof that the
 * decoupled frontend and backend agree on the shared REST contract.
 *
 * The endpoint is a *readiness* gate, so there are three meaningful outcomes:
 *  - 200 `status: 'ok'`    → healthy (Postgres and Redis both reachable)
 *  - 503 `status: 'error'` → degraded/down; the body names the offending dependency
 *    via `db` / `redis`, which `getHealth` surfaces instead of throwing
 *  - the request never lands → unreachable (network / unknown error)
 */
export function HealthStatus() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let active = true
    getHealth()
      .then((data) => active && setState({ kind: 'ready', data }))
      .catch(
        (err: unknown) =>
          active &&
          setState({
            kind: 'error',
            message: err instanceof Error ? err.message : 'Unknown error',
          }),
      )
    return () => {
      active = false
    }
  }, [])

  const degraded = state.kind === 'ready' && state.data.status !== 'ok'

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
        Backend health
      </h2>

      {/* Reserve a row height so swapping states never shifts the surrounding layout. */}
      <div className="flex min-h-6 items-center gap-2">
        {state.kind === 'loading' && (
          <p className="flex items-center gap-2 text-slate-500" role="status">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-full bg-slate-300 motion-safe:animate-pulse dark:bg-slate-600"
            />
            <span>
              Checking <code>/api/v1/health</code>…
            </span>
          </p>
        )}

        {state.kind === 'error' && (
          <p className="text-red-600 dark:text-red-400" role="alert">
            Unreachable: {state.message}
          </p>
        )}

        {state.kind === 'ready' && !degraded && (
          <div className="flex items-center gap-2" role="status">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-full bg-green-500"
            />
            <span className="font-medium text-green-700 dark:text-green-400">
              Healthy
            </span>
            <span className="text-sm text-slate-500">
              · uptime {state.data.uptime.toFixed(1)}s
            </span>
          </div>
        )}

        {state.kind === 'ready' && degraded && (
          <DegradedStatus data={state.data} />
        )}
      </div>
    </div>
  )
}

/** The 503 readiness-failure state: warns and names which dependency is down. */
function DegradedStatus({ data }: { data: HealthResponse }) {
  const down = downDependencies(data)
  const label = down.length >= 2 ? 'System Down' : 'Degraded'
  const detail =
    down.length > 0
      ? `${down.join(' and ')} unavailable`
      : 'A dependency is unavailable'

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1" role="alert">
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500"
      />
      <span className="font-medium text-amber-700 dark:text-amber-400">
        {label}
      </span>
      <span className="text-sm text-amber-700 dark:text-amber-400">
        · {detail}
      </span>
    </div>
  )
}
