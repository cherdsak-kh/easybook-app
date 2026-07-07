import { useEffect, useState } from 'react'
import { getHealth, type HealthResponse } from '@/lib/api-client'

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; data: HealthResponse }
  | { kind: 'error'; message: string }

/**
 * Probes GET /api/v1/health and renders the result — the live proof that the
 * decoupled frontend and backend agree on the shared REST contract.
 */
export function HealthStatus() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let active = true
    getHealth()
      .then((data) => active && setState({ kind: 'ok', data }))
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

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
        Backend health
      </h2>

      {state.kind === 'loading' && (
        <p className="text-slate-500">Checking <code>/api/v1/health</code>…</p>
      )}

      {state.kind === 'error' && (
        <p className="text-red-600 dark:text-red-400">
          Unreachable: {state.message}
        </p>
      )}

      {state.kind === 'ok' && (
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
          <span className="font-medium text-green-700 dark:text-green-400">
            {state.data.status}
          </span>
          <span className="text-sm text-slate-500">
            · uptime {state.data.uptime.toFixed(1)}s
          </span>
        </div>
      )}
    </div>
  )
}
