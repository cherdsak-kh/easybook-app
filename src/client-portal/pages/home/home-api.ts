import { isDevGate } from '@/client-portal/hooks/useLiffGate'
import { addDays, midnight } from '@/client-portal/pages/venues/venue-availability'
import { ApiError, api } from '@/lib/api-client'
import type { components } from '@/lib/api-types'
import { getIdToken } from '@/lib/liff'

/**
 * The single read `#/home` makes: the organisation's approved schedule across every venue.
 *
 * Same seam and the same two reasons as `pages/settings/settings-api.ts` and
 * `pages/venues/venues-api.ts`: the LINE ID token has to be attached (this is a bearer route, not
 * the back-office cookie session), and the DEV `?gate=` override has to be answered from a fixture
 * because under it there is no token to send. `isDevGate()` is imported, never re-derived — one copy
 * of a security condition.
 *
 * ── 🔴 THE ENDPOINT IS APPROVED-ONLY, AND THERE IS NOTHING TO FILTER CLIENT-SIDE ──
 * The server's `where` pins `bookingRequest.status = APPROVED` as a constant, drops
 * `isCancelled: true` slots and drops soft-deleted venues. Re-checking any of that here would be a
 * second copy of a rule that already has tests on it — and the DTO does not even carry `status`, on
 * purpose, so there is no field to check against. Every row that arrives is a fact about the school.
 *
 * ── 🔴 THE WINDOW IS HALF-OPEN `[from, to)` AND THE SERVER REFUSES TWO SHAPES ──
 * `to` earlier than `from` is a 400, and so is a window wider than **366 days**. The caller
 * (`HomePage`) asks for the 42-day grid it is about to paint, which is nowhere near either bound;
 * anything that starts constructing windows from user input has to keep that in mind. Sending
 * neither parameter is legal and means "the current Bangkok month".
 *
 * ⚠️ ROWS THAT **OVERLAP** THE WINDOW COME BACK, NOT ONLY ROWS CONTAINED BY IT. A camp that starts
 * the day before `from` is returned, because the screen has to paint it on the day it is visible.
 *
 * ⚠️ `isMine` IS COMPUTED SERVER-SIDE against the caller's `LineUser.id` cuid. Do not recompute it
 * from a LINE `U…` sub — those are two different identifiers with the same nickname, and the
 * backend log records that trap explicitly.
 */

/** One approved span, exactly as the wire spells it. Ten fields, no client-side additions. */
export type ScheduleSlot = components['schemas']['LineScheduleSlotDto']

const DEV_LATENCY_MS = 400
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function bearerToken(): string {
  const token = getIdToken()
  if (!token) throw new ApiError(401, 'No LINE ID token available.')
  return token
}

/**
 * Thai copy for every refusal this read can produce (`I18N-ERR-1`). The backend answers in English
 * and none of it is shown.
 *
 * ⚠️ 400 GETS ITS OWN SENTENCE because it is the one failure the reader can act on without leaving
 * the app: it means the window this screen asked for was rejected, and returning to today rebuilds
 * a legal one. It is a bug here rather than something they did wrong, so the copy does not ask them
 * to correct anything.
 */
export function messageFor(error: unknown): string {
  const status = error instanceof ApiError ? error.status : 0
  if (status === 401) return 'เซสชัน LINE หมดอายุ กรุณาปิดและเปิดแอปพลิเคชันใหม่อีกครั้ง'
  if (status === 400) return 'ช่วงวันที่ที่เรียกดูไม่ถูกต้อง กรุณากดปุ่ม “วันนี้” แล้วลองใหม่อีกครั้ง'
  return 'โหลดตารางกิจกรรมไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและลองใหม่อีกครั้ง'
}

// ---------------------------------------------------------------------------
// DEV fixture — reached only through `isDevGate()`, never in a real session.
// ---------------------------------------------------------------------------

/**
 * Seven approved spans across five venues and five categories.
 *
 * ⚠️ BUILT FROM OFFSETS AGAINST THE REAL CLOCK, NEVER FROM PINNED DATES — the same rule
 * `venues-api.ts`'s fixture follows. A hard-coded September falls into the past within a week, the
 * calendar empties, and the screen then looks broken rather than stale.
 *
 * Deliberately includes, because each one is a branch of the screen that is otherwise unreachable
 * under `?gate=`:
 *   · a **cross-midnight** camp (`+2 15:00 → +3 02:00`) — it must carry a dot on BOTH days and print
 *     through `fmtSlot`, not through the `08:00–16:00` short form;
 *   · a span **ending exactly at midnight** (`+5 08:00 → +6 00:00`) — `fmtTe` must print `24:00` and
 *     the day it belongs to is the 5th, not the 6th;
 *   · a row with `requesterName: null` — a staff booking that named nobody, which is the only null in
 *     this DTO the prototype has no drawing for;
 *   · **two `isMine` rows** — one today, one next week, so the `คุณ` badge is visible in both views;
 *   · a row in the **past** (`-2`), because the month is the unit here and yesterday is part of it;
 *   · an **empty day** (`+4`), which is the only way to reach the "สถานที่ทุกแห่งว่าง" card.
 */
