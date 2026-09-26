/**
 * `การแจ้งเตือน` — the six admin notification routes (`NOTIF-API-1`), on the SHARED `api` client.
 *
 * ⚠️ IT LIVES IN `lib/`, NOT UNDER `pages/notifications/`, because two surfaces call it: the topbar
 * bell (shell chrome, on every page) and the notification centre. A page-folder module imported by
 * the shell would be the shell depending on one of its own pages.
 *
 * ⚠️ NEVER A SECOND FETCH CLIENT. `api` already carries the credentials, the CSRF middleware and —
 * installed by `AuthProvider` — the 401 watcher that raises the session-expired dialog. A client
 * built here would silently skip all three.
 *
 * ⚠️ THE FOUR WRITES GO THROUGH `withCsrfRetry`, like every other unsafe call: a 403 from a rotated
 * token is retried exactly once with a fresh one. The `x-csrf-token: ''` placeholder only satisfies
 * the generated type; `csrfMiddleware` overwrites it on every unsafe verb. The token is NEVER sent in
 * a body — `forbidNonWhitelisted` would 400 the key before the middleware saw it.
 *
 * ⚠️ All three roles may call all six (`@Roles(SUPER_ADMIN, ADMIN, VIEWER)`). A VIEWER's writes touch
 * only its OWN receipts (read state and "delete for me"), never a notification row.
 *
 * PDPA: `title` and `body` carry names, positions and phone numbers. Nothing in this module or its
 * callers may `console.*` a row, a title, a body or a search term.
 */

import { ApiError, api, withCsrfRetry } from '@/lib/api-client'
import type { components, paths } from '@/lib/api-types'
import type { NotificationCategory } from '../labels'

export type AdminNotification = components['schemas']['AdminNotificationDto']
export type PaginatedAdminNotifications = components['schemas']['PaginatedAdminNotificationsResponseDto']
export type NotificationUnreadCount = components['schemas']['AdminNotificationUnreadCountDto']
export type NotificationTone = components['schemas']['AdminNotificationTone']
export type NotificationIcon = components['schemas']['AdminNotificationIcon']
export type NotificationPeriod = components['schemas']['AdminNotificationPeriod']

type ListQuery = NonNullable<paths['/api/v1/notifications']['get']['parameters']['query']>

/**
 * What `DELETE /notifications/bulk` may be asked to do — EXACTLY one of the two. Typed as a union so
 * a caller cannot build the "both" or "neither" body, which the server answers with a 400.
 */
export type DismissTarget = { ids: string[] } | { allRead: true }

/** The backend's `ErrorResponseDto.message` when it is a single string, else a generic fallback. */
function messageOf(error: unknown, response: Response): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message?: unknown }).message
    if (typeof m === 'string' && m.length > 0) return m
  }
  return `Request failed (${response.status})`
}

export interface ListNotificationsParams {
  /** 1-based. Absent = 1. */
  page?: number
  /** 1–50: the page sends 10/20/50, the bell 5, the read-probe 1. Outside the range is a 400. */
  limit?: number
  /** Absent = the ทั้งหมด tab. */
  category?: NotificationCategory
  /** The caller's own read state. `false` is a real filter, so it is tested with `!== undefined`. */
  isRead?: boolean
  period?: NotificationPeriod
  /**
   * Sent TRIMMED, and a blank one is not sent. The leading `#` is NOT stripped here — the server
   * strips one and re-trims (D-5), so `#BR-…` and `BR-…` already answer the same rows.
   */
  search?: string
}

/**
 * One page of the caller's notifications, newest first. `meta.total` is the FILTERED total.
 *
 * ⚠️ Only keys that are defined go on the query: an `isRead` of `false` is a filter, an absent one is
 * "both", and openapi-fetch would otherwise serialise whatever it is handed.
 */
export async function listNotifications(
  params: ListNotificationsParams,
): Promise<PaginatedAdminNotifications> {
  const query: ListQuery = {}
  if (params.page !== undefined) query.page = params.page
  if (params.limit !== undefined) query.limit = params.limit
  if (params.category !== undefined) query.category = params.category
  if (params.isRead !== undefined) query.isRead = params.isRead
  if (params.period !== undefined) query.period = params.period
  const term = params.search?.trim() ?? ''
  if (term !== '') query.search = term

  const { data, error, response } = await api.GET('/api/v1/notifications', { params: { query } })
  if (!data) throw new ApiError(response.status, messageOf(error, response))
  return data
}

/**
 * The caller's unread counts — `total` plus all four categories. THE one source of every unread
 * number on screen (D-10): the bell badge, its `N ใหม่` chip, its accessible name, the page's <h1>
 * pill and the five tab pills. Nothing counts rows locally.
 */
export async function getUnreadCount(): Promise<NotificationUnreadCount> {
  const { data, error, response } = await api.GET('/api/v1/notifications/unread-count')
  if (!data) throw new ApiError(response.status, messageOf(error, response))
  return data
}

/** Mark one read for the caller. Idempotent: an already-read row answers 200 and `readAt` stays. */
export async function markNotificationRead(id: string): Promise<AdminNotification> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.PATCH('/api/v1/notifications/{id}/read', {
      params: { path: { id }, header: { 'x-csrf-token': '' } },
    }),
  )
  if (!data) throw new ApiError(response.status, messageOf(error, response))
  return data
}

/** Mark one unread for the caller. Idempotent: an unread row answers 200 unchanged. */
export async function markNotificationUnread(id: string): Promise<AdminNotification> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.PATCH('/api/v1/notifications/{id}/unread', {
      params: { path: { id }, header: { 'x-csrf-token': '' } },
    }),
  )
  if (!data) throw new ApiError(response.status, messageOf(error, response))
  return data
}

/**
 * `POST /read-all` — with no `ids`, EVERY notification the caller can see (not just a page, not just
 * the bell's five); with `ids`, only those. Resolves to `updated`: the rows whose state actually
 * changed, so re-marking read rows answers 0 rather than an error.
 *
 * ⚠️ NO BODY AT ALL for "everything" — `body: undefined` makes openapi-fetch send none and set no
 * Content-Type. Never `{ ids: [] }`, which is a 400.
 */
export async function markNotificationsRead(ids?: string[]): Promise<number> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.POST('/api/v1/notifications/read-all', {
      params: { header: { 'x-csrf-token': '' } },
      body: ids ? { ids } : undefined,
    }),
  )
  if (!data) throw new ApiError(response.status, messageOf(error, response))
  return data.updated
}

/**
 * `DELETE /bulk` — "delete for ME": the rows stay for every other operator, and there is no undo.
 * `{ allRead: true }` ignores every list filter (every read row the caller can see, every tab and
 * page). Resolves to `deleted`.
 *
 * The JSON body on a DELETE is supported as-is (the `discardVenuePhoto` precedent): openapi-fetch
 * serialises `body` and sets `Content-Type` for any method.
 */
export async function dismissNotifications(target: DismissTarget): Promise<number> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.DELETE('/api/v1/notifications/bulk', {
      params: { header: { 'x-csrf-token': '' } },
      body: target,
    }),
  )
  if (!data) throw new ApiError(response.status, messageOf(error, response))
  return data.deleted
}
