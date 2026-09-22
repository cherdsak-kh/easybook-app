/**
 * `การเชื่อมต่อระบบ` — the five routes under `/api/v1/system/integrations` (INTEGRATIONS-API-1), on the
 * SHARED `api` client.
 *
 * The house rules of `announcements-api.ts` apply unchanged:
 *   · NEVER A SECOND FETCH CLIENT — `api` carries the credentials, the CSRF middleware and the 401
 *     watcher `AuthProvider` installs.
 *   · EVERY NON-GET GOES THROUGH `withCsrfRetry` — including the two probes: they are POSTs.
 *   · NOTHING HERE THROWS — every failure is a `WriteFailure`, decoded by the SAME `failureOf` /
 *     `thrown` the announcements use.
 *
 * `@Roles`: GET and both probes are SUPER_ADMIN + ADMIN; the two PATCHes are SUPER_ADMIN only. VIEWER
 * is 403 on everything, and never reaches the page (`VIEWER_DENY`). The server is the control.
 *
 * ⚠️ `code` IS READ AT RUNTIME. The verify 503 is typed with a required `code`, but a 503 from a dead
 * session store has none.
 */

import { api, withCsrfRetry } from '@/lib/api-client'
import type { components } from '@/lib/api-types'
import { failureOf, thrown, type WriteResult } from '../announcements/announcements-api'

export type SystemIntegrations = components['schemas']['SystemIntegrationsResponseDto']
export type LineVerifyResult = components['schemas']['LineVerifyResponseDto']
export type StorageProbeResult = components['schemas']['StorageProbeResponseDto']
export type LineIntegrationInput = components['schemas']['UpdateLineIntegrationDto']

/** Fail-soft on the server: LINE / DB / Redis trouble arrives as null / `error` fields in a 200. */
export async function getIntegrations(): Promise<WriteResult<SystemIntegrations>> {
  try {
    const { data, error, response } = await api.GET('/api/v1/system/integrations')
    return data ? { ok: true, value: data } : failureOf(response.status, error)
  } catch (err) {
    return thrown(err)
  }
}

/*
 * The `x-csrf-token: ''` placeholder satisfies the generated (required) header type;
 * `csrfMiddleware` overwrites it with the real token (the `announcements-api.ts` idiom).
 */

/** SUPER_ADMIN. Applied to the next `/docs` request, no restart. Answers the stored value. */
export async function setSwaggerEnabled(enabled: boolean): Promise<WriteResult<boolean>> {
  try {
    const { data, error, response } = await withCsrfRetry(() =>
      api.PATCH('/api/v1/system/integrations/swagger', {
        params: { header: { 'x-csrf-token': '' } },
        body: { enabled },
      }),
    )
    return data ? { ok: true, value: data.enabled } : failureOf(response.status, error)
  } catch (err) {
    return thrown(err)
  }
}

/** SUPER_ADMIN. Omitted fields are kept ("blank = keep" is the form's job). Answers the masked id. */
export async function updateLineIntegration(
  body: LineIntegrationInput,
): Promise<WriteResult<string | null>> {
  try {
    const { data, error, response } = await withCsrfRetry(() =>
      api.PATCH('/api/v1/system/integrations/line', {
        params: { header: { 'x-csrf-token': '' } },
        body,
      }),
    )
    return data ? { ok: true, value: data.maskedChannelId } : failureOf(response.status, error)
  } catch (err) {
    return thrown(err)
  }
}

/** Bot info + quota — three LINE reads, nothing sent. 503 `LINE_NOT_CONFIGURED` / `LINE_UNAVAILABLE`. */
export async function verifyLine(): Promise<WriteResult<LineVerifyResult>> {
  try {
    const { data, error, response } = await withCsrfRetry(() =>
      api.POST('/api/v1/system/integrations/line/verify', {
        params: { header: { 'x-csrf-token': '' } },
      }),
    )
    return data ? { ok: true, value: data } : failureOf(response.status, error)
  } catch (err) {
    return thrown(err)
  }
}

/** Always a 200 when it ran — `ok: false` is an answer, not an error. */
export async function probeStorage(): Promise<WriteResult<StorageProbeResult>> {
  try {
    const { data, error, response } = await withCsrfRetry(() =>
      api.POST('/api/v1/system/integrations/storage/probe', {
        params: { header: { 'x-csrf-token': '' } },
      }),
    )
    return data ? { ok: true, value: data } : failureOf(response.status, error)
  } catch (err) {
    return thrown(err)
  }
}
