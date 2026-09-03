import type { Booking, BookingDetail, BookingSlot, BookingSort } from './booking-state'
import { isDevGate } from '@/client-portal/hooks/useLiffGate'
import { ApiError, api } from '@/lib/api-client'
import { getIdToken } from '@/lib/liff'

/**
 * The four calls `#/bookings` and `#/booking/:id` make (`CLIENT-BOOKING-2`).
 *
 * Same seam and the same two reasons as `pages/venues/venues-api.ts`: the LINE ID token has to be
 * attached (these are bearer routes, not the back-office cookie session), and the DEV `?gate=`
 * override has to be answered from a fixture because under it there is no token to send.
 * `isDevGate()` is imported, never re-derived — one copy of a security condition.
 *
 * ── ⚠️ WHAT IS SENT TO THE SERVER AND WHAT IS NOT ──
 * `q` and `sort` go over the wire because the endpoint implements exactly them. The **status filter
 * does not**, and that is not an oversight: the screen's four buckets are derived from the clock
 * (`booking-state.ts`), and `?status=APPROVED` would hand back last month's approved bookings for a
 * chip that means "approved and still ahead". Half-using a parameter is worse than not using it.
 */

const DEV_LATENCY_MS = 400
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function bearerToken(): string {
  const token = getIdToken()
  if (!token) throw new ApiError(401, 'No LINE ID token available.')
  return token
}

/**
 * Thai copy for every refusal these four can produce (`I18N-ERR-1`). The backend answers in English
 * and none of it is shown.
 *
 * 🔴 **422 IS THE ONE THAT NEEDS A REAL SENTENCE.** It means the state moved underneath the reader
 * — an operator approved the request while this screen was open, or somebody in another tab already
 * cancelled it, or the slot crossed into the lead-time window between the render and the tap. All
 * three are fixed by the same thing, which is looking again, so the message says that rather than
 * guessing which one happened.
 *
 * ⚠️ 404 IS ALSO "NOT YOURS" — the server answers a stranger's booking identically on purpose
 * (`code` is a guessable label). The copy must therefore not say "deleted", which would be a claim
 * about a row this user is not entitled to know exists.
 */
export function messageFor(error: unknown): string {
  const status = error instanceof ApiError ? error.status : 0
  if (status === 401) return 'เซสชัน LINE หมดอายุ กรุณาปิดและเปิดแอปพลิเคชันใหม่อีกครั้ง'
  if (status === 403) return 'บัญชีของคุณไม่มีสิทธิ์ดูรายการนี้ กรุณาเปิดแอปพลิเคชันใหม่อีกครั้ง'
  if (status === 404) return 'ไม่พบคำขอนี้ กรุณากลับไปที่รายการการจองของคุณ'
  if (status === 422)
    return 'สถานะของคำขอนี้เปลี่ยนไปแล้ว จึงยกเลิกด้วยวิธีนี้ไม่ได้ กรุณาโหลดหน้านี้ใหม่อีกครั้ง'
  return 'โหลดข้อมูลการจองไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและลองใหม่อีกครั้ง'
}

/** Raised when the detail read answers 404, so `#/booking/:id` can bounce to `/bookings` (`PAGE_INDEX.md` §2.3). */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}

// ---------------------------------------------------------------------------
// DEV fixtures — reached only through `isDevGate()`, never in a real session.
// ---------------------------------------------------------------------------

/**
 * Eight bookings, built from **offsets against the real clock** rather than fixed dates — the same
 * rule the venue fixture follows (`D-C16`'s note): pinned dates fall into the past within a week,
 * every row lands in the history bucket, and the screen then looks broken rather than stale.
 *
 * 🔴 THE SPREAD IS THE POINT. All six derived states are reachable, plus the three time-capsule
 * shapes and both cancellation layouts:
 *
 * | Row | Reaches |
 * |---|---|
 * | 001 | `pending`, one slot — the withdraw-immediately path (no lead time, `D-C13` r.4) |
 * | 002 | `approved`, three slots — the per-row "ยกเลิกวันนี้" layout, one already cancelled |
 * | 003 | `approved`, one slot starting in **15 minutes** — inside the lead time, so the button is *absent and explained* |
 * | 004 | `rejected` with a reason — the alert that sits ABOVE the details |
 * | 005 | `approved` in the past → `done` |
 * | 006 | `pending` in the past → `expired` (the state that cannot exist in the database) |
 * | 007 | every slot cancelled → `cancelled` |
 * | 008 | `approved`, one slot crossing midnight — the two-line enter/leave capsule |
 */
const MINUTE = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

