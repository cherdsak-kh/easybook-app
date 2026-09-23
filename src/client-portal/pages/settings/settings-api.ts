import { isDevGate } from '@/client-portal/hooks/useLiffGate'
import { APP } from '@/client-portal/lib/version'
import { ApiError, api } from '@/lib/api-client'
import type { components } from '@/lib/api-types'
import { getIdToken } from '@/lib/liff'

/**
 * The three calls the settings branch makes (`Q-C9` ruling 4, and `NEEDS_DESIGN.md` §3).
 *
 * Same seam and the same two reasons as `pages/bookings/bookings-api.ts`: the LINE ID token has to
 * be attached (these are bearer routes, not the back-office cookie session), and the DEV `?gate=`
 * override has to be answered from a fixture because under it there is no token to send.
 * `isDevGate()` is imported, never re-derived — one copy of a security condition.
 *
 * ── 🔴 `updatedAt: null` IS NOT AN ERROR, IT IS THE NORMAL CASE ──
 * Every follower predates `line_user_settings`, so the read answers documented defaults with no row
 * behind them and no timestamp to print. The screen must not render a date for it, and must not
 * treat it as a failed load. The backend deliberately does not invent `new Date()` there.
 *
 * ── 🔴 THE `PATCH` IS A KEY-LEVEL MERGE. SEND ONLY WHAT CHANGED ──
 * `{ notifications: { decisions: false } }` leaves `announcements` and `reminders` exactly as they
 * were. Posting the whole object back would work today and would start losing writes the moment two
 * screens (or two devices) touch different keys — and it also turns every toggle into a three-key
 * write whose other two values came from a render that may be seconds stale.
 */

export type UserSettings = components['schemas']['LineUserSettingsResponseDto']
export type UpdateUserSettings = components['schemas']['UpdateLineUserSettingsDto']
export type ServerVersion = components['schemas']['LineUserVersionResponseDto']

/** The three notification keys, as the wire spells them. */
export type NotificationKey = keyof components['schemas']['NotificationPreferencesDto']

const DEV_LATENCY_MS = 400
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function bearerToken(): string {
  const token = getIdToken()
  if (!token) throw new ApiError(401, 'No LINE ID token available.')
  return token
}

/**
 * Thai copy for every refusal these three can produce (`I18N-ERR-1`). The backend answers in
 * English and none of it is shown.
 *
 * ⚠️ ONE FUNCTION FOR READS AND WRITES, and the default sentence therefore has to be true of both:
 * *"could not reach the system"* covers a failed load and a failed save without claiming which.
 * The two statuses that need their own sentence are 401 (the LINE session, which the user fixes by
 * reopening the app) and 400 (a body the server refused, which is a bug here rather than something
 * the user did — so the copy asks them to try again rather than to correct anything).
 */
export function messageFor(error: unknown): string {
  const status = error instanceof ApiError ? error.status : 0
  if (status === 401) return 'เซสชัน LINE หมดอายุ กรุณาปิดและเปิดแอปพลิเคชันใหม่อีกครั้ง'
  if (status === 403) return 'บัญชีของคุณไม่มีสิทธิ์แก้ไขการตั้งค่านี้ กรุณาเปิดแอปพลิเคชันใหม่อีกครั้ง'
  if (status === 400) return 'ค่าที่ส่งไปไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง'
  return 'เชื่อมต่อระบบไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและลองใหม่อีกครั้ง'
}

// ---------------------------------------------------------------------------
// DEV fixture — reached only through `isDevGate()`, never in a real session.
// ---------------------------------------------------------------------------

/**
 * ⚠️ MUTATED IN PLACE BY THE DEV SAVE PATH, on purpose — the same rule the bookings fixture
 * follows. A toggle that reverted on navigating away and back would make the one behaviour this
 * card exists for untestable under `?gate=`, which is the only way to reach these screens without a
 * LINE session. It survives router navigation, not a page reload: a full reload rebuilds the module.
 *
 * ⚠️ `updatedAt` STARTS `null`, because "no row yet" is what a real first visit looks like and it is
 * the one branch of this screen that is easy to leave untested.
 */
const DEV_SETTINGS: UserSettings = {
  theme: 'system',
  notifications: { announcements: true, decisions: true, reminders: true },
  updatedAt: null,
}

// ---------------------------------------------------------------------------
// The three calls.
// ---------------------------------------------------------------------------

/** The caller's own settings. A user who has never saved gets defaults with `updatedAt: null`. */
export async function fetchUserSettings(): Promise<UserSettings> {
  if (isDevGate()) {
    await sleep(DEV_LATENCY_MS)
    return { ...DEV_SETTINGS, notifications: { ...DEV_SETTINGS.notifications } }
  }

  const { data, error, response } = await api.GET('/api/v1/line-users/settings', {
    headers: { Authorization: `Bearer ${bearerToken()}` },
  })
  if (!data) throw new ApiError(response.status, extract(error, response))
  return data
}

/**
 * Save a partial change. **Send only what changed** — see the merge note at the top of this file.
 *
 * Returns the whole settings object as the server now holds it, which is what lets the caller
 * adopt the server's `updatedAt` instead of guessing at one.
 */
export async function updateUserSettings(dto: UpdateUserSettings): Promise<UserSettings> {
  if (isDevGate()) {
    await sleep(DEV_LATENCY_MS)
    if (dto.theme) DEV_SETTINGS.theme = dto.theme
    /* The server's merge, mirrored key by key — never `{ ...stored, ...dto.notifications }`, which
       would write `undefined` over a stored `true` for every key the caller did not send. */
    for (const key of ['announcements', 'decisions', 'reminders'] as const) {
      const next = dto.notifications?.[key]
      if (typeof next === 'boolean') DEV_SETTINGS.notifications[key] = next
    }
    DEV_SETTINGS.updatedAt = new Date().toISOString()
    return { ...DEV_SETTINGS, notifications: { ...DEV_SETTINGS.notifications } }
  }

  /* ⚠️ NO CSRF HEADER, AND THAT IS NOT AN OVERSIGHT. This route is bearer-authenticated with no
     ambient authority, so the service lists it in `CSRF_EXEMPT_PATHS` (`Q-C9` ruling 4). Calling
     `api.PATCH` directly rather than through `withCsrfRetry` is what keeps it that way — the
     back-office wrapper would fetch a session token this caller has no session for. */
  const { data, error, response } = await api.PATCH('/api/v1/line-users/settings', {
    headers: { Authorization: `Bearer ${bearerToken()}` },
    body: dto,
  })
  if (!data) throw new ApiError(response.status, extract(error, response))
  return data
}

/**
 * The version the API is running, for the agreement check on `#/version`.
 *
 * ⚠️ THE CALLER TREATS A FAILURE AS A STATE, NOT AS AN ERROR SCREEN. An unreachable server is one
 * of the two answers this call exists to produce (`ไม่สามารถตรวจสอบได้`), and it is exactly the
 * situation in which the reader most needs the rest of the page.
 *
 * ⚠️ The DEV fixture answers this bundle's OWN version, so the fixture path shows the *agreement*
 * branch. A mismatch cannot be faked into agreement, but agreement can be faked into a mismatch by
 * a stale deploy — which is the real thing this screen is for, and it needs a real server.
 */
export async function fetchServerVersion(): Promise<ServerVersion> {
  if (isDevGate()) {
    await sleep(DEV_LATENCY_MS)
    return { version: APP.version, status: 'ok' }
  }

  const { data, error, response } = await api.GET('/api/v1/line-users/version', {
    headers: { Authorization: `Bearer ${bearerToken()}` },
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