function devRows(): ScheduleSlot[] {
  const t = midnight(new Date())
  const at = (dayOffset: number, h: number, m = 0) =>
    new Date(addDays(t, dayOffset).getTime() + h * 3_600_000 + m * 60_000).toISOString()

  const row = (
    n: number,
    startAt: string,
    endAt: string,
    venue: [string, string, number, string],
    purpose: string,
    requesterName: string | null,
    isMine: boolean,
  ): ScheduleSlot => ({
    id: `dev-slot-${n}`,
    startAt,
    endAt,
    venueId: venue[0],
    venueName: venue[1],
    venueTypeId: venue[2],
    venueTypeName: venue[3],
    purpose,
    requesterName,
    isMine,
  })

  const HALL: [string, string, number, string] = ['v1', 'หอประชุมวารณ', 1, 'หอประชุม']
  const MEETING: [string, string, number, string] = ['v4', 'ห้องประชุม ICT', 2, 'ห้องประชุม']
  const GYM: [string, string, number, string] = ['v2', 'โรงยิม 2', 3, 'โรงยิม']
  const YARD: [string, string, number, string] = ['v6', 'ลานหน้าเสาธง', 4, 'ลานกิจกรรม']
  const CLASS: [string, string, number, string] = ['v5', 'Smart Classroom', 5, 'ห้องเรียน']

  return [
    row(1, at(-2, 13), at(-2, 15), CLASS, 'อบรมครูใหม่ประจำภาคเรียน', 'อารีย์ ตั้งใจ', false),
    row(2, at(0, 9), at(0, 12), HALL, 'ประชุมผู้ปกครองระดับชั้น ม.3', 'สมหญิง เก่งกาจ', false),
    row(3, at(0, 13), at(0, 16), MEETING, 'อบรมเชิงปฏิบัติการสื่อการสอน', 'สมชาย ใจดี', true),
    row(4, at(1, 7, 30), at(1, 8), YARD, 'กิจกรรมหน้าเสาธง', 'วิภา สุขใจ', false),
    row(5, at(2, 15), at(3, 2), GYM, 'ค่ายลูกเสือ–เนตรนารี', 'ประเสริฐ มั่นคง', false),
    row(6, at(5, 8), at(6, 0), HALL, 'งานกีฬาสีภายใน', null, false),
    row(7, at(9, 9), at(9, 11), MEETING, 'ประชุมคณะกรรมการวิชาการ', 'สมชาย ใจดี', true),
  ]
}

// ---------------------------------------------------------------------------
// The one call.
// ---------------------------------------------------------------------------

/**
 * Every approved slot on every venue that **overlaps** `[from, to)`, `startAt ASC`.
 *
 * Both parameters are ISO 8601 strings and both are optional; omitting them asks the server for the
 * current Bangkok month. One round trip feeds both halves of the screen — the calendar's day dots
 * and the activity list — which is why the window is a month-sized grid rather than a single day.
 */
export async function fetchMasterSchedule(from?: string, to?: string): Promise<ScheduleSlot[]> {
  if (isDevGate()) {
    await sleep(DEV_LATENCY_MS)
    /* The fixture answers the same OVERLAP question the server does, rather than a containment
       one — otherwise the cross-midnight camp would vanish from a window that starts between its
       two days, and the one row that tests that branch would be the row that tests nothing. */
    const lo = from ? new Date(from).getTime() : Number.NEGATIVE_INFINITY
    const hi = to ? new Date(to).getTime() : Number.POSITIVE_INFINITY
    return devRows().filter(
      (r) => new Date(r.startAt).getTime() < hi && new Date(r.endAt).getTime() > lo,
    )
  }

  const query: { from?: string; to?: string } = {}
  if (from) query.from = from
  if (to) query.to = to

  const { data, error, response } = await api.GET('/api/v1/line-users/schedule', {
    headers: { Authorization: `Bearer ${bearerToken()}` },
    params: { query },
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