function devSlot(id: string, startsIn: number, hours: number, cancelled = false): BookingSlot {
  const start = Date.now() + startsIn
  return {
    id,
    startAt: new Date(start).toISOString(),
    endAt: new Date(start + hours * HOUR).toISOString(),
    isCancelled: cancelled,
    cancelledAt: cancelled ? new Date(Date.now() - 2 * DAY).toISOString() : null,
    cancelReason: null,
  }
}

/**
 * A slot anchored to a **time of day**, N days out — not to "now plus N hours".
 *
 * 🔴 THE CROSS-MIDNIGHT FIXTURE HAS TO BE ANCHORED OR IT IS NOT A FIXTURE. Built as an offset from
 * the clock, a 22:00 span only crosses midnight when the developer happens to be running at the
 * right hour; measured at 01:43 it rendered as an ordinary same-day booking and the two-line
 * enter/leave capsule was silently untested. Found by measuring, not by reading.
 */
function devSlotAt(id: string, daysOut: number, hour: number, hours: number): BookingSlot {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const start = d.getTime() + daysOut * DAY + hour * HOUR
  return {
    id,
    startAt: new Date(start).toISOString(),
    endAt: new Date(start + hours * HOUR).toISOString(),
    isCancelled: false,
    cancelledAt: null,
    cancelReason: null,
  }
}

/* ⚠️ THE TYPE IS A PARAMETER, not a constant. A fixture in which every booking shares one venue
   type makes the type filter unreachable — the dropdown hides itself when there is only one
   option — and an unreachable control cannot be measured. */
function devVenue(name: string, location: string, type = 'หอประชุม') {
  return {
    id: 'v1',
    name,
    location,
    venueType: { id: 1, name: type, isFallback: false },
    photos: [],
  }
}

function devBooking(
  code: string,
  status: Booking['status'],
  createdDaysAgo: number,
  slots: BookingSlot[],
  rejectReason: string | null = null,
  venue = devVenue('หอประชุมวารณ', 'อาคารหอประชุม ชั้น 1'),
  purpose = 'ประชุมเตรียมงานกีฬาสี',
): Booking {
  const starts = slots.map((s) => new Date(s.startAt).getTime())
  const ends = slots.map((s) => new Date(s.endAt).getTime())
  return {
    id: `dev-${code}`,
    code,
    venue,
    purpose,
    attendees: 25,
    status,
    rejectReason,
    firstStartAt: new Date(Math.min(...starts)).toISOString(),
    lastEndAt: new Date(Math.max(...ends)).toISOString(),
    slots,
    createdAt: new Date(Date.now() - createdDaysAgo * DAY).toISOString(),
  }
}

const DEV_BOOKINGS: Booking[] = [
  devBooking('BR-25690903-001', 'PENDING', 1, [devSlot('s1', 3 * DAY + 2 * HOUR, 3)]),
  devBooking(
    'BR-25690903-002',
    'APPROVED',
    3,
    [
      devSlot('s2a', 4 * DAY + 8 * HOUR, 2),
      devSlot('s2b', 5 * DAY + 8 * HOUR, 2, true),
      devSlot('s2c', 6 * DAY + 8 * HOUR, 2),
    ],
    null,
    devVenue('ห้องประชุม ICT', 'อาคาร ICT ชั้น 3', 'ห้องประชุม'),
    'อบรมเชิงปฏิบัติการครูผู้ช่วย',
  ),
  devBooking(
    'BR-25690903-003',
    'APPROVED',
    2,
    [devSlot('s3', 15 * MINUTE, 2)],
    null,
    devVenue('Smart Classroom', 'อาคาร 4 ชั้น 2', 'ห้องเรียน'),
    'ประชุมสายชั้นมัธยมศึกษาปีที่ 3',
  ),
  devBooking(
    'BR-25690902-004',
    'REJECTED',
    5,
    [devSlot('s4', 2 * DAY + 9 * HOUR, 4)],
    'ช่วงเวลาดังกล่าวมีการจองซ้อนและได้อนุมัติให้กับคำขออื่นไปแล้ว',
    devVenue('โรงยิม 2', 'อาคารพลศึกษา ชั้น 2', 'โรงยิม'),
    'ซ้อมการแสดงเปิดงานกีฬาสี',
  ),
  devBooking(
    'BR-25690820-005',
    'APPROVED',
    20,
    [devSlot('s5', -12 * DAY, 3)],
    null,
    devVenue('สนามฟุตซอล', 'ด้านหลังอาคารพลศึกษา', 'สนามกีฬา'),
    'แข่งขันฟุตซอลภายใน',
  ),
  devBooking(
    'BR-25690818-006',
    'PENDING',
    24,
    [devSlot('s6', -16 * DAY, 2)],
    null,
    devVenue('ห้องสมุด ชั้น 2', 'อาคารห้องสมุด ชั้น 2', 'ห้องประชุม'),
    'กิจกรรมส่งเสริมการอ่าน',
  ),
  devBooking(
    'BR-25690828-007',
    'CANCELLED',
    9,
    [devSlot('s7', 9 * DAY + 13 * HOUR, 2, true)],
    null,
    devVenue('ลานหน้าเสาธง', 'บริเวณหน้าอาคารอำนวยการ', 'ลานกิจกรรม'),
    'ซ้อมพิธีเปิดกีฬาสี',
  ),
  devBooking(
    'BR-25690901-008',
    'APPROVED',
    4,
    [devSlotAt('s8', 8, 22, 4.5)],
    null,
    devVenue('หอประชุมวารณ', 'อาคารหอประชุม ชั้น 1'),
    'ค่ายพักแรมลูกเสือ–เนตรนารี',
  ),
]

