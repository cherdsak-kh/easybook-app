import createClient, { type Middleware } from 'openapi-fetch'
import type { components, paths } from './api-types'

/**
 * Typed API client generated from the backend's OpenAPI spec.
 * - Dev: empty baseUrl → same-origin `/api/...` requests hit the Vite proxy.
 * - Prod: set `VITE_API_URL` to the backend origin.
 *
 * Regenerate types after backend contract changes: `npm run gen:api`.
 *
 * Back-office auth is a cookie session (`eb.sid`, httpOnly) issued by the
 * backend — the frontend never reads or stores a token. Two things make that
 * work here:
 *  - `credentials: 'include'` so the browser sends/stores the session cookie.
 *  - a CSRF middleware that fetches `GET /auth/system/csrf` once, caches it, and
 *    attaches it as `x-csrf-token` on every unsafe verb (double-submit).
 */
const API_ORIGIN = import.meta.env.VITE_API_URL ?? ''

export const api = createClient<paths>({
  baseUrl: API_ORIGIN,
  // Send/receive the httpOnly `eb.sid` session cookie on every request.
  credentials: 'include',
  headers: {
    // Bypass ngrok's free-tier browser-warning interstitial. No-op off-ngrok.
    'ngrok-skip-browser-warning': 'true',
  },
})

/**
 * A failed API call, carrying the HTTP status so callers can branch (401 →
 * bounce to login, 403 → forbidden notice, 404 → not-found, else → generic).
 */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** Pull the backend's `ErrorResponseDto.message`, else a generic fallback. */
function messageFrom(error: unknown, response: Response): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message?: unknown }).message
    if (typeof m === 'string' && m.length > 0) return m
  }
  return `Request failed (${response.status})`
}

// ---------------------------------------------------------------------------
// CSRF: fetch once, cache the in-flight promise (so concurrent unsafe calls
// share a single fetch), attach on unsafe verbs, invalidate + retry once on 403.
// ---------------------------------------------------------------------------

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

let csrfPromise: Promise<string> | null = null

/** The current CSRF token, fetching (and caching) it on first use. */
export async function getCsrf(): Promise<string> {
  if (!csrfPromise) {
    csrfPromise = (async () => {
      const { data, response } = await api.GET('/api/v1/auth/system/csrf')
      if (!data) throw new ApiError(response.status, 'Could not obtain a CSRF token.')
      return data.csrfToken
    })()
    // On failure, clear the cache so the next unsafe call can try again.
    csrfPromise.catch(() => {
      csrfPromise = null
    })
  }
  return csrfPromise
}

function invalidateCsrf(): void {
  csrfPromise = null
}

const csrfMiddleware: Middleware = {
  async onRequest({ request }) {
    // Bearer-authenticated requests (the LINE-consumer status/register endpoints)
    // are cookieless and carry no ambient authority, so the double-submit CSRF
    // that protects the admin cookie session does not apply — skip it entirely so
    // we never fire a stray GET /auth/system/csrf for a LINE-portal call.
    if (request.headers.has('authorization')) return request
    if (UNSAFE_METHODS.has(request.method.toUpperCase())) {
      request.headers.set('x-csrf-token', await getCsrf())
    }
    return request
  },
}

api.use(csrfMiddleware)

/**
 * Run an unsafe request; if it 403s (a stale/rotated CSRF token is the common
 * cause), drop the cached token and retry exactly once with a fresh one.
 */
async function withCsrfRetry<T extends { response: Response }>(
  fn: () => Promise<T>,
): Promise<T> {
  const first = await fn()
  if (first.response.status === 403) {
    invalidateCsrf()
    return fn()
  }
  return first
}

// ---------------------------------------------------------------------------
// Shared types (re-exported so components import shapes from one place).
// ---------------------------------------------------------------------------

export type HealthResponse = components['schemas']['HealthResponseDto']
export type SystemVersion = components['schemas']['VersionResponseDto']
export type SystemUser = components['schemas']['SystemUserResponseDto']
export type SystemRole = SystemUser['role']
export type LoginResponse = components['schemas']['LoginResponseDto']
export type PaginatedSystemUsers = components['schemas']['PaginatedSystemUsersResponseDto']
export type CreateSystemUserBody = components['schemas']['CreateSystemUserDto']
export type UpdateSystemUserBody = components['schemas']['UpdateSystemUserDto']
/**
 * A `SystemUser` plus the one-time `temporaryPassword`. Returned ONLY by
 * `createSystemUser` and `resetSystemUserPassword` — the plaintext is shown once
 * and is never retrievable again, so it must never be persisted or logged.
 */
export type SystemUserWithTemporaryPassword =
  components['schemas']['SystemUserWithTemporaryPasswordDto']
/** The `{ id, name }` Department / PersonnelRole embed resolved on every read. */
export type SystemUserOption = components['schemas']['SystemUserOptionDto']
/** The four self-editable profile fields. `role`/`department`/`personnelRole` are absent by design. */
export type UpdateOwnProfileBody = components['schemas']['UpdateOwnProfileDto']
export type LineUser = components['schemas']['LineUserResponseDto']
export type PaginatedLineUsers = components['schemas']['PaginatedLineUsersResponseDto']
export type AppAccess = LineUser['access']
export type PaginationMeta = components['schemas']['PaginationMetaDto']

/** LINE consumer (client-portal) status + registration shapes. */
export type LineUserStatus = components['schemas']['LineUserStatusResponseDto']
export type LineUserRegistration = components['schemas']['LineUserRegistrationResponseDto']
export type LineUserRegistrationSummary =
  components['schemas']['LineUserRegistrationSummaryDto']
export type CreateLineUserRegistration =
  components['schemas']['CreateLineUserRegistrationDto']
export type UpdateLineUserRegistration =
  components['schemas']['UpdateLineUserRegistrationDto']
/**
 * The admin registration-edit body: the six editable fields with `departmentId` /
 * `personnelRoleId` as integer ids. `lineUserId` is absent by construction (the
 * backend 400s any attempt to send it), so it can never be edited from here.
 */
export type AdminUpdateLineUserRegistration =
  components['schemas']['AdminUpdateLineUserRegistrationDto']

/** Dynamic registration option lists (admin-curated Departments / PersonnelRoles). */
export type RegistrationOptions = components['schemas']['RegistrationOptionsResponseDto']
export type RegistrationOption = components['schemas']['OptionDto']

