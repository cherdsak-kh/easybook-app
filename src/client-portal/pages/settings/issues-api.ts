import { isDevGate } from '@/client-portal/hooks/useLiffGate'
import { getVenue } from '@/client-portal/pages/venues/venues-api'
import { ApiError, api } from '@/lib/api-client'
import type { components } from '@/lib/api-types'
import { getIdToken } from '@/lib/liff'

/**
 * The two writes `#/issues` makes (`CLIENT-ISSUE-1`, `02_design_log.md` §4).
 *
 * Same seam and the same two reasons as `pages/settings/settings-api.ts`: the LINE ID token has to
 * be attached (these are bearer routes, not the back-office cookie session), and the DEV `?gate=`
 * override has to be answered from a fixture because under it there is no token to send.
 * `isDevGate()` is imported, never re-derived — one copy of a security condition.
 *
 * ── ⚠️ NO CSRF HEADER ON EITHER CALL, AND THAT IS NOT AN OVERSIGHT ──
 * Both paths are literals in the service's `CSRF_EXEMPT_PATHS` (`02_design_log.md` §5, `AC-41`).
 * They are bearer-authenticated with no ambient authority, so the double-submit token that protects
 * the admin cookie session does not apply. Calling `api.POST` directly rather than through the
 * back-office's `withCsrfRetry` wrapper is what keeps it that way — that wrapper would fetch a
 * session token this caller has no session for.
 *
 * ── 🔴 THE REFERENCE CODE IS THE SERVER'S, ALWAYS (`AC-37`) ──
 * `FeedbackResponseDto.code` is printed verbatim by the success dialog. There is no client-side
 * code generator here and there must never be one; `IS_TYPES[…].prefix` documents which prefix a
 * type produces, it does not build a string.
 */

export type Feedback = components['schemas']['FeedbackResponseDto']
export type CreateFeedback = components['schemas']['CreateFeedbackDto']

const DEV_LATENCY_MS = 500
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function bearerToken(): string {
  const token = getIdToken()
  if (!token) throw new ApiError(401, 'No LINE ID token available.')
  return token
}

// ---------------------------------------------------------------------------
// Thai copy — `I18N-ERR-1`. The backend answers in English and none of it is shown.
// ---------------------------------------------------------------------------

/**
 * The submit call's refusals, mapped from the STATUS CODE (`02_design_log.md` §7.3).
 *
 * ⚠️ 400 IS THE ONE THE USER CANNOT ACT ON. Every rule this endpoint enforces is enforced on this
 * side too (length, trim, count), so a 400 that is not the venue case means the two sides have
 * drifted — the copy therefore asks them to check and retry rather than naming a field that looks
 * correct to them. The venue case is routed away before it reaches here; see {@link isVenueRefusal}.
 *
 * ⚠️ 502 IS RETRYABLE AND SAYS SO. LINE's verify endpoint or R2 was unreachable — nothing the user
 * typed is wrong, and `E-4` keeps the form intact so "ลองใหม่" costs one tap.
 */
export function messageFor(error: unknown): string {
  const status = error instanceof ApiError ? error.status : 0
  if (status === 400) return 'ข้อมูลที่กรอกไม่ถูกต้อง กรุณาตรวจสอบหัวข้อและรายละเอียดอีกครั้ง'
  if (status === 401) return 'เซสชัน LINE หมดอายุ กรุณาปิดและเปิดแอปพลิเคชันใหม่อีกครั้ง'
  if (status === 403) return 'บัญชีของคุณยังไม่ได้รับอนุญาตให้แจ้งเรื่อง กรุณาเปิดแอปพลิเคชันใหม่อีกครั้ง'
  return 'ส่งเรื่องไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและลองใหม่อีกครั้ง'
}

/**
 * `E-5` — was this 400 about the venue?
 *
 * The venue the user picked was soft-deleted between the page load and the submit. The server
 * answers **400, never 404** (`02_design_log.md` §4.1 step 2: the venue is an *input* to this write,
 * not the resource being addressed, and a 404 would be an enumeration oracle over `venues`). The
 * screen surfaces it **on the select** and refreshes the options — never a silent drop to
 * `ปัญหาทั่วไป`, which would file a specific report as a general one.
 *
 * ⚠️ IT MATCHES THE WORD, NOT THE WHOLE SENTENCE. `FEEDBACK_VENUE_INVALID` is one English string
 * today, but `class-validator`'s own refusals of `venueId` are different strings that mean the same
 * thing to this screen. Pinning the exact sentence would make a backend re-word show up here as a
 * generic error under the submit button instead of on the field it belongs to; matching `venue`
 * degrades to the generic message rather than to a wrong one.
 */
export function isVenueRefusal(error: unknown): boolean {
  return error instanceof ApiError && error.status === 400 && /venue/i.test(error.message)
}

/** What the venue select says when the server refused the id it was holding (`E-5`). */
export const VENUE_REFUSED_MESSAGE = 'สถานที่ที่เลือกไม่พร้อมใช้งานแล้ว กรุณาเลือกใหม่อีกครั้ง'

/**
 * The upload call's refusals (`E-2`). Every one of them ends the same way — the photo does **not**
 * enter the attached list — so the sentence names the file and what to do about it.
 *
 * ⚠️ A 400 HERE IS NOT THE USER'S FAULT IN THE USUAL CASE. Size and type are screened before the
 * request is made (`screenFiles`), so a 400 means the bytes disagreed with the declared type — a
 * renamed file, or a picker that lied. "ไฟล์นี้ใช้ไม่ได้" is true of both without guessing.
 */
