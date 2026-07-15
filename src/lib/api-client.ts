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
export type SystemUser = components['schemas']['SystemUserResponseDto']
export type SystemRole = SystemUser['role']
export type LoginResponse = components['schemas']['LoginResponseDto']
export type PaginatedSystemUsers = components['schemas']['PaginatedSystemUsersResponseDto']
export type CreateSystemUserBody = components['schemas']['CreateSystemUserDto']
export type UpdateSystemUserBody = components['schemas']['UpdateSystemUserDto']
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

/** Dynamic registration option lists (admin-curated Departments / PersonnelRoles). */
export type RegistrationOptions = components['schemas']['RegistrationOptionsResponseDto']
export type RegistrationOption = components['schemas']['OptionDto']

/** Admin option-management (Department / PersonnelRole) shapes. */
export type Department = components['schemas']['DepartmentResponseDto']
export type PersonnelRole = components['schemas']['PersonnelRoleResponseDto']
/** Both option create/rename bodies are structurally `{ name }`. */
export type OptionInput = components['schemas']['CreateDepartmentDto']

/** The Allow/Block actions the LINE Users UI may send — never PENDING. */
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
// LINE users.
// ---------------------------------------------------------------------------

export interface ListLineUsersParams {
  page?: number
  limit?: number
  search?: string
  access?: AppAccess
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

  const { data, error, response } = await api.GET('/api/v1/line-users', {
    params: { query },
  })
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

/**
 * Approve/Block a LINE user. The frontend only ever sends ALLOWED or BLOCKED —
 * PENDING is a system state, never a user action.
 */
export async function patchLineUserAccess(
  id: string,
  access: AccessAction,
): Promise<LineUser> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.PATCH('/api/v1/line-users/{id}', {
      params: { path: { id }, header: { 'x-csrf-token': '' } },
      body: { access },
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
 * four screens (UNREGISTERED / PENDING / ALLOWED / BLOCKED) to render.
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
 * Backend rejects with 403 if they are no longer PENDING, 400 for a
 * deleted/unknown option, and 409 (`STAFF_ID_TAKEN`) for a taken staff id.
 * Returns the refreshed status view so the UI can re-render the Pending screen.
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

export async function listSystemUsers(
  params: { page?: number; limit?: number } = {},
): Promise<PaginatedSystemUsers> {
  const query: NonNullable<
    paths['/api/v1/system-users']['get']['parameters']['query']
  > = {}
  if (params.page != null) query.page = params.page
  if (params.limit != null) query.limit = params.limit

  const { data, error, response } = await api.GET('/api/v1/system-users', {
    params: { query },
  })
  if (!data) throw new ApiError(response.status, messageFrom(error, response))
  return data
}

export async function createSystemUser(body: CreateSystemUserBody): Promise<SystemUser> {
  const { data, error, response } = await withCsrfRetry(() =>
    api.POST('/api/v1/system-users', {
      params: { header: { 'x-csrf-token': '' } },
      body,
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

export async function patchDepartment(id: string, body: OptionInput): Promise<Department> {
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
export async function deleteDepartment(id: string): Promise<void> {
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

export async function patchPersonnelRole(id: string, body: OptionInput): Promise<PersonnelRole> {
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
export async function deletePersonnelRole(id: string): Promise<void> {
  const { error, response } = await withCsrfRetry(() =>
    api.DELETE('/api/v1/personnel-roles/{id}', {
      params: { path: { id }, header: { 'x-csrf-token': '' } },
    }),
  )
  if (!response.ok) throw new ApiError(response.status, messageFrom(error, response))
}