/** Admin option-management (Department / PersonnelRole) shapes. */
export type Department = components['schemas']['DepartmentResponseDto']
export type PersonnelRole = components['schemas']['PersonnelRoleResponseDto']
/** Both option create/rename bodies are structurally `{ name }`. */
export type OptionInput = components['schemas']['CreateDepartmentDto']

/**
 * The venue-side curated vocabularies — the same admin screen, two more tables.
 *
 * ⚠️ THEY DO NOT SHARE A RESPONSE TYPE WITH THE TWO ABOVE, and the difference is not cosmetic.
 * `Department`/`PersonnelRole` carry `staffCount` + `registrationCount`, because those tables are
 * shared between back-office accounts and LINE registrations and a delete moves both populations.
 * A venue type holds only venues, so it carries `holderCount` alone; a second field could only
 * ever repeat it.
 *
 * `Amenity` reports `isSystemReserved` and `isFallback` as permanent `false` — they are constants
 * on the wire, not columns, so the screen can share one component. Do not branch on them for this
 * table; the answer never changes.
 */
export type VenueType = components['schemas']['VenueTypeResponseDto']
export type Amenity = components['schemas']['AmenityResponseDto']
/** `DELETE /amenities/:id` answers 200 with a body, unlike the other three tables' 204. */
export type AmenityDeleteResult = components['schemas']['DeleteAmenityResponseDto']

/**
 * `สถานที่จัดกิจกรรม` — the product's subject, and the first ENTITY here whose id is a cuid rather
 * than an int. `venueType` arrives nested and already resolved, including `isFallback`.
 *
 * ⚠️ RENDER THE TOMBSTONE CATEGORY OFF `venueType.isFallback`, NEVER OFF ITS NAME. The name is the
 * one string a translator would edit without thinking, and a name match turns that edit into
 * orphaned venues quietly rendering as an ordinary category.
 */
export type Venue = components['schemas']['VenueResponseDto']
export type VenuePhoto = components['schemas']['VenuePhotoDto']
export type CreateVenueBody = components['schemas']['CreateVenueDto']
export type UpdateVenueBody = components['schemas']['UpdateVenueDto']

/**
 * `คำขอจองสถานที่` — the approval queue. One request is one row, however many days it spans.
 *
 * ⚠️ `slots` CARRIES CANCELLED SPANS TOO, and that is the contract's decision, not an oversight:
 * the detail dialog has to be able to say that Wednesday was dropped and why. Anything summarising
 * the array for a table cell has to state which population it is summarising.
 *
 * ⚠️ `isExpired` IS THE SERVER'S ANSWER, not a comparison to do here. It is
 * `status === PENDING && lastEndAt < now` evaluated at read time — there is no fifth stored status
 * and no cron — and recomputing it against the browser's clock is how two screens start disagreeing
 * about the same row.
 */
export type BookingRequestListItem =
  components['schemas']['AdminBookingRequestListItemDto']
export type BookingRequestSlot = components['schemas']['AdminBookingSlotDto']
export type BookingStatus = BookingRequestListItem['status']
export type BookingOrigin = BookingRequestListItem['origin']
export type BookingStatusCounts = components['schemas']['BookingStatusCountsDto']
export type PaginatedBookingRequests =
  components['schemas']['PaginatedBookingRequestsResponseDto']

/**
 * One request in full — the list shape PLUS `venue.capacity`/`isOpen`, `createdBy`, `approvedBy`,
 * `approvedAt` and `conflicts`. What `#rq-detail-modal` reads, and the only surface every write on
 * this screen is launched from.
 */
export type BookingRequestDetail = components['schemas']['AdminBookingRequestDetailDto']

/**
 * One request that approving THIS one would auto-reject (ADR-001), named so the operator can see
 * whom they are about to bump before they commit.
 *
 * ⚠️ IT CARRIES THE OUTER BOUNDS (`firstStartAt`/`lastEndAt`), NOT A SLOT LIST. The prototype's
 * conflict line printed the loser's whole span text because it held the entire record locally; here
 * the contract deliberately sends a summary — code, requester and when — and the dialog prints
 * exactly what it was given rather than implying per-day hours it does not have.
 */
export type BookingConflictItem = components['schemas']['BookingConflictItemDto']

/**
 * What `approve` answers with.
 *
 * ⚠️ `autoRejected` IS THE ONLY HONEST COUNT, and it can differ from the `conflicts.pendingLosers`
 * the dialog was showing: that list was read outside the deciding transaction, and another operator
 * may have moved one of those requests in between. Report THIS.
 */
export type ApproveBookingResult = components['schemas']['ApproveBookingResponseDto']

/** One span, as `direct` and `preflight` both take it. Half-open: `[startAt, endAt)`. */
export type BookingSlotInput = components['schemas']['BookingSlotInputDto']

/**
 * `POST /booking-requests/direct` — จองแทน. Creation IS the approval.
 *
 * ⚠️ TWO MUTUALLY EXCLUSIVE ORIGIN SHAPES, and sending both is a 400. (A) `lineUserId` alone, for a
 * requester who has an account; (B) `requesterName` + `contactPhone` (both required) and optionally
 * `departmentId`, for an outside body with no account. The three (B) fields are OVERRIDES, not a
 * second profile store — on a request that carries `lineUserId` the name, phone and department must
 * resolve through the registration, at one place.
 */
export type CreateDirectBookingBody = components['schemas']['CreateDirectBookingDto']

/**
 * What `preflight` answers about spans that are NOT SAVED YET — the create dialog's live banner.
 *
 * ⚠️ IT IS A FORECAST, NOT A RULING. It is read outside any transaction and takes no lock, so a
 * disabled submit button is UX; `direct` refuses again inside its own transaction. Report what
 * `direct` answered, never what this predicted.
 *
 * ⚠️ `approvedClashCount` COUNTS SLOTS, NOT BOOKINGS — one three-day booking across three requested
 * days is 3, not 1. A screen that prints it as "3 รายการ" is wrong about a single booking.
 *
 * ⚠️ `venueIsOpen: false` IS INFORMATIONAL AND NEVER A BLOCK. `isOpen` refuses new REQUESTS, and a
 * staff lock is not a request — the server accepts a direct booking on a closed venue by design.
 */
export type BookingPreflight = components['schemas']['BookingPreflightResponseDto']

