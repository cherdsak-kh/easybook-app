import type { DraftSlot } from './booking-form'
import { isDevGate } from '@/client-portal/hooks/useLiffGate'
import { ApiError, api } from '@/lib/api-client'
import type { components } from '@/lib/api-types'
import { getIdToken } from '@/lib/liff'

/**
 * The one write the client portal makes: `POST /api/v1/line-users/bookings` (`CLIENT-BOOKING-1`).
 *
 * Same seam and the same two reasons as `pages/venues/venues-api.ts` — the LINE ID token has to be
 * attached, and the DEV `?gate=` override has to be answered from a fixture because under it there
 * is no token to send. `isDevGate()` is imported, never re-derived.
 */

export type BookingRequest = components['schemas']['BookingRequestResponseDto']

const DEV_LATENCY_MS = 500
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function bearerToken(): string {
  const token = getIdToken()
  if (!token) throw new ApiError(401, 'No LINE ID token available.')
  return token
}

/**
 * Thai copy for every refusal this endpoint can produce (`I18N-ERR-1`). The backend answers in
 * English and none of it is shown.
 *
 * ⚠️ **409 IS TWO DIFFERENT FACTS AND THE SERVER SENDS ONE STATUS FOR BOTH** — the venue closed
 * while the form was open, or somebody's request was approved into the slot the reader chose. The
 * message names the second, because it is overwhelmingly the likelier one on a screen the reader
 * reached from an OPEN venue's CTA, and because it is the one with an action attached. A closed
 * venue also strands them: the detail screen they came from will now show the closed alert.
 *
 * ⚠️ 403 is the account, not the request. It means the gate let them in and their access changed
 * underneath — telling them to re-open the app is the only true instruction.
 */
export function messageFor(error: unknown): string {
  const status = error instanceof ApiError ? error.status : 0
  if (status === 400) return 'ข้อมูลคำขอไม่ถูกต้อง กรุณาตรวจสอบวันเวลาและรายละเอียดอีกครั้ง'
  if (status === 401) return 'เซสชัน LINE หมดอายุ กรุณาปิดและเปิดแอปพลิเคชันใหม่อีกครั้ง'
  if (status === 403) return 'บัญชีของคุณยังไม่ได้รับอนุญาตให้ยื่นคำขอ กรุณาเปิดแอปพลิเคชันใหม่อีกครั้ง'
  if (status === 404) return 'ไม่พบสถานที่นี้ในระบบแล้ว กรุณากลับไปเลือกสถานที่อีกครั้ง'
  if (status === 409)
    return 'ช่วงเวลาที่เลือกถูกจองไปแล้วระหว่างที่กรอกแบบฟอร์ม กรุณาเลือกช่วงเวลาอื่น'
  return 'ยื่นคำขอไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและลองใหม่อีกครั้ง'
}

/**
 * Submit the request.
 *
 * ⚠️ THERE IS NO `lineUserId` IN THE PAYLOAD AND THERE MUST NEVER BE ONE. The requester is the
 * verified `sub` on the bearer token; a body field would be an impersonation route, and the DTO
 * does not declare one so the server answers `400` to anything extra.
 *
 * ⚠️ NEITHER IS THERE A NAME, A PHONE, OR A MODE FLAG. `D-C18` reserves `requesterName` /
 * `contactPhone` for staff-created bookings and reads a LIFF request's from the registration; and
 * `D-C13` rule 2 says the two shapes differ only in `slots.length`, so there is nothing to declare.
 */
export async function submitBooking(
  venueId: string,
  purpose: string,
  attendees: number,
  slots: readonly DraftSlot[],
): Promise<BookingRequest> {
  const body = {
    venueId,
    purpose,
    attendees,
    slots: slots.map((s) => ({
      startAt: s.start.toISOString(),
      endAt: s.end.toISOString(),
    })),
  }

  if (isDevGate()) {
    await sleep(DEV_LATENCY_MS)
    return devResponse(body)
  }

  const { data, error, response } = await api.POST('/api/v1/line-users/bookings', {
    headers: { Authorization: `Bearer ${bearerToken()}` },
    body,
  })
  if (!data) throw new ApiError(response.status, extract(error, response))
  return data
}

// ---------------------------------------------------------------------------
// The `#/sent/:id` store.
// ---------------------------------------------------------------------------

const SENT_KEY = 'eb.client.sent'

