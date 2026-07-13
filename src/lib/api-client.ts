import createClient from 'openapi-fetch'
import type { components, paths } from './api-types'

/**
 * Typed API client generated from the backend's OpenAPI spec.
 * - Dev: empty baseUrl → same-origin `/api/...` requests hit the Vite proxy.
 * - Prod: set `VITE_API_URL` to the backend origin.
 *
 * Regenerate types after backend contract changes: `npm run gen:api`.
 */
const API_ORIGIN = import.meta.env.VITE_API_URL ?? ''

export const api = createClient<paths>({
  baseUrl: API_ORIGIN,
  headers: {
    // Bypass ngrok's free-tier browser-warning interstitial. No-op off-ngrok.
    'ngrok-skip-browser-warning': 'true',
  },
})

/** Response of GET /api/v1/health (from the generated OpenAPI schema). */
export type HealthResponse = components['schemas']['HealthResponseDto']

export async function getHealth(): Promise<HealthResponse> {
  // /health is a readiness gate: 200 (`status:'ok'`) when Postgres AND Redis are both
  // reachable, 503 (`status:'error'`) with the SAME body shape when either is down.
  // openapi-fetch routes a 2xx body to `data` and a non-2xx body to `error`; both are
  // valid readiness snapshots, so return whichever is present and let the caller branch
  // on `status`. Only a request that never lands (network error, non-JSON body) leaves
  // both undefined — that throws, surfacing as the caller's unreachable state.
  const { data, error, response } = await api.GET('/api/v1/health')
  const snapshot = data ?? error
  if (!snapshot) {
    throw new Error(`Request failed: /api/v1/health (${response.status})`)
  }
  return snapshot
}