/** One PENDING request the spans overlap — ADR-001 would auto-reject it on submit. */
export type BookingPreflightPending = components['schemas']['BookingPreflightPendingDto']

/** The four orderings the queue offers. Absent → `created-desc`, which is what the server defaults to. */
export type BookingRequestSort = 'created-desc' | 'event-asc' | 'created-asc' | 'event-desc'

/**
 * ⚠️ THREE VALUES, AND THE SERVER 400s ON A FOURTH rather than clamping — because the screen
 * computes each row's ordinal as `(page - 1) * limit + i + 1` from the value it SENT, and a silent
 * clamp would make every one of those numbers wrong with no signal anywhere. The type is what stops
 * a caller reaching that 400.
 */
export type BookingRequestLimit = 10 | 20 | 50

/**
 * The two "quick" transitions an ADMIN's row buttons emit (Approve/Reinstate →
 * ALLOWED, Block → BLOCKED). SUPER_ADMIN's override picker is not limited to
 * these — it sends the full `AppAccess` — so `patchLineUserAccess` takes the
 * wider union, not this.
 */
export type AccessAction = Extract<AppAccess, 'ALLOWED' | 'BLOCKED'>

// ---------------------------------------------------------------------------
// Health (unchanged pattern).
// ---------------------------------------------------------------------------

export async function getHealth(): Promise<HealthResponse> {
  const { data, error, response } = await api.GET('/api/v1/health')
  const snapshot = data ?? error
  if (!snapshot) {
    throw new Error(`Request failed: /api/v1/health (${response.status})`)
  }
  return snapshot
}

/**
 * The SERVER half of the version screen. Never throws — the two failures are outcomes it renders.
 *
 * ⚠️ `net` and `down` are DIFFERENT SENTENCES on screen, which is the only reason this returns a
 * reason at all. "ตรวจสอบไม่ได้ เพราะเชื่อมต่ออินเทอร์เน็ตไม่ได้" is something the reader can check
 * themselves; "ตรวจสอบไม่ได้ในขณะนี้" is something they report. Collapsing them into one failure
 * would hand a school administrator the wrong instruction half the time.
 *
 * The split is by WHETHER THE SERVER ANSWERED, not by status code: a rejected `fetch` means the
 * request never completed (no network, DNS, a dead port), while any status at all — 503, 500,
 * even the 401 of a session that just died — means something answered, so the connection is fine
 * and the fault is on the far side. A 401 additionally trips `AuthProvider`'s watcher, which owns
 * that outcome; this function only has to avoid claiming the network is down when it is not.
 */
export type SystemVersionResult =
  | { ok: true; value: SystemVersion }
  | { ok: false; reason: 'net' | 'down' }

export async function getSystemVersion(): Promise<SystemVersionResult> {
  try {
    const { data } = await api.GET('/api/v1/system/version')
    return data ? { ok: true, value: data } : { ok: false, reason: 'down' }
  } catch {
    return { ok: false, reason: 'net' }
  }
}

// ---------------------------------------------------------------------------
// Auth.
// ---------------------------------------------------------------------------

/**
 * The guard probe. Returns the current admin on 200; `null` on 401 (a normal
 * "not logged in") or any unreachable/error response — never throws, so the
 * AuthProvider can resolve straight to authenticated/unauthenticated.
 */
export async function getMe(): Promise<SystemUser | null> {
  try {
    const { data } = await api.GET('/api/v1/auth/system/me')
    return data ?? null
  } catch {
    return null
  }
}

/**
 * STRICT read of the signed-in user's own profile — same endpoint as {@link getMe},
 * different contract. `getMe` is the AuthProvider's deliberately fail-soft probe: it
 * answers `null` for BOTH "not logged in" (401) and "the request blew up", which is
 * right for a mount gate and useless for a page that must tell session death apart
 * from a transient failure. This one THROWS an {@link ApiError} carrying the status,
 * so the Profile page can bounce on 401 and offer a retry on anything else.
 */
export async function getOwnProfile(): Promise<SystemUser> {
  const { data, error, response } = await api.GET('/api/v1/auth/system/me')
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

export type LoginResult =
  | { ok: true; user: LoginResponse }
  | { ok: false; status: number; message: string; retryAfter?: string | null }

export async function login(email: string, password: string): Promise<LoginResult> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.POST('/api/v1/auth/system/login', {
      // Placeholder — the CSRF middleware overwrites this with the real token.
      params: { header: { 'x-csrf-token': '' } },
      body: { email, password },
    }),
  )
  if (data) return { ok: true, user: data }
  return {
    ok: false,
    status: response.status,
    message: messageFrom(error, response),
    retryAfter: response.headers.get('retry-after'),
  }
}

/** Best-effort logout: destroys the server session; local state is cleared regardless. */
export async function logout(): Promise<void> {
  await withCsrfRetry(() =>
    api.POST('/api/v1/auth/system/logout', {
      params: { header: { 'x-csrf-token': '' } },
    }),
  )
}

// ---------------------------------------------------------------------------
// Self-service (the signed-in user acting on themselves).
// ---------------------------------------------------------------------------

/**
 * ⚠️ THE PASSWORD LENGTHS LIVE IN `admin-portal/lib/password-policy.ts`, NOT HERE.
 *
 * There used to be a `PASSWORD_MIN_LENGTH = 12` on this line, described as "mirrored from the
 * backend DTO". It was not: `ChangePasswordDto` is `@MinLength(8)`, and so is the prototype's
 * checklist and `password-policy.ts`'s `PASSWORD_MIN`. Nothing imported the 12 — which is the
 * only reason it never shipped as a screen that refuses a password the server would have taken,
 * and exactly why it survived: an unused constant is never contradicted by anything.
 *
 * One fact, one home. `password-policy.ts` is where the rule is CHECKED, so it is where the
 * number lives; anything needing it imports from there.
 */

/**
 * Change your own password — the forced-reset door AND the voluntary one.
 * `currentPassword` is required: without it a hijacked session would be a
 * one-request account takeover.
 *
 * CRITICAL: a WRONG `currentPassword` is a **400, never a 401**. Callers must
 * render it inline and must NOT treat it as session death — a 401 here means the
 * session genuinely died. On success the server clears `mustChangePassword`;
 * re-probe `getMe()` rather than trusting local state.
 */
