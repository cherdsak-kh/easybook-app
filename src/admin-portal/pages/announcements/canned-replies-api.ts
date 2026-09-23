/**
 * `ข้อความตอบกลับด่วน` — the four canned-reply routes (`/api/v1/canned-replies`, ANNOUNCE-API-5), on
 * the SHARED `api` client (ANNOUNCE-UI-6 design §2.1).
 *
 * The house rules of `announcements-api.ts` apply unchanged:
 *   · NEVER A SECOND FETCH CLIENT — `api` carries the credentials, the CSRF middleware and the 401
 *     watcher `AuthProvider` installs.
 *   · EVERY WRITE GOES THROUGH `withCsrfRetry` — a 403 from a rotated token is retried exactly once.
 *   · NOTHING HERE THROWS — every failure comes back as a `WriteFailure`, decoded by the SAME
 *     `failureOf` / `thrown` the announcements use (exported from there, never copied; design S-9).
 *
 * ⚠️ `code` IS READ AT RUNTIME, NEVER FROM THE GENERATED TYPE. The 400 is typed
 * `CannedReplyCodedErrorDto` with a REQUIRED `code`, but a validation 400 (the pipe's `string[]`)
 * has none — the same trap as the announcements 503.
 *
 * `@Roles`: GET is every role; POST / PATCH / DELETE are SUPER_ADMIN and ADMIN only. The card
 * renders no write control for a VIEWER, but the server is the control.
 */

import { api, withCsrfRetry } from '@/lib/api-client'
import type { components } from '@/lib/api-types'
import { failureOf, thrown, type WriteResult } from './announcements-api'

export type CannedReply = components['schemas']['CannedReplyDto']
export type CannedReplyErrorCode = components['schemas']['CannedReplyErrorCode']
/** Title + text only: POST never sends `sortOrder` (D-4), PATCH always sends both (never `{}`). */
export type CannedReplyInput = Required<
  Pick<components['schemas']['UpdateCannedReplyDto'], 'title' | 'text'>
>

/** Every reply (at most 5), a PLAIN array in the server's order. Every role; no CSRF (a GET). */
export async function listCannedReplies(): Promise<WriteResult<CannedReply[]>> {
  try {
    const { data, error, response } = await api.GET('/api/v1/canned-replies')
    return data ? { ok: true, value: data } : failureOf(response.status, error)
  } catch (err) {
    return thrown(err)
  }
}

/*
 * The `x-csrf-token: ''` placeholder satisfies the generated (required) header type;
 * `csrfMiddleware` overwrites it with the real token (the `announcements-api.ts` idiom).
 */

/** 201 — appended at the bottom by the server (no `sortOrder` sent). */
export async function createCannedReply(body: CannedReplyInput): Promise<WriteResult<CannedReply>> {
  try {
    const { data, error, response } = await withCsrfRetry(() =>
      api.POST('/api/v1/canned-replies', {
        params: { header: { 'x-csrf-token': '' } },
        body,
      }),
    )
    return data ? { ok: true, value: data } : failureOf(response.status, error)
  } catch (err) {
    return thrown(err)
  }
}

/** 200 — the edited reply. Always both fields, so `CANNED_REPLY_UPDATE_EMPTY` is unreachable. */
export async function updateCannedReply(
  id: string,
  body: CannedReplyInput,
): Promise<WriteResult<CannedReply>> {
  try {
    const { data, error, response } = await withCsrfRetry(() =>
      api.PATCH('/api/v1/canned-replies/{id}', {
        params: { path: { id }, header: { 'x-csrf-token': '' } },
        body,
      }),
    )
    return data ? { ok: true, value: data } : failureOf(response.status, error)
  } catch (err) {
    return thrown(err)
  }
}

/** 204, no body — success is read from the status. A HARD delete; nothing re-seeds. */
export async function deleteCannedReply(id: string): Promise<WriteResult<null>> {
  try {
    const { error, response } = await withCsrfRetry(() =>
      api.DELETE('/api/v1/canned-replies/{id}', {
        params: { path: { id }, header: { 'x-csrf-token': '' } },
      }),
    )
    return response.status === 204 ? { ok: true, value: null } : failureOf(response.status, error)
  } catch (err) {
    return thrown(err)
  }
}