export function photoMessageFor(error: unknown, name: string): string {
  const status = error instanceof ApiError ? error.status : 0
  if (status === 400) return `แนบ ${name} ไม่สำเร็จ — ไฟล์นี้ใช้ไม่ได้ กรุณาเลือกรูปอื่น`
  if (status === 401) return 'เซสชัน LINE หมดอายุ กรุณาปิดและเปิดแอปพลิเคชันใหม่อีกครั้ง'
  if (status === 403) return 'บัญชีของคุณยังไม่ได้รับอนุญาตให้แนบรูป กรุณาเปิดแอปพลิเคชันใหม่อีกครั้ง'
  return `แนบ ${name} ไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและลองใหม่อีกครั้ง`
}

// ---------------------------------------------------------------------------
// The two calls.
// ---------------------------------------------------------------------------

/**
 * Upload ONE photo and get its stored URL back (`AC-23`).
 *
 * 🔴 CALLED AS EACH FILE IS PICKED, NOT AT SUBMIT TIME. By the time the description is typed the
 * round trips are over, so the submit is a single small JSON write — and `E-3`'s rule ("block the
 * submit while any upload is in flight") is nearly always already satisfied when the button is
 * reached.
 *
 * ⚠️ THERE IS NO DISCARD ENDPOINT, deliberately (`02_design_log.md` §8). An abandoned object is
 * bounded at ≤ 3 × 5 MB per abandoned form and is collectable later; the venue flow's
 * stage-then-rehome machinery buys nothing here.
 */
export async function uploadFeedbackPhoto(file: File): Promise<string> {
  if (isDevGate()) {
    await sleep(DEV_LATENCY_MS)
    /* Shaped like a real key so the submit body and the dialog are exercised end to end. */
    return `https://dev.invalid/feedback/${Date.now().toString(16)}.jpg`
  }

  const { data, error, response } = await api.POST('/api/v1/line-users/feedback/photos', {
    headers: { Authorization: `Bearer ${bearerToken()}` },
    // The generated type calls `file` a binary string; the wire wants a File.
    body: { file: file as unknown as string },
    // Returning FormData makes openapi-fetch drop its JSON Content-Type so the browser sets the
    // multipart boundary itself.
    bodySerializer(body: { file: string }) {
      const form = new FormData()
      form.append('file', body.file as unknown as File)
      return form
    },
  })
  if (!data) throw new ApiError(response.status, extract(error, response))
  return data.url
}

/**
 * Submit the report.
 *
 * ⚠️ THERE IS NO `lineUserId` IN THE PAYLOAD AND THERE MUST NEVER BE ONE. The reporter is the
 * verified `sub` on the bearer token; a body field would be an impersonation route, and the DTO
 * does not declare one so the server answers 400 to anything extra (`forbidNonWhitelisted`).
 *
 * ⚠️ NEITHER IS THERE A `category` (`D-4`) NOR A `code` (`AC-37`). Both are 400s, and both
 * absences are the design.
 */
export async function submitFeedback(body: CreateFeedback): Promise<Feedback> {
  if (isDevGate()) {
    await sleep(DEV_LATENCY_MS)
    return devFeedback(body)
  }

  const { data, error, response } = await api.POST('/api/v1/line-users/feedback', {
    headers: { Authorization: `Bearer ${bearerToken()}` },
    body,
  })
  if (!data) throw new ApiError(response.status, extract(error, response))
  return data
}

function extract(error: unknown, response: Response): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message) return message
  }
  return `Request failed (${response.status})`
}

// ---------------------------------------------------------------------------
// DEV fixture — reached only through `isDevGate()`, never in a real session.
// ---------------------------------------------------------------------------

/**
 * Mints the same shape the server does, including an `ISS-<BE date>-NNN` code, so the success
 * dialog can be measured without a backend.
 *
 * ⚠️ THE SEQUENCE IS ALWAYS `001`, exactly as the booking fixture's is, and for the same reason:
 * nothing here counts anything. What the fixture owes is the SHAPE — the `font-mono` column and the
 * prefix a caller would read down a phone line.
 *
 * ⚠️ `venueName` IS RESOLVED THROUGH `getVenue`, not passed in by the caller. That keeps the fixture
 * honest about the one property `AC-28` depends on: the dialog renders what was PERSISTED, read
 * back out of the response, because the form has already been cleared by the time it opens.
 */
async function devFeedback(body: CreateFeedback): Promise<Feedback> {
  const now = new Date()
  const two = (n: number) => (n < 10 ? '0' : '') + n
  const prefix = body.type === 'FEEDBACK' ? 'FDB' : 'ISS'
  const venueName = body.venueId ? await devVenueName(body.venueId) : null
  return {
    id: `dev-${now.getTime()}`,
    code: `${prefix}-${now.getFullYear() + 543}${two(now.getMonth() + 1)}${two(now.getDate())}-001`,
    type: body.type,
    venueId: body.venueId ?? null,
    venueName,
    subject: body.subject,
    description: body.description,
    photos: body.photos ?? [],
    createdAt: now.toISOString(),
  }
}

async function devVenueName(id: string): Promise<string | null> {
  try {
    return (await getVenue(id)).name
  } catch {
    /* The fixture's own 404 path. A real server resolves the name inside the same transaction that
       validated the id, so this branch cannot happen against one. */
    return null
  }
}