export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const { error, response } = await withCsrfRetry(() =>
    api.POST('/api/v1/auth/system/password', {
      params: { header: { 'x-csrf-token': '' } },
      body: { currentPassword, newPassword },
    }),
  )
  if (!response.ok) throw new ApiError(response.status, messageFrom(error, response))
}

/**
 * Edit your own profile. Accepts EXACTLY ONE field, `profilePictureUrl`.
 *
 * ⚠️ IT USED TO TAKE FOUR — `firstName`, `lastName` and `phoneNumber` went with
 * them on 2026-08-16, because the portal does not offer them: the project rule
 * is that the owner may not change anything in `system_users` that the creating
 * admin set. Everything else — `role`, `email`, `departmentId`,
 * `personnelRoleId`, `password`, `lineUserId` — is absent from the DTO, so
 * sending one is a 400 at the pipe (`forbidNonWhitelisted`). That absence IS the
 * enforcement; the padlock on โปรไฟล์ is not decorative.
 *
 * `null` clears the avatar — there is no DELETE route, and the nullable column is
 * what makes "no picture" expressible. A SUPER_ADMIN changes the other fields on
 * their own row via `patchSystemUser`, from เจ้าหน้าที่ระบบ.
 */
export async function updateOwnProfile(body: UpdateOwnProfileBody): Promise<SystemUser> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.PATCH('/api/v1/auth/system/me', {
      params: { header: { 'x-csrf-token': '' } },
      body,
    }),
  )
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

/**
 * Avatar constraints, mirrored client-side for fast feedback only — the server
 * enforces them authoritatively (and sniffs magic bytes, which we cannot).
 *
 * The size limit is EXCLUSIVE: the backend accepts a file of exactly 2 MiB and
 * rejects 2 MiB + 1, so the reject condition here must be `> AVATAR_MAX_BYTES`,
 * never `>=`, or the client would reject a file the server would have taken.
 */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024
export const AVATAR_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/**
 * Upload your own avatar: `multipart/form-data`, one part named `file`, straight
 * to the backend (it proxies to R2 — this is NOT a presign flow). The CSRF token
 * rides as a HEADER (the middleware attaches it); putting it in the form body
 * would be a 400.
 *
 * Returns the UPDATED user with `profilePictureUrl` already pointing at the new
 * object — render from this body rather than constructing the URL.
 */
export async function uploadOwnAvatar(file: File): Promise<SystemUser> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.POST('/api/v1/auth/system/me/avatar', {
      params: { header: { 'x-csrf-token': '' } },
      // The generated type calls `file` a binary string; the wire wants a File.
      body: { file: file as unknown as string },
      // Returning FormData makes openapi-fetch drop its JSON Content-Type so the
      // browser sets the multipart boundary itself.
      bodySerializer(body: { file: string }) {
        const form = new FormData()
        form.append('file', body.file as unknown as File)
        return form
      },
    }),
  )
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

// ---------------------------------------------------------------------------
// LINE users.
// ---------------------------------------------------------------------------

/** The three orderings `GET /line-users` offers. Absent → `new`, which is what the server defaults to. */
export type LineUserSort = 'new' | 'old' | 'name'

export interface ListLineUsersParams {
  page?: number
  limit?: number
  /**
   * One box, six fields server-side (LU-SEARCH-1): the LINE display name, the registered first and
   * last name, the resolved position and department names, and the phone — plus a digits-only match
   * on the phone once the query carries three or more digits.
   */
  search?: string
  access?: AppAccess
  /**
   * ⚠️ `new`/`old` order by the REGISTRATION date, never `followedAt` (LU-REGDATE-1), and rows with
   * no registration sort LAST in every mode — "has no date" is not "is the oldest".
   */
  sort?: LineUserSort
}