/** The DEV lead time. Thirty, matching the `app_settings` seed — the real one arrives on the detail read. */
const DEV_LEAD_MINUTES = 30

/**
 * ⚠️ THE FIXTURE IS MUTATED IN PLACE BY THE DEV CANCEL PATHS, on purpose: a cancellation that did
 * not survive navigating away and back would make the one flow these screens exist for untestable
 * under `?gate=`, which is the only way to reach them without a LINE session.
 *
 * ⚠️ IT SURVIVES ROUTER NAVIGATION, NOT A PAGE RELOAD. `DEV_BOOKINGS` is a module-level array, so
 * a full reload rebuilds it and every cancellation is forgotten. That is the correct scope for a
 * fixture — measured, and worth writing down because the first reading of it looked like the list
 * failing to update when it was really the browser reloading the module.
 */
function devDetail(row: Booking): BookingDetail {
  return {
    ...row,
    venue: {
      ...row.venue,
      capacity: 900,
      isOpen: true,
      amenities: [
        { id: 1, name: 'เครื่องเสียง' },
        { id: 2, name: 'โปรเจกเตอร์' },
        { id: 3, name: 'เครื่องปรับอากาศ' },
      ],
    },
    approvedAt: row.status === 'APPROVED' ? new Date(Date.now() - DAY).toISOString() : null,
    cancelLeadMinutes: DEV_LEAD_MINUTES,
  }
}

