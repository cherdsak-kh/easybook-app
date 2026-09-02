import { addDays, midnight, type VenueSlot } from './venue-availability'
import { isDevGate } from '@/client-portal/hooks/useLiffGate'
import { ApiError, api } from '@/lib/api-client'
import type { Venue } from '@/lib/api-client'
import { getIdToken } from '@/lib/liff'

/**
 * The venue reads `#/venues` and `#/venue/:id` make.
 *
 * Same seam as `pages/register/registration-api.ts`, for the same two reasons: the LINE ID token
 * has to be attached (these are bearer routes, not the back-office cookie session), and the DEV
 * `?gate=` override has to be answered from a fixture because under it there is no token to send.
 * `isDevGate()` is imported, never re-derived — one copy of a security condition.
 *
 * ── ⚠️ THESE ARE THE **CONSUMER** ROUTES, NOT `GET /venues` ──
 * `/api/v1/venues` is admin-only at class level and answers `401 "Authentication required."` to a
 * LINE token. `CLIENT-VENUES-1` added `/api/v1/line-users/venues` and `.../venues/:id` behind
 * `LineIdTokenGuard` — same service, same shape, a different guard in front. Reaching for the admin
 * path here would 401 every time.
 */

const DEV_LATENCY_MS = 400
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function bearerToken(): string {
  const token = getIdToken()
  if (!token) throw new ApiError(401, 'No LINE ID token available.')
  return token
}

/** Thai error copy, `I18N-ERR-1`. The backend answers in English; none of it is shown. */
export function messageFor(error: unknown): string {
  const status = error instanceof ApiError ? error.status : 0
  if (status === 401) return 'เซสชัน LINE หมดอายุ กรุณาปิดและเปิดแอปพลิเคชันใหม่อีกครั้ง'
  return 'โหลดข้อมูลสถานที่ไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและลองใหม่อีกครั้ง'
}

/** Raised when `GET /line-users/venues/:id` answers 404, so the caller can bounce to `/venues`. */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}

// ---------------------------------------------------------------------------
// DEV fixtures — reached only through `isDevGate()`, never in a real session.
// ---------------------------------------------------------------------------

/**
 * Nine venues, matching the shape and the spread the prototype's seed data has: one closed, two
 * with no photos at all, capacities from a small room to a 900-seat hall.
 *
 * ⚠️ TWO OF THEM CARRY `photos: []` ON PURPOSE (`โรงยิม 3`, `ลานหน้าเสาธง`). A venue with no photo
 * is real in this dataset, and it is the case that makes the difference between a placeholder and
 * the browser's own broken-image glyph — which reads as "this failed to load", not as "no photo
 * yet". Removing them from the fixture removes the only test of that path.
 */