export async function listLineUsers(
  params: ListLineUsersParams = {},
): Promise<PaginatedLineUsers> {
  const query: NonNullable<
    paths['/api/v1/line-users']['get']['parameters']['query']
  > = {}
  if (params.page != null) query.page = params.page
  if (params.limit != null) query.limit = params.limit
  if (params.search && params.search.trim().length > 0) query.search = params.search.trim()
  if (params.access) query.access = params.access
  if (params.sort) query.sort = params.sort

  const { data, error, response } = await api.GET('/api/v1/line-users', {
    params: { query },
  })
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

/**
 * Set a LINE user's access state (`PATCH /line-users/:id`).
 *
 * The status dropdown only ever emits `AccessAction` (ALLOWED / BLOCKED) for BOTH
 * roles; the dedicated **Reject** action is the only caller that sends
 * `'REJECTED'`, and it MUST pass `reason`. The signature still accepts the full
 * `AppAccess` union because the backend contract does. The backend is the
 * authority: a transition an ADMIN is not permitted to make comes back as a
 * **403** (handled by the caller); it is never a client-side silent no-op.
 *
 * `reason` is **optional on the wire** (it is meaningless for ALLOWED/BLOCKED and
 * is not persisted for them) but the server REQUIRES a non-empty trimmed value
 * when `access === 'REJECTED'` — a missing/blank reason there is a **400**, and a
 * >500-char one is a 400 at the validation pipe. It is omitted from the body
 * entirely when not supplied, so every existing two-argument call site keeps its
 * exact previous wire shape.
 */
export async function patchLineUserAccess(
  id: string,
  access: AppAccess,
  reason?: string,
): Promise<LineUser> {
  const body: components['schemas']['UpdateLineUserAccessDto'] =
    reason === undefined ? { access } : { access, reason }
  const { data, error, response } = await withCsrfRetry(() =>
    api.PATCH('/api/v1/line-users/{id}', {
      params: { path: { id }, header: { 'x-csrf-token': '' } },
      body,
    }),
  )
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

/**
 * Admin edit of a LINE user's registration (`PATCH /line-users/:id/registration`).
 *
 * A DIFFERENT route from `patchLineUserAccess` (`PATCH /line-users/:id`): this
 * writes the five self-submitted registration fields and has NO access/rich-menu
 * side effect (so there is no 502 path here). Cookie session + CSRF like the other
 * admin mutations. The backend stays the authority: a blank/invalid field or a
 * deleted/unknown/**system-reserved** option id → **400**; a user with no
 * registration row, or an unknown/soft-deleted id → **404**; only **401** means
 * the session died. There is **no 409** — this route mutates no unique column.
 * On success it returns the updated `LineUserResponseDto` so the caller can patch
 * the row in place, exactly like `patchLineUserAccess`.
 */
export async function patchLineUserRegistration(
  id: string,
  body: AdminUpdateLineUserRegistration,
): Promise<LineUser> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.PATCH('/api/v1/line-users/{id}/registration', {
      params: { path: { id }, header: { 'x-csrf-token': '' } },
      body,
    }),
  )
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

// ---------------------------------------------------------------------------
// LINE consumer (client portal) — bearer-authenticated with the LIFF ID token.
//
// These are the FIRST LINE-consumer-authenticated endpoints: they authenticate
// with `Authorization: Bearer <id_token>` (the LINE ID token from
// `liff.getIDToken()`), NOT the admin cookie session. They are cookieless, so the
// CSRF middleware skips them (it bails when an Authorization header is present).
// `register` is CSRF-exempt on the backend; we still send the bearer.
// ---------------------------------------------------------------------------

function bearer(idToken: string): { Authorization: string } {
  return { Authorization: `Bearer ${idToken}` }
}

/**
 * The single call the client portal makes after LIFF auth to pick which of the
 * five screens (UNREGISTERED / PENDING / ALLOWED / BLOCKED / REJECTED) to render.
 * `rejectionReason` on the response is non-null IFF `access === 'REJECTED'` and
 * feeds the client's RejectedScreen.
 */
export async function getLineUserStatus(idToken: string): Promise<LineUserStatus> {
  const { data, error, response } = await api.GET('/api/v1/line-users/status', {
    headers: bearer(idToken),
  })
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

/**
 * Submit the registration form (UNREGISTERED → PENDING). Returns the caller's
 * new status view (access is now PENDING) so the UI can route straight to the
 * Pending screen without a second GET /status.
 */
export async function registerLineUser(
  body: CreateLineUserRegistration,
  idToken: string,
): Promise<LineUserStatus> {
  const { data, error, response } = await api.POST('/api/v1/line-users/register', {
    headers: bearer(idToken),
    body,
  })
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

/**
 * The admin-curated Department / PersonnelRole options that populate the
 * registration + PENDING-edit form's dropdowns. Only non-deleted options are
 * returned; ids feed `departmentId` / `personnelRoleId` on register/edit.
 */
export async function getRegistrationOptions(idToken: string): Promise<RegistrationOptions> {
  const { data, error, response } = await api.GET('/api/v1/line-users/registration/options', {
    headers: bearer(idToken),
  })
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

/**
 * PENDING self-edit: a PENDING user re-submits ALL their registration fields.
 * Backend rejects with 403 if they are no longer PENDING and 400 for a
 * deleted/unknown option. There is **no 409** — this route mutates no unique
 * column. Returns the refreshed status view so the UI can re-render the Pending
 * screen.
 */
export async function updateLineUserRegistration(
  body: UpdateLineUserRegistration,
  idToken: string,
): Promise<LineUserStatus> {
  const { data, error, response } = await api.PATCH('/api/v1/line-users/registration', {
    headers: bearer(idToken),
    body,
  })
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

// ---------------------------------------------------------------------------
// System (staff) users.
// ---------------------------------------------------------------------------

/**
 * The เจ้าหน้าที่ระบบ directory. Search and both filters are SERVER-side (STAFF-QUERY-1) — the
 * screen never holds a second, unfiltered copy of the table to narrow in the browser.
 *
 * ⚠️ `status: 'deleted'` is the ONLY way to obtain a soft-deleted row's id, and it is
 * SUPER_ADMIN-only: soft-deleted rows are excluded from `data` AND from `meta.total` for every
 * other query, so a restore has nothing to address without it. Any other role asking for it is a
 * 403 from the server, not a hidden option here — hiding the option is UX.
 *
 * Empty strings are omitted rather than sent. The server trims and treats empty as absent, so both
 * behave the same; a URL that carries `search=` on every keystroke just makes the network log
 * harder to read.
 */
export async function listSystemUsers(
  params: {
    page?: number
    limit?: number
    search?: string
    role?: SystemRole
    status?: 'active' | 'pending' | 'suspended' | 'deleted'
  } = {},
): Promise<PaginatedSystemUsers> {
  const query: NonNullable<
    paths['/api/v1/system-users']['get']['parameters']['query']
  > = {}
  if (params.page != null) query.page = params.page
  if (params.limit != null) query.limit = params.limit
  if (params.search) query.search = params.search
  if (params.role) query.role = params.role
  if (params.status) query.status = params.status

  const { data, error, response } = await api.GET('/api/v1/system-users', {
    params: { query },
  })
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

/**
 * Create a staff account. The SERVER issues the password — there is no
 * `password` field — and returns `temporaryPassword` EXACTLY ONCE in this
 * response. Show it to the admin once, then let it fall out of scope.
 */
export async function createSystemUser(
  body: CreateSystemUserBody,
): Promise<SystemUserWithTemporaryPassword> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.POST('/api/v1/system-users', {
      params: { header: { 'x-csrf-token': '' } },
      body,
    }),
  )
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

/**
 * Issue a NEW temporary password for someone else (SUPER_ADMIN only; never
 * yourself — the backend 403s a self-reset). The plaintext comes back exactly
 * once, in `temporaryPassword`.
 */
export async function resetSystemUserPassword(
  id: string,
): Promise<SystemUserWithTemporaryPassword> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.POST('/api/v1/system-users/{id}/reset-password', {
      params: { path: { id }, header: { 'x-csrf-token': '' } },
    }),
  )
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

export async function patchSystemUser(
  id: string,
  body: UpdateSystemUserBody,
): Promise<SystemUser> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.PATCH('/api/v1/system-users/{id}', {
      params: { path: { id }, header: { 'x-csrf-token': '' } },
      body,
    }),
  )
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

/** Soft-delete (deactivate) a staff account. Returns nothing on 204. */
export async function deleteSystemUser(id: string): Promise<void> {
  const { error, response } = await withCsrfRetry(() =>
    api.DELETE('/api/v1/system-users/{id}', {
      params: { path: { id }, header: { 'x-csrf-token': '' } },
    }),
  )
  if (!response.ok) throw new ApiError(response.status, messageFrom(error, response))
}

export async function restoreSystemUser(id: string): Promise<SystemUser> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.POST('/api/v1/system-users/{id}/restore', {
      params: { path: { id }, header: { 'x-csrf-token': '' } },
    }),
  )
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

// ---------------------------------------------------------------------------
// Registration options (Department / PersonnelRole) — admin CRUD.
//
// Cookie-session + `x-csrf-token` double-submit, SUPER_ADMIN/ADMIN only (the
// backend 403s STAFF). DELETE performs a server-side SOFT delete (the row
// disappears from the active list; there is no restore in this scope). A
// create/rename that collides with an active name → 409 (`NAME_TAKEN`).
// ---------------------------------------------------------------------------

export async function listDepartments(): Promise<Department[]> {
  const { data, error, response } = await api.GET('/api/v1/departments')
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

export async function createDepartment(body: OptionInput): Promise<Department> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.POST('/api/v1/departments', {
      params: { header: { 'x-csrf-token': '' } },
      body,
    }),
  )
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

export async function patchDepartment(id: number, body: OptionInput): Promise<Department> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.PATCH('/api/v1/departments/{id}', {
      params: { path: { id }, header: { 'x-csrf-token': '' } },
      body,
    }),
  )
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

/** Soft-delete a department option. Returns nothing on 204. */
export async function deleteDepartment(id: number): Promise<void> {
  const { error, response } = await withCsrfRetry(() =>
    api.DELETE('/api/v1/departments/{id}', {
      params: { path: { id }, header: { 'x-csrf-token': '' } },
    }),
  )
  if (!response.ok) throw new ApiError(response.status, messageFrom(error, response))
}

export async function listPersonnelRoles(): Promise<PersonnelRole[]> {
  const { data, error, response } = await api.GET('/api/v1/personnel-roles')
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

export async function createPersonnelRole(body: OptionInput): Promise<PersonnelRole> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.POST('/api/v1/personnel-roles', {
      params: { header: { 'x-csrf-token': '' } },
      body,
    }),
  )
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

export async function patchPersonnelRole(id: number, body: OptionInput): Promise<PersonnelRole> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.PATCH('/api/v1/personnel-roles/{id}', {
      params: { path: { id }, header: { 'x-csrf-token': '' } },
      body,
    }),
  )
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

