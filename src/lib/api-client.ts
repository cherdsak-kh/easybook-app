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
  const { data } = await api.GET('/api/v1/health')
  if (!data) {
    throw new Error('Request failed: /api/v1/health')
  }
  return data
}