/** Resolves by cuid or by code, with or without a leading `#` — exactly what the server accepts. */
function devFind(idOrCode: string): Booking | undefined {
  const key = idOrCode.trim().replace(/^#/, '')
  return DEV_BOOKINGS.find((b) => b.id === key || b.code === key)
}

// ---------------------------------------------------------------------------
// Reads and writes.
// ---------------------------------------------------------------------------

export type ListBookingsParams = { q?: string; sort?: BookingSort }

/**
 * My Bookings. Unpaginated — one user's own rows, and the screen counts its buckets over the whole
 * set, which page 1 of 5 could not do.
 *
 * ⚠️ THE SEARCH IS SENT TO THE SERVER rather than filtered here, for the same reason `#/venues`
 * sends its own: the endpoint offers `q`, and a second unfiltered copy of the list in the browser is
 * a second thing to keep in step. It matches the code, the purpose, and the venue's name and
 * location, with a leading `#` stripped server-side.
 */
export async function listMyBookings(params: ListBookingsParams = {}): Promise<Booking[]> {
  if (isDevGate()) {
    await sleep(DEV_LATENCY_MS)
    const q = params.q?.trim().replace(/^#/, '').toLowerCase()
    const rows = DEV_BOOKINGS.filter(
      (b) =>
        !q ||
        [b.code, b.purpose, b.venue.name, b.venue.location ?? '']
          .join(' ')
          .toLowerCase()
          .includes(q),
    )
    return devSort(rows, params.sort ?? 'created-desc')
  }

  const query: ListBookingsParams = {}
  if (params.q?.trim()) query.q = params.q.trim()
  if (params.sort) query.sort = params.sort

  const { data, error, response } = await api.GET('/api/v1/line-users/bookings', {
    headers: { Authorization: `Bearer ${bearerToken()}` },
    params: { query },
  })
  if (!data) throw new ApiError(response.status, extract(error, response))
  return data
}

/** The fixture's stand-in for the server's `ORDER BY`. Ties break on `code`, as the endpoint does. */
function devSort(rows: Booking[], sort: BookingSort): Booking[] {
  const key = (b: Booking) =>
    sort.startsWith('created')
      ? new Date(b.createdAt).getTime()
      : new Date(b.firstStartAt).getTime()
  const dir = sort === 'created-desc' || sort === 'event-desc' ? -1 : 1
  return [...rows].sort((a, b) => (key(a) - key(b)) * dir || a.code.localeCompare(b.code))
}

/**
 * One booking, addressed by cuid **or** by its `BR-…` code.
 *
 * ⚠️ THE URL CARRIES WHICHEVER THE CALLER HAD. A card in the list links by `id`; a person pasting
 * the number out of a LINE chat has the `code`. The server resolves both through one `OR`, so this
 * screen never has to know which kind of string it was handed.
 */
export async function getMyBookingDetail(idOrCode: string): Promise<BookingDetail> {
  if (isDevGate()) {
    await sleep(DEV_LATENCY_MS)
    const found = devFind(idOrCode)
    if (!found) throw new ApiError(404, 'No such booking.')
    return devDetail(found)
  }
  const { data, error, response } = await api.GET('/api/v1/line-users/bookings/{id}', {
    headers: { Authorization: `Bearer ${bearerToken()}` },
    params: { path: { id: idOrCode } },
  })
  if (!data) throw new ApiError(response.status, extract(error, response))
  return data
}

/**
 * Withdraw a PENDING request whole.
 *
 * 🔴 `PENDING` ONLY — the server answers 422 otherwise. An approved booking is cancelled through
 * {@link cancelSlot}, one slot at a time, even when it has exactly one. `cancelRouteFor()` in
 * `booking-state.ts` is the single place that choice is made.
 */
export async function cancelWholeBooking(idOrCode: string): Promise<BookingDetail> {
  if (isDevGate()) {
    await sleep(DEV_LATENCY_MS)
    const found = devFind(idOrCode)
    if (!found) throw new ApiError(404, 'No such booking.')
    if (found.status !== 'PENDING') throw new ApiError(422, 'Not pending.')
    for (const s of found.slots) {
      s.isCancelled = true
      s.cancelledAt = new Date().toISOString()
    }
    found.status = 'CANCELLED'
    return devDetail(found)
  }
  const { data, error, response } = await api.PATCH('/api/v1/line-users/bookings/{id}/cancel', {
    headers: { Authorization: `Bearer ${bearerToken()}` },
    params: { path: { id: idOrCode } },
  })
  if (!data) throw new ApiError(response.status, extract(error, response))
  return data
}

/**
 * Cancel one slot of an APPROVED booking.
 *
 * 🔴 THE SLOT FREES THE VENUE CALENDAR IMMEDIATELY — the availability read filters `isCancelled` at
 * slot level, so there is nothing to invalidate and nothing to wait for. That is also why a request
 * with two of three days cancelled is still `APPROVED`: the third day is really going to happen.
 *
 * ⚠️ THE LEAD TIME IS ENFORCED HERE'S COUNTERPART ON THE SERVER, not by the hidden button. The
 * screen hides the control using `cancelLeadMinutes`; a late tap on a stale render still gets 422.
 */
export async function cancelSlot(idOrCode: string, slotId: string): Promise<BookingDetail> {
  if (isDevGate()) {
    await sleep(DEV_LATENCY_MS)
    const found = devFind(idOrCode)
    const slot = found?.slots.find((s) => s.id === slotId)
    if (!found || !slot) throw new ApiError(404, 'No such slot.')
    if (found.status !== 'APPROVED') throw new ApiError(422, 'Not approved.')
    if (slot.isCancelled) throw new ApiError(422, 'Already cancelled.')
    if (new Date(slot.startAt).getTime() - Date.now() < DEV_LEAD_MINUTES * MINUTE) {
      throw new ApiError(422, 'Too late.')
    }
    slot.isCancelled = true
    slot.cancelledAt = new Date().toISOString()
    /* The server's own rule, mirrored: the last live slot takes the request with it. */
    if (found.slots.every((s) => s.isCancelled)) found.status = 'CANCELLED'
    return devDetail(found)
  }
  const { data, error, response } = await api.PATCH(
    '/api/v1/line-users/bookings/{id}/slots/{slotId}/cancel',
    {
      headers: { Authorization: `Bearer ${bearerToken()}` },
      params: { path: { id: idOrCode, slotId } },
    },
  )
  if (!data) throw new ApiError(response.status, extract(error, response))
  return data
}

function extract(error: unknown, response: Response): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message?: unknown }).message
    if (typeof m === 'string' && m) return m
  }
  return `Request failed (${response.status})`
}