/** Soft-delete a personnel-role option. Returns nothing on 204. */
export async function deletePersonnelRole(id: number): Promise<void> {
  const { error, response } = await withCsrfRetry(() =>
    api.DELETE('/api/v1/personnel-roles/{id}', {
      params: { path: { id }, header: { 'x-csrf-token': '' } },
    }),
  )
  if (!response.ok) throw new ApiError(response.status, messageFrom(error, response))
}

// ---------------------------------------------------------------------------
// Venue options (VenueType / Amenity) — admin CRUD.
//
// Same guard stack and same status codes as the two above: cookie session +
// `x-csrf-token`, SUPER_ADMIN/ADMIN only (VIEWER is a 403 on READ as well as on
// write), soft delete, 409 on an active-name collision, 404 on an unknown or
// already-deleted id.
//
// ⚠️ TWO PLACES THE SHAPE DELIBERATELY BREAKS, both on `/amenities`:
//   · `DELETE` answers **200 with `{ releasedVenueCount }`**, not 204. The
//     confirm dialog quotes that number BEFORE the click and another operator
//     can change it in between, so the response says what actually happened.
//   · `GET` is identical for every role — this is the one curated table with no
//     reserved rows, so there is nothing for a SUPER_ADMIN to see extra.
// ---------------------------------------------------------------------------

export async function listVenueTypes(): Promise<VenueType[]> {
  const { data, error, response } = await api.GET('/api/v1/venue-types')
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

export async function createVenueType(body: OptionInput): Promise<VenueType> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.POST('/api/v1/venue-types', {
      params: { header: { 'x-csrf-token': '' } },
      body,
    }),
  )
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

export async function patchVenueType(id: number, body: OptionInput): Promise<VenueType> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.PATCH('/api/v1/venue-types/{id}', {
      params: { path: { id }, header: { 'x-csrf-token': '' } },
      body,
    }),
  )
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

/**
 * Soft-delete a venue type. Returns nothing on 204.
 *
 * ⚠️ A 500 here is a real, documented outcome and not a bug in this call: the server re-points the
 * category's venues to a reserved tombstone row, and refuses to proceed if that row was never
 * seeded (`npm run venue-types:seed`). It moves no data when it fails.
 */
export async function deleteVenueType(id: number): Promise<void> {
  const { error, response } = await withCsrfRetry(() =>
    api.DELETE('/api/v1/venue-types/{id}', {
      params: { path: { id }, header: { 'x-csrf-token': '' } },
    }),
  )
  if (!response.ok) throw new ApiError(response.status, messageFrom(error, response))
}

export async function listAmenities(): Promise<Amenity[]> {
  const { data, error, response } = await api.GET('/api/v1/amenities')
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

export async function createAmenity(body: OptionInput): Promise<Amenity> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.POST('/api/v1/amenities', {
      params: { header: { 'x-csrf-token': '' } },
      body,
    }),
  )
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

export async function patchAmenity(id: number, body: OptionInput): Promise<Amenity> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.PATCH('/api/v1/amenities/{id}', {
      params: { path: { id }, header: { 'x-csrf-token': '' } },
      body,
    }),
  )
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

/**
 * Delete an amenity and release its ticks. Answers **200 with a body**, unlike the other three
 * option tables' 204 — hence a return value rather than `void`. See the block comment above.
 */
export async function deleteAmenity(id: number): Promise<AmenityDeleteResult> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.DELETE('/api/v1/amenities/{id}', {
      params: { path: { id }, header: { 'x-csrf-token': '' } },
    }),
  )
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

// ---------------------------------------------------------------------------
// Venues (สถานที่จัดกิจกรรม).
//
// ⚠️ THE READ IS OPEN TO EVERY ROLE, the writes are not — the opposite split from
// the four curated option tables, where a VIEWER is a 403 even on GET. The
// difference is what the destination IS: `การตั้งค่าระบบ` is an action surface
// with no read-only value, while a venue list is exactly what a supervisor is
// expected to look at. `use-acl.ts` agrees; it does not deny this route.
//
// ⚠️ `isOpen` IS NOT A FIELD YOU PATCH. Closing needs a reason and reopening
// clears it, so it is a transition with its own two calls. Sending `isOpen` on a
// PATCH is a 400 at the pipe, which is the contract working, not a bug.
// ---------------------------------------------------------------------------