function devVenue(
  id: string,
  name: string,
  type: string,
  capacity: number,
  location: string,
  description: string,
  amenities: string[],
  photoCount: number,
  isOpen = true,
  closedReason: string | null = null,
): Venue {
  return {
    id,
    name,
    venueType: { id: 1, name: type, isFallback: false },
    capacity,
    location,
    description,
    isOpen,
    closedReason,
    photos: Array.from({ length: photoCount }, (_, i) => ({
      id: `${id}-p${i}`,
      /* An inline SVG data URI: no network, no 404, and it renders as an obvious placeholder
         rather than pretending to be a photograph of a room that does not exist. */
      url: `data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="hsl(${(i * 67 + name.length * 23) % 360} 35% 62%)"/><text x="160" y="98" font-family="sans-serif" font-size="22" fill="rgba(255,255,255,.85)" text-anchor="middle">${i + 1}</text></svg>`,
      )}`,
      position: i,
    })),
    amenities: amenities.map((n, i) => ({ id: i + 1, name: n })),
    createdAt: '2026-08-01T03:00:00.000Z',
    updatedAt: '2026-08-01T03:00:00.000Z',
  }
}

const DEV_VENUES: Venue[] = [
  devVenue('v1', 'หอประชุมวารณ', 'หอประชุม', 900, 'อาคารหอประชุม ชั้น 1', 'มีเวทีถาวรและระบบไฟเวที เหมาะกับพิธีการและการแสดง', ['เครื่องเสียง', 'โปรเจกเตอร์', 'เวที', 'เครื่องปรับอากาศ', 'ไมโครโฟนไร้สาย'], 3),
  devVenue('v2', 'โรงยิม 2', 'โรงยิม', 400, 'อาคารพลศึกษา ชั้น 2', 'สนามในร่มสำหรับบาสเกตบอลและวอลเลย์บอล', ['อัฒจันทร์', 'ห้องเก็บอุปกรณ์'], 2, false, 'ปรับปรุงพื้นสนามและระบบไฟ คาดว่าแล้วเสร็จปลายเดือนนี้'),
  devVenue('v3', 'โรงยิม 3', 'โรงยิม', 250, 'อาคารพลศึกษา ชั้น 3', '', ['ห้องเก็บอุปกรณ์'], 0),
  devVenue('v4', 'ห้องประชุม ICT', 'ห้องประชุม', 40, 'อาคาร ICT ชั้น 3', 'ห้องประชุมขนาดกลาง พร้อมจอแสดงผลและระบบประชุมทางไกล', ['โปรเจกเตอร์', 'เครื่องปรับอากาศ', 'ระบบประชุมทางไกล', 'ไวไฟ'], 2),
  devVenue('v5', 'Smart Classroom', 'ห้องเรียน', 35, 'อาคาร 4 ชั้น 2', 'ห้องเรียนอัจฉริยะ พร้อมกระดานอินเทอร์แอกทีฟ', ['กระดานอินเทอร์แอกทีฟ', 'เครื่องปรับอากาศ', 'ไวไฟ'], 1),
  devVenue('v6', 'ลานหน้าเสาธง', 'ลานกิจกรรม', 800, 'บริเวณหน้าอาคารอำนวยการ', 'ลานกลางแจ้ง ใช้สำหรับกิจกรรมหน้าเสาธงและงานใหญ่', [], 0),
  devVenue('v7', 'สนามฟุตซอล', 'สนามกีฬา', 200, 'ด้านหลังอาคารพลศึกษา', 'สนามฟุตซอลพื้นยาง พร้อมไฟส่องสว่าง', ['ไฟส่องสว่าง', 'อัฒจันทร์'], 2),
  devVenue('v8', 'ห้องสมุด ชั้น 2', 'ห้องประชุม', 60, 'อาคารห้องสมุด ชั้น 2', 'พื้นที่อ่านหนังสือและจัดกิจกรรมกลุ่มย่อย', ['เครื่องปรับอากาศ', 'ไวไฟ', 'โปรเจกเตอร์'], 1),
  devVenue('v9', 'ห้องปฏิบัติการวิทยาศาสตร์', 'ห้องปฏิบัติการ', 45, 'อาคาร 3 ชั้น 1', 'ห้องแล็บพร้อมโต๊ะปฏิบัติการและอ่างล้าง', ['โต๊ะปฏิบัติการ', 'เครื่องปรับอากาศ', 'ตู้ดูดควัน'], 2),
]

/**
 * Fixture slots for `v1`, spread across this week so the bar, the ordering rules and the empty day
 * are all reachable. Built from **offsets against the real clock**, never fixed dates — the
 * prototype's own rule (`D-C16`'s note): pinned dates fall into the past within a week, the
 * calendar empties, and the screen then looks broken rather than stale.
 *
 * ⚠️ Deliberately includes: a **cross-midnight** span (so "appears on both days" and the
 * left-clipped bar are exercised), a **30-minute** span (so the 8 % floor is exercised — its true
 * width is 2.08 %), and an **overlapping** approved/pending pair (so the paint order is exercised).
 */
function devSlots(venueId: string): VenueSlot[] {
  if (venueId !== 'v1') return []
  const t = midnight(new Date())
  const at = (dayOffset: number, h: number, m = 0) =>
    new Date(addDays(t, dayOffset).getTime() + h * 3600_000 + m * 60_000)
  return [
    { id: 'BR-1001', start: at(0, 9), end: at(0, 12), status: 'approved', purpose: 'ประชุมครูประจำเดือน', requester: 'สมหญิง เก่งกาจ', mine: false },
    { id: 'BR-1002', start: at(0, 13), end: at(0, 16), status: 'approved', purpose: 'อบรมเชิงปฏิบัติการ', requester: 'สมชาย ใจดี', mine: true },
    /* Overlaps BR-1002 on purpose — a pending request holds nothing, so both are legal. */
    { id: 'BR-1003', start: at(0, 14), end: at(0, 17), status: 'pending', purpose: 'ซ้อมการแสดง', requester: '', mine: false },
    /* 30 minutes = 2.08 % of a day; the bar must floor it at 8 %. */
    { id: 'BR-1004', start: at(1, 7, 30), end: at(1, 8), status: 'approved', purpose: 'ประชุมสายชั้น', requester: 'วิภา สุขใจ', mine: false },
    /* Crosses midnight into day 3 — must show on BOTH days, filling day 3 from the far left. */
    { id: 'BR-1005', start: at(2, 15), end: at(3, 2), status: 'approved', purpose: 'ค่ายลูกเสือ', requester: 'ประเสริฐ มั่นคง', mine: false },
    /* Ends exactly at midnight: the right-edge case the floor must pull leftward, not clip. */
    { id: 'BR-1006', start: at(4, 23, 30), end: at(5, 0), status: 'pending', purpose: 'เตรียมงานกีฬาสี', requester: '', mine: false },
  ]
}

// ---------------------------------------------------------------------------
// Reads.
// ---------------------------------------------------------------------------

export type ListVenuesParams = {
  /** Matches the name OR the location, server-side. */
  q?: string
  venueTypeId?: number
  status?: 'open' | 'closed'
}

/**
 * The catalogue list. Unpaginated and `name ASC`, exactly like the admin one.
 *
 * ⚠️ CLOSED VENUES ARE RETURNED AND MUST STAY VISIBLE. `isOpen: false` with a `closedReason` is a
 * venue that accepts no new requests, not one that has gone away — "โรงยิม 2 อยู่ตรงไหน จุคนได้
 * เท่าไร" is still a question when it is shut.
 *
 * ⚠️ The search is sent to the SERVER rather than filtered here, because the endpoint offers `q`
 * and a second, unfiltered copy of the list in the browser is a second thing to keep in step.
 */
export async function listVenues(params: ListVenuesParams = {}): Promise<Venue[]> {
  if (isDevGate()) {
    await sleep(DEV_LATENCY_MS)
    const q = params.q?.trim().toLowerCase()
    return DEV_VENUES.filter(
      (v) =>
        (!q || v.name.toLowerCase().includes(q) || (v.location ?? '').toLowerCase().includes(q)) &&
        (params.status !== 'open' || v.isOpen),
    )
  }
  const query: ListVenuesParams = {}
  if (params.q?.trim()) query.q = params.q.trim()
  if (params.venueTypeId != null) query.venueTypeId = params.venueTypeId
  if (params.status) query.status = params.status

  const { data, error, response } = await api.GET('/api/v1/line-users/venues', {
    headers: { Authorization: `Bearer ${bearerToken()}` },
    params: { query },
  })
  if (!data) throw new ApiError(response.status, extract(error, response))
  return data
}

/** One venue. A soft-deleted or unknown id is a 404, and the two are byte-identical by design. */
export async function getVenue(id: string): Promise<Venue> {
  if (isDevGate()) {
    await sleep(DEV_LATENCY_MS)
    const found = DEV_VENUES.find((v) => v.id === id)
    if (!found) throw new ApiError(404, 'No such venue.')
    return found
  }
  const { data, error, response } = await api.GET('/api/v1/line-users/venues/{id}', {
    headers: { Authorization: `Bearer ${bearerToken()}` },
    params: { path: { id } },
  })
  if (!data) throw new ApiError(response.status, extract(error, response))
  return data
}

/**
 * ── 🔴 THE SEAM FOR AN ENDPOINT THAT DOES NOT EXIST YET ──
 *
 * `TRANSPORT.md` §3.1 assigns "`GET` venue availability for a date range" to **`CLIENT-BOOKING-1`**,
 * which is **Phase 5a**. `easybook-service` has the Prisma models but no `src/bookings/` module and
 * no route, so there is nothing to call.
 *
 * It returns `[]` rather than throwing, and that is the honest answer: with no bookings readable,
 * every day genuinely has nothing to show, and the calendar renders the empty-day card — the state
 * `paintVenueSlots` (3926) was written for and the most common answer even once the endpoint
 * exists. A throw here would paint an error over a screen that is not in error.
 *
 * ⚠️ WHAT IS NOT VERIFIED, AND CANNOT BE: that the real payload maps onto {@link VenueSlot}. The
 * shape below is this file's guess at Phase 5a's contract, and Phase 5a may choose differently —
 * when it lands, this function is the only place that has to change, which is the whole reason it
 * is a function and not a fetch inlined into the calendar.
 */
export async function listAvailability(venueId: string): Promise<VenueSlot[]> {
  if (isDevGate()) {
    await sleep(DEV_LATENCY_MS)
    return devSlots(venueId)
  }
  return Promise.resolve([])
}

function extract(error: unknown, response: Response): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message?: unknown }).message
    if (typeof m === 'string' && m) return m
  }
  return `Request failed (${response.status})`
}