/**
 * ── 🔴 WHY THE CONFIRMATION IS CACHED INSTEAD OF RE-READ ──
 *
 * The prototype's `enterSent` reads the request back out of `REQUESTS` by the id in the URL, and
 * says why in as many words: *"refresh the page and you must still see the same request, and LIFF's
 * back button must be able to return to it (`D-C3`) — a value passed through a variable is lost in
 * both cases."*
 *
 * That is the right rule and it needs `GET /line-users/bookings/:id`, which **does not exist**:
 * `TRANSPORT.md` §4 assigns it to `CLIENT-BOOKING-1`, and Phase 5a shipped only the submit and the
 * availability read. So the confirmation is stashed under its own code and read back by code, which
 * satisfies the same two requirements — a refresh and a LIFF back both find it — through the only
 * store available.
 *
 * ⚠️ `sessionStorage`, NOT `localStorage`. This is a receipt for one visit, not a record; it should
 * disappear with the tab rather than resurface in a session next week as the newest thing the app
 * remembers about the user.
 *
 * ⚠️ ONE ENTRY, NOT A LIST — replaced on every submit. A history of past requests is `#/bookings`
 * (Phase 6) reading the server, and a second, private, stale copy of that list is exactly the kind
 * of thing that starts disagreeing with the real one.
 *
 * ⚠️ EVERY ACCESSOR IS WRAPPED. Private mode, cleared site data and a storage-blocked WebView all
 * throw or return null here; the screen's answer to that is the same as its answer to a bad id —
 * back to `/venues`, never a half-drawn receipt.
 *
 * ⚠️ It is NOT a substitute for the endpoint. When Phase 6 adds the read, this pair should become a
 * cache in front of it, or go.
 */
export function rememberSent(request: BookingRequest): void {
  try {
    sessionStorage.setItem(SENT_KEY, JSON.stringify(request))
  } catch {
    /* A submitted request that cannot be stashed still succeeded. The screen falls back to the
       router state it was navigated with, and only then to `/venues`. */
  }
}

/** The stashed confirmation, but only when it is the one `code` asks for. */
export function recallSent(code: string): BookingRequest | null {
  try {
    const raw = sessionStorage.getItem(SENT_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isBookingRequest(parsed) || parsed.code !== code) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * ⚠️ SESSION STORAGE IS UNTRUSTED INPUT even though this app wrote it. A previous build's shape, a
 * half-written value, or anything a person typed into devtools arrives here as `unknown`, and a
 * screen that destructures it without asking renders `undefined` into a receipt.
 */
function isBookingRequest(value: unknown): value is BookingRequest {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.code === 'string' &&
    typeof v.venueName === 'string' &&
    typeof v.purpose === 'string' &&
    typeof v.attendees === 'number' &&
    Array.isArray(v.slots)
  )
}

function extract(error: unknown, response: Response): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message?: unknown }).message
    if (typeof m === 'string' && m) return m
  }
  return `Request failed (${response.status})`
}

// ---------------------------------------------------------------------------
// DEV fixture — reached only through `isDevGate()`, never in a real session.
// ---------------------------------------------------------------------------

/**
 * Mints the same shape the server does, including a `BR-<BE date>-NNN` code on Bangkok's calendar,
 * so the confirmation screen can be measured without a backend.
 *
 * ⚠️ THE SEQUENCE IS ALWAYS `001` and that is fine — nothing here counts anything. It exists so the
 * code has the right SHAPE, which is what the monospace column and the `#BR-…` search in Phase 6
 * are measured against.
 */
function devResponse(body: {
  venueId: string
  purpose: string
  attendees: number
  slots: { startAt: string; endAt: string }[]
}): BookingRequest {
  const now = new Date()
  const two = (n: number) => (n < 10 ? '0' : '') + n
  const code = `BR-${now.getFullYear() + 543}${two(now.getMonth() + 1)}${two(now.getDate())}-001`
  const starts = body.slots.map((s) => new Date(s.startAt).getTime())
  const ends = body.slots.map((s) => new Date(s.endAt).getTime())
  return {
    id: `dev-${now.getTime()}`,
    code,
    venueId: body.venueId,
    venueName: 'หอประชุมวารณ',
    purpose: body.purpose,
    attendees: body.attendees,
    status: 'PENDING',
    firstStartAt: new Date(Math.min(...starts)).toISOString(),
    lastEndAt: new Date(Math.max(...ends)).toISOString(),
    slots: body.slots.map((s, i) => ({
      id: `dev-slot-${i}`,
      startAt: s.startAt,
      endAt: s.endAt,
      // ⚠️ The cancellation triple travels together (Phase 6a). Nothing in the DEV gate cancels
      // anything, so all three are their freshly-submitted values — but they are spelled out rather
      // than omitted, because this fixture's whole job is to be shaped like the real response.
      isCancelled: false,
      cancelledAt: null,
      cancelReason: null,
    })),
    createdAt: now.toISOString(),
  }
}