export interface ListVenuesParams {
  /** Matches the NAME or the LOCATION — the two things the search box names. */
  q?: string
  /**
   * The reserved tombstone id is ACCEPTED here, unlike on create/update: this is how an operator
   * finds the venues that fell in there when a category was deleted.
   */
  venueTypeId?: number
  status?: 'open' | 'closed'
}

/** Every non-deleted venue, `name ASC`. No pagination — the endpoint returns the lot. */
export async function listVenues(params: ListVenuesParams = {}): Promise<Venue[]> {
  const { data, error, response } = await api.GET('/api/v1/venues', {
    params: { query: params },
  })
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

export async function createVenue(body: CreateVenueBody): Promise<Venue> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.POST('/api/v1/venues', {
      params: { header: { 'x-csrf-token': '' } },
      body,
    }),
  )
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

/**
 * Partial update. `amenityIds` and `photoUrls` REPLACE their whole set when present and mean
 * UNCHANGED when omitted — clearing is `[]`. `photoUrls` is ordered and index 0 is the cover.
 */
export async function patchVenue(id: string, body: UpdateVenueBody): Promise<Venue> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.PATCH('/api/v1/venues/{id}', {
      params: { path: { id }, header: { 'x-csrf-token': '' } },
      body,
    }),
  )
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

/** ปิดชั่วคราว. The reason is shown to end users, so the server refuses a blank one with a 400. */
export async function closeVenue(id: string, reason: string): Promise<Venue> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.POST('/api/v1/venues/{id}/close', {
      params: { path: { id }, header: { 'x-csrf-token': '' } },
      body: { reason },
    }),
  )
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

/** เปิดให้จอง. Clears `closedReason` to null, which the confirm dialog promises out loud. */
export async function reopenVenue(id: string): Promise<Venue> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.POST('/api/v1/venues/{id}/reopen', {
      params: { path: { id }, header: { 'x-csrf-token': '' } },
    }),
  )
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

/** Soft delete. Returns nothing on 204. */
export async function deleteVenue(id: string): Promise<void> {
  const { error, response } = await withCsrfRetry(() =>
    api.DELETE('/api/v1/venues/{id}', {
      params: { path: { id }, header: { 'x-csrf-token': '' } },
    }),
  )
  if (!response.ok) throw new ApiError(response.status, messageFrom(error, response))
}

/**
 * Venue photo constraints, mirrored client-side for fast feedback only — the server enforces them
 * authoritatively and sniffs magic bytes, which we cannot.
 *
 * ⚠️ THE SIZE LIMIT IS EXCLUSIVE, exactly as the avatar one is: the backend accepts a file of
 * exactly 5 MiB and rejects 5 MiB + 1, so the reject condition is `>`, never `>=`.
 */
export const VENUE_PHOTO_MAX_BYTES = 5 * 1024 * 1024
export const VENUE_PHOTOS_MAX = 10

/**
 * Upload ONE venue photo and get its URL back. There is no venue id in the path, and that is the
 * shape the whole flow turns on: photos are picked inside the CREATE dialog, before a venue exists.
 *
 * The object is stored UNBOUND. It becomes part of a venue only when its URL is sent in `photoUrls`
 * on a create or update — and if the operator cancels instead, `discardVenuePhoto` removes it.
 *
 * ⚠️ AN ABANDONED UPLOAD IS A REAL LEAK, not a hypothetical one: a closed tab or a lost connection
 * skips the discard call and leaves bytes nothing references. It is bounded and invisible, and there
 * is no sweep job yet.
 */
export async function uploadVenuePhoto(file: File): Promise<string> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.POST('/api/v1/venues/photos', {
      params: { header: { 'x-csrf-token': '' } },
      // The generated type calls `file` a binary string; the wire wants a File.
      body: { file: file as unknown as string },
      // Returning FormData makes openapi-fetch drop its JSON Content-Type so the browser sets the
      // multipart boundary itself.
      bodySerializer(body: { file: string }) {
        const form = new FormData()
        form.append('file', body.file as unknown as File)
        return form
      },
    }),
  )
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data.url
}

/**
 * Discard an uploaded photo the operator backed out of.
 *
 * The server REFUSES any URL a venue still references (409) — removing a photo FROM a venue is a
 * `patchVenue` of `photoUrls`, which deletes the dropped objects itself. That refusal is what makes
 * this endpoint safe to call from a cancel handler without checking anything first.
 */
export async function discardVenuePhoto(url: string): Promise<void> {
  const { error, response } = await withCsrfRetry(() =>
    api.DELETE('/api/v1/venues/photos', {
      params: { header: { 'x-csrf-token': '' } },
      body: { url },
    }),
  )
  if (!response.ok) throw new ApiError(response.status, messageFrom(error, response))
}

// ---------------------------------------------------------------------------
// Booking requests (คำขอจองสถานที่) — the approval queue.
//
// ⚠️ THE ADMIN SURFACE, NOT THE LIFF ONE. `/booking-requests` is behind the
// cookie session + `RolesGuard`; the end-user's own bookings live under a
// different prefix behind the LINE id-token guard. The two never share a call.
//
// ⚠️ EVERYTHING IS FILTERED, SORTED AND PAGED BY THE SERVER. This table is the
// whole school across every term — fetching it and slicing in the browser is
// the failure that arrives quietly, and the endpoint already refuses to answer
// that way (`limit` is 10/20/50 or a 400).
// ---------------------------------------------------------------------------

export interface ListBookingRequestsParams {
  page?: number
  limit?: BookingRequestLimit
  /**
   * One box, four fields server-side: the booking `code`, the purpose, the venue name, and the
   * requester's name — which has two sources (`requesterName` on a staff-raised booking, or the
   * LINE user's registered first/last name).
   *
   * ⚠️ It cannot match across the space between a first and last name ("สมชาย ใจดี" finds nothing),
   * the same limitation `GET /line-users` documents. A leading `#` is stripped server-side, so an
   * operator pasting `#BR-…` out of a chat still finds the row.
   */
  search?: string
  /** An unknown id yields an empty list with `total: 0`, not a 404 — it is a filter, not a resource. */
  venueId?: string
  /** Absent = the `ทั้งหมด` tab. ⛔ There is no `EXPIRED` value; see `isExpired` on the row. */
  status?: BookingStatus
  sort?: BookingRequestSort
}

