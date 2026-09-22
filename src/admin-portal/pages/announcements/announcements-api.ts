/**
 * `ประกาศและข่าวสาร` — the two READ routes phase 3 uses, on the SHARED `api` client.
 *
 * ⚠️ NEVER A SECOND FETCH CLIENT (D-12, same rule as `feedback-api.ts`). `api` carries the
 * credentials, the CSRF middleware and the 401 watcher `AuthProvider` installs; a client built here
 * would silently skip all three. Phase 3 writes nothing, so there is no `withCsrfRetry` yet — create,
 * edit, delete and send arrive with the compose dialog in phase 4.
 */

import { ApiError, api } from '@/lib/api-client'
import type { components, paths } from '@/lib/api-types'

export type Announcement = components['schemas']['AnnouncementDto']
export type PaginatedAnnouncements = components['schemas']['PaginatedAnnouncementsResponseDto']
/** `all | sent | draft` — LOWERCASE, a different enum from the stored `AnnouncementStatus`. */
export type AnnouncementStatusFilter = components['schemas']['AnnouncementStatusFilter']
export type LineBotInfo = components['schemas']['LineBotInfoDto']

type ListQuery = NonNullable<paths['/api/v1/announcements']['get']['parameters']['query']>

/** 10, 20 or 50. Anything else is a 400, never a clamp. */
export type AnnouncementLimit = NonNullable<ListQuery['limit']>

/** The backend's `ErrorResponseDto.message` when it is a single string, else a generic fallback. */
function messageOf(error: unknown, response: Response): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message?: unknown }).message
    if (typeof m === 'string' && m.length > 0) return m
  }
  return `Request failed (${response.status})`
}

export interface ListAnnouncementsParams {
  page: number
  limit: AnnouncementLimit
  /** ALWAYS sent, `all` included (AC-4) — the tab is always one of the three. */
  status: AnnouncementStatusFilter
  /** Title only. Omitted when blank after trimming, so clearing the box removes `q` (AC-5). */
  q?: string
}

/**
 * One page, newest first. `meta.total` is the FILTERED total — the tab pills read it from two
 * dedicated `status=sent` / `status=draft` calls, because this route has no global `counts` block.
 *
 * Throws `ApiError(status, message)` on an HTTP failure. A network failure is thrown by openapi-fetch
 * as a plain `TypeError`, which the page's `kindOf` maps to `network`.
 */
export async function listAnnouncements(
  params: ListAnnouncementsParams,
): Promise<PaginatedAnnouncements> {
  const query: ListQuery = { page: params.page, limit: params.limit, status: params.status }
  const q = params.q?.trim()
  if (q) query.q = q

  const { data, error, response } = await api.GET('/api/v1/announcements', { params: { query } })
  if (!data) throw new ApiError(response.status, messageOf(error, response))
  return data
}

/* ── the LINE OA card ──────────────────────────────────────────────────────────────────────── */

/**
 * Why the card could not show the OA. Split by WHETHER AND HOW THE SERVER ANSWERED, because each
 * one tells the operator to do something different (plan D-5):
 *   · `not-configured` — 503 `LINE_NOT_CONFIGURED`: no token, or LINE refused it. Tell an admin.
 *   · `unavailable`    — 503 `LINE_BOT_INFO_UNAVAILABLE`: LINE is down or slow. Try again.
 *   · `server`         — anything else, INCLUDING a 503 with no `code` (the session store). It must
 *                        never be worded as a LINE problem, because it is not one.
 *   · `network`        — the request never reached a server.
 */
export type BotInfoFailure = 'not-configured' | 'unavailable' | 'server' | 'network'

export type BotInfoResult = { ok: true; value: LineBotInfo } | { ok: false; reason: BotInfoFailure }

/** What the page holds for the card, and all the card renders from. */
export type OaState =
  | { status: 'loading' }
  | { status: 'ok'; info: LineBotInfo; checkedAt: string }
  | { status: 'failed'; reason: BotInfoFailure }

/**
 * Reads `code` DEFENSIVELY.
 *
 * ⚠️ DO NOT TRUST THE GENERATED TYPE HERE. The 503 is typed `AnnouncementCodedErrorDto`, where
 * `code` is REQUIRED — but the session-store 503 is the house body with NO `code` at all, which the
 * spec states only in prose. Comparing `error.code === …` on the typed value would let TypeScript
 * narrow away the branch that actually happens.
 */
function codeOf(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const c = (error as { code?: unknown }).code
    return typeof c === 'string' ? c : undefined
  }
  return undefined
}

/**
 * The OA announcements are sent from. NEVER THROWS — the `getSystemVersion()` precedent: a failed
 * card must never take the page down with it, so the failure comes back as a value.
 *
 * A 401 lands in `server`; `AuthProvider`'s watcher raises the session-expired dialog over it, so it
 * is not special-cased. The shared `ApiError` is not changed (plan D-5).
 */
export async function getLineBotInfo(): Promise<BotInfoResult> {
  try {
    const { data, error, response } = await api.GET('/api/v1/announcements/line-bot-info')
    if (data) return { ok: true, value: data }
    if (response.status === 503) {
      const code = codeOf(error)
      if (code === 'LINE_NOT_CONFIGURED') return { ok: false, reason: 'not-configured' }
      if (code === 'LINE_BOT_INFO_UNAVAILABLE') return { ok: false, reason: 'unavailable' }
    }
    return { ok: false, reason: 'server' }
  } catch {
    // fetch rejected: no status at all.
    return { ok: false, reason: 'network' }
  }
}
