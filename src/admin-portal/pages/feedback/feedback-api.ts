/**
 * `ข้อเสนอแนะ/แจ้งปัญหา` — the three admin feedback routes, on the SHARED `api` client.
 *
 * ⚠️ NEVER A SECOND FETCH CLIENT (D-12). `api` already carries the credentials, the CSRF middleware
 * and — installed by `AuthProvider` — the 401 watcher that raises the session-expired dialog. A
 * client built here would silently skip all three.
 *
 * ⚠️ THE PATCH GOES THROUGH `withCsrfRetry`, like every other unsafe call in `api-client.ts`: a 403
 * from a rotated token is retried exactly once with a fresh one. A 403 that survives the retry is a
 * real refusal (a VIEWER, or a CSRF failure) and nothing was written.
 */

import { ApiError, api, withCsrfRetry } from '@/lib/api-client'
import type { components, paths } from '@/lib/api-types'
import type { FeedbackStatus, FeedbackType } from '../../labels'

export type FeedbackListItem = components['schemas']['AdminFeedbackListItemDto']
export type FeedbackDetail = components['schemas']['AdminFeedbackDetailDto']
export type FeedbackLog = components['schemas']['FeedbackLogDto']
export type FeedbackReporter = components['schemas']['AdminFeedbackReporterDto']
export type FeedbackCounts = components['schemas']['FeedbackCountsDto']
export type PaginatedFeedback = components['schemas']['PaginatedFeedbackResponseDto']
/** The three statuses a PATCH may send. `DISMISSED` is refused with a 400 (OQ-1). */
export type FeedbackUpdateStatus = components['schemas']['FeedbackUpdateStatus']
export type UpdateFeedbackBody = components['schemas']['UpdateFeedbackDto']

type ListQuery = NonNullable<paths['/api/v1/feedback']['get']['parameters']['query']>

/** 10, 20 or 50. Anything else is a 400, never a clamp — every ordinal is computed from it. */
export type FeedbackLimit = NonNullable<ListQuery['limit']>

/**
 * The `venueId` literal that filters `venueId IS NULL` — ปัญหาทั่วไป / ไม่ระบุสถานที่. It can
 * never collide with a real venue id (those are cuids). ⚠️ Not the same question as "all venues",
 * which is the ABSENCE of `venueId`; the two must never share a value.
 */
export const FEEDBACK_VENUE_GENERAL = 'general'

/**
 * The two single-string 400s the PATCH answers when there is nothing to record, mirrored from the
 * backend's `feedback.constants.ts` (and quoted in the generated 400 description). DTO-validation
 * 400s carry a `string[]` instead and are NOT these.
 */
const FEEDBACK_UPDATE_EMPTY = 'Provide a new status or a non-blank note.'
const FEEDBACK_NO_CHANGE = 'No change: the status is unchanged and the note is blank.'

/** The backend's `ErrorResponseDto.message` when it is a single string, else a generic fallback. */
function messageOf(error: unknown, response: Response): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message?: unknown }).message
    if (typeof m === 'string' && m.length > 0) return m
  }
  return `Request failed (${response.status})`
}

export interface ListFeedbackParams {
  page: number
  limit: FeedbackLimit
  /** Absent = the ทั้งหมด tab. */
  type?: FeedbackType
  status?: FeedbackStatus
  /** A venue id, `FEEDBACK_VENUE_GENERAL`, or absent for every venue. */
  venueId?: string
  /** Code, subject, reporter name. Trimmed and `#`-stripped server-side; blank is no filter. */
  q?: string
}

/**
 * One page of reports, plus `counts`.
 *
 * ⚠️ `counts` IS GLOBAL — computed over the whole table, unaffected by any filter or the page
 * (AC-8). `meta.total` is the FILTERED total, which is what the pager needs.
 */
export async function listFeedback(params: ListFeedbackParams): Promise<PaginatedFeedback> {
  const query: ListQuery = { page: params.page, limit: params.limit }
  if (params.type) query.type = params.type
  if (params.status) query.status = params.status
  if (params.venueId) query.venueId = params.venueId
  if (params.q && params.q.trim().length > 0) query.q = params.q.trim()

  const { data, error, response } = await api.GET('/api/v1/feedback', { params: { query } })
  if (!data) throw new ApiError(response.status, messageOf(error, response))
  return data
}

/** One report in full: photos (public URLs) and its log, `createdAt` ASC. */
export async function getFeedback(id: string): Promise<FeedbackDetail> {
  const { data, error, response } = await api.GET('/api/v1/feedback/{id}', {
    params: { path: { id } },
  })
  if (!data) throw new ApiError(response.status, messageOf(error, response))
  return data
}

/**
 * บันทึกการดำเนินการ — a status change, an internal note, or both. Answers the fresh detail with
 * the appended log. The author comes from the session, never from this body.
 *
 * The `x-csrf-token: ''` placeholder satisfies the generated type; `csrfMiddleware` overwrites it
 * with the real token (same idiom as the booking writes).
 */
export async function updateFeedback(
  id: string,
  body: UpdateFeedbackBody,
): Promise<FeedbackDetail> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.PATCH('/api/v1/feedback/{id}', {
      params: { path: { id }, header: { 'x-csrf-token': '' } },
      body,
    }),
  )
  if (!data) throw new ApiError(response.status, messageOf(error, response))
  return data
}

/**
 * The PATCH was refused because there was nothing to record — `FEEDBACK_NO_CHANGE` or
 * `FEEDBACK_UPDATE_EMPTY`. The dialog pre-empts both (AC-46), so reaching this means the record
 * moved under the operator: somebody else already set the status they picked.
 */
export function isNothingToSave(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    err.status === 400 &&
    (err.message === FEEDBACK_NO_CHANGE || err.message === FEEDBACK_UPDATE_EMPTY)
  )
}