/**
 * One page of the queue, plus `counts`.
 *
 * ⚠️ `counts` IS COMPUTED WITHOUT `status` (but WITH `search` and `venueId`), so the five tab
 * badges do not all drop to zero the moment a tab is selected. It is one fact rendered once — the
 * screen must not recount the page it is holding.
 */
export async function listBookingRequests(
  params: ListBookingRequestsParams = {},
): Promise<PaginatedBookingRequests> {
  const query: NonNullable<
    paths['/api/v1/booking-requests']['get']['parameters']['query']
  > = {}
  if (params.page != null) query.page = params.page
  if (params.limit != null) query.limit = params.limit
  if (params.search && params.search.trim().length > 0) query.search = params.search.trim()
  if (params.venueId) query.venueId = params.venueId
  if (params.status) query.status = params.status
  if (params.sort) query.sort = params.sort

  const { data, error, response } = await api.GET('/api/v1/booking-requests', {
    params: { query },
  })
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

/**
 * One request, with its conflict picture (`GET /booking-requests/:id`).
 *
 * ⚠️ CUID ONLY. The LIFF detail also accepts a `BR-…` code; this one does not, and it does not need
 * to — the dialog is always opened from a row that already carries the id.
 *
 * ⚠️ `conflicts` IS ADVISORY. It is read outside the deciding transaction, so a disabled confirm
 * button is UX and never the boundary: the approval transaction refuses again, with a 409.
 */
export async function getBookingRequest(id: string): Promise<BookingRequestDetail> {
  const { data, error, response } = await api.GET('/api/v1/booking-requests/{id}', {
    params: { path: { id } },
  })
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

/**
 * อนุมัติ (`POST /booking-requests/:id/approve`) — ADR-001's write.
 *
 * ⚠️ NO BODY AT ALL. There is nothing to say, and `forbidNonWhitelisted` answers 400 to any key —
 * so this must not grow an empty object "for symmetry" with the two below.
 *
 * `409` is the answer to a request that is no longer PENDING, and to one whose slots an APPROVED
 * booking already holds; nothing is written in either case.
 */
export async function approveBookingRequest(id: string): Promise<ApproveBookingResult> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.POST('/api/v1/booking-requests/{id}/approve', {
      params: { path: { id }, header: { 'x-csrf-token': '' } },
    }),
  )
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

/**
 * ปฏิเสธ (`POST /booking-requests/:id/reject`).
 *
 * ⚠️ THE REASON IS TRIMMED HERE AS WELL AS THERE. The server trims before it checks, so a
 * whitespace-only string is a 400 — sending it would be this layer forwarding a value it can already
 * see is empty. It reaches the requester RAW, in LINE and on My Bookings.
 */
export async function rejectBookingRequest(
  id: string,
  reason: string,
): Promise<BookingRequestDetail> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.POST('/api/v1/booking-requests/{id}/reject', {
      params: { path: { id }, header: { 'x-csrf-token': '' } },
      body: { reason: reason.trim() },
    }),
  )
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

/**
 * ยกเลิก (`POST /booking-requests/:id/cancel`) — the whole booking, or named slots.
 *
 * ⚠️ OMITTED IS NOT `[]` AND NOT `null`. Leaving `slotIds` out cancels every live slot; an empty
 * array is a 400 ("say what you mean") and so is an explicit `null`. That is why the argument is
 * optional and the key is only added when there is something in it.
 *
 * The response is the request as it now stands — including whether cancelling the last live slot
 * turned it `CANCELLED`. ⚠️ That is the SERVER's ruling: never infer it from the ids that were sent.
 */
export async function cancelBookingRequest(
  id: string,
  reason: string,
  slotIds?: readonly string[],
): Promise<BookingRequestDetail> {
  const body: components['schemas']['CancelBookingRequestDto'] =
    slotIds && slotIds.length > 0
      ? { reason: reason.trim(), slotIds: [...slotIds] }
      : { reason: reason.trim() }
  const { data, error, response } = await withCsrfRetry(() =>
    api.POST('/api/v1/booking-requests/{id}/cancel', {
      params: { path: { id }, header: { 'x-csrf-token': '' } },
      body,
    }),
  )
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

/**
 * The create dialog's live conflict banner (`POST /booking-requests/preflight`).
 *
 * ⚠️ A POST THAT WRITES NOTHING, and the verb is the payload's fault rather than a mistake: up to
 * sixty spans do not belong in a query string. It answers `200`, all three roles may call it, and it
 * still carries CSRF because it is still a POST.
 *
 * ⚠️ IT VALIDATES THROUGH THE SAME FUNCTION `direct` DOES, so a `400` here PREDICTS a `400` there —
 * a span in the past, reversed, or overlapping another span of the same submission. Surface that
 * message rather than swallowing it: a banner that says "clean" and then fails on submit is a banner
 * the operator stops reading.
 *
 * ⚠️ CALLERS MUST DISCARD A STALE ANSWER. It runs while somebody is typing, so a reply can land
 * after its own question has been replaced.
 */
export async function preflightBooking(body: {
  venueId: string
  slots: readonly BookingSlotInput[]
}): Promise<BookingPreflight> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.POST('/api/v1/booking-requests/preflight', {
      params: { header: { 'x-csrf-token': '' } },
      body: { venueId: body.venueId, slots: [...body.slots] },
    }),
  )
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

/**
 * จองแทน (`POST /booking-requests/direct`) — the booking lands `APPROVED`, approved by the caller.
 *
 * ⚠️ THE RESPONSE IS WHAT HAPPENED; the preflight was only what was expected to. `autoRejected` is
 * the ADR-001 list the deciding transaction actually refused, and it can differ from the
 * `overlappingPendingRequests` the dialog was showing — report THIS one.
 *
 * `409` is an APPROVED booking already holding one of the spans (nothing is written). `400` covers
 * both origin shapes at once, an unusable `lineUserId`/`departmentId`, and every span rule.
 * A CLOSED venue is NOT an error — see `BookingPreflight`.
 */
export async function createDirectBooking(
  body: CreateDirectBookingBody,
): Promise<ApproveBookingResult> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.POST('/api/v1/booking-requests/direct', {
      params: { header: { 'x-csrf-token': '' } },
      body,
    }),
  )
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}
